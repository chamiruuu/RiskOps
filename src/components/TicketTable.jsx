import { useState, useRef, useEffect } from "react";
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
  ArrowRightLeft, // <-- NEW
  ShieldAlert, // <-- NEW
} from "lucide-react";
import { supabase } from "../lib/supabase"; // <-- NEW
import { useDuty } from "../context/DutyContext"; // <-- NEW

// --- Duty Text Color Mapping ---
const getDutyTextColor = (dutyName) => {
  switch (dutyName) {
    case "IC0":
      return "text-purple-700";
    case "IC1":
      return "text-indigo-700";
    case "IC2":
      return "text-emerald-700";
    case "IC3":
      return "text-amber-700";
    case "IC5":
      return "text-rose-700";
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
      return "focus:border-indigo-400 focus:ring-indigo-50";
    case "IC2":
      return "focus:border-emerald-400 focus:ring-emerald-50";
    case "IC3":
      return "focus:border-amber-400 focus:ring-amber-50";
    case "IC5":
      return "focus:border-rose-400 focus:ring-rose-50";
    default:
      return "focus:border-slate-400 focus:ring-slate-50";
  }
};

const getDutyButton = (dutyName) => {
  switch (dutyName) {
    case "IC0":
      return "bg-purple-600 hover:bg-purple-700";
    case "IC1":
      return "bg-indigo-600 hover:bg-indigo-700";
    case "IC2":
      return "bg-emerald-600 hover:bg-emerald-700";
    case "IC3":
      return "bg-amber-600 hover:bg-amber-700";
    case "IC5":
      return "bg-rose-600 hover:bg-rose-700";
    default:
      return "bg-slate-600 hover:bg-slate-700";
  }
};

