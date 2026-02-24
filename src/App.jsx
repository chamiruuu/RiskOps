import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DutyProvider, useDuty } from "./context/DutyContext";
import Login from "./pages/Login";
import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";

import Header from "./components/Header";
import TicketForm from "./components/TicketForm";
import TicketTable from "./components/TicketTable";

function Dashboard() {
  const { selectedDuty, user } = useDuty();
  const dutyNumber = selectedDuty ? selectedDuty.replace(/\D/g, "").padStart(2, "0") : "00";
  const workName = user?.email?.split("@")[0] || "RiskOps";
  
  const [tickets, setTickets] = useState([]);

  // --- MISSING FUNCTION RESTORED HERE ---
  // 1. Define fetchTickets FIRST so React knows what it is
  const fetchTickets = async () => {
    let query = supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false });

    // Filter by duty unless it is IC0 (IC0 sees everything)
    if (selectedDuty !== "IC0") {
      query = query.eq("ic_account", selectedDuty);
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

    // --- NEW: SUPABASE REAL-TIME LISTENER ---
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
  }, [selectedDuty]);

  // 2. Insert new ticket to Supabase
  const handleAddTicket = async (newTicket) => {
    const safeMerchantId = String(newTicket.merchant_name).trim();
    console.log("1. Searching database for Merchant ID:", safeMerchantId);

    // 1. Look up the correct IC from the merchants table
    const { data: merchantData, error: lookupError } = await supabase
      .from("merchants")
      .select("ic_account")
      .eq("merchant_id", safeMerchantId)
      .maybeSingle();

    // --- PERMANENT FIX: THE HARD STOP ---
    // If there is a network error or database crash, STOP immediately.
    if (lookupError) {
      console.error("Lookup Error:", lookupError);
      alert("Network Error: Could not verify the Merchant ID. The ticket was NOT saved. Please check your connection and try again.");
      return; // <-- This completely stops the function from saving a broken ticket!
    }

    console.log("2. Database found this IC Account:", merchantData?.ic_account);

    // 2. If no network error, but the Merchant ID simply isn't in the database, fallback to selected duty
    const finalIcAccount = merchantData?.ic_account || selectedDuty;

    const ticketToInsert = {
      ...newTicket,
      merchant_name: safeMerchantId,
      ic_account: finalIcAccount
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
    await supabase.from("tickets").update({ [field]: value }).eq("id", id);
  };

  // 4. Add a timeline note (The cool new feature!)
  const handleAddNote = async (id, noteText) => {
    const ticket = tickets.find(t => t.id === id);
    
    // Format the date (e.g., "Feb 16")
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    
    // Shift logic (A, M, N) based on time - you can adjust these hours!
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
      <div className="flex flex-1 overflow-hidden p-6 gap-6">
        <TicketForm onAddTicket={handleAddTicket} />
        <TicketTable 
          tickets={tickets} 
          onUpdateTicket={handleUpdateTicket} 
          onAddNote={handleAddNote}
          dutyNumber={dutyNumber} 
        />
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading, selectedDuty } = useDuty();
  if (loading)
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  if (!user || !selectedDuty) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  return (
    <DutyProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </BrowserRouter>
    </DutyProvider>
  );
}