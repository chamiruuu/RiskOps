
import { createClient } from '@supabase/supabase-js';
// Import custom storage for Electron
import { electronSupabaseStorage } from './electronSupabaseStorage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ✅ DEPLOY-VERCEL-001: Validate environment at startup
if (!supabaseUrl || !supabaseAnonKey) {
  const errors = [];
  if (!supabaseUrl) errors.push('Missing VITE_SUPABASE_URL');
  if (!supabaseAnonKey) errors.push('Missing VITE_SUPABASE_ANON_KEY');
  const message = `Supabase configuration error: ${errors.join(', ')}`;
  console.error(message);
  if (import.meta.env.PROD) {
    throw new Error(message);
  }
}


if (!supabaseUrl?.startsWith('https://')) {
  console.warn('Warning: VITE_SUPABASE_URL should be an HTTPS URL');
}

// Explicitly set session persistence and auto-refresh to avoid unexpected logout issues

// Detect if running in Electron (window.electronAPI is exposed in preload)
const isElectron = typeof window !== 'undefined' && window.electronAPI;

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      ...(isElectron ? { storage: electronSupabaseStorage } : {}),
    },
  }
);

export const isMissingSupabaseRelationError = (error) => {
  if (!error) return false;

  const text = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    error.code === "PGRST205" ||
    (error.status === 404 &&
      (text.includes("could not find the table") ||
        text.includes("relation") ||
        text.includes("schema cache") ||
        text.includes("does not exist")))
  );
};