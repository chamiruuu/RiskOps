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
  AlertTriangle
} from "lucide-react";

// --- Duty Text Color Mapping ---
const getDutyTextColor = (dutyName) => {
  switch (dutyName) {
    case "IC0": return "text-purple-700";
    case "IC1": return "text-indigo-700";
    case "IC2": return "text-emerald-700";
    case "IC3": return "text-amber-700";
    case "IC5": return "text-rose-700";
    default: return "text-slate-700";
  }
};

// --- Duty Theme Mappings for Notes Modal ---
const getDutyBorderRing = (dutyName) => {
  switch (dutyName) {
    case "IC0": return "focus:border-purple-400 focus:ring-purple-50";
    case "IC1": return "focus:border-indigo-400 focus:ring-indigo-50";
    case "IC2": return "focus:border-emerald-400 focus:ring-emerald-50";
    case "IC3": return "focus:border-amber-400 focus:ring-amber-50";
    case "IC5": return "focus:border-rose-400 focus:ring-rose-50";
    default: return "focus:border-slate-400 focus:ring-slate-50";
  }
};

const getDutyButton = (dutyName) => {
  switch (dutyName) {
    case "IC0": return "bg-purple-600 hover:bg-purple-700";
    case "IC1": return "bg-indigo-600 hover:bg-indigo-700";
    case "IC2": return "bg-emerald-600 hover:bg-emerald-700";
    case "IC3": return "bg-amber-600 hover:bg-amber-700";
    case "IC5": return "bg-rose-600 hover:bg-rose-700";
    default: return "bg-slate-600 hover:bg-slate-700";
  }
};

const getDutyHeaderBg = (dutyName) => {
  switch (dutyName) {
    case "IC0": return "bg-purple-600";
    case "IC1": return "bg-indigo-600";
    case "IC2": return "bg-emerald-600";
    case "IC3": return "bg-amber-600";
    case "IC5": return "bg-rose-600";
    default: return "bg-slate-600";
  }
};

