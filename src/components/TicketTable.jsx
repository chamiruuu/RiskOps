import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  MessageSquare,
  MessageCircle,
  X,
  Send,
  Edit2,
  CheckCircle2,
  Trash2,
  Copy,
  AlertTriangle,
  ArrowRightLeft,
  Info,
  ArrowRight,
  Users,
  LogOut,
  Handshake,
  Megaphone,
  FileWarning,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useDuty } from "../context/DutyContext";
import notificationSound from "../assets/Notification.mp3"; // <-- ADDED SOUND FOR TOAST
import { PROVIDER_CONFIG } from "../config/providerConfig"; // <-- 2. ADD THIS

// --- Duty Text Color Mapping ---
const getDutyTextColor = (dutyName) => {
  switch (dutyName) {
    case "IC0":
      return "text-purple-700";
    case "IC1":
      return "text-[#6366F1]";
    case "IC2":
      return "text-[#10B981]";
    case "IC3":
      return "text-[#F59E0B]";
    case "IC5":
      return "text-[#F43F5E]";
    default:
      return "text-slate-700";
  }
};

// --- Duty Theme Mappings for Notes Modal ---
const getDutyBorderRing = (dutyName) => {
  switch (dutyName) {
    case "IC0":
      return "focus:border-purple-400 focus:ring-purple-50";
    case "IC1":
      return "focus:border-[#6366F1] focus:ring-[#6366F1]/10";
    case "IC2":
      return "focus:border-[#10B981] focus:ring-[#10B981]/10";
    case "IC3":
      return "focus:border-[#F59E0B] focus:ring-[#F59E0B]/10";
    case "IC5":
      return "focus:border-[#F43F5E] focus:ring-[#F43F5E]/10";
    default:
      return "focus:border-slate-400 focus:ring-slate-50";
  }
};

const getDutyButton = (dutyName) => {
  switch (dutyName) {
    case "IC0":
      return "bg-purple-600 hover:bg-purple-700";
    case "IC1":
      return "bg-[#6366F1] hover:bg-[#6366F1]/90";
    case "IC2":
      return "bg-[#10B981] hover:bg-[#10B981]/90";
    case "IC3":
      return "bg-[#F59E0B] hover:bg-[#F59E0B]/90";
    case "IC5":
      return "bg-[#F43F5E] hover:bg-[#F43F5E]/90";
    default:
      return "bg-slate-600 hover:bg-slate-700";
  }
};

const getDutyHeaderBg = (dutyName) => {
  switch (dutyName) {
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
      return "bg-slate-600";
  }
};

// --- HELPER: Get Current GMT+8 Time ---
const getGMT8Time = () => {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * 8);
};

const getFormattedDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// HELPER: Determine the LAST shift change threshold
const getLastShiftChangeTime = () => {
  const now = getGMT8Time();
  const h = now.getHours();
  const m = now.getMinutes();
  const timeInHours = h + m / 60;

  const lastChange = new Date(now);
  lastChange.setSeconds(0, 0);

  if (timeInHours >= 7.1666 && timeInHours < 14.6666) {
    lastChange.setHours(7, 10);
  } else if (timeInHours >= 14.6666 && timeInHours < 22.6666) {
    lastChange.setHours(14, 40);
  } else if (timeInHours >= 22.6666) {
    lastChange.setHours(22, 40);
  } else {
    lastChange.setDate(lastChange.getDate() - 1);
    lastChange.setHours(22, 40);
  }
  return lastChange;
};

const getTransitionContext = (inputNow = getGMT8Time()) => {
  const now = new Date(inputNow);
  now.setSeconds(0, 0);
  const h = now.getHours();
  const m = now.getMinutes();
  const timeInHours = h + m / 60;

  if (timeInHours >= 6.75 && timeInHours < 7.5) {
    const windowStart = new Date(now);
    windowStart.setHours(6, 45, 0, 0);
    return {
      pair: { outgoing: "Night", incoming: "Morning" },
      marker: `${getFormattedDate(now)}|Night->Morning`,
      windowStart,
      isManualWindow: timeInHours <= 7.1666,
      isSharedWindow: timeInHours >= 7.1666 && timeInHours < 7.5,
      isPostStartWindow: timeInHours >= 7.1833 && timeInHours < 7.5,
      lockWarningHour: 7,
      lockWarningMinute: 20,
    };
  }

  if (timeInHours >= 14.25 && timeInHours < 15.0) {
    const windowStart = new Date(now);
    windowStart.setHours(14, 15, 0, 0);
    return {
      pair: { outgoing: "Morning", incoming: "Afternoon" },
      marker: `${getFormattedDate(now)}|Morning->Afternoon`,
      windowStart,
      isManualWindow: timeInHours <= 14.6666,
      isSharedWindow: timeInHours >= 14.6666 && timeInHours < 15.0,
      isPostStartWindow: timeInHours >= 14.6833 && timeInHours < 15.0,
      lockWarningHour: 14,
      lockWarningMinute: 50,
    };
  }

  if (timeInHours >= 22.25 && timeInHours < 23.0) {
    const windowStart = new Date(now);
    windowStart.setHours(22, 15, 0, 0);
    return {
      pair: { outgoing: "Afternoon", incoming: "Night" },
      marker: `${getFormattedDate(now)}|Afternoon->Night`,
      windowStart,
      isManualWindow: timeInHours <= 22.6666,
      isSharedWindow: timeInHours >= 22.6666 && timeInHours < 23.0,
      isPostStartWindow: timeInHours >= 22.6833 && timeInHours < 23.0,
      lockWarningHour: 22,
      lockWarningMinute: 50,
    };
  }

  return null;
};

// HELPER: Check if time is currently inside the handover window
const checkIsHandoverWindow = () => {
  const ctx = getTransitionContext();
  return !!ctx && ctx.isManualWindow;
};

const getHandoverShiftPair = () => {
  const ctx = getTransitionContext();
  return ctx?.pair || null;
};

const getNextShift = (current) => {
  if (current === "Morning") return "Afternoon";
  if (current === "Afternoon") return "Night";
  return "Morning";
};

// --- Reusable Click-to-Edit Component ---
const EditableField = ({
  ticket,
  fieldKey,
  placeholder,
  addText,
  onUpdateTicket,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(ticket[fieldKey] || "");
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    setIsEditing(false);
    if (value !== (ticket[fieldKey] || "")) {
      onUpdateTicket(ticket.id, fieldKey, value);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
        className="w-28 px-2 py-1.5 text-xs bg-white border-2 border-indigo-400 rounded outline-none shadow-sm font-mono text-slate-800"
      />
    );
  }

  return value ? (
    <div className="group flex items-center gap-2 py-1">
      <span className="font-mono text-slate-700 font-medium">{value}</span>
      <Edit2
        size={12}
        onClick={() => setIsEditing(true)}
        title={`Click to edit ${placeholder}`}
        className="cursor-pointer text-slate-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all"
      />
    </div>
  ) : (
    <button
      onClick={() => setIsEditing(true)}
      className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 border border-dashed border-slate-300 hover:border-indigo-400 rounded px-2 py-1 transition-all bg-slate-50 hover:bg-indigo-50"
    >
      {addText}
    </button>
  );
};

