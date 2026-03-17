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

const GOOGLE_API_TIMEOUT_MS = 10_000
const GOOGLE_API_MAX_RETRIES = 3
const GOOGLE_API_INITIAL_RETRY_MS = 750
const GOOGLE_API_MAX_RETRY_MS = 4_000

type RequestContext = Record<string, unknown>

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const truncateForLog = (value: string, max = 400): string =>
  value.length > max ? `${value.slice(0, max)}...` : value

const formatLogContext = (context: RequestContext): string => {
  try {
    return JSON.stringify(context)
  } catch {
    return '[unserializable-context]'
  }
}

const logEdgeEvent = (
  level: 'log' | 'warn' | 'error',
  message: string,
  context: RequestContext = {},
) => {
  console[level](`[sync-sheets] ${message} ${formatLogContext(context)}`)
}

const createHttpError = (
  message: string,
  status = 500,
  details: RequestContext = {},
) => Object.assign(new Error(message), { status, details })

const isRetryableStatus = (status: number): boolean =>
  [408, 409, 425, 429, 500, 502, 503, 504].includes(status)

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError'

const isRetryableFetchError = (error: unknown): boolean => {
  if (isAbortError(error)) return true
  if (!(error instanceof Error)) return false
  return error.name === 'TypeError'
}

const getRetryDelayMs = (attempt: number): number =>
  Math.min(
    GOOGLE_API_INITIAL_RETRY_MS * 2 ** Math.max(attempt - 1, 0),
    GOOGLE_API_MAX_RETRY_MS,
  )

const extractGoogleErrorMessage = (payload: any): string | null => {
  if (!payload) return null
  if (typeof payload === 'string') return payload
  if (typeof payload?.error === 'string') return payload.error
  if (typeof payload?.error?.message === 'string') return payload.error.message
  if (typeof payload?.message === 'string') return payload.message
  return null
}

const parseJsonResponse = async (
  response: Response,
  operation: string,
  requestId: string,
): Promise<any> => {
  const raw = await response.text()

  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    throw createHttpError(
      `${operation} returned a non-JSON response from Google`,
      502,
      {
        requestId,
        operation,
        status: response.status,
        bodyPreview: truncateForLog(raw),
      },
    )
  }
}

type GoogleJsonRequestOptions = {
  operation: string
  requestId: string
  context?: RequestContext
  timeoutMs?: number
  maxRetries?: number
}