// --- Reusable Click-to-Edit Component ---
const EditableField = ({ ticket, fieldKey, placeholder, addText, onUpdateTicket }) => {
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
}) {
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
    workName: "",
  });

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
      (ticket.member_id && ticket.member_id.toLowerCase().includes(lowerSearch)) ||
      (ticket.provider_account && ticket.provider_account.toLowerCase().includes(lowerSearch)) ||
      (ticket.tracking_no && ticket.tracking_no.toLowerCase().includes(lowerSearch))
    );
  });

  // --- Generate Script Logic ---
  const getGeneratedScript = () => {
    const { type, abnormalType, workName, ticket } = completeModal;
    if (type === "Normal") {
      return `Hi sir as we checked, the member bet is normal. Thank you - ${workName || "Team"}.`;
    } else {
      return `Hello team, this is ${workName || "Team"}. Please refer to the below information from provider, Thank You.\n\nAnnouncement：【${ticket?.provider || "Provider"}】 confirm this member is【${abnormalType}】,you may decide whether to let member withdrawal or not, the decision is rest in your hand, thank you, sir.\n\nmember：${ticket?.member_id || "Unknown"}`;
    }
  };

  // --- Copy and Complete Logic ---
  const handleCopyAndComplete = () => {
    const script = getGeneratedScript();
    navigator.clipboard.writeText(script);
    
    // FIX: Send EXACTLY "Normal" or "Abnormal" to satisfy the database ENUM
    onUpdateTicket(completeModal.ticket.id, "status", completeModal.type);
    
    // Close modal
    setCompleteModal({ isOpen: false, ticket: null, step: "select", type: "", abnormalType: "", workName: "" });
  };

  return (
    <main className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden relative">
      <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">
          {dutyNumber === "00" ? "Active Investigations" : `Active Investigations for IC Duty ${dutyNumber}`}
        </h2>
        <div className="flex items-center gap-3">
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
              {dutyNumber === "00" && <th className="px-4 py-3">Duty</th>}
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
                  colSpan={dutyNumber === "00" ? "12" : "11"}
                  className="px-6 py-12 text-center text-slate-400"
                >
                  {searchTerm 
                    ? `No tickets found matching "${searchTerm}"` 
                    : "No active investigations found in database."}
                </td>
              </tr>
            ) : (
              filteredTickets.map((ticket) => {
                // FIX: It is considered completed if the status is Normal or Abnormal
                const isCompleted = ticket.status === "Normal" || ticket.status === "Abnormal";

                return (
                  <tr
                    key={ticket.id}
                    className="hover:bg-slate-50 group transition-colors"
                  >
                    {dutyNumber === "00" && (
                      <td className="px-4 py-3">
                        <span className={`font-bold text-[11px] uppercase tracking-wider ${getDutyTextColor(ticket.ic_account)}`}>
                          {ticket.ic_account}
                        </span>
                      </td>
                    )}

                    <td className="px-4 py-3 text-slate-500">
                      {new Date(ticket.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-700">{ticket.merchant_name}</td>
                    <td className="px-4 py-3 text-slate-600">{ticket.login_id}</td>

                    <td className="px-4 py-2">
                      <EditableField ticket={ticket} fieldKey="member_id" placeholder="Player ID" addText="+ Add Player" onUpdateTicket={onUpdateTicket} />
                    </td>
                    <td className="px-4 py-2">
                      <EditableField ticket={ticket} fieldKey="provider_account" placeholder="Account" addText="+ Add Acc" onUpdateTicket={onUpdateTicket} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{ticket.provider}</td>
                    <td className="px-4 py-2">
                      <EditableField ticket={ticket} fieldKey="tracking_no" placeholder="Track No." addText="+ Add ID" onUpdateTicket={onUpdateTicket} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">{ticket.recorder}</td>

                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => setSelectedTicketForNotes(ticket)}
                        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all shadow-sm border
                          ${ticket.notes && ticket.notes.length > 0 ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}
                      >
                        <MessageCircle size={14} className={ticket.notes && ticket.notes.length > 0 ? "text-indigo-600" : "text-slate-400"} />
                        {ticket.notes && ticket.notes.length > 0 ? `${ticket.notes.length} Messages` : "Open Chat"}
                      </button>
                    </td>

                    {/* Dynamic Status Badge */}
                    <td className="px-4 py-2 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border
                          ${isCompleted ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}
                      >
                        {isCompleted ? "Completed" : "Wait for provider"}
                      </span>
                    </td>

                    <td className="px-4 py-2 text-center">
                      {deletingRowId === ticket.id ? (
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500">Delete?</span>
                          <button
                            onClick={() => {
                              if (onDeleteTicket) onDeleteTicket(ticket.id);
                              setDeletingRowId(null);
                            }}
                            className="px-2 py-1 text-[10px] font-bold bg-rose-500 text-white hover:bg-rose-600 rounded transition-colors"
                          >
                            Yes
                          </button>
                          <button onClick={() => setDeletingRowId(null)} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
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
                                  workName: ticket.recorder || "",
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
                            title={isCompleted ? "Cannot delete completed ticket" : "Delete Ticket"}
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

      {/* --- NOTES POPUP MODAL --- */}
      {selectedTicketForNotes && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-slate-50 w-[400px] h-[550px] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Chat Header */}
            <div className={`px-5 py-4 ${getDutyHeaderBg(selectedTicketForNotes.ic_account)} flex items-center justify-between text-white shadow-md z-10 transition-colors`}>
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
                  <p className="text-xs text-slate-500 font-medium">No notes yet.<br />Be the first to leave an update!</p>
                </div>
              ) : (
                activeNotes.map((note, idx) => (
                  <div key={idx} className="flex flex-col items-start w-full animate-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center gap-2 mb-1 ml-2">
                      <span className="text-[10px] font-bold text-slate-600">{note.author}</span>
                      <span className="text-[9px] font-medium text-slate-400">{note.timestamp}</span>
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
                  <Send size={14} className={newNoteText.trim() ? "ml-0.5" : ""} />
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
                <CheckCircle2 size={18} className="text-emerald-500" /> Complete Investigation
              </h3>
              <button
                onClick={() => setCompleteModal({ isOpen: false, ticket: null, step: "select", type: "", abnormalType: "", workName: "" })}
                className="p-1 text-slate-400 hover:text-slate-600 bg-slate-200/50 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6">
              {/* STEP 1: Select Type */}
              {completeModal.step === "select" && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Your Work Name</label>
                    <input 
                      type="text" 
                      value={completeModal.workName} 
                      onChange={(e) => setCompleteModal({...completeModal, workName: e.target.value})}
                      placeholder="Enter your name for the script"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors"
                    />
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-slate-700 mb-2">How should this ticket be completed?</p>
                    <button 
                      onClick={() => setCompleteModal({...completeModal, type: "Normal", step: "script"})}
                      className="w-full flex items-center justify-between px-4 py-3 bg-white border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 rounded-xl transition-all group shadow-sm text-left"
                    >
                      <div>
                        <span className="block text-sm font-bold text-emerald-700 group-hover:text-emerald-800">Normal</span>
                        <span className="block text-xs text-emerald-600/70 mt-0.5">Player bet is normal. Proceed with standard script.</span>
                      </div>
                      <CheckCircle2 size={20} className="text-emerald-400 group-hover:text-emerald-600" />
                    </button>
                    
                    <button 
                      onClick={() => setCompleteModal({...completeModal, type: "Abnormal", step: "input-abnormal"})}
                      className="w-full flex items-center justify-between px-4 py-3 bg-white border border-rose-200 hover:border-rose-400 hover:bg-rose-50 rounded-xl transition-all group shadow-sm text-left"
                    >
                      <div>
                        <span className="block text-sm font-bold text-rose-700 group-hover:text-rose-800">Abnormal</span>
                        <span className="block text-xs text-rose-600/70 mt-0.5">Require provider specific details.</span>
                      </div>
                      <AlertTriangle size={20} className="text-rose-400 group-hover:text-rose-600" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Input Abnormal Type */}
              {completeModal.step === "input-abnormal" && (
                <div className="space-y-5 animate-in slide-in-from-right-4">
                  <div>
                    <button 
                      onClick={() => setCompleteModal({...completeModal, step: "select"})}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 mb-4 inline-flex items-center gap-1"
                    >
                      &larr; Back
                    </button>
                    <h4 className="text-sm font-bold text-slate-800">Enter Abnormal Details</h4>
                    <p className="text-xs text-slate-500 mt-1">What kind of abnormal activity did the provider confirm?</p>
                  </div>
                  <input 
                    type="text"
                    autoFocus
                    value={completeModal.abnormalType}
                    onChange={(e) => setCompleteModal({...completeModal, abnormalType: e.target.value})}
                    placeholder="e.g., fraudulent betting, multi-accounting"
                    className="w-full px-3 py-2.5 bg-white border-2 border-indigo-200 rounded-lg text-sm outline-none focus:border-indigo-500 shadow-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && completeModal.abnormalType.trim()) {
                        setCompleteModal({...completeModal, step: "script"});
                      }
                    }}
                  />
                  <button 
                    disabled={!completeModal.abnormalType.trim()}
                    onClick={() => setCompleteModal({...completeModal, step: "script"})}
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
                      onClick={() => setCompleteModal({...completeModal, step: completeModal.type === "Normal" ? "select" : "input-abnormal"})}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                    >
                      &larr; Back
                    </button>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${completeModal.type === "Normal" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
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