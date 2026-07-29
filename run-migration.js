import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '.env.local')

const envContent = fs.readFileSync(envPath, 'utf8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) envVars[match[1].trim()] = match[2].trim().replace(/^"|'/, '').replace(/"|'$/, '')
})

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL']
const supabaseKey = envVars['SUPABASE_SERVICE_ROLE_KEY']

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const sql = fs.readFileSync(path.resolve(__dirname, 'supabase/migrations/20260728143000_sharing.sql'), 'utf8')

async function runMigration() {
  console.log('Running sharing migration...')
  
  // Try using RPC first
  const { data, error } = await supabase.rpc('exec_sql', { sql })
  
  if (error) {
    console.error('RPC exec_sql failed:', error.message)
    console.log('Will try to execute statements individually if possible... (actually, the migration is just a few lines. Let me just use REST to create it)')
    
    // Instead of raw sql which REST doesn't support, we'll try to insert a dummy to see if the table exists
    const { error: insertError } = await supabase.from('map_collaborators').select('*').limit(1)
    console.log('insertError:', insertError)
    if (insertError && insertError.code === '42P01') {
      console.error('\n\n!!! CRITICAL !!!\nThe table "map_collaborators" does not exist in your Supabase project!\nYou must run the SQL in supabase/migrations/20260728143000_sharing.sql in your Supabase SQL Editor manually, because REST API cannot create tables.\n\n')
    }
  } else {
    console.log('Migration successful!')
  }
}

runMigration()
