import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import notificationSoundCommon from "../assets/notification sound common.mp3";
import {
  getFormattedDate,
  getLastShiftChangeTime,
  getTransitionContext,
  resolveActiveShiftFromTime,
} from "../lib/shiftLogic";

const DUTY_STORAGE_KEY = "riskops_duty_role";
const LEGACY_DUTY_STORAGE_KEY = "riskops_duty_account";

const getDutySessionMarker = (inputNow = getGMT8Time()) => {
  const activeShift = resolveActiveShiftFromTime(inputNow);
  const shiftStart = getLastShiftChangeTime(inputNow);
  return `${getFormattedDate(shiftStart)}|${activeShift}`;
};

const normalizeSavedDutyState = (saved) => {
  if (!saved) return { duties: [], marker: null };

  try {
    const parsed = JSON.parse(saved);

    if (Array.isArray(parsed)) {
      return { duties: parsed, marker: null };
    }

    if (parsed && Array.isArray(parsed.duties)) {
      return { duties: parsed.duties, marker: parsed.marker || null };
    }
  } catch {
    return { duties: [saved], marker: null };
  }

  return { duties: [], marker: null };
};

const readStoredDutyForCurrentShift = () => {
  const saved = localStorage.getItem(DUTY_STORAGE_KEY);
  const { duties, marker } = normalizeSavedDutyState(saved);
  const currentMarker = getDutySessionMarker();

  if (marker && marker === currentMarker) {
    return duties;
  }

  localStorage.removeItem(DUTY_STORAGE_KEY);
  localStorage.removeItem(LEGACY_DUTY_STORAGE_KEY);
  return [];
};

const writeStoredDutyForCurrentShift = (duties) => {
  if (!Array.isArray(duties) || duties.length === 0) {
    localStorage.removeItem(DUTY_STORAGE_KEY);
    localStorage.removeItem(LEGACY_DUTY_STORAGE_KEY);
    return;
  }

  localStorage.setItem(
    DUTY_STORAGE_KEY,
    JSON.stringify({
      duties,
      marker: getDutySessionMarker(),
    }),
  );
  localStorage.removeItem(LEGACY_DUTY_STORAGE_KEY);
};

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

  const [selectedDuty, setSelectedDuty] = useState(readStoredDutyForCurrentShift);

  // --- NEW: Connection Refresh Trigger ---
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

        if (data.role === "Admin" || data.role === "Leader" || data.role === "QC") {
          setSelectedDuty((prev) => {
            if (prev && prev.length > 0 && prev.includes("IC0")) return prev;
            return ["IC0"];
          });
          writeStoredDutyForCurrentShift(["IC0"]);
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
        localStorage.removeItem(DUTY_STORAGE_KEY);
        localStorage.removeItem(LEGACY_DUTY_STORAGE_KEY);
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
    writeStoredDutyForCurrentShift(selectedDuty);
  }, [selectedDuty]);

  useEffect(() => {
    if (
      !user?.id ||
      !userRole ||
      userRole === "Admin" ||
      userRole === "Leader" ||
      userRole === "QC" ||
      !selectedDuty ||
      selectedDuty.length === 0 ||
      !myAssignedShift ||
      myAssignedShift === "Off" ||
      !currentActiveShift ||
      myAssignedShift === currentActiveShift
    ) {
      return;
    }

    const transitionCtx = getTransitionContext();
    const canRemainInTransition =
      !!transitionCtx &&
      (myAssignedShift === transitionCtx.pair.outgoing ||
        myAssignedShift === transitionCtx.pair.incoming);

    if (canRemainInTransition) {
      return;
    }

    localStorage.setItem(
      "riskops_duty_notice",
      "Your previous shift is locked. Please select the duty account for this shift.",
    );
    const redirectTimer = setTimeout(() => {
      setSelectedDuty([]);
    }, 0);

    return () => clearTimeout(redirectTimer);
  }, [
    currentActiveShift,
    myAssignedShift,
    selectedDuty,
    user?.id,
    userRole,
  ]);

  // --- 3. STATIC PRESENCE TRACKING ARCHITECTURE (Golden Pattern) ---
  useEffect(() => {
    // 1. Wait until the user data is actually loaded before connecting
    if (!user?.id || !workName || !userRole) return;

    // 2. Clean up any ghost connections
    if (presenceChannelRef.current) {
      supabase.removeChannel(presenceChannelRef.current);
    }

    const channel = supabase.channel("online-users", {
      config: { presence: { key: user.id } },
    });

    presenceChannelRef.current = channel;

    const flushRecentlyOfflineUsers = (activeUsers = []) => {
      const now = Date.now();
      const activeKeys = new Set(activeUsers.map((u) => String(u.id || u.workName || "")));
      const recent = [];

      for (const [key, entry] of presenceLastSeenRef.current.entries()) {
        if (!entry || !entry.record || !entry.lastSeenAt) {
          presenceLastSeenRef.current.delete(key);
          continue;
        }
        if (now - entry.lastSeenAt > RECENTLY_ONLINE_GRACE_MS) {
          presenceLastSeenRef.current.delete(key);
          continue;
        }
        if (!activeKeys.has(key)) {
          recent.push({ ...entry.record, lastSeenAt: entry.lastSeenAt, presenceState: "recently-offline" });
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
            const latestRecord = [...userRecords].sort((a, b) => (b._timestamp || 0) - (a._timestamp || 0))[0];
            activeUsers.push(latestRecord);
            presenceLastSeenRef.current.set(String(latestRecord.id || latestRecord.workName || key), { record: latestRecord, lastSeenAt: now });
          }
        });

        setOnlineUsers(activeUsers);
        onlineUsersRef.current = activeUsers;
        setPresenceDebug((prev) => ({ ...prev, lastPresenceSyncAt: now }));
        flushRecentlyOfflineUsers(activeUsers);
      })
      .subscribe(async (status) => {
        const prevStatus = lastPresenceStatusRef.current;
        lastPresenceStatusRef.current = status;

        setPresenceDebug((prev) => ({
          ...prev,
          lastSubscribeStatus: status,
          reconnectCount: status === "SUBSCRIBED" && prevStatus !== "IDLE" && prevStatus !== "SUBSCRIBED" ? prev.reconnectCount + 1 : prev.reconnectCount,
        }));

        // 3. THE GOLDEN FIX: Only track once we are officially SUBSCRIBED. No setInterval loop!
        if (status === "SUBSCRIBED") {
          const now = Date.now();
          await channel.track({
            id: user.id,
            workName: workName || user.email?.split("@")[0] || "Unknown User",
            duties: selectedDuty || [],
            role: userRole || "User",
            _timestamp: now,
          });

          setPresenceDebug((prev) => ({ ...prev, lastHeartbeatAt: now }));
        }
      });

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
  // 4. By putting selectedDuty here, if they change IC duty, it cleanly re-syncs!
  }, [user?.id, user?.email, workName, userRole, selectedDuty]);

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
    }
  };

  const resetTransferResponse = () => setTransferResponse(null);
  const setDuty = (val) => setSelectedDuty(val);

  // NEW: Ghost Mode - Clears local storage for the next shift, but keeps current session active
  const clearDutyMemory = () => {
    localStorage.removeItem(DUTY_STORAGE_KEY);
    localStorage.removeItem(LEGACY_DUTY_STORAGE_KEY);
  };

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
        clearDutyMemory,
      }}
    >
      {children}
    </DutyContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useDuty = () => useContext(DutyContext);
