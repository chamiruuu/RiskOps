import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const DutyContext = createContext();

export const DutyProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Load duty from localStorage to persist on refresh
  const [selectedDuty, setSelectedDuty] = useState(() => {
    return localStorage.getItem('riskops_duty_role') || null;
  });

  useEffect(() => {
    // 1. Get initial session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 2. Listen for auth changes (Login, Logout, Token Refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("Auth Event Triggered:", _event);
      setUser(session?.user ?? null);
      
      // If user logs out, clear the duty role
      if (!session) {
        setSelectedDuty(null);
        localStorage.removeItem('riskops_duty_role');
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Update localStorage whenever selectedDuty changes
  useEffect(() => {
    if (selectedDuty) {
      localStorage.setItem('riskops_duty_role', selectedDuty);
    } else {
      localStorage.removeItem('riskops_duty_role');
    }
  }, [selectedDuty]);

  const setDuty = (duty) => {
    setSelectedDuty(duty);
  };

  return (
    <DutyContext.Provider value={{ user, selectedDuty, setDuty, loading }}>
      {children}
    </DutyContext.Provider>
  );
};

export const useDuty = () => useContext(DutyContext);