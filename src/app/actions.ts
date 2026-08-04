'use server'

import { createClient } from '@supabase/supabase-js'

export async function getAllAdminUsers() {
  console.log('getAllAdminUsers called')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables. URL:', !!supabaseUrl, 'Key:', !!supabaseServiceKey)
    return { users: [], error: 'Missing Supabase environment variables' }
  }

  // Create a Supabase client with the service role key to bypass RLS and access auth admin API
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  console.log('Fetching users from Supabase admin...')
  // Fetch all users from auth.users
  const { data, error } = await supabase.auth.admin.listUsers()

  if (error) {
    console.error('Error fetching admin users:', error)
    return { users: [], error: 'Failed to fetch users: ' + error.message }
  }

  console.log('Successfully fetched', data?.users?.length, 'users')

  return { users: data.users.map(u => ({
    id: u.id,
    email: u.email || '',
    full_name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Usuário',
    avatar_url: u.user_metadata?.avatar_url || null,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at
  })), error: null }
}
