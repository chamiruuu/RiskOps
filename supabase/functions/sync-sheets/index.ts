import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { JWT } from "npm:google-auth-library@9.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to safely format the Sheet Name with spaces for Google's API
const SHEET_NAME = "'RiskOps Handover'"

serve(async (req) => {
  // Handle CORS preflight requests from the browser
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { action, tickets, handoverBy, ticketId, status } = body

    const sheetId = Deno.env.get('GOOGLE_SHEET_ID')
    const clientEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')
    // We replace \\n with actual newlines because Supabase secrets escape them
    const privateKey = Deno.env.get('GOOGLE_PRIVATE_KEY')?.replace(/\\n/g, '\n')

    if (!sheetId || !clientEmail || !privateKey) {
      throw new Error('Missing Google Credentials in Supabase Secrets')
    }

    // Authenticate with Google
    const auth = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })
    const token = await auth.getToken()
    const accessToken = token.access_token

    // ==========================================
    // ACTION 1: APPEND PENDING TICKETS ON HANDOVER
    // ==========================================
    if (action === 'APPEND') {
      const rows = tickets.map((t: any) => [
        t.id,                                              // A: Ticket ID (Hidden)
        t.ic_account,                                      // B: Duty Acc
        new Date(t.created_at).toLocaleString("en-US", { timeZone: "Asia/Singapore" }), // C: Date
        t.merchant_name,                                   // D: Merchant ID
        t.login_id || "-",                                 // E: Login ID
        t.member_id,                                       // F: Player ID
        t.provider_account || "-",                         // G: Provider Account
        t.provider,                                        // H: Provider
        t.tracking_no || "-",                              // I: Tracking No.
        t.recorder,                                        // J: Recorder
        t.notes && t.notes.length > 0 ? `${t.notes.length} Messages` : "No Notes", // K: Audit Notes
        t.status,                                          // L: Status
        handoverBy                                         // M: Handover By
      ])

      const appendRange = encodeURIComponent(`${SHEET_NAME}!A:M`)
      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${appendRange}:append?valueInputOption=USER_ENTERED`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: rows })
      })

      const data = await response.json()
      return new Response(JSON.stringify({ success: true, action: 'APPEND', data }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // ==========================================
    // ACTION 2: UPDATE STATUS ON COMPLETION
    // ==========================================
    if (action === 'UPDATE') {
      // 1. Get all IDs from Column A to find the right row
      const getRange = encodeURIComponent(`${SHEET_NAME}!A:A`)
      const getRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${getRange}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      const getJson = await getRes.json()
      const existingRows = getJson.values || []

      // 2. Find the row index where Column A matches our Ticket ID
      const rowIndex = existingRows.findIndex((row: any) => row[0] === ticketId)

      if (rowIndex !== -1) {
        const sheetRowNumber = rowIndex + 1 // Google Sheets is 1-indexed
        
        // 3. Update Column L (Status) for that specific row
        const updateRange = encodeURIComponent(`${SHEET_NAME}!L${sheetRowNumber}`)
        const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${updateRange}?valueInputOption=USER_ENTERED`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ values: [[status]] }) // Wrap in 2D array
        })
        
        const updateJson = await updateRes.json()
        return new Response(JSON.stringify({ success: true, updated: true, data: updateJson }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      } else {
        // If ticket isn't in the sheet
        return new Response(JSON.stringify({ success: true, updated: false, message: 'Not found in sheet' }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }
    }

    throw new Error('Invalid Action provided')

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})