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
  lastActive: number
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
    console.log('[Collab] Connecting to channel:', channelName, 'sessionId:', sessionId.current)
    
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false, ack: true },
        presence: {
          key: sessionId.current
        }
      }
    })

    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        console.log('[Collab] Presence sync triggered. Raw state:', JSON.stringify(state))
        const activeUsers: Collaborator[] = []

        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[]
          if (presences && presences.length > 0) {
            const p = presences[presences.length - 1]
            console.log('[Collab] Found presence for key:', key, 'payload:', p)
            if (p.session_id !== sessionId.current) {
              activeUsers.push({
                session_id: p.session_id,
                user_id: p.user_id,
                name: p.name,
                email: p.email,
                color: p.color || getUserColor(p.session_id),
                lastActive: Date.now()
              })
            } else {
              console.log('[Collab] Ignoring own presence (sessionId matches)')
            }
          }
        })

        console.log('[Collab] Active users (excluding self):', activeUsers.length)
        setCollaborators(activeUsers)
      })
      .on('broadcast', { event: 'nodes_edges_sync' }, ({ payload }) => {
        console.log('[Collab] Received broadcast from:', payload?.sessionId, '(my id:', sessionId.current, ')')
        if (payload && payload.sessionId !== sessionId.current && onRemoteSyncRef.current) {
          console.log('[Collab] Applying remote sync -', payload.nodes?.length, 'nodes,', payload.edges?.length, 'edges')
          onRemoteSyncRef.current({ nodes: payload.nodes, edges: payload.edges })
        }
      })
      .subscribe(async (status) => {
        console.log('[Collab] Channel status:', status)
        if (status === 'SUBSCRIBED') {
          isSubscribedRef.current = true
          console.log('[Collab] ✓ Channel SUBSCRIBED! Tracking presence...')
          await channel.track({
            session_id: sessionId.current,
            user_id: user?.id || sessionId.current,
            name: userName.current,
            email: user?.email || '',
            color: userColor.current,
            activeNodeId: null,
            cursor: null
          })
          console.log('[Collab] ✓ Presence tracked successfully')
        } else {
          isSubscribedRef.current = false
          console.log('[Collab] ✗ Channel NOT subscribed, status:', status)
        }
      })

    return () => {
      console.log('[Collab] Unsubscribing from channel:', channelName)
      channel.unsubscribe()
      channelRef.current = null
      isSubscribedRef.current = false
    }
  }, [mapId, user?.id, user?.email])

  // Broadcast node/edge changes to other clients
  const broadcastSync = useCallback(
    async (nodes: Node[], edges: Edge[]) => {
      if (!channelRef.current || !isSubscribedRef.current || isReadOnly) {
        return
      }
      
      try {
        const result = await channelRef.current.send({
          type: 'broadcast',
          event: 'nodes_edges_sync',
          payload: {
            sessionId: sessionId.current,
            senderId: user?.id || sessionId.current,
            nodes,
            edges
          }
        })
        console.log('[Collab] Broadcast sent:', result, '- nodes:', nodes.length, 'edges:', edges.length)
      } catch (err) {
        console.error('[Collab] Broadcast error:', err)
      }
    },
    [user?.id, isReadOnly]
  )

  // Update presence (just mark user as online)
  const updatePresenceState = useCallback(
    () => {
      if (!channelRef.current || !isSubscribedRef.current) return
      
      const now = Date.now()
      if (now - lastPresenceUpdate.current < 5000) {
        return // Only update presence at most every 5 seconds if called manually
      }
      lastPresenceUpdate.current = now

      channelRef.current.track({
        session_id: sessionId.current,
        user_id: user?.id || sessionId.current,
        name: userName.current,
        email: user?.email || '',
        color: userColor.current
      }).catch((err: any) => console.error('[Collab] Presence track error:', err))
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
