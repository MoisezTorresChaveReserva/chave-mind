import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function test() {
  console.log("URL:", supabaseUrl)
  console.log("KEY:", supabaseServiceKey?.substring(0, 10) + "...")
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  const { data, error } = await supabase.auth.admin.listUsers()
  
  if (error) {
    console.error("ERROR:", error)
  } else {
    console.log("Found", data.users.length, "users")
  }
}

test()
