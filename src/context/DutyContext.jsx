import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// --- HELPER: Get Current GMT+8 Time ---
const getGMT8Time = () => {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * 8);
};

const DutyContext = createContext();

export const DutyProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null); 
  const [workName, setWorkName] = useState(""); 
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState([]);
  
  // --- MASTER KEY STATES ---
  const [currentActiveShift, setCurrentActiveShift] = useState(null);
  const [myAssignedShift, setMyAssignedShift] = useState("Off");
  const [activeRoster, setActiveRoster] = useState({});
  
  // --- REAL-TIME TRANSFER HANDSHAKE STATES ---
  const [pendingTransferRequest, setPendingTransferRequest] = useState(null);
  const [transferResponse, setTransferResponse] = useState(null);
  const transferChannelRef = useRef(null);

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

  // --- 1. CLOCK CHECKER (Master Timekeeper) ---
  useEffect(() => {
    const checkShiftPeriod = () => {
      const now = getGMT8Time();
      const h = now.getHours();
      const m = now.getMinutes();
      const timeInHours = h + (m / 60);

      if (timeInHours >= 7 && timeInHours < 14.5) setCurrentActiveShift("Morning");
      else if (timeInHours >= 14.5 && timeInHours < 22.5) setCurrentActiveShift("Afternoon");
      else setCurrentActiveShift("Night");
    };
    checkShiftPeriod();
    const timer = setInterval(checkShiftPeriod, 60000); 
    return () => clearInterval(timer);
  }, []);

  // --- 2. FETCH SCHEDULE & ROSTER ---
  useEffect(() => {
    const fetchScheduleAndRoster = async () => {
      if (!user) {
        setActiveRoster({});
        setMyAssignedShift("Off");
        return;
      }

      const { data: allCycles } = await supabase.from('shift_assignments').select('cycle_period');
      let currentLiveCycle = null;

      if (allCycles) {
        const uniqueCycles = [...new Set(allCycles.map(d => d.cycle_period))].filter(Boolean);
        const today = getGMT8Time();
        if (today.getHours() < 7) today.setDate(today.getDate() - 1);
        today.setHours(0, 0, 0, 0);

        for (const c of uniqueCycles) {
          const parts = c.split(" - ");
          if (parts.length === 2) {
            const start = new Date(parts[0]);
            const end = new Date(parts[1]);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            if (today >= start && today <= end) {
              currentLiveCycle = c;
              break;
            }
          }
        }
      }

      if (currentLiveCycle) {
        const { data: assignments } = await supabase
          .from('shift_assignments')
          .select('user_id, shift_type')
          .eq('cycle_period', currentLiveCycle);

        const { data: profiles } = await supabase.from('profiles').select('id, work_name');

        if (assignments && profiles) {
          const rosterMap = {};
          let myShift = "Off";

          assignments.forEach(a => {
            const prof = profiles.find(p => p.id === a.user_id);
            if (prof && prof.work_name) {
              rosterMap[prof.work_name] = a.shift_type;
            }
            if (a.user_id === user.id) {
              myShift = a.shift_type;
            }
          });

          setActiveRoster(rosterMap);
          setMyAssignedShift(myShift);
        }
      } else {
        setActiveRoster({});
        setMyAssignedShift("Off");
      }
    };

    fetchScheduleAndRoster();
  }, [user]);

  const isMyShiftActive = myAssignedShift === currentActiveShift;

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

  // --- 3. PRESENCE TRACKING & AGGRESSIVE KEEP-ALIVE ---
  useEffect(() => {
    if (!user || !workName) return;

    let presenceChannel;
    let debounceTimer;
    let keepAliveInterval;
    let isMounted = true;

    // We delay the connection by 400ms to allow React to finish setting all the states.
    // This perfectly prevents the "WebSocket closed before connection established" crash!
    const connectionDelay = setTimeout(() => {
      if (!isMounted) return;

      presenceChannel = supabase.channel('online-users', {
        config: { presence: { key: user.id } },
      });

      const trackPresence = async () => {
        try {
          await presenceChannel.track({
            id: user.id,
            workName: workName,
            duties: selectedDuty || [],
            role: userRole,
            _ping: Date.now() 
          });
        } catch (e) {
          // Ignore temporary disconnects
        }
      };

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') trackPresence();
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            const newState = presenceChannel.presenceState();
            const activeUsers = Object.keys(newState).map(key => newState[key][0]);
            setOnlineUsers(activeUsers);
          }, 300); 
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await trackPresence();
            keepAliveInterval = setInterval(trackPresence, 20000);
          }
        });

      // Attach cleanup to the window object for this specific effect run
      window._cleanupPresence = () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };

    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(connectionDelay);
      clearTimeout(debounceTimer);
      clearInterval(keepAliveInterval);
      if (window._cleanupPresence) window._cleanupPresence();
      if (presenceChannel) supabase.removeChannel(presenceChannel);
    };
  }, [user, workName, userRole, JSON.stringify(selectedDuty)]); 

  // --- 4. REAL-TIME HANDSHAKE BROADCASTING ---
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('duty-transfers');
    
    channel.on('broadcast', { event: 'transfer_request' }, ({ payload }) => {
      if (payload.targetId === user.id) {
        setPendingTransferRequest(payload);
      }
    });

    channel.on('broadcast', { event: 'transfer_response' }, ({ payload }) => {
      if (payload.targetId === user.id) {
        setTransferResponse({ ...payload, _ts: Date.now() }); 
      }
    });

    channel.subscribe();
    transferChannelRef.current = channel;

    return () => { supabase.removeChannel(channel); }
  }, [user]);

  // Functions to trigger the handshake
  const sendTransferRequest = async (targetId, duties) => {
    await transferChannelRef.current.send({
      type: 'broadcast',
      event: 'transfer_request',
      payload: { fromId: user.id, fromName: workName, targetId, duties }
    });
  };

  const respondToTransferRequest = async (targetId, status, duties) => {
    await transferChannelRef.current.send({
      type: 'broadcast',
      event: 'transfer_response',
      payload: { fromId: user.id, targetId, status, duties }
    });
    setPendingTransferRequest(null); 
    
    if (status === 'accepted') {
      setSelectedDuty(prev => Array.from(new Set([...(prev || []), ...duties])));
    }
  };

  const resetTransferResponse = () => setTransferResponse(null);

  const setDuty = (val) => setSelectedDuty(val);

  return (
    <DutyContext.Provider value={{ 
      user, userRole, workName, selectedDuty, setDuty, onlineUsers, loading, 
      isMyShiftActive, currentActiveShift, activeRoster,
      pendingTransferRequest, transferResponse, sendTransferRequest, respondToTransferRequest, resetTransferResponse
    }}>
      {children}
    </DutyContext.Provider>
  );
};

export const useDuty = () => useContext(DutyContext);