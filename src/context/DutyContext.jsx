import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const DutyContext = createContext();

export const DutyProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null); 
  const [loading, setLoading] = useState(true);
  
  const [selectedDuty, setSelectedDuty] = useState(() => {
    return localStorage.getItem('riskops_duty_role') || null;
  });

  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
        
      if (data) {
        setUserRole(data.role);
        if (data.role === 'Admin' || data.role === 'Leader') {
          setSelectedDuty('IC0');
          localStorage.setItem('riskops_duty_role', 'IC0');
        }
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  useEffect(() => {
    // 1. Get initial session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // 2. Listen for auth changes (Login, Logout, Token Refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("Auth Event Triggered:", _event);
      
      // --- FIX: Force loading state when a user first signs in ---
      if (_event === 'SIGNED_IN') {
        setLoading(true);
      }

      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserProfile(session.user.id).then(() => setLoading(false));
      } else {
        // If user logs out, clear everything
        setUserRole(null);
        setSelectedDuty(null);
        localStorage.removeItem('riskops_duty_role');
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
    <DutyContext.Provider value={{ user, userRole, selectedDuty, setDuty, loading }}>
      {children}
    </DutyContext.Provider>
  );
};

export const useDuty = () => useContext(DutyContext);