const getDutyHeaderBg = (dutyName) => {
  switch (dutyName) {
    case "IC0":
      return "bg-purple-600";
    case "IC1":
      return "bg-indigo-600";
    case "IC2":
      return "bg-emerald-600";
    case "IC3":
      return "bg-amber-600";
    case "IC5":
      return "bg-rose-600";
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
  onDeleteTicket,
  dutyNumber,
  shortWorkName,
}) {
  const { user, workName } = useDuty(); // <-- NEW: Grab user details for emergency requests
  const [selectedTicketForNotes, setSelectedTicketForNotes] = useState(null);
  const [newNoteText, setNewNoteText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Action prompts
  const [deletingRowId, setDeletingRowId] = useState(null);

  // --- Modal State for Completion Workflow ---
  const [completeModal, setCompleteModal] = useState({
    isOpen: false,
    ticket: null,
    step: "select",
    type: "",
    abnormalType: "",
  });

  // --- NEW: Handover States & Auto-Sweeper Lock ---
  const hasSweptForShift = useRef(false);
  const [handoverModal, setHandoverModal] = useState({
    isOpen: false,
    step: "", // 'check', 'emergency', 'waiting', 'success'
    missingTickets: [],
    requestId: null,
  });

  // --- NEW: Auto-Sweeper Logic (Fires exactly at 14:30, 22:30, 07:00) ---
  useEffect(() => {
    const timer = setInterval(() => {
      const now = getGMT8Time();
      const h = now.getHours();
      const m = now.getMinutes();
      const timeStr = `${h}:${m}`;

      // Check if it is EXACTLY the sweep time
      if (timeStr === "14:30" || timeStr === "22:30" || timeStr === "7:0") {
        if (!hasSweptForShift.current) {
          hasSweptForShift.current = true;
          archiveCompletedTickets();
        }
      } else {
        // Reset the lock when the minute passes
        if (timeStr !== "14:30" && timeStr !== "22:30" && timeStr !== "7:0") {
          hasSweptForShift.current = false;
        }
      }
    }, 1000); // Check every second

    return () => clearInterval(timer);
  }, [tickets]);

  const archiveCompletedTickets = async () => {
    // A ticket is considered completed if its status is NOT "Pending"
    const completedIdsToArchive = tickets
      .filter((t) => t.status !== "Pending")
      .map((t) => t.id);

    if (completedIdsToArchive.length > 0) {
      await supabase
        .from("tickets")
        .update({ is_archived: true })
        .in("id", completedIdsToArchive);
    }
  };

  // --- NEW: Handover Logic ---
  const checkHandoverEligibility = () => {
    const pendingTix = tickets.filter((t) => t.status === "Pending");
    const missing = pendingTix.filter(
      (t) => !t.tracking_no || t.tracking_no === "-" || t.tracking_no.trim() === ""
    );

    if (missing.length > 0) {
      setHandoverModal({
        isOpen: true,
        step: "check",
        missingTickets: missing,
        requestId: null,
      });
    } else {
      processHandoverTimeCheck();
    }
  };

  const processHandoverTimeCheck = () => {
    const now = getGMT8Time();
    const h = now.getHours();
    const m = now.getMinutes();

    // Valid Windows: 14:15-14:30 | 22:15-22:30 | 06:45-07:00
    const isValidWindow =
      (h === 14 && m >= 15 && m < 30) ||
      (h === 22 && m >= 15 && m < 30) ||
      (h === 6 && m >= 45 && m <= 59);

    if (isValidWindow) {
      setHandoverModal({
        isOpen: true,
        step: "success",
        missingTickets: [],
        requestId: null,
      });
      generateHandoverReport();
    } else {
      setHandoverModal({
        isOpen: true,
        step: "emergency",
        missingTickets: [],
        requestId: null,
      });
    }
  };

  const requestEmergencyHandover = async () => {
    setHandoverModal({ ...handoverModal, step: "waiting" });

    const { data, error } = await supabase
      .from("handover_requests")
      .insert([
        { requester_id: user.id, requester_name: workName, duties: dutyNumber },
      ])
      .select()
      .single();

    if (!error && data) {
      setHandoverModal({ ...handoverModal, step: "waiting", requestId: data.id });

      // Start listening for Admin approval
      const sub = supabase
        .channel(`handover_wait_${data.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "handover_requests",
            filter: `id=eq.${data.id}`,
          },
          (payload) => {
            if (payload.new.status === "Approved") {
              setHandoverModal({
                isOpen: true,
                step: "success",
                missingTickets: [],
                requestId: null,
              });
              generateHandoverReport();
              supabase.removeChannel(sub);
            } else if (payload.new.status === "Rejected") {
              alert("Your emergency handover request was rejected by an Admin.");
              setHandoverModal({
                isOpen: false,
                step: "",
                missingTickets: [],
                requestId: null,
              });
              supabase.removeChannel(sub);
            }
          }
        )
        .subscribe();
    }
  };

  const generateHandoverReport = () => {
    const pendingTix = tickets.filter((t) => t.status === "Pending");
    const ids = pendingTix.map((t) => t.member_id).join(", ");
    const script = `Shift Handover [${dutyNumber.join(
      " & "
    )}] | Pending Tickets: ${pendingTix.length}\n${
      ids ? `Players pending: ${ids}` : "No pending tickets."
    }\n- ${shortWorkName}`;
    navigator.clipboard.writeText(script);
  };

  const handleSendNote = () => {
    if (newNoteText.trim() === "") return;
    onAddNote(selectedTicketForNotes.id, newNoteText);
    setNewNoteText("");
  };

  const activeNotes = selectedTicketForNotes
    ? tickets.find((t) => t.id === selectedTicketForNotes.id)?.notes || []
    : [];

  const filteredTickets = tickets.filter((ticket) => {
    if (!searchTerm) return true;
    const lowerSearch = searchTerm.toLowerCase();
    return (
      (ticket.member_id &&
        ticket.member_id.toLowerCase().includes(lowerSearch)) ||
      (ticket.provider_account &&
        ticket.provider_account.toLowerCase().includes(lowerSearch)) ||
      (ticket.tracking_no &&
        ticket.tracking_no.toLowerCase().includes(lowerSearch))
    );
  });

  const getGeneratedScript = () => {
    const { type, abnormalType, ticket } = completeModal;
    if (type === "Normal") {
      return `Hi sir as we checked, the member bet is normal. Thank you - ${shortWorkName}.`;
    } else {
      return `Hello team, this is ${shortWorkName}. Please refer to the below information from provider, Thank You.\n\nAnnouncement：【${ticket?.provider || "Provider"}】 confirm this member is【${abnormalType.toUpperCase()}】,you may decide whether to let member withdrawal or not, the decision is rest in your hand, thank you, sir.\n\nmember：${ticket?.member_id || "Unknown"}`;
    }
  };

  // --- Copy and Complete Logic ---
  const handleCopyAndComplete = () => {
    const script = getGeneratedScript();
    navigator.clipboard.writeText(script);

    // Save "Normal" or the custom Abnormal Risk Type directly into the status column!
    const finalStatus =
      completeModal.type === "Normal"
        ? "Normal"
        : completeModal.abnormalType.toUpperCase();

    onUpdateTicket(completeModal.ticket.id, "status", finalStatus);

    // Close modal
    setCompleteModal({
      isOpen: false,
      ticket: null,
      step: "select",
      type: "",
      abnormalType: "",
    });
  };

  let displayTitle = "Active Investigations for IC Duty";
  const dutyArray = Array.isArray(dutyNumber) ? dutyNumber : [];

  if (!dutyArray.includes("IC0") && dutyArray.length > 0) {
    const nums = dutyArray.map((d) => d.replace("IC", "").padStart(2, "0"));
    let formattedNums = "";

    if (nums.length === 1) {
      formattedNums = nums[0];
    } else if (nums.length === 2) {
      formattedNums = nums.join(" & ");
    } else {
      formattedNums = `${nums.slice(0, -1).join(", ")} & ${
        nums[nums.length - 1]
      }`;
    }
    displayTitle = `Active Investigations for IC Duty ${formattedNums}`;
  }

  const showDutyColumn = dutyArray.includes("IC0") || dutyArray.length > 1;

  return (
    <main className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden relative">
      <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">{displayTitle}</h2>
        <div className="flex items-center gap-3">
          
          {/* --- NEW HANDOVER BUTTON --- */}
          {!dutyArray.includes("IC0") && (
            <button
              onClick={checkHandoverEligibility}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
            >
              <ArrowRightLeft size={14} /> Handover Shift
            </button>
          )}

          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm w-64 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all"
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

      <div className="flex-1 overflow-auto bg-slate-50">
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
                  {searchTerm
                    ? `No tickets found matching "${searchTerm}"`
                    : "No active investigations found in database."}
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
                      {ticket.merchant_name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {ticket.login_id}
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
                        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all shadow-sm border
                          ${ticket.notes && ticket.notes.length > 0 ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}
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
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider
                          ${!isCompleted 
                            ? "bg-amber-50 text-amber-700 border-amber-200" 
                            : ticket.status === "Normal" || ticket.status === "NORMAL"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
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

      {/* --- HANDOVER MODALS --- */}
      {handoverModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white w-[450px] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            
            {/* Missing Tracking Numbers Alert */}
            {handoverModal.step === 'check' && (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4 text-amber-600">
                  <AlertTriangle size={24} />
                  <h3 className="text-lg font-bold text-slate-800">Missing Information</h3>
                </div>
                <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                  You have pending tickets missing a Tracking Number. It is highly recommended to fill these before handing over the shift:
                </p>
                <div className="max-h-32 overflow-y-auto bg-slate-50 rounded-lg p-3 border border-slate-200 mb-6 space-y-2">
                  {handoverModal.missingTickets.map(t => (
                    <div key={t.id} className="text-xs font-mono text-slate-700 flex items-center justify-between">
                      <span>Player: <span className="font-bold text-indigo-600">{t.member_id}</span></span>
                      <span className="text-slate-400">{t.provider}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setHandoverModal({ isOpen: false, step: '', missingTickets: [], requestId: null })} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-lg transition-colors">Go Back to Fix</button>
                  <button onClick={processHandoverTimeCheck} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-lg transition-colors">Handover Anyway</button>
                </div>
              </div>
            )}

            {/* Emergency Approval Request */}
            {handoverModal.step === 'emergency' && (
              <div className="p-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-100 text-rose-600 mb-4"><ShieldAlert size={24} /></div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Out of Handover Window</h3>
                <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                  You are attempting to handover outside the designated shift change times. This requires Admin or Leader approval.
                </p>
                <div className="flex items-center gap-3">
                  <button onClick={() => setHandoverModal({ isOpen: false, step: '', missingTickets: [], requestId: null })} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-lg transition-colors">Cancel</button>
                  <button onClick={requestEmergencyHandover} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-lg transition-colors">Request Override</button>
                </div>
              </div>
            )}

            {/* Waiting for Admin */}
            {handoverModal.step === 'waiting' && (
              <div className="p-8 text-center">
                <div className="inline-block relative w-12 h-12 mb-4">
                  <span className="animate-ping absolute inset-0 rounded-full bg-indigo-200 opacity-75"></span>
                  <div className="relative bg-indigo-100 text-indigo-600 w-12 h-12 rounded-full flex items-center justify-center"><ShieldAlert size={20} /></div>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Awaiting Approval</h3>
                <p className="text-sm text-slate-500">Your emergency handover request was sent to the Admins. Please wait for them to approve it.</p>
                <button onClick={() => setHandoverModal({ isOpen: false, step: '', missingTickets: [], requestId: null })} className="mt-6 text-xs font-bold text-slate-400 hover:text-slate-600 underline">Cancel Request</button>
              </div>
            )}

            {/* Success and Copy */}
            {handoverModal.step === 'success' && (
              <div className="p-8 text-center animate-in zoom-in-95">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-500 mb-4"><CheckCircle2 size={32} /></div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Handover Ready!</h3>
                <p className="text-sm text-slate-600 mb-6 leading-relaxed">Your handover text has been automatically copied to your clipboard. Completed tickets will automatically clear out at the end of the shift time.</p>
                <button onClick={() => setHandoverModal({ isOpen: false, step: '', missingTickets: [], requestId: null })} className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-lg transition-colors">Done</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- NOTES POPUP MODAL --- */}
      {selectedTicketForNotes && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-slate-50 w-[400px] h-[550px] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Chat Header */}
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

            {/* Chat Messages Area */}
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
                activeNotes.map((note, idx) => (
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
                    </div>
                    <div className="bg-white border border-slate-200 shadow-sm text-slate-700 text-xs px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-[85%] leading-relaxed">
                      {note.text}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Chat Input Area */}
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

      {/* --- COMPLETION FLOW MODAL --- */}
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
              {/* STEP 1: Select Type */}
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

              {/* STEP 2: Input Abnormal Type */}
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

              {/* STEP 3: Script View & Copy */}
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
    </main>
  );
}