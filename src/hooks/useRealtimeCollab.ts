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
  const userColor = useRef<string>(getUserColor(user?.id || 'guest'))
  const userName = useRef<string>(
    user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário'
  )

  useEffect(() => {
    if (!mapId || !user) return

    const channelName = `map_${mapId}`
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: user.id
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
      .on('broadcast', { event: 'nodes_edges_sync' }, ({ payload }) => {
        if (payload && payload.senderId !== user.id && onRemoteSync) {
          onRemoteSync({ nodes: payload.nodes, edges: payload.edges })
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
            return prev
          })
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            name: userName.current,
            email: user.email || '',
            color: userColor.current,
            activeNodeId: null,
            cursor: null
          })
        }
      })

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [mapId, user?.id, user?.email, onRemoteSync])

  // Broadcast node/edge changes to other clients
  const broadcastSync = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      if (!channelRef.current || isReadOnly) return
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
      channelRef.current.track({
        user_id: user.id,
        name: userName.current,
        email: user.email || '',
        color: userColor.current,
        activeNodeId: data.activeNodeId !== undefined ? data.activeNodeId : null,
        cursor: data.cursor !== undefined ? data.cursor : null
      })

      // Also send fast broadcast for smooth cursor rendering
      channelRef.current.send({
        type: 'broadcast',
        event: 'presence_update',
        payload: {
          user_id: user.id,
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