export default function TicketTable({
  tickets,
  onUpdateTicket,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onDeleteTicket,
  dutyNumber,
  shortWorkName,
}) {
  const {
    user,
    userRole,
    onlineUsers,
    myAssignedShift,
    isMyShiftActive,
    currentActiveShift,
    activeRoster,
    sendTransferRequest,
    transferResponse,
    resetTransferResponse,
    setDuty,
  } = useDuty();
  const isAdminOrLeader = userRole === "Admin" || userRole === "Leader";

  // Helper function to check if a note can be edited (within 3 hours and authored by current user or admin/leader)
  const canEditNote = (note) => {
    const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
    const now = Date.now();
    const noteAge = now - (note.createdAt || 0);
    const isWithinEditWindow = noteAge <= THREE_HOURS_MS;
    const isNoteAuthor = note.createdByUserId === user?.id;
    
    return isWithinEditWindow && (isNoteAuthor || isAdminOrLeader);
  };

  // Helper function to check if a note can be deleted
  const canDeleteNote = (note) => {
    const isNoteAuthor = note.createdByUserId === user?.id;
    return isNoteAuthor || isAdminOrLeader;
  };

  // --- SENDER TRANSFER MODAL STATES (MULTI-SEND) ---
  const [transferModal, setTransferModal] = useState({
    isOpen: false,
    step: "select",
  });
  const [transferAssignments, setTransferAssignments] = useState({});
  const [transferStatuses, setTransferStatuses] = useState({});

  const [selectedTicketForNotes, setSelectedTicketForNotes] = useState(null);
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteState, setEditingNoteState] = useState({ ticketId: null, noteIndex: null, text: "" });
  const [searchTerm, setSearchTerm] = useState("");

  const [deletingRowId, setDeletingRowId] = useState(null);

  const [completeModal, setCompleteModal] = useState({
    isOpen: false,
    ticket: null,
    step: "select",
    type: "",
    abnormalType: "",
  });
  const [handoverModal, setHandoverModal] = useState({
    isOpen: false,
    step: "",
    missingTickets: [],
  });

  const [followUpModal, setFollowUpModal] = useState(false);
  const [copiedProvider, setCopiedProvider] = useState(null);

  const [abnormalModalState, setAbnormalModalState] = useState({
    isOpen: false,
    provider: "",
    memberId: "",
    abnormalType: "",
  });
  const [copiedAbnormal, setCopiedAbnormal] = useState(false);

  // --- TRACKING ID REMINDER STATES ---
  const [showReminderToast, setShowReminderToast] = useState(false);
  const [lastReminderHour, setLastReminderHour] = useState(null);
  const [reminderToast, setReminderToast] = useState({
    title: "Handover Reminder",
    text: "Handover opens in 5 minutes. Make sure your handover is correctly recorded for all entries.",
  });

  const dutyArray = useMemo(
    () => (Array.isArray(dutyNumber) ? dutyNumber : []),
    [dutyNumber],
  );
  const buildHandoverMarker = useCallback(() => {
    const transitionCtx = getTransitionContext();
    const baseMarker = transitionCtx
      ? transitionCtx.marker
      : getLastShiftChangeTime().toISOString();
    return `${baseMarker}|${dutyArray.slice().sort().join(",")}`;
  }, [dutyArray]);

  const [isHandoverProcessing, setIsHandoverProcessing] = useState(false);
  const [handoverCompletedForCurrentWindow, setHandoverCompletedForCurrentWindow] =
    useState(false);
  const autoHandoverLoggedRef = useRef("");
  const lastPostStartReminderMinuteRef = useRef("");
  const lockWarningMarkerRef = useRef("");
  const handedOverTicketIdsByMarkerRef = useRef(new Map());

  // --- SMART 5-MIN HANDOVER REMINDER ---
  useEffect(() => {
    const checkReminder = () => {
      // Ignore Admins/Leaders and Off-Shift users
      if (isAdminOrLeader || !isMyShiftActive) return;

      const now = getGMT8Time();
      const h = now.getHours();
      const m = now.getMinutes();

      // Exact trigger times: 14:10, 22:10, 06:40
      const isReminderTime =
        (h === 14 && m === 10) ||
        (h === 22 && m === 10) ||
        (h === 6 && m === 40);

      if (isReminderTime && lastReminderHour !== h) {
        const pendingTix = tickets.filter((t) => t.status === "Pending");
        const missing = pendingTix.filter(
          (t) =>
            !t.tracking_no ||
            t.tracking_no === "-" ||
            t.tracking_no.trim() === "",
        );

        const reminderText =
          missing.length > 0
            ? `You have ${missing.length} pending ticket(s) missing Tracking ID. Handover opens in 5 minutes.`
            : "Handover opens in 5 minutes. Make sure your handover is correctly recorded for all entries.";

        setLastReminderHour(h);
        setReminderToast({
          title:
            missing.length > 0 ? "Missing Tracking IDs" : "Handover Reminder",
          text: reminderText,
        });
        setShowReminderToast(true);

        // Play Sound
        const audio = new Audio(notificationSound);
        audio.play().catch(() => console.log("Audio blocked by browser"));

        // Send signal to Notification Bell in Header
        const event = new CustomEvent("tracking-reminder-alert", {
          detail: {
            missingCount: missing.length,
            time: Date.now(),
            text: reminderText,
          },
        });
        window.dispatchEvent(event);

        // Hide local toast after 8 seconds
        setTimeout(() => setShowReminderToast(false), 8000);
      }
    };

    checkReminder();
    const timer = setInterval(checkReminder, 30000); // Check every 30s
    return () => clearInterval(timer);
  }, [isAdminOrLeader, isMyShiftActive, tickets, lastReminderHour]);

  // --- POST-START HANDOVER REMINDER (REPEATS EVERY MINUTE) ---
  useEffect(() => {
    const checkPostStartReminder = () => {
      // Outgoing shift users only (no admin/leader broadcast).
      if (isAdminOrLeader || !myAssignedShift || myAssignedShift === "Off") {
        return;
      }

      const now = getGMT8Time();
      const h = now.getHours();
      const m = now.getMinutes();
      const transitionCtx = getTransitionContext(now);

      // Post-start reminders begin 1 minute after the big switch and stop at hard lock.
      if (!transitionCtx || !transitionCtx.isPostStartWindow) {
        return;
      }

      const handoverPair = transitionCtx.pair;
      const isOutgoingForWindow =
        !!handoverPair && myAssignedShift === handoverPair.outgoing;

      if (!isOutgoingForWindow) {
        return;
      }

      const marker = `${transitionCtx.marker}|${dutyArray
        .slice()
        .sort()
        .join(",")}`;

      // Stop reminders for this shift once handover is completed.
      if (autoHandoverLoggedRef.current === marker) {
        return;
      }

      const minuteKey = `${h}:${String(m).padStart(2, "0")}|${marker}`;
      if (lastPostStartReminderMinuteRef.current === minuteKey) {
        return;
      }
      lastPostStartReminderMinuteRef.current = minuteKey;

      const pendingTix = tickets.filter((t) => t.status === "Pending");
      const reminderText =
        pendingTix.length > 0
          ? `Handover reminder: ${pendingTix.length} pending ticket(s) still require handover to ${handoverPair.incoming} shift.`
          : `Handover reminder: please complete your shift handover to ${handoverPair.incoming} shift.`;

      setReminderToast({
        title: "Handover Required",
        text: reminderText,
      });
      setShowReminderToast(true);

      const audio = new Audio(notificationSound);
      audio.play().catch(() => console.log("Audio blocked by browser"));

      window.dispatchEvent(
        new CustomEvent("tracking-reminder-alert", {
          detail: {
            missingCount: 0,
            time: Date.now(),
            text: reminderText,
          },
        }),
      );

      setTimeout(() => setShowReminderToast(false), 8000);
    };

    checkPostStartReminder();
    const timer = setInterval(checkPostStartReminder, 30000);
    return () => clearInterval(timer);
  }, [isAdminOrLeader, myAssignedShift, dutyArray, tickets]);

  // --- WINDOW HANDOVER COMPLETION STATUS (CONTROLS INCOMING VISIBILITY) ---
  useEffect(() => {
    let isMounted = true;

    const refreshWindowHandoverStatus = async () => {
      const transitionCtx = getTransitionContext();

      if (!transitionCtx || !myAssignedShift || myAssignedShift === "Off") {
        if (isMounted) setHandoverCompletedForCurrentWindow(false);
        return;
      }

      const marker = `${transitionCtx.marker}|${dutyArray
        .slice()
        .sort()
        .join(",")}`;

      // Immediate local truth for outgoing user after manual/auto handover.
      if (autoHandoverLoggedRef.current === marker) {
        if (isMounted) setHandoverCompletedForCurrentWindow(true);
        return;
      }

      const { data, error } = await supabase
        .from("shift_notifications")
        .select("id, duties")
        .eq("target_shift", transitionCtx.pair.incoming)
        .gte("created_at", transitionCtx.windowStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        if (isMounted) setHandoverCompletedForCurrentWindow(false);
        return;
      }

      const hasMatchingHandover = (data || []).some((row) => {
        if (!Array.isArray(row.duties) || row.duties.length === 0) return true;
        if (dutyArray.length === 0) return true;
        return row.duties.some((d) => dutyArray.includes(d));
      });

      if (isMounted) {
        setHandoverCompletedForCurrentWindow(hasMatchingHandover);
      }
    };

    refreshWindowHandoverStatus();
    const timer = setInterval(refreshWindowHandoverStatus, 30000);

    const channel = supabase
      .channel(`handover-window-status-${user?.id || "anon"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "shift_notifications" },
        () => {
          refreshWindowHandoverStatus();
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [dutyArray, myAssignedShift, user?.id]);

  // --- HARD-LOCK WARNING (10 MINUTES BEFORE OUTGOING LOCKOUT) ---
  useEffect(() => {
    const checkHardLockWarning = () => {
      if (isAdminOrLeader || !myAssignedShift || myAssignedShift === "Off") {
        return;
      }

      const now = getGMT8Time();
      const h = now.getHours();
      const m = now.getMinutes();
      const transitionCtx = getTransitionContext(now);

      if (!transitionCtx || !transitionCtx.isSharedWindow) return;
      if (myAssignedShift !== transitionCtx.pair.outgoing) return;
      if (
        h !== transitionCtx.lockWarningHour ||
        m !== transitionCtx.lockWarningMinute
      ) {
        return;
      }

      const warningMarker = `${transitionCtx.marker}|lock-warning|${dutyArray
        .slice()
        .sort()
        .join(",")}`;
      if (lockWarningMarkerRef.current === warningMarker) return;
      lockWarningMarkerRef.current = warningMarker;

      const reminderText =
        "Shift lock in 10 minutes. Finalize remaining work now before visibility is revoked.";

      setReminderToast({
        title: "Shift Lock Warning",
        text: reminderText,
      });
      setShowReminderToast(true);

      const audio = new Audio(notificationSound);
      audio.play().catch(() => console.log("Audio blocked by browser"));

      window.dispatchEvent(
        new CustomEvent("tracking-reminder-alert", {
          detail: {
            missingCount: 0,
            time: Date.now(),
            text: reminderText,
          },
        }),
      );

      setTimeout(() => setShowReminderToast(false), 8000);
    };

    checkHardLockWarning();
    const timer = setInterval(checkHardLockWarning, 30000);
    return () => clearInterval(timer);
  }, [isAdminOrLeader, myAssignedShift, dutyArray]);

  // --- AUTO-CLEAR BELL REMINDER IF FIXED ---
  useEffect(() => {
    const pendingTix = tickets.filter((t) => t.status === "Pending");
    const missing = pendingTix.filter(
      (t) =>
        !t.tracking_no || t.tracking_no === "-" || t.tracking_no.trim() === "",
    );
    if (missing.length === 0) {
      window.dispatchEvent(new CustomEvent("clear-tracking-reminder"));
    }
  }, [tickets]);

  // --- LISTEN FOR TRANSFER HANDSHAKE RESPONSES ---
  useEffect(() => {
    if (transferResponse) {
      if (transferResponse.status === "accepted") {
        setDuty((prev) => {
          if (!prev) return [];
          return prev.filter((d) => !transferResponse.duties.includes(d));
        });
      }
      setTransferStatuses((prev) => {
        const next = { ...prev };
        transferResponse.duties.forEach((d) => {
          next[d] = transferResponse.status;
        });
        return next;
      });
    }
  }, [transferResponse, setDuty]);

  const handleOpenTransfer = () => {
    resetTransferResponse();
    setTransferAssignments({});
    setTransferStatuses({});
    setTransferModal({ isOpen: true, step: "select" });
  };

  const handleSendAll = () => {
    const targets = {};
    let hasSelection = false;

    Object.entries(transferAssignments).forEach(([duty, targetUserId]) => {
      if (targetUserId) {
        if (!targets[targetUserId]) targets[targetUserId] = [];
        targets[targetUserId].push(duty);
        hasSelection = true;
      }
    });

    if (!hasSelection) {
      alert("Please assign at least one duty to a teammate.");
      return;
    }

    const newStatuses = { ...transferStatuses };
    Object.entries(targets).forEach(([targetUserId, dutiesToTransfer]) => {
      dutiesToTransfer.forEach((d) => (newStatuses[d] = "waiting"));
      sendTransferRequest(targetUserId, dutiesToTransfer);
    });

    setTransferStatuses(newStatuses);
    setTransferModal({ isOpen: true, step: "tracking" });
  };

  // --- THE "LAZY" AUTO-SWEEPER ---
  useEffect(() => {
    const performLazySweep = async () => {
      if (!tickets || tickets.length === 0) return;
      const lastShiftStart = getLastShiftChangeTime();

      const oldCompletedTickets = tickets.filter(
        (t) =>
          t.status !== "Pending" && new Date(t.created_at) < lastShiftStart,
      );

      if (oldCompletedTickets.length > 0) {
        const idsToArchive = oldCompletedTickets.map((t) => t.id);
        await supabase
          .from("tickets")
          .update({ is_archived: true })
          .in("id", idsToArchive);
      }
    };

    performLazySweep();
    const interval = setInterval(performLazySweep, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [tickets]);

  const appendHandoverTicketsToSheet = useCallback(
    async (handoverTickets) => {
      if (!handoverTickets || handoverTickets.length === 0) return;

      try {
        await supabase.functions.invoke("sync-sheets", {
          body: {
            action: "APPEND",
            tickets: handoverTickets,
            handoverBy: shortWorkName,
          },
        });
      } catch (e) {
        console.error("Sheet Handover Error:", e);
      }
    },
    [shortWorkName],
  );

  const syncHandoverAndNotify = useCallback(
    async (pendingTix, mode = "Manual") => {
      const marker = buildHandoverMarker();
      const handedOverSet =
        handedOverTicketIdsByMarkerRef.current.get(marker) || new Set();
      const uniquePendingTix = pendingTix.filter(
        (t) => !handedOverSet.has(t.id),
      );

      // Stop duplicate appends/notifications when handover is clicked repeatedly.
      if (uniquePendingTix.length === 0) {
        return { skipped: true, count: 0, marker };
      }

      const nextShift = getNextShift(currentActiveShift);
      const msg = `${shortWorkName} completed ${mode.toLowerCase()} handover for ${dutyArray.join(", ")}. ${uniquePendingTix.length} pending ticket(s) handed over successfully.`;

      await supabase.from("shift_notifications").insert({
        target_shift: nextShift,
        message: msg,
        duties: dutyArray,
      });

      const completedIds = tickets
        .filter((t) => t.status !== "Pending")
        .map((t) => t.id);

      if (completedIds.length > 0) {
        await supabase
          .from("tickets")
          .update({ is_archived: true })
          .in("id", completedIds);
      }

      await appendHandoverTicketsToSheet(uniquePendingTix);

      uniquePendingTix.forEach((t) => handedOverSet.add(t.id));
      handedOverTicketIdsByMarkerRef.current.set(marker, handedOverSet);

      window.dispatchEvent(
        new CustomEvent("handover-completed", {
          detail: {
            mode,
            duties: dutyArray,
            at: Date.now(),
          },
        }),
      );

      return { skipped: false, count: uniquePendingTix.length, marker };
    },
    [
      appendHandoverTicketsToSheet,
      buildHandoverMarker,
      currentActiveShift,
      dutyArray,
      shortWorkName,
      tickets,
    ],
  );

  useEffect(() => {
    const attemptAutoHandover = () => {
      const transitionCtx = getTransitionContext();
      if (!transitionCtx || !transitionCtx.isPostStartWindow) {
        return;
      }

      const isOutgoingShift =
        !!myAssignedShift && myAssignedShift === transitionCtx.pair.outgoing;

      if (isAdminOrLeader || !isOutgoingShift || dutyArray.length === 0) {
        return;
      }

      const pendingTix = tickets.filter((t) => t.status === "Pending");
      if (pendingTix.length === 0) return;

      const marker = buildHandoverMarker();
      if (autoHandoverLoggedRef.current === marker) return;
      autoHandoverLoggedRef.current = marker;

      syncHandoverAndNotify(pendingTix, "Auto");
    };

    attemptAutoHandover();
    const timer = setInterval(attemptAutoHandover, 30000);
    return () => clearInterval(timer);
  }, [
    myAssignedShift,
    currentActiveShift,
    isAdminOrLeader,
    tickets,
    dutyArray,
    syncHandoverAndNotify,
    buildHandoverMarker,
  ]);

  // --- HANDOVER WORKFLOW (Reporting & Cleaning) ---
  const checkHandoverEligibility = () => {
    if (isHandoverProcessing) return;

    const pendingTix = tickets.filter((t) => t.status === "Pending");
    const missing = pendingTix.filter(
      (t) =>
        !t.tracking_no || t.tracking_no === "-" || t.tracking_no.trim() === "",
    );

    if (missing.length > 0) {
      setHandoverModal({
        isOpen: true,
        step: "check",
        missingTickets: missing,
      });
    } else {
      processHandover();
    }
  };

  const processHandover = async () => {
    const isWindow = checkIsHandoverWindow();
    if (!isWindow) {
      setHandoverModal({
        isOpen: true,
        step: "early_warning",
        missingTickets: [],
      });
    } else {
      executeHandover();
    }
  };

  const executeHandover = async () => {
    if (isHandoverProcessing) return;
    setIsHandoverProcessing(true);

    // Set marker BEFORE the async DB operations so that realtime ticket
    // updates arriving during the await don't retrigger the reminder check.
    const marker = buildHandoverMarker();
    autoHandoverLoggedRef.current = marker;

    try {
      const pendingTix = tickets.filter((t) => t.status === "Pending");
      await syncHandoverAndNotify(pendingTix, "Manual");

      setHandoverModal({
        isOpen: true,
        step: "shift_done",
        missingTickets: [],
      });
    } catch (e) {
      // Handover failed — clear marker so reminders resume correctly.
      autoHandoverLoggedRef.current = "";
      console.error("Handover execute error:", e);
    } finally {
      setIsHandoverProcessing(false);
    }
  };

  const handleSendNote = () => {
    if (newNoteText.trim() === "") return;
    onAddNote(selectedTicketForNotes.id, newNoteText);
    setNewNoteText("");
  };

  const activeNotes = selectedTicketForNotes
    ? tickets.find((t) => t.id === selectedTicketForNotes.id)?.notes || []
    : [];

  const transitionCtx = getTransitionContext();
  const handoverPair = getHandoverShiftPair();
  const isInSharedZone = !!transitionCtx && transitionCtx.isSharedWindow;
  const isInManualWindow = !!transitionCtx && transitionCtx.isManualWindow;

  const isOutgoingTransitionViewer =
    !!handoverPair &&
    (isInManualWindow || isInSharedZone) &&
    myAssignedShift === handoverPair.outgoing;

  const isIncomingTransitionViewer =
    !!handoverPair &&
    (isInManualWindow || isInSharedZone) &&
    myAssignedShift === handoverPair.incoming &&
    handoverCompletedForCurrentWindow;

  const shouldHoldIncomingViewUntilHandover =
    !!handoverPair &&
    isInSharedZone &&
    myAssignedShift === handoverPair.incoming &&
    !handoverCompletedForCurrentWindow;

  const canViewTickets =
    (isMyShiftActive && !shouldHoldIncomingViewUntilHandover) ||
    isOutgoingTransitionViewer ||
    isIncomingTransitionViewer ||
    isAdminOrLeader;

  const filteredTickets = tickets.filter((ticket) => {
    if (!canViewTickets) return false;

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      const matches =
        (ticket.member_id &&
          ticket.member_id.toLowerCase().includes(lowerSearch)) ||
        (ticket.provider_account &&
          ticket.provider_account.toLowerCase().includes(lowerSearch)) ||
        (ticket.tracking_no &&
          ticket.tracking_no.toLowerCase().includes(lowerSearch));
      if (!matches) return false;
    }
    return true;
  });

  const getGeneratedScript = () => {
    const { type, abnormalType, ticket } = completeModal;
    if (type === "Normal") {
      return `Hi sir as we checked, the member bet is normal in provider ${ticket?.provider || "-"}. Thank you - ${shortWorkName}.`;
    } else {
      return `Hello team, this is ${shortWorkName}. Please refer to the below information from provider, Thank You.\n\nAnnouncement：【${ticket?.provider || "Provider"}】 confirm this member is【${abnormalType.toUpperCase()}】,you may decide whether to let member withdrawal or not, the decision is rest in your hand, thank you, sir.\n\nmember：${ticket?.member_id || "Unknown"}`;
    }
  };

  const handleCopyAndComplete = () => {
    const script = getGeneratedScript();
    navigator.clipboard.writeText(script);

    const finalStatus =
      completeModal.type === "Normal"
        ? "Normal"
        : completeModal.abnormalType.toUpperCase();
    const targetTicketId = completeModal.ticket.id;

    // Update inside your RiskOps Database
    onUpdateTicket(targetTicketId, "status", finalStatus);

    setCompleteModal({
      isOpen: false,
      ticket: null,
      step: "select",
      type: "",
      abnormalType: "",
    });
  };

  const getDynamicBannerText = () => {
    if (!currentActiveShift || dutyArray.includes("IC0")) return null;

    const dutyStatus = [];
    const userDutyMap = {};

    dutyArray.forEach((duty) => {
      const activeUser = onlineUsers.find(
        (ou) =>
          ou.duties?.includes(duty) &&
          activeRoster[ou.workName] === currentActiveShift,
      );
      if (activeUser) {
        if (!userDutyMap[activeUser.workName]) {
          userDutyMap[activeUser.workName] = [];
        }
        userDutyMap[activeUser.workName].push(duty);
      }
    });

    Object.keys(userDutyMap).forEach((userName) => {
      const duties = userDutyMap[userName];
      const dutyStr = duties.length > 1 ? duties.join(" and ") : duties[0];
      dutyStatus.push(`${userName} is working on ${dutyStr}`);
    });

    let statusText = "";
    if (dutyStatus.length === 1) statusText = dutyStatus[0];
    else if (dutyStatus.length === 2)
      statusText = `${dutyStatus[0]}, and ${dutyStatus[1]}`;
    else if (dutyStatus.length > 2)
      statusText =
        dutyStatus.slice(0, -1).join(", ") +
        ", and " +
        dutyStatus[dutyStatus.length - 1];

    if (statusText)
      return `It is currently the ${currentActiveShift} shift. ${statusText}. Please wait for them to handover.`;
    else
      return `It is currently the ${currentActiveShift} shift. Please wait for the assigned shift workers to handover.`;
  };

  const getSharedViewingText = () => {
    if (dutyArray.includes("IC0") || dutyArray.length === 0) return null;

    const sharedViewingMap = {};

    dutyArray.forEach((duty) => {
      onlineUsers.forEach((ou) => {
        if (
          ou.id !== user?.id &&
          ou.duties?.includes(duty) &&
          activeRoster[ou.workName] === currentActiveShift
        ) {
          if (!sharedViewingMap[ou.workName])
            sharedViewingMap[ou.workName] = [];
          sharedViewingMap[ou.workName].push(duty);
        }
      });
    });

    const userStrings = Object.keys(sharedViewingMap).map((userName) => {
      const duties = sharedViewingMap[userName];
      const dutyStr = duties.length > 1 ? duties.join(" and ") : duties[0];
      return `${userName} (${dutyStr})`;
    });

    if (userStrings.length === 0) return null;

    let combinedString = "";
    if (userStrings.length === 1) combinedString = userStrings[0];
    else if (userStrings.length === 2)
      combinedString = `${userStrings[0]} and ${userStrings[1]}`;
    else
      combinedString =
        userStrings.slice(0, -1).join(", ") +
        ", and " +
        userStrings[userStrings.length - 1];

    return `${combinedString} ${Object.keys(sharedViewingMap).length > 1 ? "are" : "is"} also viewing this duty.`;
  };

  let displayTitle = "Active Investigations";
  if (!dutyArray.includes("IC0") && dutyArray.length > 0) {
    const nums = dutyArray.map((d) => d.replace("IC", "").padStart(2, "0"));
    let formattedNums = "";
    if (nums.length === 1) formattedNums = nums[0];
    else if (nums.length === 2) formattedNums = nums.join(" & ");
    else
      formattedNums = `${nums.slice(0, -1).join(", ")} & ${nums[nums.length - 1]}`;
    displayTitle = `Active Investigations for IC Duty ${formattedNums}`;
  }

  const showDutyColumn = dutyArray.includes("IC0") || dutyArray.length > 1;
  const isOutgoingForWindow =
    !!handoverPair && myAssignedShift === handoverPair.outgoing;
  // CHECK REAL-TIME window instead of stale state (updates every 60s), to avoid button disable race condition.
  const isActuallyInWindow = checkIsHandoverWindow();
  const canInitiateHandover =
    isAdminOrLeader || (isActuallyInWindow && isOutgoingForWindow);
  const isHandoverDisabled =
    !canInitiateHandover || !isActuallyInWindow || isHandoverProcessing;

  let handoverTooltip = "Handover Shift";
  if (!isActuallyInWindow)
    handoverTooltip =
      "Only available during manual handover window (06:45-07:10, 14:15-14:40, 22:15-22:40).";
  else if (!isOutgoingForWindow && !isAdminOrLeader)
    handoverTooltip = "Only the outgoing shift can handover in this window.";

  const availableUsersToTransfer = onlineUsers.filter(
    (u) => u.id && u.id !== user?.id,
  );

  return (
    <main className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden relative">
      {/* --- NEW: TRACKING ID REMINDER TOAST --- */}
      {showReminderToast && (
        <div className="fixed bottom-8 right-8 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-amber-500 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-start gap-3 border border-amber-400 max-w-[320px]">
            <div className="bg-amber-600 p-1.5 rounded-full shrink-0 mt-0.5 shadow-inner">
              <AlertTriangle size={18} className="text-amber-50" />
            </div>
            <div>
              <h4 className="font-bold text-sm mb-0.5">
                {reminderToast.title}
              </h4>
              <p className="text-xs font-medium text-amber-50 leading-snug">
                {reminderToast.text}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-slate-900">{displayTitle}</h2>
        </div>

        <div className="flex items-center gap-2">
          {(isMyShiftActive || isAdminOrLeader) && (
            <div
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg shadow-sm"
              title="Database Connection Active"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                ONLINE
              </span>
            </div>
          )}

          {/* --- NEW: ABNORMAL SCRIPT GENERATOR BUTTON --- */}
          {(isMyShiftActive || isAdminOrLeader) && (
            <button
              onClick={() =>
                setAbnormalModalState({
                  isOpen: true,
                  provider: "",
                  memberId: "",
                  abnormalType: "",
                })
              }
              className="p-2 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg shadow-sm transition-colors border border-slate-200 ml-1"
              title="Generate Abnormal Script"
            >
              <FileWarning size={16} />
            </button>
          )}

          {/* --- NEW: FOLLOW-UP SCRIPTS BUTTON --- */}
          {!dutyArray.includes("IC0") &&
            (isMyShiftActive || isAdminOrLeader) && (
              <button
                onClick={() => setFollowUpModal(true)}
                className="p-2 bg-white hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-lg shadow-sm transition-colors border border-slate-200 ml-1"
                title="Bulk Follow-up Scripts"
              >
                <Megaphone size={16} />
              </button>
            )}

          {!dutyArray.includes("IC0") &&
            (isMyShiftActive || isAdminOrLeader) && (
              <button
                onClick={handleOpenTransfer}
                className="p-2 bg-white hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-lg shadow-sm transition-colors border border-slate-200 ml-1"
                title="Transfer Duty to Teammate"
              >
                <Send size={16} />
              </button>
            )}

          {!dutyArray.includes("IC0") && (
            <button
              onClick={checkHandoverEligibility}
              disabled={isHandoverDisabled}
              className={`p-2 rounded-lg shadow-sm transition-colors border ml-1 ${
                !isHandoverDisabled
                  ? "bg-amber-50 hover:bg-amber-100 text-amber-600 border-amber-200 cursor-pointer"
                  : "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
              }`}
              title={handoverTooltip}
            >
              <Handshake size={16} />
            </button>
          )}

          <div className="relative ml-2">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm w-56 md:w-64 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full p-0.5 transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {!dutyArray.includes("IC0") &&
        !canViewTickets &&
        currentActiveShift &&
        !isAdminOrLeader && (
          <div className="mx-6 mt-4 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 text-indigo-700">
            <Info size={18} className="shrink-0" />
            <div>
              <p className="text-[13px] font-medium leading-relaxed">
                {getDynamicBannerText()}
              </p>
            </div>
          </div>
        )}

      {(isMyShiftActive || isAdminOrLeader) && getSharedViewingText() && (
        <div className="mx-6 mt-4 p-3 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 text-blue-700">
          <Users size={18} className="shrink-0" />
          <div>
            <p className="text-[13px] font-medium leading-relaxed">
              <strong>Collaboration Notice:</strong> {getSharedViewingText()}
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto bg-slate-50 mt-4">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead className="bg-white sticky top-0 z-10 font-semibold text-slate-500 uppercase tracking-wide text-[10px]">
            <tr className="border-b border-slate-200">
              {showDutyColumn && <th className="px-4 py-3">Duty</th>}
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Merchant ID</th>
              <th className="px-4 py-3">Login ID</th>
              <th className="px-4 py-3">Player ID</th>
              <th className="px-4 py-3">Provider Account</th>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Tracking No.</th>
              <th className="px-4 py-3">Recorder</th>
              <th className="px-4 py-3 text-center">Audit Notes</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs bg-white">
            {filteredTickets.length === 0 ? (
              <tr>
                <td
                  colSpan={showDutyColumn ? "12" : "11"}
                  className="px-6 py-12 text-center text-slate-400"
                >
                  {!canViewTickets
                    ? "Waiting for the previous shift to handover..."
                    : searchTerm
                      ? `No tickets found matching "${searchTerm}"`
                      : "No active investigations found."}
                </td>
              </tr>
            ) : (
              filteredTickets.map((ticket) => {
                const isCompleted = ticket.status !== "Pending";

                return (
                  <tr
                    key={ticket.id}
                    className="hover:bg-slate-50 group transition-colors"
                  >
                    {showDutyColumn && (
                      <td className="px-4 py-3">
                        <span
                          className={`font-bold text-[11px] uppercase tracking-wider ${getDutyTextColor(ticket.ic_account)}`}
                        >
                          {ticket.ic_account}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(ticket.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-700">
                      {ticket.member_id && ticket.member_id.includes("@")
                        ? ticket.member_id.split("@")[1]
                        : "-"}
                    </td>
                    <td className="px-4 py-2">
                      <EditableField
                        ticket={ticket}
                        fieldKey="login_id"
                        placeholder="Login ID"
                        addText="+ Add Login"
                        onUpdateTicket={onUpdateTicket}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <EditableField
                        ticket={ticket}
                        fieldKey="member_id"
                        placeholder="Player ID"
                        addText="+ Add Player"
                        onUpdateTicket={onUpdateTicket}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <EditableField
                        ticket={ticket}
                        fieldKey="provider_account"
                        placeholder="Account"
                        addText="+ Add Acc"
                        onUpdateTicket={onUpdateTicket}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {ticket.provider}
                    </td>
                    <td className="px-4 py-2">
                      <EditableField
                        ticket={ticket}
                        fieldKey="tracking_no"
                        placeholder="Track No."
                        addText="+ Add ID"
                        onUpdateTicket={onUpdateTicket}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {ticket.recorder}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => setSelectedTicketForNotes(ticket)}
                        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all shadow-sm border ${ticket.notes && ticket.notes.length > 0 ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}
                      >
                        <MessageCircle
                          size={14}
                          className={
                            ticket.notes && ticket.notes.length > 0
                              ? "text-indigo-600"
                              : "text-slate-400"
                          }
                        />
                        {ticket.notes && ticket.notes.length > 0
                          ? `${ticket.notes.length} Messages`
                          : "Open Chat"}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${!isCompleted ? "bg-amber-50 text-amber-700 border-amber-200" : ticket.status === "Normal" || ticket.status === "NORMAL" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}
                      >
                        {!isCompleted ? "Wait for provider" : ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      {deletingRowId === ticket.id ? (
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500">
                            Delete?
                          </span>
                          <button
                            onClick={() => {
                              if (onDeleteTicket) onDeleteTicket(ticket.id);
                              setDeletingRowId(null);
                            }}
                            className="px-2 py-1 text-[10px] font-bold bg-rose-500 text-white hover:bg-rose-600 rounded transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setDeletingRowId(null)}
                            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-3">
                          {!isCompleted && (
                            <button
                              onClick={() => {
                                setCompleteModal({
                                  isOpen: true,
                                  ticket: ticket,
                                  step: "select",
                                  type: "",
                                  abnormalType: "",
                                });
                                setDeletingRowId(null);
                              }}
                              className="text-emerald-500 hover:text-emerald-600 transition-colors"
                              title="Complete Ticket"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setDeletingRowId(ticket.id);
                            }}
                            disabled={isCompleted}
                            className={`transition-colors ${isCompleted ? "text-slate-200 cursor-not-allowed" : "text-slate-400 hover:text-rose-500"}`}
                            title={
                              isCompleted
                                ? "Cannot delete completed ticket"
                                : "Delete Ticket"
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODALS RETAINED EXACTLY THE SAME... */}
      {transferModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200 p-4">
          <div className="bg-white w-[450px] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            {transferModal.step === "select" && (
              <>
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Users size={18} className="text-indigo-600" /> Transfer
                    Duties
                  </h3>
                  <button
                    onClick={() =>
                      setTransferModal({ isOpen: false, step: "select" })
                    }
                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="p-6">
                  <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                    Assign the duties you want to transfer to your online
                    teammates.
                  </p>
                  <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-1">
                    {dutyArray.map((duty) => (
                      <div
                        key={duty}
                        className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2.5 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider ${getDutyTextColor(duty)} bg-slate-50 border border-slate-100`}
                          >
                            {duty}
                          </span>
                        </div>
                        <div className="relative">
                          <select
                            value={transferAssignments[duty] || ""}
                            onChange={(e) =>
                              setTransferAssignments((prev) => ({
                                ...prev,
                                [duty]: e.target.value,
                              }))
                            }
                            className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all cursor-pointer w-[180px]"
                          >
                            <option value="">-- Keep Duty --</option>
                            {availableUsersToTransfer.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.workName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleSendAll}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
                  >
                    Send Transfer Requests <ArrowRight size={16} />
                  </button>
                </div>
              </>
            )}
            {transferModal.step === "tracking" && (
              <>
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <ArrowRightLeft size={18} className="text-indigo-600" />{" "}
                    Live Transfer Status
                  </h3>
                  <button
                    onClick={() =>
                      setTransferModal({ isOpen: false, step: "select" })
                    }
                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="p-6">
                  <p className="text-xs text-slate-500 mb-6 font-medium">
                    Tracking requests sent to your teammates. Accepted duties
                    will automatically close in the background.
                  </p>
                  <div className="space-y-3 mb-8">
                    {dutyArray
                      .filter((d) => transferAssignments[d])
                      .map((duty) => {
                        const targetId = transferAssignments[duty];
                        const targetName =
                          onlineUsers.find((u) => u.id === targetId)
                            ?.workName || "Unknown User";
                        const status = transferStatuses[duty] || "waiting";
                        return (
                          <div
                            key={duty}
                            className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] font-bold text-slate-800">
                                {duty}
                              </span>
                              <ArrowRight
                                size={14}
                                className="text-slate-300"
                              />
                              <span className="text-[12px] font-bold text-indigo-700">
                                {targetName}
                              </span>
                            </div>
                            <div className="flex items-center">
                              {status === "waiting" && (
                                <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-100">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                  </span>{" "}
                                  Waiting...
                                </span>
                              )}
                              {status === "accepted" && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                                  <CheckCircle2 size={12} /> Accepted
                                </span>
                              )}
                              {status === "declined" && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100">
                                  <X size={12} /> Declined
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  <button
                    onClick={() =>
                      setTransferModal({ isOpen: false, step: "select" })
                    }
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors"
                  >
                    Close Dashboard
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {handoverModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white w-[450px] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {handoverModal.step === "check" && (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4 text-amber-600">
                  <AlertTriangle size={24} />
                  <h3 className="text-lg font-bold text-slate-800">
                    Missing Information
                  </h3>
                </div>
                <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                  You have pending tickets missing a Tracking Number. It is
                  highly recommended to fill these before handing over the
                  shift:
                </p>
                <div className="max-h-32 overflow-y-auto bg-slate-50 rounded-lg p-3 border border-slate-200 mb-6 space-y-2">
                  {handoverModal.missingTickets.map((t) => (
                    <div
                      key={t.id}
                      className="text-xs font-mono text-slate-700 flex items-center justify-between"
                    >
                      <span>
                        Player:{" "}
                        <span className="font-bold text-indigo-600">
                          {t.member_id}
                        </span>
                      </span>
                      <span className="text-slate-400">{t.provider}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      setHandoverModal({
                        isOpen: false,
                        step: "",
                        missingTickets: [],
                      })
                    }
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-lg transition-colors"
                  >
                    Go Back to Fix
                  </button>
                  <button
                    onClick={processHandover}
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-lg transition-colors"
                  >
                    Handover Anyway
                  </button>
                </div>
              </div>
            )}
            {handoverModal.step === "early_warning" && (
              <div className="p-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 mb-4">
                  <ArrowRightLeft size={24} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">
                  Early Handover
                </h3>
                <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                  You are generating a handover report outside the standard
                  shift change times. Are you sure you want to proceed?
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      setHandoverModal({
                        isOpen: false,
                        step: "",
                        missingTickets: [],
                      })
                    }
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeHandover}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors"
                  >
                    Proceed
                  </button>
                </div>
              </div>
            )}
            {handoverModal.step === "shift_done" && (
              <div className="p-8 text-center animate-in zoom-in-95">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 text-slate-500 mb-4">
                  <LogOut size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                  Handover Completed
                </h3>
                <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                  Your handover has been sent securely to the incoming team. You
                  may continue viewing during the handover grace window.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      setHandoverModal({
                        isOpen: false,
                        step: "",
                        missingTickets: [],
                      })
                    }
                    className="flex-1 py-3 bg-slate-900 hover:bg-black text-white text-sm font-bold rounded-lg transition-colors"
                  >
                    Continue
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-lg transition-colors"
                  >
                    Return to Login
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedTicketForNotes && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-slate-50 w-[400px] h-[550px] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div
              className={`px-5 py-4 ${getDutyHeaderBg(selectedTicketForNotes.ic_account)} flex items-center justify-between text-white shadow-md z-10 transition-colors`}
            >
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <MessageCircle size={16} /> Investigation Notes
                </h3>
                <p className="text-[11px] font-medium text-white/80 mt-1">
                  Player: {selectedTicketForNotes.member_id}
                </p>
              </div>
              <button
                onClick={() => setSelectedTicketForNotes(null)}
                className="p-1.5 bg-black/10 hover:bg-black/20 rounded-full transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {activeNotes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                  <MessageCircle size={32} className="text-slate-400 mb-2" />
                  <p className="text-xs text-slate-500 font-medium">
                    No notes yet.
                    <br />
                    Be the first to leave an update!
                  </p>
                </div>
              ) : (
                activeNotes.map((note, idx) => {
                  const isEditing = editingNoteState.ticketId === selectedTicketForNotes.id && editingNoteState.noteIndex === idx;
                  const canEdit = canEditNote(note);
                  const canDelete = canDeleteNote(note);
                  
                  return (
                    <div
                      key={idx}
                      className="flex flex-col items-start w-full animate-in slide-in-from-bottom-2 duration-300"
                    >
                      <div className="flex items-center gap-2 mb-1 ml-2">
                        <span className="text-[10px] font-bold text-slate-600">
                          {note.author}
                        </span>
                        <span className="text-[9px] font-medium text-slate-400">
                          {note.timestamp}
                        </span>
                        {note.isEdited && (
                          <span className="text-[8px] text-slate-400 italic">(edited)</span>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="bg-white border-2 border-blue-400 shadow-sm rounded-2xl rounded-tl-sm max-w-[85%] p-2.5 flex gap-2 items-end">
                          <textarea
                            value={editingNoteState.text}
                            onChange={(e) => setEditingNoteState({ ...editingNoteState, text: e.target.value })}
                            className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                            rows="2"
                            autoFocus
                          />
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                onEditNote(selectedTicketForNotes.id, idx, editingNoteState.text);
                                setEditingNoteState({ ticketId: null, noteIndex: null, text: "" });
                              }}
                              className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
                              title="Save edit"
                            >
                              <CheckCircle2 size={14} />
                            </button>
                            <button
                              onClick={() => setEditingNoteState({ ticketId: null, noteIndex: null, text: "" })}
                              className="p-1.5 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded transition-colors"
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 group">
                          <div className="bg-white border border-slate-200 shadow-sm text-slate-700 text-xs px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-[85%] leading-relaxed">
                            {note.text}
                          </div>
                          {(canEdit || canDelete) && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-1">
                              {canEdit && (
                                <button
                                  onClick={() => setEditingNoteState({ ticketId: selectedTicketForNotes.id, noteIndex: idx, text: note.text })}
                                  className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded transition-colors"
                                  title="Edit note (3 hours window)"
                                >
                                  <Edit2 size={12} />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => {
                                    if (confirm("Delete this note?")) {
                                      onDeleteNote(selectedTicketForNotes.id, idx);
                                    }
                                  }}
                                  className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded transition-colors"
                                  title="Delete note"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div className="p-4 bg-white border-t border-slate-200">
              <div className="relative flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Type a note..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendNote()}
                  className={`flex-1 pl-4 pr-10 py-2.5 bg-slate-100 border border-slate-200 rounded-full text-xs outline-none focus:bg-white focus:ring-4 transition-all ${getDutyBorderRing(selectedTicketForNotes.ic_account)}`}
                  autoFocus
                />
                <button
                  onClick={handleSendNote}
                  className={`absolute right-1.5 p-1.5 rounded-full transition-colors flex items-center justify-center ${newNoteText.trim() ? `${getDutyButton(selectedTicketForNotes.ic_account)} text-white shadow-md` : "bg-slate-200 text-slate-400"}`}
                >
                  <Send
                    size={14}
                    className={newNoteText.trim() ? "ml-0.5" : ""}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {completeModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white w-[420px] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-500" /> Complete
                Investigation
              </h3>
              <button
                onClick={() =>
                  setCompleteModal({
                    isOpen: false,
                    ticket: null,
                    step: "select",
                    type: "",
                    abnormalType: "",
                  })
                }
                className="p-1 text-slate-400 hover:text-slate-600 bg-slate-200/50 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6">
              {completeModal.step === "select" && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-slate-700 mb-2">
                      How should this ticket be completed?
                    </p>
                    <button
                      onClick={() =>
                        setCompleteModal({
                          ...completeModal,
                          type: "Normal",
                          step: "script",
                        })
                      }
                      className="w-full flex items-center justify-between px-4 py-3 bg-white border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 rounded-xl transition-all group shadow-sm text-left"
                    >
                      <div>
                        <span className="block text-sm font-bold text-emerald-700 group-hover:text-emerald-800">
                          Normal
                        </span>
                        <span className="block text-xs text-emerald-600/70 mt-0.5">
                          Player bet is normal. Proceed with standard script.
                        </span>
                      </div>
                      <CheckCircle2
                        size={20}
                        className="text-emerald-400 group-hover:text-emerald-600"
                      />
                    </button>
                    <button
                      onClick={() =>
                        setCompleteModal({
                          ...completeModal,
                          type: "Abnormal",
                          step: "input-abnormal",
                        })
                      }
                      className="w-full flex items-center justify-between px-4 py-3 bg-white border border-rose-200 hover:border-rose-400 hover:bg-rose-50 rounded-xl transition-all group shadow-sm text-left"
                    >
                      <div>
                        <span className="block text-sm font-bold text-rose-700 group-hover:text-rose-800">
                          Abnormal
                        </span>
                        <span className="block text-xs text-rose-600/70 mt-0.5">
                          Require provider specific details.
                        </span>
                      </div>
                      <AlertTriangle
                        size={20}
                        className="text-rose-400 group-hover:text-rose-600"
                      />
                    </button>
                  </div>
                </div>
              )}
              {completeModal.step === "input-abnormal" && (
                <div className="space-y-5 animate-in slide-in-from-right-4">
                  <div>
                    <button
                      onClick={() =>
                        setCompleteModal({ ...completeModal, step: "select" })
                      }
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 mb-4 inline-flex items-center gap-1"
                    >
                      &larr; Back
                    </button>
                    <h4 className="text-sm font-bold text-slate-800">
                      Enter Abnormal Details
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      What kind of abnormal activity did the provider confirm?
                    </p>
                  </div>
                  <input
                    type="text"
                    autoFocus
                    value={completeModal.abnormalType}
                    onChange={(e) =>
                      setCompleteModal({
                        ...completeModal,
                        abnormalType: e.target.value,
                      })
                    }
                    placeholder="e.g., fraudulent betting, multi-accounting"
                    className="w-full px-3 py-2.5 bg-white border-2 border-indigo-200 rounded-lg text-sm outline-none focus:border-indigo-500 shadow-sm uppercase"
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        completeModal.abnormalType.trim()
                      ) {
                        setCompleteModal({ ...completeModal, step: "script" });
                      }
                    }}
                  />
                  <button
                    disabled={!completeModal.abnormalType.trim()}
                    onClick={() =>
                      setCompleteModal({ ...completeModal, step: "script" })
                    }
                    className="w-full py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg disabled:opacity-50 hover:bg-indigo-700 transition-colors"
                  >
                    Generate Script
                  </button>
                </div>
              )}
              {completeModal.step === "script" && (
                <div className="space-y-5 animate-in slide-in-from-right-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() =>
                        setCompleteModal({
                          ...completeModal,
                          step:
                            completeModal.type === "Normal"
                              ? "select"
                              : "input-abnormal",
                        })
                      }
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                    >
                      &larr; Back
                    </button>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${completeModal.type === "Normal" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
                    >
                      {completeModal.type} Script
                    </span>
                  </div>
                  <div className="relative group">
                    <textarea
                      readOnly
                      value={getGeneratedScript()}
                      className="w-full h-36 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-mono resize-none focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors leading-relaxed"
                    />
                  </div>
                  <button
                    onClick={handleCopyAndComplete}
                    className="w-full py-3 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    <Copy size={16} /> Copy Script & Mark Completed
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* --- FOLLOW-UP SCRIPTS MODAL --- */}
      {followUpModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200 p-4">
          <div className="bg-white w-[450px] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Megaphone size={18} className="text-indigo-600" /> Follow-up
                Scripts
              </h3>
              <button
                onClick={() => setFollowUpModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto bg-slate-50/50">
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                Generate bulk follow-up scripts for pending tickets by provider.
              </p>

              {(() => {
                const pendingTix = tickets.filter(
                  (t) => t.status === "Pending",
                );
                if (pendingTix.length === 0) {
                  return (
                    <p className="text-xs text-slate-400 italic text-center py-6 bg-white border border-slate-200 rounded-xl">
                      No pending tickets found.
                    </p>
                  );
                }

                const grouped = {};
                pendingTix.forEach((t) => {
                  if (!grouped[t.provider])
                    grouped[t.provider] = { valid: [], missingCount: 0 };
                  if (
                    !t.tracking_no ||
                    t.tracking_no === "-" ||
                    t.tracking_no.trim() === ""
                  ) {
                    grouped[t.provider].missingCount++;
                  } else {
                    grouped[t.provider].valid.push(t.tracking_no);
                  }
                });

                return (
                  <div className="space-y-4">
                    {Object.entries(grouped).map(([provider, data]) => (
                      <div
                        key={provider}
                        className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm"
                      >
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-bold text-sm text-slate-800">
                            {provider}
                          </span>
                          <button
                            disabled={data.valid.length === 0}
                            onClick={() => {
                              const script = `Hi team, this is ${shortWorkName}, may we know if there's any update regarding the following tracking ID's. Thank You.\n${data.valid.join("\n")}`;
                              navigator.clipboard.writeText(script);
                              setCopiedProvider(provider);
                              setTimeout(() => setCopiedProvider(null), 2000);
                            }}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg flex items-center gap-1.5 transition-all ${data.valid.length === 0 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : copiedProvider === provider ? "bg-emerald-500 text-white shadow-md" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"}`}
                          >
                            {copiedProvider === provider ? (
                              <CheckCircle2 size={14} />
                            ) : (
                              <Copy size={14} />
                            )}
                            {copiedProvider === provider
                              ? "Copied!"
                              : "Copy Script"}
                          </button>
                        </div>

                        <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-mono tracking-wide space-y-1">
                          {data.valid.length > 0 ? (
                            data.valid.map((id, i) => <div key={i}>{id}</div>)
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">
                              No valid Tracking IDs available.
                            </span>
                          )}
                        </div>

                        {data.missingCount > 0 && (
                          <div className="mt-3 flex items-start gap-2 text-[10px] text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100 leading-snug">
                            <AlertTriangle
                              size={14}
                              className="shrink-0 mt-0.5 text-amber-500"
                            />
                            <span>
                              <strong>
                                {data.missingCount} pending ticket(s)
                              </strong>{" "}
                              excluded from this script because they are missing
                              a Tracking ID.
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* --- ABNORMAL SCRIPT GENERATOR MODAL --- */}
      {abnormalModalState.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[150] flex items-center justify-center animate-in fade-in duration-200 p-4">
          <div className="bg-white w-[450px] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileWarning size={18} className="text-rose-600" /> Abnormal
                Script Generator
              </h3>
              <button
                onClick={() =>
                  setAbnormalModalState({
                    ...abnormalModalState,
                    isOpen: false,
                  })
                }
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 mb-2 leading-relaxed">
                Generate an abnormal notification script for providers that
                don't allow formal ticket creation.
              </p>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                  Provider Source <span className="text-red-500">*</span>
                </label>
                <select
                  value={abnormalModalState.provider}
                  onChange={(e) =>
                    setAbnormalModalState({
                      ...abnormalModalState,
                      provider: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer"
                >
                  <option value="" disabled>
                    Select Provider
                  </option>
                  {Object.keys(PROVIDER_CONFIG).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                  Member ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. user@017"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                  value={abnormalModalState.memberId}
                  onChange={(e) =>
                    setAbnormalModalState({
                      ...abnormalModalState,
                      memberId: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                  Abnormal Type <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. fraudulent betting, arbitrage"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-100 uppercase"
                  value={abnormalModalState.abnormalType}
                  onChange={(e) =>
                    setAbnormalModalState({
                      ...abnormalModalState,
                      abnormalType: e.target.value,
                    })
                  }
                />
              </div>

              {abnormalModalState.provider &&
              abnormalModalState.memberId &&
              abnormalModalState.abnormalType ? (
                <div className="pt-2 animate-in slide-in-from-bottom-2">
                  <span className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                    Script Preview
                  </span>
                  <div className="relative group">
                    <textarea
                      readOnly
                      value={`Hello team,this is ${shortWorkName}. Please refer to the below information from provider, thank you.\n\nAnnouncement：【${abnormalModalState.provider}】 confirm this member is【${abnormalModalState.abnormalType.toUpperCase()}】,you may decide whether to let member withdrawal or not, the decision is rest in your hand, thank you, sir.\n\nmember：${abnormalModalState.memberId}`}
                      className="w-full h-44 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-700 font-mono resize-none focus:outline-none focus:border-rose-400 transition-colors leading-relaxed"
                    />
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `Hello team,this is ${shortWorkName}. Please refer to the below information from provider, thank you.\n\nAnnouncement：【${abnormalModalState.provider}】 confirm this member is【${abnormalModalState.abnormalType.toUpperCase()}】,you may decide whether to let member withdrawal or not, the decision is rest in your hand, thank you, sir.\n\nmember：${abnormalModalState.memberId}`,
                      );
                      setCopiedAbnormal(true);
                      setTimeout(() => {
                        setCopiedAbnormal(false);
                        setAbnormalModalState({
                          isOpen: false,
                          provider: "",
                          memberId: "",
                          abnormalType: "",
                        });
                      }, 1500);
                    }}
                    className="w-full mt-3 py-3 bg-rose-600 text-white text-sm font-bold rounded-lg hover:bg-rose-700 transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    {copiedAbnormal ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <Copy size={16} />
                    )}
                    {copiedAbnormal ? "Copied!" : "Copy Script & Close"}
                  </button>
                </div>
              ) : (
                <div className="pt-4 text-center text-xs text-slate-400 italic">
                  Fill all fields to generate script
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
