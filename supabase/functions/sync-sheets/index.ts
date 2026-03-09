import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { JWT } from "npm:google-auth-library@9.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SHEET_NAME = "'RiskOps Handover'"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { action, tickets, handoverBy, ticketId, status } = body

    // 1. Grab secrets from Supabase UI
    let sheetId = Deno.env.get('GOOGLE_SHEET_ID') || ''
    let clientEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL') || ''
    let privateKey = Deno.env.get('GOOGLE_PRIVATE_KEY') || ''

    // 2. Auto-clean any accidental quotes or spaces
    sheetId = sheetId.replace(/^"|"$/g, '').trim()
    clientEmail = clientEmail.replace(/^"|"$/g, '').trim()
    privateKey = privateKey.replace(/^"|"$/g, '').trim()
    
    // 3. Fix the \n line breaks for Google
    privateKey = privateKey.replace(/\\n/g, '\n')

    if (!sheetId || !clientEmail || !privateKey) {
      throw new Error('Missing Google Credentials. Please add them in the Supabase Dashboard.')
    }

    // 4. Authenticate
    const auth = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })
    
    let accessToken;
    try {
      // If the key is bad, this is where it used to crash. Now we catch it!
      const token = await auth.getToken()
      accessToken = token.access_token
    } catch (authErr) {
      console.error("AUTH FAILED:", authErr)
      throw new Error("Google rejected the login! The Private Key or Client Email in your Supabase Secrets is incorrect.")
    }

    // ==========================================
    // ACTION 1: APPEND PENDING TICKETS ON HANDOVER
    // ==========================================
    if (action === 'APPEND') {
      const rows = tickets.map((t: any) => [
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
        t.notes && t.notes.length > 0 ? `${t.notes.length} Messages` : "No Notes", 
        t.status,                                          
        handoverBy                                         
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
      if (data.error) throw new Error(`Google Sheets API Error: ${data.error.message}`)

      return new Response(JSON.stringify({ success: true, action: 'APPEND', data }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // ==========================================
    // ACTION 2: UPDATE STATUS ON COMPLETION
    // ==========================================
    if (action === 'UPDATE') {
      const getRange = encodeURIComponent(`${SHEET_NAME}!A:A`)
      const getRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${getRange}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      const getJson = await getRes.json()
      
      if (getJson.error) throw new Error(`Google Sheets API Error: ${getJson.error.message}`)
      
      const existingRows = getJson.values || []
      const rowIndex = existingRows.findIndex((row: any) => row[0] === ticketId)

      if (rowIndex !== -1) {
        const sheetRowNumber = rowIndex + 1 
        
        const updateRange = encodeURIComponent(`${SHEET_NAME}!L${sheetRowNumber}`)
        const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${updateRange}?valueInputOption=USER_ENTERED`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ values: [[status]] }) 
        })
        
        const updateJson = await updateRes.json()
        if (updateJson.error) throw new Error(`Google Sheets API Error: ${updateJson.error.message}`)

        return new Response(JSON.stringify({ success: true, updated: true, data: updateJson }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      } else {
        return new Response(JSON.stringify({ success: true, updated: false, message: 'Not found in sheet' }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }
    }

    throw new Error('Invalid Action provided')

  } catch (error: any) {
    console.error("Function Error:", error.message)
    return new Response(JSON.stringify({ error: error.message || "Unknown Error" }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})