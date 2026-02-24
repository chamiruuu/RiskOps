import { useState, useRef, useEffect } from "react";
import {
  Search,
  MessageSquare,
  MessageCircle,
  X,
  Send,
  Edit2,
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

// --- Clean Click-to-Edit Tracking Component ---
const TrackingCell = ({ ticket, onUpdateTicket }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(ticket.tracking_no || "");
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    setIsEditing(false);
    if (value !== (ticket.tracking_no || "")) {
      onUpdateTicket(ticket.id, "tracking_no", value);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        placeholder="Enter ID..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
        className="w-28 px-2 py-1.5 text-xs bg-white border-2 border-indigo-400 rounded outline-none shadow-sm font-mono text-slate-800"
      />
    );
  }

  return value ? (
    <div
      onClick={() => setIsEditing(true)}
      className="cursor-pointer group flex items-center gap-2 py-1"
      title="Click to edit Tracking ID"
    >
      <span className="font-mono text-slate-700 font-medium">{value}</span>
      <Edit2
        size={12}
        className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </div>
  ) : (
    <button
      onClick={() => setIsEditing(true)}
      className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 border border-dashed border-slate-300 hover:border-indigo-400 rounded px-2 py-1 transition-all bg-slate-50 hover:bg-indigo-50"
    >
      + Add ID
    </button>
  );
};

export default function TicketTable({
  tickets,
  onUpdateTicket,
  onAddNote,
  dutyNumber,
}) {
  const [selectedTicketForNotes, setSelectedTicketForNotes] = useState(null);
  const [newNoteText, setNewNoteText] = useState("");
  
  // --- NEW: Search State ---
  const [searchTerm, setSearchTerm] = useState("");

  const handleSendNote = () => {
    if (newNoteText.trim() === "") return;
    onAddNote(selectedTicketForNotes.id, newNoteText);
    setNewNoteText("");
  };

  const activeNotes = selectedTicketForNotes
    ? tickets.find((t) => t.id === selectedTicketForNotes.id)?.notes || []
    : [];

  // --- NEW: Filter Logic ---
  const filteredTickets = tickets.filter((ticket) => {
    if (!searchTerm) return true; // Show all if search is empty
    
    const lowerSearch = searchTerm.toLowerCase();
    return (
      (ticket.merchant_name && ticket.merchant_name.toLowerCase().includes(lowerSearch)) ||
      (ticket.login_id && ticket.login_id.toLowerCase().includes(lowerSearch)) ||
      (ticket.member_id && ticket.member_id.toLowerCase().includes(lowerSearch)) ||
      (ticket.provider && ticket.provider.toLowerCase().includes(lowerSearch)) ||
      (ticket.provider_account && ticket.provider_account.toLowerCase().includes(lowerSearch)) ||
      (ticket.tracking_no && ticket.tracking_no.toLowerCase().includes(lowerSearch)) ||
      (ticket.ic_account && ticket.ic_account.toLowerCase().includes(lowerSearch))
    );
  });

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
            {/* --- NEW: Wired up the input to update searchTerm --- */}
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm w-64 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all"
            />
            {/* --- NEW: Clear Search Button (appears when typing) --- */}
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
              <th className="px-4 py-3 text-center">Audit Chat</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs bg-white">
            {/* --- NEW: Check if filtered list is empty, display appropriate message --- */}
            {filteredTickets.length === 0 ? (
              <tr>
                <td
                  colSpan={dutyNumber === "00" ? "11" : "10"}
                  className="px-6 py-12 text-center text-slate-400"
                >
                  {searchTerm 
                    ? `No tickets found matching "${searchTerm}"` 
                    : "No active investigations found in database."}
                </td>
              </tr>
            ) : (
              // --- NEW: Map over filteredTickets instead of tickets ---
              filteredTickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="hover:bg-slate-50 group transition-colors"
                >
                  {dutyNumber === "00" && (
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
                  <td className="px-4 py-3 font-mono font-semibold text-indigo-600">
                    {ticket.merchant_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {ticket.login_id}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    {ticket.member_id}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">
                    {ticket.provider_account}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {ticket.provider}
                  </td>

                  <td className="px-4 py-2">
                    <TrackingCell
                      ticket={ticket}
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
                        ${
                          ticket.notes && ticket.notes.length > 0
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                            : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                        }`}
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
                    <select
                      value={ticket.status}
                      onChange={(e) =>
                        onUpdateTicket(ticket.id, "status", e.target.value)
                      }
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border outline-none cursor-pointer appearance-none text-center
                        ${
                          ticket.status === "Pending"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : ticket.status === "Completed"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Completed">Completed</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- THE CHAT POPUP MODAL --- */}
      {selectedTicketForNotes && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-slate-50 w-[400px] h-[550px] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
            {/* Chat Header */}
            <div className="px-5 py-4 bg-indigo-600 flex items-center justify-between text-white shadow-md z-10">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <MessageCircle size={16} /> Investigation Chat
                </h3>
                <p className="text-[11px] font-medium text-indigo-200 mt-1">
                  Player: {selectedTicketForNotes.member_id}
                </p>
              </div>
              <button
                onClick={() => setSelectedTicketForNotes(null)}
                className="p-1.5 bg-indigo-500/50 hover:bg-indigo-500 rounded-full transition-colors"
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
                    No messages yet.
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
                    {/* The Chat Bubble */}
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
                  placeholder="Type a message..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendNote()}
                  className="flex-1 pl-4 pr-10 py-2.5 bg-slate-100 border border-slate-200 rounded-full text-xs outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all"
                  autoFocus
                />
                <button
                  onClick={handleSendNote}
                  className={`absolute right-1.5 p-1.5 rounded-full transition-colors flex items-center justify-center
                    ${
                      newNoteText.trim()
                        ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md"
                        : "bg-slate-200 text-slate-400"
                    }`}
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
    </main>
  );
}