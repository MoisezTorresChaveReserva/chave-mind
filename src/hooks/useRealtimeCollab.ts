'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/supabase/client'
import { Node, Edge } from '@xyflow/react'

export interface Collaborator {
  user_id: string
  name: string
  email: string
  color: string
  activeNodeId?: string | null
  cursor?: { x: number; y: number } | null
  lastActive?: number
}

const COLLAB_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#e11d48'  // rose
]

export function getUserColor(userId: string): string {
  if (!userId) return COLLAB_COLORS[0]
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % COLLAB_COLORS.length
  return COLLAB_COLORS[index]
}

export function useRealtimeCollab({
  mapId,
  user,
  onRemoteSync,
  isReadOnly = false
}: {
  mapId: string
  user: any
  onRemoteSync?: (data: { nodes: Node[]; edges: Edge[] }) => void
  isReadOnly?: boolean
}) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const channelRef = useRef<any>(null)
  const isSubscribedRef = useRef<boolean>(false)
  const onRemoteSyncRef = useRef(onRemoteSync)
  
  useEffect(() => {
    onRemoteSyncRef.current = onRemoteSync
  }, [onRemoteSync])

  const userColor = useRef<string>(getUserColor(user?.id || 'guest'))
  const userName = useRef<string>(
    user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário'
  )

  useEffect(() => {
    if (!mapId || !user?.id) return

    console.log(`[RealtimeCollab] Conectando ao canal map_${mapId} como ${userName.current} (${user.id})`)

    const channelName = `map_${mapId}`
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        presence: {
          key: user.id
        }
      }
    })

    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        console.log('[RealtimeCollab] Presence state update:', state)
        const activeUsers: Collaborator[] = []

        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[]
          if (presences && presences.length > 0) {
            const p = presences[presences.length - 1]
            if (p.user_id !== user.id) {
              activeUsers.push({
                user_id: p.user_id,
                name: p.name,
                email: p.email,
                color: p.color || getUserColor(p.user_id),
                activeNodeId: p.activeNodeId || null,
                cursor: p.cursor || null,
                lastActive: Date.now()
              })
            }
          }
        })

        setCollaborators(activeUsers)
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('[RealtimeCollab] Usuário entrou:', key, newPresences)
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('[RealtimeCollab] Usuário saiu:', key, leftPresences)
      })
      .on('broadcast', { event: 'nodes_edges_sync' }, ({ payload }) => {
        console.log('[RealtimeCollab] Broadcast recebido:', payload)
        if (payload && payload.senderId !== user.id && onRemoteSyncRef.current) {
          onRemoteSyncRef.current({ nodes: payload.nodes, edges: payload.edges })
        }
      })
      .on('broadcast', { event: 'presence_update' }, ({ payload }) => {
        if (payload && payload.user_id !== user.id) {
          setCollaborators((prev) => {
            const existingIndex = prev.findIndex((c) => c.user_id === payload.user_id)
            if (existingIndex >= 0) {
              return prev.map((c) =>
                c.user_id === payload.user_id
                  ? {
                      ...c,
                      activeNodeId: payload.activeNodeId !== undefined ? payload.activeNodeId : c.activeNodeId,
                      cursor: payload.cursor !== undefined ? payload.cursor : c.cursor,
                      lastActive: Date.now()
                    }
                  : c
              )
            }
            return [...prev, {
              user_id: payload.user_id,
              name: payload.name || 'Colaborador',
              email: payload.email || '',
              color: getUserColor(payload.user_id),
              activeNodeId: payload.activeNodeId,
              cursor: payload.cursor
            }]
          })
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nodes', filter: `map_id=eq.${mapId}` }, async () => {
        console.log('[RealtimeCollab] Mudança detectada na tabela nodes no Supabase DB!')
        if (onRemoteSyncRef.current) {
          const { data: dbNodes } = await supabase.from('nodes').select('*').eq('map_id', mapId).order('order', { ascending: true })
          const { data: dbEdges } = await supabase.from('edges').select('*').eq('map_id', mapId)
          if (dbNodes) {
            const formattedNodes: Node[] = dbNodes.map((n: any) => {
              let visualData = {}
              if (n.color) {
                try { visualData = JSON.parse(n.color) } catch (e) {}
              }
              return {
                id: n.id,
                type: 'custom',
                position: { x: n.x, y: n.y },
                data: {
                  label: n.text,
                  parent_id: n.parent_id,
                  collapsed: n.collapsed,
                  mapId: mapId,
                  ...visualData
                }
              }
            })
            const formattedEdges: Edge[] = (dbEdges || []).map((e: any) => ({
              id: e.id,
              source: e.source,
              target: e.target,
              type: 'bezier',
              style: { stroke: e.color || '#ec4899', strokeWidth: 3 }
            }))
            onRemoteSyncRef.current({ nodes: formattedNodes, edges: formattedEdges })
          }
        }
      })
      .subscribe(async (status) => {
        console.log(`[RealtimeCollab] Status da conexão Realtime: ${status}`)
        if (status === 'SUBSCRIBED') {
          isSubscribedRef.current = true
          await channel.track({
            user_id: user.id,
            name: userName.current,
            email: user.email || '',
            color: userColor.current,
            activeNodeId: null,
            cursor: null
          })
        } else {
          isSubscribedRef.current = false
        }
      })

    return () => {
      console.log(`[RealtimeCollab] Desconectando do canal map_${mapId}`)
      channel.unsubscribe()
      channelRef.current = null
      isSubscribedRef.current = false
    }
  }, [mapId, user?.id, user?.email])

  // Broadcast node/edge changes to other clients
  const broadcastSync = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      if (!channelRef.current || isReadOnly) return
      console.log('[RealtimeCollab] Enviando Broadcast de Sync:', nodes.length, 'nós')
      channelRef.current.send({
        type: 'broadcast',
        event: 'nodes_edges_sync',
        payload: {
          senderId: user.id,
          nodes,
          edges
        }
      })
    },
    [user?.id, isReadOnly]
  )

  // Update presence cursor position or active node ID
  const updatePresenceState = useCallback(
    (data: { activeNodeId?: string | null; cursor?: { x: number; y: number } | null }) => {
      if (!channelRef.current) return
      
      if (isSubscribedRef.current) {
        channelRef.current.track({
          user_id: user.id,
          name: userName.current,
          email: user.email || '',
          color: userColor.current,
          activeNodeId: data.activeNodeId !== undefined ? data.activeNodeId : null,
          cursor: data.cursor !== undefined ? data.cursor : null
        })
      }

      channelRef.current.send({
        type: 'broadcast',
        event: 'presence_update',
        payload: {
          user_id: user.id,
          name: userName.current,
          email: user.email || '',
          activeNodeId: data.activeNodeId,
          cursor: data.cursor
        }
      })
    },
    [user?.id, user?.email]
  )

  return {
    collaborators,
    broadcastSync,
    updatePresenceState,
    myColor: userColor.current
  }
}
