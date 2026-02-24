import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const DutyContext = createContext();

export const DutyProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // --- NEW: Store the user's role from the database ---
  const [userRole, setUserRole] = useState(null); 
  const [loading, setLoading] = useState(true);
  
  // Load duty from localStorage to persist on refresh
  const [selectedDuty, setSelectedDuty] = useState(() => {
    return localStorage.getItem('riskops_duty_role') || null;
  });

  // --- NEW: Fetch role and auto-assign IC0 for management ---
  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
        
      if (data) {
        setUserRole(data.role);
        // If Admin or Leader, instantly grant them the master IC0 view
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

  // Expose userRole to the rest of the app!
  return (
    <DutyContext.Provider value={{ user, userRole, selectedDuty, setDuty, loading }}>
      {children}
    </DutyContext.Provider>
  );
};

export const useDuty = () => useContext(DutyContext);