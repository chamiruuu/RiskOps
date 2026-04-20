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
  Filter,
} from "lucide-react";
import { supabase, isMissingSupabaseRelationError } from "../lib/supabase";
import { useDuty } from "../context/DutyContext";
import { PROVIDER_CONFIG } from "../config/providerConfig";
import {
  getGMT8Time,
  getLastShiftChangeTime,
  getTransitionContext,
  checkIsHandoverWindow,
  getNextShift,
  computeTransitionViewState,
} from "../lib/shiftLogic";
import { createCorrelationId, LOGIC_CODES } from "../lib/logicHealth";

// --- NEW: Directly import the sound for guaranteed playback ---
import notificationSound from "../assets/notification sound common.mp3";

// --- NEW: Helper to ensure the Google Sheet name is always clean ---
const getCleanHandoverName = (rawName) => {
  if (!rawName) return "Agent";
  return rawName.replace(/ IPCS/gi, "").trim();
};

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

  useEffect(() => {
    if (!isEditing) {
      setValue(ticket[fieldKey] || "");
    }
  }, [ticket, fieldKey, isEditing]);

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

  // --- FILTER SYSTEM STATES ---
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [tableFilters, setTableFilters] = useState({
    status: "",
    provider: "",
    ic_account: "",
    recorder: "",
    date: "",
    handover: "",
  });
  const filterMenuRef = useRef(null);

  // Close filter menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        filterMenuRef.current &&
        !filterMenuRef.current.contains(event.target)
      ) {
        setIsFilterMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeFilterCount = Object.values(tableFilters).filter(
    (v) => v !== "",
  ).length;
  const clearFilters = () =>
    setTableFilters({
      status: "",
      provider: "",
      ic_account: "",
      recorder: "",
      date: "",
      handover: "",
    });

  // Get unique values dynamically from the tickets array for dropdown options
  const uniqueStatuses = useMemo(
    () => [...new Set(tickets.map((t) => t.status))].filter(Boolean).sort(),
    [tickets],
  );
  const uniqueProviders = useMemo(
    () => [...new Set(tickets.map((t) => t.provider))].filter(Boolean).sort(),
    [tickets],
  );
  const uniqueAccounts = useMemo(
    () => [...new Set(tickets.map((t) => t.ic_account))].filter(Boolean).sort(),
    [tickets],
  );
  const uniqueRecorders = useMemo(
    () => [...new Set(tickets.map((t) => t.recorder))].filter(Boolean).sort(),
    [tickets],
  );

  // --- SENDER TRANSFER MODAL STATES (MULTI-SEND) ---
  const [transferModal, setTransferModal] = useState({
    isOpen: false,
    step: "select",
  });
  const [transferAssignments, setTransferAssignments] = useState({});
  const [transferStatuses, setTransferStatuses] = useState({});

  const [selectedTicketForNotes, setSelectedTicketForNotes] = useState(null);
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteState, setEditingNoteState] = useState({
    ticketId: null,
    noteIndex: null,
    text: "",
  });
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
  const dutyKey = useMemo(
    () => dutyArray.slice().sort().join(","),
    [dutyArray],
  );
  const buildHandoverMarker = useCallback(() => {
    const transitionCtx = getTransitionContext();
    const baseMarker = transitionCtx
      ? transitionCtx.marker
      : getLastShiftChangeTime().toISOString();
    return `${baseMarker}|${dutyKey}`;
  }, [dutyKey]);

  const [isHandoverProcessing, setIsHandoverProcessing] = useState(false);
  const [
    handoverCompletedForCurrentWindow,
    setHandoverCompletedForCurrentWindow,
  ] = useState(false);
  const [lastHandoverTimestamp, setLastHandoverTimestamp] = useState(null);
  const autoHandoverLoggedRef = useRef("");
  const lastPostStartReminderMinuteRef = useRef("");
  const lockWarningMarkerRef = useRef("");
  const handedOverTicketIdsByMarkerRef = useRef(new Map());
  const completedTicketIdsByMarkerRef = useRef(new Map());
  const missingRetryQueueTableRef = useRef(false);
  const missingOperationalAlertsTableRef = useRef(false);
  const RETRY_WINDOW_MS = 2 * 60 * 60 * 1000;

  const isTicketNewSinceLastHandover = useCallback(
    (ticket) => {
      if (!lastHandoverTimestamp) return true;
      const ticketCreatedAt = Date.parse(ticket?.created_at || "");
      const lastHandoverAt = Date.parse(lastHandoverTimestamp);
      if (Number.isNaN(ticketCreatedAt) || Number.isNaN(lastHandoverAt)) {
        return true;
      }
      return ticketCreatedAt > lastHandoverAt;
    },
    [lastHandoverTimestamp],
  );

  // --- GUARANTEED LOCAL AUDIO PLAYER ---
  const playAlertSound = useCallback(() => {
    const audio = new Audio(notificationSound);
    audio.play().catch((err) => console.log("Audio play error:", err));
  }, []);

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
        playAlertSound();

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
  }, [
    isAdminOrLeader,
    isMyShiftActive,
    tickets,
    lastReminderHour,
    playAlertSound,
  ]);

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

      const marker = `${transitionCtx.marker}|${dutyKey}`;

      // Stop reminders for this shift once handover is completed.
      if (autoHandoverLoggedRef.current === marker) {
        return;
      }

      const minuteKey = `${h}:${String(m).padStart(2, "0")}|${marker}`;
      if (lastPostStartReminderMinuteRef.current === minuteKey) {
        return;
      }
      lastPostStartReminderMinuteRef.current = minuteKey;

      // --- BUG FIX: Only count tickets that are Pending AND haven't been handed over yet ---
      const pendingTix = tickets.filter(
        (t) => t.status === "Pending" && isTicketNewSinceLastHandover(t),
      );

      // --- BUG FIX: If there are 0 tickets left to hand over, kill the endless loop! ---
      if (pendingTix.length === 0) {
        autoHandoverLoggedRef.current = marker; // Engage the kill-switch for future minutes
        return;
      }

      const reminderText = `Handover reminder: ${pendingTix.length} pending ticket(s) still require handover to ${handoverPair.incoming} shift.`;

      setReminderToast({
        title: "Handover Required",
        text: reminderText,
      });
      setShowReminderToast(true);
      // playAlertSound(); // (Assuming you removed this earlier so it doesn't double-play!)

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
  }, [
    isAdminOrLeader,
    myAssignedShift,
    dutyKey,
    tickets,
    playAlertSound,
    isTicketNewSinceLastHandover,
  ]); // <-- Added isTicketNewSinceLastHandover to dependencies

  // --- WINDOW HANDOVER COMPLETION STATUS (CONTROLS INCOMING VISIBILITY) ---
  useEffect(() => {
    let isMounted = true;

    const refreshWindowHandoverStatus = async () => {
      const transitionCtx = getTransitionContext();

      if (!transitionCtx || !myAssignedShift || myAssignedShift === "Off") {
        if (isMounted) setHandoverCompletedForCurrentWindow(false);
        return;
      }

      const marker = `${transitionCtx.marker}|${dutyKey}`;

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
  }, [dutyArray, dutyKey, myAssignedShift, user?.id]);

  useEffect(() => {
    let isMounted = true;

    const refreshLastHandoverTimestamp = async () => {
      const transitionCtx = getTransitionContext();
      if (!transitionCtx || !dutyKey) {
        if (isMounted) setLastHandoverTimestamp(null);
        return;
      }

      const outgoingShift = transitionCtx.pair.outgoing;
      const { data, error } = await supabase
        .from("shift_handover_state")
        .select("last_handover_timestamp")
        .eq("shift_name", outgoingShift)
        .eq("duty_key", dutyKey)
        .maybeSingle();

      if (error) {
        if (isMounted) setLastHandoverTimestamp(null);
        return;
      }

      if (isMounted) {
        setLastHandoverTimestamp(data?.last_handover_timestamp || null);
      }
    };

    refreshLastHandoverTimestamp();
    const timer = setInterval(refreshLastHandoverTimestamp, 30000);

    const channel = supabase
      .channel(`handover-state-${user?.id || "anon"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shift_handover_state" },
        () => {
          refreshLastHandoverTimestamp();
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [dutyKey, user?.id]);

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

      const warningMarker = `${transitionCtx.marker}|lock-warning|${dutyKey}`;
      if (lockWarningMarkerRef.current === warningMarker) return;
      lockWarningMarkerRef.current = warningMarker;

      const reminderText =
        "Shift lock in 10 minutes. Finalize remaining work now before visibility is revoked.";

      setReminderToast({
        title: "Shift Lock Warning",
        text: reminderText,
      });
      setShowReminderToast(true);

      // REMOVED: playAlertSound(); <--- Deleting this fixes the silence!

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
  }, [isAdminOrLeader, myAssignedShift, dutyKey, playAlertSound]);

  // --- AUTO-CLEAR BELL REMINDER IF FIXED ---
  useEffect(() => {
    const pendingTix = tickets.filter((t) => t.status === "Pending");
    const missing = pendingTix.filter(
      (t) =>
        !t.tracking_no || t.tracking_no === "-" || t.tracking_no.trim() === "",
    );

    // BUG FIX: Only clear the bell if the CURRENT reminder is specifically about missing tracking IDs.
    // This stops it from accidentally deleting your "Handover Required" or "Handover Enabled" notifications!
    if (
      missing.length === 0 &&
      reminderToast.title === "Missing Tracking IDs"
    ) {
      window.dispatchEvent(new CustomEvent("clear-tracking-reminder"));
    }
  }, [tickets, reminderToast.title]);

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

      // Keep completed tickets visible to outgoing shift during the shared window
      // so they remain reviewable until the hard lock cutoff.
      const transitionCtx = getTransitionContext();
      if (transitionCtx?.isSharedWindow) return;

      const lastShiftStart = getLastShiftChangeTime();

      const oldCompletedTickets = tickets.filter(
        (t) =>
          t.status !== "Pending" && new Date(t.updated_at || t.created_at) < lastShiftStart,
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
    async (handoverTickets, correlationId) => {
      if (!handoverTickets || handoverTickets.length === 0) {
        return { success: true };
      }

      try {
        const { data, error } = await supabase.functions.invoke("sync-sheets", {
          body: {
            action: "APPEND",
            tickets: handoverTickets,
            // --- UPDATED: Force the clean name ---
            handoverBy: getCleanHandoverName(shortWorkName),
          },
        });

        if (error) {
          throw error;
        }

        if (data && data.success === false) {
          throw new Error(data.error || "Google Sheet handover sync failed.");
        }

        return { success: true };
      } catch (e) {
        console.error("Sheet Handover Error:", e);
        window.dispatchEvent(
          new CustomEvent("logic-health-event", {
            detail: {
              code: LOGIC_CODES.HANDOVER_FAILED,
              level: "error",
              title: "Handover Sheet Sync Failed",
              detail: e?.message || "Google Sheet handover sync failed.",
              at: Date.now(),
              source: "handover",
              correlationId,
            },
          }),
        );

        return {
          success: false,
          errorMessage: e?.message || "Google Sheet handover sync failed.",
        };
      }
    },
    [shortWorkName],
  );

  const persistHandoverState = useCallback(
    async ({ shiftName, handoverTimestampIso, marker }) => {
      if (!shiftName || !marker) return;

      await supabase.from("shift_handover_state").upsert(
        {
          shift_name: shiftName,
          duty_key: dutyKey,
          last_handover_timestamp: handoverTimestampIso,
          last_handover_by_user_id: user?.id || null,
          updated_at: handoverTimestampIso,
        },
        { onConflict: "shift_name,duty_key" },
      );
    },
    [dutyKey, user?.id],
  );

  const queueSheetRetryJob = useCallback(
    async ({
      marker,
      nextShift,
      ticketsToRetry,
      errorMessage,
      correlationId,
    }) => {
      if (missingRetryQueueTableRef.current) {
        return;
      }

      if (
        !marker ||
        !nextShift ||
        !Array.isArray(ticketsToRetry) ||
        ticketsToRetry.length === 0
      ) {
        return;
      }

      const nowIso = new Date().toISOString();
      const jobKey = `${marker}|${nextShift}`;

      const { data: existingJob } = await supabase
        .from("sheet_sync_retry_queue")
        .select("first_failed_at")
        .eq("job_key", jobKey)
        .maybeSingle();

      const firstFailedAt = existingJob?.first_failed_at || nowIso;

      const { error } = await supabase.from("sheet_sync_retry_queue").upsert(
        {
          job_key: jobKey,
          handover_marker: marker,
          duty_key: dutyKey,
          source_shift: myAssignedShift,
          target_shift: nextShift,
          payload: {
            action: "APPEND",
            tickets: ticketsToRetry,
            // --- UPDATED: Force the clean name ---
            handoverBy: getCleanHandoverName(shortWorkName),
          },
          status: "pending",
          first_failed_at: firstFailedAt,
          next_retry_at: nowIso,
          last_error: errorMessage,
          updated_at: nowIso,
          created_by: user?.id || null,
        },
        { onConflict: "job_key" },
      );

      if (error) {
        if (isMissingSupabaseRelationError(error)) {
          missingRetryQueueTableRef.current = true;
          return;
        }

        window.dispatchEvent(
          new CustomEvent("logic-health-event", {
            detail: {
              code: LOGIC_CODES.HANDOVER_FAILED,
              level: "error",
              title: "Handover Retry Queue Failed",
              detail: error.message || "Could not queue failed sheet sync job.",
              at: Date.now(),
              source: "handover",
              correlationId,
            },
          }),
        );
        return;
      }

      window.dispatchEvent(
        new CustomEvent("logic-health-event", {
          detail: {
            code: LOGIC_CODES.HANDOVER_RETRY_QUEUED,
            level: "warning",
            title: "Handover Retry Queued",
            detail:
              "Google Sheet sync failed and was queued for automatic retry for up to 2 hours.",
            at: Date.now(),
            source: "handover",
            correlationId,
          },
        }),
      );
    },
    [dutyKey, myAssignedShift, shortWorkName, user?.id],
  );

  const syncHandoverAndNotify = useCallback(
    async (pendingTix, mode = "Manual") => {
      const correlationId = createCorrelationId("HO");
      const marker = buildHandoverMarker();
      const handedOverSet =
        handedOverTicketIdsByMarkerRef.current.get(marker) || new Set();
      const uniquePendingTix = pendingTix.filter(
        (t) => !handedOverSet.has(t.id) && isTicketNewSinceLastHandover(t),
      );

      // Stop duplicate appends/notifications when handover is clicked repeatedly.
      if (uniquePendingTix.length === 0) {
        return { skipped: true, count: 0, marker };
      }

      const transitionCtx = getTransitionContext();
      const nextShift =
        transitionCtx?.pair?.incoming || getNextShift(currentActiveShift);
      const outgoingShift = transitionCtx?.pair?.outgoing || myAssignedShift;
      const msg = `${shortWorkName} completed ${mode.toLowerCase()} handover for ${dutyArray.join(", ")}. ${uniquePendingTix.length} pending ticket(s) handed over successfully.`;
      const handoverTimestampIso = new Date().toISOString();

      await supabase.from("shift_notifications").insert({
        target_shift: nextShift,
        message: msg,
        duties: dutyArray,
      });

      const sheetSyncResult = await appendHandoverTicketsToSheet(
        uniquePendingTix,
        correlationId,
      );
      if (!sheetSyncResult?.success) {
        await queueSheetRetryJob({
          marker,
          nextShift,
          ticketsToRetry: uniquePendingTix,
          errorMessage:
            sheetSyncResult?.errorMessage || "Unknown sheet sync error.",
          correlationId,
        });
      }

      await persistHandoverState({
        shiftName: outgoingShift,
        handoverTimestampIso,
        marker,
      });

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
      window.dispatchEvent(
        new CustomEvent("logic-health-event", {
          detail: {
            code: LOGIC_CODES.HANDOVER_SUCCESS,
            level: "success",
            title: "Handover Completed",
            detail: `${mode} handover sent for ${uniquePendingTix.length} pending ticket(s).`,
            at: Date.now(),
            source: "handover",
            correlationId,
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
      myAssignedShift,
      persistHandoverState,
      queueSheetRetryJob,
      isTicketNewSinceLastHandover,
      shortWorkName,
    ],
  );

  useEffect(() => {
    let isRunning = false;

    const processSheetRetryQueue = async () => {
      if (isRunning || !dutyKey || missingRetryQueueTableRef.current) return;
      isRunning = true;

      try {
        const now = new Date();
        const nowIso = now.toISOString();

        const { data: jobs, error } = await supabase
          .from("sheet_sync_retry_queue")
          .select(
            "id, job_key, payload, status, attempt_count, first_failed_at, target_shift, handover_marker",
          )
          .eq("duty_key", dutyKey)
          .in("status", ["pending", "retrying"])
          .lte("next_retry_at", nowIso)
          .order("next_retry_at", { ascending: true })
          .limit(3);

        if (error && isMissingSupabaseRelationError(error)) {
          missingRetryQueueTableRef.current = true;
          return;
        }

        if (error || !Array.isArray(jobs) || jobs.length === 0) {
          return;
        }

        for (const job of jobs) {
          const { data: claimedRows, error: claimError } = await supabase
            .from("sheet_sync_retry_queue")
            .update({
              status: "processing",
              last_attempt_at: nowIso,
              updated_at: nowIso,
            })
            .eq("id", job.id)
            .in("status", ["pending", "retrying"])
            .select("id");

          if (claimError || !claimedRows || claimedRows.length === 0) {
            continue;
          }

          const payload = job.payload || {};
          const correlationId = createCorrelationId("HO");
          const { data: syncData, error: syncError } =
            await supabase.functions.invoke("sync-sheets", { body: payload });

          const syncFailed = !!syncError || syncData?.success === false;
          if (!syncFailed) {
            await supabase
              .from("sheet_sync_retry_queue")
              .update({
                status: "succeeded",
                attempt_count: (job.attempt_count || 0) + 1,
                last_error: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", job.id);
            continue;
          }

          const errorMessage =
            syncError?.message ||
            syncData?.error ||
            "Google sheet retry failed.";
          const firstFailedMs = Date.parse(job.first_failed_at || nowIso);
          const elapsedMs = Date.now() - firstFailedMs;

          if (elapsedMs >= RETRY_WINDOW_MS) {
            const escalateAtIso = new Date().toISOString();
            await supabase
              .from("sheet_sync_retry_queue")
              .update({
                status: "escalated",
                attempt_count: (job.attempt_count || 0) + 1,
                last_error: errorMessage,
                escalated_at: escalateAtIso,
                updated_at: escalateAtIso,
              })
              .eq("id", job.id);

            if (!missingOperationalAlertsTableRef.current) {
              const { error: alertInsertError } = await supabase
                .from("operational_alerts")
                .insert({
                  title: "Handover Sheet Sync Escalated",
                  message:
                    "Google Sheet handover sync could not be completed after 2 hours of retries. Immediate admin/leader action is required.",
                  severity: "error",
                  status: "open",
                  context: {
                    jobKey: job.job_key,
                    marker: job.handover_marker,
                    targetShift: job.target_shift,
                    dutyKey,
                    lastError: errorMessage,
                  },
                  created_by: user?.id || null,
                });

              if (isMissingSupabaseRelationError(alertInsertError)) {
                missingOperationalAlertsTableRef.current = true;
              }
            }

            window.dispatchEvent(
              new CustomEvent("logic-health-event", {
                detail: {
                  code: LOGIC_CODES.HANDOVER_ESCALATED,
                  level: "error",
                  title: "Handover Sheet Sync Escalated",
                  detail:
                    "Google Sheet handover sync failed for over 2 hours. Admin/leader alert has been raised.",
                  at: Date.now(),
                  source: "handover",
                  correlationId,
                },
              }),
            );
            continue;
          }

          const backoffMinutes = Math.min(
            15,
            Math.max(1, 2 ** Math.min(job.attempt_count || 0, 4)),
          );
          const nextRetryAtIso = new Date(
            Date.now() + backoffMinutes * 60 * 1000,
          ).toISOString();

          await supabase
            .from("sheet_sync_retry_queue")
            .update({
              status: "retrying",
              attempt_count: (job.attempt_count || 0) + 1,
              last_error: errorMessage,
              next_retry_at: nextRetryAtIso,
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
        }
      } finally {
        isRunning = false;
      }
    };

    processSheetRetryQueue();
    const timer = setInterval(processSheetRetryQueue, 30000);
    return () => clearInterval(timer);
  }, [dutyKey, user?.id]);

  useEffect(() => {
    // 1. Made this function async so we can await the sync
    const attemptAutoHandover = async () => {
      const transitionCtx = getTransitionContext();
      if (!transitionCtx) {
        return;
      }

      const isOutgoingShift =
        !!myAssignedShift && myAssignedShift === transitionCtx.pair.outgoing;

      if (isAdminOrLeader || !isOutgoingShift || dutyArray.length === 0) {
        return;
      }

      const now = getGMT8Time();
      const h = now.getHours();
      const m = now.getMinutes();
      const isAutoTriggerMinute =
        (myAssignedShift === "Night" && h === 7 && m >= 8 && m < 10) ||
        (myAssignedShift === "Morning" && h === 14 && m >= 38 && m < 40) ||
        (myAssignedShift === "Afternoon" && h === 22 && m >= 38 && m < 40);

      if (!isAutoTriggerMinute) {
        return;
      }

      const pendingTix = tickets.filter((t) => t.status === "Pending");
      if (pendingTix.length === 0) return;

      const marker = buildHandoverMarker();
      if (autoHandoverLoggedRef.current === marker) return;
      autoHandoverLoggedRef.current = marker;

      // 2. Await the handover process
      await syncHandoverAndNotify(pendingTix, "Auto");

      // 3. NEW: Notify the user that auto-handover just happened!
      const notifText = `System automatically handed over ${pendingTix.length} pending ticket(s) to the ${transitionCtx.pair.incoming} shift.`;

      setReminderToast({
        title: "Auto-Handover Executed",
        text: notifText,
      });
      setShowReminderToast(true);
      playAlertSound();

      // 4. Send it to the Bell Icon
      window.dispatchEvent(
        new CustomEvent("tracking-reminder-alert", {
          detail: {
            missingCount: 0,
            time: Date.now(),
            text: notifText,
          },
        }),
      );
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
    playAlertSound, // <-- Added this dependency for the sound
  ]);

  // --- HANDOVER WORKFLOW (Reporting & Cleaning) ---
  const checkHandoverEligibility = () => {
    if (isHandoverProcessing) return;

    const marker = buildHandoverMarker();
    const handedOverSet =
      handedOverTicketIdsByMarkerRef.current.get(marker) || new Set();
    const pendingTix = tickets.filter((t) => t.status === "Pending");
    const unhandedPendingTix = pendingTix.filter(
      (t) => !handedOverSet.has(t.id) && isTicketNewSinceLastHandover(t),
    );

    if (unhandedPendingTix.length === 0) {
      setHandoverModal({
        isOpen: true,
        step: "already_done",
        missingTickets: [],
      });
      return;
    }

    const missing = unhandedPendingTix.filter(
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
      const result = await syncHandoverAndNotify(pendingTix, "Manual");

      if (result?.skipped) {
        setHandoverModal({
          isOpen: true,
          step: "already_done",
          missingTickets: [],
        });
        return;
      }

      setHandoverModal({
        isOpen: true,
        step: "shift_done",
        missingTickets: [],
      });
    } catch (e) {
      // Handover failed — clear marker so reminders resume correctly.
      autoHandoverLoggedRef.current = "";
      console.error("Handover execute error:", e);
      window.dispatchEvent(
        new CustomEvent("logic-health-event", {
          detail: {
            code: LOGIC_CODES.HANDOVER_FAILED,
            level: "error",
            title: "Handover Execution Failed",
            detail: e?.message || "Manual handover failed.",
            at: Date.now(),
            source: "handover",
            correlationId: createCorrelationId("HO"),
          },
        }),
      );
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
  const {
    handoverPair,
    isOutgoingTransitionViewer,
    isIncomingTransitionViewer,
    canViewTickets,
  } = computeTransitionViewState({
    transitionCtx,
    myAssignedShift,
    isMyShiftActive,
    isAdminOrLeader,
    handoverCompletedForCurrentWindow,
  });

  const isActuallyInWindow = checkIsHandoverWindow();
  const currentHandoverMarker = buildHandoverMarker();
  const handedOverSetForMarker =
    handedOverTicketIdsByMarkerRef.current.get(currentHandoverMarker) ||
    new Set();

  const filteredTickets = tickets.filter((ticket) => {
    if (!canViewTickets) return false;

    // BUG FIX: Incoming shift should not see the PREVIOUS shift's completed tickets.
    // But they MUST be able to see tickets they created/completed during their own shift!
    const lastShiftChange = getLastShiftChangeTime();
    
    // Check when it was actually completed/updated, not just when it was created
    const completedInPastShift = new Date(ticket.updated_at || ticket.created_at) < lastShiftChange;

    if (
      isIncomingTransitionViewer &&
      ticket.status !== "Pending" &&
      completedInPastShift
    ) {
      return false;
    }

    // 1. Search Logic
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      const matches =
        (ticket.member_id &&
          ticket.member_id.toLowerCase().includes(lowerSearch)) ||
        (ticket.provider_account &&
          ticket.provider_account.toLowerCase().includes(lowerSearch)) ||
        (ticket.tracking_no &&
          ticket.tracking_no.toLowerCase().includes(lowerSearch)) ||
        (ticket.login_id &&
          ticket.login_id.toLowerCase().includes(lowerSearch));

      if (!matches) return false;
    }

    // 2. Dropdown Filters
    if (tableFilters.status && ticket.status !== tableFilters.status)
      return false;
    if (tableFilters.provider && ticket.provider !== tableFilters.provider)
      return false;
    if (
      tableFilters.ic_account &&
      ticket.ic_account !== tableFilters.ic_account
    )
      return false;
    if (tableFilters.recorder && ticket.recorder !== tableFilters.recorder)
      return false;

    // 3. Date Filter (using local date boundaries for simplicity to match visual "today"/"yesterday")
    if (tableFilters.date) {
      const tDate = new Date(ticket.created_at);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const isSameDay = (d1, d2) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();

      if (tableFilters.date === "today" && !isSameDay(tDate, today))
        return false;
      if (tableFilters.date === "yesterday" && !isSameDay(tDate, yesterday))
        return false;
    }

    // 4. Handover Status Filter
    if (tableFilters.handover) {
      const lastShiftChange = getLastShiftChangeTime();
      const createdInPastShift = new Date(ticket.created_at) < lastShiftChange;
      const isHandedOverLocally =
        !isTicketNewSinceLastHandover(ticket) ||
        handedOverSetForMarker.has(ticket.id);
      const isActuallyHandedOver = createdInPastShift || isHandedOverLocally;

      if (tableFilters.handover === "handed_over" && !isActuallyHandedOver)
        return false;
      if (tableFilters.handover === "pending" && isActuallyHandedOver)
        return false;
    }

    return true;
  });

  const getGeneratedScript = () => {
    const { type, abnormalType, ticket } = completeModal;
    if (type === "Normal") {
      return `Hi sir as we checked, the member bet is normal in provider ${ticket?.provider || "-"}. Thank you - ${shortWorkName}.`;
    } else if (type === "Void") {
      return `[System Note] This ticket was marked as Void by ${shortWorkName}. No action required.`;
    } else {
      return `Hello team, this is ${shortWorkName}. Please refer to the below information from provider, Thank You.\n\nAnnouncement：【${ticket?.provider || "Provider"}】 confirm this member is【${abnormalType.toUpperCase()}】,you may decide whether to let member withdrawal or not, the decision is rest in your hand, thank you, sir.\n\nmember：${ticket?.member_id || "Unknown"}`;
    }
  };

  const handleCopyAndComplete = () => {
    // ONLY copy to clipboard if it's NOT a Void ticket
    if (completeModal.type !== "Void") {
      const script = getGeneratedScript();
      navigator.clipboard.writeText(script);
    }

    const finalStatus =
      completeModal.type === "Normal"
        ? "Normal"
        : completeModal.type === "Void"
          ? "VOID"
          : completeModal.abnormalType.toUpperCase();

    const targetTicketId = completeModal.ticket.id;

    if (completeModal.ticket?.status === "Pending") {
      const marker = buildHandoverMarker();
      const completedSet =
        completedTicketIdsByMarkerRef.current.get(marker) || new Set();
      completedSet.add(targetTicketId);
      completedTicketIdsByMarkerRef.current.set(marker, completedSet);
    }

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
  const unhandedPendingCount = tickets.filter(
    (t) =>
      t.status === "Pending" &&
      !handedOverSetForMarker.has(t.id) &&
      isTicketNewSinceLastHandover(t),
  ).length;
  const canInitiateHandover =
    isActuallyInWindow && isOutgoingForWindow && unhandedPendingCount > 0;
  const isHandoverDisabled =
    !canInitiateHandover || !isActuallyInWindow || isHandoverProcessing;

  let handoverTooltip = "Handover Shift";
  if (!isActuallyInWindow)
    handoverTooltip =
      "Only available during manual handover window (06:45-07:10, 14:15-14:40, 22:15-22:40).";
  else if (!isOutgoingForWindow && !isAdminOrLeader)
    handoverTooltip = "Only the outgoing shift can handover in this window.";
  else if (unhandedPendingCount === 0)
    handoverTooltip =
      "All existing pending tickets for this window are already handed over.";

  const availableUsersToTransfer = onlineUsers.filter(
    (u) => u.id && u.id !== user?.id,
  );

  // --- HANDOVER ENABLED NOTIFICATION ---
  useEffect(() => {
    // Only outgoing shift, not admin/leader, and only if handover just became enabled
    if (isAdminOrLeader || !isOutgoingForWindow || !isActuallyInWindow) return;

    // Only show if handover just became enabled (not if already enabled previously)
    const now = getGMT8Time();
    const h = now.getHours();
    const m = now.getMinutes();

    // Trigger at exact enable times
    const isEnableTime =
      (h === 6 && m === 45) || (h === 14 && m === 15) || (h === 22 && m === 15);

    // Only if there are tickets to handover
    if (!isEnableTime || unhandedPendingCount === 0) return;

    // Use a marker to avoid duplicate notifications in the same window
    const enableMarker = `${h}:${m}|${currentHandoverMarker}`;
    if (window.__lastHandoverEnableMarker === enableMarker) return;
    window.__lastHandoverEnableMarker = enableMarker;

    const notifText =
      "The handover window is now open. Please proceed with the handover if all tasks are complete.";

    // 1. Show local on-screen toast
    setReminderToast({
      title: "Handover Enabled",
      text: notifText,
    });
    setShowReminderToast(true);
    setTimeout(() => setShowReminderToast(false), 8000);

    // 2. Send to Header.jsx (This puts it in the Bell Icon & plays the sound natively!)
    window.dispatchEvent(
      new CustomEvent("tracking-reminder-alert", {
        detail: {
          missingCount: 0,
          time: Date.now(),
          text: notifText,
        },
      }),
    );
  }, [
    isAdminOrLeader,
    isOutgoingForWindow,
    isActuallyInWindow,
    unhandedPendingCount,
    currentHandoverMarker,
  ]);

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
          {(isMyShiftActive ||
            isOutgoingTransitionViewer ||
            isAdminOrLeader) && (
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
          {(isAdminOrLeader ||
            (isMyShiftActive && !dutyArray.includes("IC0"))) && (
            <button
              onClick={() => setFollowUpModal(true)}
              className="p-2 bg-white hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-lg shadow-sm transition-colors border border-slate-200 ml-1"
              title="Follow-up Scripts"
            >
              <Megaphone size={16} />
            </button>
          )}

          {/* --- TRANSFER DUTY BUTTON --- */}
          {(isAdminOrLeader ||
            (isMyShiftActive && !dutyArray.includes("IC0"))) && (
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

          {/* FILTER DROPDOWN MENU */}
          <div className="relative ml-1" ref={filterMenuRef}>
            <button
              onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
              className={`p-2 rounded-lg shadow-sm transition-colors border flex items-center gap-1.5 ${activeFilterCount > 0 ? "bg-indigo-50 text-indigo-600 border-indigo-200" : "bg-white text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border-slate-200"}`}
              title="Filter Tickets"
            >
              <Filter size={16} />
              {activeFilterCount > 0 && (
                <span className="text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {isFilterMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-[340px] bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-4 flex flex-col gap-4 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-bold text-slate-800">
                    Filter Tickets
                  </h3>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearFilters}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">
                      Status
                    </label>
                    <select
                      value={tableFilters.status}
                      onChange={(e) =>
                        setTableFilters({
                          ...tableFilters,
                          status: e.target.value,
                        })
                      }
                      className="text-xs p-1.5 border border-slate-200 bg-slate-50 text-slate-700 rounded-md outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                    >
                      <option value="">All Statuses</option>
                      {uniqueStatuses.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">
                      Provider
                    </label>
                    <select
                      value={tableFilters.provider}
                      onChange={(e) =>
                        setTableFilters({
                          ...tableFilters,
                          provider: e.target.value,
                        })
                      }
                      className="text-xs p-1.5 border border-slate-200 bg-slate-50 text-slate-700 rounded-md outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                    >
                      <option value="">All Providers</option>
                      {uniqueProviders.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">
                      Duty / IC
                    </label>
                    <select
                      value={tableFilters.ic_account}
                      onChange={(e) =>
                        setTableFilters({
                          ...tableFilters,
                          ic_account: e.target.value,
                        })
                      }
                      className="text-xs p-1.5 border border-slate-200 bg-slate-50 text-slate-700 rounded-md outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                    >
                      <option value="">All Duties</option>
                      {uniqueAccounts.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">
                      Recorder
                    </label>
                    <select
                      value={tableFilters.recorder}
                      onChange={(e) =>
                        setTableFilters({
                          ...tableFilters,
                          recorder: e.target.value,
                        })
                      }
                      className="text-xs p-1.5 border border-slate-200 bg-slate-50 text-slate-700 rounded-md outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                    >
                      <option value="">All Recorders</option>
                      {uniqueRecorders.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">
                      Date Added
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setTableFilters({ ...tableFilters, date: "" })
                        }
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-colors ${tableFilters.date === "" ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm" : "bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100"}`}
                      >
                        All Time
                      </button>
                      <button
                        onClick={() =>
                          setTableFilters({ ...tableFilters, date: "today" })
                        }
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-colors ${tableFilters.date === "today" ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm" : "bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100"}`}
                      >
                        Today
                      </button>
                      <button
                        onClick={() =>
                          setTableFilters({
                            ...tableFilters,
                            date: "yesterday",
                          })
                        }
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-colors ${tableFilters.date === "yesterday" ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm" : "bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100"}`}
                      >
                        Yesterday
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">
                      Handover Status
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setTableFilters({ ...tableFilters, handover: "" })
                        }
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-colors ${tableFilters.handover === "" ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm" : "bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100"}`}
                      >
                        All
                      </button>
                      <button
                        onClick={() =>
                          setTableFilters({
                            ...tableFilters,
                            handover: "pending",
                          })
                        }
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-colors ${tableFilters.handover === "pending" ? "bg-amber-50 text-amber-700 border border-amber-200 shadow-sm" : "bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100"}`}
                      >
                        Pending
                      </button>
                      <button
                        onClick={() =>
                          setTableFilters({
                            ...tableFilters,
                            handover: "handed_over",
                          })
                        }
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-colors ${tableFilters.handover === "handed_over" ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm" : "bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100"}`}
                      >
                        Handed Over
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="relative ml-1">
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
                    : searchTerm || activeFilterCount > 0
                      ? "No tickets found matching your search/filters."
                      : "No active investigations found."}
                </td>
              </tr>
            ) : (
              filteredTickets.map((ticket) => {
                const isCompleted = ticket.status !== "Pending";

                // --- NEW: 1. Check if created in the 20-min Sheet Handover overlap ---
                const d = new Date(ticket.created_at);
                const utc = d.getTime() + d.getTimezoneOffset() * 60000;
                const gmt8 = new Date(utc + 3600000 * 8);
                const tTime = gmt8.getHours() + gmt8.getMinutes() / 60;
                
                const isCreatedInOverlap = 
                  (tTime >= 7.15 && tTime < 7.5) ||   // 07:09 - 07:30
                  (tTime >= 14.65 && tTime < 15.0) || // 14:39 - 15:00
                  (tTime >= 22.65 && tTime < 23.0);   // 22:39 - 23:00

                // --- NEW: 2. Strict Delete Lock (Applies to EVERYONE, including Admins) ---
                const lastShiftChange = getLastShiftChangeTime();
                const createdInPastShift = new Date(ticket.created_at) < lastShiftChange;
                const isHandedOverLocally = !isTicketNewSinceLastHandover(ticket);
                
                // If it meets ANY of these conditions, it is on the Sheet. 
                // Because we don't include 'isAdminOrLeader' here, it strictly blocks Admins too!
                const isLockedFromDeletion =
                  isCompleted || createdInPastShift || isHandedOverLocally || isCreatedInOverlap;

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
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${!isCompleted ? "bg-amber-50 text-amber-700 border-amber-200" : ticket.status === "Normal" || ticket.status === "NORMAL" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ticket.status === "VOID" || ticket.status === "Void" ? "bg-slate-100 text-slate-500 border-slate-300" : "bg-rose-50 text-rose-700 border-rose-200"}`}
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

                          {/* --- HIDES DELETE BUTTON IF PUSHED TO SHEETS --- */}
                          {!isLockedFromDeletion && (
                            <button
                              onClick={() => {
                                setDeletingRowId(ticket.id);
                              }}
                              className="text-slate-400 hover:text-rose-500 transition-colors"
                              title="Delete Ticket"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
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
            {handoverModal.step === "already_done" && (
              <div className="p-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mb-4">
                  <CheckCircle2 size={24} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">
                  Already Handed Over
                </h3>
                <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                  Successfully handed over all existing pending tickets. There
                  are no new pending tickets to handover right now.
                </p>
                <button
                  onClick={() =>
                    setHandoverModal({
                      isOpen: false,
                      step: "",
                      missingTickets: [],
                    })
                  }
                  className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-sm font-bold rounded-lg transition-colors"
                >
                  Continue
                </button>
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
                  const isEditing =
                    editingNoteState.ticketId === selectedTicketForNotes.id &&
                    editingNoteState.noteIndex === idx;
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
                          <span className="text-[8px] text-slate-400 italic">
                            (edited)
                          </span>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="bg-white border-2 border-blue-400 shadow-sm rounded-2xl rounded-tl-sm max-w-[85%] p-2.5 flex gap-2 items-end">
                          <textarea
                            value={editingNoteState.text}
                            onChange={(e) =>
                              setEditingNoteState({
                                ...editingNoteState,
                                text: e.target.value,
                              })
                            }
                            className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                            rows="2"
                            autoFocus
                          />
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                onEditNote(
                                  selectedTicketForNotes.id,
                                  idx,
                                  editingNoteState.text,
                                );
                                setEditingNoteState({
                                  ticketId: null,
                                  noteIndex: null,
                                  text: "",
                                });
                              }}
                              className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
                              title="Save edit"
                            >
                              <CheckCircle2 size={14} />
                            </button>
                            <button
                              onClick={() =>
                                setEditingNoteState({
                                  ticketId: null,
                                  noteIndex: null,
                                  text: "",
                                })
                              }
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
                                  onClick={() =>
                                    setEditingNoteState({
                                      ticketId: selectedTicketForNotes.id,
                                      noteIndex: idx,
                                      text: note.text,
                                    })
                                  }
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
                                      onDeleteNote(
                                        selectedTicketForNotes.id,
                                        idx,
                                      );
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

                    {/* --- NEW VOID BUTTON --- */}
                    <button
                      onClick={() =>
                        setCompleteModal({
                          ...completeModal,
                          type: "Void",
                          step: "script",
                        })
                      }
                      className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 hover:border-slate-400 hover:bg-slate-50 rounded-xl transition-all group shadow-sm text-left mt-2"
                    >
                      <div>
                        <span className="block text-sm font-bold text-slate-700 group-hover:text-slate-800">
                          Void
                        </span>
                        <span className="block text-xs text-slate-500 mt-0.5">
                          Ticket was created by mistake or is no longer needed.
                        </span>
                      </div>
                      <X
                        size={20}
                        className="text-slate-400 group-hover:text-slate-600"
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
                            completeModal.type === "Normal" ||
                            completeModal.type === "Void"
                              ? "select"
                              : "input-abnormal",
                        })
                      }
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                    >
                      &larr; Back
                    </button>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        completeModal.type === "Normal"
                          ? "bg-emerald-100 text-emerald-700"
                          : completeModal.type === "Void"
                            ? "bg-slate-200 text-slate-700"
                            : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {completeModal.type}{" "}
                      {completeModal.type !== "Void" && "Script"}
                    </span>
                  </div>

                  {completeModal.type === "Void" ? (
                    <div className="py-6 text-center text-slate-600 text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg shadow-sm">
                      Are you sure you want to void this ticket? <br />
                      <span className="text-xs text-slate-400 font-normal mt-2 block">
                        No script will be copied to your clipboard.
                      </span>
                    </div>
                  ) : (
                    <div className="relative group">
                      <textarea
                        readOnly
                        value={getGeneratedScript()}
                        className="w-full h-36 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-mono resize-none focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors leading-relaxed"
                      />
                    </div>
                  )}

                  <button
                    onClick={handleCopyAndComplete}
                    className={`w-full py-3 text-white text-sm font-bold rounded-lg transition-colors shadow-md flex items-center justify-center gap-2 ${
                      completeModal.type === "Void"
                        ? "bg-slate-800 hover:bg-slate-900"
                        : "bg-indigo-600 hover:bg-indigo-700"
                    }`}
                  >
                    {completeModal.type === "Void" ? (
                      <>
                        <CheckCircle2 size={16} /> Confirm & Void Ticket
                      </>
                    ) : (
                      <>
                        <Copy size={16} /> Copy Script & Mark Completed
                      </>
                    )}
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
