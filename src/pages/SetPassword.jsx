import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import {
  ShieldCheck,
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

export default function SetPassword() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [error, setError] = useState("");

  // --- NEW: Track if they finished the setup ---
  const [isSuccess, setIsSuccess] = useState(false);

  const passwordInputRef = useRef(null);

  useEffect(() => {
    let subscription = null;

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setUserEmail(session.user.email);
        setIsSessionReady(true);
      } else {
        const { data: authListener } = supabase.auth.onAuthStateChange(
          (event, session) => {
            if (session?.user) {
              setUserEmail(session.user.email);
              setIsSessionReady(true);
            }
          },
        );
        subscription = authListener.subscription;
      }
    };

    checkSession();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!isSessionReady) {
      setError(
        "Secure session not found. Please ensure you clicked a valid invite link.",
      );
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      setIsLoading(false);
      passwordInputRef.current?.focus();
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    });

    if (updateError) {
      setError(updateError.message);
      setIsLoading(false);
      passwordInputRef.current?.focus();
    } else {
      // 1. Destroy the temporary "magic link" session
      await supabase.auth.signOut();

      // 2. Trigger the Dead End Success Screen!
      setIsSuccess(true);

      // (Next step: We will trigger the success email function right here)
    }
  };

  // --- NEW: THE DEAD END SUCCESS UI ---
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans selection:bg-indigo-500/30">
        <div className="max-w-md w-full bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-500 text-center p-10">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-emerald-500" />
          </div>
          <h2 className="text-2xl font-extrabold text-white mb-3 tracking-tight">
            Security Setup Complete
          </h2>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            Your RiskOps account is now secure. For security reasons, web access
            is disabled.
          </p>
          <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 mb-6">
            <p className="text-sm font-medium text-slate-300">
              Please close this browser tab and launch the{" "}
              <span className="text-white font-bold">RiskOps Desktop App</span>{" "}
              to log in.
            </p>
          </div>
          <button
            onClick={() => window.close()}
            className="text-slate-500 hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  // --- STANDARD FORM UI (Unchanged) ---
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-100 to-indigo-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-indigo-700 px-8 py-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute transform -rotate-45 -top-10 -left-10 w-40 h-40 bg-white rounded-3xl"></div>
            <div className="absolute transform -rotate-45 top-20 -right-10 w-32 h-32 bg-white rounded-full"></div>
          </div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg mb-4 transform rotate-3 animate-in fade-in duration-700">
              <ShieldCheck
                size={32}
                className="text-indigo-700 transform -rotate-3"
              />
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-1 tracking-tight drop-shadow">
              Welcome to RiskOps
            </h2>
            <p className="text-indigo-100 text-sm font-medium">
              Secure your account to continue
            </p>
          </div>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-700 animate-in slide-in-from-top-2 shadow-sm">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <p className="text-xs font-semibold leading-relaxed" role="alert">
                {error}
              </p>
            </div>
          )}
          {!isSessionReady && !error ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 animate-pulse">
              <Loader2
                size={36}
                className="animate-spin mb-4 text-indigo-500"
              />
              <p className="text-base font-semibold">
                Verifying secure token...
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSetPassword}
              className="space-y-7"
              autoComplete="off"
            >
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Account Email
                </label>
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 select-text">
                  <Mail size={20} className="text-slate-400" />
                  <span className="text-sm font-semibold truncate">
                    {userEmail || "Loading..."}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Create New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <Lock
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    ref={passwordInputRef}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 focus:outline-none"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.657.336-3.236.938-4.675m2.122-2.122A9.956 9.956 0 0112 3c5.523 0 10 4.477 10 10 0 1.657-.336 3.236-.938 4.675m-2.122 2.122A9.956 9.956 0 0112 21c-5.523 0-10-4.477-10-10 0-1.657.336-3.236.938-4.675"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 3l18 18M9.88 9.88A3 3 0 0112 9c1.657 0 3 1.343 3 3 0 .512-.13 1-.36 1.42m-1.42 1.42A3 3 0 0112 15c-1.657 0-3-1.343-3-3 0-.512.13-1 .36-1.42m1.42-1.42A3 3 0 0112 9c1.657 0 3 1.343 3 3 0 .512-.13 1-.36 1.42m-1.42 1.42A3 3 0 0112 15c-1.657 0-3-1.343-3-3 0-.512.13-1 .36-1.42"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3.5 bg-linear-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white text-base font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Lock size={18} /> Secure Account
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
