import { createClient } from '@/supabase/server'
import { redirect } from 'next/navigation'
import Editor from '@/components/Editor'

export default async function MapPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: map } = await supabase
    .from('mind_maps')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!map) {
    redirect('/')
  }

  const { data: nodes } = await supabase.from('nodes').select('*').eq('map_id', params.id)
  const { data: edges } = await supabase.from('edges').select('*').eq('map_id', params.id)

  let role = 'reader'
  if (map.user_id === user.id) {
    role = 'editor'
  } else if (user.email) {
    const { data: collab } = await supabase
      .from('map_collaborators')
      .select('role')
      .eq('map_id', params.id)
      .eq('email', user.email)
      .single()
      
    if (collab) {
      role = collab.role
    }
  }

  const isReadOnly = role === 'reader'

  return <Editor map={map} initialNodes={nodes || []} initialEdges={edges || []} user={user} isReadOnly={isReadOnly} />
}
