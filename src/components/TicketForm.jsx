import { useState } from "react";
import { Copy, Plus, ChevronDown, Check, BookOpen, FileText, AlertCircle, Shield, Clock } from "lucide-react";
import { useDuty } from "../context/DutyContext";
import { PROVIDER_CONFIG } from "../config/providerConfig";
import { useMerchantData } from "../hooks/useMerchantData";

export default function TicketForm({ onAddTicket }) {
  const { selectedDuty, user } = useDuty();
  const [activeTab, setActiveTab] = useState("form");
  const [copied, setCopied] = useState(false);
  const [copiedSop, setCopiedSop] = useState(false);

  const [formData, setFormData] = useState({
    loginId: "",
    memberId: "",
    providerAccount: "",
    provider: "PG Soft",
    trackingId: "",
    timeRange: "",
    currency: "",
    reasonToCheck: "",
    gameName: "",
    betTicket: "",
    roundId: "",
  });

  const { name: merchantName, error: dutyError } = useMerchantData(formData.memberId, selectedDuty);
  const currentConfig = PROVIDER_CONFIG[formData.provider];
  const workName = user?.email?.split("@")[0] || "RiskOps";

  const generatedScript = currentConfig ? currentConfig.generateScript(formData, workName) : "// Script not configured";

  const isFormValid = () => {
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
      navigator.clipboard.writeText(currentConfig.conditionScript(workName));
      setCopiedSop(true);
      setTimeout(() => setCopiedSop(false), 2000);
    }
  };

  // --- NEW: LOGIC TO PACKAGE AND SEND TICKET TO APP.JSX ---
  const handleCreateClick = () => {
    const extractedMerchantId = formData.memberId.includes("@") ? formData.memberId.split("@")[1] : "-";

    const newTicket = {
      merchant_name: extractedMerchantId,
      
      // 1. THIS IS YOUR DUTY (Satisfies the NOT NULL Enum constraint perfectly)
      ic_account: selectedDuty, 
      
      // 2. THIS IS THE LOGIN BOX (Saves empty if you leave it empty)
      login_id: formData.loginId || "-", 
      
      member_id: formData.memberId,
      provider_id: formData.providerAccount || "-", 
      provider_account: formData.providerAccount || "-", 
      provider: formData.provider,
      time_range: formData.timeRange || "-", 
      tracking_no: "",
      recorder: workName,
      status: "Pending",
      notes: [] 
    };

    onAddTicket(newTicket);

    // Clear form
    setFormData({
      loginId: "", memberId: "", providerAccount: "", provider: formData.provider,
      trackingId: "", timeRange: "", currency: "", reasonToCheck: "", gameName: "", betTicket: "", roundId: "",
    });
  };

  return (
    <aside className="w-[380px] bg-white rounded-2xl shadow-xl border border-slate-100 flex flex-col shrink-0 overflow-hidden">
      <div className="px-6 pt-6 pb-2 border-b border-slate-50">
        <h2 className="text-lg font-bold text-slate-900 mb-4">New Investigation</h2>
        <div className="flex p-1 bg-slate-100 rounded-lg mb-2">
          <button onClick={() => setActiveTab("form")} className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === "form" ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><FileText size={14} /> Generator</button>
          <button onClick={() => setActiveTab("sop")} className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === "sop" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><BookOpen size={14} /> SOP Guide</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "form" ? (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Provider Source</label>
              <div className="relative">
                <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none" value={formData.provider} onChange={(e) => setFormData({ ...formData, provider: e.target.value })}>
                  {Object.keys(PROVIDER_CONFIG).map((key) => (<option key={key} value={key}>{key}</option>))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-2.5 text-slate-400" />
              </div>
            </div>

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
                      <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" value={formData.reasonToCheck} onChange={(e) => setFormData({ ...formData, reasonToCheck: e.target.value })}>
                        <option value="">Select Reason...</option>
                        {currentConfig.options?.reasons?.map((r, idx) => (<option key={idx} value={r}>{r.substring(0, 70)}...</option>))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-2.5 text-slate-400" />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Merchant Group</label>
                  <input type="text" readOnly className={`w-full px-3 py-2 border rounded-lg text-sm italic transition-all ${dutyError ? "bg-red-50 border-red-200 text-red-600 shadow-[0_0_0_2px_rgba(239,68,68,0.1)]" : "bg-slate-100 border-slate-200 text-slate-500"}`} value={merchantName || "Auto-detecting..."} />
                  {dutyError && <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1">⚠️ {dutyError}</p>}
                </div>

                {currentConfig?.requiredFields?.includes("timeRange") && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Time Period <span className="text-red-500">*</span></label>
                    <input type="text" placeholder="e.g. 10:00 - 12:00" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" value={formData.timeRange} onChange={(e) => setFormData({ ...formData, timeRange: e.target.value })} />
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

                {!currentConfig?.requiredFields?.includes("trackingId") && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Login ID</label>
                    <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" value={formData.loginId} onChange={(e) => setFormData({ ...formData, loginId: e.target.value })} />
                  </div>
                )}
              </>
            )}

            <button disabled={!isFormValid()} onClick={handleCreateClick} className={`w-full py-2.5 font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 mt-4 ${isFormValid() ? "bg-black hover:bg-slate-800 text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}>
              <Plus size={18} /> Create Ticket
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-6">
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
              {currentConfig.conditionScript && <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-mono text-slate-600 whitespace-pre-wrap leading-relaxed">{currentConfig.conditionScript(workName)}</div>}
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
                          <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-[11px] text-slate-700 font-mono whitespace-pre-wrap pr-10">{step.copyText.replace("[Your Name]", workName)}</div>
                          <button onClick={() => navigator.clipboard.writeText(step.copyText.replace("[Your Name]", workName))} className="absolute top-2 right-2 p-1.5 bg-white border border-slate-200 rounded-md shadow-sm text-slate-400 hover:text-blue-500 hover:border-blue-300 opacity-0 group-hover:opacity-100 transition-all" title="Copy script"><Copy size={14} /></button>
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
          </div>
        )}
      </div>

      {activeTab === "form" && (
        <div className="p-6 bg-slate-50/50 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase">Script Preview</span>
            <button onClick={handleCopy} className="text-xs font-semibold text-slate-900 hover:text-black flex items-center gap-1">
              {copied ? <><Check size={12} className="text-emerald-500" /> <span className="text-emerald-500">Copied</span></> : <><Copy size={12} /> Copy</>}
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-xs font-mono text-slate-500 min-h-[120px] shadow-sm leading-relaxed overflow-x-auto whitespace-pre">
            {generatedScript}
          </div>
        </div>
      )}
    </aside>
  );
}