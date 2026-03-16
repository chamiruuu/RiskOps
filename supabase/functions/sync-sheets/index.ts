import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { create } from "https://deno.land/x/djwt@v3.0.1/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SHEET_NAME = "'RiskOps Handover'"
const FIELD_TO_COLUMN: Record<string, string> = {
  login_id: 'E',
  member_id: 'F',
  provider_account: 'G',
  tracking_no: 'I',
  notes: 'K',
  status: 'L',
}

const normalizeTicketId = (raw: unknown): string => {
  const str = String(raw ?? '').trim().replace(/^'+/, '');
  if (!str) return '';

  // Keep IDs as strings to avoid precision loss on large integers.
  // Only trim trailing .0 that Sheets often adds to numeric-looking IDs.
  if (/^\d+\.0+$/.test(str)) return str.replace(/\.0+$/, '');

  return str;
}

const normalizeCell = (raw: unknown): string => String(raw ?? '').trim().toLowerCase();

// ✅ API-EDGE-003: Response validation schemas
const validateAppendResponse = (response: any): boolean => {
  return (
    response &&
    typeof response === 'object' &&
    'updates' in response &&
    typeof response.updates === 'object'
  );
};

const validateUpdateResponse = (response: any): boolean => {
  return (
    response &&
    typeof response === 'object' &&
    'updates' in response &&
    typeof response.updates === 'object'
  );
};

const validateReadResponse = (response: any): boolean => {
  return (
    response &&
    typeof response === 'object' &&
    Array.isArray(response.values)
  );
};

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
    const url = new URL(req.url);
    const healthQuery = url.searchParams.get('health');
    if (req.method === 'GET' && healthQuery === '1') {
      const sheetId = Deno.env.get('GOOGLE_SHEET_ID')?.trim();
      const rawCreds = Deno.env.get('GOOGLE_CREDS_JSON')?.trim();
      return new Response(
        JSON.stringify({
          success: true,
          status: sheetId && rawCreds ? 'ok' : 'degraded',
          service: 'sync-sheets',
          checks: {
            hasSheetId: !!sheetId,
            hasGoogleCreds: !!rawCreds,
          },
          timestamp: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = req.method === 'GET' ? {} : await req.json();
    const { action, tickets, handoverBy, ticketId, status, fields, rowHint } = body;

    const sheetId = Deno.env.get('GOOGLE_SHEET_ID')?.trim();
    const rawCreds = Deno.env.get('GOOGLE_CREDS_JSON')?.trim();

    if (!sheetId || !rawCreds) throw new Error('Missing Supabase Secrets.');

    if (action === 'HEALTH') {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'ok',
          service: 'sync-sheets',
          checks: {
            hasSheetId: !!sheetId,
            hasGoogleCreds: !!rawCreds,
          },
          timestamp: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const creds = JSON.parse(rawCreds);
    const accessToken = await getGoogleAccessToken(creds.client_email, creds.private_key);

    // ==========================================
    // ACTION 1: APPEND PENDING TICKETS
    // ==========================================
    if (action === 'APPEND') {
      const incomingTickets = Array.isArray(tickets) ? tickets : [];
      if (incomingTickets.length === 0) {
        return new Response(
          JSON.stringify({ success: true, appended: 0, skipped: 0, reason: 'No tickets provided' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Read existing Ticket IDs to enforce one row per ticket in Google Sheet.
      const idRange = encodeURIComponent(`${SHEET_NAME}!A:A`);
      const idRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${idRange}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const idJson = await idRes.json();
      if (idJson.error) throw new Error(idJson.error.message);

      // ✅ API-EDGE-003: Validate response schema
      if (!validateReadResponse(idJson)) {
        throw new Error(`Invalid Google Sheets API response format for read operation`);
      }

      const existingIdSet = new Set(
        (idJson.values || []).map((row: any) => normalizeTicketId(row?.[0])).filter(Boolean),
      );

      // Also dedupe repeated IDs inside the same append request.
      const seenInBatch = new Set<string>();
      const ticketsToAppend = incomingTickets.filter((t: any) => {
        const id = normalizeTicketId(t?.id);
        if (!id) return false;
        if (existingIdSet.has(id)) return false;
        if (seenInBatch.has(id)) return false;
        seenInBatch.add(id);
        return true;
      });

      if (ticketsToAppend.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            appended: 0,
            skipped: incomingTickets.length,
            reason: 'All tickets already exist in sheet',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const rows = ticketsToAppend.map((t: any) => [
        t.id,
        t.ic_account,
        new Date(t.created_at).toLocaleString("en-US", { timeZone: "Asia/Singapore" }),
        t.merchant_name,
        t.login_id || "-",
        t.member_id,
        t.provider_account || "-",
        t.provider,
        t.tracking_no || "-",
        t.recorder,
        t.notes?.length > 0 ? `${t.notes.length} Messages` : "No Notes",
        t.status,
        handoverBy,
      ]);

      const range = encodeURIComponent(`${SHEET_NAME}!A:M`);
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: rows })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      // ✅ API-EDGE-003: Validate append response schema
      if (!validateAppendResponse(data)) {
        console.warn('Unexpected APPEND response structure:', data);
        throw new Error(`Google Sheets API returned unexpected response format`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          appended: ticketsToAppend.length,
          skipped: incomingTickets.length - ticketsToAppend.length,
          data,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ==========================================
    // ACTION 2: UPDATE STATUS / FIELDS
    // ==========================================
    if (action === 'UPDATE' || action === 'UPDATE_FIELDS') {
      const getRange = encodeURIComponent(`${SHEET_NAME}!A:M`);
      const getRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${getRange}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const getJson = await getRes.json();
      if (getJson.error) throw new Error(getJson.error.message);

      // ✅ API-EDGE-003: Validate read response schema
      if (!validateReadResponse(getJson)) {
        throw new Error(`Invalid Google Sheets API response format for read operation`);
      }

      const targetId = normalizeTicketId(ticketId);
      const rows = getJson.values || [];
      let rowIndex = rows.findIndex((row: any) => normalizeTicketId(row?.[0]) === targetId);

      // Fallback for legacy rows where ID format drifted in Sheets.
      if (rowIndex === -1 && rowHint && typeof rowHint === 'object') {
        const hintIc = normalizeCell((rowHint as any).ic_account);
        const hintMember = normalizeCell((rowHint as any).member_id);
        const hintProvider = normalizeCell((rowHint as any).provider);
        const hintRecorder = normalizeCell((rowHint as any).recorder);

        for (let i = rows.length - 1; i >= 0; i -= 1) {
          const row = rows[i] || [];
          const rowIc = normalizeCell(row[1]);
          const rowMember = normalizeCell(row[5]);
          const rowProvider = normalizeCell(row[7]);
          const rowRecorder = normalizeCell(row[9]);

          if (
            hintIc && hintMember && hintProvider &&
            rowIc === hintIc &&
            rowMember === hintMember &&
            rowProvider === hintProvider &&
            (!hintRecorder || rowRecorder === hintRecorder)
          ) {
            rowIndex = i;
            break;
          }
        }
      }

      if (rowIndex !== -1) {
        const nextFields =
          action === 'UPDATE'
            ? { status }
            : (fields && typeof fields === 'object' ? fields : {});

        const updates = Object.entries(nextFields)
          .filter(([field]) => FIELD_TO_COLUMN[field])
          .map(([field, value]) => ({
            range: `${SHEET_NAME}!${FIELD_TO_COLUMN[field]}${rowIndex + 1}`,
            values: [[value ?? '-']],
          }));

        if (updates.length === 0) {
          return new Response(JSON.stringify({ success: true, updated: false, reason: 'No mapped fields provided' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const updateResults = [];

        for (const u of updates) {
          const encodedRange = encodeURIComponent(u.range);
          const updateRes = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ values: u.values }),
            },
          );

          const updateJson = await updateRes.json();
          if (updateJson.error) {
            throw new Error(
              `Google update failed for ${u.range}: ${updateJson.error.message}`,
            );
          }

          // ✅ API-EDGE-003: Validate update response schema
          if (!validateUpdateResponse(updateJson)) {
            console.warn(`Unexpected UPDATE response for ${u.range}:`, updateJson);
            throw new Error(`Google Sheets API returned unexpected response format for update`);
          }

          updateResults.push(updateJson);
        }

        return new Response(JSON.stringify({ success: true, updated: true, data: updateResults }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        success: true,
        updated: false,
        reason: 'Row not found by ticket ID or fallback hint',
        ticketId: String(ticketId),
        rowHint: rowHint || null,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw new Error('Invalid Action');
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});