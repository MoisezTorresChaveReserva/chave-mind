'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/supabase/client'

export const ADMIN_EMAILS = ['moiseztorres100@gmail.com']

export function isAdminUser(user: any): boolean {
  if (!user) return false
  const email = user.email?.toLowerCase() || ''
  return ADMIN_EMAILS.includes(email) || user.user_metadata?.role === 'admin'
}

export interface OnlinePresenceUser {
  user_id: string
  email: string
  name: string
  avatar_url?: string | null
  joinedAt: number
}

export function useGlobalPresence(user: any) {
  const [onlineUsers, setOnlineUsers] = useState<OnlinePresenceUser[]>([])
  const channelRef = useRef<any>(null)

  useEffect(() => {
    if (!user?.id) return

    const email = user.email?.toLowerCase() || ''
    const isAdmin = ADMIN_EMAILS.includes(email)
    const name = user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0] || 'Usuário'
    const avatar_url = user.user_metadata?.avatar_url || null

    // Sync profile & last access to user_profiles table (optimistic insert/update)
    const syncProfile = async () => {
      try {
        await supabase.from('user_profiles').upsert({
          id: user.id,
          email: email,
          full_name: name,
          avatar_url: avatar_url,
          role: isAdmin ? 'admin' : 'user',
          last_access_at: new Date().toISOString()
        }, { onConflict: 'id' })
      } catch (err) {
        // Table might not exist or schema differs, handle gracefully
        console.warn('[GlobalPresence] Profile sync notice:', err)
      }
    }

    syncProfile()

    // Connect to global presence channel
    const channel = supabase.channel('global_app_presence', {
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
        const activeList: OnlinePresenceUser[] = []

        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[]
          if (presences && presences.length > 0) {
            const p = presences[presences.length - 1]
            activeList.push({
              user_id: p.user_id || key,
              email: p.email || '',
              name: p.name || 'Usuário',
              avatar_url: p.avatar_url || null,
              joinedAt: p.joinedAt || Date.now()
            })
          }
        })

        setOnlineUsers(activeList)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            email: email,
            name: name,
            avatar_url: avatar_url,
            joinedAt: Date.now()
          })
        }
      })

    return () => {
      channel.unsubscribe()
    }
  }, [user?.id, user?.email])

  return {
    onlineUsers,
    onlineCount: onlineUsers.length,
    isAdmin: isAdminUser(user)
  }
}
