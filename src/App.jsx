import {
  BrowserRouter,
  HashRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { DutyProvider, useDuty } from "./context/DutyContext";
import Login from "./pages/Login";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./lib/supabase";

import Header from "./components/Header";
import TicketForm from "./components/TicketForm";
import TicketTable from "./components/TicketTable";

const OWNERSHIP_CONFLICT_WINDOW_MS = 30 * 1000;

const getGMT8Time = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * 8);
};

const isOutgoingHandoverSheetWindow = (
  assignedShift,
  inputNow = getGMT8Time(),
) => {
  const time = inputNow.getHours() + inputNow.getMinutes() / 60;

  if (assignedShift === "Night") return time >= 7.0 && time < 7.5;
  if (assignedShift === "Morning") return time >= 14.5 && time < 15.0;
  if (assignedShift === "Afternoon") return time >= 22.5 && time < 23.0;

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
  const degradedTimerRef = useRef(null);
  const degradedAnnouncedRef = useRef(false);
  const recentLocalTicketEditsRef = useRef(new Map());
  const ownershipAlertCooldownRef = useRef(new Map());
  const ownershipChannelRef = useRef(null);
  const sheetSyncWarningShownRef = useRef(false);

  const registerLocalEdit = useCallback((ticketId, field) => {
    const now = Date.now();
    const key = String(ticketId);
    const map = recentLocalTicketEditsRef.current;

    map.set(key, { at: now, field });

    for (const [k, v] of map.entries()) {
      if (now - v.at > OWNERSHIP_CONFLICT_WINDOW_MS) {
        map.delete(k);
      }
    }
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
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-sheets`;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        return {
          data: json,
          error: new Error(json?.error || `Edge function HTTP ${res.status}`),
        };
      }

      return { data: json, error: null };
    } catch (error) {
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

            // Clear any pending degraded timers
            if (degradedTimerRef.current) {
              clearTimeout(degradedTimerRef.current);
              degradedTimerRef.current = null;
            }

            // If we were previously experiencing issues, dispatch restored event
            if (realtimeIssueRef.current) {
              window.dispatchEvent(
                new CustomEvent("tickets-realtime-restored", {
                  detail: {
                    time: Date.now(),
                    text: "Live ticket sync reconnected. Realtime updates restored.",
                  },
                }),
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

            if (!realtimeIssueRef.current) {
              window.dispatchEvent(
                new CustomEvent("tickets-realtime-error", {
                  detail: {
                    time: Date.now(),
                    text: "Live ticket sync connection issue detected. Trying to reconnect...",
                  },
                }),
              );
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
                  window.dispatchEvent(
                    new CustomEvent("tickets-realtime-degraded", {
                      detail: {
                        time: Date.now(),
                        text: "Realtime sync is degraded. Using fallback refresh every 15 seconds.",
                      },
                    }),
                  );
                }
                degradedTimerRef.current = null;
              }, 60 * 1000);
            }

            realtimeIssueRef.current = true;

            // Fetch immediately on error
            if (isComponentMounted) fetchTickets();

            // Attempt to unsubscribe and reconnect after a delay
            if (!reconnectTimer) {
              reconnectTimer = setTimeout(() => {
                if (isComponentMounted && subscription) {
                  console.log("🔄 Attempting to reconnect real-time subscription...");
                  supabase.removeChannel(subscription);
                  subscription = null;
                  reconnectTimer = null;
                  setupRealtimeSubscription(); // Recursively retry
                }
              }, 5000); // Wait 5 seconds before reconnecting
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

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      if (subscription) {
        supabase.removeChannel(subscription);
        subscription = null;
      }
    };
  }, [fetchTickets, user?.id]);

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
          handoverBy: workName || "Agent",
        }).then(({ error: sheetError }) => {
          if (sheetError) {
            console.error("Sheet Create Error:", sheetError);
          }
        });
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

  // --- MODIFIED: Added check for empty array ---
  if (!user || !selectedDuty || selectedDuty.length === 0) {
    return <Navigate to="/login" />;
  }

  return children;
}

export default function App() {
  const Router =
    window.location.protocol === "file:" ? HashRouter : BrowserRouter;

  return (
    <DutyProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
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