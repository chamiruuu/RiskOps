import {
  BrowserRouter,
  HashRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { DutyProvider, useDuty } from "./context/DutyContext";
import Login from "./pages/Login";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./lib/supabase";
import { createCorrelationId, LOGIC_CODES } from "./lib/logicHealth";

import Header from "./components/Header";
import TicketForm from "./components/TicketForm";
import TicketTable from "./components/TicketTable";
import SetPassword from "./pages/SetPassword"; // <-- ADD THIS
import DesktopRouter from "./pages/DesktopRouter";

const OWNERSHIP_CONFLICT_WINDOW_MS = 30 * 1000;
const REALTIME_ERROR_ANNOUNCE_DELAY_MS = 12000;
const REALTIME_MANUAL_RECONNECT_DELAY_MS = 30000;

const getGMT8Time = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * 8);
};

// --- NEW: Helper to ensure the Google Sheet name is always clean ---
const getCleanHandoverName = (rawName) => {
  if (!rawName) return "Agent";
  // This removes " IPCS" (case-insensitive) from the name so it only leaves "Fernando"
  return rawName.replace(/ IPCS/gi, "").trim();
};

const isOutgoingHandoverSheetWindow = (
  assignedShift,
  inputNow = getGMT8Time(),
) => {
  const time = inputNow.getHours() + inputNow.getMinutes() / 60;

  if (assignedShift === "Night") return time >= 7.15 && time < 7.5; // 07:09 - 07:30
  if (assignedShift === "Morning") return time >= 14.65 && time < 15.0; // 14:39 - 15:00
  if (assignedShift === "Afternoon") return time >= 22.65 && time < 23.0; // 22:39 - 23:00

  return false;
};

const formatNotesSummaryForSheet = (notes) => {
  return notes?.length > 0 ? `${notes.length} Messages` : "No Notes";
};

