import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useDuty } from '../context/DutyContext';

export default function CreateTicketModal({ isOpen, onClose, onSuccess }) {
  const { selectedDuty } = useDuty();
  const [loading, setLoading] = useState(false);
  const [merchants, setMerchants] = useState([]);
  
  // Form State
  const [formData, setFormData] = useState({
    merchant_name: '',
    member_id: '',
    login_id: '',
    provider: 'PG Soft', // Default
    provider_id: '',
    time_range: '',
  });

  const [validationError, setValidationError] = useState('');

  // Fetch Merchants on mount
  useEffect(() => {
    const fetchMerchants = async () => {
      const { data } = await supabase.from('merchant_ic_mapping').select('*');
      setMerchants(data || []);
    };
    fetchMerchants();
  }, []);

  // THE SMART PARSER LOGIC
  const validateAndDetermineIC = () => {
    const { member_id, merchant_name } = formData;
    
    // 1. Check @XXX logic
    if (member_id.includes('@')) {
      const code = member_id.split('@')[1]; // Extract 129
      
      // Find merchant with this code
      const matchedMerchant = merchants.find(m => m.merchant_code === code);
      
      if (matchedMerchant) {
        // If the extracted code belongs to a merchant NOT under the current duty
        // AND we are not IC0 (Super Admin)
        if (selectedDuty !== 'IC0' && matchedMerchant.ic_account !== selectedDuty) {
            return { valid: false, msg: `Member ID @${code} belongs to ${matchedMerchant.ic_account}, but you are logged in as ${selectedDuty}.` };
        }
        return { valid: true, ic: matchedMerchant.ic_account };
      }
    }

    // 2. Fallback: If no @XXX, check the selected Merchant dropdown
    const selectedMerchantObj = merchants.find(m => m.merchant_name === merchant_name);
    if (selectedMerchantObj) {
        if (selectedDuty !== 'IC0' && selectedMerchantObj.ic_account !== selectedDuty) {
            return { valid: false, msg: `Merchant ${merchant_name} belongs to ${selectedMerchantObj.ic_account}, not your current duty.` };
        }
        return { valid: true, ic: selectedMerchantObj.ic_account };
    }

    // 3. Absolute Fallback per requirements
    return { valid: true, ic: 'IC3' }; 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');
    setLoading(true);

    const check = validateAndDetermineIC();
    
    if (!check.valid) {
      setValidationError(check.msg);
      setLoading(false);
      return;
    }

    // Get current user ID
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('tickets').insert([
      {
        ...formData,
        ic_account: check.ic, // Auto-assigned based on logic
        created_by: user.id
      }
    ]);

    if (error) {
      alert(error.message);
    } else {
      onSuccess();
      onClose();
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Create New Ticket ({selectedDuty})</h2>
        
        {validationError && (
          <div className="bg-red-100 text-red-700 p-2 mb-4 rounded text-sm">
            {validationError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Merchant Dropdown */}
          <div>
            <label className="block text-sm font-medium">Merchant</label>
            <select 
              className="w-full border p-2 rounded"
              value={formData.merchant_name}
              onChange={e => setFormData({...formData, merchant_name: e.target.value})}
              required
            >
              <option value="">Select Merchant</option>
              {merchants.map(m => (
                 <option key={m.id} value={m.merchant_name}>
                    {m.merchant_name} (Code: {m.merchant_code})
                 </option>
              ))}
            </select>
          </div>

          {/* Member ID */}
          <div>
            <label className="block text-sm font-medium">Member ID</label>
            <input 
              type="text" 
              className="w-full border p-2 rounded"
              placeholder="e.g. user@129"
              value={formData.member_id}
              onChange={e => setFormData({...formData, member_id: e.target.value})}
              required
            />
          </div>

          {/* Provider */}
          <div>
            <label className="block text-sm font-medium">Provider</label>
            <select 
               className="w-full border p-2 rounded"
               value={formData.provider}
               onChange={e => setFormData({...formData, provider: e.target.value})}
            >
               <option value="PG Soft">PG Soft</option>
               <option value="PA Casino">PA Casino</option>
               <option value="Pragmatic Play">Pragmatic Play</option>
               <option value="JILI">JILI</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
                <label className="block text-sm font-medium">Provider ID</label>
                <input type="text" className="w-full border p-2 rounded" 
                  value={formData.provider_id}
                  onChange={e => setFormData({...formData, provider_id: e.target.value})}
                  required 
                />
            </div>
            <div>
                <label className="block text-sm font-medium">Time Range</label>
                <input type="text" className="w-full border p-2 rounded" 
                  placeholder="10:00 - 11:00"
                  value={formData.time_range}
                  onChange={e => setFormData({...formData, time_range: e.target.value})}
                  required 
                />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              {loading ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}