const fetchGoogleJson = async (
  url: string,
  init: RequestInit,
  {
    operation,
    requestId,
    context = {},
    timeoutMs = GOOGLE_API_TIMEOUT_MS,
    maxRetries = GOOGLE_API_MAX_RETRIES,
  }: GoogleJsonRequestOptions,
) => {
  let lastError: unknown = null

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    const startedAt = Date.now()

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      })
      const payload = await parseJsonResponse(response, operation, requestId)
      const googleError = extractGoogleErrorMessage(payload)

      if (!response.ok || googleError) {
        const retryable = isRetryableStatus(response.status)
        const message = `${operation} failed with status ${response.status}${googleError ? `: ${googleError}` : ''}`

        logEdgeEvent(
          retryable && attempt < maxRetries ? 'warn' : 'error',
          retryable && attempt < maxRetries
            ? 'Transient Google API failure, retrying'
            : 'Google API request failed',
          {
            requestId,
            operation,
            attempt,
            maxRetries,
            durationMs: Date.now() - startedAt,
            status: response.status,
            retryable,
            ...context,
            error: googleError,
          },
        )

        if (retryable && attempt < maxRetries) {
          await wait(getRetryDelayMs(attempt))
          continue
        }

        throw createHttpError(message, retryable ? 502 : response.status || 502, {
          requestId,
          operation,
          attempt,
          status: response.status,
          ...context,
        })
      }

      return payload
    } catch (error) {
      lastError = error

      const retryable =
        isRetryableFetchError(error) ||
        (error instanceof Error && 'status' in error && typeof (error as any).status === 'number'
          ? isRetryableStatus((error as any).status)
          : false)

      logEdgeEvent(
        retryable && attempt < maxRetries ? 'warn' : 'error',
        isAbortError(error)
          ? 'Google API request timed out'
          : retryable && attempt < maxRetries
            ? 'Google API request threw retryable error'
            : 'Google API request failed',
        {
          requestId,
          operation,
          attempt,
          maxRetries,
          durationMs: Date.now() - startedAt,
          retryable,
          ...context,
          error: error instanceof Error ? error.message : String(error),
        },
      )

      if (retryable && attempt < maxRetries) {
        await wait(getRetryDelayMs(attempt))
        continue
      }

      if (error instanceof Error && 'status' in error) {
        throw error
      }

      throw createHttpError(
        isAbortError(error)
          ? `${operation} timed out while waiting for Google`
          : `${operation} failed while calling Google`,
        isAbortError(error) ? 504 : 502,
        {
          requestId,
          operation,
          attempt,
          ...context,
        },
      )
    } finally {
      clearTimeout(timeoutId)
    }
  }

  throw createHttpError(`${operation} failed after retries`, 502, {
    requestId,
    operation,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  })
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
async function getGoogleAccessToken(
  clientEmail: string,
  privateKey: string,
  requestId: string,
) {
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

  const data = await fetchGoogleJson(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    },
    {
      operation: 'oauth_token',
      requestId,
      context: { clientEmail },
    },
  )

  if (!data?.access_token) {
    throw createHttpError('OAuth token response did not include an access token', 502, {
      requestId,
      operation: 'oauth_token',
    })
  }

  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const requestId = crypto.randomUUID()

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

    logEdgeEvent('log', 'Incoming sync-sheets request', {
      requestId,
      method: req.method,
      action,
      ticketsCount: Array.isArray(tickets) ? tickets.length : undefined,
      hasFields: !!fields,
      hasRowHint: !!rowHint,
      ticketId: ticketId ? String(ticketId) : undefined,
    })

    const sheetId = Deno.env.get('GOOGLE_SHEET_ID')?.trim();
    const rawCreds = Deno.env.get('GOOGLE_CREDS_JSON')?.trim();

    if (!sheetId || !rawCreds) throw createHttpError('Missing Supabase Secrets.', 500, {
      requestId,
      action,
      hasSheetId: !!sheetId,
      hasGoogleCreds: !!rawCreds,
    });

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
    const accessToken = await getGoogleAccessToken(
      creds.client_email,
      creds.private_key,
      requestId,
    );

    // ==========================================
    // ACTION 1: APPEND PENDING TICKETS
    // ==========================================
    if (action === 'APPEND') {
      const incomingTickets = Array.isArray(tickets) ? tickets : [];
      if (incomingTickets.length === 0) {
        return new Response(
          JSON.stringify({ success: true, appended: 0, skipped: 0, reason: 'No tickets provided', requestId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Read existing Ticket IDs to enforce one row per ticket in Google Sheet.
      const idRange = encodeURIComponent(`${SHEET_NAME}!A:A`);
      const idJson = await fetchGoogleJson(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${idRange}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        {
          operation: 'append_read_existing_ids',
          requestId,
          context: {
            action,
            range: `${SHEET_NAME}!A:A`,
            incomingTickets: incomingTickets.length,
          },
        },
      );

      // ✅ API-EDGE-003: Validate response schema
      if (!validateReadResponse(idJson)) {
        throw createHttpError(`Invalid Google Sheets API response format for read operation`, 502, {
          requestId,
          action,
          operation: 'append_read_existing_ids',
        });
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
            requestId,
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
      const data = await fetchGoogleJson(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: rows })
        },
        {
          operation: 'append_rows',
          requestId,
          context: {
            action,
            rows: rows.length,
            range: `${SHEET_NAME}!A:M`,
          },
        },
      )

      // ✅ API-EDGE-003: Validate append response schema
      if (!validateAppendResponse(data)) {
        logEdgeEvent('error', 'Unexpected APPEND response structure', {
          requestId,
          action,
          operation: 'append_rows',
          responsePreview: truncateForLog(JSON.stringify(data ?? null)),
        })
        throw createHttpError(`Google Sheets API returned unexpected response format`, 502, {
          requestId,
          action,
          operation: 'append_rows',
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          appended: ticketsToAppend.length,
          skipped: incomingTickets.length - ticketsToAppend.length,
          requestId,
          data,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ==========================================
    // ACTION 2: UPDATE STATUS / FIELDS
    // ==========================================
    if (action === 'UPDATE' || action === 'UPDATE_FIELDS') {
      const targetId = normalizeTicketId(ticketId);
      const getRange = encodeURIComponent(`${SHEET_NAME}!A:M`);
      const getJson = await fetchGoogleJson(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${getRange}`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        },
        {
          operation: 'read_sheet_rows',
          requestId,
          context: {
            action,
            range: `${SHEET_NAME}!A:M`,
            ticketId: targetId,
          },
        },
      )

      // ✅ API-EDGE-003: Validate read response schema
      if (!validateReadResponse(getJson)) {
        throw createHttpError(`Invalid Google Sheets API response format for read operation`, 502, {
          requestId,
          action,
          operation: 'read_sheet_rows',
        });
      }

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
          return new Response(JSON.stringify({ success: true, updated: false, reason: 'No mapped fields provided', requestId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const updateResults = [];

        for (const u of updates) {
          const encodedRange = encodeURIComponent(u.range);
          const updateJson = await fetchGoogleJson(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ values: u.values }),
            },
            {
              operation: 'update_sheet_cell',
              requestId,
              context: {
                action,
                ticketId: targetId,
                range: u.range,
              },
            },
          )

          // ✅ API-EDGE-003: Validate update response schema
          if (!validateUpdateResponse(updateJson)) {
            logEdgeEvent('error', 'Unexpected UPDATE response structure', {
              requestId,
              action,
              operation: 'update_sheet_cell',
              range: u.range,
              responsePreview: truncateForLog(JSON.stringify(updateJson ?? null)),
            })
            throw createHttpError(`Google Sheets API returned unexpected response format for update`, 502, {
              requestId,
              action,
              operation: 'update_sheet_cell',
              range: u.range,
            });
          }

          updateResults.push(updateJson);
        }

        return new Response(JSON.stringify({ success: true, updated: true, requestId, data: updateResults }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        success: true,
        updated: false,
        reason: 'Row not found by ticket ID or fallback hint',
        requestId,
        ticketId: String(ticketId),
        rowHint: rowHint || null,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw createHttpError('Invalid Action', 400, { requestId, action });
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 500
    const details = error?.details && typeof error.details === 'object' ? error.details : undefined

    logEdgeEvent('error', 'sync-sheets request failed', {
      requestId,
      status,
      error: error?.message || 'Unknown error',
      ...(details || {}),
    })

    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Unknown error',
        requestId,
        timestamp: new Date().toISOString(),
      }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
});