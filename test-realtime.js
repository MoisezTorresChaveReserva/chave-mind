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
  if (match) envVars[match[1].trim()] = match[2].trim()
})

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL']
const supabaseKey = envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY']

console.log('=== Supabase Realtime Diagnostic Test ===')
console.log('URL:', supabaseUrl)
console.log('Key (first 20 chars):', supabaseKey?.substring(0, 20) + '...')

const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

const channelName = 'test_realtime_' + Date.now()
console.log('\n1. Creating channel:', channelName)

const channel = supabase.channel(channelName, {
  config: {
    broadcast: { self: true },  // self:true so we can test with just one client
    presence: { key: 'test-user-1' }
  }
})

let presenceReceived = false
let broadcastReceived = false

channel
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState()
    const keys = Object.keys(state)
    console.log('✓ PRESENCE SYNC received! Keys:', keys)
    if (keys.length > 0) {
      presenceReceived = true
      console.log('  Presence data:', JSON.stringify(state[keys[0]][0]))
    }
  })
  .on('broadcast', { event: 'test_broadcast' }, ({ payload }) => {
    console.log('✓ BROADCAST received!', JSON.stringify(payload))
    broadcastReceived = true
  })
  .subscribe(async (status) => {
    console.log('\n2. Channel subscription status:', status)
    
    if (status === 'SUBSCRIBED') {
      console.log('✓ Channel SUBSCRIBED successfully!')
      
      // Test presence
      console.log('\n3. Testing Presence (tracking user)...')
      await channel.track({
        user_id: 'test-user-1',
        name: 'Test User',
        color: '#3b82f6',
        online_at: new Date().toISOString()
      })
      console.log('   track() called')

      // Test broadcast
      console.log('\n4. Testing Broadcast (sending message)...')
      const result = await channel.send({
        type: 'broadcast',
        event: 'test_broadcast',
        payload: { message: 'Hello World', timestamp: Date.now() }
      })
      console.log('   send() result:', result)
      
    } else if (status === 'CHANNEL_ERROR') {
      console.error('✗ CHANNEL ERROR - Realtime may not be enabled or key is invalid')
    } else if (status === 'TIMED_OUT') {
      console.error('✗ TIMED OUT - Cannot reach Supabase Realtime server')
    } else if (status === 'CLOSED') {
      console.error('✗ CLOSED - Channel was closed')
    }
  })

// Wait and report
setTimeout(() => {
  console.log('\n=== RESULTS ===')
  console.log('Presence working:', presenceReceived ? '✓ YES' : '✗ NO')
  console.log('Broadcast working:', broadcastReceived ? '✓ YES' : '✗ NO')
  
  if (!presenceReceived && !broadcastReceived) {
    console.log('\n⚠️  BOTH FAILED. Possible causes:')
    console.log('   - Supabase Realtime is not enabled for your project')
    console.log('   - The anon key does not have Realtime permissions')
    console.log('   - Network/firewall blocking WebSocket connections')
    console.log('\n   Fix: Go to Supabase Dashboard > Project Settings > API')
    console.log('   and verify Realtime is enabled.')
  } else if (presenceReceived && !broadcastReceived) {
    console.log('\n⚠️  Presence works but Broadcast failed.')
    console.log('   This is unusual - check broadcast config.')
  } else if (presenceReceived && broadcastReceived) {
    console.log('\n✓ Supabase Realtime is working correctly!')
    console.log('   The issue is in the React integration, not in Supabase.')
  }

  channel.unsubscribe()
  process.exit(0)
}, 5000)
