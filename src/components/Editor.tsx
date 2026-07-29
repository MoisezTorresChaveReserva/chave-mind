'use client'

import { useState, useEffect } from 'react'
import { MindMap, MapNode, MapEdge, MapPresentation, Slide } from '@/types'
import { ChevronLeft, Cloud, Settings, MoreHorizontal, Moon, Sun, Palette, Play, MonitorPlay, X, Plus, GripVertical, Trash2, ChevronRight, Undo2, Redo2, Focus, Layers } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Canvas from '@/mindmap/Canvas'
import Sidebar from '@/components/Sidebar'
import ShareModal from '@/components/ShareModal'
import ExportModal from '@/components/ExportModal'
import { supabase } from '@/supabase/client'
import { toJpeg } from 'html-to-image'
import { useMapStore } from '@/store/mapStore'
import { useHistoryStore } from '@/store/historyStore'

export default function Editor({ map, initialNodes, initialEdges, initialMapTags = [], initialNodeTags = [], user, isReadOnly = false }: { map: MindMap, initialNodes: MapNode[], initialEdges: MapEdge[], initialMapTags?: any[], initialNodeTags?: any[], user: any, isReadOnly?: boolean }) {
  const router = useRouter()
  const [isSidebarOpen, setSidebarOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [isColorful, setIsColorful] = useState(false)
  const [isOutlined, setIsOutlined] = useState(false)
  const [globalLineColor, setGlobalLineColor] = useState<string | null>(null)
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [depthLevel, setDepthLevel] = useState(5)

  // Presentation State
  const [presentations, setPresentations] = useState<MapPresentation[]>([])
  const [activePresentationId, setActivePresentationId] = useState<string | null>(null)
  const [slides, setSlides] = useState<Slide[]>([])
  const [presentationMode, setPresentationMode] = useState<'edit' | 'presentation_setup' | 'playing'>('edit')
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [isCapturingMode, setIsCapturingMode] = useState(false)
  const [updatingSlideId, setUpdatingSlideId] = useState<string | null>(null)
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null)
  const [editingSlideName, setEditingSlideName] = useState('')
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  
  // Zustand Store
  const { mapTags, setMapTags } = useMapStore()
  const { past, future } = useHistoryStore()
  
  // Title State
  const [mapTitle, setMapTitle] = useState(map.title)

  const handleTitleBlur = async () => {
    if (isReadOnly) return
    if (mapTitle !== map.title && mapTitle.trim() !== '') {
      setSaveStatus('saving')
      const { error } = await supabase.from('mind_maps').update({ title: mapTitle }).eq('id', map.id)
      if (error) setSaveStatus('error')
      else setSaveStatus('saved')
    } else if (mapTitle.trim() === '') {
      setMapTitle(map.title) // Revert if empty
    }
  }

  // Parse existing slides on mount
  useEffect(() => {
    async function loadPresentations() {
      const { data, error } = await supabase.from('map_presentations').select('*').eq('map_id', map.id).order('created_at', { ascending: true })
      
      let legacySlides: Slide[] = []
      if (map.thumbnail) {
        try {
          const parsed = JSON.parse(map.thumbnail)
          if (Array.isArray(parsed)) legacySlides = parsed
          else if (parsed.slides) legacySlides = parsed.slides
        } catch (e) {
          console.error("Failed to parse thumbnail json", e)
        }
      }

      if (data && data.length > 0) {
        setPresentations(data)
        setActivePresentationId(data[0].id)
        setSlides(data[0].slides || [])
      } else if (legacySlides.length > 0) {
        // Migrate legacy slides to a presentation
        const { data: newPres } = await supabase.from('map_presentations').insert({ map_id: map.id, name: 'Apresentação 1', slides: legacySlides }).select().single()
        if (newPres) {
          setPresentations([newPres])
          setActivePresentationId(newPres.id)
          setSlides(legacySlides)
        }
      } else {
        // No presentations exist, just initialize empty
        setPresentations([])
      }
    }
    loadPresentations()
  }, [map.id, map.thumbnail])

  // Initialize mapTags on mount
  useEffect(() => {
    setMapTags(initialMapTags)
  }, [initialMapTags, setMapTags])

  // Save slides when they change
  useEffect(() => {
    if (activePresentationId) {
      supabase.from('map_presentations').update({ slides, updated_at: new Date().toISOString() }).eq('id', activePresentationId).then()
      setPresentations(prev => prev.map(p => p.id === activePresentationId ? { ...p, slides } : p))
    }
  }, [slides, activePresentationId])

  const startPlaying = () => {
    if (slides.length === 0) return alert('Adicione pelo menos um slide antes de apresentar!')
    setCurrentSlideIndex(0)
    setPresentationMode('playing')
  }

  // Apply dark mode to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  // Update last opened at
  useEffect(() => {
    supabase.from('mind_maps').update({ last_opened_at: new Date().toISOString() }).eq('id', map.id).then()
  }, [map.id])

  // Player Keyboard Shortcuts
  useEffect(() => {
    if (presentationMode !== 'playing') return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        setCurrentSlideIndex(prev => Math.min(slides.length - 1, prev + 1))
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlideIndex(prev => Math.max(0, prev - 1))
      } else if (e.key === 'Escape') {
        setPresentationMode('presentation_setup')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [presentationMode, slides.length])

  return (
    <div className="flex h-screen w-screen bg-[var(--background)] overflow-hidden text-[var(--foreground)] transition-colors">
      {/* Sidebar (collapsible) */}
      {presentationMode !== 'playing' && !isFocusMode && (
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setSidebarOpen} />
      )}

      <div className="flex-1 flex flex-col relative">
        {/* Top Header */}
        {presentationMode !== 'playing' && !isFocusMode && (
          <header className="h-14 bg-[var(--background)]/80 backdrop-blur border-b border-[var(--border)] flex items-center justify-between px-4 z-10 absolute top-0 left-0 right-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={async () => {
                const flowViewport = document.querySelector('.react-flow__viewport') as HTMLElement
                if (flowViewport) {
                  try {
                    setSaveStatus('saving')
                    const dataUrl = await toJpeg(flowViewport, { 
                      backgroundColor: theme === 'dark' ? '#111827' : '#ffffff',
                      quality: 0.2,
                      pixelRatio: 0.5
                    })
                    let preview = dataUrl
                    supabase.from('mind_maps').update({ thumbnail: JSON.stringify({ slides, preview }) }).eq('id', map.id).then()
                  } catch (e) {
                    console.error('Failed to capture thumbnail', e)
                  }
                }
                window.dispatchEvent(new CustomEvent('force-save'))
                setTimeout(() => router.push('/'), 100)
              }} 
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
              title="Voltar"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex flex-col">
              {isReadOnly ? (
                <h1 className="text-lg font-semibold text-[var(--foreground)] truncate max-w-[200px]">
                  {mapTitle}
                </h1>
              ) : (
                <input 
                  type="text" 
                  value={mapTitle}
                  onChange={(e) => setMapTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  className="text-lg font-semibold bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 -ml-2 text-[var(--foreground)] w-[200px]"
                />
              )}
              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                <Cloud size={10} className={saveStatus === 'saving' ? 'text-blue-500' : saveStatus === 'error' ? 'text-red-500' : 'text-green-500'} /> 
                {saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'error' ? 'Erro ao salvar' : 'Salvo na nuvem'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 relative">
            {!isReadOnly && (
              <>
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('undo-action'))}
                  disabled={past.length === 0}
                  className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                  title="Desfazer (Ctrl+Z)"
                >
                  <Undo2 size={16} />
                </button>
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('redo-action'))}
                  disabled={future.length === 0}
                  className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                  title="Refazer (Ctrl+Y)"
                >
                  <Redo2 size={16} />
                </button>
                <div className="w-px h-4 bg-[var(--border)] mx-1"></div>
              </>
            )}
            <div className="relative group">
              <button 
                className={`p-1.5 rounded-md transition-colors ${(isOutlined || isColorful || globalLineColor) ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}
                title="Estilos e Cores"
              >
                <Palette size={16} />
              </button>
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity flex flex-col py-2 z-50">
                <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700 mb-1">Visual</div>
                
                <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={isColorful} onChange={() => setIsColorful(!isColorful)} className="rounded border-gray-300 text-blue-500" />
                  Modo Colorido
                </label>
                
                <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={isOutlined} onChange={() => setIsOutlined(!isOutlined)} className="rounded border-gray-300 text-blue-500" />
                  Modo Contorno
                </label>

                <div className="px-3 py-1 mt-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700 mb-1">Cor das Linhas</div>
                <div className="flex flex-wrap gap-1 px-3 py-1">
                  <button 
                    onClick={() => setGlobalLineColor(null)} 
                    className={`w-5 h-5 rounded-full border shadow-sm flex items-center justify-center ${!globalLineColor ? 'ring-2 ring-blue-500 ring-offset-1' : 'border-gray-300'}`}
                    style={{ background: 'linear-gradient(45deg, #ef4444, #3b82f6, #22c55e)' }}
                    title="Multicolorido (Padrão)"
                  />
                  {['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899', '#ffffff', '#1f2937'].map(c => (
                    <button 
                      key={c}
                      onClick={() => setGlobalLineColor(c)} 
                      className={`w-5 h-5 rounded-full shadow-sm border border-gray-200 ${globalLineColor === c ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <button 
              onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} 
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
              title="Alternar Tema"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <div className="relative group">
              <button 
                className={`p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors`}
                title="Nível de Detalhamento"
              >
                <Layers size={16} />
              </button>
              <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity flex flex-col py-1 z-50">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center border-b border-gray-100 dark:border-gray-700 mb-1">Níveis</div>
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    onClick={() => {
                       setDepthLevel(level)
                       window.dispatchEvent(new CustomEvent('set-depth-level', { detail: { level } }))
                    }}
                    className={`w-full px-4 py-2 text-sm font-medium transition-colors text-left ${depthLevel === level ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  >
                    Nível {level}
                  </button>
                ))}
              </div>
            </div>
            <div className="w-px h-4 bg-[var(--border)] mx-1"></div>
            <button 
              onClick={() => {
                setIsFocusMode(true)
                setPresentationMode('edit')
              }}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
              title="Modo Foco"
            >
              <Focus size={16} />
            </button>
            <div className="relative group">
              <button 
                className={`p-1.5 rounded-md transition-colors ${presentationMode !== 'edit' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}
                title="Apresentação"
              >
                <MonitorPlay size={16} />
              </button>
              <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity flex flex-col py-1 z-50">
                <div className="px-4 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Apresentar</div>
                {presentations.length === 0 ? (
                  <div className="px-4 py-2 text-sm text-gray-400 italic">Nenhuma apresentação</div>
                ) : (
                  presentations.map(p => (
                    <button 
                      key={p.id}
                      onClick={() => {
                        setActivePresentationId(p.id)
                        setSlides(p.slides || [])
                        if ((p.slides || []).length === 0) {
                          alert('Adicione pelo menos um slide antes de apresentar!')
                          return
                        }
                        setCurrentSlideIndex(0)
                        setPresentationMode('playing')
                      }}
                      className="px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-purple-900/30 flex items-center gap-2 truncate"
                    >
                      <Play size={14} className="text-purple-500 flex-shrink-0" /> 
                      <span className="truncate">{p.name}</span>
                    </button>
                  ))
                )}
                <div className="h-px bg-gray-200 dark:bg-gray-700 my-1"></div>
                <button 
                  onClick={() => {
                    setPresentationMode('presentation_setup')
                    setIsCapturingMode(false)
                  }}
                  className="px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Settings size={14} className="text-gray-500 flex-shrink-0" /> Editar apresentações
                </button>
              </div>
            </div>
            <div className="w-px h-4 bg-[var(--border)] mx-1"></div>
            <button 
              onClick={() => setIsShareModalOpen(true)}
              className="text-sm px-3 py-1.5 font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Compartilhar
            </button>
            <button 
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-medium text-sm hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              <Download size={14} /> Exportar
            </button>
            </div>
          </header>
        )}

        {/* Canvas Area */}
        <main className={`flex-1 w-full h-full ${presentationMode === 'playing' || isFocusMode ? 'pt-0' : 'pt-14'} transition-all`}>
          <Canvas 
            mapId={map.id} 
            initialNodes={initialNodes} 
            initialEdges={initialEdges} 
            initialNodeTags={initialNodeTags}
            setSaveStatus={setSaveStatus}
            isColorful={isColorful}
            isOutlined={isOutlined}
            globalLineColor={globalLineColor}
            theme={theme}
            presentationMode={presentationMode}
            slides={slides}
            setSlides={setSlides}
            currentSlideIndex={currentSlideIndex}
            isCapturingMode={isCapturingMode}
            setIsCapturingMode={setIsCapturingMode}
            updatingSlideId={updatingSlideId}
            setUpdatingSlideId={setUpdatingSlideId}
            isReadOnly={isReadOnly}
          />
        </main>

        {/* Presentation Sidebar */}
        {presentationMode === 'presentation_setup' && (
          <div className="absolute right-4 top-16 bottom-4 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl flex flex-col overflow-hidden z-20">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
              <h3 className="font-semibold text-sm flex items-center gap-2"><MonitorPlay size={16} className="text-purple-500"/> Apresentações</h3>
              <button onClick={() => setPresentationMode('edit')} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"><X size={16}/></button>
            </div>
            
            <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex flex-col gap-2">
              <select 
                value={activePresentationId || ''} 
                onChange={(e) => {
                  const presId = e.target.value
                  setActivePresentationId(presId)
                  setSlides(presentations.find(p => p.id === presId)?.slides || [])
                }}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-purple-500"
              >
                {presentations.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button 
                  onClick={async () => {
                    const name = prompt('Nome da nova apresentação:')
                    if (name) {
                      const { data } = await supabase.from('map_presentations').insert({ map_id: map.id, name, slides: [] }).select().single()
                      if (data) {
                        setPresentations([...presentations, data])
                        setActivePresentationId(data.id)
                        setSlides([])
                      }
                    }
                  }}
                  className="flex-1 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 py-1.5 rounded font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                >
                  + Nova
                </button>
                <button 
                  onClick={async () => {
                     const name = prompt('Renomear apresentação:', presentations.find(p => p.id === activePresentationId)?.name || '')
                     if (name && activePresentationId) {
                        await supabase.from('map_presentations').update({ name }).eq('id', activePresentationId)
                        setPresentations(prev => prev.map(p => p.id === activePresentationId ? { ...p, name } : p))
                     }
                  }}
                  disabled={!activePresentationId}
                  className="flex-1 text-xs bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 py-1.5 rounded font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Renomear
                </button>
                <button 
                  onClick={async () => {
                    if (activePresentationId && confirm('Excluir esta apresentação?')) {
                      await supabase.from('map_presentations').delete().eq('id', activePresentationId)
                      const next = presentations.filter(p => p.id !== activePresentationId)
                      setPresentations(next)
                      if (next.length > 0) {
                        setActivePresentationId(next[0].id)
                        setSlides(next[0].slides || [])
                      } else {
                        setActivePresentationId(null)
                        setSlides([])
                      }
                    }
                  }}
                  disabled={!activePresentationId}
                  className="px-2 text-xs bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
                  title="Excluir Apresentação"
                >
                  <Trash2 size={14}/>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {slides.length === 0 ? (
                <div className="text-center text-xs text-gray-400 mt-4 px-2">
                  Nenhum slide. Clique em "Novo Slide" abaixo para capturar uma área do mapa.
                </div>
              ) : (
                slides.map((slide, index) => (
                  <div 
                    key={slide.id} 
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', index.toString())
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
                      const toIndex = index
                      if (fromIndex !== toIndex && !isNaN(fromIndex)) {
                        const newSlides = [...slides]
                        const [movedSlide] = newSlides.splice(fromIndex, 1)
                        newSlides.splice(toIndex, 0, movedSlide)
                        setSlides(newSlides)
                      }
                    }}
                    className="group flex flex-col gap-1 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-2 rounded-lg hover:border-purple-300 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <GripVertical size={14} />
                      </div>
                      
                      {editingSlideId === slide.id ? (
                        <input
                           autoFocus
                           className="flex-1 text-xs border border-purple-500 rounded px-1 py-0.5 outline-none text-gray-900 dark:text-white bg-transparent"
                           value={editingSlideName}
                           onChange={e => setEditingSlideName(e.target.value)}
                           onBlur={() => {
                             setSlides(s => s.map(x => x.id === slide.id ? { ...x, name: editingSlideName } : x))
                             setEditingSlideId(null)
                           }}
                           onKeyDown={e => {
                             if (e.key === 'Enter') {
                               setSlides(s => s.map(x => x.id === slide.id ? { ...x, name: editingSlideName } : x))
                               setEditingSlideId(null)
                             }
                           }}
                        />
                      ) : (
                        <span 
                          onClick={() => { setEditingSlideId(slide.id); setEditingSlideName(slide.name || `Slide ${index + 1}`) }}
                          className="text-xs font-medium flex-1 cursor-pointer hover:text-purple-600 truncate"
                        >
                          {slide.name || `Slide ${index + 1}`}
                        </span>
                      )}
                      
                      <button 
                        onClick={() => setSlides(s => s.filter(x => x.id !== slide.id))}
                        className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Excluir"
                      >
                        <Trash2 size={14}/>
                      </button>
                    </div>
                    
                    <div className="flex justify-between items-center mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-[10px] text-gray-400">Área: {Math.round(slide.bounds.width)}x{Math.round(slide.bounds.height)}</span>
                      <button
                        onClick={() => {
                          setUpdatingSlideId(slide.id)
                          setIsCapturingMode(true)
                        }}
                        className="text-[10px] text-blue-500 hover:underline"
                      >
                        Retomar Área
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-2 bg-gray-50 dark:bg-gray-900">
              {isCapturingMode ? (
                <>
                  <div className="text-[11px] text-purple-600 font-medium text-center bg-purple-50 dark:bg-purple-900/30 p-2 rounded border border-purple-200 dark:border-purple-800">
                    {updatingSlideId ? 'Arraste no mapa para atualizar a área.' : 'Arraste no mapa para criar o slide.'}
                  </div>
                  <button 
                    onClick={() => { setIsCapturingMode(false); setUpdatingSlideId(null); }}
                    className="w-full py-2 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-400 rounded-lg text-sm font-medium transition-colors"
                  >
                    Concluir Captura
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => { setUpdatingSlideId(null); setIsCapturingMode(true) }} 
                  disabled={!activePresentationId}
                  className="w-full py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-purple-600 border border-purple-200 dark:border-purple-800 rounded-lg text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                >
                  <Plus size={16} /> Novo Slide
                </button>
              )}
              <button disabled={slides.length === 0} onClick={startPlaying} className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50">
                <Play size={16} fill="currentColor" /> Apresentar
              </button>
            </div>
          </div>
        )}

        {/* Player UI */}
        {presentationMode === 'playing' && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-full shadow-2xl px-4 py-2 flex items-center gap-4 z-50">
            <button 
              onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
              disabled={currentSlideIndex === 0}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-medium tabular-nums">
              {currentSlideIndex + 1} / {slides.length}
            </span>
            <button 
              onClick={() => setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1))}
              disabled={currentSlideIndex === slides.length - 1}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight size={20} />
            </button>
            
            <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-2"></div>
            
            <button 
              onClick={() => setPresentationMode('presentation_setup')}
              className="p-2 rounded-full hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 text-gray-500 transition-colors"
              title="Sair"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Floating Focus Mode Toolbar */}
        {isFocusMode && (
          <div className="absolute bottom-6 right-6 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-2 flex flex-col items-center gap-2 z-50">
            <div className="flex items-center gap-1">
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('undo-action'))}
                disabled={past.length === 0}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors disabled:opacity-30"
                title="Desfazer (Ctrl+Z)"
              >
                <Undo2 size={16} />
              </button>
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('redo-action'))}
                disabled={future.length === 0}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors disabled:opacity-30"
                title="Refazer (Ctrl+Y)"
              >
                <Redo2 size={16} />
              </button>
            </div>
            
            <div className="w-full h-px bg-gray-200 dark:bg-gray-700"></div>

            <div className="flex flex-col items-center gap-1 w-full">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Níveis</span>
              <div className="flex flex-col gap-1 w-full">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    onClick={() => {
                       setDepthLevel(level)
                       window.dispatchEvent(new CustomEvent('set-depth-level', { detail: { level } }))
                    }}
                    className={`w-full py-1 text-xs font-medium rounded transition-colors ${depthLevel === level ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    title={`Mostrar até o nível ${level}`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full h-px bg-gray-200 dark:bg-gray-700"></div>

            <button 
              onClick={() => setIsFocusMode(false)}
              className="w-full p-1.5 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded text-xs font-medium transition-colors"
              title="Sair do Foco"
            >
              <X size={16} className="mx-auto" />
            </button>
          </div>
        )}
      </div>

      <ShareModal 
        mapId={map.id} 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        isOwner={map.user_id === user.id}
      />
      <ExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)}
        presentations={presentations}
        onExportMap={(format) => window.dispatchEvent(new CustomEvent('export-map', { detail: { format } }))}
        onExportPresentation={(presentationId, format) => {
          const presentation = presentations.find(p => p.id === presentationId)
          if (presentation) {
             window.dispatchEvent(new CustomEvent('export-presentation', { detail: { presentation, format } }))
          }
        }}
      />
    </div>
  )
}
