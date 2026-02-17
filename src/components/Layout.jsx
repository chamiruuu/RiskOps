import { useDuty } from '../context/DutyContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  LogOut, 
  Plus, 
  RefreshCw, 
  Search, 
  User,
  LayoutGrid
} from 'lucide-react';

export default function Layout({ children, onRefresh, onCreate }) {
  const { selectedDuty, user } = useDuty();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      
      {/* --- TOP NAVIGATION BAR --- */}
      <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 sticky top-0 z-50 shadow-sm">
        
        {/* Left: Branding & Duty Badge */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-indigo-700">
            <Shield size={24} strokeWidth={2.5} />
            <span className="font-bold text-lg tracking-tight">RiskOps</span>
          </div>

          {/* Duty Badge */}
          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border 
            ${selectedDuty === 'IC0' ? 'bg-purple-100 text-purple-700 border-purple-200' : 
              'bg-blue-100 text-blue-700 border-blue-200'}`}>
            {selectedDuty} Active
          </div>
        </div>

        {/* Center: Search Bar (Excel-like) */}
        <div className="flex-1 max-w-xl mx-6">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={16} />
            </div>
            <input 
              type="text" 
              placeholder="Search Member ID, Ticket #..." 
              className="w-full bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-md py-1.5 pl-10 text-sm transition-all"
            />
          </div>
        </div>

        {/* Right: Actions Toolbar */}
        <div className="flex items-center gap-3">
          
          {/* Primary Action: Create Ticket */}
          <button 
            onClick={onCreate}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New Ticket</span>
          </button>

          <div className="h-6 w-px bg-slate-200 mx-1"></div>

          {/* Secondary Actions (Icons Only) */}
          <button 
            onClick={onRefresh}
            title="Refresh Data"
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
          >
            <RefreshCw size={18} />
          </button>

          <button 
            title="Switch View"
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
          >
            <LayoutGrid size={18} />
          </button>

          <div className="h-6 w-px bg-slate-200 mx-1"></div>

          {/* User Profile / Logout */}
          <div className="flex items-center gap-3 pl-2">
            <div className="text-right hidden md:block">
              <div className="text-xs font-semibold text-slate-700">{user?.email?.split('@')[0]}</div>
              <div className="text-[10px] text-slate-400 uppercase">Authenticated</div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto h-full flex flex-col">
          {children}
        </div>
      </main>

    </div>
  );
}