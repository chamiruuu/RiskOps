import { useState, useEffect } from "react";
import { Calendar, Clock, LogOut, Shield, Users, X, UserPlus, Mail, Lock, RefreshCw, Copy, Check, Trash2, Edit2, Eye } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useDuty } from "../context/DutyContext";

export default function Header() {
  const { selectedDuty, user, userRole } = useDuty();
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // --- Admin Modal States ---
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [activeTab, setActiveTab] = useState("list"); 
  const [teamMembers, setTeamMembers] = useState([]);
  
  // --- Edit States for Users List ---
  const [editingId, setEditingId] = useState(null);
  const [tempWorkName, setTempWorkName] = useState("");
  const [tempRole, setTempRole] = useState("");

  // --- Create User States ---
  const [newEmail, setNewEmail] = useState("");
  const [newWorkName, setNewWorkName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("User");
  
  const [generatedPwdDisplay, setGeneratedPwdDisplay] = useState(""); 
  
  const [isCreating, setIsCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState({ text: "", type: "" });
  const [copiedPwd, setCopiedPwd] = useState(false);

  const isAdminOrLeader = userRole === 'Admin' || userRole === 'Leader';

  const activeUsers = [
    { name: "Fernando IPCS", duty: "IC1" },
    { name: "Chamiru", duty: "IC0" },
  ];

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (showAdminModal && activeTab === "list") {
      fetchTeam();
    }
  }, [showAdminModal, activeTab]);

  const fetchTeam = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });
    if (data) setTeamMembers(data);
  };

  // --- NEW: Locked Inline Editing Logic ---
  const startEditing = (member) => {
    setEditingId(member.id);
    setTempWorkName(member.work_name || "");
    setTempRole(member.role || "User");
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (userId) => {
    // Update local state instantly
    setTeamMembers(teamMembers.map(member => 
      member.id === userId ? { ...member, work_name: tempWorkName, role: tempRole } : member
    ));
    setEditingId(null);
    
    // Update database
    await supabase.from('profiles').update({ 
      work_name: tempWorkName, 
      role: tempRole 
    }).eq('id', userId);
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user? This will instantly revoke their access.")) return;
    setTeamMembers(teamMembers.filter(member => member.id !== userId));
    await supabase.from('profiles').delete().eq('id', userId);
  };

  // --- Password Generator Logic ---
  const handleGenerateClick = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pwd = "";
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedPwdDisplay(pwd);
  };

  const copyGeneratedPassword = () => {
    if (!generatedPwdDisplay) return;
    navigator.clipboard.writeText(generatedPwdDisplay);
    setCopiedPwd(true);
    setTimeout(() => setCopiedPwd(false), 2000);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateMsg({ text: "", type: "" });

    // --- THE MAGIC TRICK: Step 1. Save your current Admin session ---
    const { data: { session: adminSession } } = await supabase.auth.getSession();

    // Step 2. Create the new user
    const { data, error } = await supabase.auth.signUp({
      email: newEmail,
      password: newPassword, 
    });

    if (error) {
      setCreateMsg({ text: error.message, type: "error" });
      setIsCreating(false);
      return;
    }

    // --- THE MAGIC TRICK: Step 3. Instantly restore your Admin session ---
    // This forcefully kicks out the new user's session and logs you back in as Admin
    if (adminSession) {
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token
      });
    }

    // Step 4. Update the new user's profile
    if (data?.user) {
      await supabase.from('profiles').update({ 
        role: newRole,
        work_name: newWorkName
      }).eq('id', data.user.id);
    }

    setCreateMsg({ text: "User created successfully!", type: "success" });
    setNewEmail("");
    setNewWorkName("");
    setNewPassword("");
    setGeneratedPwdDisplay("");
    setNewRole("User");
    setIsCreating(false);
    
    // Refresh the table so the new user is sitting there when we switch tabs
    fetchTeam();

    setTimeout(() => {
      setActiveTab("list");
      setCreateMsg({ text: "", type: "" });
    }, 1500);
  };

  const getDutyStyle = (role) => {
    switch (role) {
      case "IC0": return { container: "bg-purple-100 border-purple-200", text: "text-purple-700" };
      case "IC1": return { container: "bg-indigo-100 border-indigo-200", text: "text-indigo-700" };
      case "IC2": return { container: "bg-emerald-100 border-emerald-200", text: "text-emerald-700" };
      case "IC3": return { container: "bg-amber-100 border-amber-200", text: "text-amber-700" };
      case "IC5": return { container: "bg-rose-100 border-rose-200", text: "text-rose-700" };
      default: return { container: "bg-slate-100 border-slate-200", text: "text-slate-700" };
    }
  };

  const style = getDutyStyle(selectedDuty);
  const formattedDate = currentTime.toLocaleDateString("en-US", { timeZone: "Asia/Singapore", weekday: "short", month: "short", day: "numeric" });
  const formattedTime = currentTime.toLocaleTimeString("en-US", { timeZone: "Asia/Singapore", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  
  const getGreeting = () => {
    const gmt8TimeStr = currentTime.toLocaleTimeString("en-US", { timeZone: "Asia/Singapore", hour: "numeric", minute: "numeric", hour12: false });
    const [hourStr, minuteStr] = gmt8TimeStr.split(":");
    const timeInHours = parseInt(hourStr) + (parseInt(minuteStr) / 60);

    if (timeInHours >= 7 && timeInHours < 14.5) return "Good Morning";
    if (timeInHours >= 14.5 && timeInHours < 22.5) return "Good Afternoon";
    return "Good Night";
  };

  return (
    <>
      <header className="bg-white rounded-2xl shadow-sm border border-slate-100 mx-6 mt-6 px-6 h-16 flex items-center justify-between shrink-0 z-40 relative">
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-300 ${style.container} ${style.text}`}>
            <Shield size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">RiskOps Portal</h1>
            <p className="text-[10px] font-medium text-slate-500">Internal Control System</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          
          {/* --- ONLY THIS BUTTON WAS CHANGED (Icon Only, Light Grey) --- */}
          {isAdminOrLeader && (
            <button 
              onClick={() => setShowAdminModal(true)} 
              className="flex items-center justify-center w-8 h-8 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-full transition-colors ml-2"
              title="User Management"
            >
              <Users size={16} strokeWidth={2.5} />
            </button>
          )}

          <div className="text-xs font-medium text-slate-500 hidden md:block">
            {getGreeting()}, <span className="text-slate-900 font-bold">{user?.email?.split("@")[0]}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50/50 rounded-full cursor-default">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold text-slate-600">{activeUsers.length} Online</span>
          </div>

          <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-slate-50 rounded-full cursor-default">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Calendar size={14} />
              <span className="text-xs font-semibold">{formattedDate}</span>
            </div>
            <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock size={14} />
              <span className="tabular-nums font-mono text-xs font-semibold tracking-wide">{formattedTime}</span>
              <span className="text-[9px] font-bold text-slate-400 ml-1">GMT+8</span>
            </div>
          </div>

          <button 
            onClick={() => supabase.auth.signOut()} 
            className="flex items-center justify-center w-8 h-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1"
            title="Log Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {showAdminModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200 p-4">
          <div className="bg-white w-[900px] max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-6">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wide">
                  <Users size={16} className="text-indigo-600" />
                  User Management
                </h2>
                
                <div className="flex p-1 bg-slate-100 rounded-lg">
                  <button 
                    onClick={() => setActiveTab("list")}
                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    Users List
                  </button>
                  <button 
                    onClick={() => setActiveTab("create")}
                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === "create" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    Create New
                  </button>
                </div>
              </div>

              <button onClick={() => setShowAdminModal(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
              
              {/* TAB 1: USERS LIST */}
              {activeTab === "list" && (
                <div className="border border-slate-200 bg-white rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-4">Reg. Date</th>
                        <th className="px-5 py-4">Work Name</th>
                        <th className="px-5 py-4">Email</th>
                        <th className="px-5 py-4">Password</th>
                        <th className="px-5 py-4 text-center">Role</th>
                        <th className="px-5 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {teamMembers.map((member) => (
                        <tr key={member.id} className="hover:bg-slate-50 transition-colors group">
                          
                          {/* Registered Date */}
                          <td className="px-5 py-4 text-slate-500 text-[11px] font-medium">
                            {new Date(member.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </td>
                          
                          {/* Work Name */}
                          <td className="px-5 py-4">
                            {editingId === member.id ? (
                              <input 
                                type="text" 
                                value={tempWorkName} 
                                onChange={(e) => setTempWorkName(e.target.value)}
                                className="w-28 px-2 py-1 text-xs font-bold text-slate-800 bg-white border-2 border-indigo-400 rounded outline-none shadow-sm"
                                autoFocus
                                onKeyDown={(e) => e.key === "Enter" && saveEdit(member.id)}
                              />
                            ) : (
                              <span className="font-bold text-slate-800 text-xs">{member.work_name || '-'}</span>
                            )}
                          </td>
                          
                          {/* Email */}
                          <td className="px-5 py-4 text-slate-600 text-xs">{member.email}</td>
                          
                          {/* Password */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3 text-slate-400">
                              <span className="font-mono text-xs tracking-widest text-slate-800">••••••••</span>
                              <button className="hover:text-slate-700 transition-colors" title="Encrypted"><Eye size={14}/></button>
                              <button className="hover:text-slate-700 transition-colors" title="Encrypted"><Copy size={14}/></button>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="px-5 py-4 text-center">
                            {editingId === member.id ? (
                              <select
                                value={tempRole}
                                onChange={(e) => setTempRole(e.target.value)}
                                disabled={member.id === user?.id}
                                className="text-[10px] font-bold px-2 py-1 rounded border-2 border-indigo-400 outline-none cursor-pointer text-center bg-white"
                              >
                                <option value="Admin">Admin</option>
                                <option value="Leader">Leader</option>
                                <option value="User">Normal</option>
                              </select>
                            ) : (
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
                                ${member.role === 'Admin' ? 'bg-slate-900 text-white' : 
                                  member.role === 'Leader' ? 'bg-indigo-100 text-indigo-700' : 
                                  'bg-slate-100 text-slate-600'}`}>
                                {member.role === 'User' ? 'Normal' : member.role}
                              </span>
                            )}
                          </td>

                          {/* Actions (Edit/Delete vs Save/Cancel) */}
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {editingId === member.id ? (
                                <>
                                  <button onClick={() => saveEdit(member.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Save Changes">
                                    <Check size={16} />
                                  </button>
                                  <button onClick={cancelEdit} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors" title="Cancel">
                                    <X size={16} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => startEditing(member)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Edit User">
                                    <Edit2 size={16} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteUser(member.id)}
                                    disabled={member.id === user?.id}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                    title={member.id === user?.id ? "Cannot delete yourself" : "Delete User"}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 2: CREATE NEW */}
              {activeTab === "create" && (
                <div className="max-w-[500px] mx-auto bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
                  <form onSubmit={handleCreateUser} className="space-y-6">
                    
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Email Address <span className="text-red-500">*</span></label>
                      <input type="email" required placeholder="newuser@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-all text-slate-700 font-medium" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Work Name <span className="text-red-500">*</span></label>
                      <input type="text" required placeholder="e.g. Chamiru" value={newWorkName} onChange={(e) => setNewWorkName(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-all text-slate-700 font-medium" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Role</label>
                      <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 cursor-pointer transition-all text-slate-700 font-medium appearance-none">
                        <option value="User">Normal User</option>
                        <option value="Leader">Leader</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </div>

                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Password <span className="text-red-500">*</span></label>
                        <span className="text-[10px] text-slate-400 font-medium">Paste generated password below</span>
                      </div>
                      
                      <input 
                        type="text" 
                        required 
                        minLength={6} 
                        placeholder="Paste password here..." 
                        value={newPassword} 
                        onChange={(e) => setNewPassword(e.target.value)} 
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-all font-mono text-slate-700" 
                      />

                      <div className="flex gap-3">
                        <div className="flex-1 px-4 py-2.5 bg-white border border-dashed border-slate-300 rounded-lg text-sm font-mono text-slate-500 flex items-center">
                          {generatedPwdDisplay || "Click Generate ->"}
                        </div>
                        <button type="button" onClick={handleGenerateClick} className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg transition-all flex items-center gap-2">
                          <RefreshCw size={14} /> Generate
                        </button>
                        {generatedPwdDisplay && (
                          <button type="button" onClick={copyGeneratedPassword} className="px-4 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-black transition-all flex items-center gap-2">
                            {copiedPwd ? <Check size={14}/> : <Copy size={14} />}
                          </button>
                        )}
                      </div>
                    </div>

                    <button type="submit" disabled={isCreating} className="w-full py-3.5 bg-slate-400 hover:bg-slate-500 text-white text-sm font-bold rounded-lg transition-all shadow-sm disabled:opacity-50 mt-4">
                      {isCreating ? "Creating Account..." : "Create Account"}
                    </button>

                    {createMsg.text && (
                      <div className={`mt-4 text-xs font-bold px-4 py-3 rounded-lg flex items-center justify-center text-center ${createMsg.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                        {createMsg.text}
                      </div>
                    )}
                  </form>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}