import { createClient } from '@/supabase/server'
import { redirect } from 'next/navigation'
import Dashboard from '@/components/Dashboard'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: maps } = await supabase
    .from('mind_maps')
    .select('*')
    .order('last_opened_at', { ascending: false })

  return <Dashboard initialMaps={maps || []} user={user} />
}
