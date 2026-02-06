import React, { useState, useEffect } from "react";
import { supabase } from "./supabase";
import {
  ShieldAlert,
  Activity,
  Users,
  LogOut,
  Copy,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  MoreHorizontal,
  Trash2,
  Edit2,
  AlertOctagon,
} from "lucide-react";
import { format } from "date-fns";

// --- COMPONENTS ---

const StatusBadge = ({ status }) => {
  const styles = {
    pending: "bg-slate-800 text-slate-300 border-slate-700",
    normal: "bg-emerald-950 text-emerald-400 border-emerald-900",
    handover: "bg-indigo-950 text-indigo-400 border-indigo-900",
    // Base style for any violation type
    abnormal: "bg-rose-950 text-rose-400 border-rose-900",
  };

  // Logic: If it's a known status, use it. If not, assume it's an Abnormal Violation (Red).
  const styleClass = styles[status.toLowerCase()] || styles.abnormal;

  return (
    <span
      className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wide border ${styleClass}`}
    >
      {status}
    </span>
  );
};

const PROVIDERS = [
  "PokerQ",
  "BG Casino",
  "OG Plus",
  "PT Casino",
  "WM",
  "Sexy Casino",
  "DG Casino",
  "Opus Casino",
  "PA Casino",
  "ALLBET",
  "GP Casino",
  "SA Gaming",
  "Evolution Gaming",
  "PP Casino",
  "GClub Live",
  "Yeebet",
  "MG Live",
  "PT Slots",
  "MG+ Slot",
  "Pragmatic Play",
  "HBS",
  "PG Soft",
  "CQ9 Slots",
  "Spadegaming",
  "YGG",
  "Joker",
  "Playstar",
  "BNG",
  "DC",
  "AWC",
  "SKYWIND",
  "NETENT",
  "FastSpin",
  "JILI",
  "CG",
  "Next Spin",
  "RSG",
  "NoLimit City",
  "OG Slots",
  "Relax gaming",
  "Hacksaw",
  "YGR",
  "AdvantPlay",
  "Octoplay",
  "FatPanda",
  "2J",
  "GGSoft",
  "C-Sports",
  "SBO",
  "I-sports",
  "OPUS SPORT",
  "BTi",
  "IMSB",
  "Wbet",
  "QQKENO/QQThai/QQViet",
  "QQ4D",
].sort(); // Alphabetical sort for easier finding

export default function App() {
  // --- STATE ---
  const [session, setSession] = useState(null);

  // Login State
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");

  // Dashboard State
  const [tickets, setTickets] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Input State
  const [provider, setProvider] = useState(PROVIDERS[0]);
  const [memberId, setMemberId] = useState("");
  const [timePeriod, setTimePeriod] = useState("");
  const [resultType, setResultType] = useState("profit");

  // --- NEW STATE FOR MODALS ---
  const [modalType, setModalType] = useState(null); // 'edit' | 'delete' | 'abnormal' | null
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);

  // Abnormal Flow Inputs
  const [abnormalType, setAbnormalType] = useState("");

  // Edit Flow Inputs
  const [editMemberId, setEditMemberId] = useState("");
  const [editTimePeriod, setEditTimePeriod] = useState("");

  // --- NEW ACTIONS ---

  // 1. Open/Close Logic
  const openMenu = (e, id) => {
    e.stopPropagation();
    setMenuOpenId(menuOpenId === id ? null : id);
  };

  const openModal = (type, ticket) => {
    setMenuOpenId(null);
    setSelectedTicket(ticket);
    setModalType(type);
    if (type === "edit") {
      setEditMemberId(ticket.member_id);
      setEditTimePeriod(ticket.time_period);
    }
    if (type === "abnormal") setAbnormalType("");
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedTicket(null);
  };

  // 2. Logic to Save Edits
  const saveEdit = async () => {
    if (!selectedTicket) return;
    const updates = { member_id: editMemberId, time_period: editTimePeriod };
    setTickets((prev) =>
      prev.map((t) => (t.id === selectedTicket.id ? { ...t, ...updates } : t)),
    );
    await supabase.from("tickets").update(updates).eq("id", selectedTicket.id);
    closeModal();
  };

  // 3. Logic to Delete
  const deleteTicket = async () => {
    if (!selectedTicket) return;
    setTickets((prev) => prev.filter((t) => t.id !== selectedTicket.id));
    await supabase.from("tickets").delete().eq("id", selectedTicket.id);
    closeModal();
  };

  // 4. Logic for Abnormal Script
  const confirmAbnormal = async () => {
    if (!selectedTicket || !abnormalType) return;

    // 1. Generate the Script
    const script = `Hello team, this is ${session.display_name || session.username}. Please refer to the below information from provider, Thank You.\n\nAnnouncement：【${selectedTicket.provider} Uniform name】 confirm this member is【${abnormalType}】,you may decide whether to let member withdrawal or not, the decision is rest in your hand, thank you, sir.\n\nmember：${selectedTicket.member_id}`;

    // 2. Copy & Alert
    navigator.clipboard.writeText(script);
    alert("Script copied!");

    // 3. SAVE THE SPECIFIC TYPE TO DB (This changes the Status Column)
    // We save 'abnormalType' (e.g., "Arbitrage") as the status.
    await updateTicketStatus(selectedTicket.id, abnormalType);

    closeModal();
  };
  // --- DATA FUNCTIONS ---

  const fetchTickets = async () => {
    const { data } = await supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setTickets(data);
  };

  const fetchOnlineCount = async () => {
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .gt("last_seen", twoMinsAgo);
    setOnlineUsers(count || 1);
  };

  const handleRealtimeUpdate = (payload) => {
    if (payload.eventType === "INSERT") {
      setTickets((prev) => {
        // Prevent Duplicate: Check if we already have this ticket ID
        if (prev.some((t) => t.id === payload.new.id)) return prev;

        // Prevent Duplicate: Check if we have a "temp" ticket for the same Member/Time
        // (This stops the "Ghost Ticket" effect)
        const isDuplicateOptimistic = prev.some(
          (t) =>
            t.member_id === payload.new.member_id &&
            t.time_period === payload.new.time_period &&
            typeof t.id === "number", // Assuming temp IDs are numbers/decimals
        );

        if (isDuplicateOptimistic) return prev;

        return [payload.new, ...prev];
      });
    } else if (payload.eventType === "UPDATE") {
      setTickets((prev) =>
        prev.map((t) => (t.id === payload.new.id ? payload.new : t)),
      );
    }
  };

  // --- NEW: Handle Row Copy Button ---
  const handleRowCopy = (ticket) => {
    let text = "";

    // Check known statuses first
    if (ticket.status === "normal") {
      text = `Hi sir as we checked, the member bet is normal. Thank you - ${session.display_name || session.username}.`;
    } else if (ticket.status === "pending" || ticket.status === "handover") {
      text = `[AUDIT]\nProvider: ${ticket.provider}\nMember: ${ticket.member_id}\nPeriod: ${ticket.time_period}\nResult: PENDING`;
    } else {
      // IT MUST BE A VIOLATION (Arbitrage, Hedge Betting, etc.)
      // We use 'ticket.status' here because it now holds the specific violation name!
      text = `Hello team, this is ${session.display_name || session.username}. Please refer to the below information from provider, Thank You.\n\nAnnouncement：【${ticket.provider} Uniform name】 confirm this member is【${ticket.status}】,you may decide whether to let member withdrawal or not, the decision is rest in your hand, thank you, sir.\n\nmember：${ticket.member_id}`;
    }

    navigator.clipboard.writeText(text);
    // Optional toast/alert
  };
  // --- EFFECTS ---

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    const heartbeat = setInterval(async () => {
      if (session?.id) {
        await supabase
          .from("users")
          .update({ last_seen: new Date() })
          .eq("id", session.id);
        fetchOnlineCount();
      }
    }, 30000);

    return () => {
      clearInterval(timer);
      clearInterval(heartbeat);
    };
  }, [session]);

  useEffect(() => {
    if (!session) return;

    fetchTickets();
    fetchOnlineCount();

    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        (payload) => {
          handleRealtimeUpdate(payload);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  // --- ACTIONS ---

  const handleLogin = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", loginUser)
      .eq("password", loginPass)
      .single();

    if (error || !data) {
      setLoginError("Invalid credentials");
    } else {
      setSession(data);
      await supabase
        .from("users")
        .update({ last_seen: new Date() })
        .eq("id", data.id);
    }
  };

  const createTicket = async () => {
    if (!memberId || !timePeriod) return;

    // 1. Capture current values before clearing them
    const currentMemberId = memberId;
    const currentTimePeriod = timePeriod;
    const currentProvider = provider;

    // 2. Clear Inputs Immediately (User Feedback)
    setMemberId("");
    setTimePeriod("");

    // 3. Create Optimistic Ticket
    const tempId = Math.random();
    const optimisticTicket = {
      id: tempId,
      provider: currentProvider,
      member_id: currentMemberId,
      time_period: currentTimePeriod,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    setTickets((prev) => [optimisticTicket, ...prev]);

    // 4. Send to Database
    const { data, error } = await supabase
      .from("tickets")
      .insert({
        provider: currentProvider,
        member_id: currentMemberId,
        time_period: currentTimePeriod,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Error sending ticket:", error);
      // Optional: Restore inputs if error occurs
    } else {
      setTickets((prev) => prev.map((t) => (t.id === tempId ? data : t)));
    }
  };

  const updateTicketStatus = async (id, status) => {
    const updateData = {
      status,
      completed_at:
        status === "normal" || status === "abnormal" ? new Date() : null,
    };

    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updateData } : t)),
    );
    await supabase.from("tickets").update(updateData).eq("id", id);
  };

  const handoverAll = async () => {
    const pendingIds = tickets
      .filter((t) => t.status === "pending")
      .map((t) => t.id);
    setTickets((prev) =>
      prev.map((t) =>
        t.status === "pending" ? { ...t, status: "handover" } : t,
      ),
    );

    await supabase
      .from("tickets")
      .update({ status: "handover" })
      .in("id", pendingIds);
  };

  const generateScript = () => {
    // SOP RULE 1 & 9: Loss Confirmation Script
    if (resultType === 'loss') {
      const isExcluded = ['PG Soft', 'PA Casino'].includes(provider);
      
      if (isExcluded) {
        return `[NOTE] ${provider} does not require Loss Confirmation. You may proceed.`;
      }
      
      // UPDATED TEMPLATE
      return `Hello team, this is ${session.display_name || session.username}. As we confirmed the member has no profit from the provider during this period. Do you still need to check member bet normal or not?`;
    }

    // Standard Audit Script (Profit/Pending)
    return `[AUDIT]\nProvider: ${provider}\nMember: ${memberId}\nPeriod: ${timePeriod}\nResult: PROFIT`;
  };

  // --- RENDER ---

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950 text-slate-200">
        <div className="w-full max-w-sm p-8 bg-slate-900 rounded-lg border border-slate-800 shadow-xl">
          <div className="flex items-center gap-3 mb-8 text-slate-100">
            <ShieldAlert size={28} className="text-indigo-500" />
            <h1 className="text-xl font-bold tracking-wide">RiskOps Access</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                Username
              </label>
              <input
                type="text"
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-4 py-2.5 text-sm focus:border-indigo-500 outline-none transition-colors"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-4 py-2.5 text-sm focus:border-indigo-500 outline-none transition-colors"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
              />
            </div>
            {loginError && (
              <p className="text-rose-500 text-sm">{loginError}</p>
            )}
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-md text-sm font-semibold transition-colors shadow-lg shadow-indigo-900/20"
            >
              Enter Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-300 font-sans selection:bg-indigo-500/30">
      {/* HEADER */}
      <header className="h-16 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
            <ShieldAlert size={20} className="text-indigo-500" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-wide text-slate-100 leading-tight">
              RISKOPS
            </h1>
            <p className="text-[10px] text-slate-500 font-medium tracking-wider uppercase">
              Operational Control v0.3
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm font-medium">
          {session.role === "admin" && (
            <button className="text-slate-400 hover:text-slate-200 flex items-center gap-2 px-3 py-1.5 hover:bg-slate-900 rounded-md transition-colors">
              <Users size={16} /> <span>Users</span>
            </button>
          )}

          <div className="h-5 w-px bg-slate-800"></div>

          <div className="flex items-center gap-2 text-emerald-500 bg-emerald-950/20 px-3 py-1.5 rounded-full border border-emerald-900/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold">{onlineUsers} Online</span>
          </div>

          <div className="flex items-center gap-2 text-slate-400 tabular-nums bg-slate-900 px-3 py-1.5 rounded-md border border-slate-800">
            <Clock size={16} />
            {format(currentTime, "HH:mm:ss")}
          </div>

          <button
            onClick={() => setSession(null)}
            className="text-slate-500 hover:text-rose-400 ml-2 transition-colors p-2 hover:bg-rose-950/20 rounded-md"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* MAIN BODY */}
      <main className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL: 40% WIDTH */}
        <div className="w-[40%] flex flex-col border-r border-slate-800 bg-slate-900/30 p-8 overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Activity size={14} className="text-indigo-500" /> Script
              Generator
            </h2>
            <span className="text-[10px] font-mono text-slate-600 bg-slate-950 px-2 py-1 rounded border border-slate-800">
              {PROVIDERS.length} PROVIDERS LOADED
            </span>
          </div>

          <div className="space-y-6">
            {/* 1. PROVIDER SELECTOR (Minimalist Dropdown) */}
            <div className="group">
              <label className="text-xs text-slate-400 font-medium mb-2 block group-focus-within:text-indigo-400 transition-colors">
                Provider
              </label>
              <div className="relative">
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer hover:border-slate-700 font-medium text-slate-200"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>

                {/* Dropdown Arrow Icon */}
                <div className="absolute right-4 top-3.5 pointer-events-none text-slate-500 group-hover:text-slate-300">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </div>
              </div>
            </div>

            {/* 2. PROFIT / LOSS TOGGLE (Sleek Segmented Control) */}
            <div>
              <label className="text-xs text-slate-400 font-medium mb-2 block">
                Outcome
              </label>
              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setResultType("profit")}
                  className={`flex-1 py-2 text-xs font-bold rounded-md transition-all duration-300 ${resultType === "profit" ? "bg-emerald-950 text-emerald-400 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
                >
                  PROFIT
                </button>
                <button
                  onClick={() => setResultType("loss")}
                  className={`flex-1 py-2 text-xs font-bold rounded-md transition-all duration-300 ${resultType === "loss" ? "bg-rose-950 text-rose-400 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
                >
                  LOSS
                </button>
              </div>
            </div>

            {/* 3. INPUTS */}
            <div className="space-y-4">
              <div className="group">
                <label className="text-xs text-slate-400 font-medium mb-1.5 block group-focus-within:text-indigo-400">
                  Member ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 pl-10 text-sm outline-none focus:border-indigo-500 font-mono text-slate-200 placeholder:text-slate-700 transition-all"
                    placeholder="e.g. MEM-8829"
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                  />
                  <Users
                    size={16}
                    className="absolute left-3 top-3.5 text-slate-600 group-focus-within:text-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div className="group">
                <label className="text-xs text-slate-400 font-medium mb-1.5 block group-focus-within:text-indigo-400">
                  Time Period
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 pl-10 text-sm outline-none focus:border-indigo-500 font-mono text-slate-200 placeholder:text-slate-700 transition-all"
                    placeholder="YYYY-MM-DD HH:MM - HH:MM"
                    value={timePeriod}
                    onChange={(e) => setTimePeriod(e.target.value)}
                  />
                  <Clock
                    size={16}
                    className="absolute left-3 top-3.5 text-slate-600 group-focus-within:text-indigo-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* 4. CLICK-TO-COPY PREVIEW BOX */}
            <div className="pt-2">
              <label className="text-xs text-slate-400 font-medium mb-2 block flex justify-between">
                <span>Script Preview</span>
                {(!memberId || !timePeriod) && (
                  <span className="text-[10px] text-rose-500 flex items-center gap-1">
                    <AlertTriangle size={10} /> Input Required
                  </span>
                )}
              </label>

              <div
                onClick={() => {
                  if (!memberId || !timePeriod) return; // Block copy if empty
                  if (resultType === "loss") return; // Block copy if loss
                  copyToClipboard();
                }}
                className={`
                  relative group p-5 rounded-lg border font-mono text-xs whitespace-pre-wrap leading-relaxed transition-all duration-200
                  ${
                    !memberId || !timePeriod || resultType === "loss"
                      ? "bg-slate-950 border-slate-800 text-slate-600 cursor-not-allowed opacity-80"
                      : "bg-slate-950 border-slate-700 text-slate-300 cursor-pointer hover:border-emerald-500/50 hover:bg-slate-900 hover:shadow-[0_0_20px_-5px_rgba(16,185,129,0.1)]"
                  }
                `}
              >
                {generateScript()}

                {/* OVERLAY: Prompt User to Click */}
                {memberId && timePeriod && resultType !== "loss" && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-slate-950/80 backdrop-blur-sm transition-opacity rounded-lg">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold tracking-wide uppercase">
                      <Copy size={18} /> Click to Copy
                    </div>
                  </div>
                )}

                {/* OVERLAY: Locked State */}
                {(!memberId || !timePeriod) && (
                  <div className="absolute top-3 right-3 text-slate-700">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Helper Text under box */}
              <div className="flex justify-between mt-2">
                {resultType === "loss" ? (
                  <span className="text-[10px] text-rose-500 flex items-center gap-1">
                    <AlertTriangle size={12} /> Loss scripts cannot be copied.
                    Confirm manually.
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">
                    {!memberId || !timePeriod
                      ? "Complete inputs to unlock copy"
                      : "Tap box to copy to clipboard"}
                  </span>
                )}
              </div>
            </div>

            {/* 5. PRIMARY ACTION BUTTON */}
            <button
              onClick={createTicket}
              disabled={!memberId || !timePeriod}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-lg flex items-center justify-center gap-2 text-sm font-bold shadow-lg shadow-indigo-900/20 transition-all active:scale-[0.98] mt-4"
            >
              <Activity size={18} /> Create Ticket
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: 60% WIDTH - ACTIVE INVESTIGATIONS */}
        <div className="w-[60%] flex flex-col bg-slate-950">
          {/* Header */}
          <div className="h-16 flex items-center justify-between px-8 border-b border-slate-800 bg-slate-950/50 backdrop-blur">
            <div>
              <h2 className="text-sm font-bold text-slate-200 tracking-wide">
                Active Investigations
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time collaboration board
              </p>
            </div>

            <button
              onClick={handoverAll}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 border border-indigo-900/50 hover:border-indigo-500/50 bg-indigo-950/30 px-4 py-2 rounded-lg transition-all uppercase tracking-wide flex items-center gap-2 hover:shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)]"
            >
              <Users size={14} />
              Handover Pending
            </button>
          </div>

          {/* Ticket Table */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900 shadow-sm">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4 w-28">Status</th>
                    <th className="px-6 py-4">Member ID</th>
                    <th className="px-6 py-4">Provider</th>
                    <th className="px-6 py-4 w-24 text-right">Logged</th>
                    {/* NEW: Split Actions into two columns */}
                    <th className="px-6 py-4 w-32 text-center">Verdict</th>
                    <th className="px-6 py-4 w-24 text-right">Tools</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {tickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className="group hover:bg-slate-800/40 transition-colors"
                    >
                      {/* 1. STATUS */}
                      <td className="px-6 py-4">
                        <StatusBadge status={ticket.status} />
                      </td>

                      {/* 2. MEMBER ID */}
                      <td className="px-6 py-4 font-mono text-slate-300 group-hover:text-white transition-colors">
                        {ticket.member_id}
                      </td>

                      {/* 3. PROVIDER */}
                      <td className="px-6 py-4 text-slate-400">
                        {ticket.provider}
                      </td>

                      {/* 4. TIME */}
                      <td className="px-6 py-4 text-right font-mono text-xs text-slate-500">
                        {format(new Date(ticket.created_at), "HH:mm")}
                      </td>

                      {/* 5. VERDICT COLUMN (Normal/Abnormal) */}
                      <td className="px-6 py-4 text-center">
                        {/* Only show these buttons if ticket is NOT resolved yet */}
                        {ticket.status !== "normal" &&
                        ticket.status !== "abnormal" ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openModal("normal", ticket)}
                              className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-900/50 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                              title="Mark Normal"
                            >
                              <CheckCircle size={16} />
                            </button>
                            <button
                              onClick={() => openModal("abnormal", ticket)}
                              className="p-2 rounded-lg bg-rose-950/30 border border-rose-900/50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                              title="Mark Abnormal"
                            >
                              <AlertOctagon size={16} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-600 font-mono">
                            -
                          </span>
                        )}
                      </td>

                      {/* 6. TOOLS COLUMN (Copy/Edit/Delete) */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                          {/* NEW: Smart Copy Button */}
                          <button
                            onClick={() => handleRowCopy(ticket)}
                            className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
                            title="Copy Related Script"
                          >
                            <Copy size={16} />
                          </button>

                          <button
                            onClick={() => openModal("edit", ticket)}
                            className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded transition-colors"
                            title="Edit Details"
                          >
                            <Edit2 size={16} />
                          </button>

                          <button
                            onClick={() => openModal("delete", ticket)}
                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-800 rounded transition-colors"
                            title="Delete Ticket"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* --- POPUP MODALS --- */}
          {modalType && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* DELETE POPUP */}
                {modalType === "delete" && (
                  <div className="p-6 text-center">
                    <div className="w-12 h-12 bg-rose-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-500">
                      <Trash2 />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">
                      Delete Ticket?
                    </h3>
                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={closeModal}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={deleteTicket}
                        className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-2 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                {/* EDIT POPUP */}
                {modalType === "edit" && (
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-white mb-4">
                      Edit Ticket
                    </h3>
                    <div className="space-y-4">
                      <input
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                        value={editMemberId}
                        onChange={(e) => setEditMemberId(e.target.value)}
                      />
                      <input
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                        value={editTimePeriod}
                        onChange={(e) => setEditTimePeriod(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={closeModal}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveEdit}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}

                {/* ABNORMAL SCRIPT POPUP */}
                {modalType === "abnormal" && (
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <AlertTriangle className="text-rose-500" /> SOP Violation
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs text-slate-400 font-bold block mb-1">
                          ENTER VIOLATION TYPE
                        </label>
                        <input
                          autoFocus
                          className="w-full bg-slate-950 border border-rose-900/50 rounded p-3 text-white focus:border-rose-500 outline-none"
                          placeholder="e.g. Arbitrage"
                          value={abnormalType}
                          onChange={(e) => setAbnormalType(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={closeModal}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={confirmAbnormal}
                        disabled={!abnormalType}
                        className="flex-[2] bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white py-3 rounded font-bold flex items-center justify-center gap-2"
                      >
                        <Copy size={16} /> Copy Script & Finish
                      </button>
                    </div>
                  </div>
                )}
                {/* NORMAL CONFIRMATION POPUP (With Script) */}
                {modalType === "normal" && (
                  <div className="p-6 text-center">
                    <div className="w-12 h-12 bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-500">
                      <CheckCircle size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">
                      Confirm Normal?
                    </h3>

                    {/* Script Preview Box */}
                    <div className="bg-slate-950 p-4 rounded border border-slate-800 font-mono text-xs text-slate-400 mb-6 text-left">
                      Hi sir as we checked, the member bet is normal. Thank you
                      -{" "}
                      <span className="text-indigo-400">
                        {session.display_name || session.username}
                      </span>
                      .
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={closeModal}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          // 1. Generate & Copy Script
                          const text = `Hi sir as we checked, the member bet is normal. Thank you - ${session.display_name || session.username}.`;
                          navigator.clipboard.writeText(text);

                          // 2. Update DB
                          updateTicketStatus(selectedTicket.id, "normal");
                          closeModal();
                        }}
                        className="flex-[1.5] bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded font-bold transition-colors shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
                      >
                        <Copy size={16} /> Copy & Confirm
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
