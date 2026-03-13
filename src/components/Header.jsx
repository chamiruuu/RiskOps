import { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  Clock,
  LogOut,
  Shield,
  Users,
  X,
  UserPlus,
  Mail,
  Lock,
  RefreshCw,
  Copy,
  Check,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  Bell,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  ArchiveRestore,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { useDuty } from "../context/DutyContext";
import notificationSound from "../assets/Notification.mp3";

export default function Header() {
  const {
    selectedDuty,
    user,
    userRole,
    workName,
    onlineUsers,
    pendingTransferRequest,
    respondToTransferRequest,
    setDuty,
  } = useDuty();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  // --- Admin Modal States ---
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [activeTab, setActiveTab] = useState("list");
  const [teamMembers, setTeamMembers] = useState([]);

  // --- Edit States for Users List ---
  const [editingId, setEditingId] = useState(null);
  const [tempWorkName, setTempWorkName] = useState("");
  const [tempRole, setTempRole] = useState("");

  // --- Password List States ---
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [copiedRowId, setCopiedRowId] = useState(null);

  // --- Create User States ---
  const [newEmail, setNewEmail] = useState("");
  const [newWorkName, setNewWorkName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("User");

  const [generatedPwdDisplay, setGeneratedPwdDisplay] = useState("");

  const [isCreating, setIsCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState({ text: "", type: "" });
  const [copiedPwd, setCopiedPwd] = useState(false);

  const [shiftNotifications, setShiftNotifications] = useState([]);
  const { myAssignedShift } = useDuty();

  // --- Emergency Handover States ---
  const [emergencyRequests, setEmergencyRequests] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // --- DEDICATED SHIFT PLANNER STATES ---
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [cyclesList, setCyclesList] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState("");
  const [shiftData, setShiftData] = useState({});
  const [activeCycle, setActiveCycle] = useState("None");
  const [cycleWarning, setCycleWarning] = useState(null);

  // --- TRACKING REMINDER STATE ---
  const [trackingReminder, setTrackingReminder] = useState(null);

  // --- ARCHIVE HISTORY STATES ---
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [archivedTickets, setArchivedTickets] = useState([]);
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);

  const isAdminOrLeader = userRole === "Admin" || userRole === "Leader";

  const getDutyTextColorOnly = (dutyName) => {
    switch (dutyName) {
      case "IC0":
        return "text-purple-600";
      case "IC1":
        return "text-indigo-600";
      case "IC2":
        return "text-emerald-600";
      case "IC3":
        return "text-amber-600";
      case "IC5":
        return "text-rose-600";
      default:
        return "text-slate-600";
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!window.electronAPI || typeof window.electronAPI.onUpdaterStatus !== "function") {
      return undefined;
    }

    const unsubscribe = window.electronAPI.onUpdaterStatus((payload) => {
      if (!payload || !payload.type) return;

      if (payload.type === "checking" || payload.type === "downloading") {
        setIsCheckingUpdate(true);
        return;
      }

      if (
        payload.type === "none" ||
        payload.type === "available" ||
        payload.type === "downloaded" ||
        payload.type === "error" ||
        payload.type === "installing"
      ) {
        setIsCheckingUpdate(false);
      }
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  const handleCheckForUpdates = async () => {
    if (!window.electronAPI || typeof window.electronAPI.checkForUpdates !== "function") {
      alert("Update check is only available in the desktop app build.");
      return;
    }

    setIsCheckingUpdate(true);
    try {
      await window.electronAPI.checkForUpdates();
    } catch {
      setIsCheckingUpdate(false);
      alert("Unable to start update check. Please try again.");
    }
  };

  useEffect(() => {
    if (showAdminModal || showShiftModal) {
      fetchTeam();
    }
  }, [showAdminModal, showShiftModal]);

  useEffect(() => {
    fetchCyclesList();
  }, []);

  useEffect(() => {
    if (selectedCycle && showShiftModal) {
      fetchShiftDataForCycle(selectedCycle);
    }
  }, [selectedCycle, showShiftModal]);

  // --- TRACKING ID EVENT LISTENER ---
  useEffect(() => {
    const handleReminder = (e) => {
      setTrackingReminder({
        id: "tracking-reminder-" + e.detail.time,
        type: "action-reminder",
        text: `You have ${e.detail.missingCount} pending ticket(s) missing a Tracking ID. Handover opens in 5 minutes!`,
        time: e.detail.time,
      });
    };
    const clearReminder = () => setTrackingReminder(null);

    window.addEventListener("tracking-reminder-alert", handleReminder);
    window.addEventListener("clear-tracking-reminder", clearReminder);

    return () => {
      window.removeEventListener("tracking-reminder-alert", handleReminder);
      window.removeEventListener("clear-tracking-reminder", clearReminder);
    };
  }, []);

  const fetchCyclesList = async () => {
    const { data } = await supabase
      .from("shift_assignments")
      .select("cycle_period");
    if (data) {
      const uniqueCycles = [...new Set(data.map((d) => d.cycle_period))].filter(
        Boolean,
      );

      uniqueCycles.sort((a, b) => {
        const dateA = new Date(a.split(" - ")[0]);
        const dateB = new Date(b.split(" - ")[0]);
        return dateB - dateA;
      });

      setCyclesList(uniqueCycles);
    }
  };

  // --- AUTO-DETECT LIVE CYCLE & 5-DAY WARNING ENGINE ---
  useEffect(() => {
    if (!cyclesList.length) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentLive = null;
    let warningMsg = null;

    for (const c of cyclesList) {
      const parts = c.split(" - ");
      if (parts.length === 2) {
        const start = new Date(parts[0]);
        const end = new Date(parts[1]);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        if (today >= start && today <= end) {
          currentLive = c;

          const msPerDay = 1000 * 60 * 60 * 24;
          const daysLeft = Math.ceil((end - today) / msPerDay);

          if (daysLeft <= 5 && daysLeft >= 0) {
            const nextExpectedStart = new Date(end);
            nextExpectedStart.setDate(nextExpectedStart.getDate() + 1);
            nextExpectedStart.setHours(0, 0, 0, 0);

            const hasNextCycle = cyclesList.some((otherC) => {
              const otherStart = new Date(otherC.split(" - ")[0]);
              otherStart.setHours(0, 0, 0, 0);
              return otherStart.getTime() === nextExpectedStart.getTime();
            });

            if (!hasNextCycle) {
              warningMsg = `The current shift cycle ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Please generate the next cycle to prevent handover lockouts.`;
            }
          }
          break;
        }
      }
    }

    setActiveCycle(currentLive || "None");
    setCycleWarning(warningMsg);

    if (!selectedCycle && currentLive) {
      setSelectedCycle(currentLive);
    } else if (!selectedCycle && cyclesList.length > 0) {
      setSelectedCycle(cyclesList[0]);
    }
  }, [cyclesList, selectedCycle]);

  // --- BROWSER NOTIFICATIONS & HANDOVER ALERTS ---
  useEffect(() => {
    if (
      Notification.permission !== "granted" &&
      Notification.permission !== "denied"
    ) {
      Notification.requestPermission();
    }

    const fetchHandoverAlerts = async () => {
      if (!myAssignedShift || myAssignedShift === "Off") return;

      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      const { data } = await supabase
        .from("shift_notifications")
        .select("*")
        .eq("target_shift", myAssignedShift)
        .gte("created_at", tenMinutesAgo.toISOString())
        .order("created_at", { ascending: false });

      if (data) setShiftNotifications(data);
    };

    fetchHandoverAlerts();

    const sub = supabase
      .channel("handover_alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "shift_notifications" },
        (payload) => {
          if (payload.new.target_shift === myAssignedShift) {
            setShiftNotifications((prev) => [payload.new, ...prev]);

            if (Notification.permission === "granted") {
              new Notification("🚨 Shift Handover Received", {
                body: payload.new.message,
                icon: "/vite.svg",
              });
              const audio = new Audio(notificationSound);
              audio
                .play()
                .catch((e) => console.log("Audio blocked by browser"));
            }
          }
        },
      )
      .subscribe();

    return () => supabase.removeChannel(sub);
  }, [myAssignedShift]);

  const fetchShiftDataForCycle = async (cycle) => {
    const { data } = await supabase
      .from("shift_assignments")
      .select("*")
      .eq("cycle_period", cycle);
    if (data) {
      const map = {};
      data.forEach((d) => (map[d.user_id] = d.shift_type));
      setShiftData(map);
    } else {
      setShiftData({});
    }
  };

  const nextCycleSuggestion = useMemo(() => {
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const formatD = (d) =>
      `${String(d.getDate()).padStart(2, "0")} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;

    if (cyclesList.length === 0) return "22 Feb 2026 - 21 Mar 2026";

    let maxEndDate = new Date("2026-02-21");
    cyclesList.forEach((c) => {
      const parts = c.split(" - ");
      if (parts.length === 2) {
        const ed = new Date(parts[1]);
        if (ed > maxEndDate) maxEndDate = ed;
      }
    });

    const nextStart = new Date(maxEndDate);
    nextStart.setDate(nextStart.getDate() + 1);

    const nextEnd = new Date(nextStart);
    nextEnd.setDate(nextEnd.getDate() + 27);

    return `${formatD(nextStart)} - ${formatD(nextEnd)}`;
  }, [cyclesList]);

  const handleAddCycle = async () => {
    const cycle = nextCycleSuggestion;

    if (cyclesList.includes(cycle)) {
      alert("This cycle already exists!");
      return;
    }

    const defaultInserts = teamMembers.map((m) => ({
      user_id: m.id,
      cycle_period: cycle,
      shift_type: "Off",
    }));
    await supabase.from("shift_assignments").insert(defaultInserts);

    setCyclesList([cycle, ...cyclesList]);
    setSelectedCycle(cycle);
    fetchShiftDataForCycle(cycle);
  };

  const handleShiftChange = async (userId, newShift) => {
    setShiftData((prev) => ({ ...prev, [userId]: newShift }));
    await supabase.from("shift_assignments").upsert({
      user_id: userId,
      shift_type: newShift,
      cycle_period: selectedCycle,
    });
  };

  useEffect(() => {
    if (!isAdminOrLeader) return;

    const fetchRequests = async () => {
      const { data } = await supabase
        .from("handover_requests")
        .select("*")
        .eq("status", "Pending")
        .order("created_at", { ascending: false });
      if (data) setEmergencyRequests(data);
    };

    fetchRequests();

    const sub = supabase
      .channel("handover_admin_channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "handover_requests" },
        () => {
          fetchRequests();
        },
      )
      .subscribe();

    return () => supabase.removeChannel(sub);
  }, [isAdminOrLeader]);

  const handleApproveRequest = async (id, status) => {
    await supabase.from("handover_requests").update({ status }).eq("id", id);
  };

  const fetchTeam = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });
    if (data) setTeamMembers(data);
  };

  const startEditing = (member) => {
    setEditingId(member.id);
    setTempWorkName(member.work_name || "");
    setTempRole(member.role || "User");
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (userId) => {
    setTeamMembers(
      teamMembers.map((member) =>
        member.id === userId
          ? { ...member, work_name: tempWorkName, role: tempRole }
          : member,
      ),
    );
    setEditingId(null);
    await supabase
      .from("profiles")
      .update({ work_name: tempWorkName, role: tempRole })
      .eq("id", userId);
  };

  const handleDeleteUser = async (userId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this user? This will instantly revoke their access.",
      )
    )
      return;
    setTeamMembers(teamMembers.filter((member) => member.id !== userId));
    const { error } = await supabase.rpc("delete_user_by_admin", {
      target_user_id: userId,
    });
    if (error)
      alert(
        "Error: Could not delete user from Authentication. Please check database permissions.",
      );
  };

  const togglePasswordVisibility = (id) =>
    setRevealedPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  const copyRowPassword = (password, id) => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopiedRowId(id);
    setTimeout(() => setCopiedRowId(null), 2000);
  };

  const handleGenerateClick = () => {
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pwd = "";
    for (let i = 0; i < 12; i++)
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    setGeneratedPwdDisplay(pwd);
  };

  const copyGeneratedPassword = () => {
    if (!generatedPwdDisplay) return;
    navigator.clipboard.writeText(generatedPwdDisplay);
    setCopiedPwd(true);
    setTimeout(() => setCopiedPwd(false), 2000);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateMsg({ text: "", type: "" });

    try {
      const projectUrl =
        supabase.supabaseUrl ||
        (typeof import.meta !== "undefined" &&
          import.meta.env?.VITE_SUPABASE_URL);
      const projectKey =
        supabase.supabaseKey ||
        (typeof import.meta !== "undefined" &&
          import.meta.env?.VITE_SUPABASE_ANON_KEY);

      if (!projectUrl || !projectKey)
        throw new Error("Could not initialize ghost client missing variables.");

      const ghostSupabase = createClient(projectUrl, projectKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const { data, error } = await ghostSupabase.auth.signUp({
        email: newEmail,
        password: newPassword,
      });

      if (error) {
        setCreateMsg({ text: error.message, type: "error" });
        setIsCreating(false);
        return;
      }

      if (data?.user) {
        await supabase
          .from("profiles")
          .update({
            role: newRole,
            work_name: newWorkName,
            visible_password: newPassword,
          })
          .eq("id", data.user.id);

        if (activeCycle !== "None") {
          await supabase.from("shift_assignments").insert([
            {
              user_id: data.user.id,
              shift_type: "Off",
              cycle_period: activeCycle,
            },
          ]);
        }
      }

      setCreateMsg({ text: "User created successfully!", type: "success" });
      setNewEmail("");
      setNewWorkName("");
      setNewPassword("");
      setGeneratedPwdDisplay("");
      setNewRole("User");
      fetchTeam();

      setTimeout(() => {
        setActiveTab("list");
        setCreateMsg({ text: "", type: "" });
      }, 1500);
    } catch (err) {
      setCreateMsg({
        text: err.message || "An unexpected error occurred.",
        type: "error",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // --- ARCHIVED HISTORY FETCH LOGIC (UPDATED WITH DATE RANGE) ---
  useEffect(() => {
    if (showHistoryModal) {
      fetchArchivedTickets(historyStartDate, historyEndDate);
    }
  }, [showHistoryModal, historyStartDate, historyEndDate]);

  const fetchArchivedTickets = async (startStr, endStr) => {
    setIsFetchingHistory(true);
    try {
      let query = supabase
        .from("tickets")
        .select("*")
        .eq("is_archived", true)
        .order("created_at", { ascending: false });

      if (startStr || endStr) {
        if (startStr) {
          const start = new Date(startStr);
          start.setHours(0, 0, 0, 0);
          query = query.gte("created_at", start.toISOString());
        }
        if (endStr) {
          const end = new Date(endStr);
          end.setHours(23, 59, 59, 999);
          query = query.lte("created_at", end.toISOString());
        }
      } else {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        query = query.gte("created_at", thirtyDaysAgo.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      if (data) setArchivedTickets(data);
    } catch (err) {
      console.error("Error fetching archive:", err);
    }
    setIsFetchingHistory(false);
  };

  const getDutyStyle = (role) => {
    switch (role) {
      case "IC0":
        return {
          container: "bg-purple-100 border-purple-200",
          text: "text-purple-700",
        };
      case "IC1":
        return {
          container: "bg-indigo-100 border-indigo-200",
          text: "text-indigo-700",
        };
      case "IC2":
        return {
          container: "bg-emerald-100 border-emerald-200",
          text: "text-emerald-700",
        };
      case "IC3":
        return {
          container: "bg-amber-100 border-amber-200",
          text: "text-amber-700",
        };
      case "IC5":
        return {
          container: "bg-rose-100 border-rose-200",
          text: "text-rose-700",
        };
      default:
        return {
          container: "bg-slate-100 border-slate-200",
          text: "text-slate-700",
        };
    }
  };

  const safeDutyArray = Array.isArray(selectedDuty) ? selectedDuty : [];
  const primaryDutyTheme = safeDutyArray.includes("IC0")
    ? "IC0"
    : safeDutyArray[0];
  const style = getDutyStyle(primaryDutyTheme);

  const formattedDate = currentTime.toLocaleDateString("en-US", {
    timeZone: "Asia/Singapore",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const formattedTime = currentTime.toLocaleTimeString("en-US", {
    timeZone: "Asia/Singapore",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const getGreeting = () => {
    const gmt8TimeStr = currentTime.toLocaleTimeString("en-US", {
      timeZone: "Asia/Singapore",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const [hourStr, minuteStr] = gmt8TimeStr.split(":");
    const timeInHours = parseInt(hourStr) + parseInt(minuteStr) / 60;

    if (timeInHours >= 7 && timeInHours < 14.5) return "Good Morning";
    if (timeInHours >= 14.5 && timeInHours < 22.5) return "Good Afternoon";
    return "Good Night";
  };

  // Build the Global Notifications List
  const globalNotifications = [];

  if (trackingReminder) {
    globalNotifications.push(trackingReminder);
  }

  if (isAdminOrLeader && cycleWarning) {
    globalNotifications.push({
      id: "warning",
      type: "system",
      text: cycleWarning,
    });
  }
  if (isAdminOrLeader && emergencyRequests.length > 0) {
    emergencyRequests.forEach((req) =>
      globalNotifications.push({ id: req.id, type: "emergency", data: req }),
    );
  }

  if (shiftNotifications.length > 0) {
    const activeShiftNotifications = shiftNotifications.filter((n) => {
      const notifTime = new Date(n.created_at).getTime();
      return currentTime.getTime() - notifTime < 10 * 60 * 1000;
    });

    activeShiftNotifications.forEach((n) => {
      globalNotifications.push({
        id: n.id,
        type: "handover",
        text: n.message,
        time: n.created_at,
      });
    });
  }

  const hasNotifications = globalNotifications.length > 0;

  return (
    <>
      <header className="bg-white rounded-2xl shadow-sm border border-slate-100 mx-6 mt-6 px-6 h-16 flex items-center justify-between shrink-0 z-40 relative">
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-300 ${style.container} ${style.text}`}
          >
            <Shield size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">
              RiskOps Portal
            </h1>
            <p className="text-[10px] font-medium text-slate-500">
              Internal Control System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleCheckForUpdates}
            disabled={isCheckingUpdate}
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${isCheckingUpdate ? "bg-sky-100 text-sky-600 cursor-not-allowed" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            title={isCheckingUpdate ? "Checking for updates..." : "Check for Updates"}
          >
            <RefreshCw
              size={16}
              strokeWidth={2.5}
              className={isCheckingUpdate ? "animate-spin" : ""}
            />
          </button>

          {/* --- CHANGE DUTY BUTTON (Only for Normal Users) --- */}
          {!isAdminOrLeader && (
            <button
              onClick={() => setDuty([])}
              className="flex items-center justify-center w-8 h-8 rounded-full transition-colors ml-2 bg-slate-100 text-slate-600 hover:bg-slate-200"
              title="Change Duty"
            >
              <RefreshCw size={16} strokeWidth={2.5} />
            </button>
          )}

          {/* --- GLOBAL NOTIFICATION BELL --- */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${!isAdminOrLeader ? "" : "ml-2"} ${hasNotifications ? "bg-rose-50 text-rose-600 hover:bg-rose-100" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              title="Notifications"
            >
              <Bell size={16} strokeWidth={2.5} />
              {hasNotifications && (
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full animate-pulse"></span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Notifications
                  </span>
                  {hasNotifications && (
                    <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 rounded-full">
                      {globalNotifications.length} New
                    </span>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto p-2">
                  {!hasNotifications ? (
                    <p className="text-xs text-slate-400 text-center py-6 italic">
                      No new notifications.
                    </p>
                  ) : (
                    globalNotifications.map((notif) => {
                      if (notif.type === "action-reminder") {
                        return (
                          <div
                            key={notif.id}
                            className="p-3 mb-2 bg-amber-50 border border-amber-200 shadow-sm rounded-lg relative overflow-hidden"
                          >
                            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                            <div className="flex items-start gap-2">
                              <AlertTriangle
                                size={16}
                                className="text-amber-600 shrink-0 mt-0.5"
                              />
                              <div>
                                <h4 className="text-xs font-bold text-amber-800 mb-0.5">
                                  Action Required
                                </h4>
                                <p className="text-xs text-amber-700 font-medium leading-relaxed">
                                  {notif.text}
                                </p>
                                <span className="text-[9px] text-amber-500 mt-1 block">
                                  {new Date(notif.time).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      if (notif.type === "system") {
                        return (
                          <div
                            key={notif.id}
                            className="p-3 mb-2 bg-amber-50 border border-amber-200 shadow-sm rounded-lg relative overflow-hidden"
                          >
                            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                            <div className="flex items-start gap-2">
                              <AlertTriangle
                                size={16}
                                className="text-amber-600 shrink-0 mt-0.5"
                              />
                              <div>
                                <h4 className="text-xs font-bold text-amber-800 mb-0.5">
                                  Shift Cycle Expiring
                                </h4>
                                <p className="text-xs text-amber-700 font-medium leading-relaxed">
                                  {notif.text}
                                </p>
                                <button
                                  onClick={() => {
                                    setShowNotifications(false);
                                    setShowShiftModal(true);
                                  }}
                                  className="mt-2 text-[10px] font-bold text-amber-600 hover:text-amber-800 underline"
                                >
                                  Open Shift Planner
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      if (notif.type === "handover") {
                        return (
                          <div
                            key={notif.id}
                            className="p-3 mb-2 bg-indigo-50 border border-indigo-200 shadow-sm rounded-lg relative overflow-hidden"
                          >
                            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                            <div className="flex items-start gap-2">
                              <Shield
                                size={16}
                                className="text-indigo-600 shrink-0 mt-0.5"
                              />
                              <div>
                                <h4 className="text-xs font-bold text-indigo-800 mb-0.5">
                                  Incoming Handover
                                </h4>
                                <p className="text-xs text-indigo-700 font-medium leading-relaxed">
                                  {notif.text}
                                </p>
                                <span className="text-[9px] text-indigo-400 mt-1 block">
                                  {new Date(notif.time).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      if (notif.type === "emergency") {
                        return (
                          <div
                            key={notif.id}
                            className="p-3 mb-2 bg-white border border-slate-100 shadow-sm rounded-lg hover:border-slate-300 transition-all relative overflow-hidden"
                          >
                            <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                            <p className="text-xs text-slate-700 font-medium leading-relaxed ml-1.5">
                              <span className="font-bold text-slate-900">
                                {notif.data.requester_name}
                              </span>{" "}
                              requested an emergency handover for duties:{" "}
                              <span className="font-bold text-indigo-600">
                                {notif.data.duties?.join(", ")}
                              </span>
                              .
                            </p>
                            <div className="flex items-center gap-2 mt-3 ml-1.5">
                              <button
                                onClick={() =>
                                  handleApproveRequest(
                                    notif.data.id,
                                    "Approved",
                                  )
                                }
                                className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() =>
                                  handleApproveRequest(
                                    notif.data.id,
                                    "Rejected",
                                  )
                                }
                                className="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded transition-colors"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* --- ADMIN TOOLBAR BUTTONS --- */}
          {isAdminOrLeader && (
            <div className="relative flex items-center">
              <button
                onClick={() => setShowHistoryModal(true)}
                className="flex items-center justify-center w-8 h-8 bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-700 rounded-full transition-colors ml-1"
                title="Archived Investigations"
              >
                <ArchiveRestore size={16} strokeWidth={2.5} />
              </button>

              <button
                onClick={() => setShowShiftModal(true)}
                className="flex items-center justify-center w-8 h-8 bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-700 rounded-full transition-colors ml-1 relative"
                title="Shift Planner"
              >
                <CalendarDays size={16} strokeWidth={2.5} />
                {cycleWarning && (
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full animate-pulse pointer-events-none"></span>
                )}
              </button>

              <button
                onClick={() => setShowAdminModal(true)}
                className="flex items-center justify-center w-8 h-8 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-full transition-colors ml-1"
                title="User Management"
              >
                <Users size={16} strokeWidth={2.5} />
              </button>
            </div>
          )}

          {/* --- RESTORED ORIGINAL GREETING --- */}
          <div className="text-xs font-medium text-slate-500 hidden md:block border-l border-slate-200 pl-4 ml-1">
            {getGreeting()},{" "}
            <span className="text-slate-900 font-bold">
              {workName || user?.email?.split("@")[0]}
            </span>
          </div>

          <div className="relative group z-50">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white text-slate-600 rounded-full text-xs font-bold border border-slate-200 cursor-default shadow-sm transition-all group-hover:bg-slate-50">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              {onlineUsers?.length || 0} Online
            </div>

            <div className="absolute top-full right-0 mt-2 w-max min-w-[160px] bg-white border border-slate-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 overflow-hidden flex flex-col">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                Active Duty Staff
              </div>
              <div className="max-h-48 overflow-y-auto p-1">
                {!onlineUsers || onlineUsers.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-slate-400 text-center italic">
                    Connecting...
                  </div>
                ) : (
                  onlineUsers.map((activeUser, idx) => {
                    const isMaster = activeUser.duties?.includes("IC0");
                    return (
                      <div
                        key={idx}
                        className="flex items-baseline px-2 py-1.5 hover:bg-slate-50 rounded-md transition-colors"
                      >
                        <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
                          {activeUser.workName}
                        </span>
                        <span className="text-slate-300 font-medium mx-1.5">
                          -
                        </span>
                        <div className="flex gap-1 flex-wrap items-center">
                          {isMaster ? (
                            <span className="text-[9px] font-bold text-purple-600 uppercase tracking-wider">
                              {activeUser.role || "ADMIN"}
                            </span>
                          ) : activeUser.duties &&
                            activeUser.duties.length > 0 ? (
                            activeUser.duties.map((d, index) => (
                              <span key={d} className="text-[11px] font-bold">
                                <span className={getDutyTextColorOnly(d)}>
                                  {d}
                                </span>
                                {index < activeUser.duties.length - 1 && (
                                  <span className="text-slate-300">, </span>
                                )}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] font-medium text-slate-400 italic">
                              None
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-slate-50 rounded-full cursor-default">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Calendar size={14} />
              <span className="text-xs font-semibold">{formattedDate}</span>
            </div>
            <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock size={14} />
              <span className="tabular-nums font-mono text-xs font-semibold tracking-wide">
                {formattedTime}
              </span>
              <span className="text-[9px] font-bold text-slate-400 ml-1">
                GMT+8
              </span>
            </div>
          </div>

          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center justify-center w-8 h-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1"
            title="Log Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* --- REAL-TIME TRANSFER RECEIVER MODAL (GARUKA SEES THIS) --- */}
      {pendingTransferRequest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-[400px] overflow-hidden animate-in zoom-in-95">
            <div className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 mb-4">
                <Users size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Duty Transfer Request
              </h3>
              <p className="text-sm text-slate-600 mb-8 leading-relaxed">
                <strong>{pendingTransferRequest.fromName}</strong> is requesting
                to transfer{" "}
                <span className="font-bold text-indigo-600 uppercase bg-indigo-50 px-1.5 py-0.5 rounded">
                  {pendingTransferRequest.duties.join(", ")}
                </span>{" "}
                to you. Do you accept?
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() =>
                    respondToTransferRequest(
                      pendingTransferRequest.fromId,
                      "declined",
                      pendingTransferRequest.duties,
                    )
                  }
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={() =>
                    respondToTransferRequest(
                      pendingTransferRequest.fromId,
                      "accepted",
                      pendingTransferRequest.duties,
                    )
                  }
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors shadow-md"
                >
                  Accept Duty
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- DEDICATED SHIFT PLANNER MODAL --- */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200 p-4">
          <div className="bg-white w-[1000px] h-[75vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wide">
                <CalendarDays size={16} className="text-indigo-600" /> Shift
                Cycle Planner
              </h2>
              <button
                onClick={() => setShowShiftModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Banner Warning Inside Modal */}
            {cycleWarning && (
              <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-3">
                <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                <p className="text-xs font-bold text-amber-800">
                  {cycleWarning}
                </p>
              </div>
            )}

            <div className="flex-1 flex overflow-hidden">
              <div className="w-80 bg-slate-50 border-r border-slate-100 flex flex-col p-5 overflow-y-auto">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Create New Cycle
                </h3>

                {/* AUTOMATED 28-DAY CYCLE GENERATOR */}
                <div className="mb-6 bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-center">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Next Scheduled Cycle
                  </p>
                  <div className="text-xs font-bold text-indigo-700 bg-indigo-50 py-2.5 rounded-lg mb-3 border border-indigo-100">
                    {nextCycleSuggestion}
                  </div>
                  <button
                    onClick={handleAddCycle}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                  >
                    + Generate Next Cycle
                  </button>
                </div>

                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Saved Cycles
                </h3>
                <div className="space-y-2 flex-1">
                  {cyclesList.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-4">
                      No cycles created yet.
                    </p>
                  ) : (
                    cyclesList.map((cycle) => (
                      <button
                        key={cycle}
                        onClick={() => setSelectedCycle(cycle)}
                        className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between group
                          ${selectedCycle === cycle ? "bg-indigo-600 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300"}`}
                      >
                        <span className="truncate pr-2">{cycle}</span>
                        {activeCycle === cycle && (
                          <div
                            className={`w-2 h-2 rounded-full shadow-sm ${selectedCycle === cycle ? "bg-white" : "bg-emerald-500"}`}
                            title="Active Cycle"
                          ></div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="flex-1 bg-white flex flex-col">
                {!selectedCycle ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <CalendarDays size={48} className="mb-4 opacity-20" />
                    <p className="text-sm font-medium">
                      Select a cycle from the left to assign shifts.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Editing Roster For
                        </p>
                        <h3 className="text-lg font-black text-slate-800">
                          {selectedCycle}
                        </h3>
                      </div>

                      {activeCycle === selectedCycle && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg shadow-sm">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                          </span>
                          <span className="text-xs font-bold uppercase tracking-wide">
                            Live Auto-Detected
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
                      <div className="border border-slate-200 bg-white rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                            <tr>
                              <th className="px-5 py-3">Work Name</th>
                              <th className="px-5 py-3">Role</th>
                              <th className="px-5 py-3">Assigned Shift</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {teamMembers
                              .filter((m) => m.role === "User")
                              .map((member) => {
                                const currentShift =
                                  shiftData[member.id] || "Off";
                                let selectColor =
                                  "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300";
                                if (currentShift === "Morning")
                                  selectColor =
                                    "bg-amber-50 text-amber-700 border-amber-300 font-bold";
                                if (currentShift === "Afternoon")
                                  selectColor =
                                    "bg-indigo-50 text-indigo-700 border-indigo-300 font-bold";
                                if (currentShift === "Night")
                                  selectColor =
                                    "bg-slate-900 text-white border-slate-900 font-bold";

                                return (
                                  <tr
                                    key={member.id}
                                    className="hover:bg-slate-50 transition-colors"
                                  >
                                    <td className="px-5 py-3 font-bold text-slate-800">
                                      {member.work_name || member.email}
                                    </td>
                                    <td className="px-5 py-3">
                                      <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600`}
                                      >
                                        Normal
                                      </span>
                                    </td>
                                    <td className="px-5 py-3">
                                      <select
                                        value={currentShift}
                                        onChange={(e) =>
                                          handleShiftChange(
                                            member.id,
                                            e.target.value,
                                          )
                                        }
                                        className={`text-xs px-3 py-2 rounded-lg border outline-none cursor-pointer transition-colors shadow-sm ${selectColor}`}
                                      >
                                        <option value="Morning">
                                          Morning (07:00 - 14:30)
                                        </option>
                                        <option value="Afternoon">
                                          Afternoon (14:30 - 22:30)
                                        </option>
                                        <option value="Night">
                                          Night (22:30 - 07:00)
                                        </option>
                                        <option value="Off">
                                          Off / Unassigned
                                        </option>
                                      </select>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- OLD ADMIN MODAL (UNCHANGED) --- */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200 p-4">
          <div className="bg-white w-[900px] max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-6">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wide">
                  <Users size={16} className="text-indigo-600" />
                  User Management
                </h2>

                <div className="flex p-1 bg-slate-100 rounded-lg">
                  <button
                    onClick={() => setActiveTab("list")}
                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    Users List
                  </button>
                  <button
                    onClick={() => setActiveTab("create")}
                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === "create" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    Create New
                  </button>
                </div>
              </div>

              <button
                onClick={() => setShowAdminModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
              {activeTab === "list" && (
                <div className="border border-slate-200 bg-white rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-4">Reg. Date</th>
                        <th className="px-5 py-4">Work Name</th>
                        <th className="px-5 py-4">Email</th>
                        <th className="px-5 py-4">Password</th>
                        <th className="px-5 py-4 text-center">Role</th>
                        <th className="px-5 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {teamMembers.map((member) => (
                        <tr
                          key={member.id}
                          className="hover:bg-slate-50 transition-colors group"
                        >
                          <td className="px-5 py-4 text-slate-500 text-[11px] font-medium">
                            {new Date(member.created_at).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </td>

                          <td className="px-5 py-4">
                            {editingId === member.id ? (
                              <input
                                type="text"
                                value={tempWorkName}
                                onChange={(e) =>
                                  setTempWorkName(e.target.value)
                                }
                                className="w-28 px-2 py-1 text-xs font-bold text-slate-800 bg-white border-2 border-indigo-400 rounded outline-none shadow-sm"
                                autoFocus
                                onKeyDown={(e) =>
                                  e.key === "Enter" && saveEdit(member.id)
                                }
                              />
                            ) : (
                              <span className="font-bold text-slate-800 text-xs">
                                {member.work_name || "-"}
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4 text-slate-600 text-xs">
                            {member.email}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2 text-slate-400">
                              {member.visible_password ? (
                                <>
                                  <span className="font-mono text-xs tracking-widest text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md min-w-[90px] text-center">
                                    {revealedPasswords[member.id]
                                      ? member.visible_password
                                      : "••••••••"}
                                  </span>
                                  <button
                                    onClick={() =>
                                      togglePasswordVisibility(member.id)
                                    }
                                    className="p-1 hover:text-slate-700 transition-colors"
                                    title={
                                      revealedPasswords[member.id]
                                        ? "Hide Password"
                                        : "Show Password"
                                    }
                                  >
                                    {revealedPasswords[member.id] ? (
                                      <EyeOff size={14} />
                                    ) : (
                                      <Eye size={14} />
                                    )}
                                  </button>
                                  <button
                                    onClick={() =>
                                      copyRowPassword(
                                        member.visible_password,
                                        member.id,
                                      )
                                    }
                                    className="text-white bg-slate-900 p-1.5 rounded-md hover:bg-slate-800 transition-colors"
                                    title="Copy Password"
                                  >
                                    {copiedRowId === member.id ? (
                                      <Check
                                        size={12}
                                        className="text-emerald-400"
                                      />
                                    ) : (
                                      <Copy size={12} />
                                    )}
                                  </button>
                                </>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic font-medium px-2 py-1 bg-slate-50 rounded">
                                  Hidden
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-4 text-center">
                            {editingId === member.id ? (
                              <select
                                value={tempRole}
                                onChange={(e) => setTempRole(e.target.value)}
                                disabled={member.id === user?.id}
                                className="text-[10px] font-bold px-2 py-1 rounded border-2 border-indigo-400 outline-none cursor-pointer text-center bg-white"
                              >
                                <option value="Admin">Admin</option>
                                <option value="Leader">Leader</option>
                                <option value="User">Normal</option>
                              </select>
                            ) : (
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
                                ${
                                  member.role === "Admin"
                                    ? "bg-slate-900 text-white"
                                    : member.role === "Leader"
                                      ? "bg-indigo-100 text-indigo-700"
                                      : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {member.role === "User"
                                  ? "Normal"
                                  : member.role}
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {editingId === member.id ? (
                                <>
                                  <button
                                    onClick={() => saveEdit(member.id)}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                    title="Save Changes"
                                  >
                                    <Check size={16} />
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
                                    title="Cancel"
                                  >
                                    <X size={16} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => startEditing(member)}
                                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                    title="Edit User"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(member.id)}
                                    disabled={member.id === user?.id}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                    title={
                                      member.id === user?.id
                                        ? "Cannot delete yourself"
                                        : "Delete User"
                                    }
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "create" && (
                <div className="max-w-[500px] mx-auto bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
                  <form onSubmit={handleCreateUser} className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="newuser@example.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-all text-slate-700 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                        Work Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Chamiru"
                        value={newWorkName}
                        onChange={(e) => setNewWorkName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-all text-slate-700 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                        Role
                      </label>
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 cursor-pointer transition-all text-slate-700 font-medium appearance-none"
                      >
                        <option value="User">Normal</option>
                        <option value="Leader">Leader</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </div>

                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                          Password <span className="text-red-500">*</span>
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium">
                          Paste generated password below
                        </span>
                      </div>

                      <input
                        type="text"
                        required
                        minLength={6}
                        placeholder="Paste password here..."
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-all font-mono text-slate-700"
                      />

                      <div className="flex gap-3">
                        <div className="flex-1 px-4 py-2.5 bg-white border border-dashed border-slate-300 rounded-lg text-sm font-mono text-slate-500 flex items-center">
                          {generatedPwdDisplay || "Click Generate ->"}
                        </div>
                        <button
                          type="button"
                          onClick={handleGenerateClick}
                          className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg transition-all flex items-center gap-2"
                        >
                          <RefreshCw size={14} /> Generate
                        </button>
                        {generatedPwdDisplay && (
                          <button
                            type="button"
                            onClick={copyGeneratedPassword}
                            className="px-4 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-black transition-all flex items-center gap-2"
                          >
                            {copiedPwd ? (
                              <Check size={14} />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isCreating}
                      className="w-full py-3.5 bg-slate-400 hover:bg-slate-500 text-white text-sm font-bold rounded-lg transition-all shadow-sm disabled:opacity-50 mt-4"
                    >
                      {isCreating ? "Creating Account..." : "Create Account"}
                    </button>

                    {createMsg.text && (
                      <div
                        className={`mt-4 text-xs font-bold px-4 py-3 rounded-lg flex items-center justify-center text-center ${createMsg.type === "error" ? "bg-red-50 text-red-600 border border-red-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"}`}
                      >
                        {createMsg.text}
                      </div>
                    )}
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- NEW: ADMIN ARCHIVE HISTORY MODAL (WITH DATE RANGE) --- */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200 p-4">
          <div className="bg-white w-[95vw] max-w-[1400px] h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wide">
                <ArchiveRestore size={18} className="text-indigo-600" />
                Archived Investigations{" "}
                {historyStartDate || historyEndDate ? "" : "(Past 30 Days)"}
              </h2>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Date:
                  </span>
                  <input
                    type="date"
                    value={historyStartDate}
                    onChange={(e) => setHistoryStartDate(e.target.value)}
                    className="text-xs font-bold border-none bg-transparent outline-none text-slate-700 cursor-pointer"
                  />
                  <span className="text-slate-400 font-bold text-xs">-</span>
                  <input
                    type="date"
                    value={historyEndDate}
                    onChange={(e) => setHistoryEndDate(e.target.value)}
                    className="text-xs font-bold border-none bg-transparent outline-none text-slate-700 cursor-pointer"
                  />
                  {(historyStartDate || historyEndDate) && (
                    <button
                      onClick={() => {
                        setHistoryStartDate("");
                        setHistoryEndDate("");
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-bold transition-colors ml-2"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-slate-50/50 p-6">
              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead className="bg-slate-50 sticky top-0 z-10 font-bold text-slate-500 uppercase tracking-wide text-[10px]">
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-3">Date Completed</th>
                      <th className="px-4 py-3">Duty</th>
                      <th className="px-4 py-3">Merchant ID</th>
                      <th className="px-4 py-3">Login ID</th>
                      <th className="px-4 py-3">Player ID</th>
                      <th className="px-4 py-3">Provider Account</th>
                      <th className="px-4 py-3">Provider</th>
                      <th className="px-4 py-3">Tracking No.</th>
                      <th className="px-4 py-3">Recorder</th>
                      <th className="px-4 py-3 text-center">Audit Notes</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {isFetchingHistory ? (
                      <tr>
                        <td colSpan="11" className="px-6 py-12 text-center text-slate-400 font-medium">
                          <div className="flex items-center justify-center gap-2">
                            <RefreshCw size={16} className="animate-spin text-indigo-500" /> Fetching secure records...
                          </div>
                        </td>
                      </tr>
                    ) : archivedTickets.length === 0 ? (
                      <tr>
                        <td colSpan="11" className="px-6 py-12 text-center text-slate-400 font-medium italic">
                          No archived tickets found for this time period.
                        </td>
                      </tr>
                    ) : (
                      archivedTickets.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-slate-500 font-medium">
                            {new Date(t.created_at).toLocaleDateString("en-GB", { month: "short", day: "2-digit" })} <span className="text-slate-400 ml-1">{new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-700">{t.ic_account}</td>
                          <td className="px-4 py-3 font-mono font-semibold text-slate-700">{t.merchant_name}</td>
                          <td className="px-4 py-3 text-slate-600">{t.login_id || "-"}</td>
                          <td className="px-4 py-3 font-mono text-indigo-700 font-bold">{t.member_id}</td>
                          <td className="px-4 py-3 font-mono text-slate-600">{t.provider_account || "-"}</td>
                          <td className="px-4 py-3 text-slate-600 font-medium">{t.provider}</td>
                          <td className="px-4 py-3 font-mono text-slate-600">{t.tracking_no || "-"}</td>
                          <td className="px-4 py-3 text-slate-500 font-medium">{t.recorder}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${t.notes && t.notes.length > 0 ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-slate-50 text-slate-400 border-slate-200"}`}>
                              {t.notes && t.notes.length > 0 ? `${t.notes.length} Messages` : "No Notes"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                              t.status === "Normal" || t.status === "NORMAL" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}>
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
