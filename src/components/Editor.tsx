'use client'

import { useState, useEffect } from 'react'
import { MindMap, MapNode, MapEdge } from '@/types'
import { ChevronLeft, Cloud, Settings, MoreHorizontal, Moon, Sun, Palette, Play, MonitorPlay, X, Plus, GripVertical, Trash2, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Canvas from '@/mindmap/Canvas'
import Sidebar from '@/components/Sidebar'
import ShareModal from '@/components/ShareModal'
import { supabase } from '@/supabase/client'
import { toJpeg } from 'html-to-image'
import { useMapStore } from '@/store/mapStore'

export default function Editor({ map, initialNodes, initialEdges, user, isReadOnly = false }: { map: MindMap, initialNodes: MapNode[], initialEdges: MapEdge[], user: any, isReadOnly?: boolean }) {
  const router = useRouter()
  const [isSidebarOpen, setSidebarOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [isColorful, setIsColorful] = useState(false)

  // Presentation State
  const [slides, setSlides] = useState<any[]>([])
  const [presentationMode, setPresentationMode] = useState<'edit' | 'presentation_setup' | 'playing'>('edit')
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [isCapturingMode, setIsCapturingMode] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  
  // Zustand Store
  const { mapTags, setMapTags } = useMapStore()
  
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

  // Parse existing slides and tags on mount
  useEffect(() => {
    if (map.thumbnail) {
      try {
        const parsed = JSON.parse(map.thumbnail)
        if (Array.isArray(parsed)) setSlides(parsed)
        else {
          if (parsed.slides) setSlides(parsed.slides)
          if (parsed.mapTags) setMapTags(parsed.mapTags)
        }
      } catch (e) {
        console.error("Failed to parse thumbnail json", e)
      }
    }
  }, [map.thumbnail, setMapTags])

  // Save slides and tags when they change
  useEffect(() => {
    if (slides.length > 0 || mapTags.length > 0 || map.thumbnail) { // Avoid saving empty if never had anything
      let preview = null
      if (map.thumbnail) {
        try {
          const parsed = JSON.parse(map.thumbnail)
          if (!Array.isArray(parsed) && parsed.preview) preview = parsed.preview
        } catch(e) {}
      }
      supabase.from('mind_maps').update({ thumbnail: JSON.stringify({ slides, preview, mapTags }) }).eq('id', map.id).then()
    }
  }, [slides, mapTags, map.id])

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
      {presentationMode !== 'playing' && (
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setSidebarOpen} />
      )}

      <div className="flex-1 flex flex-col relative">
        {/* Top Header */}
        {presentationMode !== 'playing' && (
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
                    supabase.from('mind_maps').update({ thumbnail: JSON.stringify({ slides, preview, mapTags }) }).eq('id', map.id).then()
                  } catch (e) {
                    console.error('Failed to capture thumbnail', e)
                  }
                }
                router.push('/')
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
            <button 
              onClick={() => setIsColorful(!isColorful)} 
              className={`p-1.5 rounded-md transition-colors ${isColorful ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}
              title="Modo Colorido"
            >
              <Palette size={16} />
            </button>
            <button 
              onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} 
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
              title="Alternar Tema"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <div className="w-px h-4 bg-[var(--border)] mx-1"></div>
            <button 
              onClick={() => {
                setPresentationMode(presentationMode === 'presentation_setup' ? 'edit' : 'presentation_setup')
                setIsCapturingMode(false)
              }}
              className={`p-1.5 rounded-md transition-colors ${presentationMode !== 'edit' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}
              title="Apresentação"
            >
              <MonitorPlay size={16} />
            </button>
            <div className="w-px h-4 bg-[var(--border)] mx-1"></div>
            <button 
              onClick={() => setIsShareModalOpen(true)}
              className="text-sm px-3 py-1.5 font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Compartilhar
            </button>
            <button 
              onClick={() => alert('Configurações do mapa estarão disponíveis em breve!')}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
              title="Configurações"
            >
              <Settings size={16} />
            </button>
            <div className="relative group">
              <button className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><MoreHorizontal size={16} /></button>
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity flex flex-col py-1 z-50">
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('export-map', { detail: { format: 'png' } }))}
                  className="px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Exportar como PNG
                </button>
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('export-map', { detail: { format: 'svg' } }))}
                  className="px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Exportar como SVG
                </button>
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('export-map', { detail: { format: 'json' } }))}
                  className="px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Exportar como JSON
                </button>
                <div className="h-px bg-gray-200 dark:bg-gray-700 my-1"></div>
                <button 
                  onClick={async () => {
                    if (confirm('Tem certeza que deseja excluir este mapa? Esta ação não pode ser desfeita.')) {
                      await supabase.from('mind_maps').delete().eq('id', map.id)
                      router.push('/')
                    }
                  }}
                  className="px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                >
                  Excluir Mapa
                </button>
              </div>
            </div>
            </div>
          </header>
        )}

        {/* Canvas Area */}
        <main className={`flex-1 w-full h-full ${presentationMode === 'playing' ? 'pt-0' : 'pt-14'} transition-all`}>
          <Canvas 
            mapId={map.id} 
            initialNodes={initialNodes} 
            initialEdges={initialEdges} 
            setSaveStatus={setSaveStatus}
            isColorful={isColorful}
            theme={theme}
            presentationMode={presentationMode}
            slides={slides}
            setSlides={setSlides}
            currentSlideIndex={currentSlideIndex}
            isCapturingMode={isCapturingMode}
            setIsCapturingMode={setIsCapturingMode}
            isReadOnly={isReadOnly}
          />
        </main>

        {/* Presentation Sidebar */}
        {presentationMode === 'presentation_setup' && (
          <div className="absolute right-4 top-16 bottom-4 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl flex flex-col overflow-hidden z-20">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
              <h3 className="font-semibold text-sm flex items-center gap-2"><MonitorPlay size={16} className="text-purple-500"/> Slides</h3>
              <button onClick={() => setPresentationMode('edit')} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"><X size={16}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {slides.length === 0 ? (
                <div className="text-center text-xs text-gray-400 mt-4 px-2">
                  Nenhum slide. Clique em "Novo Slide" abaixo para capturar uma área do mapa.
                </div>
              ) : (
                slides.map((slide, index) => (
                  <div key={slide.id} className="group flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-2 rounded-lg hover:border-purple-300 transition-colors">
                    <div className="flex flex-col opacity-50 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          if (index > 0) {
                            const newSlides = [...slides]
                            ;[newSlides[index - 1], newSlides[index]] = [newSlides[index], newSlides[index - 1]]
                            setSlides(newSlides)
                          }
                        }}
                        disabled={index === 0}
                        className="hover:text-purple-600 disabled:opacity-30 disabled:hover:text-inherit"
                      >
                        <ChevronLeft size={14} className="rotate-90"/>
                      </button>
                      <button 
                        onClick={() => {
                          if (index < slides.length - 1) {
                            const newSlides = [...slides]
                            ;[newSlides[index + 1], newSlides[index]] = [newSlides[index], newSlides[index + 1]]
                            setSlides(newSlides)
                          }
                        }}
                        disabled={index === slides.length - 1}
                        className="hover:text-purple-600 disabled:opacity-30 disabled:hover:text-inherit"
                      >
                        <ChevronLeft size={14} className="-rotate-90"/>
                      </button>
                    </div>
                    <span className="text-xs font-medium flex-1">Slide {index + 1}</span>
                    <button 
                      onClick={() => setSlides(s => s.filter(x => x.id !== slide.id))}
                      className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14}/>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-2 bg-gray-50 dark:bg-gray-900">
              {isCapturingMode ? (
                <div className="text-[11px] text-purple-600 font-medium text-center bg-purple-50 dark:bg-purple-900/30 p-2 rounded border border-purple-200 dark:border-purple-800">
                  Arraste no mapa para criar o slide.
                </div>
              ) : (
                <button 
                  onClick={() => setIsCapturingMode(true)} 
                  className="w-full py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-purple-600 border border-purple-200 dark:border-purple-800 rounded-lg text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  <Plus size={16} /> Novo Slide
                </button>
              )}
              <button onClick={startPlaying} className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition-colors">
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
      </div>

      <ShareModal 
        mapId={map.id} 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        isOwner={map.user_id === user.id}
      />
    </div>
  )
}
