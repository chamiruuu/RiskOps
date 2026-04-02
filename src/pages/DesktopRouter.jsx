import React, { useEffect } from 'react';
import { ShieldCheck, Download, AlertCircle } from 'lucide-react';

export default function DesktopRouter() {
  useEffect(() => {
    // 1. Grab the secure tokens from the Supabase email URL
    const hash = window.location.hash; 
    
    // 2. Fire the custom protocol to wake up the Desktop app!
    if (hash) {
      window.location.href = `riskops://auth${hash}`;
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans text-center">
      <div className="max-w-md w-full bg-slate-800 rounded-3xl p-10 border border-slate-700 shadow-2xl animate-in fade-in zoom-in-95 duration-500">
        
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-900/50 animate-pulse">
          <ShieldCheck size={32} className="text-white" />
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-3">Opening RiskOps...</h2>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          Please click <strong>"Open RiskOps"</strong> if prompted by your browser. Your secure session is being transferred to the desktop application.
        </p>

        <div className="p-5 bg-slate-900/80 rounded-xl border border-slate-700/50 text-left">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-slate-300 leading-snug">
              Don't have the RiskOps Desktop App installed yet? You must install it to continue.
            </p>
          </div>
          
          {/* Your provided download link! */}
          <a 
            href="https://github.com/chamiruuu/RiskOps/releases/download/v0.1.6/RiskOps-TMS-Setup-0.1.6.exe"
            className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Download size={18} />
            Download for Windows
          </a>
        </div>
        
      </div>
    </div>
  );
}