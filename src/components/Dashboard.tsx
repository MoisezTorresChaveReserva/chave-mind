'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Search, MoreVertical, Star, Clock, Upload, LogOut, Trash2, Image as ImageIcon, Sparkles, Layout, Copy } from 'lucide-react'
import { MindMap } from '@/types'
import { supabase } from '@/supabase/client'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

const generateId = () => {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)
}

const GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-purple-500 to-pink-600',
  'from-emerald-400 to-teal-500',
  'from-orange-400 to-rose-500',
  'from-indigo-400 to-cyan-400'
]

export default function Dashboard({ initialMaps, user }: { initialMaps: MindMap[], user: any }) {
  const [maps, setMaps] = useState<MindMap[]>(initialMaps)
  const [search, setSearch] = useState('')
  const [activeMapMenu, setActiveMapMenu] = useState<string | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<string | null>(user?.user_metadata?.avatar_url || null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = async () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 100
        const MAX_HEIGHT = 100
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width
            width = MAX_WIDTH
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height
            height = MAX_HEIGHT
          }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        
        setAvatar(dataUrl)
        
        await supabase.auth.updateUser({
          data: { avatar_url: dataUrl }
        })
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

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

  const handleDuplicateMap = async (id: string) => {
    try {
      const originalMap = maps.find(m => m.id === id)
      if (!originalMap) return
      
      const { data: newMap, error: mapError } = await supabase
        .from('mind_maps')
        .insert([{ user_id: user.id, title: originalMap.title + ' (Cópia)' }])
        .select()
        .single()
      
      if (mapError || !newMap) throw mapError

      const { data: nodes } = await supabase.from('nodes').select('*').eq('map_id', id)
      const { data: edges } = await supabase.from('edges').select('*').eq('map_id', id)
      
      const idMap = new Map<string, string>()
      
      if (nodes && nodes.length > 0) {
        const newNodesList = nodes.map(n => {
          const newId = generateId()
          idMap.set(n.id, newId)
          return { ...n, id: newId, map_id: newMap.id }
        })
        
        const finalNodes = newNodesList.map(n => ({
          ...n,
          parent_id: n.parent_id ? idMap.get(n.parent_id) || null : null
        }))
        
        await supabase.from('nodes').insert(finalNodes)
      }
      
      if (edges && edges.length > 0) {
        const newEdges = edges.map(e => ({
          id: generateId(),
          map_id: newMap.id,
          source: idMap.get(e.source),
          target: idMap.get(e.target),
          color: e.color
        })).filter(e => e.source && e.target)
        
        if (newEdges.length > 0) await supabase.from('edges').insert(newEdges)
      }

      // Add to local state
      setMaps([newMap, ...maps])
    } catch (err: any) {
      alert('Erro ao duplicar mapa: ' + err.message)
    }
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

        const { data: newMap, error: mapError } = await supabase
          .from('mind_maps')
          .insert([{ user_id: user.id, title: 'Mapa Importado' }])
          .select()
          .single()
        
        if (mapError || !newMap) throw mapError

        const idMap = new Map<string, string>()
        const newNodesList = parsed.nodes.map((n: any) => {
          const newId = generateId()
          idMap.set(n.id, newId)
          return { ...n, id: newId }
        })

        const dbNodes = newNodesList.map((n: any, index: number) => {
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
            order: index,
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

  const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário'

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      {/* Glassmorphism Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-8 py-4 bg-white/70 backdrop-blur-lg border-b border-gray-200/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-blue-500/30 shadow-lg">M</div>
          <span className="font-bold tracking-tight text-gray-900 text-xl hidden sm:block">MindMap Pro</span>
        </div>

        <div className="flex items-center gap-3 md:gap-5">
          <div className="relative group hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Pesquisar mapa..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 w-64 md:w-80 bg-gray-50/50 hover:bg-white transition-all shadow-sm"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={handleImport}
              className="flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95"
            >
              <Upload size={18} className="text-gray-500" /> <span className="hidden md:inline">Importar</span>
            </button>
            <button 
              onClick={createNewMap}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition-all active:scale-95 hover:scale-[1.02]"
            >
              <Plus size={18} /> <span className="hidden md:inline">Novo Mapa</span>
            </button>
          </div>

          <div className="w-px h-8 bg-gray-200 mx-1 hidden sm:block"></div>

          {/* User Menu */}
          <div className="relative">
            <button 
              onClick={(e) => { e.stopPropagation(); setShowUserMenu(!showUserMenu); setActiveMapMenu(null) }}
              className="w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-sm font-medium text-gray-600 hover:ring-4 hover:ring-gray-100 transition-all focus:outline-none overflow-hidden"
            >
              {avatar ? <img src={avatar} alt="Avatar" className="w-full h-full object-cover" /> : userName.charAt(0).toUpperCase()}
            </button>
            
            <AnimatePresence>
              {showUserMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 mt-3 w-56 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 z-50 overflow-hidden"
                >
                  <div className="px-5 py-3 flex flex-col items-center gap-3 bg-gray-50/50 mb-2">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-200 flex items-center justify-center text-2xl font-bold text-gray-600 overflow-hidden shadow-inner">
                      {avatar ? <img src={avatar} alt="Avatar" className="w-full h-full object-cover" /> : userName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col items-center">
                      <p className="text-sm font-semibold text-gray-900 truncate w-full text-center">{userName}</p>
                      <p className="text-xs text-gray-500 truncate w-full text-center">{user.email}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full text-left px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                  >
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><ImageIcon size={16} /></div>
                    Alterar Foto
                  </button>
                  <div className="h-px w-full bg-gray-100 my-1"></div>
                  <button 
                    onClick={handleLogout}
                    className="w-full text-left px-5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                  >
                    <div className="p-1.5 bg-red-50 text-red-600 rounded-lg"><LogOut size={16} /></div>
                    Sair
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleAvatarUpload} />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-8 py-10 md:py-16 max-w-7xl mx-auto w-full flex flex-col md:flex-row items-center justify-between gap-8">
        <div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight mb-3 flex items-center gap-3">
              Olá, {userName}! <span className="text-3xl">👋</span>
            </h1>
            <p className="text-lg text-gray-500 max-w-xl">
              Pronto para transformar suas ideias em mapas mentais incríveis? Você possui <span className="font-semibold text-blue-600">{maps.length} {maps.length === 1 ? 'mapa' : 'mapas'}</span> no seu espaço de trabalho.
            </p>
          </motion.div>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} 
          animate={{ opacity: 1, scale: 1 }} 
          transition={{ duration: 0.5, delay: 0.1 }}
          className="hidden lg:flex p-6 rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100/50 shadow-sm items-center gap-5"
        >
          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
            <Sparkles size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-lg">Dica Rápida</h3>
            <p className="text-sm text-gray-600 max-w-xs">Use o modo foco para criar apresentações dinâmicas a partir dos seus mapas.</p>
          </div>
        </motion.div>
      </section>

      {/* Main Content */}
      <main className="flex-1 px-8 pb-20 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Mapas Recentes</h2>
        </div>
        
        <motion.div 
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          <AnimatePresence>
            {filteredMaps.map((map, index) => {
              let preview = null
              if (map.thumbnail) {
                try {
                  const parsed = JSON.parse(map.thumbnail)
                  if (!Array.isArray(parsed) && parsed.preview) preview = parsed.preview
                } catch(e) {}
              }
              
              const gradientClass = GRADIENTS[(map.id.charCodeAt(0) + map.id.charCodeAt(map.id.length - 1)) % GRADIENTS.length]
              
              return (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4, delay: index * 0.05, ease: "easeOut" }}
                key={map.id} 
                className="group bg-white border border-gray-200/80 rounded-3xl hover:shadow-xl hover:shadow-gray-200/50 hover:border-blue-200 transition-all duration-300 cursor-pointer flex flex-col relative overflow-hidden h-[280px]"
                onClick={() => router.push(`/map/${map.id}`)}
              >
                {preview ? (
                  <div className="h-44 w-full bg-gray-50 relative overflow-hidden">
                    <img src={preview} alt="Map preview" className="w-full h-full object-cover scale-[1.02] group-hover:scale-110 transition-transform duration-700 ease-out" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none"></div>
                  </div>
                ) : (
                  <div className={`h-44 w-full bg-gradient-to-br ${gradientClass} relative overflow-hidden flex items-center justify-center`}>
                    <div className="absolute inset-0 bg-black/10"></div>
                    <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-lg border border-white/20 z-10 group-hover:scale-110 transition-transform duration-500">
                      <span className="font-bold text-3xl">{map.title.charAt(0).toUpperCase()}</span>
                    </div>
                  </div>
                )}
                
                {/* Floating Actions */}
                <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
                  <button 
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all backdrop-blur-md border shadow-sm ${map.favorite ? 'bg-yellow-50 border-yellow-200 text-yellow-500' : 'bg-white/80 border-gray-200/50 text-gray-500 hover:bg-white hover:text-yellow-500 opacity-0 group-hover:opacity-100'}`} 
                    onClick={(e) => { e.stopPropagation(); /* toggle favorite */ }}
                  >
                    <Star size={14} fill={map.favorite ? 'currentColor' : 'none'} />
                  </button>
                  <div className="relative">
                    <button 
                      className={`w-8 h-8 rounded-full flex items-center justify-center bg-white/80 backdrop-blur-md border border-gray-200/50 text-gray-600 hover:bg-white hover:text-gray-900 transition-all shadow-sm ${activeMapMenu === map.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} 
                      onClick={(e) => { e.stopPropagation(); setActiveMapMenu(activeMapMenu === map.id ? null : map.id); setShowUserMenu(false) }}
                    >
                      <MoreVertical size={16} />
                    </button>
                    <AnimatePresence>
                      {activeMapMenu === map.id && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9, y: 5 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: 5 }}
                          className="absolute right-0 mt-2 w-36 bg-white border border-gray-100 rounded-xl shadow-xl py-1 z-50 origin-top-right"
                        >
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDuplicateMap(map.id) }}
                            className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors border-b border-gray-100"
                          >
                            <Copy size={16} /> Duplicar
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteMap(map.id) }}
                            disabled={isDeleting === map.id}
                            className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50 transition-colors"
                          >
                            <Trash2 size={16} /> {isDeleting === map.id ? 'Excluindo...' : 'Excluir'}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                
                <div className="p-5 flex flex-col justify-end flex-1 bg-white relative z-10 border-t border-gray-100/50">
                  <h3 className="font-bold text-gray-900 truncate text-lg">{map.title}</h3>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mt-2">
                    <Clock size={14} /> Editado em {new Date(map.updated_at).toLocaleDateString()}
                  </div>
                </div>
              </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>

        {filteredMaps.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-6">
              <Search size={40} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhum mapa encontrado</h3>
            <p className="text-gray-500 max-w-md mb-8">
              Não encontramos nenhum mapa correspondente à sua pesquisa ou você ainda não criou nenhum.
            </p>
            <button 
              onClick={createNewMap}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
            >
              <Plus size={18} /> Criar seu primeiro Mapa
            </button>
          </motion.div>
        )}
      </main>
    </div>
  )
}
