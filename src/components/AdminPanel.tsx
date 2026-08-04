'use client'

import { useState, useEffect } from 'react'
import { Search, Users, Activity, Map as MapIcon, Shield, Crown, RefreshCw, CheckCircle2, Clock, Mail } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '@/supabase/client'
import { UserProfile, MindMap } from '@/types'
import { ADMIN_EMAILS, OnlinePresenceUser } from '@/hooks/useGlobalPresence'
import { getAllAdminUsers } from '@/app/actions'

interface AdminPanelProps {
  currentUser: any
  allMaps: MindMap[]
  onlineUsers: OnlinePresenceUser[]
}

export default function AdminPanel({ currentUser, allMaps, onlineUsers }: AdminPanelProps) {
  const [usersList, setUsersList] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState<'all' | 'online' | 'admin'>('all')

  const fetchUsers = async () => {
    setLoading(true)
    try {
      // 1. Fetch maps grouped by user_id to get map counts per user
      const { data: mapsData } = await supabase
        .from('mind_maps')
        .select('user_id, updated_at, created_at')

      const mapCountMap = new Map<string, number>()
      const lastActivityMap = new Map<string, string>()

      if (mapsData) {
        mapsData.forEach((m: any) => {
          mapCountMap.set(m.user_id, (mapCountMap.get(m.user_id) || 0) + 1)
          const existingLast = lastActivityMap.get(m.user_id)
          const current = m.updated_at || m.created_at
          if (!existingLast || new Date(current) > new Date(existingLast)) {
            lastActivityMap.set(m.user_id, current)
          }
        })
      }

      // Build map of online user IDs/Emails
      const onlineEmailsSet = new Set(onlineUsers.map(u => u.email.toLowerCase()))
      const onlineIdsSet = new Set(onlineUsers.map(u => u.user_id))

      let finalUsers: UserProfile[] = []

      // 2. Fetch ALL users via admin API (Server Action)
      try {
        const authUsers = await getAllAdminUsers()
        if (authUsers && authUsers.length > 0) {
          finalUsers = authUsers.map((u: any) => {
            const email = u.email || ''
            const isOnline = onlineIdsSet.has(u.id) || onlineEmailsSet.has(email.toLowerCase())
            const isPrimaryAdmin = ADMIN_EMAILS.includes(email.toLowerCase())
            const lastAccess = u.last_sign_in_at || lastActivityMap.get(u.id) || u.created_at || new Date().toISOString()
            
            return {
              id: u.id,
              email: email,
              full_name: u.full_name,
              avatar_url: u.avatar_url,
              role: isPrimaryAdmin ? 'admin' : 'user',
              last_access_at: lastAccess,
              is_online: isOnline,
              maps_count: mapCountMap.get(u.id) || 0,
              created_at: u.created_at
            }
          })
        }
      } catch (err) {
        console.error('Failed to fetch auth users, falling back to maps data', err)
      }

      // Ensure logged in user is in the list
      const loggedEmail = currentUser.email.toLowerCase()
      const hasLoggedUser = finalUsers.some(u => u.email.toLowerCase() === loggedEmail || u.id === currentUser.id)
      if (!hasLoggedUser) {
        finalUsers.unshift({
          id: currentUser.id,
          email: currentUser.email,
          full_name: currentUser.user_metadata?.full_name || currentUser.email.split('@')[0],
          avatar_url: currentUser.user_metadata?.avatar_url || null,
          role: ADMIN_EMAILS.includes(loggedEmail) ? 'admin' : 'user',
          last_access_at: new Date().toISOString(),
          is_online: true,
          maps_count: mapCountMap.get(currentUser.id) || 0
        })
      }

      // Add all users from onlineUsers (Realtime Presence) if not already in finalUsers
      onlineUsers.forEach(onlineUser => {
        if (!onlineUser.email) return
        const emailLower = onlineUser.email.toLowerCase()
        const existingIndex = finalUsers.findIndex(u => u.email.toLowerCase() === emailLower || u.id === onlineUser.user_id)
        
        if (existingIndex !== -1) {
          // Update status to online and refresh name/avatar/last_access if missing
          finalUsers[existingIndex].is_online = true
          if (!finalUsers[existingIndex].avatar_url && onlineUser.avatar_url) {
            finalUsers[existingIndex].avatar_url = onlineUser.avatar_url
          }
          if (onlineUser.name && finalUsers[existingIndex].full_name === emailLower.split('@')[0]) {
            finalUsers[existingIndex].full_name = onlineUser.name
          }
        } else {
          // Add new online user from presence
          const isAdmin = ADMIN_EMAILS.includes(emailLower)
          finalUsers.push({
            id: onlineUser.user_id,
            email: onlineUser.email,
            full_name: onlineUser.name || emailLower.split('@')[0],
            avatar_url: onlineUser.avatar_url || null,
            role: isAdmin ? 'admin' : 'user',
            last_access_at: new Date(onlineUser.joinedAt || Date.now()).toISOString(),
            is_online: true,
            maps_count: mapCountMap.get(onlineUser.user_id) || 0
          })
        }
      })

      // Add any map owners not yet listed
      if (mapsData) {
        mapsData.forEach((m: any) => {
          if (!m.user_id) return
          const exists = finalUsers.some(u => u.id === m.user_id)
          if (!exists) {
            finalUsers.push({
              id: m.user_id,
              email: `usuario_${m.user_id.substring(0, 6)}@plataforma`,
              full_name: `Usuário (${m.user_id.substring(0, 6)})`,
              avatar_url: null,
              role: 'user',
              last_access_at: lastActivityMap.get(m.user_id) || m.created_at || new Date().toISOString(),
              is_online: onlineIdsSet.has(m.user_id),
              maps_count: mapCountMap.get(m.user_id) || 1
            })
          }
        })
      }

      // Sort: Admins & Online first, then by last access
      finalUsers.sort((a, b) => {
        if (a.is_online !== b.is_online) return a.is_online ? -1 : 1
        if (a.role === 'admin' && b.role !== 'admin') return -1
        if (b.role === 'admin' && a.role !== 'admin') return 1
        return new Date(b.last_access_at || 0).getTime() - new Date(a.last_access_at || 0).getTime()
      })

      setUsersList(finalUsers)
    } catch (err) {
      console.error('Error fetching admin users:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [onlineUsers])

  const filteredUsers = usersList.filter(u => {
    const matchesSearch = u.full_name?.toLowerCase().includes(search.toLowerCase()) || 
                          u.email.toLowerCase().includes(search.toLowerCase())
    
    if (!matchesSearch) return false

    if (filterRole === 'online') return u.is_online
    if (filterRole === 'admin') return u.role === 'admin' || ADMIN_EMAILS.includes(u.email.toLowerCase())
    return true
  })

  const totalOnline = usersList.filter(u => u.is_online).length
  const totalMapsCount = allMaps.length

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Nunca'
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return 'Nunca'

    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / (1000 * 60))

    if (diffMin < 2) return 'Agora mesmo'
    if (diffMin < 60) return `Há ${diffMin} minutos`
    
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) {
      return `Hoje às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    }

    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden border border-indigo-900/50">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-3 border border-blue-400/30">
              <Shield size={14} /> Painel Administrativo
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Gestão de Usuários <Crown size={28} className="text-amber-400 animate-bounce" />
            </h1>
            <p className="text-blue-200/80 text-sm md:text-base mt-2 max-w-xl">
              Monitore o acesso, atividade recente e usuários ativos em tempo real na plataforma.
            </p>
          </div>

          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all border border-white/10 backdrop-blur-md active:scale-95 shrink-0 self-start md:self-auto"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Atualizar Dados
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow flex items-center gap-5"
        >
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shadow-inner shrink-0">
            <Users size={26} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Total de Usuários</p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1">{usersList.length}</h3>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-white rounded-3xl p-6 border border-emerald-200/80 shadow-sm hover:shadow-md transition-shadow flex items-center gap-5 relative overflow-hidden"
        >
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shadow-inner shrink-0 relative">
            <Activity size={26} />
            <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-emerald-600/80 tracking-wider flex items-center gap-1.5">
              Online Agora <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            </p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1">{totalOnline}</h3>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow flex items-center gap-5"
        >
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shadow-inner shrink-0">
            <MapIcon size={26} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Total de Mapas</p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1">{totalMapsCount}</h3>
          </div>
        </motion.div>
      </div>

      {/* Filter and Search Section */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setFilterRole('all')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              filterRole === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos ({usersList.length})
          </button>
          <button
            onClick={() => setFilterRole('online')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              filterRole === 'online'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Online ({totalOnline})
          </button>
          <button
            onClick={() => setFilterRole('admin')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              filterRole === 'admin'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            <Crown size={14} /> Admins ({usersList.filter(u => u.role === 'admin' || ADMIN_EMAILS.includes(u.email.toLowerCase())).length})
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="py-4 px-6">Usuário</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Permissão</th>
                <th className="py-4 px-6">Mapas Criados</th>
                <th className="py-4 px-6">Último Acesso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
              {filteredUsers.map((user) => {
                const isAdmin = user.role === 'admin' || ADMIN_EMAILS.includes(user.email.toLowerCase())
                const avatarInitial = (user.full_name || user.email).charAt(0).toUpperCase()

                return (
                  <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* User Info */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm overflow-hidden shadow-sm">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              avatarInitial
                            )}
                          </div>
                          {user.is_online && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white"></span>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 flex items-center gap-1.5">
                            {user.full_name || 'Usuário'}
                            {user.email.toLowerCase() === currentUser.email.toLowerCase() && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-semibold">Você</span>
                            )}
                          </span>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Mail size={12} /> {user.email}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6">
                      {user.is_online ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                          <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                          Offline
                        </span>
                      )}
                    </td>

                    {/* Role / Permission */}
                    <td className="py-4 px-6">
                      {isAdmin ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-gradient-to-r from-amber-500/10 to-purple-500/10 text-purple-700 border border-purple-200">
                          <Crown size={13} className="text-amber-500" /> Administrador
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                          Usuário
                        </span>
                      )}
                    </td>

                    {/* Maps Count */}
                    <td className="py-4 px-6 font-bold text-slate-800">
                      <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-xs">
                        {user.maps_count || 0} {user.maps_count === 1 ? 'mapa' : 'mapas'}
                      </span>
                    </td>

                    {/* Last Access */}
                    <td className="py-4 px-6 text-slate-500 text-xs flex items-center gap-1.5 pt-6">
                      <Clock size={14} className="text-slate-400" />
                      {formatDate(user.last_access_at)}
                    </td>
                  </tr>
                )
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    Nenhum usuário encontrado para a busca.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
