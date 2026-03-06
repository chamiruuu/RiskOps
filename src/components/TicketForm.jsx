import { useState, useRef, useEffect } from "react";
import { Copy, Plus, ChevronDown, Check, BookOpen, FileText, AlertCircle, Shield, Clock, TrendingDown, Hand, Lock, CheckCircle2, Calendar } from "lucide-react";
import { useDuty } from "../context/DutyContext";
import { PROVIDER_CONFIG } from "../config/providerConfig";
import { useMerchantData } from "../hooks/useMerchantData";
import notificationSound from '../assets/Notification.mp3';

// --- HELPER: Get Current GMT+8 Time ---
const getGMT8Time = () => {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * 8);
};

// --- HELPER: Format Date to YYYY-MM-DD ---
const getFormattedDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// HELPER: Check if time is currently inside the handover window
const checkIsHandoverWindow = () => {
  const now = getGMT8Time();
  const h = now.getHours();
  const m = now.getMinutes();
  return (h === 14 && m >= 15 && m <= 45) || 
         (h === 22 && m >= 15 && m <= 45) || 
         (h === 6 && m >= 45) || (h === 7 && m <= 15);
};

export default function TicketForm({ onAddTicket }) {
  const { selectedDuty, user, workName, isMyShiftActive, userRole } = useDuty();
  const [activeTab, setActiveTab] = useState("form");
  const [copied, setCopied] = useState(false);
  const [copiedSop, setCopiedSop] = useState(false);
  
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const shortWorkName = workName ? workName.split(" ")[0] : "RiskOps";
  
  const [copiedLoss, setCopiedLoss] = useState(false);
  const [copiedHold, setCopiedHold] = useState(false);

  // --- Searchable Provider Dropdown States ---
  const [isProviderOpen, setIsProviderOpen] = useState(false);
  const [providerSearch, setProviderSearch] = useState("");
  const providerRef = useRef(null);

  // --- Smart Date Picker States ---
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const dateRef = useRef(null);

  // --- SHIFT LOCKOUT STATE ---
  const [isInHandoverWindow, setIsInHandoverWindow] = useState(checkIsHandoverWindow());
  
  useEffect(() => {
    const timer = setInterval(() => {
      setIsInHandoverWindow(checkIsHandoverWindow());
    }, 60000); 
    return () => clearInterval(timer);
  }, []);

  const isAdminOrLeader = userRole === 'Admin' || userRole === 'Leader';
  const canCreate = isMyShiftActive || isAdminOrLeader || isInHandoverWindow;

  const [formData, setFormData] = useState({
    loginId: "",
    memberId: "",
    providerAccount: "",
    provider: "", 
    trackingId: "",
    timeRange: "",
    currency: "",
    reasonToCheck: "",
    gameName: "",
    betTicket: "",
    roundId: "",
    ipAddress: "",
  });

  useEffect(() => {
    setProviderSearch(formData.provider);
  }, [formData.provider]);

  // Handle clicking outside custom dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (providerRef.current && !providerRef.current.contains(event.target)) {
        setIsProviderOpen(false);
        setProviderSearch(formData.provider); 
      }
      if (dateRef.current && !dateRef.current.contains(event.target)) {
        setIsDateOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [formData.provider]);

  const filteredProviders = Object.keys(PROVIDER_CONFIG).filter(p =>
    p.toLowerCase().includes(providerSearch.toLowerCase())
  );

  const { name: merchantName, error: dutyError } = useMerchantData(formData.memberId, selectedDuty);
  const currentConfig = PROVIDER_CONFIG[formData.provider];

  const generatedScript = currentConfig ? currentConfig.generateScript(formData, shortWorkName) : "// Waiting for provider selection...";

  const isFormValid = () => {
    if (!currentConfig) return false; 
    if (currentConfig?.isManualCheckOnly) return false;
    if (!formData.memberId || dutyError) return false;

    const required = currentConfig?.requiredFields || [];

    if (required.includes("betTicket") && required.includes("timeRange")) {
      const hasProviderAcc = formData.providerAccount && formData.providerAccount.trim() !== "";
      const hasEitherBetOrTime = (formData.betTicket && formData.betTicket.trim() !== "") || (formData.timeRange && formData.timeRange.trim() !== "");
      const otherFieldsValid = required.filter((field) => field !== "betTicket" && field !== "timeRange").every((field) => formData[field] && formData[field].trim() !== "");
      return hasProviderAcc && hasEitherBetOrTime && otherFieldsValid;
    }

    if (required.includes("roundId") && required.includes("timeRange")) {
      const hasProviderAcc = formData.providerAccount && formData.providerAccount.trim() !== "";
      const hasEitherRoundOrTime = (formData.roundId && formData.roundId.trim() !== "") || (formData.timeRange && formData.timeRange.trim() !== "");
      const otherFieldsValid = required.filter((field) => field !== "roundId" && field !== "timeRange").every((field) => formData[field] && formData[field].trim() !== "");
      return hasProviderAcc && hasEitherRoundOrTime && otherFieldsValid;
    }

    return required.every((field) => formData[field] && formData[field].trim() !== "");
  };

  const handleCopy = () => {
    if (!generatedScript.startsWith("//")) {
      navigator.clipboard.writeText(generatedScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopySop = () => {
    if (currentConfig?.conditionScript) {
      navigator.clipboard.writeText(currentConfig.conditionScript(shortWorkName));
      setCopiedSop(true);
      setTimeout(() => setCopiedSop(false), 2000);
    }
  };

  const handleCopyLoss = () => {
    const script = `Hello team, this is ${shortWorkName}. As we confirmed the member has no profit from the provider during this period. Do you still need to check member bet normal or not?`;
    navigator.clipboard.writeText(script);
    setCopiedLoss(true);
    setTimeout(() => setCopiedLoss(false), 2000);
  };

  const handleCopyHold = () => {
    const script = `This issue has been forwarded to the related team to be confirmed, Kindly be reminded that if the member applies for withdrawal before we receive any response, we suggest you not to approve it until we have the result, we will inform you as soon as we have any update, Thank You. - ${shortWorkName}`;
    navigator.clipboard.writeText(script);
    setCopiedHold(true);
    setTimeout(() => setCopiedHold(false), 2000);
  };

  // --- SMART DATE PICKER LOGIC ---
  const applyQuickDate = (daysBack) => {
    const today = getGMT8Time();
    
    if (daysBack === 'today') {
      setFormData({ ...formData, timeRange: getFormattedDate(today) });
    } else if (daysBack === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      setFormData({ ...formData, timeRange: getFormattedDate(yesterday) });
    } else {
      const start = new Date(today);
      start.setDate(today.getDate() - (daysBack - 1));
      setFormData({ ...formData, timeRange: `${getFormattedDate(start)} - ${getFormattedDate(today)}` });
    }
    setIsDateOpen(false);
  };

  const applyCustomDate = () => {
    if (customFrom && customTo) {
      setFormData({ ...formData, timeRange: `${customFrom} - ${customTo}` });
    } else if (customFrom) {
      setFormData({ ...formData, timeRange: customFrom });
    } else if (customTo) {
      setFormData({ ...formData, timeRange: customTo });
    }
    setIsDateOpen(false);
  };

  const handleCreateClick = () => {
    const extractedMerchantId = formData.memberId.includes("@") ? formData.memberId.split("@")[1] : "-";

    const newTicket = {
      merchant_name: extractedMerchantId,
      ic_account: selectedDuty, 
      login_id: formData.loginId || "-", 
      member_id: formData.memberId,
      provider_id: formData.providerAccount || "-", 
      provider_account: formData.providerAccount || "-", 
      provider: formData.provider,
      time_range: formData.timeRange || "-", 
      tracking_no: "",
      recorder: workName || "RiskOps",
      status: "Pending",
      notes: [] 
    };

    onAddTicket(newTicket);

    setFormData({
      loginId: "", memberId: "", providerAccount: "", provider: "", 
      trackingId: "", timeRange: "", currency: "", reasonToCheck: "", gameName: "", betTicket: "", roundId: "", ipAddress: "",
    });

    const audio = new Audio(notificationSound);
    audio.play().catch(e => console.log("Audio blocked by browser"));

    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  return (
    <aside className="w-[380px] bg-white rounded-2xl shadow-xl border border-slate-100 flex flex-col shrink-0 overflow-hidden relative">
      
      {showSuccessToast && (
        <div className="fixed bottom-8 right-8 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-emerald-500 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold whitespace-nowrap border border-emerald-400">
            <div className="bg-emerald-600 p-1 rounded-full">
              <CheckCircle2 size={18} className="text-emerald-100" />
            </div>
            <span className="text-sm">Ticket Created Successfully!</span>
          </div>
        </div>
      )}

      <div className="px-6 pt-6 pb-2 border-b border-slate-50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">New Investigation</h2>
          {!canCreate && (
            <span className="text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 px-2 py-1 rounded-md flex items-center gap-1 shadow-sm" title="You cannot create tickets until the handover window opens">
              <Lock size={10} /> Shift Locked
            </span>
          )}
        </div>
        <div className="flex p-1 bg-slate-100 rounded-lg mb-2">
          <button onClick={() => setActiveTab("form")} className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === "form" ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><FileText size={14} /> Generator</button>
          <button onClick={() => setActiveTab("sop")} className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === "sop" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><BookOpen size={14} /> SOP Guide</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "form" ? (
          <div className="p-6 space-y-4">
            
            <div ref={providerRef} className="relative z-20">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Provider Source <span className="text-red-500">*</span></label>
              <div className="relative">
                <input 
                  type="text"
                  value={providerSearch}
                  onChange={(e) => {
                    setProviderSearch(e.target.value);
                    setIsProviderOpen(true);
                  }}
                  onFocus={() => setIsProviderOpen(true)}
                  placeholder="Search provider..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-100 transition-all cursor-text"
                />
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                  <ChevronDown size={14} className={`transition-transform duration-200 ${isProviderOpen ? "rotate-180" : ""}`} />
                </div>
              </div>

              {isProviderOpen && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 shadow-xl rounded-lg max-h-60 overflow-y-auto py-1 animate-in fade-in zoom-in-95 duration-100">
                  {filteredProviders.length > 0 ? (
                    filteredProviders.map((key) => (
                      <div
                        key={key}
                        onClick={() => {
                          setFormData({ ...formData, provider: key });
                          setProviderSearch(key);
                          setIsProviderOpen(false);
                        }}
                        className={`px-3 py-2.5 text-sm cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 transition-colors ${formData.provider === key ? "bg-indigo-50/50 font-bold text-indigo-700" : "text-slate-700 font-medium"}`}
                      >
                        {key}
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-sm text-slate-400 text-center italic">No providers found</div>
                  )}
                </div>
              )}
            </div>

            {currentConfig && (
              <>
                {!currentConfig?.isManualCheckOnly && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Member ID <span className="text-red-500">*</span></label>
                      <input type="text" placeholder="e.g. user@017" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" value={formData.memberId} onChange={(e) => setFormData({ ...formData, memberId: e.target.value })} />
                    </div>

                    {currentConfig?.requiredFields?.includes("providerAccount") && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Provider Account ID <span className="text-red-500">*</span></label>
                        <input type="text" placeholder="e.g. gapi_12345" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" value={formData.providerAccount} onChange={(e) => setFormData({ ...formData, providerAccount: e.target.value })} />
                      </div>
                    )}

                    {currentConfig?.requiredFields?.includes("currency") && (
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase">Currency <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-100 transition-all" value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })}>
                            <option value="" disabled>Select Currency</option>
                            {(currentConfig.options?.currencies || ["IDR", "MYR", "CNY", "THB", "KRW", "USD", "VND", "PHP", "SGD"]).map((c) => (<option key={c} value={c}>{c}</option>))}
                          </select>
                          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400"><ChevronDown size={14} /></div>
                        </div>
                      </div>
                    )}

                    {currentConfig?.requiredFields?.includes("reasonToCheck") && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Reason to Check <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-100 transition-all" value={formData.reasonToCheck} onChange={(e) => setFormData({ ...formData, reasonToCheck: e.target.value })}>
                            <option value="">Select Reason...</option>
                            {currentConfig.options?.reasons?.map((r, idx) => (<option key={idx} value={r}>{r.substring(0, 70)}...</option>))}
                          </select>
                          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400"><ChevronDown size={14} /></div>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Merchant Group</label>
                      <input type="text" readOnly className={`w-full px-3 py-2 border rounded-lg text-sm italic transition-all ${dutyError ? "bg-red-50 border-red-200 text-red-600 shadow-[0_0_0_2px_rgba(239,68,68,0.1)]" : "bg-slate-100 border-slate-200 text-slate-500"}`} value={merchantName || "Auto-detecting..."} />
                      {dutyError && <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1">⚠️ {dutyError}</p>}
                    </div>

                    {/* --- THE NEW SMART DATE PICKER --- */}
                    {currentConfig?.requiredFields?.includes("timeRange") && (
                      <div ref={dateRef} className="relative z-10">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Time Period <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <input 
                            type="text" 
                            placeholder="e.g. 2026-03-01 - 2026-03-07" 
                            className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-100 transition-all cursor-text" 
                            value={formData.timeRange} 
                            onChange={(e) => setFormData({ ...formData, timeRange: e.target.value })}
                            onFocus={() => setIsDateOpen(true)}
                          />
                          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                            <Calendar size={14} className={isDateOpen ? "text-indigo-500" : ""} />
                          </div>
                        </div>
                        
                        {isDateOpen && (
                          <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 shadow-xl rounded-xl p-3 animate-in fade-in zoom-in-95 duration-100 z-50">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Quick Select</p>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              <button type="button" onClick={() => applyQuickDate('today')} className="py-2 text-xs font-bold bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-100 hover:border-indigo-200 text-slate-700 rounded-lg transition-colors">Today</button>
                              <button type="button" onClick={() => applyQuickDate('yesterday')} className="py-2 text-xs font-bold bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-100 hover:border-indigo-200 text-slate-700 rounded-lg transition-colors">Yesterday</button>
                              <button type="button" onClick={() => applyQuickDate(3)} className="py-2 text-xs font-bold bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-100 hover:border-indigo-200 text-slate-700 rounded-lg transition-colors">Last 3 Days</button>
                              <button type="button" onClick={() => applyQuickDate(7)} className="py-2 text-xs font-bold bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-100 hover:border-indigo-200 text-slate-700 rounded-lg transition-colors">Last 7 Days</button>
                            </div>
                            
                            <div className="border-t border-slate-100 pt-3">
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Custom Range</p>
                              <div className="flex items-center gap-2 mb-3">
                                <input 
                                  type="date" 
                                  className="flex-1 w-full text-xs font-bold text-slate-700 border border-slate-200 bg-slate-50 rounded-lg px-2 py-2 outline-none focus:border-indigo-400 focus:bg-white" 
                                  value={customFrom} 
                                  onChange={e => setCustomFrom(e.target.value)} 
                                />
                                <span className="text-slate-400 text-xs font-bold">-</span>
                                <input 
                                  type="date" 
                                  className="flex-1 w-full text-xs font-bold text-slate-700 border border-slate-200 bg-slate-50 rounded-lg px-2 py-2 outline-none focus:border-indigo-400 focus:bg-white" 
                                  value={customTo} 
                                  onChange={e => setCustomTo(e.target.value)} 
                                />
                              </div>
                              <button type="button" onClick={applyCustomDate} className="w-full py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors">
                                Apply Custom Date
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {currentConfig?.requiredFields?.includes("gameName") && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Game Name <span className="text-red-500">*</span></label>
                        <input type="text" placeholder="e.g. Sweet Bonanza" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" value={formData.gameName} onChange={(e) => setFormData({ ...formData, gameName: e.target.value })} />
                      </div>
                    )}

                    {currentConfig?.requiredFields?.includes("trackingId") && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Tracking ID</label>
                        <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" value={formData.trackingId} onChange={(e) => setFormData({ ...formData, trackingId: e.target.value })} />
                      </div>
                    )}

                    {currentConfig?.requiredFields?.includes("betTicket") && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Bet Ticket Number</label>
                        <input type="text" placeholder="Leave blank if using Time Period" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" value={formData.betTicket} onChange={(e) => setFormData({ ...formData, betTicket: e.target.value })} />
                      </div>
                    )}

                    {currentConfig?.requiredFields?.includes("roundId") && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Round ID</label>
                        <input type="text" placeholder="Leave blank if using Time Period" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" value={formData.roundId || ""} onChange={(e) => setFormData({ ...formData, roundId: e.target.value })} />
                      </div>
                    )}

                    {currentConfig?.requiredFields?.includes("ipAddress") && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">IP Address <span className="text-red-500">*</span></label>
                        <input type="text" placeholder="e.g. 192.168.1.1" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" value={formData.ipAddress} onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })} />
                      </div>
                    )}

                    {!currentConfig?.requiredFields?.includes("trackingId") && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Login ID</label>
                        <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" value={formData.loginId} onChange={(e) => setFormData({ ...formData, loginId: e.target.value })} />
                      </div>
                    )}
                  </>
                )}

                <button 
                  disabled={!isFormValid() || !canCreate} 
                  onClick={handleCreateClick} 
                  className={`w-full py-2.5 font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 mt-4 
                    ${!canCreate ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed" : 
                      isFormValid() ? "bg-black hover:bg-slate-800 text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}
                >
                  {!canCreate ? <Lock size={16} /> : <Plus size={18} />} 
                  {!canCreate ? "Locked until Handover" : "Create Ticket"}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {!currentConfig ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-50 py-10">
                <BookOpen size={32} className="text-slate-400 mb-2" />
                <p className="text-xs text-slate-500 font-medium">Select a provider<br />to view its SOP Guide.</p>
              </div>
            ) : (
              <>
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <h3 className="text-xs font-bold text-indigo-900 uppercase mb-1">Submit To</h3>
                  <p className="text-sm font-semibold text-indigo-700">{currentConfig.channel}</p>
                  <p className="text-[10px] text-indigo-500 mt-1">SLA: {currentConfig.sla}</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-slate-900 uppercase flex items-center gap-2"><Shield size={12} /> Query Conditions</h3>
                    {currentConfig.conditionScript && (
                      <button onClick={handleCopySop} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1">
                        {copiedSop ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy Script</>}
                      </button>
                    )}
                  </div>
                  {currentConfig.conditionScript && <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-mono text-slate-600 whitespace-pre-wrap leading-relaxed">{currentConfig.conditionScript(shortWorkName)}</div>}
                  <ul className="space-y-2 mt-2">
                    {currentConfig.conditions.map((item, i) => (
                      <li key={i} className="text-xs text-slate-600 flex gap-2 items-start"><span className="w-1.5 h-1.5 bg-slate-300 rounded-full mt-1.5 shrink-0"></span>{item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase mb-2 flex items-center gap-2"><Clock size={12} /> Investigation Steps</h3>
                  <div className="space-y-3">
                    {currentConfig.process.map((step, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center border border-slate-200">{i + 1}</div>
                          {i !== currentConfig.process.length - 1 && <div className="w-px h-full bg-slate-100 my-1"></div>}
                        </div>
                        <div className="py-0.5 w-full">
                          <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{typeof step === "string" ? step : step.text}</p>
                          {typeof step === "object" && step.copyText && (
                            <div className="mt-2 mb-3 relative group">
                              <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-[11px] text-slate-700 font-mono whitespace-pre-wrap pr-10">{step.copyText.replace("[Your Name]", shortWorkName)}</div>
                              <button onClick={() => navigator.clipboard.writeText(step.copyText.replace("[Your Name]", shortWorkName))} className="absolute top-2 right-2 p-1.5 bg-white border border-slate-200 rounded-md shadow-sm text-slate-400 hover:text-blue-500 hover:border-blue-300 opacity-0 group-hover:opacity-100 transition-all" title="Copy script"><Copy size={14} /></button>
                            </div>
                          )}
                          {typeof step === "object" && step.image && (
                            <div className="mt-2">
                              <a href={step.image} target="_blank" rel="noopener noreferrer" className="block cursor-pointer hover:opacity-85 transition-opacity" title="Click to open image in new tab">
                                <img src={step.image} alt={`Reference step ${i + 1}`} className="w-full rounded-md border border-slate-200 shadow-sm" />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {currentConfig.reminder && (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex gap-2 items-start">
                    <AlertCircle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-[10px] font-medium text-amber-700 leading-snug">{currentConfig.reminder}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {activeTab === "form" && (
        <div className="p-6 bg-slate-50/50 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase">Script Preview</span>
            
            <div className="flex items-center gap-1.5">
              <button 
                onClick={handleCopyLoss}
                className="group p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                title="Copy Loss Confirmation Script"
              >
                {copiedLoss ? <Check size={14} className="text-emerald-500" /> : <TrendingDown size={14} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />} 
              </button>
              <button 
                onClick={handleCopyHold}
                className="group p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                title="Copy Hold Withdrawal Script"
              >
                {copiedHold ? <Check size={14} className="text-emerald-500" /> : <Hand size={14} className="text-slate-400 group-hover:text-rose-500 transition-colors" />} 
              </button>
            </div>
          </div>

          <div 
            onClick={handleCopy}
            className={`relative group bg-white border rounded-xl p-4 text-xs font-mono h-[130px] overflow-y-auto shadow-sm leading-relaxed transition-all 
              ${!generatedScript.startsWith("//") ? "cursor-pointer hover:border-indigo-400 hover:ring-4 hover:ring-indigo-50 text-slate-700" : "text-slate-400 cursor-not-allowed border-slate-200"} 
              ${copied ? "border-emerald-500 bg-emerald-50 ring-4 ring-emerald-50" : "border-slate-200"}`}
            title={!generatedScript.startsWith("//") ? "Click to copy script" : ""}
          >
            {copied ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-emerald-600 animate-in fade-in duration-200 bg-emerald-50">
                <Check size={28} className="mb-2 text-emerald-500" />
                <span className="font-bold text-sm">Copied to Clipboard!</span>
              </div>
            ) : (
              <div className="whitespace-pre-wrap">
                {generatedScript}
              </div>
            )}
            
            {!generatedScript.startsWith("//") && !copied && (
              <div className="sticky bottom-0 right-0 float-right opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                <Copy size={12} /> Click anywhere to copy
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}