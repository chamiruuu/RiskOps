import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { SmtpClient } from "https://deno.land/x/smtp@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email } = await req.json()
    if (!email) throw new Error('Missing email')

    // Grab your Gmail credentials from Supabase Secrets
    const gmailUser = Deno.env.get('GMAIL_USER') ?? '';
    const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD') ?? '';

    // Connect to Gmail
    const client = new SmtpClient();
    await client.connectTLS({
      hostname: "smtp.gmail.com",
      port: 465,
      username: gmailUser,
      password: gmailPassword,
    });

    // Send the Success Email
    await client.send({
      from: gmailUser,
      to: email,
      subject: "Security Alert: RiskOps Password Configured",
      content: "Your RiskOps account password has been successfully configured.\n\nPlease open the RiskOps Desktop Application on your computer to log in.\n\nIf you did not make this change, please contact Carmen immediately.",
    });

    await client.close();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})