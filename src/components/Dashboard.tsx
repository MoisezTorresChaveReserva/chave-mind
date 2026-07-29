'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, MoreVertical, Star, Clock, Upload, LogOut, Trash2 } from 'lucide-react'
import { MindMap } from '@/types'
import { supabase } from '@/supabase/client'
import { useRouter } from 'next/navigation'

const generateId = () => {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)
}

export default function Dashboard({ initialMaps, user }: { initialMaps: MindMap[], user: any }) {
  const [maps, setMaps] = useState<MindMap[]>(initialMaps)
  const [search, setSearch] = useState('')
  const [activeMapMenu, setActiveMapMenu] = useState<string | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const handleClick = () => {
      setActiveMapMenu(null)
      setShowUserMenu(false)
    }
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  const handleDeleteMap = async (id: string) => {
    setIsDeleting(id)
    const { error } = await supabase.from('mind_maps').delete().eq('id', id)
    if (!error) {
      setMaps(maps.filter(m => m.id !== id))
    } else {
      alert('Erro ao excluir mapa')
    }
    setIsDeleting(null)
    setActiveMapMenu(null)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const createNewMap = async () => {
    const { data, error } = await supabase
      .from('mind_maps')
      .insert([{ user_id: user.id, title: 'Novo Mapa Mental' }])
      .select()
      .single()
    
    if (data && !error) {
      router.push(`/map/${data.id}`)
    }
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e: any) => {
      const file = e.target.files[0]
      if (!file) return

      try {
        const text = await file.text()
        const parsed = JSON.parse(text)
        
        if (!parsed.nodes || !parsed.edges) {
          throw new Error('Arquivo JSON inválido para mapa mental.')
        }

        // Create new map
        const { data: newMap, error: mapError } = await supabase
          .from('mind_maps')
          .insert([{ user_id: user.id, title: 'Mapa Importado' }])
          .select()
          .single()
        
        if (mapError || !newMap) throw mapError

        // Remap IDs to prevent conflicts
        const idMap = new Map<string, string>()
        const newNodesList = parsed.nodes.map((n: any) => {
          const newId = generateId()
          idMap.set(n.id, newId)
          return { ...n, id: newId }
        })

        const dbNodes = newNodesList.map((n: any) => {
          const originalParent = n.data?.parent_id
          const newParentId = originalParent ? idMap.get(originalParent) : null
          
          return {
            id: n.id,
            map_id: newMap.id,
            text: n.data?.label || '',
            x: n.position?.x || 0,
            y: n.position?.y || 0,
            parent_id: newParentId,
            collapsed: n.data?.collapsed || false,
            color: JSON.stringify({
              bg_color: n.data?.bg_color,
              text_color: n.data?.text_color,
              image_url: n.data?.image_url,
              icon: n.data?.icon,
              link_url: n.data?.link_url
            })
          }
        })

        const dbEdges = parsed.edges.map((e: any) => ({
          id: generateId(),
          map_id: newMap.id,
          source: idMap.get(e.source),
          target: idMap.get(e.target),
          color: e.style?.stroke || '#ec4899'
        })).filter((e: any) => e.source && e.target)

        // Insert into DB
        if (dbNodes.length > 0) await supabase.from('nodes').insert(dbNodes)
        if (dbEdges.length > 0) await supabase.from('edges').insert(dbEdges)

        router.push(`/map/${newMap.id}`)
      } catch (err: any) {
        alert('Erro ao importar o mapa: ' + err.message)
      }
    }
    input.click()
  }

  const filteredMaps = maps.filter(m => m.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex flex-col min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-[#2563EB] text-white flex items-center justify-center font-bold">M</div>
          <span className="font-semibold tracking-tight text-[var(--foreground)]">MindMap Pro</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Pesquisar mapa..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[#2563EB] w-64 bg-gray-50/50"
            />
          </div>
          <button 
            onClick={handleImport}
            className="flex items-center gap-2 bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Upload size={16} /> Importar
          </button>
          <button 
            onClick={createNewMap}
            className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} /> Novo Mapa
          </button>
          <div className="relative">
            <button 
              onClick={(e) => { e.stopPropagation(); setShowUserMenu(!showUserMenu); setActiveMapMenu(null) }}
              className="w-8 h-8 rounded-full bg-gray-200 border border-gray-300 flex items-center justify-center text-sm font-medium text-gray-600 hover:bg-gray-300 transition-colors focus:outline-none"
            >
              {user.email?.charAt(0).toUpperCase()}
            </button>
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                >
                  <LogOut size={16} /> Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8 max-w-6xl mx-auto w-full">
        <h1 className="text-2xl font-semibold mb-6 text-[var(--foreground)]">Mapas Recentes</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredMaps.map(map => (
            <div 
              key={map.id} 
              className="group bg-white border border-[var(--border)] rounded-xl p-4 hover:shadow-md transition-all cursor-pointer flex flex-col gap-3 relative"
              onClick={() => router.push(`/map/${map.id}`)}
            >
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-[#2563EB]">
                  <span className="font-bold">{map.title.charAt(0)}</span>
                </div>
                <button className="text-gray-400 hover:text-yellow-500 transition-colors" onClick={(e) => { e.stopPropagation(); /* toggle favorite */ }}>
                  <Star size={18} fill={map.favorite ? 'currentColor' : 'none'} className={map.favorite ? 'text-yellow-500' : ''} />
                </button>
              </div>
              
              <div className="mt-2">
                <h3 className="font-medium text-[var(--foreground)] truncate">{map.title}</h3>
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                  <Clock size={12} /> Editado {new Date(map.updated_at).toLocaleDateString()}
                </div>
              </div>

              <div className={`absolute top-4 right-2 transition-opacity ${activeMapMenu === map.id ? 'opacity-100 z-10' : 'opacity-0 group-hover:opacity-100'}`}>
                <button 
                  className="p-1 rounded hover:bg-gray-100 text-gray-500" 
                  onClick={(e) => { e.stopPropagation(); setActiveMapMenu(activeMapMenu === map.id ? null : map.id); setShowUserMenu(false) }}
                >
                  <MoreVertical size={16} />
                </button>
                {activeMapMenu === map.id && (
                  <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteMap(map.id) }}
                      disabled={isDeleting === map.id}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50 transition-colors"
                    >
                      <Trash2 size={16} /> {isDeleting === map.id ? 'Excluindo...' : 'Excluir'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {filteredMaps.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
              Nenhum mapa encontrado. Crie um novo mapa para começar!
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
