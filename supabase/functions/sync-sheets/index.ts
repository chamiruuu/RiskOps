import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { create } from "https://deno.land/x/djwt@v3.0.1/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SHEET_NAME = "'RiskOps Handover'"

// Helper to generate a Google Access Token without the bulky library
async function getGoogleAccessToken(clientEmail: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  // Convert PEM private key to a format Deno can use
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = privateKey
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s/g, "");
    
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const jwt = await create({ alg: "RS256", typ: "JWT" }, payload, key);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(`OAuth Error: ${data.error_description || data.error}`);
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, tickets, handoverBy, ticketId, status } = body;

    const sheetId = Deno.env.get('GOOGLE_SHEET_ID')?.trim();
    const rawCreds = Deno.env.get('GOOGLE_CREDS_JSON')?.trim();

    if (!sheetId || !rawCreds) throw new Error('Missing Supabase Secrets.');

    const creds = JSON.parse(rawCreds);
    const accessToken = await getGoogleAccessToken(creds.client_email, creds.private_key);

    // ==========================================
    // ACTION 1: APPEND PENDING TICKETS
    // ==========================================
    if (action === 'APPEND') {
      const rows = tickets.map((t: any) => [
        t.id, t.ic_account, 
        new Date(t.created_at).toLocaleString("en-US", { timeZone: "Asia/Singapore" }),
        t.merchant_name, t.login_id || "-", t.member_id, t.provider_account || "-", 
        t.provider, t.tracking_no || "-", t.recorder, 
        t.notes?.length > 0 ? `${t.notes.length} Messages` : "No Notes", 
        t.status, handoverBy
      ]);

      const range = encodeURIComponent(`${SHEET_NAME}!A:M`);
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: rows })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==========================================
    // ACTION 2: UPDATE STATUS
    // ==========================================
    if (action === 'UPDATE') {
      const getRange = encodeURIComponent(`${SHEET_NAME}!A:A`);
      const getRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${getRange}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const getJson = await getRes.json();
      const rowIndex = (getJson.values || []).findIndex((row: any) => row[0] === ticketId);

      if (rowIndex !== -1) {
        const updateRange = encodeURIComponent(`${SHEET_NAME}!L${rowIndex + 1}`);
        const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${updateRange}?valueInputOption=USER_ENTERED`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [[status]] })
        });
        const updateJson = await updateRes.json();
        return new Response(JSON.stringify({ success: true, updated: true, data: updateJson }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, updated: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw new Error('Invalid Action');
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});