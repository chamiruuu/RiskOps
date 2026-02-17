import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { JWT } from 'https://esm.sh/google-auth-library@9'

serve(async (req) => {
  try {
    // 1. Get Secrets from Supabase Dashboard
    const SHEET_ID = Deno.env.get('GOOGLE_SHEET_ID')
    const GOOGLE_SA_EMAIL = Deno.env.get('GOOGLE_SA_EMAIL')
    const GOOGLE_PRIVATE_KEY = Deno.env.get('GOOGLE_PRIVATE_KEY')?.replace(/\\n/g, '\n')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!SHEET_ID || !GOOGLE_SA_EMAIL || !GOOGLE_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: "Missing Google Config" }), { status: 500 })
    }

    // 2. Auth with Google
    const client = new JWT({
      email: GOOGLE_SA_EMAIL,
      key: GOOGLE_PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
    await client.authorize()

    // 3. Fetch Sheet Data (Assuming Col A=Merchant, B=Code, C=IC Account)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Sheet1!A2:C`
    const res = await client.request({ url })
    const rows = res.data.values

    if (!rows) return new Response(JSON.stringify({ message: "No data found in sheet" }), { status: 200 })

    // 4. Transform Data
    const updates = rows.map((row) => ({
      merchant_name: row[0],
      merchant_code: row[1] || null, 
      ic_account: row[2]?.toUpperCase(), // Ensures "IC1" format
    }))

    // 5. Upsert to Supabase
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    
    const { error } = await supabase
      .from('merchant_ic_mapping')
      .upsert(updates, { onConflict: 'merchant_name' })

    if (error) throw error

    return new Response(JSON.stringify({ success: true, count: rows.length }), {
      headers: { "Content-Type": "application/json" },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})