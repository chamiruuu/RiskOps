import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useDuty } from '../context/DutyContext';
import { useNavigate } from 'react-router-dom';
import { Clock, Lock, Mail, Shield, ChevronRight, LogOut, LayoutDashboard, Check } from 'lucide-react';

const getGMT8Time = () => {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * 8);
};

const setTime = (date, hour, minute) => {
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
};

const formatGmt8Time = (date) =>
  date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

const formatCountdown = (target, now) => {
  const diffSeconds = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const hours = Math.floor(diffSeconds / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);
  const seconds = diffSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const getDutyAccessState = (assignedShift, inputNow = getGMT8Time()) => {
  if (!assignedShift || assignedShift === 'Off') {
    return { isOpen: false, nextOpen: null, label: 'No assigned shift' };
  }

  const now = new Date(inputNow);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const buildTodayWindow = (startHour, startMinute, endHour, endMinute) => {
    const start = setTime(now, startHour, startMinute);
    const end = setTime(now, endHour, endMinute);

    if (now >= start && now < end) {
      return { isOpen: true, nextOpen: null, closeAt: end };
    }
    if (now < start) {
      return { isOpen: false, nextOpen: start, closeAt: end };
    }

    const tomorrowStart = new Date(start);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    return { isOpen: false, nextOpen: tomorrowStart, closeAt: end };
  };

  if (assignedShift === 'Morning') {
    return { label: 'Morning', ...buildTodayWindow(6, 45, 15, 0) };
  }
  if (assignedShift === 'Afternoon') {
    return { label: 'Afternoon', ...buildTodayWindow(14, 15, 23, 0) };
  }
  if (assignedShift === 'Night') {
    const nightStart = setTime(now, 22, 15);
    const nextMorningLock = setTime(now, 7, 30);

    if (minutes < 450) {
      return { label: 'Night', isOpen: true, nextOpen: null, closeAt: nextMorningLock };
    }
    if (now >= nightStart) {
      const closeAt = setTime(now, 7, 30);
      closeAt.setDate(closeAt.getDate() + 1);
      return { label: 'Night', isOpen: true, nextOpen: null, closeAt };
    }
    return { label: 'Night', isOpen: false, nextOpen: nightStart, closeAt: nextMorningLock };
  }

  return { isOpen: false, nextOpen: null, label: assignedShift };
};

export default function Login() {
  const { user, userRole, setDuty, loading, myAssignedShift } = useDuty();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(() => {
    const authNotice = localStorage.getItem('riskops_auth_notice');
    if (authNotice) {
      localStorage.removeItem('riskops_auth_notice');
    }
    return authNotice || '';
  });
  const [dutyNotice, setDutyNotice] = useState(() => {
    const savedDutyNotice = localStorage.getItem('riskops_duty_notice');
    if (savedDutyNotice) {
      localStorage.removeItem('riskops_duty_notice');
    }
    return savedDutyNotice || '';
  });

  // --- NEW: Local state to hold multiple selections ---
  const [localDutySelection, setLocalDutySelection] = useState([]);
  const [currentTime, setCurrentTime] = useState(getGMT8Time);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(getGMT8Time()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user && (userRole === 'Admin' || userRole === 'Leader' || userRole === 'QC')) {
      console.log(`Auto-redirecting ${userRole} to dashboard...`);
      navigate('/dashboard');
    }
  }, [user, userRole, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // ✅ LOGIC-REACT-004: Client-side validation
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setIsProcessing(true);
    setError('');
    
    console.log("Attempting login...");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        console.error("Login Error:", error); 
        if (error.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please try again.');
        } else if (error.message.includes('Email not confirmed')) {
          setError('Please confirm your email address before logging in.');
        } else {
          setError(error.message || 'Login failed. Please try again.');
        }
        setIsProcessing(false);
      } else {
        console.log("Login Success!", data); 
      }
    } catch (err) {
      console.error('Unexpected login error:', err);
      setError('An unexpected error occurred. Please try again.');
      setIsProcessing(false);
    }
  };

  // --- MODIFIED: Toggle duty selection instead of instantly routing ---
  const toggleDutySelect = (role) => {
    setLocalDutySelection(prev => 
      prev.includes(role) 
        ? prev.filter(d => d !== role) // Remove if already selected
        : [...prev, role]              // Add if not selected
    );
  };

  // --- NEW: Submit selections to context ---
  const handleSubmitDuties = () => {
    if (localDutySelection.length > 0 && canEnterDutySelection) {
      setDuty(localDutySelection);
      setDutyNotice('');
      navigate('/dashboard');
    }
  };

  if (loading || (user && (userRole === 'Admin' || userRole === 'Leader' || userRole === 'QC'))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isNormalDutyUser = user && userRole !== 'Admin' && userRole !== 'Leader' && userRole !== 'QC';
  const dutyAccess = getDutyAccessState(myAssignedShift, currentTime);
  const canEnterDutySelection = !isNormalDutyUser || dutyAccess.isOpen;
  const dutyCountdownText =
    isNormalDutyUser && !dutyAccess.isOpen && dutyAccess.nextOpen
      ? `${dutyAccess.label} duty access opens in ${formatCountdown(dutyAccess.nextOpen, currentTime)} at ${formatGmt8Time(dutyAccess.nextOpen)} GMT+8.`
      : '';
  const dutyUnavailableText =
    isNormalDutyUser && !dutyAccess.isOpen && !dutyAccess.nextOpen
      ? 'No active duty access window is available for your account.'
      : '';
  const dutyOpenText =
    isNormalDutyUser && dutyAccess.isOpen && dutyAccess.closeAt
      ? `${dutyAccess.label} duty access is open until ${formatGmt8Time(dutyAccess.closeAt)} GMT+8.`
      : '';

  // 1. Modern Login Form
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-slate-100 relative">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 mb-4">
              <Shield size={24} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">RiskOps Portal</h1>
            <p className="text-slate-500 text-sm mt-2">Sign in to access duty controls</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2">
              <span className="font-medium">Error:</span> {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Work Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-900 placeholder-slate-400"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-900 placeholder-slate-400"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In <ChevronRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
        
        {/* Footer Text */}
        <div className="absolute bottom-6 text-center text-slate-400 text-xs w-full">
          &copy; {new Date().getFullYear()} RiskOps IC-Duty Internal System. Secure Access Only.
        </div>
      </div>
    );
  }

  // 2. Modern Duty Selection (Multi-Select)
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      
      <div className="text-center mb-10 max-w-lg">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium mb-4">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Authenticated as {user.email}
        </div>
        <h2 className="text-3xl font-bold text-slate-900">Select Duty Profiles</h2>
        <p className="text-slate-500 mt-2">Choose one or more active roles for this session.</p>
      </div>

      {(dutyCountdownText || dutyUnavailableText || dutyOpenText || dutyNotice) && (
        <div className={`mb-6 w-full max-w-4xl p-3 border text-sm rounded-lg flex items-center justify-center gap-2 text-center ${
          dutyCountdownText || dutyUnavailableText
            ? 'bg-amber-50 border-amber-100 text-amber-700'
            : 'bg-emerald-50 border-emerald-100 text-emerald-700'
        }`}>
          <Clock size={16} className="shrink-0" />
          <div>
            <div className="font-bold">
              {dutyCountdownText || dutyUnavailableText || dutyOpenText || 'Select the duty account for this shift.'}
            </div>
            {dutyNotice && !dutyCountdownText && (
              <div className="text-xs font-semibold opacity-80 mt-0.5">
                {dutyNotice}
              </div>
            )}
            {isNormalDutyUser && myAssignedShift === 'Off' && (
              <div className="text-xs font-semibold opacity-80 mt-0.5">
                No roster assignment is active for your account. Please contact a Leader.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl">
        {['IC1', 'IC2', 'IC3', 'IC5'].map((role) => {
          const isSelected = localDutySelection.includes(role);
          
          return (
            <button
              key={role}
              onClick={() => toggleDutySelect(role)}
              className={`group relative flex flex-col items-center justify-center p-8 rounded-xl border-2 shadow-sm transition-all duration-200 
                ${isSelected 
                  ? "bg-indigo-50 border-indigo-500 shadow-md transform -translate-y-1" 
                  : "bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md hover:-translate-y-1"}`}
            >
              {/* Checkmark Icon in corner for selected state */}
              {isSelected && (
                <div className="absolute top-3 right-3 bg-indigo-500 text-white p-1 rounded-full animate-in zoom-in duration-200">
                  <Check size={14} strokeWidth={3} />
                </div>
              )}

              <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-colors 
                ${isSelected ? "bg-indigo-600 text-white" : "bg-blue-50 text-blue-600 group-hover:bg-indigo-100 group-hover:text-indigo-600"}`}>
                <LayoutDashboard size={24} />
              </div>
              
              <span className={`text-xl font-bold ${isSelected ? "text-indigo-900" : "text-slate-800"}`}>{role}</span>
              <span className={`text-xs font-medium mt-1 uppercase tracking-wider ${isSelected ? "text-indigo-500" : "text-slate-400"}`}>
                  Duty Officer
              </span>

              {/* Hover Indicator (Only shows if NOT selected) */}
              {!isSelected && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-300 scale-x-0 group-hover:scale-x-100 transition-transform duration-200 rounded-b-xl" />
              )}
            </button>
          )
        })}
      </div>

      {/* --- NEW: Continue Button --- */}
      <div className="mt-10 h-16 flex items-center justify-center">
        {localDutySelection.length > 0 ? (
          <button 
            onClick={handleSubmitDuties}
            disabled={!canEnterDutySelection}
            className={`flex items-center gap-2 px-8 py-3.5 rounded-full font-bold shadow-lg transition-all animate-in slide-in-from-bottom-4 duration-300 ${
              canEnterDutySelection
                ? 'bg-slate-900 hover:bg-black text-white shadow-slate-900/20 hover:scale-105'
                : 'bg-slate-200 text-slate-500 shadow-transparent cursor-not-allowed'
            }`}
          >
            {canEnterDutySelection
              ? `Continue to Dashboard (${localDutySelection.length} selected)`
              : 'Shift Access Locked'} <ChevronRight size={18} />
          </button>
        ) : (
          <span className="text-sm font-medium text-slate-400 animate-in fade-in">Please select at least one duty</span>
        )}
      </div>

      <button 
        onClick={() => supabase.auth.signOut()} 
        className="mt-8 flex items-center gap-2 text-slate-400 hover:text-red-600 transition-colors text-sm font-medium"
      >
        <LogOut size={16} />
        Sign Out
      </button>
    </div>
  );
}
