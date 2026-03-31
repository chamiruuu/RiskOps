import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ShieldCheck, Mail, Lock, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

export default function SetPassword() {
  const [password, setPassword] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for Supabase to parse the URL token and establish the secure session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUserEmail(session.user.email);
        setIsSessionReady(true);
      } else {
        // If it's not ready instantly, listen for the event to fire
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
          if (session?.user) {
            setUserEmail(session.user.email);
            setIsSessionReady(true);
          }
        });
        return () => authListener.subscription.unsubscribe();
      }
    };
    checkSession();
  }, []);

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!isSessionReady) {
      setError("Secure session not found. Please ensure you clicked a valid invite link.");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      setIsLoading(false);
      return;
    }

    // Securely update the user's password
    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    });

    if (updateError) {
      setError(updateError.message);
      setIsLoading(false);
    } else {
      // Password set successfully! Send them to the app.
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        
        {/* Header Section */}
        <div className="bg-indigo-600 px-8 py-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
             {/* Subtle background pattern */}
             <div className="absolute transform -rotate-45 -top-10 -left-10 w-40 h-40 bg-white rounded-3xl"></div>
             <div className="absolute transform -rotate-45 top-20 -right-10 w-32 h-32 bg-white rounded-full"></div>
          </div>
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg mb-4 transform rotate-3">
              <ShieldCheck size={32} className="text-indigo-600 transform -rotate-3" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">Welcome to RiskOps</h2>
            <p className="text-indigo-100 text-sm">Secure your account to continue</p>
          </div>
        </div>

        {/* Form Section */}
        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 text-rose-700 animate-in slide-in-from-top-2">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p className="text-xs font-medium leading-relaxed">{error}</p>
            </div>
          )}

          {!isSessionReady && !error ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <Loader2 size={32} className="animate-spin mb-4 text-indigo-500" />
              <p className="text-sm font-medium">Verifying secure token...</p>
            </div>
          ) : (
            <form onSubmit={handleSetPassword} className="space-y-5">
              
              {/* Read-only Email Display */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Account Email
                </label>
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">
                  <Mail size={18} className="text-slate-400" />
                  <span className="text-sm font-semibold">{userEmail || "Loading..."}</span>
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Create New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full mt-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    Secure Account & Login 
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}