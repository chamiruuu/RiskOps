// src/lib/electronSupabaseStorage.js

const STORAGE_KEY = 'supabase.auth.token';

export const electronSupabaseStorage = {
  getItem: (key) => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key || STORAGE_KEY);
  },
  setItem: (key, value) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key || STORAGE_KEY, value);
  },
  removeItem: (key) => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key || STORAGE_KEY);
  },
};