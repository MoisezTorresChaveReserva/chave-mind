'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/supabase/client'
import { Node, Edge } from '@xyflow/react'

export interface Collaborator {
  session_id: string
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

export function getUserColor(id: string): string {
  if (!id) return COLLAB_COLORS[0]
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % COLLAB_COLORS.length
  return COLLAB_COLORS[index]
}

const generateSessionId = () => Math.random().toString(36).substring(2, 9)

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
  const sessionId = useRef<string>(generateSessionId())
  const onRemoteSyncRef = useRef(onRemoteSync)
  
  useEffect(() => {
    onRemoteSyncRef.current = onRemoteSync
  }, [onRemoteSync])

  const userColor = useRef<string>(getUserColor(user?.id ? user.id + sessionId.current : sessionId.current))
  const userName = useRef<string>(
    user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário'
  )

  useEffect(() => {
    if (!mapId) return

    const channelName = `map_${mapId}`
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        presence: {
          key: sessionId.current
        }
      }
    })

    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const activeUsers: Collaborator[] = []

        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[]
          if (presences && presences.length > 0) {
            const p = presences[presences.length - 1]
            if (p.session_id !== sessionId.current) {
              activeUsers.push({
                session_id: p.session_id,
                user_id: p.user_id,
                name: p.name,
                email: p.email,
                color: p.color || getUserColor(p.session_id),
                activeNodeId: p.activeNodeId || null,
                cursor: p.cursor || null,
                lastActive: Date.now()
              })
            }
          }
        })

        setCollaborators(activeUsers)
      })
      .on('broadcast', { event: 'nodes_edges_sync' }, ({ payload }) => {
        if (payload && payload.sessionId !== sessionId.current && onRemoteSyncRef.current) {
          onRemoteSyncRef.current({ nodes: payload.nodes, edges: payload.edges })
        }
      })
      .on('broadcast', { event: 'presence_update' }, ({ payload }) => {
        if (payload && payload.session_id !== sessionId.current) {
          setCollaborators((prev) => {
            const existingIndex = prev.findIndex((c) => c.session_id === payload.session_id)
            if (existingIndex >= 0) {
              return prev.map((c) =>
                c.session_id === payload.session_id
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
              session_id: payload.session_id,
              user_id: payload.user_id,
              name: payload.name || 'Colaborador',
              email: payload.email || '',
              color: getUserColor(payload.session_id),
              activeNodeId: payload.activeNodeId,
              cursor: payload.cursor
            }]
          })
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nodes', filter: `map_id=eq.${mapId}` }, async () => {
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
        if (status === 'SUBSCRIBED') {
          isSubscribedRef.current = true
          await channel.track({
            session_id: sessionId.current,
            user_id: user?.id || sessionId.current,
            name: userName.current,
            email: user?.email || '',
            color: userColor.current,
            activeNodeId: null,
            cursor: null
          })
        } else {
          isSubscribedRef.current = false
        }
      })

    return () => {
      channel.unsubscribe()
      channelRef.current = null
      isSubscribedRef.current = false
    }
  }, [mapId, user?.id, user?.email])

  // Broadcast node/edge changes to other clients
  const broadcastSync = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      if (!channelRef.current || isReadOnly) return
      channelRef.current.send({
        type: 'broadcast',
        event: 'nodes_edges_sync',
        payload: {
          sessionId: sessionId.current,
          senderId: user?.id || sessionId.current,
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
          session_id: sessionId.current,
          user_id: user?.id || sessionId.current,
          name: userName.current,
          email: user?.email || '',
          color: userColor.current,
          activeNodeId: data.activeNodeId !== undefined ? data.activeNodeId : null,
          cursor: data.cursor !== undefined ? data.cursor : null
        })
      }

      channelRef.current.send({
        type: 'broadcast',
        event: 'presence_update',
        payload: {
          session_id: sessionId.current,
          user_id: user?.id || sessionId.current,
          name: userName.current,
          email: user?.email || '',
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
    myColor: userColor.current,
    sessionId: sessionId.current
  }
}
