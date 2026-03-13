import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { DutyProvider, useDuty } from "./context/DutyContext";
import Login from "./pages/Login";
import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";

import Header from "./components/Header";
import TicketForm from "./components/TicketForm";
import TicketTable from "./components/TicketTable";

function Dashboard() {
  // FIX: Grab workName from Context
  const { selectedDuty, user, workName } = useDuty();
  const dutyNumber = selectedDuty || []; 
  
  // FIX: This takes "Fernando IPCS" and just keeps "Fernando" for your scripts
  const shortWorkName = workName ? workName.split(" ")[0] : "RiskOps";
  
  const [tickets, setTickets] = useState([]);
  const [updaterStatus, setUpdaterStatus] = useState(null);

  useEffect(() => {
    if (!window.electronAPI || typeof window.electronAPI.onUpdaterStatus !== "function") {
      return undefined;
    }

    const unsubscribe = window.electronAPI.onUpdaterStatus((payload) => {
      setUpdaterStatus(payload);
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  // 1. Define fetchTickets FIRST so React knows what it is
  const fetchTickets = async () => {
    let query = supabase
      .from("tickets")
      .select("*")
      .eq('is_archived', false)
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
  };

  // 1. Fetch tickets and listen for LIVE updates!
  useEffect(() => {
    // Grab the initial data
    fetchTickets();

    // --- SUPABASE REAL-TIME LISTENER ---
    const subscription = supabase
      .channel("tickets-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        (payload) => {
          console.log("Live update received from Supabase!", payload);
          // Whenever ANY change happens in the database, silently refresh the list instantly!
          fetchTickets(); 
        }
      )
      .subscribe();

    // Cleanup the listener if the user logs out or closes the component
    return () => {
      supabase.removeChannel(subscription);
    };
  // FIX: Use JSON.stringify so React knows the duties haven't actually changed!
  }, [JSON.stringify(selectedDuty)]);

  // 2. Insert new ticket to Supabase
  // 2. Insert new ticket to Supabase
  const handleAddTicket = async (newTicket) => {
    // --- STRICT RULE: Player ID is absolutely required ---
    if (!newTicket.member_id || newTicket.member_id.trim() === "") {
      alert("⚠️ Cannot proceed: Player ID is required to create a ticket!");
      return; 
    }

    const memberId = newTicket.member_id.trim();
    
    // 1. Determine Merchant ID: Extract from @xxx, OR default to "-"
    let extractedMerchant = memberId.includes("@") ? memberId.split("@")[1].trim() : "-";
    
    // Use the form input if the user typed one manually, otherwise use the extracted one
    let parsedMerchantId = String(newTicket.merchant_name || "").trim();
    if (!parsedMerchantId || parsedMerchantId === "-") {
      parsedMerchantId = extractedMerchant;
    }

    let finalIcAccount = "IC3"; // Default fallback duty
    let finalMerchantName = parsedMerchantId;

    // 2. Look up the Merchant ID in the database (only if it's not "-")
    if (parsedMerchantId !== "-") {
      console.log("1. Searching database for Merchant ID:", parsedMerchantId);
      const { data: merchantData, error: lookupError } = await supabase
        .from("merchants")
        .select("ic_account")
        .eq("merchant_id", parsedMerchantId)
        .maybeSingle();

      if (lookupError) {
        console.error("Lookup Error:", lookupError);
        alert("Network Error: Could not verify the Merchant ID. The ticket was NOT saved. Please check your connection and try again.");
        return; 
      }

      if (merchantData && merchantData.ic_account) {
        console.log("2. Database found this IC Account:", merchantData.ic_account);
        finalIcAccount = merchantData.ic_account;
      } else {
        console.log("2. Merchant ID not found in DB. Defaulting duty to IC3.");
        finalIcAccount = "IC3";
      }
    } else {
      console.log("No @xxx found in Player ID and no manual Merchant ID provided. Defaulting to '-' and IC3.");
    }

    const ticketToInsert = {
      ...newTicket,
      merchant_name: finalMerchantName, // Will save "012" or "-"
      ic_account: finalIcAccount        // Will save mapped DB account or "IC3"
    };

    // 3. Save to database
    const { data, error } = await supabase
      .from("tickets")
      .insert([ticketToInsert])
      .select();

    if (error) {
      console.error("Supabase Insert Error:", error);
      alert("DATABASE ERROR: " + error.message);
    } else if (data) {
      setTickets([data[0], ...tickets]); // Instantly update the UI
    }
  };

  // 3. Update existing ticket (Tracking No or Status)
  const handleUpdateTicket = async (id, field, value) => {
    // Optimistic UI update (makes the UI feel instantly fast)
    setTickets(tickets.map(t => t.id === id ? { ...t, [field]: value } : t));
    
    // Background DB update
    const { error } = await supabase.from("tickets").update({ [field]: value }).eq("id", id);
    
    // Check if Supabase rejected the update
    if (error) {
      console.error(`Failed to update ${field} in Supabase:`, error);
      alert(`Could not save changes to ${field}. Please refresh and try again.`);
      fetchTickets(); // Revert the UI if it failed to save
    }
  };

  // --- NEW: 4. Delete Ticket ---
  const handleDeleteTicket = async (id) => {
    // Optimistic UI update: instantly remove it from the screen
    setTickets(tickets.filter(t => t.id !== id));

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
    const ticket = tickets.find(t => t.id === id);
    
    // Format the date (e.g., "Feb 16")
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    
    // Shift logic (A, M, N) based on time
    const hour = now.getHours();
    const shift = hour >= 6 && hour < 14 ? "M" : hour >= 14 && hour < 22 ? "A" : "N";

    // Create the new note object
    const newNote = {
      text: noteText,
      author: workName,
      timestamp: `${dateStr} ${shift}`
    };

    const updatedNotes = [...(ticket.notes || []), newNote];

    // Update UI and DB
    setTickets(tickets.map(t => t.id === id ? { ...t, notes: updatedNotes } : t));
    await supabase.from("tickets").update({ notes: updatedNotes }).eq("id", id);
  };

  return (
    <div className="h-screen bg-slate-50 text-slate-900 font-sans flex flex-col overflow-hidden">
      <Header />
      {updaterStatus && (
        <div className="mx-6 mt-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900">
          <div className="flex items-center justify-between gap-4">
            <p className="font-medium">{updaterStatus.message}</p>
            {updaterStatus.type === "downloading" && typeof updaterStatus.percent === "number" && (
              <span className="font-semibold">{updaterStatus.percent.toFixed(1)}%</span>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden p-6 gap-6">
        <TicketForm onAddTicket={handleAddTicket} />
        <TicketTable 
          tickets={tickets} 
          onUpdateTicket={handleUpdateTicket} 
          onAddNote={handleAddNote}
          onDeleteTicket={handleDeleteTicket} // <-- NEW: Passed the delete function here!
          dutyNumber={dutyNumber} 
          shortWorkName={shortWorkName} // <-- NEW PROP
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
  const Router = window.location.protocol === "file:" ? HashRouter : BrowserRouter;

  return (
    <DutyProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </Router>
    </DutyProvider>
  );
}