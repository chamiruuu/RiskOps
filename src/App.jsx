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
} from "lucide-react";
import { supabase } from "./lib/supabase";

function Dashboard() {
  const { selectedDuty, user } = useDuty();
  const [currentTime, setCurrentTime] = useState(new Date());

  const activeUsers = [
    { name: "Fernando IPCS", duty: "IC1" },
    { name: "Chamiru", duty: "IC0" },
  ];

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- SOFT COLOR STYLE CONFIGURATION ---
  const getDutyStyle = (role) => {
    switch (role) {
      case "IC0": // Admin -> Purple Soft
        return {
          container: "bg-purple-100 border-purple-200",
          text: "text-purple-700",
          dot: "bg-purple-600",
        };
      case "IC1": // Standard -> Indigo Soft (The style you liked)
        return {
          container: "bg-indigo-100 border-indigo-200",
          text: "text-indigo-700",
          dot: "bg-indigo-600",
        };
      case "IC2": // Safe -> Emerald Soft
        return {
          container: "bg-emerald-100 border-emerald-200",
          text: "text-emerald-700",
          dot: "bg-emerald-600",
        };
      case "IC3": // Warn -> Amber Soft
        return {
          container: "bg-amber-100 border-amber-200",
          text: "text-amber-700",
          dot: "bg-amber-600",
        };
      case "IC5": // Critical -> Rose Soft
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

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Night";
  };

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

  return (
    <div className="h-screen bg-slate-50 text-slate-900 font-sans flex flex-col overflow-hidden">
      {/* --- HEADER --- */}
      <header className="bg-white border-b border-slate-200 px-6 h-16 flex items-center justify-between shrink-0 z-50 shadow-sm">
        {/* LEFT: Branding with DYNAMIC SOFT LOGO */}
        <div className="flex items-center gap-3">
          {/* Soft Background + Colored Icon */}
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

        {/* RIGHT: Header Elements */}
        <div className="flex items-center gap-4">
          <div className="text-xs font-medium text-slate-500 hidden md:block">
            {getGreeting()},{" "}
            <span className="text-slate-900 font-semibold">
              {user?.email?.split("@")[0]}
            </span>
          </div>

          <div className="relative group cursor-default">
            <div className="h-9 px-4 flex items-center gap-2 bg-white border border-slate-200 rounded-full shadow-sm hover:border-slate-400 transition-all">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span className="text-xs font-semibold text-slate-600">
                {activeUsers.length} Online
              </span>
            </div>
            {/* Tooltip */}
            <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-slate-100 shadow-xl rounded-xl p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              <p className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Team Activity
              </p>
              {activeUsers.map((u, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center px-2 py-1.5 hover:bg-slate-50 rounded-lg"
                >
                  <span className="text-xs font-medium text-slate-700">
                    {u.name}
                  </span>
                  <span className="text-[10px] font-bold text-white bg-black px-1.5 py-0.5 rounded">
                    {u.duty}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden md:flex items-center h-9 bg-white border border-slate-200 rounded-lg shadow-sm px-4 gap-3">
            <div className="flex items-center gap-2 text-slate-500">
              <Calendar size={14} />
              <span className="text-xs font-semibold">{formattedDate}</span>
            </div>
            <div className="w-px h-3 bg-slate-300"></div>
            <div className="flex items-center gap-2 text-slate-600">
              <Clock size={14} />
              <span className="text-xs font-bold tabular-nums">
                {formattedTime}
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                UTC+8
              </span>
            </div>
          </div>

          <div className="pl-2 border-l border-slate-100 h-9 flex items-center">
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <div className="flex flex-1 overflow-hidden p-6 gap-6">
        {/* LEFT PANEL */}
        <aside className="w-[380px] bg-white rounded-2xl shadow-xl border border-slate-100 flex flex-col shrink-0 overflow-hidden">
          <div className="p-6 border-b border-slate-50">
            <h2 className="text-lg font-bold text-slate-900">
              New Investigation
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Configure parameters to generate script.
            </p>
          </div>

          <div className="p-6 space-y-5 flex-1 overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Merchant Group
              </label>
              <div className="relative">
                <select className="w-full pl-3 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all outline-none text-slate-900 text-sm appearance-none">
                  <option>Select Merchant...</option>
                  <option>GrandRoyal</option>
                  <option>Bet365</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Member ID
              </label>
              <input
                type="text"
                placeholder="e.g. user@129"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all outline-none text-slate-900 placeholder-slate-400 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Provider
                </label>
                <select className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm text-slate-900">
                  <option>PG Soft</option>
                  <option>Evolution</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Time Range
                </label>
                <input
                  type="text"
                  placeholder="HH:MM"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm"
                />
              </div>
            </div>

            {/* BUTTON: Solid Black (Consistent) */}
            <button className="w-full py-2.5 bg-black hover:bg-slate-800 text-white font-semibold rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center gap-2 mt-4">
              <Plus size={18} /> Create Ticket
            </button>
          </div>

          <div className="p-6 bg-slate-50/50 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                Script Preview
              </span>
              <button className="text-xs font-semibold text-slate-900 hover:text-black flex items-center gap-1">
                <Copy size={12} /> Copy
              </button>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-xs font-mono text-slate-500 min-h-[100px] shadow-sm leading-relaxed">
              // Generated script will appear here...
            </div>
          </div>
        </aside>

        {/* RIGHT PANEL */}
        <main className="flex-1 bg-white rounded-2xl shadow-xl border border-slate-100 flex flex-col overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between shrink-0">
            {/* HEADER TITLE: Uniform Text Color */}
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Active Investigations for IC-Duty {dutyNumber}
              </h2>
            </div>

            {/* Search & Filter (No Changes) */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Search tickets..."
                  className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm w-64 focus:ring-2 focus:ring-slate-900 focus:bg-white outline-none transition-all"
                />
              </div>
              <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
                Filter
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-0">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm">
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-6 py-4 w-16 text-center">#</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Ticket ID</th>
                  <th className="px-6 py-4">Member ID</th>
                  <th className="px-6 py-4">Provider</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                <tr className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4 text-center text-slate-400 font-medium">
                    1
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-100">
                      <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                      Pending
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-500 text-xs">
                    #CS-30908
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-700">
                    user_7721@129
                  </td>
                  <td className="px-6 py-4 text-slate-600">PG Soft</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 text-slate-400 hover:text-black hover:bg-slate-100 rounded-lg transition-all">
                        <Copy size={16} />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-black hover:bg-slate-100 rounded-lg transition-all">
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
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

// Protected Route Logic
function ProtectedRoute({ children }) {
  const { user, loading, selectedDuty } = useDuty();
  if (loading)
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
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
