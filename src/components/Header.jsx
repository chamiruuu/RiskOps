import { useState, useEffect } from "react";
import { Calendar, Clock, LogOut, Shield, Users, X, UserPlus, Mail, Lock, RefreshCw, Copy, Check, Trash2, Edit2, Save } from "lucide-react";
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

  // --- Create User States ---
  const [newEmail, setNewEmail] = useState("");
  const [newWorkName, setNewWorkName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("User");
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

  // --- Inline Editing Logic ---
  const startEditing = (member) => {
    setEditingId(member.id);
    setTempWorkName(member.work_name || "");
  };

  const saveWorkName = async (userId) => {
    // Update local state instantly
    setTeamMembers(teamMembers.map(member => 
      member.id === userId ? { ...member, work_name: tempWorkName } : member
    ));
    setEditingId(null);
    
    // Update database
    await supabase.from('profiles').update({ work_name: tempWorkName }).eq('id', userId);
  };

  const handleRoleChange = async (userId, newRole) => {
    setTeamMembers(teamMembers.map(member => 
      member.id === userId ? { ...member, role: newRole } : member
    ));
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user? This will instantly revoke their access.")) return;
    
    // Remove from local state
    setTeamMembers(teamMembers.filter(member => member.id !== userId));
    
    // Delete their profile from the database
    await supabase.from('profiles').delete().eq('id', userId);
  };

  // --- Password Generator Logic ---
  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pwd = "";
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
  };

  const copyPassword = () => {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword);
    setCopiedPwd(true);
    setTimeout(() => setCopiedPwd(false), 2000);
  };

  // --- Create User Logic ---
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateMsg({ text: "", type: "" });

    const { data, error } = await supabase.auth.signUp({
      email: newEmail,
      password: newPassword,
    });

    if (error) {
      setCreateMsg({ text: error.message, type: "error" });
      setIsCreating(false);
      return;
    }

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
    setNewRole("User");
    setIsCreating(false);
    
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

          {isAdminOrLeader && (
            <button 
              onClick={() => setShowAdminModal(true)} 
              className="flex items-center justify-center gap-2 px-3 h-8 bg-slate-900 text-white hover:bg-black rounded-lg transition-colors ml-2 text-xs font-semibold shadow-sm"
            >
              <Users size={14} />
              Team
            </button>
          )}

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
                          
                          {/* Date */}
                          <td className="px-5 py-4 text-slate-500 text-[11px] font-medium">
                            {new Date(member.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </td>
                          
                          {/* Work Name (Inline Editable) */}
                          <td className="px-5 py-4">
                            {editingId === member.id ? (
                              <div className="flex items-center gap-2">
                                <input 
                                  type="text" 
                                  value={tempWorkName} 
                                  onChange={(e) => setTempWorkName(e.target.value)}
                                  className="w-24 px-2 py-1 text-xs font-bold text-slate-800 bg-white border-2 border-indigo-400 rounded outline-none shadow-sm"
                                  autoFocus
                                  onKeyDown={(e) => e.key === "Enter" && saveWorkName(member.id)}
                                />
                                <button onClick={() => saveWorkName(member.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={14}/></button>
                                <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X size={14}/></button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 font-bold text-slate-800">
                                {member.work_name || '-'}
                                <button onClick={() => startEditing(member)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-all">
                                  <Edit2 size={12} />
                                </button>
                              </div>
                            )}
                          </td>
                          
                          {/* Email */}
                          <td className="px-5 py-4 text-slate-600 text-xs">{member.email}</td>
                          
                          {/* Password (Locked) */}
                          <td className="px-5 py-4">
                            <span className="flex items-center gap-1.5 text-slate-400 text-xs font-mono bg-slate-100 px-2 py-0.5 rounded-md w-fit cursor-help" title="Passwords are encrypted and hidden for security">
                              <Lock size={10} /> ••••••••
                            </span>
                          </td>

                          {/* Role Dropdown */}
                          <td className="px-5 py-4 text-center">
                            <select
                              value={member.role}
                              onChange={(e) => handleRoleChange(member.id, e.target.value)}
                              disabled={member.id === user?.id}
                              className={`text-[10px] font-bold px-2 py-1.5 rounded-lg border outline-none cursor-pointer appearance-none text-center transition-colors
                                ${member.role === 'Admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 
                                  member.role === 'Leader' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 
                                  'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                            >
                              <option value="Admin">Admin</option>
                              <option value="Leader">Leader</option>
                              <option value="User">Normal</option>
                            </select>
                          </td>

                          {/* Delete Action */}
                          <td className="px-5 py-4 text-right">
                            <button 
                              onClick={() => handleDeleteUser(member.id)}
                              disabled={member.id === user?.id}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                              title={member.id === user?.id ? "Cannot delete yourself" : "Delete User"}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 2: CREATE NEW (Kept exactly as it was) */}
              {activeTab === "create" && (
                <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <form onSubmit={handleCreateUser} className="space-y-5">
                    
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Email Address <span className="text-red-500">*</span></label>
                      <input type="email" required placeholder="newuser@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white transition-all" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Work Name <span className="text-red-500">*</span></label>
                      <input type="text" required placeholder="e.g. Chamiru" value={newWorkName} onChange={(e) => setNewWorkName(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white transition-all" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Role</label>
                      <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white cursor-pointer transition-all">
                        <option value="User">Normal User</option>
                        <option value="Leader">Leader</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </div>

                    {/* Password Generator Box */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-700 uppercase">Password <span className="text-red-500">*</span></label>
                        <span className="text-[10px] text-slate-400 font-medium">Auto-generate or type manually</span>
                      </div>
                      
                      <div className="relative">
                        <Lock size={16} className="absolute left-3 top-2.5 text-slate-400" />
                        <input type="text" required minLength={6} placeholder="Paste or type password here..." value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-all font-mono" />
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button type="button" onClick={generatePassword} className="flex-1 flex items-center justify-center gap-2 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-100 hover:text-indigo-600 transition-all">
                          <RefreshCw size={14} /> Generate
                        </button>
                        <button type="button" onClick={copyPassword} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-black transition-all">
                          {copiedPwd ? <><Check size={14} className="text-emerald-400"/> Copied!</> : <><Copy size={14} /> Copy</>}
                        </button>
                      </div>
                    </div>

                    <button type="submit" disabled={isCreating} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-all shadow-sm disabled:opacity-50 mt-2">
                      {isCreating ? "Creating Account..." : "Create Account"}
                    </button>

                    {createMsg.text && (
                      <div className={`mt-3 text-xs font-bold px-4 py-3 rounded-lg flex items-center justify-center text-center ${createMsg.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
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