import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const DutyContext = createContext();

export const DutyProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null); 
  const [workName, setWorkName] = useState(""); 
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState([]);
  
  const currentUserTracker = useRef(null);
  
  const [selectedDuty, setSelectedDuty] = useState(() => {
    const saved = localStorage.getItem('riskops_duty_role');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [saved];
      }
    }
    return []; 
  });

  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, work_name') 
        .eq('id', userId)
        .single();
        
      if (data) {
        setUserRole(data.role);
        setWorkName(data.work_name || ""); 
        
        if (data.role === 'Admin' || data.role === 'Leader') {
          setSelectedDuty(prev => {
            if (prev && prev.length > 0 && prev.includes('IC0')) return prev;
            return ['IC0'];
          });
          localStorage.setItem('riskops_duty_role', JSON.stringify(['IC0']));
        }
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      currentUserTracker.current = session?.user?.id;
      
      if (session?.user) {
        fetchUserProfile(session.user.id).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const incomingUserId = session?.user?.id;
      const isNewLogin = incomingUserId !== currentUserTracker.current;
      
      currentUserTracker.current = incomingUserId;
      setUser(session?.user ?? null);
      
      if (isNewLogin && session?.user) {
        setLoading(true);
        fetchUserProfile(session.user.id).then(() => setLoading(false));
      } else if (!session?.user) {
        setUserRole(null);
        setWorkName(""); 
        setSelectedDuty([]); 
        localStorage.removeItem('riskops_duty_role');
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedDuty && selectedDuty.length > 0) {
      localStorage.setItem('riskops_duty_role', JSON.stringify(selectedDuty));
    } else {
      localStorage.removeItem('riskops_duty_role');
    }
  }, [selectedDuty]);

  // --- MODIFIED: Added Debounce for Tab Flickering & Added Role Broadcasting ---
  useEffect(() => {
    if (!user || !workName) return;

    const presenceChannel = supabase.channel('online-users', {
      config: { presence: { key: user.id } },
    });

    let debounceTimer;

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        // Clear any existing timer
        clearTimeout(debounceTimer);
        // Wait 800ms before updating the UI to hide tab-switch dropouts
        debounceTimer = setTimeout(() => {
          const newState = presenceChannel.presenceState();
          const activeUsers = Object.keys(newState).map(key => newState[key][0]);
          setOnlineUsers(activeUsers);
        }, 800); 
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            workName: workName,
            duties: selectedDuty || [],
            role: userRole // <-- FIX: Broadcast the role so the dropdown knows who is Admin
          });
        }
      });

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(presenceChannel);
    };
  }, [user, workName, userRole, JSON.stringify(selectedDuty)]); 

  const setDuty = (dutyArray) => {
    setSelectedDuty(dutyArray);
  };

  return (
    <DutyContext.Provider value={{ user, userRole, workName, selectedDuty, setDuty, onlineUsers, loading }}>
      {children}
    </DutyContext.Provider>
  );
};

export const useDuty = () => useContext(DutyContext);