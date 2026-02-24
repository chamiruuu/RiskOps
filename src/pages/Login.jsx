import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useDuty } from '../context/DutyContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Shield, ChevronRight, LogOut, LayoutDashboard } from 'lucide-react';

export default function Login() {
  // --- NEW: Added userRole from context ---
  const { user, userRole, setDuty, loading } = useDuty();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  // --- NEW: Auto-redirect Admins/Leaders immediately ---
  useEffect(() => {
    if (user && (userRole === 'Admin' || userRole === 'Leader')) {
      console.log(`Auto-redirecting ${userRole} to dashboard...`);
      navigate('/dashboard');
    }
  }, [user, userRole, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setError('');
    
    console.log("Attempting login..."); 

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Login Error:", error); 
      setError(error.message);
      setIsProcessing(false);
    } else {
      console.log("Login Success!", data); 
    }
  };

  const handleDutySelect = (duty) => {
    setDuty(duty);
    navigate('/dashboard'); 
  };

  // Prevent flicker by showing a loader while checking initial session
  if (loading || (user && (userRole === 'Admin' || userRole === 'Leader'))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

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

  // 2. Modern Duty Selection (ONLY for standard 'User' role)
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      
      <div className="text-center mb-10 max-w-lg">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium mb-4">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Authenticated as {user.email}
        </div>
        <h2 className="text-3xl font-bold text-slate-900">Select Duty Profile</h2>
        <p className="text-slate-500 mt-2">Choose your active role for this session to load relevant tickets.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-3xl">
        {/* Note: Removed 'IC0' from this list since Admins auto-skip this screen, and standard users shouldn't see IC0 */}
        {['IC1', 'IC2', 'IC3', 'IC5'].map((role) => (
          <button
            key={role}
            onClick={() => handleDutySelect(role)}
            className="group relative flex flex-col items-center justify-center p-8 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 hover:-translate-y-1 transition-all duration-200"
          >
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-colors bg-blue-50 text-blue-600 group-hover:bg-indigo-100 group-hover:text-indigo-600`}>
              <LayoutDashboard size={24} />
            </div>
            
            <span className="text-xl font-bold text-slate-800">{role}</span>
            <span className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">
                Duty Officer
            </span>

            {/* Hover Indicator */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-200 rounded-b-xl" />
          </button>
        ))}
      </div>

      <button 
        onClick={() => supabase.auth.signOut()} 
        className="mt-12 flex items-center gap-2 text-slate-500 hover:text-red-600 transition-colors text-sm font-medium"
      >
        <LogOut size={16} />
        Sign Out
      </button>
    </div>
  );
}