import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  MessageCircle,
  ArrowLeftRight,
  CircleHelp,
  BookOpen,
  Bug,
  Sparkles,
  History,
  Send,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArchiveRestore,
  Search,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { useDuty } from "../context/DutyContext";
import notificationSound from "../assets/Notification.mp3";
import {
  LOGIC_CODES,
  LOGIC_SEVERITIES,
  buildEscalationEntry,
  makeLogicEntry,
  normalizeLogicEventDetail,
  runQuickChecks,
  shouldEscalateLogicEntry,
} from "../lib/logicHealth";

const LOGIC_HEALTH_HISTORY_HOURS = 24;

export default function Header() {
  const {
    selectedDuty,
    user,
    userRole,
    workName,
    onlineUsers,
    recentlyOfflineUsers,
    presenceDebug,
    pendingTransferRequest,
    respondToTransferRequest,
    setDuty,
  } = useDuty();
  const [currentTime, setCurrentTime] = useState(new Date());

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
  const { myAssignedShift, currentActiveShift } = useDuty();

  // --- Emergency Handover States ---
  const [emergencyRequests, setEmergencyRequests] = useState([]);
  const [operationalAlerts, setOperationalAlerts] = useState([]);
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
  const [showDutySwitchConfirm, setShowDutySwitchConfirm] = useState(false);
  const [updaterNotification, setUpdaterNotification] = useState(null);
  const [showUpdaterToast, setShowUpdaterToast] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [connectionNotification, setConnectionNotification] = useState(null);
  const [showConnectionToast, setShowConnectionToast] = useState(false);
  const [opsNotification, setOpsNotification] = useState(null);
  const [showOpsToast, setShowOpsToast] = useState(false);
  const shiftStartPingKeyRef = useRef("");
  const notificationDedupRef = useRef(new Map());

  // --- ARCHIVE HISTORY STATES ---
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [archivedTickets, setArchivedTickets] = useState([]);
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [selectedHistoryTicketForNotes, setSelectedHistoryTicketForNotes] =
    useState(null);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyFilterDuty, setHistoryFilterDuty] = useState("All");
  const [historyFilterStatus, setHistoryFilterStatus] = useState("All");

  // --- INFO CENTER STATES ---
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoView, setInfoView] = useState("menu");
  const [feedbackText, setFeedbackText] = useState("");
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState({ text: "", type: "" });
  const [logicHealthEntries, setLogicHealthEntries] = useState([]);
  const [logicHealthLevelFilter, setLogicHealthLevelFilter] = useState("all");
  const [logicHealthSearch, setLogicHealthSearch] = useState("");

  const isAdminOrLeader = userRole === "Admin" || userRole === "Leader";

  const formatPresenceAgo = useCallback((timestamp) => {
    if (!timestamp) return "-";
    const diffMs = Math.max(0, Date.now() - timestamp);
    const secs = Math.floor(diffMs / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    return `${mins}m ${secs % 60}s ago`;
  }, []);

  const playAlertSound = useCallback(() => {
    const audio = new Audio(notificationSound);
    audio.play().catch(() => console.log("Audio blocked by browser"));
  }, []);

  const logicHealthEntriesRef = useRef([]);

  const persistLogicHealthEntry = useCallback(
    async (entry) => {
      try {
        await supabase.from("logic_health_events").insert({
          user_id: user?.id || null,
          code: entry.code,
          title: entry.title,
          detail: entry.detail,
          level: entry.level,
          source: entry.source || "ui",
          correlation_id: entry.correlationId || null,
          created_at: new Date(entry.at || Date.now()).toISOString(),
        });
      } catch {
        // Avoid blocking UI if the diagnostics table is unavailable.
      }
    },
    [user?.id],
  );

  const pushLogicHealthEntry = useCallback((entry) => {
    let next = [entry, ...logicHealthEntriesRef.current];
    const toPersist = [entry];

    if (
      shouldEscalateLogicEntry({
        nextEntry: entry,
        entries: next,
      })
    ) {
      const escalation = buildEscalationEntry({
        code: entry.code,
        level: entry.level,
        at: entry.at,
        correlationId: entry.correlationId,
      });
      next = [escalation, ...next];
      toPersist.push(escalation);
    }

    const limited = next.slice(0, 80);
    logicHealthEntriesRef.current = limited;
    setLogicHealthEntries(limited);
    toPersist.forEach((item) => {
      void persistLogicHealthEntry(item);
    });
  }, [persistLogicHealthEntry]);

  const runLogicQuickChecks = useCallback(() => {
    const result = runQuickChecks({
      currentActiveShift,
      presenceDebug,
      now: Date.now(),
    });

    result.checks.forEach((check) => {
      pushLogicHealthEntry(
        makeLogicEntry({
          code: check.code,
          title: check.pass ? "Quick Check Passed" : "Quick Check Failed",
          detail: check.message,
          level: check.pass ? "success" : "error",
          source: "quick-check",
        }),
      );
    });
  }, [currentActiveShift, presenceDebug, pushLogicHealthEntry]);

  const clearLogicHealthEntries = useCallback(() => {
    logicHealthEntriesRef.current = [];
    setLogicHealthEntries([]);
  }, []);

  const filteredLogicHealthEntries = useMemo(() => {
    const q = logicHealthSearch.trim().toLowerCase();
    return logicHealthEntries.filter((entry) => {
      const matchesLevel =
        logicHealthLevelFilter === "all" || entry.level === logicHealthLevelFilter;
      if (!matchesLevel) return false;
      if (!q) return true;
      return [
        entry.code,
        entry.title,
        entry.detail,
        entry.correlationId,
        entry.source,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [logicHealthEntries, logicHealthLevelFilter, logicHealthSearch]);

  useEffect(() => {
    logicHealthEntriesRef.current = logicHealthEntries;
  }, [logicHealthEntries]);

  useEffect(() => {
    let active = true;
    const loadLogicHealthEntries = async () => {
      const sinceIso = new Date(
        Date.now() - LOGIC_HEALTH_HISTORY_HOURS * 60 * 60 * 1000,
      ).toISOString();
      const { data } = await supabase
        .from("logic_health_events")
        .select("code,title,detail,level,source,correlation_id,created_at")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(80);

      if (!active || !Array.isArray(data)) return;
      const normalized = data.map((row) =>
        makeLogicEntry({
          code: row.code,
          title: row.title,
          detail: row.detail,
          level: row.level,
          source: row.source || "db",
          correlationId: row.correlation_id,
          at: Date.parse(row.created_at),
        }),
      );
      logicHealthEntriesRef.current = normalized;
      setLogicHealthEntries(normalized);
    };

    void loadLogicHealthEntries();
    return () => {
      active = false;
    };
  }, []);

  const shouldEmitNotification = useCallback((key, text, cooldownMs = 15000) => {
    const now = Date.now();
    const token = `${key}|${text || ""}`;
    const lastSeen = notificationDedupRef.current.get(token) || 0;
    if (now - lastSeen < cooldownMs) return false;
    notificationDedupRef.current.set(token, now);

    // Keep map small over long sessions.
    if (notificationDedupRef.current.size > 80) {
      for (const [k, ts] of notificationDedupRef.current.entries()) {
        if (now - ts > 2 * 60 * 1000) {
          notificationDedupRef.current.delete(k);
        }
      }
    }
    return true;
  }, []);

  const shouldShowSystemNotification = useCallback(
    () => document.visibilityState !== "visible" || !document.hasFocus(),
    [],
  );

  const maybeShowSystemNotification = useCallback(
    (title, body) => {
      if (!shouldShowSystemNotification()) return;
      if (Notification.permission === "granted") {
        new Notification(title, {
          body,
          icon: "/vite.svg",
        });
      }
    },
    [shouldShowSystemNotification],
  );

  const getDutyTextColorOnly = (dutyName) => {
    switch (dutyName) {
      case "IC0":
        return "text-purple-600";
      case "IC1":
        return "text-[#6366F1]";
      case "IC2":
        return "text-[#10B981]";
      case "IC3":
        return "text-[#F59E0B]";
      case "IC5":
        return "text-[#F43F5E]";
      default:
        return "text-slate-600";
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [maybeShowSystemNotification, playAlertSound]);

  useEffect(() => {
    if (
      !window.electronAPI ||
      typeof window.electronAPI.onUpdaterStatus !== "function"
    ) {
      return undefined;
    }

    const unsubscribe = window.electronAPI.onUpdaterStatus((payload) => {
      if (payload?.type !== "downloaded") {
        return;
      }

      const notification = {
        id: `update-ready-${Date.now()}`,
        type: "update-ready",
        text:
          payload.message ||
          "A new RiskOps update is ready. Restart the app to apply it.",
        time: new Date().toISOString(),
      };

      setUpdaterNotification(notification);
      setShowUpdaterToast(true);
      playAlertSound();
      maybeShowSystemNotification("Update Ready", notification.text);
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [maybeShowSystemNotification, playAlertSound]);

  useEffect(() => {
    if (!showUpdaterToast) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setShowUpdaterToast(false);
    }, 8000);

    return () => clearTimeout(timer);
  }, [showUpdaterToast]);

  useEffect(() => {
    if (!showConnectionToast) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setShowConnectionToast(false);
    }, 8000);

    return () => clearTimeout(timer);
  }, [showConnectionToast]);

  useEffect(() => {
    if (!showOpsToast) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setShowOpsToast(false);
    }, 8000);

    return () => clearTimeout(timer);
  }, [showOpsToast]);

  useEffect(() => {
    const getGMT8Now = () => {
      const d = new Date();
      const utc = d.getTime() + d.getTimezoneOffset() * 60000;
      return new Date(utc + 3600000 * 8);
    };

    const checkShiftStartPing = () => {
      if (!myAssignedShift || myAssignedShift === "Off" || !currentActiveShift)
        return;

      const now = getGMT8Now();
      const h = now.getHours();
      const m = now.getMinutes();

      const slots = [
        { h: 7, m: 0, shift: "Morning" },
        { h: 14, m: 30, shift: "Afternoon" },
        { h: 22, m: 30, shift: "Night" },
      ];

      const slot = slots.find((s) => s.h === h && s.m === m);
      if (!slot) return;
      if (myAssignedShift !== slot.shift || currentActiveShift !== slot.shift)
        return;

      const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const marker = `${dayKey}|${slot.shift}`;
      if (shiftStartPingKeyRef.current === marker) return;
      shiftStartPingKeyRef.current = marker;

      const notification = {
        id: `shift-start-${Date.now()}`,
        type: "shift-start",
        text: "Your shift has started. Please take over pending investigations.",
        time: Date.now(),
      };

      setOpsNotification(notification);
      setShowOpsToast(true);

      playAlertSound();
      maybeShowSystemNotification("Shift Started", notification.text);
    };

    checkShiftStartPing();
    const timer = setInterval(checkShiftStartPing, 15000);
    return () => clearInterval(timer);
  }, [
    myAssignedShift,
    currentActiveShift,
    maybeShowSystemNotification,
    playAlertSound,
  ]);

  useEffect(() => {
    if (showAdminModal || showShiftModal) {
      fetchTeam();
    }
  }, [showAdminModal, showShiftModal]);

  useEffect(() => {
    fetchCyclesList();
  }, [maybeShowSystemNotification, playAlertSound]);

  useEffect(() => {
    if (selectedCycle && showShiftModal) {
      fetchShiftDataForCycle(selectedCycle);
    }
  }, [selectedCycle, showShiftModal]);

  // --- TRACKING ID EVENT LISTENER ---
  useEffect(() => {
    const handleReminder = (e) => {
      const text =
        e.detail.text ||
        `You have ${e.detail.missingCount} pending ticket(s) missing a Tracking ID. Handover opens in 5 minutes!`;

      setTrackingReminder({
        id: "tracking-reminder-" + e.detail.time,
        type: "action-reminder",
        text,
        time: e.detail.time,
      });

      // TicketTable handles local sound; this handles background OS popups.
      maybeShowSystemNotification("Handover Reminder", text);
    };
    const clearReminder = () => setTrackingReminder(null);
    const handleRealtimeError = (e) => {
      const eventDetail = normalizeLogicEventDetail(e.detail, {
        code: LOGIC_CODES.REALTIME_ERROR,
        title: "Realtime Error",
        detail: "Live ticket sync connection issue detected. Trying to reconnect...",
        level: "error",
        source: "realtime",
      });
      const eventTime = eventDetail.at;
      const notification = {
        id: `tickets-connection-error-${eventTime}`,
        type: "connection-error",
        text: eventDetail.detail,
        time: eventTime,
      };

      if (!shouldEmitNotification("connection-error", notification.text, 20000)) {
        return;
      }

      setConnectionNotification(notification);
      setShowConnectionToast(true);
      pushLogicHealthEntry(
        makeLogicEntry({
          code: eventDetail.code,
          title: eventDetail.title,
          detail: notification.text,
          level: eventDetail.level,
          at: eventTime,
          source: eventDetail.source,
          correlationId: eventDetail.correlationId,
        }),
      );

      playAlertSound();
      maybeShowSystemNotification("Live Sync Issue", notification.text);
    };
    const handleRealtimeRestored = (e) => {
      const eventDetail = normalizeLogicEventDetail(e.detail, {
        code: LOGIC_CODES.REALTIME_RESTORED,
        title: "Realtime Restored",
        detail: "Live ticket sync reconnected. Realtime updates restored.",
        level: "success",
        source: "realtime",
      });
      const eventTime = eventDetail.at;
      const notification = {
        id: `tickets-connection-restored-${eventTime}`,
        type: "connection-restored",
        text: eventDetail.detail,
        time: eventTime,
      };

      if (!shouldEmitNotification("connection-restored", notification.text, 12000)) {
        return;
      }

      setConnectionNotification(notification);
      setShowConnectionToast(true);
      pushLogicHealthEntry(
        makeLogicEntry({
          code: eventDetail.code,
          title: eventDetail.title,
          detail: notification.text,
          level: eventDetail.level,
          at: eventTime,
          source: eventDetail.source,
          correlationId: eventDetail.correlationId,
        }),
      );
      playAlertSound();
      maybeShowSystemNotification("Live Sync Restored", notification.text);
    };
    const handleRealtimeDegraded = (e) => {
      const eventDetail = normalizeLogicEventDetail(e.detail, {
        code: LOGIC_CODES.REALTIME_DEGRADED,
        title: "Realtime Degraded",
        detail: "Realtime sync is degraded. Using fallback refresh every 15 seconds.",
        level: "warning",
        source: "realtime",
      });
      const eventTime = eventDetail.at;
      const notification = {
        id: `tickets-connection-degraded-${eventTime}`,
        type: "connection-degraded",
        text: eventDetail.detail,
        time: eventTime,
      };

      if (!shouldEmitNotification("connection-degraded", notification.text, 30000)) {
        return;
      }

      setConnectionNotification(notification);
      setShowConnectionToast(true);
      pushLogicHealthEntry(
        makeLogicEntry({
          code: eventDetail.code,
          title: eventDetail.title,
          detail: notification.text,
          level: eventDetail.level,
          at: eventTime,
          source: eventDetail.source,
          correlationId: eventDetail.correlationId,
        }),
      );
      playAlertSound();
      maybeShowSystemNotification("Realtime Degraded", notification.text);
    };
    const handleOwnershipConflict = (e) => {
      const eventDetail = normalizeLogicEventDetail(e.detail, {
        code: LOGIC_CODES.OWNERSHIP_CONFLICT,
        title: "Ownership Conflict",
        detail:
          "Another user edited the same ticket while you were editing. Please review latest data.",
        level: "warning",
        source: "ownership",
      });
      const eventTime = eventDetail.at;
      const notification = {
        id: `ownership-conflict-${eventTime}`,
        type: "ownership-conflict",
        text: eventDetail.detail,
        time: eventTime,
      };

      if (!shouldEmitNotification("ownership-conflict", notification.text, 12000)) {
        return;
      }

      setOpsNotification(notification);
      setShowOpsToast(true);
      pushLogicHealthEntry(
        makeLogicEntry({
          code: eventDetail.code,
          title: eventDetail.title,
          detail: notification.text,
          level: eventDetail.level,
          at: eventTime,
          source: eventDetail.source,
          correlationId: eventDetail.correlationId,
        }),
      );

      playAlertSound();
      maybeShowSystemNotification("Ownership Conflict", notification.text);
    };
    const handleLogicHealthEvent = (e) => {
      const eventDetail = normalizeLogicEventDetail(e.detail, {
        source: "logic-event",
      });
      if (!eventDetail.code || !eventDetail.title) return;
      pushLogicHealthEntry(
        makeLogicEntry({
          code: eventDetail.code,
          title: eventDetail.title,
          detail: eventDetail.detail,
          level: eventDetail.level,
          at: eventDetail.at,
          source: eventDetail.source,
          correlationId: eventDetail.correlationId,
        }),
      );
    };

    const handleProviderValidation = (e) => {
      const eventDetail = normalizeLogicEventDetail(e.detail, {
        source: "provider-validation",
      });
      if (!eventDetail.code || !eventDetail.title) return;
      pushLogicHealthEntry(
        makeLogicEntry({
          code: eventDetail.code,
          title: eventDetail.title,
          detail: eventDetail.detail,
          level: eventDetail.level,
          at: eventDetail.at,
          source: eventDetail.source,
          correlationId: eventDetail.correlationId,
        }),
      );
    };

    window.addEventListener("tracking-reminder-alert", handleReminder);
    window.addEventListener("clear-tracking-reminder", clearReminder);
    window.addEventListener("tickets-realtime-error", handleRealtimeError);
    window.addEventListener(
      "tickets-realtime-restored",
      handleRealtimeRestored,
    );
    window.addEventListener(
      "tickets-realtime-degraded",
      handleRealtimeDegraded,
    );
    window.addEventListener(
      "ownership-conflict-alert",
      handleOwnershipConflict,
    );
    window.addEventListener("logic-health-event", handleLogicHealthEvent);
    window.addEventListener("provider-validation-event", handleProviderValidation);

    return () => {
      window.removeEventListener("tracking-reminder-alert", handleReminder);
      window.removeEventListener("clear-tracking-reminder", clearReminder);
      window.removeEventListener("tickets-realtime-error", handleRealtimeError);
      window.removeEventListener(
        "tickets-realtime-restored",
        handleRealtimeRestored,
      );
      window.removeEventListener(
        "tickets-realtime-degraded",
        handleRealtimeDegraded,
      );
      window.removeEventListener(
        "ownership-conflict-alert",
        handleOwnershipConflict,
      );
      window.removeEventListener("logic-health-event", handleLogicHealthEvent);
      window.removeEventListener(
        "provider-validation-event",
        handleProviderValidation,
      );
    };
  }, [
    maybeShowSystemNotification,
    playAlertSound,
    pushLogicHealthEntry,
    shouldEmitNotification,
  ]);

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

            playAlertSound();
            maybeShowSystemNotification(
              "Shift Handover Received",
              payload.new.message,
            );
          }
        },
      )
      .subscribe();

    return () => supabase.removeChannel(sub);
  }, [myAssignedShift, maybeShowSystemNotification, playAlertSound]);

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

  useEffect(() => {
    if (!isAdminOrLeader) return;

    const fetchOperationalAlerts = async () => {
      const { data } = await supabase
        .from("operational_alerts")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) setOperationalAlerts(data);
    };

    fetchOperationalAlerts();

    const sub = supabase
      .channel("operational_alerts_admin_channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "operational_alerts" },
        () => {
          fetchOperationalAlerts();
        },
      )
      .subscribe();

    return () => supabase.removeChannel(sub);
  }, [isAdminOrLeader]);

  const handleApproveRequest = async (id, status) => {
    await supabase.from("handover_requests").update({ status }).eq("id", id);
  };

  const handleAcknowledgeOperationalAlert = async (id) => {
    await supabase
      .from("operational_alerts")
      .update({
        status: "acknowledged",
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: user?.id || null,
      })
      .eq("id", id);
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
    } else {
      setSelectedHistoryTicketForNotes(null);
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
          container: "bg-[#6366F1]/15 border-[#6366F1]/30",
          text: "text-[#6366F1]",
        };
      case "IC2":
        return {
          container: "bg-[#10B981]/15 border-[#10B981]/30",
          text: "text-[#10B981]",
        };
      case "IC3":
        return {
          container: "bg-[#F59E0B]/15 border-[#F59E0B]/30",
          text: "text-[#F59E0B]",
        };
      case "IC5":
        return {
          container: "bg-[#F43F5E]/15 border-[#F43F5E]/30",
          text: "text-[#F43F5E]",
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

  // --- NEW: DYNAMIC LOGO GRADIENT LOGIC ---
  const dutyColors = {
    IC1: "#6366F1", // Indigo
    IC2: "#10B981", // Emerald
    IC3: "#F59E0B", // Amber
    IC5: "#F43F5E", // Rose
  };

  const getDynamicGradient = (activeDuties) => {
    const colors = activeDuties.map((duty) => dutyColors[duty]).filter(Boolean);
    if (colors.length === 0) return "linear-gradient(135deg, #1E293B, #475569)";
    if (colors.length === 1)
      return `linear-gradient(135deg, ${colors[0]}, ${colors[0]})`;
    return `linear-gradient(135deg, ${colors.join(", ")})`;
  };
  const mappedDutyArray = safeDutyArray.filter((duty) => dutyColors[duty]);
  const gradientDutyCount = mappedDutyArray.length;
  const useGradientLogoIcon = gradientDutyCount >= 2;
  const logoTitleColor =
    gradientDutyCount === 1 ? dutyColors[mappedDutyArray[0]] : "#000000";

  const getTicketDutyThemeKey = (ticketDuty) => {
    if (Array.isArray(ticketDuty)) {
      return ticketDuty.includes("IC0") ? "IC0" : ticketDuty[0] || "";
    }

    if (typeof ticketDuty === "string") {
      const trimmed = ticketDuty.trim();
      if (!trimmed) return "";

      if (trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return parsed.includes("IC0") ? "IC0" : parsed[0] || "";
          }
        } catch {
          // fallback to plain string parsing below
        }
      }

      const dutyMatch = trimmed.match(/IC[0-9]/i);
      if (dutyMatch) return dutyMatch[0].toUpperCase();
    }

    return "";
  };

  const getDutyHeaderBg = (dutyKey) => {
    switch (dutyKey) {
      case "IC0":
        return "bg-purple-600";
      case "IC1":
        return "bg-[#6366F1]";
      case "IC2":
        return "bg-[#10B981]";
      case "IC3":
        return "bg-[#F59E0B]";
      case "IC5":
        return "bg-[#F43F5E]";
      default:
        return "bg-slate-700";
    }
  };

  const activeHistoryNotes = useMemo(() => {
    const notes = selectedHistoryTicketForNotes?.notes;
    if (!notes) return [];
    if (Array.isArray(notes)) return notes;
    if (typeof notes === "string") {
      try {
        const parsed = JSON.parse(notes);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }, [selectedHistoryTicketForNotes]);

  const filteredArchivedTickets = useMemo(() => {
    return archivedTickets.filter((t) => {
      // search 
      const query = historySearchQuery.toLowerCase();
      const matchesSearch = query === "" || 
        (t.member_id && t.member_id.toLowerCase().includes(query)) ||
        (t.tracking_no && t.tracking_no.toLowerCase().includes(query)) ||
        (t.provider_account && t.provider_account.toLowerCase().includes(query)) ||
        (t.provider && t.provider.toLowerCase().includes(query)) ||
        (t.recorder && t.recorder.toLowerCase().includes(query)) ||
        (t.login_id && t.login_id.toLowerCase().includes(query));

      const matchesDuty = historyFilterDuty === "All" || t.ic_account === historyFilterDuty;
      
      const normalizedRowStatus = t.status ? t.status.toUpperCase() : "";
      let matchesStatus = true;
      if (historyFilterStatus !== "All") {
        if (historyFilterStatus === "Normal") {
          matchesStatus = normalizedRowStatus === "NORMAL";
        } else if (historyFilterStatus === "Abnormal") {
          matchesStatus = normalizedRowStatus !== "NORMAL";
        }
      }

      return matchesSearch && matchesDuty && matchesStatus;
    });
  }, [archivedTickets, historySearchQuery, historyFilterDuty, historyFilterStatus]);

  const historyArchiveDuties = ["All", "IC1", "IC2", "IC3", "IC5"];

  const historyModalDutyKey = getTicketDutyThemeKey(
    selectedHistoryTicketForNotes?.ic_account,
  );
  const historyModalHeaderClass = getDutyHeaderBg(historyModalDutyKey);
  // -----------------------------------------

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

  if (updaterNotification) {
    globalNotifications.push(updaterNotification);
  }

  if (connectionNotification) {
    globalNotifications.push(connectionNotification);
  }

  if (opsNotification) {
    globalNotifications.push(opsNotification);
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

  if (isAdminOrLeader && operationalAlerts.length > 0) {
    operationalAlerts.forEach((alert) =>
      globalNotifications.push({
        id: alert.id,
        type: "operational-alert",
        data: alert,
      }),
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

  const APP_VERSION = "0.0.3";
  const VERSION_HISTORY_ITEMS = [
    {
      version: "0.0.3",
      date: "2026-03",
      notes:
        "Shift handover workflow fixes: corrected Google Sheets sync error handling, fixed incoming shift auto-unlock on database confirmation. Enhanced archive history with real-time search (Player ID, Tracking No., Provider), duty filters (IC1/IC2/IC3/IC5), and status filtering (Normal/Abnormal). Implemented strict shift-overlap visibility—incoming shifts see only pending tickets until handover completes; outgoing shifts see pending + tickets they completed during the current handover window. Removed misleading clock-based notifications in favor of database-aware table locking.",
    },
    {
      version: "0.0.2",
      date: "2026-02",
      notes: "Shift transition logic improvements: Fixed incoming shift screen unlock mechanism, adjusted target shift calculation during post-start windows. Implemented session-based ticket completion tracking to enforce strict outgoing shift visibility rules during handover cycles. Auto-archiving suspension during shared transition windows.",
    },
    {
      version: "0.0.1",
      date: "2026-01",
      notes: "Ticket visibility enhancements during shift overlaps. Incoming shifts restricted to pending tickets only during shared handover windows. Outgoing shifts enhanced to view both pending and completed tickets until shift lock. Desktop installer and release pipeline improvements.",
    },
    {
      version: "0.0.0",
      date: "2025-12",
      notes: "Initial production release with core shift handover system, Google Sheets integration, ticket management, and real-time duty roster.",
    },
  ];

  const closeInfoModal = () => {
    setShowInfoModal(false);
    setInfoView("menu");
    setFeedbackText("");
    setFeedbackNotice({ text: "", type: "" });
    setIsSendingFeedback(false);
  };

  const handleRestartForUpdate = async () => {
    if (
      isInstallingUpdate ||
      !window.electronAPI ||
      typeof window.electronAPI.restartToInstallUpdate !== "function"
    ) {
      return;
    }

    try {
      setIsInstallingUpdate(true);
      await window.electronAPI.restartToInstallUpdate();
    } catch {
      setIsInstallingUpdate(false);
    }
  };

  const handleConfirmDutySwitch = () => {
    setShowDutySwitchConfirm(false);
    setDuty([]);
  };

  const openManual = () => {
    alert("RiskOps Manual link is not set yet.");
  };

  const submitFeedback = async (type) => {
    if (!feedbackText.trim()) {
      setFeedbackNotice({
        text: "Please enter details before submitting.",
        type: "error",
      });
      return;
    }

    setIsSendingFeedback(true);
    setFeedbackNotice({ text: "", type: "" });

    try {
      const payload = {
        service_id: "service_ek7yrd6",
        template_id: "template_a5phivn",
        user_id: "9YcKE1VQOAlpV78OM",
        template_params: {
          type: type === "bug" ? "Bug Report" : "Feature Suggestion",
          user_name: workName || user?.email || "RiskOps Agent",
          message: feedbackText,
        },
      };

      const response = await fetch(
        "https://api.emailjs.com/api/v1.0/email/send",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to submit");
      }

      setFeedbackText("");
      setFeedbackNotice({ text: "Submitted successfully.", type: "success" });
      setTimeout(() => {
        setInfoView("menu");
        setFeedbackNotice({ text: "", type: "" });
      }, 1200);
    } catch {
      setFeedbackNotice({
        text: "Unable to submit right now. Please try again.",
        type: "error",
      });
    } finally {
      setIsSendingFeedback(false);
    }
  };

  return (
    <>
      <header className="bg-white rounded-2xl shadow-sm border border-slate-100 mx-6 mt-6 px-6 h-16 flex items-center justify-between shrink-0 z-40 relative">
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-300 ${useGradientLogoIcon ? "text-white" : `${style.container} ${style.text}`}`}
            style={
              useGradientLogoIcon
                ? { backgroundImage: getDynamicGradient(safeDutyArray) }
                : undefined
            }
          >
            <Shield size={18} />
          </div>
          <div>
            <h1
              className="text-sm font-black tracking-tight transition-colors duration-300"
              style={{ color: logoTitleColor }}
            >
              RiskOps Portal
            </h1>
            <p className="text-[10px] font-medium text-slate-500">
              Internal Control System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* --- CHANGE DUTY BUTTON (Only for Normal Users) --- */}
          {!isAdminOrLeader && (
            <button
              onClick={() => setShowDutySwitchConfirm(true)}
              className="flex items-center justify-center w-8 h-8 rounded-full transition-colors ml-2 bg-slate-100 text-slate-600 hover:bg-slate-200"
              title="Switch Duty"
            >
              <ArrowLeftRight size={16} strokeWidth={2.5} />
            </button>
          )}

          <button
            onClick={() => {
              setShowInfoModal(true);
              setInfoView("menu");
              setFeedbackNotice({ text: "", type: "" });
            }}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-colors bg-slate-100 text-slate-600 hover:bg-slate-200"
            title="Info Center"
          >
            <CircleHelp size={16} strokeWidth={2.5} />
          </button>

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
                      if (notif.type === "update-ready") {
                        return (
                          <div
                            key={notif.id}
                            className="p-3 mb-2 bg-emerald-50 border border-emerald-200 shadow-sm rounded-lg relative overflow-hidden"
                          >
                            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                            <div className="flex items-start gap-2">
                              <CheckCircle2
                                size={16}
                                className="text-emerald-600 shrink-0 mt-0.5"
                              />
                              <div>
                                <h4 className="text-xs font-bold text-emerald-800 mb-0.5">
                                  Update Ready
                                </h4>
                                <p className="text-xs text-emerald-700 font-medium leading-relaxed">
                                  {notif.text}
                                </p>
                                <span className="text-[9px] text-emerald-500 mt-1 block">
                                  {new Date(notif.time).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                <button
                                  onClick={handleRestartForUpdate}
                                  disabled={isInstallingUpdate}
                                  className="mt-2 text-[10px] font-bold text-emerald-700 hover:text-emerald-900 underline disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  {isInstallingUpdate
                                    ? "Restarting..."
                                    : "Restart Now"}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      if (notif.type === "connection-error") {
                        return (
                          <div
                            key={notif.id}
                            className="p-3 mb-2 bg-rose-50 border border-rose-200 shadow-sm rounded-lg relative overflow-hidden"
                          >
                            <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                            <div className="flex items-start gap-2">
                              <AlertTriangle
                                size={16}
                                className="text-rose-600 shrink-0 mt-0.5"
                              />
                              <div>
                                <h4 className="text-xs font-bold text-rose-800 mb-0.5">
                                  Connection Issue
                                </h4>
                                <p className="text-xs text-rose-700 font-medium leading-relaxed">
                                  {notif.text}
                                </p>
                                <span className="text-[9px] text-rose-500 mt-1 block">
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
                      if (notif.type === "connection-restored") {
                        return (
                          <div
                            key={notif.id}
                            className="p-3 mb-2 bg-emerald-50 border border-emerald-200 shadow-sm rounded-lg relative overflow-hidden"
                          >
                            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                            <div className="flex items-start gap-2">
                              <CheckCircle2
                                size={16}
                                className="text-emerald-600 shrink-0 mt-0.5"
                              />
                              <div>
                                <h4 className="text-xs font-bold text-emerald-800 mb-0.5">
                                  Connection Restored
                                </h4>
                                <p className="text-xs text-emerald-700 font-medium leading-relaxed">
                                  {notif.text}
                                </p>
                                <span className="text-[9px] text-emerald-500 mt-1 block">
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
                      if (notif.type === "connection-degraded") {
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
                                  Realtime Degraded
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
                      if (notif.type === "shift-start") {
                        return (
                          <div
                            key={notif.id}
                            className="p-3 mb-2 bg-blue-50 border border-blue-200 shadow-sm rounded-lg relative overflow-hidden"
                          >
                            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                            <div className="flex items-start gap-2">
                              <Clock
                                size={16}
                                className="text-blue-600 shrink-0 mt-0.5"
                              />
                              <div>
                                <h4 className="text-xs font-bold text-blue-800 mb-0.5">
                                  Shift Started
                                </h4>
                                <p className="text-xs text-blue-700 font-medium leading-relaxed">
                                  {notif.text}
                                </p>
                                <span className="text-[9px] text-blue-500 mt-1 block">
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
                      if (notif.type === "ownership-conflict") {
                        return (
                          <div
                            key={notif.id}
                            className="p-3 mb-2 bg-orange-50 border border-orange-200 shadow-sm rounded-lg relative overflow-hidden"
                          >
                            <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
                            <div className="flex items-start gap-2">
                              <AlertTriangle
                                size={16}
                                className="text-orange-600 shrink-0 mt-0.5"
                              />
                              <div>
                                <h4 className="text-xs font-bold text-orange-800 mb-0.5">
                                  Ownership Conflict
                                </h4>
                                <p className="text-xs text-orange-700 font-medium leading-relaxed">
                                  {notif.text}
                                </p>
                                <span className="text-[9px] text-orange-500 mt-1 block">
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
                      if (notif.type === "operational-alert") {
                        return (
                          <div
                            key={notif.id}
                            className="p-3 mb-2 bg-red-50 border border-red-200 shadow-sm rounded-lg relative overflow-hidden"
                          >
                            <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                            <div className="ml-1.5">
                              <h4 className="text-xs font-bold text-red-800 mb-0.5">
                                {notif.data.title || "Operational Alert"}
                              </h4>
                              <p className="text-xs text-red-700 font-medium leading-relaxed">
                                {notif.data.message}
                              </p>
                              <button
                                onClick={() =>
                                  handleAcknowledgeOperationalAlert(notif.data.id)
                                }
                                className="mt-2 w-full py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded transition-colors"
                              >
                                Acknowledge
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
                  <>
                    {onlineUsers.map((activeUser, idx) => {
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
                    })}

                    {recentlyOfflineUsers?.length > 0 && (
                      <>
                        <div className="border-t border-slate-100 my-1" />
                        <div className="px-2 pt-1 pb-0.5 text-[9px] font-bold text-amber-600 uppercase tracking-wider">
                          Recently Online (120s)
                        </div>
                        {recentlyOfflineUsers.map((userInfo, idx) => (
                          <div
                            key={`recent-${userInfo.id || userInfo.workName || idx}`}
                            className="flex items-center justify-between px-2 py-1.5 rounded-md bg-amber-50/60"
                          >
                            <span className="text-[11px] font-semibold text-amber-800">
                              {userInfo.workName}
                            </span>
                            <span className="text-[9px] font-bold text-amber-600">
                              {formatPresenceAgo(userInfo.lastSeenAt)}
                            </span>
                          </div>
                        ))}
                      </>
                    )}

                    {isAdminOrLeader && (
                      <>
                        <div className="border-t border-slate-100 my-1" />
                        <div className="px-2 pb-2 text-[9px] text-slate-500 space-y-0.5">
                          <div className="font-bold uppercase tracking-wider text-slate-400">
                            Presence Debug
                          </div>
                          <div>Status: {presenceDebug?.lastSubscribeStatus || "IDLE"}</div>
                          <div>Reconnects: {presenceDebug?.reconnectCount || 0}</div>
                          <div>Heartbeat: {formatPresenceAgo(presenceDebug?.lastHeartbeatAt)}</div>
                          <div>Last Sync: {formatPresenceAgo(presenceDebug?.lastPresenceSyncAt)}</div>
                        </div>

                        <div className="px-2 pb-2">
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                                Logic Health
                              </div>
                              <button
                                onClick={runLogicQuickChecks}
                                className="px-1.5 py-1 text-[9px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition-colors"
                              >
                                Run Checks
                              </button>
                            </div>

                            {logicHealthEntries.length === 0 ? (
                              <div className="text-[10px] text-slate-400 italic">
                                No recent logic alerts.
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {logicHealthEntries.slice(0, 4).map((entry) => (
                                  <div
                                    key={entry.id}
                                    className={`rounded px-1.5 py-1 border ${
                                      entry.level === "error"
                                        ? "bg-rose-50 border-rose-200"
                                        : entry.level === "warning"
                                          ? "bg-amber-50 border-amber-200"
                                          : entry.level === "success"
                                            ? "bg-emerald-50 border-emerald-200"
                                            : "bg-white border-slate-200"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[9px] font-bold text-slate-700">
                                        {entry.code}
                                      </span>
                                      <span className="text-[9px] text-slate-400">
                                        {formatPresenceAgo(entry.at)}
                                      </span>
                                    </div>
                                    <div className="text-[10px] font-semibold text-slate-700 leading-tight">
                                      {entry.title}
                                    </div>
                                    <div className="text-[10px] text-slate-500 leading-tight">
                                      {entry.detail}
                                    </div>
                                    <div className="text-[9px] text-slate-400 leading-tight mt-0.5">
                                      {entry.correlationId}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </>
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

      {showUpdaterToast && updaterNotification && (
        <div className="fixed bottom-4 right-4 z-120 w-85 max-w-[calc(100vw-2rem)] rounded-xl border border-emerald-200 bg-white shadow-xl">
          <div className="p-3 flex items-start gap-2">
            <div className="mt-0.5 text-emerald-600">
              <Bell size={16} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-900">Update Ready</p>
              <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                {updaterNotification.text}
              </p>
              <button
                onClick={handleRestartForUpdate}
                disabled={isInstallingUpdate}
                className="mt-2 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isInstallingUpdate ? "Restarting..." : "Restart Now"}
              </button>
            </div>
            <button
              onClick={() => setShowUpdaterToast(false)}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Close update toast"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {showConnectionToast && connectionNotification && (
        <div
          className={`fixed right-4 z-120 w-85 max-w-[calc(100vw-2rem)] rounded-xl border bg-white shadow-xl ${showUpdaterToast ? "bottom-28" : "bottom-4"} ${connectionNotification.type === "connection-error" ? "border-rose-200" : "border-emerald-200"}`}
        >
          <div className="p-3 flex items-start gap-2">
            <div
              className={`mt-0.5 ${connectionNotification.type === "connection-error" ? "text-rose-600" : "text-emerald-600"}`}
            >
              {connectionNotification.type === "connection-error" ? (
                <AlertTriangle size={16} />
              ) : (
                <CheckCircle2 size={16} />
              )}
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-900">
                {connectionNotification.type === "connection-error"
                  ? "Live Sync Issue"
                  : "Live Sync Restored"}
              </p>
              <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                {connectionNotification.text}
              </p>
            </div>
            <button
              onClick={() => setShowConnectionToast(false)}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Close connection toast"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {showOpsToast && opsNotification && (
        <div
          className={`fixed right-4 z-120 w-85 max-w-[calc(100vw-2rem)] rounded-xl border bg-white shadow-xl ${showUpdaterToast || showConnectionToast ? "bottom-28" : "bottom-4"} ${opsNotification.type === "ownership-conflict" ? "border-orange-200" : "border-blue-200"}`}
        >
          <div className="p-3 flex items-start gap-2">
            <div
              className={`mt-0.5 ${opsNotification.type === "ownership-conflict" ? "text-orange-600" : "text-blue-600"}`}
            >
              {opsNotification.type === "ownership-conflict" ? (
                <AlertTriangle size={16} />
              ) : (
                <Clock size={16} />
              )}
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-900">
                {opsNotification.type === "ownership-conflict"
                  ? "Ownership Conflict"
                  : "Shift Started"}
              </p>
              <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                {opsNotification.text}
              </p>
            </div>
            <button
              onClick={() => setShowOpsToast(false)}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Close operations toast"
            >
              <X size={14} />
            </button>
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
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col gap-4 bg-white shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wide">
                  <ArchiveRestore size={18} className="text-indigo-600" />
                  Archived Investigations{" "}
                  {historyStartDate || historyEndDate ? "" : "(Past 30 Days)"}
                </h2>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px] relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={14} className="text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by Player ID, Tracking No, Provider..."
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700 placeholder-slate-400"
                  />
                  {historySearchQuery && (
                    <button
                      onClick={() => setHistorySearchQuery("")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 h-[38px]">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Duty:
                  </span>
                  <select
                    value={historyFilterDuty}
                    onChange={(e) => setHistoryFilterDuty(e.target.value)}
                    className="text-xs font-bold border-none bg-transparent outline-none text-slate-700 cursor-pointer"
                  >
                    {historyArchiveDuties.map(duty => (
                      <option key={duty} value={duty}>{duty}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 h-[38px]">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Status:
                  </span>
                  <select
                    value={historyFilterStatus}
                    onChange={(e) => setHistoryFilterStatus(e.target.value)}
                    className="text-xs font-bold border-none bg-transparent outline-none text-slate-700 cursor-pointer"
                  >
                    <option value="All">All</option>
                    <option value="Normal">Normal</option>
                    <option value="Abnormal">Abnormal</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 h-[38px]">
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
                        <td
                          colSpan="11"
                          className="px-6 py-12 text-center text-slate-400 font-medium"
                        >
                          <div className="flex items-center justify-center gap-2">
                            <RefreshCw
                              size={16}
                              className="animate-spin text-indigo-500"
                            />{" "}
                            Fetching secure records...
                          </div>
                        </td>
                      </tr>
                    ) : filteredArchivedTickets.length === 0 ? (
                      <tr>
                        <td
                          colSpan="11"
                          className="px-6 py-12 text-center text-slate-400 font-medium italic"
                        >
                          No archived tickets found matching your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredArchivedTickets.map((t) => {
                        let rowNotes = [];
                        if (Array.isArray(t.notes)) {
                          rowNotes = t.notes;
                        } else if (typeof t.notes === "string") {
                          try {
                            const parsed = JSON.parse(t.notes);
                            rowNotes = Array.isArray(parsed) ? parsed : [];
                          } catch {
                            rowNotes = [];
                          }
                        }

                        return (
                          <tr
                            key={t.id}
                            className="hover:bg-slate-50 transition-colors"
                          >
                            <td className="px-4 py-3 text-slate-500 font-medium">
                              {new Date(t.created_at).toLocaleDateString(
                                "en-GB",
                                { month: "short", day: "2-digit" },
                              )}{" "}
                              <span className="text-slate-400 ml-1">
                                {new Date(t.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-700">
                              {t.ic_account}
                            </td>
                            <td className="px-4 py-3 font-mono font-semibold text-slate-700">
                              {t.member_id && t.member_id.includes("@")
                                ? t.member_id.split("@")[1]
                                : "-"}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {t.login_id || "-"}
                            </td>
                            <td className="px-4 py-3 font-mono text-indigo-700 font-bold">
                              {t.member_id}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-600">
                              {t.provider_account || "-"}
                            </td>
                            <td className="px-4 py-3 text-slate-600 font-medium">
                              {t.provider}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-600">
                              {t.tracking_no || "-"}
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-medium">
                              {t.recorder}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() =>
                                  setSelectedHistoryTicketForNotes({
                                    ...t,
                                    notes: rowNotes,
                                  })
                                }
                                className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${rowNotes.length > 0 ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100" : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"}`}
                                title="View chat history"
                              >
                                {rowNotes.length > 0
                                  ? `${rowNotes.length} Messages`
                                  : "No Notes"}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-block px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  t.status === "Normal" || t.status === "NORMAL"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}
                              >
                                {t.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {showInfoModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center animate-in fade-in duration-200 p-4">
          <div className="bg-white w-[520px] max-w-[95vw] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 text-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold tracking-wide flex items-center gap-2">
                  <CircleHelp size={16} /> RiskOps Info Center
                </h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Version {APP_VERSION}
                </p>
              </div>
              <button
                onClick={closeInfoModal}
                className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 bg-slate-50">
              {infoView === "menu" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={openManual}
                    className="text-left p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                      <BookOpen size={16} className="text-indigo-600" />
                      RiskOps Manual
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Open usage and SOP manual.
                    </p>
                  </button>

                  <button
                    onClick={() => {
                      setInfoView("bug");
                      setFeedbackText("");
                      setFeedbackNotice({ text: "", type: "" });
                    }}
                    className="text-left p-4 bg-white border border-slate-200 rounded-xl hover:border-rose-300 hover:bg-rose-50/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                      <Bug size={16} className="text-rose-600" />
                      Report a Bug
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Send issue details to the team.
                    </p>
                  </button>

                  <button
                    onClick={() => {
                      setInfoView("feature");
                      setFeedbackText("");
                      setFeedbackNotice({ text: "", type: "" });
                    }}
                    className="text-left p-4 bg-white border border-slate-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                      <Sparkles size={16} className="text-emerald-600" />
                      Suggest New Feature
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Share improvements for RiskOps.
                    </p>
                  </button>

                  <button
                    onClick={() => setInfoView("versions")}
                    className="text-left p-4 bg-white border border-slate-200 rounded-xl hover:border-amber-300 hover:bg-amber-50/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                      <History size={16} className="text-amber-600" />
                      Version History
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      View release changes.
                    </p>
                  </button>

                  {isAdminOrLeader && (
                    <button
                      onClick={() => setInfoView("logic")}
                      className="text-left p-4 bg-white border border-slate-200 rounded-xl hover:border-sky-300 hover:bg-sky-50/40 transition-colors sm:col-span-2"
                    >
                      <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                        <AlertCircle size={16} className="text-sky-600" />
                        Logic Health
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        View coded runtime checks and recent logic alerts.
                      </p>
                    </button>
                  )}
                </div>
              )}

              {(infoView === "bug" || infoView === "feature") && (
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-slate-800 mb-1">
                    {infoView === "bug"
                      ? "Report a Bug"
                      : "Suggest New Feature"}
                  </h4>
                  <p className="text-xs text-slate-500 mb-3">
                    {infoView === "bug"
                      ? "Describe what happened, steps to reproduce, and expected behavior."
                      : "Describe your idea, use case, and expected benefit."}
                  </p>

                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder={
                      infoView === "bug"
                        ? "Example: In TicketForm, clicking Create during shift handover..."
                        : "Example: Add bulk status update for selected tickets..."
                    }
                    className="w-full h-36 resize-none px-3 py-2 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-400"
                  />

                  {feedbackNotice.text && (
                    <div
                      className={`mt-3 text-xs font-bold px-3 py-2 rounded-lg ${feedbackNotice.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}
                    >
                      {feedbackNotice.text}
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between">
                    <button
                      onClick={() => {
                        setInfoView("menu");
                        setFeedbackText("");
                        setFeedbackNotice({ text: "", type: "" });
                      }}
                      className="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => submitFeedback(infoView)}
                      disabled={isSendingFeedback}
                      className="px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-lg transition-colors disabled:opacity-60 flex items-center gap-1.5"
                    >
                      <Send size={13} />
                      {isSendingFeedback ? "Submitting..." : "Submit"}
                    </button>
                  </div>
                </div>
              )}

              {infoView === "versions" && (
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-slate-800">
                      Version History
                    </h4>
                    <button
                      onClick={() => setInfoView("menu")}
                      className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      Back
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {VERSION_HISTORY_ITEMS.map((entry) => (
                      <div
                        key={entry.version}
                        className="border border-slate-200 rounded-lg p-3 bg-slate-50"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-800">
                            v{entry.version}
                          </span>
                          <span className="text-[10px] font-medium text-slate-500">
                            {entry.date}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {entry.notes}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {infoView === "logic" && isAdminOrLeader && (
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-slate-800">Logic Health</h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={clearLogicHealthEntries}
                        disabled={logicHealthEntries.length === 0}
                        className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Clear Log
                      </button>
                      <button
                        onClick={runLogicQuickChecks}
                        className="px-3 py-1.5 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors"
                      >
                        Run Quick Checks
                      </button>
                      <button
                        onClick={() => setInfoView("menu")}
                        className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        Back
                      </button>
                    </div>
                  </div>

                  <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Presence Status
                      </div>
                      <div className="text-xs font-semibold text-slate-700 mt-0.5">
                        {presenceDebug?.lastSubscribeStatus || "IDLE"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Reconnects
                      </div>
                      <div className="text-xs font-semibold text-slate-700 mt-0.5">
                        {presenceDebug?.reconnectCount || 0}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Last Heartbeat
                      </div>
                      <div className="text-xs font-semibold text-slate-700 mt-0.5">
                        {formatPresenceAgo(presenceDebug?.lastHeartbeatAt)}
                      </div>
                    </div>
                  </div>

                  <div className="mb-3 space-y-2">
                    <input
                      type="text"
                      value={logicHealthSearch}
                      onChange={(e) => setLogicHealthSearch(e.target.value)}
                      placeholder="Search code, detail, correlation id, source"
                      className="w-full px-3 py-2 text-xs text-slate-700 border border-slate-200 rounded-lg bg-white outline-none focus:border-sky-300"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {LOGIC_SEVERITIES.map((severity) => (
                        <button
                          key={severity}
                          onClick={() => setLogicHealthLevelFilter(severity)}
                          className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors ${
                            logicHealthLevelFilter === severity
                              ? "bg-sky-50 text-sky-700 border-sky-200"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {severity.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredLogicHealthEntries.length === 0 ? (
                    <div className="text-xs text-slate-500 border border-slate-200 rounded-lg bg-slate-50 px-3 py-2">
                      No matching logic alerts. Adjust filters or run quick checks.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {filteredLogicHealthEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className={`border rounded-lg p-3 ${
                            entry.level === "error"
                              ? "border-rose-200 bg-rose-50"
                              : entry.level === "warning"
                                ? "border-amber-200 bg-amber-50"
                                : entry.level === "success"
                                  ? "border-emerald-200 bg-emerald-50"
                                  : "border-slate-200 bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-800">{entry.code}</span>
                            <span className="text-[10px] font-medium text-slate-500">
                              {formatPresenceAgo(entry.at)}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-slate-700">
                            {entry.title}
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                            {entry.detail}
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                            <span>{entry.source || "ui"}</span>
                            <span>{entry.correlationId}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedHistoryTicketForNotes && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[120] flex items-center justify-center animate-in fade-in duration-200 p-4">
          <div className="bg-slate-50 w-[420px] h-[560px] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div
              className={`px-5 py-4 ${historyModalHeaderClass} flex items-center justify-between text-white shadow-md`}
            >
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <MessageCircle size={16} /> Chat History
                </h3>
                <p className="text-[11px] font-medium text-white/80 mt-1">
                  Player: {selectedHistoryTicketForNotes.member_id}
                </p>
              </div>
              <button
                onClick={() => setSelectedHistoryTicketForNotes(null)}
                className="p-1.5 bg-black/10 hover:bg-black/20 rounded-full transition-colors"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {activeHistoryNotes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                  <MessageCircle size={32} className="text-slate-400 mb-2" />
                  <p className="text-xs text-slate-500 font-medium">
                    No chat history for this ticket.
                  </p>
                </div>
              ) : (
                activeHistoryNotes.map((note, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col items-start w-full animate-in slide-in-from-bottom-2 duration-300"
                  >
                    <div className="flex items-center gap-2 mb-1 ml-2">
                      <span className="text-[10px] font-bold text-slate-600">
                        {note.author || "Unknown"}
                      </span>
                      <span className="text-[9px] font-medium text-slate-400">
                        {note.timestamp || ""}
                      </span>
                    </div>
                    <div className="bg-white border border-slate-200 shadow-sm text-slate-700 text-xs px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-[88%] leading-relaxed whitespace-pre-wrap">
                      {note.text || "-"}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-white border-t border-slate-200 text-[10px] text-slate-500 font-medium text-center">
              Read-only archive view for {historyModalDutyKey || "Unknown Duty"}
            </div>
          </div>
        </div>
      )}

      {showDutySwitchConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[130] flex items-center justify-center animate-in fade-in duration-200 p-4">
          <div className="bg-white w-[420px] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                Confirm Duty Switch
              </h3>
              <button
                onClick={() => setShowDutySwitchConfirm(false)}
                className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                Are you sure you want to switch duty? This will return you to
                the duty selector page.
              </p>

              <div className="mt-5 flex items-center justify-end gap-2.5">
                <button
                  onClick={() => setShowDutySwitchConfirm(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDutySwitch}
                  className="px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-lg transition-colors"
                >
                  Yes, Switch Duty
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