function Dashboard() {
  // FIX: Grab workName from Context
  const { selectedDuty, user, workName, myAssignedShift } = useDuty();
  const dutyNumber = selectedDuty || [];

  // FIX: This takes "Fernando IPCS" and just keeps "Fernando" for your scripts
  const shortWorkName = workName ? workName.split(" ")[0] : "RiskOps";

  const [tickets, setTickets] = useState([]);
  const realtimeIssueRef = useRef(false);
  const realtimeOutageStartedAtRef = useRef(null);
  const realtimeErrorAnnounceTimerRef = useRef(null);
  const degradedTimerRef = useRef(null);
  const degradedAnnouncedRef = useRef(false);
  const recentLocalTicketEditsRef = useRef(new Map());
  const ownershipAlertCooldownRef = useRef(new Map());
  const ownershipChannelRef = useRef(null);
  const sheetSyncWarningShownRef = useRef(false);
  const realtimeEventDedupRef = useRef(new Map());

  const emitRealtimeEvent = useCallback((
    eventName,
    text,
    cooldownMs = 10000,
    metadata = {},
  ) => {
    const now = Date.now();
    const token = `${eventName}|${text || ""}`;
    const lastAt = realtimeEventDedupRef.current.get(token) || 0;
    if (now - lastAt < cooldownMs) return;

    realtimeEventDedupRef.current.set(token, now);
    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: {
          time: now,
          text,
          at: now,
          source: "realtime",
          correlationId: metadata.correlationId || createCorrelationId("RT"),
          code: metadata.code,
          title: metadata.title,
          level: metadata.level,
        },
      }),
    );
  }, []);

  const registerLocalEdit = useCallback((ticketId, field) => {
    const now = Date.now();
    const key = String(ticketId);
    const map = recentLocalTicketEditsRef.current;

    map.set(key, { at: now, field });

    // ✅ PERF-RENDER-001: Removed O(n) cleanup loop from critical path
    // Cleanup is now handled by separate interval below
  }, []);

  const broadcastEditActivity = useCallback(
    (ticketId, field) => {
      if (!ownershipChannelRef.current || !user?.id) return;

      ownershipChannelRef.current.send({
        type: "broadcast",
        event: "ticket_edit_activity",
        payload: {
          userId: user.id,
          userName: shortWorkName,
          ticketId,
          field,
          at: Date.now(),
        },
      });
    },
    [shortWorkName, user],
  );

  const invokeSyncSheets = useCallback(async (body) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !anonKey) {
        throw new Error("Missing Supabase config for sync-sheets invoke.");
      }

      const invokeWithToken = async (token) =>
        fetch(`${supabaseUrl}/functions/v1/sync-sheets`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: anonKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

      // This function doesn't require user identity, only a valid project JWT.
      // Using anon JWT directly avoids invalid user-session token noise.
      const response = await invokeWithToken(anonKey);

      const raw = await response.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = { raw };
      }

      if (!response.ok) {
        const detailedError = Object.assign(
          new Error(
            data?.message || data?.error || `Edge function HTTP ${response.status}`,
          ),
          {
            status: response.status,
            payload: data,
          },
        );
        throw detailedError;
      }

      return { data, error: null };
    } catch (error) {
      console.error('Invoke error:', error);
      return { data: null, error };
    }
  }, []);

  const syncTicketFieldsToSheet = useCallback(async (ticketId, fields, rowHint) => {
    if (!ticketId || !fields || Object.keys(fields).length === 0) return;

    try {
      const { data, error } = await invokeSyncSheets({
        action: "UPDATE_FIELDS",
        ticketId: String(ticketId),
        fields,
        rowHint,
      });

      if (error) {
        console.error("Sheet field sync error:", error);
        if (!sheetSyncWarningShownRef.current) {
          sheetSyncWarningShownRef.current = true;
          alert(
            "Ticket saved in system, but Google Sheet sync failed. Please check Edge Function deployment/logs.",
          );
        }
        return;
      }

      if (data && data.updated === false) {
        console.warn("Sheet field sync skipped (row not found/mapped):", {
          ticketId,
          fields,
          data,
        });
        // Many tickets are never appended to the handover sheet by design.
        // Treat row-not-found as a non-blocking skip instead of a user-facing failure.
        return;
      }
    } catch (error) {
      console.error("Sheet field sync error:", error);
      if (!sheetSyncWarningShownRef.current) {
        sheetSyncWarningShownRef.current = true;
        alert(
          "Ticket saved in system, but Google Sheet sync failed. Please check Edge Function deployment/logs.",
        );
      }
    }
  }, [invokeSyncSheets]);

  // 1. Define fetchTickets FIRST so React knows what it is
  const fetchTickets = useCallback(async () => {
    let query = supabase
      .from("tickets")
      .select("*")
      // Include rows where is_archived is NULL as active tickets too.
      .not("is_archived", "is", true)
      .order("created_at", { ascending: false });

    // --- MODIFIED: Handle array of duties ---
    if (!selectedDuty.includes("IC0")) {
      // If they are not IC0, fetch tickets where the ic_account is IN their selected array
      query = query.in("ic_account", selectedDuty);
    }

    const { data, error } = await query;

    if (!error && data) {
      setTickets(data);
    } else {
      console.error("Error fetching tickets:", error);
    }
  }, [selectedDuty]);

  // 1. Fetch tickets and listen for LIVE updates!
  useEffect(() => {
    // Grab initial data on next tick to avoid synchronous setState-in-effect lint warning.
    const initialFetchTimer = setTimeout(() => {
      fetchTickets();
    }, 0);

    let subscription = null;
    let reconnectTimer = null;
    let isComponentMounted = true;

    const setupRealtimeSubscription = () => {
      if (!isComponentMounted) return;

      // --- SUPABASE REAL-TIME LISTENER ---
      const channelName = `tickets-channel-${user?.id || "anon"}`;
      subscription = supabase
        .channel(channelName, {
          config: {
            broadcast: { self: true },
            presence: { key: user?.id || "anon" },
          },
        })
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "tickets" },
          (payload) => {
            console.log("Live update received from Supabase!", payload);
            // Whenever ANY change happens in the database, silently refresh the list instantly!
            if (isComponentMounted) fetchTickets();
          },
        )
        .subscribe(async (status) => {
          // Ensure component is still mounted before state updates
          if (!isComponentMounted) return;

          if (status === "SUBSCRIBED") {
            console.log("✅ Real-time subscription SUBSCRIBED");

            if (realtimeErrorAnnounceTimerRef.current) {
              clearTimeout(realtimeErrorAnnounceTimerRef.current);
              realtimeErrorAnnounceTimerRef.current = null;
            }
            realtimeOutageStartedAtRef.current = null;

            // Clear any pending degraded timers
            if (degradedTimerRef.current) {
              clearTimeout(degradedTimerRef.current);
              degradedTimerRef.current = null;
            }

            // If we were previously experiencing issues, dispatch restored event
            if (realtimeIssueRef.current) {
              emitRealtimeEvent(
                "tickets-realtime-restored",
                "Live ticket sync reconnected. Realtime updates restored.",
                12000,
                {
                  code: LOGIC_CODES.REALTIME_RESTORED,
                  title: "Realtime Restored",
                  level: "success",
                },
              );
              realtimeIssueRef.current = false;
            }

            degradedAnnouncedRef.current = false;

            // Clear any pending reconnect timers
            if (reconnectTimer) {
              clearTimeout(reconnectTimer);
              reconnectTimer = null;
            }

            // Fetch latest data on successful subscription
            if (isComponentMounted) fetchTickets();
          }

          // If realtime socket is unstable, force refresh so UIs stay in sync.
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn(`⚠️ Real-time status: ${status}`);

            if (!realtimeOutageStartedAtRef.current) {
              realtimeOutageStartedAtRef.current = Date.now();
            }

            if (!realtimeIssueRef.current && !realtimeErrorAnnounceTimerRef.current) {
              realtimeErrorAnnounceTimerRef.current = setTimeout(() => {
                realtimeErrorAnnounceTimerRef.current = null;
                if (!isComponentMounted || !realtimeOutageStartedAtRef.current) {
                  return;
                }

                emitRealtimeEvent(
                  "tickets-realtime-error",
                  "Live ticket sync connection issue detected. Trying to reconnect...",
                  15000,
                  {
                    code: LOGIC_CODES.REALTIME_ERROR,
                    title: "Realtime Error",
                    level: "error",
                  },
                );
                realtimeIssueRef.current = true;
              }, REALTIME_ERROR_ANNOUNCE_DELAY_MS);
            }

            // Setup degraded notification timeout (only trigger once)
            if (!degradedTimerRef.current && !degradedAnnouncedRef.current) {
              degradedTimerRef.current = setTimeout(() => {
                if (
                  isComponentMounted &&
                  realtimeIssueRef.current &&
                  !degradedAnnouncedRef.current
                ) {
                  degradedAnnouncedRef.current = true;
                  emitRealtimeEvent(
                    "tickets-realtime-degraded",
                    "Realtime sync is degraded. Using fallback refresh every 15 seconds.",
                    30000,
                    {
                      code: LOGIC_CODES.REALTIME_DEGRADED,
                      title: "Realtime Degraded",
                      level: "warning",
                    },
                  );
                }
                degradedTimerRef.current = null;
              }, 60 * 1000);
            }

            // Fetch immediately on error
            if (isComponentMounted) fetchTickets();

            // Let Supabase auto-reconnect first. Only force a reconnect if outage is sustained.
            if (!reconnectTimer) {
              reconnectTimer = setTimeout(() => {
                if (isComponentMounted && subscription && realtimeOutageStartedAtRef.current) {
                  console.log("🔄 Attempting to reconnect real-time subscription...");
                  supabase.removeChannel(subscription);
                  subscription = null;
                  reconnectTimer = null;
                  setupRealtimeSubscription(); // Recursively retry
                  return;
                }

                reconnectTimer = null;
              }, REALTIME_MANUAL_RECONNECT_DELAY_MS);
            }
          }
        });
    };

    setupRealtimeSubscription();

    // Fallback polling to keep all screens synced even if realtime drops (more frequent).
    const fallbackTimer = setInterval(() => {
      if (isComponentMounted) fetchTickets();
    }, 12000); // Increased from 15s to 12s for better sync

    // Cleanup the listener if the user logs out or closes the component
    return () => {
      isComponentMounted = false;
      clearTimeout(initialFetchTimer);
      clearInterval(fallbackTimer);

      if (degradedTimerRef.current) {
        clearTimeout(degradedTimerRef.current);
        degradedTimerRef.current = null;
      }

      if (realtimeErrorAnnounceTimerRef.current) {
        clearTimeout(realtimeErrorAnnounceTimerRef.current);
        realtimeErrorAnnounceTimerRef.current = null;
      }

      realtimeOutageStartedAtRef.current = null;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      if (subscription) {
        supabase.removeChannel(subscription);
        subscription = null;
      }
    };
  }, [emitRealtimeEvent, fetchTickets, user?.id]);

  // ✅ PERF-RENDER-001: Periodic cleanup of recent local edits (instead of on every edit)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const map = recentLocalTicketEditsRef.current;
      
      for (const [k, v] of map.entries()) {
        if (now - v.at > OWNERSHIP_CONFLICT_WINDOW_MS) {
          map.delete(k);
        }
      }
    }, 10000); // Clean every 10 seconds

    return () => clearInterval(cleanupInterval);
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel("ticket-edit-activity");

    channel
      .on("broadcast", { event: "ticket_edit_activity" }, ({ payload }) => {
        if (!payload || payload.userId === user.id) return;

        // Skip ownership conflict for note edits (multiple users can edit notes concurrently)
        if (payload.field === "notes") return;

        const now = Date.now();
        const ticketKey = String(payload.ticketId);
        const localEdit = recentLocalTicketEditsRef.current.get(ticketKey);

        if (!localEdit) return;
        if (now - localEdit.at > OWNERSHIP_CONFLICT_WINDOW_MS) return;

        const cooldownKey = `${ticketKey}|${payload.userId}`;
        const lastAlert =
          ownershipAlertCooldownRef.current.get(cooldownKey) || 0;
        if (now - lastAlert < 20 * 1000) return;

        ownershipAlertCooldownRef.current.set(cooldownKey, now);

        window.dispatchEvent(
          new CustomEvent("ownership-conflict-alert", {
            detail: {
              time: now,
              at: now,
              source: "ownership",
              code: LOGIC_CODES.OWNERSHIP_CONFLICT,
              title: "Ownership Conflict",
              level: "warning",
              correlationId: createCorrelationId("DT"),
              text: `${payload.userName || "Another user"} updated ticket ${payload.ticketId} while you were editing it. Please review latest values before continuing.`,
            },
          }),
        );
      })
      .subscribe();

    ownershipChannelRef.current = channel;

    return () => {
      ownershipChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [user]);

  // --- GOOGLE SHEET OUTGOING HANDOVER WINDOW DETECTOR ---
  const isOutgoingHandoverWindow = useCallback(
    () => isOutgoingHandoverSheetWindow(myAssignedShift),
    [myAssignedShift],
  );

  // 2. Insert new ticket to Supabase
  const handleAddTicket = async (newTicket) => {
    // --- STRICT RULE: Player ID is absolutely required ---
    if (!newTicket.member_id || newTicket.member_id.trim() === "") {
      alert("⚠️ Cannot proceed: Player ID is required to create a ticket!");
      return;
    }

    // Since TicketForm.jsx now pulls the exact merchant_name and ic_account
    // straight from the live Google Sheet, we completely bypass the database lookup!
    // We just save the exact ticket payload directly to Supabase.
    const { data, error } = await supabase
      .from("tickets")
      .insert([newTicket])
      .select();

    if (error) {
      console.error("Supabase Insert Error:", error);
      alert("DATABASE ERROR: " + error.message);
    } else if (data) {
      setTickets([data[0], ...tickets]); // Instantly update the UI

      // Send to Google Sheet if created by outgoing shift during handover.
      if (isOutgoingHandoverWindow()) {
        console.log("Pushing NEW ticket to Google Sheet Handover:", data[0]);

        // Edge function expects an array of tickets even for a single insert
        invokeSyncSheets({
          action: "APPEND",
          tickets: [data[0]],
          // --- UPDATED: Force the clean name ---
          handoverBy: getCleanHandoverName(workName),
        })
        .then(({ error: sheetError }) => {
          if (sheetError) {
            console.error("Sheet Create Error:", sheetError);
          }
        })
        .catch((err) => console.error("Sheet sync error on new ticket:", err));
      }
    }
  };

  // 3. Update existing ticket (Tracking No or Status)
  const handleUpdateTicket = async (id, field, value) => {
    registerLocalEdit(id, field);
    broadcastEditActivity(id, field);

    // Optimistic UI update (makes the UI feel instantly fast)
    setTickets(
      tickets.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
    );

    // Background DB update
    const { error } = await supabase
      .from("tickets")
      .update({ [field]: value })
      .eq("id", id);

    // Check if Supabase rejected the update
    if (error) {
      console.error(`Failed to update ${field} in Supabase:`, error);
      alert(
        `Could not save changes to ${field}. Please refresh and try again.`,
      );
      fetchTickets(); // Revert the UI if it failed to save
      return;
    }

    const sheetFieldMap = {
      login_id: value,
      member_id: value,
      provider_account: value,
      tracking_no: value,
      status: value,
    };

    if (Object.prototype.hasOwnProperty.call(sheetFieldMap, field)) {
      const rowHint = tickets.find((t) => t.id === id);
      syncTicketFieldsToSheet(id, { [field]: sheetFieldMap[field] }, rowHint);
    }
  };

  // --- NEW: 4. Delete Ticket ---
  const handleDeleteTicket = async (id) => {
    // Optimistic UI update: instantly remove it from the screen
    setTickets(tickets.filter((t) => t.id !== id));

    // Tell Supabase to permanently delete it
    const { error } = await supabase.from("tickets").delete().eq("id", id);

    if (error) {
      console.error("Failed to delete ticket in Supabase:", error);
      alert("Could not delete ticket. Please check your connection.");
      fetchTickets(); // Revert the UI to bring the ticket back if it failed
    }
  };

  // 5. Add a timeline note
  const handleAddNote = async (id, noteText) => {
    registerLocalEdit(id, "notes");
    broadcastEditActivity(id, "notes");

    const ticket = tickets.find((t) => t.id === id);

    // Format the date (e.g., "Feb 16")
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    // Shift logic (A, M, N) based on time
    const hour = now.getHours();
    const shift =
      hour >= 6 && hour < 14 ? "M" : hour >= 14 && hour < 22 ? "A" : "N";

    // Create the new note object with edit tracking
    const newNote = {
      text: noteText,
      author: workName,
      timestamp: `${dateStr} ${shift}`,
      createdAt: Date.now(), // Exact timestamp for 3-hour edit window
      createdByUserId: user?.id, // Track who created it
      isEdited: false, // Flag to show if note has been edited
    };

    const updatedNotes = [...(ticket.notes || []), newNote];

    // Update UI and DB
    setTickets(
      tickets.map((t) => (t.id === id ? { ...t, notes: updatedNotes } : t)),
    );
    const { error } = await supabase
      .from("tickets")
      .update({ notes: updatedNotes })
      .eq("id", id);

    if (!error) {
      const rowHint = tickets.find((t) => t.id === id);
      syncTicketFieldsToSheet(id, {
        notes: formatNotesSummaryForSheet(updatedNotes),
      }, rowHint);
    }
  };

  // 6. Edit an existing note (within 3-hour window)
  const handleEditNote = async (ticketId, noteIndex, newText) => {
    registerLocalEdit(ticketId, "notes");
    broadcastEditActivity(ticketId, "notes");

    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket?.notes || !ticket.notes[noteIndex]) return;

    const updatedNotes = [...ticket.notes];
    updatedNotes[noteIndex] = {
      ...updatedNotes[noteIndex],
      text: newText,
      isEdited: true,
      editedAt: Date.now(),
    };

    // Update UI and DB
    setTickets(
      tickets.map((t) =>
        t.id === ticketId ? { ...t, notes: updatedNotes } : t,
      ),
    );
    const { error } = await supabase
      .from("tickets")
      .update({ notes: updatedNotes })
      .eq("id", ticketId);

    if (!error) {
      const rowHint = tickets.find((t) => t.id === ticketId);
      syncTicketFieldsToSheet(ticketId, {
        notes: formatNotesSummaryForSheet(updatedNotes),
      }, rowHint);
    }
  };

  // 7. Delete a note
  const handleDeleteNote = async (ticketId, noteIndex) => {
    registerLocalEdit(ticketId, "notes");
    broadcastEditActivity(ticketId, "notes");

    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket?.notes) return;

    const updatedNotes = ticket.notes.filter((_, idx) => idx !== noteIndex);

    // Update UI and DB
    setTickets(
      tickets.map((t) =>
        t.id === ticketId ? { ...t, notes: updatedNotes } : t,
      ),
    );
    const { error } = await supabase
      .from("tickets")
      .update({ notes: updatedNotes })
      .eq("id", ticketId);

    if (!error) {
      const rowHint = tickets.find((t) => t.id === ticketId);
      syncTicketFieldsToSheet(ticketId, {
        notes: formatNotesSummaryForSheet(updatedNotes),
      }, rowHint);
    }
  };

  return (
    <div className="h-screen bg-slate-50 text-slate-900 font-sans flex flex-col overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden p-6 gap-6">
        <TicketForm onAddTicket={handleAddTicket} />
        <TicketTable
          tickets={tickets}
          onUpdateTicket={handleUpdateTicket}
          onAddNote={handleAddNote}
          onEditNote={handleEditNote}
          onDeleteNote={handleDeleteNote}
          onDeleteTicket={handleDeleteTicket}
          dutyNumber={dutyNumber}
          shortWorkName={shortWorkName}
        />
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading, selectedDuty } = useDuty();

  if (loading)
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );

  // --- NEW: THE INVITE TRAP ---
  // If the URL contains "type=invite" (which Supabase adds to email invite links), 
  // immediately kick them back to the Set Password page. No sneaking into the dashboard!
  if (window.location.hash.includes('type=invite')) {
    // Kick them to the obscure URL instead!
    return <Navigate to="/secure-setup/auth-token" />; 
  }

  // --- MODIFIED: Added check for empty array ---
  if (!user || !selectedDuty || selectedDuty.length === 0) {
    return <Navigate to="/login" />;
  }

  return children;
}

function DeepLinkListener() {
  const navigate = useNavigate();

  useEffect(() => {
    // Electron-only deep-link hook: riskops://auth#access_token=...&refresh_token=...
    if (!window.electronAPI || !window.electronAPI.onDeepLink) return;

    window.electronAPI.onDeepLink(async (url) => {
      try {
        const hashString = url?.split("#")[1];
        if (!hashString) return;

        const params = new URLSearchParams(hashString);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (accessToken && refreshToken) {
            // 1. Manually log them into Supabase inside the desktop app!
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            // 2. THIS WAS THE TYPO: Navigate to the obscure URL!
            navigate('/secure-setup/auth-token'); 
          }
      } catch (err) {
        console.error("Deep link auth failed:", err);
      }
    });
  }, [navigate]);

  return null;
}

export default function App() {
  const Router =
    window.location.protocol === "file:" ? HashRouter : BrowserRouter;

  const isVercelWeb =
    import.meta.env.VERCEL === "1" ||
    import.meta.env.MODE === "production";

  return (
    <DutyProvider>
      <Router>
        <DeepLinkListener />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/secure-setup/auth-token"
            element={isVercelWeb ? <DesktopRouter /> : <SetPassword />}
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </Router>
    </DutyProvider>
  );
}
``