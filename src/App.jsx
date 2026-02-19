import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DutyProvider, useDuty } from "./context/DutyContext";
import Login from "./pages/Login";
import { useState, useEffect } from "react";
import {
  Search,
  Copy,
  MoreHorizontal,
  Plus,
  Calendar,
  Clock,
  LogOut,
  Shield,
  ChevronDown,
  Check,
  BookOpen,
  FileText,
  AlertCircle,
} from "lucide-react";
import { supabase } from "./lib/supabase";

import { PROVIDER_CONFIG } from "./config/providerConfig";
import { useMerchantData } from "./hooks/useMerchantData";

function Dashboard() {
  const { selectedDuty, user } = useDuty();
  const [activeTab, setActiveTab] = useState("form");
  const [copied, setCopied] = useState(false);
  const [copiedSop, setCopiedSop] = useState(false); // NEW STATE FOR SOP COPY
  const [currentTime, setCurrentTime] = useState(new Date());

  const activeUsers = [
    { name: "Fernando IPCS", duty: "IC1" },
    { name: "Chamiru", duty: "IC0" },
  ];

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
    betTicket: "", // <-- ADD THIS NEW FIELD
  });

  const { name: merchantName, error: dutyError } = useMerchantData(
    formData.memberId,
    selectedDuty,
  );

  const currentConfig = PROVIDER_CONFIG[formData.provider];
  const workName = user?.email?.split("@")[0] || "RiskOps";

  const generatedScript = currentConfig
    ? currentConfig.generateScript(formData, workName)
    : "// Script not configured";

 const isFormValid = () => {
    // 1. Manual check providers can never submit a ticket
    if (currentConfig?.isManualCheckOnly) return false;

    // 2. Member ID is always required and must be valid
    if (!formData.memberId || dutyError) return false;

    const required = currentConfig?.requiredFields || [];

    // 3. Special Logic for BNG and CQ9 (and any others using betTicket)
    if (required.includes('betTicket') && required.includes('timeRange')) {
      // For these, we need Provider Account AND (either Bet Ticket OR Time Range)
      const hasProviderAcc = formData.providerAccount && formData.providerAccount.trim() !== "";
      const hasEitherBetOrTime = (formData.betTicket && formData.betTicket.trim() !== "") || 
                                 (formData.timeRange && formData.timeRange.trim() !== "");
      
      // Check other required fields that aren't part of the either/or logic (like memberId)
      const otherFieldsValid = required
        .filter(field => field !== 'betTicket' && field !== 'timeRange')
        .every(field => formData[field] && formData[field].trim() !== "");

      return hasProviderAcc && hasEitherBetOrTime && otherFieldsValid;
    }

    // 4. Standard validation for all other providers
    return required.every(
      (field) => formData[field] && formData[field].trim() !== "",
    );
  };

  const handleCopy = () => {
    if (!generatedScript.startsWith("//")) {
      navigator.clipboard.writeText(generatedScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // --- NEW HANDLER FOR SOP COPY ---
  const handleCopySop = () => {
    if (currentConfig?.conditionScript) {
      navigator.clipboard.writeText(currentConfig.conditionScript(workName));
      setCopiedSop(true);
      setTimeout(() => setCopiedSop(false), 2000);
    }
  };

  const getDutyStyle = (role) => {
    switch (role) {
      case "IC0":
        return {
          container: "bg-purple-100 border-purple-200",
          text: "text-purple-700",
          dot: "bg-purple-600",
        };
      case "IC1":
        return {
          container: "bg-indigo-100 border-indigo-200",
          text: "text-indigo-700",
          dot: "bg-indigo-600",
        };
      case "IC2":
        return {
          container: "bg-emerald-100 border-emerald-200",
          text: "text-emerald-700",
          dot: "bg-emerald-600",
        };
      case "IC3":
        return {
          container: "bg-amber-100 border-amber-200",
          text: "text-amber-700",
          dot: "bg-amber-600",
        };
      case "IC5":
        return {
          container: "bg-rose-100 border-rose-200",
          text: "text-rose-700",
          dot: "bg-rose-600",
        };
      default:
        return {
          container: "bg-slate-100 border-slate-200",
          text: "text-slate-700",
          dot: "bg-slate-600",
        };
    }
  };

  const style = getDutyStyle(selectedDuty);
  const dutyNumber = selectedDuty.replace(/\D/g, "").padStart(2, "0");
  const formattedDate = currentTime.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const formattedTime = currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const getGreeting = () => {
    const h = currentTime.getHours();
    return h < 12 ? "Good Morning" : h < 18 ? "Good Afternoon" : "Good Night";
  };

  return (
    <div className="h-screen bg-slate-50 text-slate-900 font-sans flex flex-col overflow-hidden">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 px-6 h-16 flex items-center justify-between shrink-0 z-50 shadow-sm">
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
          <div className="text-xs font-medium text-slate-500 hidden md:block">
            {getGreeting()},{" "}
            <span className="text-slate-900 font-semibold">
              {user?.email?.split("@")[0]}
            </span>
          </div>
          <div className="relative group cursor-default">
            <div className="h-9 px-4 flex items-center gap-2 bg-white border border-slate-200 rounded-full shadow-sm">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span className="text-xs font-semibold text-slate-600">
                {activeUsers.length} Online
              </span>
            </div>
          </div>
          <div className="hidden md:flex items-center h-9 bg-white border border-slate-200 rounded-lg shadow-sm px-4 gap-3">
            <div className="flex items-center gap-2 text-slate-500">
              <Calendar size={14} />
              <span>{formattedDate}</span>
            </div>
            <div className="w-px h-3 bg-slate-300"></div>
            <div className="flex items-center gap-2 text-slate-600">
              <Clock size={14} />
              <span className="tabular-nums">{formattedTime}</span>
              <span className="text-[10px] text-slate-400">UTC+8</span>
            </div>
          </div>
          <div className="pl-2 border-l h-9 flex items-center">
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden p-6 gap-6">
        {/* LEFT PANEL */}
        <aside className="w-[380px] bg-white rounded-2xl shadow-xl border border-slate-100 flex flex-col shrink-0 overflow-hidden">
          <div className="px-6 pt-6 pb-2 border-b border-slate-50">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              New Investigation
            </h2>
            <div className="flex p-1 bg-slate-100 rounded-lg mb-2">
              <button
                onClick={() => setActiveTab("form")}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === "form" ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                <FileText size={14} /> Generator
              </button>
              <button
                onClick={() => setActiveTab("sop")}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === "sop" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                <BookOpen size={14} /> SOP Guide
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* --- TAB 1: FORM GENERATOR --- */}
            {activeTab === "form" ? (
              <div className="p-6 space-y-4">
                {/* 1. Provider Select (ALWAYS VISIBLE) */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                    Provider Source
                  </label>
                  <div className="relative">
                    <select
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none"
                      value={formData.provider}
                      onChange={(e) =>
                        setFormData({ ...formData, provider: e.target.value })
                      }
                    >
                      {Object.keys(PROVIDER_CONFIG).map((key) => (
                        <option key={key} value={key}>
                          {key}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-3 top-2.5 text-slate-400"
                    />
                  </div>
                </div>

                {/* HIDE ALL THESE INPUTS IF IT IS A MANUAL CHECK */}
                {!currentConfig?.isManualCheckOnly && (
                  <>
                    {/* Member ID */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                        Member ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. user@017"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                        value={formData.memberId}
                        onChange={(e) =>
                          setFormData({ ...formData, memberId: e.target.value })
                        }
                      />
                    </div>

                    {/* Provider Account */}
                    {currentConfig?.requiredFields.includes(
                      "providerAccount",
                    ) && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                          Provider Account ID{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. gapi_12345"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                          value={formData.providerAccount}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              providerAccount: e.target.value,
                            })
                          }
                        />
                      </div>
                    )}

                    {/* Dynamic Currency Selection */}
                    {currentConfig?.requiredFields.includes("currency") && (
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase">
                          Currency <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <select
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-100 transition-all"
                            value={formData.currency}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                currency: e.target.value,
                              })
                            }
                          >
                            <option value="" disabled>
                              Select Currency
                            </option>

                            {/* This part checks the config and ONLY shows allowed currencies */}
                            {(
                              currentConfig.options?.currencies || [
                                "IDR",
                                "MYR",
                                "CNY",
                                "THB",
                                "KRW",
                                "USD",
                                "VND",
                                "PHP",
                                "SGD",
                              ]
                            ).map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Reason To Check */}
                    {currentConfig?.requiredFields.includes(
                      "reasonToCheck",
                    ) && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                          Reason to Check{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <select
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                            value={formData.reasonToCheck}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                reasonToCheck: e.target.value,
                              })
                            }
                          >
                            <option value="">Select Reason...</option>
                            {currentConfig.options?.reasons?.map((r, idx) => (
                              <option key={idx} value={r}>
                                {r.substring(0, 70)}...
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={14}
                            className="absolute right-3 top-2.5 text-slate-400"
                          />
                        </div>
                      </div>
                    )}

                    {/* Merchant Group */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                        Merchant Group
                      </label>
                      <input
                        type="text"
                        readOnly
                        className={`w-full px-3 py-2 border rounded-lg text-sm italic transition-all ${dutyError ? "bg-red-50 border-red-200 text-red-600 shadow-[0_0_0_2px_rgba(239,68,68,0.1)]" : "bg-slate-100 border-slate-200 text-slate-500"}`}
                        value={merchantName || "Auto-detecting..."}
                      />
                      {dutyError && (
                        <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1">
                          ⚠️ {dutyError}
                        </p>
                      )}
                    </div>

                    {/* Time Range */}
                    {currentConfig?.requiredFields.includes("timeRange") && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                          Time Period <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 10:00 - 12:00"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                          value={formData.timeRange}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              timeRange: e.target.value,
                            })
                          }
                        />
                      </div>
                    )}

                    {/* Game Name (For PP Casino) */}
                    {currentConfig?.requiredFields.includes("gameName") && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                          Game Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Sweet Bonanza"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                          value={formData.gameName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              gameName: e.target.value,
                            })
                          }
                        />
                      </div>
                    )}

                    {/* Tracking ID (Back to normal!) */}
                    {currentConfig?.requiredFields.includes("trackingId") && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                          Tracking ID
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                          value={formData.trackingId}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              trackingId: e.target.value,
                            })
                          }
                        />
                      </div>
                    )}

                    {/* Bet Ticket (Dedicated just for CQ9 and similar providers) */}
                    {currentConfig?.requiredFields.includes("betTicket") && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                          Bet Ticket Number
                        </label>
                        <input
                          type="text"
                          placeholder="Leave blank if using Time Period"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                          value={formData.betTicket}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              betTicket: e.target.value,
                            })
                          }
                        />
                      </div>
                    )}

                    {/* Login ID */}
                    {!currentConfig?.requiredFields.includes("trackingId") && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                          Login ID
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                          value={formData.loginId}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              loginId: e.target.value,
                            })
                          }
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Create Ticket Button (ALWAYS VISIBLE, DISABLED IF MANUAL CHECK) */}
                <button
                  disabled={!isFormValid()}
                  className={`w-full py-2.5 font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 mt-4 ${isFormValid() ? "bg-black hover:bg-slate-800 text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}
                >
                  <Plus size={18} /> Create Ticket
                </button>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* --- TAB 2: SOP GUIDELINES --- */}
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <h3 className="text-xs font-bold text-indigo-900 uppercase mb-1">
                    Submit To
                  </h3>
                  <p className="text-sm font-semibold text-indigo-700">
                    {currentConfig.channel}
                  </p>
                  <p className="text-[10px] text-indigo-500 mt-1">
                    SLA: {currentConfig.sla}
                  </p>
                </div>

                <div>
                  {/* TITLE + SOP COPY BUTTON */}
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-slate-900 uppercase flex items-center gap-2">
                      <Shield size={12} /> Query Conditions
                    </h3>

                    {currentConfig.conditionScript && (
                      <button
                        onClick={handleCopySop}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
                      >
                        {copiedSop ? (
                          <>
                            <Check size={10} /> Copied
                          </>
                        ) : (
                          <>
                            <Copy size={10} /> Copy Script
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* SOP SCRIPT PREVIEW BOX */}
                  {currentConfig.conditionScript && (
                    <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-mono text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {currentConfig.conditionScript(workName)}
                    </div>
                  )}

                  <ul className="space-y-2 mt-2">
                    {currentConfig.conditions.map((item, i) => (
                      <li
                        key={i}
                        className="text-xs text-slate-600 flex gap-2 items-start"
                      >
                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full mt-1.5 shrink-0"></span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase mb-2 flex items-center gap-2">
                    <Clock size={12} /> Investigation Steps
                  </h3>
                  <div className="space-y-3">
                    {currentConfig.process.map((step, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center border border-slate-200">
                            {i + 1}
                          </div>
                          {i !== currentConfig.process.length - 1 && (
                            <div className="w-px h-full bg-slate-100 my-1"></div>
                          )}
                        </div>

                        {/* UPDATED: Added w-full to ensure the copy box spans correctly */}
                        <div className="py-0.5 w-full">
                          <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                            {typeof step === "string" ? step : step.text}
                          </p>

                          {/* NEW: Renders a copyable code block if copyText exists */}
                          {typeof step === "object" && step.copyText && (
                            <div className="mt-2 mb-3 relative group">
                              <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-[11px] text-slate-700 font-mono whitespace-pre-wrap pr-10">
                                {/* This automatically swaps [Your Name] for the agent's real name! */}
                                {step.copyText.replace("[Your Name]", workName)}
                              </div>
                              <button
                                onClick={() =>
                                  navigator.clipboard.writeText(
                                    step.copyText.replace(
                                      "[Your Name]",
                                      workName,
                                    ),
                                  )
                                }
                                className="absolute top-2 right-2 p-1.5 bg-white border border-slate-200 rounded-md shadow-sm text-slate-400 hover:text-blue-500 hover:border-blue-300 opacity-0 group-hover:opacity-100 transition-all"
                                title="Copy script"
                              >
                                <Copy size={14} />
                              </button>
                            </div>
                          )}

                          {typeof step === "object" && step.image && (
                            <div className="mt-2">
                              <a
                                href={step.image}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block cursor-pointer hover:opacity-85 transition-opacity"
                                title="Click to open image in new tab"
                              >
                                <img
                                  src={step.image}
                                  alt={`Reference step ${i + 1}`}
                                  className="w-full rounded-md border border-slate-200 shadow-sm"
                                />
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
                    <AlertCircle
                      size={14}
                      className="text-amber-600 mt-0.5 shrink-0"
                    />
                    <p className="text-[10px] font-medium text-amber-700 leading-snug">
                      {currentConfig.reminder}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* MAIN SCRIPT PREVIEW */}
          {activeTab === "form" && (
            <div className="p-6 bg-slate-50/50 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase">
                  Script Preview
                </span>
                <button
                  onClick={handleCopy}
                  className="text-xs font-semibold text-slate-900 hover:text-black flex items-center gap-1"
                >
                  {copied ? (
                    <>
                      <Check size={12} className="text-emerald-500" />{" "}
                      <span className="text-emerald-500">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copy
                    </>
                  )}
                </button>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 text-xs font-mono text-slate-500 min-h-[120px] shadow-sm leading-relaxed overflow-x-auto whitespace-pre">
                {generatedScript}
              </div>
            </div>
          )}
        </aside>

        {/* RIGHT PANEL (Table) */}
        <main className="flex-1 bg-white rounded-2xl shadow-xl border border-slate-100 flex flex-col overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Active Investigations for IC Duty {dutyNumber}
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
                  className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm w-64 outline-none"
                />
              </div>
              <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 shadow-sm">
                Filter
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm font-semibold text-slate-500 uppercase tracking-wide text-xs">
                <tr className="border-b border-slate-200">
                  <th className="px-6 py-4 w-16 text-center">#</th>
                  <th>Status</th>
                  <th>Tracking ID</th>
                  <th>Member ID</th>
                  <th>Provider</th>
                  <th>Merchant</th>
                  <th className="text-right px-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                <tr className="hover:bg-slate-50 group">
                  <td className="px-6 py-4 text-center text-slate-400">1</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-100">
                      <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                      Pending
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">#TRK-9982</td>
                  <td className="px-6 py-4 font-semibold text-slate-700">
                    user_7721
                  </td>
                  <td className="px-6 py-4 text-slate-600">PG Soft</td>
                  <td className="px-6 py-4 text-slate-500">GrandRoyal</td>
                  <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity pr-6">
                    <button className="p-2 hover:bg-slate-100 rounded-lg">
                      <Copy size={16} />
                    </button>
                    <button className="p-2 hover:bg-slate-100 rounded-lg">
                      <MoreHorizontal size={16} />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading, selectedDuty } = useDuty();
  if (loading)
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  if (!user || !selectedDuty) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  return (
    <DutyProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </BrowserRouter>
    </DutyProvider>
  );
}
