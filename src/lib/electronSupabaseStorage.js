// src/lib/electronSupabaseStorage.js
// Custom storage adapter for Supabase in Electron using electron-store

let ElectronStore;
let store;

// Only require electron-store if running in Electron
if (typeof window !== 'undefined' && window.electronAPI) {
  ElectronStore = require('electron-store');
  store = new ElectronStore({ name: 'supabase-auth' });
}

const STORAGE_KEY = 'supabase.auth.token';

export const electronSupabaseStorage = {
  getItem: async (key) => {
    if (!store) return null;
    return store.get(key || STORAGE_KEY) || null;
  },
  setItem: async (key, value) => {
    if (!store) return;
    store.set(key || STORAGE_KEY, value);
  },
  removeItem: async (key) => {
    if (!store) return;
    store.delete(key || STORAGE_KEY);
  },
};
