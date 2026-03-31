import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function SetPassword() {
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSetPassword = async (e) => {
    e.preventDefault();
    
    // This securely updates the currently logged-in user's password
    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      alert("Error setting password: " + error.message);
    } else {
      alert("Password set successfully!");
      navigate('/dashboard'); // Send them to the app!
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <form onSubmit={handleSetPassword} className="bg-white p-8 rounded-xl shadow-md w-96">
        <h2 className="text-xl font-bold mb-4">Welcome! Set your password</h2>
        <input
          type="password"
          placeholder="New Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg mb-4"
          required
          minLength={6}
        />
        <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold">
          Save Password
        </button>
      </form>
    </div>
  );
}