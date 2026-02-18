import { useState, useEffect } from 'react';

export function useMerchantData(memberId, selectedDuty) {
  const [merchantData, setMerchantData] = useState([]);
  const [result, setResult] = useState({ name: '', error: '' });

  // 1. Fetch Data on Mount (Using your specific CSV structure)
  useEffect(() => {
    const fetchSheet = async () => {
      try {
        const response = await fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vThVavZpC7lo28kw_pvAFHD1ADyiSSfVyRDQgXrQGqzm20zaeBuorjEVGD-fYUGyYkpJtfv7a7UfQxR/pub?output=csv");
        const rawText = await response.text();
        // Clean invisible characters
        const csvText = rawText.replace(/^\uFEFF/, '').replace(/\r/g, '');
        const rows = csvText.split('\n').slice(2); // Skip headers

        const parsed = rows.flatMap(row => {
          const cols = row.split(',');
          // Mapping based on your contiguous CSV columns (0,1 | 2,3 | 4,5 | 6,7)
          return [
            { id: cols[0]?.trim(), name: cols[1]?.trim(), duty: 'IC1' },
            { id: cols[2]?.trim(), name: cols[3]?.trim(), duty: 'IC2' },
            { id: cols[4]?.trim(), name: cols[5]?.trim(), duty: 'IC3' },
            { id: cols[6]?.trim(), name: cols[7]?.trim(), duty: 'IC5' }
          ];
        }).filter(item => item.id && item.name && item.id !== "ID");

        setMerchantData(parsed);
      } catch (err) {
        console.error("Sheet Error:", err);
      }
    };
    fetchSheet();
  }, []);

  // 2. Lookup Logic
  useEffect(() => {
    // If empty, clear result
    if (!memberId || !memberId.trim()) {
      setResult({ name: '', error: '' });
      return;
    }

    const parts = memberId.split('@');
    
    // Logic A: Specific Lookup (Has @ suffix)
    if (parts.length > 1 && parts[1].trim().length > 0) {
      const suffix = parts[1].trim();
      const idToSearch = suffix.padStart(3, '0'); // '17' -> '017'
      
      const match = merchantData.find(m => m.id === idToSearch);

      if (match) {
        let error = "";
        // Gatekeeper Logic
        if (selectedDuty !== 'IC0' && match.duty !== selectedDuty) {
          error = `Access Denied: ${match.name} is under ${match.duty}.`;
        }
        setResult({ name: match.name, error });
      } else {
        setResult({ name: '', error: '' });
      }
    } 
    // Logic B: Default Rule (No @ suffix) -> Always QQ288
    else {
      const defaultMatch = merchantData.find(m => m.name === "QQ288");
      let error = "";
      
      // Check if QQ288 is allowed for this user
      if (defaultMatch && selectedDuty !== 'IC0' && defaultMatch.duty !== selectedDuty) {
        error = `Access Denied: QQ288 is under ${defaultMatch.duty}.`;
      }
      setResult({ name: "QQ288", error });
    }
  }, [memberId, merchantData, selectedDuty]);

  return result;
}