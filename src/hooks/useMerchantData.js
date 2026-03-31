import { useState, useEffect, useMemo } from "react";

// ✅ LOGIC-REACT-001: Fixed - setState no longer called synchronously in effect
// Uses useMemo for computed values instead
export function useMerchantData(memberId, selectedDuty) {
  const [merchantData, setMerchantData] = useState([]);

  // Separate effect 1: Fetch merchant data (runs once on mount)
  useEffect(() => {
    const fetchSheet = async () => {
      try {
        const response = await fetch(
          "https://docs.google.com/spreadsheets/d/e/2PACX-1vThVavZpC7lo28kw_pvAFHD1ADyiSSfVyRDQgXrQGqzm20zaeBuorjEVGD-fYUGyYkpJtfv7a7UfQxR/pub?output=csv",
        );
        const rawText = await response.text();
        // Clean invisible characters
        const csvText = rawText.replace(/^\uFEFF/, "").replace(/\r/g, "");
        const rows = csvText.split("\n").slice(2); // Skip headers

        const parsed = rows
          .flatMap((row) => {
            const cols = row.split(",");
            // Mapping based on your contiguous CSV columns (0,1 | 2,3 | 4,5 | 6,7)
            return [
              { id: cols[0]?.trim(), name: cols[1]?.trim(), duty: "IC1" },
              { id: cols[2]?.trim(), name: cols[3]?.trim(), duty: "IC2" },
              { id: cols[4]?.trim(), name: cols[5]?.trim(), duty: "IC3" },
              { id: cols[6]?.trim(), name: cols[7]?.trim(), duty: "IC5" },
            ];
          })
          .filter((item) => item.id && item.name && item.id !== "ID");

        setMerchantData(parsed);
      } catch (err) {
        console.error("Sheet Error:", err);
      }
    };
    fetchSheet();
  }, []);

  // ✅ Separate effect 2: Compute lookup result based on inputs using useMemo
  // This avoids setState being called synchronously within the effect
  const computedResult = useMemo(() => {
    // If empty, clear result
    if (!memberId || !memberId.trim()) {
      return { name: "", duty: "", error: "" };
    }

    // Safely handle the multi-select duty array
    const dutyArray = Array.isArray(selectedDuty) ? selectedDuty : [];
    const isAdmin = dutyArray.includes("IC0");

    const parts = memberId.split("@");

    // Logic A: Specific Lookup (Has @ suffix)
    if (parts.length > 1 && parts[1].trim().length > 0) {
      const suffix = parts[1].trim();
      const idToSearch = suffix.padStart(3, "0"); // '17' -> '017'

      const match = merchantData.find((m) => m.id === idToSearch);

      if (match) {
        // --- NEW: Bypass error if merchant is 262, 232, or 135 AND the agent is on IC3 ---
        const isSpecialCrossDuty = ["262", "232", "135"].includes(idToSearch);
        const hasIC3Access = dutyArray.includes("IC3");
        const canBypass = isSpecialCrossDuty && hasIC3Access;

        // Gatekeeper Logic for Arrays
        const error =
          !isAdmin && !dutyArray.includes(match.duty) && !canBypass
            ? `Access Denied: ${match.name} is under ${match.duty}.`
            : "";

        return { name: match.name, duty: match.duty, error };
      }

      // FIX: Added the missing fallback return and closing bracket here!
      return { name: "", duty: "", error: "" };
    }
    // Logic B: Default Rule (No @ suffix) -> Always QQ288
    else {
      const defaultMatch = merchantData.find((m) => m.name === "QQ288");
      const error =
        defaultMatch && !isAdmin && !dutyArray.includes(defaultMatch.duty)
          ? `Access Denied: QQ288 is under ${defaultMatch.duty}.`
          : "";

      return { name: "QQ288", duty: defaultMatch?.duty || "IC2", error };
    }
  }, [memberId, merchantData, selectedDuty]);

  return computedResult;
}
