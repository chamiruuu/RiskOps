import { createClient } from '@supabase/supabase-js'

// Replace these with your actual Supabase URL and Anon Key
const supabaseUrl = 'https://czpxlyfgvptxtvqteloz.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cHhseWZndnB0eHR2cXRlbG96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNjUyOTksImV4cCI6MjA4NTg0MTI5OX0.FpL9BqFqH9gIBb0oZcIoXQQXzolEB02XJGNM8tfEeD0'

export const supabase = createClient(supabaseUrl, supabaseKey)