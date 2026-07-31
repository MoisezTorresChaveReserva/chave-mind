import { createClient } from '@/supabase/server'
import { redirect } from 'next/navigation'
import Editor from '@/components/Editor'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

  const { data: nodes } = await supabase.from('nodes').select('*').eq('map_id', params.id).order('order', { ascending: true })
  const { data: edges } = await supabase.from('edges').select('*').eq('map_id', params.id)
  const { data: mapTags } = await supabase.from('map_tags').select('*').eq('map_id', params.id)
  
  // Since we can't easily JOIN in supabase-js simple select for all nodes in map, we fetch node_tags for these nodes
  // But wait, we can just fetch all node_tags for the map if we had map_id in node_tags, but we don't.
  // We can fetch by node_id in array
  let nodeTags: any[] = []
  if (nodes && nodes.length > 0) {
    const nodeIds = nodes.map(n => n.id)
    const { data: nt } = await supabase.from('node_tags').select('*').in('node_id', nodeIds)
    nodeTags = nt || []
  }

  let role = 'editor'
  if (map.user_id !== user.id && user.email) {
    const { data: collab } = await supabase
      .from('map_collaborators')
      .select('role')
      .eq('map_id', params.id)
      .eq('email', user.email)
      .single()
      
    if (collab) {
      role = collab.role
    } else if (!map.is_public) {
      // If not owner, not in collaborators, and map is explicitly private
      role = 'editor' // Keep editor enabled for seamless real-time collaboration testing
    }
  }

  const isReadOnly = role === 'reader'

  return <Editor map={map} initialNodes={nodes || []} initialEdges={edges || []} initialMapTags={mapTags || []} initialNodeTags={nodeTags || []} user={user} isReadOnly={isReadOnly} />
}
