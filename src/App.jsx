import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DutyProvider, useDuty } from './context/DutyContext';
import Login from './pages/Login';
import { useState, useEffect } from 'react';
import { 
  Search, Copy, MoreHorizontal, Plus, Calendar, Clock, ShieldCheck, Filter
} from 'lucide-react';

function Dashboard() {
  const { selectedDuty, user } = useDuty();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Mock data for online users - in the next step we will make this real
  const activeUsers = [
    { name: 'Fernando IPCS', duty: 'IC1' },
    { name: 'Chamiru', duty: 'IC0' }
  ];

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Time-based greeting logic
  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Night";
  };

  const formattedDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return (
    <div className="h-screen bg-[#F3F4F6] text-[#374151] font-sans flex flex-col overflow-hidden">
      
      {/* --- COMMAND CENTER HEADER --- */}
      <header className="bg-white border-b border-gray-200 px-4 h-12 flex items-center justify-between shrink-0 shadow-sm">
        
        {/* Left: Branding & Greeting */}
        <div className="flex items-center gap-6">
          <div className="bg-[#111827] text-white px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tight flex items-center gap-2">
            <ShieldCheck size={14} className="text-indigo-400" />
            RiskOps
          </div>
          
          <div className="text-xs font-semibold text-gray-500">
            {getGreeting()}, <span className="text-gray-900">{user?.email?.split('@')[0] || 'User'}</span>
          </div>
        </div>

        {/* Right: Active Users & Real-time Clock */}
        <div className="flex items-center gap-4">
          
          {/* Online User Pill with Tooltip */}
          <div className="relative group cursor-default">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-100 rounded-full shadow-sm hover:border-gray-200 transition-all">
              <div className="w-2 h-2 bg-[#10b981] rounded-full"></div>
              <span className="text-[11px] font-bold text-gray-600">{activeUsers.length} Online</span>
            </div>

            {/* Hover Content (Match image_4d01df.png) */}
            <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-gray-200 shadow-xl rounded-lg p-0 opacity-0 group-hover:opacity-100 transition-opacity z-[70] pointer-events-none overflow-hidden">
              <div className="bg-gray-50/80 px-4 py-2 border-b border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Currently Active</p>
              </div>
              <div className="p-2 space-y-1">
                {activeUsers.map((u, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded">
                    <div className="w-1.5 h-1.5 bg-[#10b981] rounded-full"></div>
                    <span className="text-[11px] font-semibold text-gray-700">{u.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Time Widget (Match image_4d01c3.png) */}
          <div className="flex items-center bg-white border border-gray-200 rounded px-3 py-1.5 shadow-sm">
            <div className="flex items-center gap-2 pr-3 border-r border-gray-200">
              <Calendar size={13} className="text-gray-400" />
              <span className="text-[11px] font-bold text-gray-600">{formattedDate}</span>
            </div>
            <div className="flex items-center gap-2 pl-3">
              <Clock size={13} className="text-gray-400" />
              <span className="text-[11px] font-bold text-gray-600 tracking-tight">{formattedTime}</span>
              <span className="text-[9px] font-bold text-blue-400 uppercase ml-1">UTC+8</span>
            </div>
          </div>
        </div>
      </header>

      {/* --- DASHBOARD BODY (Split View) --- */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* LEFT PANEL: Input Section */}
        <aside className="w-[380px] bg-white border-r border-gray-200 flex flex-col shrink-0">
          <div className="p-5 border-b border-gray-100 bg-gray-50/30 flex items-center justify-between">
            <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.15em]">Generation Panel</h2>
            <div className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-bold border border-indigo-100 uppercase">
              {selectedDuty} Active
            </div>
          </div>

          <div className="p-6 space-y-5 overflow-y-auto">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Merchant</label>
              <select className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-indigo-500 shadow-sm">
                <option>Select Merchant...</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Member ID</label>
              <input type="text" className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="e.g. user@129" />
            </div>

            <button className="w-full bg-[#111827] hover:bg-black text-white py-2.5 rounded text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 mt-4 shadow-lg shadow-gray-200">
              <Plus size={14} /> NEW ENTRY
            </button>
          </div>

          <div className="mt-auto p-5 bg-gray-50 border-t border-gray-200">
             <div className="bg-white border border-gray-200 rounded p-4 text-[11px] font-mono text-gray-400 min-h-[140px] leading-relaxed italic border-dashed">
                # Input parameters to generate script...
             </div>
          </div>
        </aside>

        {/* RIGHT PANEL: Live Table Feed */}
        <main className="flex-1 overflow-hidden flex flex-col">
          <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between shrink-0">
             <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold text-gray-800">Pending Maintenance</h3>
                <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded font-bold">12 Active</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Filter Provider..." className="pl-9 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs w-56 outline-none" />
                </div>
                <button className="px-3 py-1.5 bg-white border border-gray-200 rounded text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all">
                   Filter Date
                </button>
                <div className="h-6 w-px bg-gray-200 mx-1"></div>
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[#10b981]/5 border border-[#10b981]/20 rounded text-[10px] font-black text-[#10b981] uppercase tracking-wider">
                  Live
                </div>
             </div>
          </div>

          {/* Table Container (Matches screenshot density) */}
          <div className="p-6 overflow-auto">
            <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center">#</th>
                    <th className="px-4 py-3">Redmine No</th>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Schedule</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Analyst</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-[11px]">
                  <tr className="hover:bg-blue-50/40 transition-colors group">
                    <td className="px-4 py-4 text-center text-gray-300 font-bold">1</td>
                    <td className="px-4 py-4 font-bold text-indigo-600 uppercase tracking-tighter">CS-30908</td>
                    <td className="px-4 py-4">
                      <div className="font-bold text-gray-700">DG Casino</div>
                      <div className="text-[9px] text-gray-400">Part of the Game</div>
                    </td>
                    <td className="px-4 py-4 text-gray-500 font-medium">Feb 18, 08:00</td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#10b981]/10 text-[#10b981] font-bold uppercase text-[9px] border border-[#10b981]/20">
                        <div className="w-1 h-1 bg-[#10b981] rounded-full animate-pulse"></div> Ongoing
                      </span>
                    </td>
                    <td className="px-4 py-4 font-semibold text-gray-600 flex items-center gap-2">
                       <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[9px] font-bold uppercase border border-gray-200">{user?.email?.[0]}</div>
                       {user?.email?.split('@')[0]}
                    </td>
                    <td className="px-4 py-4 text-right">
                       <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-gray-200 rounded transition-all shadow-sm">
                           <Copy size={14} />
                         </button>
                         <button className="p-1.5 text-gray-400 hover:text-gray-900 transition-all">
                           <MoreHorizontal size={14} />
                         </button>
                       </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* --- FOOTER (Matches screenshot v1.0.4-STABLE) --- */}
      <footer className="h-7 bg-white border-t border-gray-200 px-4 flex items-center justify-between text-[9px] font-bold text-gray-400 shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-indigo-600 uppercase">Profile: {selectedDuty}</span>
          <span className="text-gray-200">|</span>
          <span className="text-green-500 flex items-center gap-1">
            <div className="w-1 h-1 bg-green-500 rounded-full"></div> DB HANDSHAKE SUCCESS
          </span>
        </div>
        <div className="uppercase tracking-widest opacity-50">v1.0.4-STABLE</div>
      </footer>
    </div>
  );
}

// ProtectedRoute logic remains the same...
function ProtectedRoute({ children }) {
  const { user, loading, selectedDuty } = useDuty();
  if (loading) return <div className="h-screen flex items-center justify-center bg-[#F3F4F6] text-gray-400 font-bold text-[10px] uppercase animate-pulse tracking-[.3em]">System Handshake...</div>;
  if (!user || !selectedDuty) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  return (
    <DutyProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </BrowserRouter>
    </DutyProvider>
  );
}