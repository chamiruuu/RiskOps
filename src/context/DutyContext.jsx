import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import notificationSoundCommon from "../assets/notification sound common.mp3";
import { resolveActiveShiftFromTime } from "../lib/shiftLogic";

// --- HELPER: Get Current GMT+8 Time ---
const getGMT8Time = () => {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * 8);
};

const shouldShowSystemNotification = () =>
  document.visibilityState !== "visible" || !document.hasFocus();

const RECENTLY_ONLINE_GRACE_MS = 120 * 1000;

const DutyContext = createContext();

export const DutyProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [workName, setWorkName] = useState("");
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [recentlyOfflineUsers, setRecentlyOfflineUsers] = useState([]);
  const [presenceDebug, setPresenceDebug] = useState({
    lastHeartbeatAt: null,
    lastSubscribeStatus: "IDLE",
    reconnectCount: 0,
    lastPresenceSyncAt: null,
  });

  // --- MASTER KEY STATES ---
  const [currentActiveShift, setCurrentActiveShift] = useState(null);
  const [myAssignedShift, setMyAssignedShift] = useState("Off");
  const [activeRoster, setActiveRoster] = useState({});

  // --- REAL-TIME TRANSFER HANDSHAKE STATES ---
  const [pendingTransferRequest, setPendingTransferRequest] = useState(null);
  const [transferResponse, setTransferResponse] = useState(null);
  const transferChannelRef = useRef(null);

  const currentUserTracker = useRef(null);

  // --- STATIC PRESENCE CHANNEL REF ---
  const presenceChannelRef = useRef(null);
  const presenceLastSeenRef = useRef(new Map());
  const lastPresenceStatusRef = useRef("IDLE");

  const [selectedDuty, setSelectedDuty] = useState(() => {
    const saved = localStorage.getItem("riskops_duty_role");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [saved];
      }
    }
    return [];
  });

  // --- NEW: Connection Refresh Trigger ---
  const [presenceTrigger, setPresenceTrigger] = useState(0);
  const onlineUsersRef = useRef([]);

  const fetchUserProfile = async (userId) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("role, work_name")
        .eq("id", userId)
        .single();

      if (data) {
        setUserRole(data.role);
        setWorkName(data.work_name || "");

        if (data.role === "Admin" || data.role === "Leader") {
          setSelectedDuty((prev) => {
            if (prev && prev.length > 0 && prev.includes("IC0")) return prev;
            return ["IC0"];
          });
          localStorage.setItem("riskops_duty_role", JSON.stringify(["IC0"]));
        }
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  // --- 1. CLOCK CHECKER (Master Timekeeper) ---
  useEffect(() => {
    const checkShiftPeriod = () => {
      const now = getGMT8Time();
      setCurrentActiveShift(resolveActiveShiftFromTime(now));
    };
    
    checkShiftPeriod();
    const timer = setInterval(checkShiftPeriod, 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchScheduleAndRoster = useCallback(async () => {
    if (!user) {
      setActiveRoster({});
      setMyAssignedShift("Off");
      return;
    }

    const { data: allCycles } = await supabase
      .from("shift_assignments")
      .select("cycle_period");
    let currentLiveCycle = null;

    if (allCycles) {
      const uniqueCycles = [...new Set(allCycles.map((d) => d.cycle_period))].filter(
        Boolean,
      );
      const today = getGMT8Time();
      const h = today.getHours();
      const m = today.getMinutes();

      // Keep using the previous operational day through 07:15
      if (h < 7 || (h === 7 && m <= 15)) {
        today.setDate(today.getDate() - 1);
      }
      today.setHours(0, 0, 0, 0);

      // Parse "22 Feb 2026" safely across browsers/timezones.
      const parseDateSafe = (dateStr) => {
        const mMap = {
          Jan: 0,
          Feb: 1,
          Mar: 2,
          Apr: 3,
          May: 4,
          Jun: 5,
          Jul: 6,
          Aug: 7,
          Sep: 8,
          Oct: 9,
          Nov: 10,
          Dec: 11,
        };
        const p = dateStr.trim().split(" ");
        if (p.length === 3) return new Date(p[2], mMap[p[1]], p[0]);
        return new Date(dateStr);
      };

      for (const c of uniqueCycles) {
        const parts = c.split(" - ");
        if (parts.length === 2) {
          const start = parseDateSafe(parts[0]);
          const end = parseDateSafe(parts[1]);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);

          if (today >= start && today <= end) {
            currentLiveCycle = c;
            break;
          }
        }
      }
    }

    if (currentLiveCycle) {
      const { data: assignments } = await supabase
        .from("shift_assignments")
        .select("user_id, shift_type")
        .eq("cycle_period", currentLiveCycle);

      const { data: profiles, error: profilesError } = await supabase.rpc(
        "list_profile_directory",
      );

      if (profilesError) {
        console.error("Error fetching roster profile directory:", profilesError);
      }

      if (assignments && profiles) {
        const profileById = new Map(profiles.map((p) => [p.id, p]));
        const rosterMap = {};
        let myShift = "Off";

        assignments.forEach((a) => {
          const prof = profileById.get(a.user_id);
          if (prof && prof.work_name) {
            rosterMap[prof.work_name] = a.shift_type;
          }
          if (a.user_id === user.id) {
            myShift = a.shift_type;
          }
        });

        setActiveRoster(rosterMap);
        setMyAssignedShift(myShift);
        return;
      }
    }

    setActiveRoster({});
    setMyAssignedShift("Off");
  }, [user]);

  // --- 2. FETCH SCHEDULE & ROSTER ---
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchScheduleAndRoster();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchScheduleAndRoster]);

  // Keep schedule fresh when admin edits shifts while users are online.
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("shift-assignments-live-refresh")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shift_assignments" },
        () => fetchScheduleAndRoster(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchScheduleAndRoster]);

  const isMyShiftActive = myAssignedShift === currentActiveShift;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      currentUserTracker.current = session?.user?.id;

      if (session?.user) {
        fetchUserProfile(session.user.id).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const incomingUserId = session?.user?.id;
      const isNewLogin = incomingUserId !== currentUserTracker.current;
      const hadActiveUser = Boolean(currentUserTracker.current);

      if (event) {
        console.log("Auth state changed:", event);
      }

      currentUserTracker.current = incomingUserId;
      setUser(session?.user ?? null);

      if (isNewLogin && session?.user) {
        setLoading(true);
        fetchUserProfile(session.user.id).then(() => setLoading(false));
      } else if (!session?.user) {
        if (hadActiveUser && (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED")) {
          localStorage.setItem(
            "riskops_auth_notice",
            "Your session expired or was revoked. Please sign in again.",
          );
        }

        setUserRole(null);
        setWorkName("");
        setSelectedDuty([]);
        localStorage.removeItem("riskops_duty_role");
        setRecentlyOfflineUsers([]);
        presenceLastSeenRef.current.clear();
        setPresenceDebug({
          lastHeartbeatAt: null,
          lastSubscribeStatus: "IDLE",
          reconnectCount: 0,
          lastPresenceSyncAt: null,
        });

        // Clean up connection on logout
        if (presenceChannelRef.current) {
          supabase.removeChannel(presenceChannelRef.current);
          presenceChannelRef.current = null;
        }

        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedDuty && selectedDuty.length > 0) {
      localStorage.setItem("riskops_duty_role", JSON.stringify(selectedDuty));
    } else {
      localStorage.removeItem("riskops_duty_role");
    }
  }, [selectedDuty]);

  // --- 3. STATIC PRESENCE TRACKING ARCHITECTURE ---
  // 3a. Initialize the Channel ONLY ONCE (OR when forced to refresh)
  useEffect(() => {
    if (!user?.id) return;

    // 1. Force completely clean up old connection if we are refreshing
    if (presenceChannelRef.current) {
      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }

    const channel = supabase.channel("online-users", {
      config: { presence: { key: user.id } },
    });

    const flushRecentlyOfflineUsers = (activeUsers = []) => {
      const now = Date.now();
      const activeKeys = new Set(
        activeUsers.map((u) => String(u.id || u.workName || "")),
      );
      const recent = [];

      for (const [key, entry] of presenceLastSeenRef.current.entries()) {
        if (!entry || !entry.record || !entry.lastSeenAt) {
          presenceLastSeenRef.current.delete(key);
          continue;
        }

        const age = now - entry.lastSeenAt;
        if (age > RECENTLY_ONLINE_GRACE_MS) {
          presenceLastSeenRef.current.delete(key);
          continue;
        }

        if (!activeKeys.has(key)) {
          recent.push({
            ...entry.record,
            lastSeenAt: entry.lastSeenAt,
            presenceState: "recently-offline",
          });
        }
      }

      recent.sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
      setRecentlyOfflineUsers(recent);
    };

    channel
      .on("presence", { event: "sync" }, () => {
        const newState = channel.presenceState();
        const activeUsers = [];
        const now = Date.now();

        Object.keys(newState).forEach((key) => {
          const userRecords = newState[key];
          if (userRecords && userRecords.length > 0) {
            // --- NEW FIX: Sort by timestamp to ALWAYS grab the newest record ---
            // This guarantees we ignore old ghost records from Supabase
            const latestRecord = [...userRecords].sort((a, b) => (b._timestamp || 0) - (a._timestamp || 0))[0];
            activeUsers.push(latestRecord);

            const identityKey = String(
              latestRecord.id || latestRecord.workName || key,
            );
            presenceLastSeenRef.current.set(identityKey, {
              record: latestRecord,
              lastSeenAt: now,
            });
          }
        });

        setOnlineUsers(activeUsers);
        onlineUsersRef.current = activeUsers;
        setPresenceDebug((prev) => ({
          ...prev,
          lastPresenceSyncAt: now,
        }));
        flushRecentlyOfflineUsers(activeUsers);
      })
      .subscribe((status) => {
        const prevStatus = lastPresenceStatusRef.current;
        lastPresenceStatusRef.current = status;

        setPresenceDebug((prev) => ({
          ...prev,
          lastSubscribeStatus: status,
          reconnectCount:
            status === "SUBSCRIBED" &&
            prevStatus !== "IDLE" &&
            prevStatus !== "SUBSCRIBED"
              ? prev.reconnectCount + 1
              : prev.reconnectCount,
        }));
      });

    presenceChannelRef.current = channel;
    const recentTicker = setInterval(() => {
      flushRecentlyOfflineUsers(onlineUsersRef.current);
    }, 5000);

    return () => {
      clearInterval(recentTicker);
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
    };
  }, [user?.id, presenceTrigger]); // <-- Rebuilds connection when presenceTrigger changes!

  // 3b. Push state updates dynamically without breaking the connection
  useEffect(() => {
    if (!user?.id || !workName || !userRole || !presenceChannelRef.current)
      return;

    const updatePresence = async () => {
      try {
        const now = Date.now();
        await presenceChannelRef.current.track({
          id: user.id,
          workName: workName || user.email?.split("@")[0] || "Unknown User",
          duties: selectedDuty || [],
          role: userRole || "User",
          _timestamp: now, // Forces screen to recognize this as the newest
        });

        setPresenceDebug((prev) => ({
          ...prev,
          lastHeartbeatAt: now,
        }));
      } catch {
        // Socket may not be ready yet; heartbeat retries will sync shortly.
      }
    };

    const timeoutId = setTimeout(updatePresence, 300);
    const heartbeatId = setInterval(updatePresence, 10000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(heartbeatId);
    };
  }, [user?.id, user?.email, workName, userRole, selectedDuty, presenceTrigger]);

  // --- 4. STATIC REAL-TIME HANDSHAKE BROADCASTING ---
  useEffect(() => {
    if (!user?.id) return;

    // Prevent connection tearing by only opening this channel ONCE per session
    if (transferChannelRef.current) return;

    const channel = supabase.channel("duty-transfers", {
      config: { broadcast: { ack: true } } // Forces Supabase to guarantee delivery!
    });

    channel.on("broadcast", { event: "transfer_request" }, ({ payload }) => {
      if (payload.targetId === user.id) {
        setPendingTransferRequest(payload);

        const audio = new Audio(notificationSoundCommon);
        audio.play().catch(() => console.log("Audio blocked by browser"));

        if (
          shouldShowSystemNotification() &&
          Notification.permission === "granted"
        ) {
          new Notification("🔄 Duty Transfer Request", {
            body: `${payload.fromName} wants to transfer ${payload.duties.join(", ")} to you.`,
            icon: "/vite.svg",
          });
        }
      }
    });

    channel.on("broadcast", { event: "transfer_response" }, ({ payload }) => {
      if (payload.targetId === user.id) {
        setTransferResponse({ ...payload, _ts: Date.now() });
        
        // --- NEW FIX: Instantly drop the duties from the Sender if Accepted ---
        if (payload.status === "accepted") {
          setSelectedDuty((prev) =>
            (prev || []).filter((duty) => !payload.duties.includes(duty))
          );
          // REFRESH THE CONNECTION to clear ghosts!
          setTimeout(() => setPresenceTrigger(prev => prev + 1), 600);
        }
      }
    });

    channel.subscribe();
    transferChannelRef.current = channel;

    return () => {
      if (transferChannelRef.current) {
        supabase.removeChannel(transferChannelRef.current);
        transferChannelRef.current = null;
      }
    };
  }, [user?.id]); // Only runs once when user.id is set

  const sendTransferRequest = async (targetId, duties) => {
    if (!transferChannelRef.current) return;
    await transferChannelRef.current.send({
      type: "broadcast",
      event: "transfer_request",
      payload: {
        fromId: user.id,
        fromName: workName || user.email?.split("@")[0] || "Agent",
        targetId,
        duties,
      },
    });
  };

  const respondToTransferRequest = async (targetId, status, duties) => {
    if (!transferChannelRef.current) return;
    await transferChannelRef.current.send({
      type: "broadcast",
      event: "transfer_response",
      payload: { fromId: user.id, targetId, status, duties },
    });
    setPendingTransferRequest(null);

    if (status === "accepted") {
      setSelectedDuty((prev) =>
        Array.from(new Set([...(prev || []), ...duties])),
      );
      // REFRESH THE CONNECTION to clear ghosts!
      setTimeout(() => setPresenceTrigger(prev => prev + 1), 600);
    }
  };

  const resetTransferResponse = () => setTransferResponse(null);
  const setDuty = (val) => setSelectedDuty(val);

  return (
    <DutyContext.Provider
      value={{
        user,
        userRole,
        workName,
        selectedDuty,
        setDuty,
        onlineUsers,
        recentlyOfflineUsers,
        presenceDebug,
        loading,
        isMyShiftActive,
        myAssignedShift,
        currentActiveShift,
        activeRoster,
        pendingTransferRequest,
        transferResponse,
        sendTransferRequest,
        respondToTransferRequest,
        resetTransferResponse,
      }}
    >
      {children}
    </DutyContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useDuty = () => useContext(DutyContext);