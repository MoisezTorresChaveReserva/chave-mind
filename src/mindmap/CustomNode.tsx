import React, { memo, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react'
import { Plus, Wand2, Type, Trash2, Palette, Image as ImageIcon, Link, Link2, Smile, X, Tag as TagIcon, Check } from 'lucide-react'
import { useMapStore } from '@/store/mapStore'
import { supabase } from '@/supabase/client'

const generateId = () => {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)
}

const pastelColors = [
  'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-900/50',
  'bg-green-50 dark:bg-green-950/40 text-green-900 dark:text-green-200 border-green-200 dark:border-green-900/50',
  'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-900/50',
  'bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 border-purple-200 dark:border-purple-900/50',
  'bg-pink-50 dark:bg-pink-950/40 text-pink-900 dark:text-pink-200 border-pink-200 dark:border-pink-900/50',
  'bg-orange-50 dark:bg-orange-950/40 text-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-900/50'
]

const CustomNode = ({ data, selected, id, positionAbsoluteX, positionAbsoluteY }: NodeProps) => {
  const [isEditing, setIsEditing] = useState(!!data.isNew)
  const [text, setText] = useState(data.label as string || '')
  const [activeMenu, setActiveMenu] = useState<'none' | 'color' | 'image' | 'link' | 'icon' | 'tag'>('none')
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null)
  const [tempUrl, setTempUrl] = useState('')
  const [newTagText, setNewTagText] = useState('')
  const [newTagColor, setNewTagColor] = useState('#ec4899')
  const inputRef = useRef<HTMLInputElement>(null)
  
  const { mapTags, addMapTag } = useMapStore()
  
  const nodeTagsIds = (data.tags as string[]) || []
  const nodeTags = mapTags.filter(t => nodeTagsIds.includes(t.id))
  const { setNodes, setEdges } = useReactFlow()

  const handleClickOutside = () => {
    if (contextMenu) {
      setContextMenu(null)
      setActiveMenu('none')
    }
  }

  useEffect(() => {
    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [contextMenu])

  const colorIndex = [...id].reduce((acc, char) => acc + char.charCodeAt(0), 0) % pastelColors.length

  // Base themes if no custom color is set
  const themeClass = data.isColorful
    ? pastelColors[colorIndex]
    : 'bg-transparent text-[var(--foreground)] border-transparent'

  // Custom styles
  const customBg = data.bg_color as string
  const customText = data.text_color as string
  const customStyle: React.CSSProperties = {}
  if (customBg) customStyle.backgroundColor = customBg
  if (customText) customStyle.color = customText

  const branchColor = (data.branchColor as string) || '#ec4899'
  const isRoot = data.isRoot as boolean
  const isReadOnly = data.isReadOnly as boolean

  useEffect(() => {
    setText(data.label as string || '')
  }, [data.label])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      const timeoutId = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.select()
        }
      }, 50) // Small delay to let React Flow finish rendering and event propagation
      return () => clearTimeout(timeoutId)
    }
  }, [isEditing])

  const onDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isReadOnly) setIsEditing(true)
  }

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isReadOnly) {
      setContextMenu({ x: e.clientX, y: e.clientY })
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setIsEditing(false)
      if (text.trim() === '') {
        if (typeof data.onDelete === 'function') data.onDelete(id)
        return
      }
      if (typeof data.onChange === 'function') {
        data.onChange(id, text)
      }
    }
  }

  const onBlur = () => {
    setIsEditing(false)
    if (text.trim() === '') {
      if (typeof data.onDelete === 'function') data.onDelete(id)
      return
    }
    if (typeof data.onChange === 'function' && text !== data.label) {
      data.onChange(id, text)
    }
  }

  const handleAddChild = (direction?: 'left' | 'right') => {
    if (typeof data.onAddChild === 'function') data.onAddChild(id, direction)
  }

  const handleAddSibling = () => {
    if (typeof data.onAddSibling === 'function') data.onAddSibling(id)
  }

  const updateFormatting = (updates: any) => {
    if (typeof data.onChangeFormatting === 'function') {
      data.onChangeFormatting(id, updates)
    }
  }

  const THEME_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899', '#ffffff', '#1f2937', 'transparent']

  if (data.isGhost) {
    return (
      <div className="w-16 h-8 bg-gray-200 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-400 dark:border-gray-600 opacity-60">
        <Handle type="target" position={Position.Left} className="opacity-0" />
      </div>
    )
  }

  return (
    <>
      {/* Context Menu (Only if not read only) */}
      {!isReadOnly && contextMenu && createPortal(
        <div
          className="fixed z-[100] flex flex-col gap-2 items-start"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >

          {/* Formatting Popovers */}
          {activeMenu === 'color' && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-3 flex flex-col gap-2 w-48">
              <div className="text-xs font-semibold text-gray-500 mb-1 flex justify-between">
                <span>Cores</span>
                <button onClick={() => setActiveMenu('none')}><X size={14} /></button>
              </div>
              <div className="text-[10px] uppercase font-bold text-gray-400">Fundo</div>
              <div className="flex flex-wrap gap-1">
                {THEME_COLORS.map(c => (
                  <button key={'bg-' + c} onClick={() => updateFormatting({ bg_color: c === 'transparent' ? null : c })} className="w-5 h-5 rounded-full border border-gray-300 shadow-sm" style={{ backgroundColor: c === 'transparent' ? '#f3f4f6' : c }} />
                ))}
              </div>
              <div className="text-[10px] uppercase font-bold text-gray-400 mt-1">Texto</div>
              <div className="flex flex-wrap gap-1">
                {THEME_COLORS.map(c => (
                  <button key={'tx-' + c} onClick={() => updateFormatting({ text_color: c === 'transparent' ? null : c })} className="w-5 h-5 rounded-full border border-gray-300 shadow-sm" style={{ backgroundColor: c === 'transparent' ? '#f3f4f6' : c }} />
                ))}
              </div>
            </div>
          )}

          {activeMenu === 'image' && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-3 flex flex-col gap-2 w-48">
              <div className="text-xs font-semibold text-gray-500 flex justify-between">
                <span>URL da Imagem</span>
                <button onClick={() => setActiveMenu('none')}><X size={14} /></button>
              </div>
              <input
                type="text"
                placeholder="https://..."
                value={tempUrl}
                onChange={e => setTempUrl(e.target.value)}
                className="w-full text-xs p-1 border rounded"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateFormatting({ image_url: tempUrl })
                    setActiveMenu('none')
                    setTempUrl('')
                  }
                }}
              />
              <button onClick={() => { updateFormatting({ image_url: tempUrl }); setActiveMenu('none'); setTempUrl('') }} className="text-xs bg-blue-500 text-white rounded py-1">Aplicar</button>
              <button onClick={() => { updateFormatting({ image_url: null }); setActiveMenu('none') }} className="text-xs text-red-500 py-1">Remover</button>
            </div>
          )}

          {activeMenu === 'link' && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-3 flex flex-col gap-2 w-48">
              <div className="text-xs font-semibold text-gray-500 flex justify-between">
                <span>Link URL</span>
                <button onClick={() => setActiveMenu('none')}><X size={14} /></button>
              </div>
              <input
                type="text"
                placeholder="https://..."
                value={tempUrl}
                onChange={e => setTempUrl(e.target.value)}
                className="w-full text-xs p-1 border rounded"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateFormatting({ link_url: tempUrl })
                    setActiveMenu('none')
                    setTempUrl('')
                  }
                }}
              />
              <button onClick={() => { updateFormatting({ link_url: tempUrl }); setActiveMenu('none'); setTempUrl('') }} className="text-xs bg-blue-500 text-white rounded py-1">Aplicar</button>
              <button onClick={() => { updateFormatting({ link_url: null }); setActiveMenu('none') }} className="text-xs text-red-500 py-1">Remover</button>
            </div>
          )}

          {activeMenu === 'icon' && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-3 flex flex-col gap-2 w-48">
              <div className="text-xs font-semibold text-gray-500 flex justify-between">
                <span>Ícone (Emoji)</span>
                <button onClick={() => setActiveMenu('none')}><X size={14} /></button>
              </div>
              <div className="flex flex-wrap gap-2 text-lg">
                {['🚀', '💡', '🔥', '✅', '⭐', '❤️', '🎯', '💰', '📊', '🌐', '📌', '⚠️'].map(emoji => (
                  <button key={emoji} onClick={() => { updateFormatting({ icon: emoji }); setActiveMenu('none') }} className="hover:scale-125 transition-transform">{emoji}</button>
                ))}
              </div>
              <button onClick={() => { updateFormatting({ icon: null }); setActiveMenu('none') }} className="text-xs text-red-500 py-1 mt-1">Remover</button>
            </div>
          )}

          {activeMenu === 'tag' && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-3 flex flex-col gap-3 w-56 max-h-64 overflow-y-auto">
              <div className="text-xs font-semibold text-gray-500 flex justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
                <span>Etiquetas</span>
                <button onClick={() => setActiveMenu('none')}><X size={14} /></button>
              </div>
              
              <div className="flex flex-col gap-1">
                {mapTags.length === 0 && <span className="text-xs text-gray-400 italic">Nenhuma etiqueta criada</span>}
                {mapTags.map(tag => {
                  const isActive = nodeTagsIds.includes(tag.id)
                  return (
                    <button 
                      key={tag.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        const isActive = nodeTagsIds.includes(tag.id)
                        const newIds = isActive ? nodeTagsIds.filter(id => id !== tag.id) : [...nodeTagsIds, tag.id]
                        updateFormatting({ tags: newIds }) // Handled by saveToDb in Canvas.tsx
                      }}
                      className="flex items-center gap-2 text-xs p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      <div className={`w-3 h-3 rounded-full flex items-center justify-center`} style={{ backgroundColor: tag.color }}>
                        {isActive && <Check size={8} color="#fff" />}
                      </div>
                      <span className="truncate">{tag.text}</span>
                    </button>
                  )
                })}
              </div>

              <div className="border-t border-gray-100 dark:border-gray-700 pt-2 flex flex-col gap-2">
                <span className="text-[10px] text-gray-500 uppercase font-semibold">Nova Etiqueta</span>
                <div className="flex items-center gap-1">
                  <input 
                    type="color" 
                    value={newTagColor} 
                    onChange={e => setNewTagColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0 p-0" 
                  />
                  <input 
                    type="text" 
                    placeholder="Nome"
                    value={newTagText}
                    onChange={e => setNewTagText(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && newTagText.trim()) {
                        const mapId = data.mapId as string
                        const tempId = generateId()
                        const newTag = { id: tempId, text: newTagText.trim(), color: newTagColor }
                        addMapTag(newTag) // Optimistic
                        updateFormatting({ tags: [...nodeTagsIds, tempId] })
                        setNewTagText('')
                        
                        const { data: inserted } = await supabase.from('map_tags').insert({ map_id: mapId, text: newTag.text, color: newTag.color }).select().single()
                        if (inserted) {
                           useMapStore.getState().setMapTags([...useMapStore.getState().mapTags.filter(t => t.id !== tempId), inserted])
                           updateFormatting({ tags: [...nodeTagsIds.filter(id => id !== tempId), inserted.id] })
                        }
                      }
                    }}
                    className="flex-1 text-xs p-1 border rounded"
                  />
                </div>
                <button 
                  onClick={async () => {
                    if (newTagText.trim()) {
                      const mapId = data.mapId as string
                      const tempId = generateId()
                      const newTag = { id: tempId, text: newTagText.trim(), color: newTagColor }
                      addMapTag(newTag) // Optimistic
                      updateFormatting({ tags: [...nodeTagsIds, tempId] })
                      setNewTagText('')
                      
                      const { data: inserted } = await supabase.from('map_tags').insert({ map_id: mapId, text: newTag.text, color: newTag.color }).select().single()
                      if (inserted) {
                         // Update store with real ID
                         useMapStore.getState().setMapTags(useMapStore.getState().mapTags.map(t => t.id === tempId ? inserted : t))
                         updateFormatting({ tags: [...nodeTagsIds, inserted.id] })
                         await supabase.from('node_tags').insert({ node_id: id, tag_id: inserted.id })
                      }
                    }
                  }}
                  disabled={!newTagText.trim()}
                  className="text-xs bg-blue-500 text-white rounded py-1 disabled:opacity-50"
                >
                  Criar e Adicionar
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-1.5">
            <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'color' ? 'none' : 'color') }} className="p-1.5 text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/30 rounded-md transition-colors" title="Cores"><Palette size={16} /></button>
            <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'tag' ? 'none' : 'tag') }} className="p-1.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-md transition-colors" title="Etiquetas"><TagIcon size={16} /></button>
            <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'image' ? 'none' : 'image'); setTempUrl(data.image_url as string || '') }} className="p-1.5 text-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-md transition-colors" title="Imagem"><ImageIcon size={16} /></button>
            <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'link' ? 'none' : 'link'); setTempUrl(data.link_url as string || '') }} className="p-1.5 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-md transition-colors" title="Link"><Link size={16} /></button>
            <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'icon' ? 'none' : 'icon') }} className="p-1.5 text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-md transition-colors" title="Ícone"><Smile size={16} /></button>
            <div className="w-[1px] bg-gray-200 dark:bg-gray-700 mx-1"></div>
            <button onClick={(e) => { e.stopPropagation(); if (typeof data.onAI === 'function') data.onAI(id) }} className="p-1.5 text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-md transition-colors" title="Gerar Ideias (AI)"><Wand2 size={16} /></button>
            <button onClick={(e) => { e.stopPropagation(); setIsEditing(true) }} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors" title="Editar Texto"><Type size={16} /></button>
            {!isRoot && (
              <button onClick={(e) => { e.stopPropagation(); if (typeof data.onDelete === 'function') data.onDelete(id) }} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors" title="Excluir (Delete)"><Trash2 size={16} /></button>
            )}
          </div>
        </div>,
        document.body
      )}

      <div
        className={`
          relative px-2 py-1 rounded-xl flex flex-col items-center justify-center w-max transition-all group
          ${customBg ? '' : themeClass}
          ${selected ? 'ring-2 ring-purple-500 ring-offset-2 dark:ring-offset-gray-900 shadow-md' : ''}
          ${data.isDropTarget ? 'ring-4 ring-green-500 border-dashed scale-110 shadow-2xl z-50 ring-offset-2 dark:ring-offset-gray-900 bg-green-50/50 dark:bg-green-900/30' : ''}
        `}
        style={customStyle}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
      >
        {!!data.image_url && (
          <img src={data.image_url as string} alt="Node media" className="max-w-[120px] max-h-[80px] object-contain rounded mb-1 border border-gray-100 dark:border-gray-800" />
        )}

        <div className="flex flex-col w-full relative">
          {/* Main Content Row (Text + Handles) */}
          <div className="relative flex items-center justify-center w-full min-h-[28px]">
            {!isRoot && (
              <Handle
                type="target"
                id={data.direction === 'left' ? 'right' : 'left'}
                position={data.direction === 'left' ? Position.Right : Position.Left}
                className={`opacity-0 ${data.direction === 'left' ? '!-mr-[7px]' : '!-ml-[7px]'}`}
                style={{ borderColor: branchColor, top: '50%' }}
              />
            )}

            <div className="flex items-center gap-1.5 z-10 px-1">
            {!!data.icon && <span className="text-lg">{data.icon as string}</span>}

            {isEditing ? (
              <input
                ref={inputRef}
                value={text}
                autoFocus
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                onBlur={onBlur}
                onMouseDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                className={`nodrag nopan outline-none bg-transparent text-left w-full min-w-[80px] ${isRoot
                  ? 'text-[42px] font-bold tracking-tight text-slate-800'
                  : 'text-[18px] font-normal'}`}
                style={{ color: customText || 'inherit' }}
              />
            ) : (
              <span className={`select-none text-left ${customText ? '' : 'text-gray-800 dark:text-gray-100'} ${isRoot ? 'font-medium text-xl uppercase' : 'font-normal text-[16px]'}`} style={{ color: customText || 'inherit' }}>
                {text || 'Novo Nó'}
              </span>
            )}

            {!!data.link_url && (
              <a href={data.link_url as string} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline flex items-center justify-center gap-1 mt-1">
                <Link2 size={10} /> Link Externo
              </a>
            )}
          </div>
          
            {/* Toggle Collapse Button & Connector */}
            {!!data.hasChildren && (
              <>
                <div
                  className={`absolute top-1/2 -translate-y-1/2 z-0 ${data.direction === 'left' ? '' : ''}`}
                  style={{
                    [data.direction === 'left' ? 'left' : 'right']: data.childCount === 1 ? '-12px' : '-8px',
                    width: data.childCount === 1 ? '12px' : '8px',
                    height: '3px',
                    backgroundColor: branchColor
                  }}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); if (typeof data.onToggleCollapse === 'function') data.onToggleCollapse(id) }}
                  className="absolute top-1/2 -translate-y-1/2 w-[16px] h-[16px] rounded-full flex items-center justify-center z-20 cursor-pointer bg-white dark:bg-gray-800 transition-transform hover:scale-110 shadow-sm border-[2px]"
                  style={{
                    [data.direction === 'left' ? 'left' : 'right']: data.childCount === 1 ? '-28px' : '-16px',
                    borderColor: branchColor
                  }}
                  title={data.collapsed ? "Expandir" : "Recolher"}
                >
                  {!!data.collapsed && <div className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: branchColor }} />}
                </button>
              </>
            )}

            {isRoot ? (
              <>
                <Handle
                  type="source"
                  position={Position.Right}
                  id="right"
                  className="opacity-0"
                  style={{ right: '0px', top: '50%' }}
                  isConnectable={false}
                />
                <Handle
                  type="source"
                  position={Position.Left}
                  id="left"
                  className="opacity-0"
                  style={{ left: '0px', top: '50%' }}
                  isConnectable={false}
                />
              </>
            ) : (
              <Handle
                type="source"
                id={data.direction === 'left' ? 'left' : 'right'}
                position={data.direction === 'left' ? Position.Left : Position.Right}
                className="opacity-0"
                style={{ [data.direction === 'left' ? 'left' : 'right']: data.hasChildren ? (data.childCount === 1 ? '-28px' : '-16px') : '0px', top: '50%' }}
                isConnectable={false}
              />
            )}
          </div>

          {/* Tags */}
          {nodeTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1 justify-center relative z-10 w-full px-1">
              {nodeTags.map(tag => (
                <span 
                  key={tag.id} 
                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white whitespace-nowrap"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.text}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Add Child Button */}
        {selected && !isReadOnly && (
          isRoot ? (
            <>
              {/* Right Add Button */}
              <div className="absolute -right-10 top-1/2 -translate-y-1/2 flex items-center z-20">
                <button
                  onClick={(e) => { e.stopPropagation(); handleAddChild('right') }}
                  className="w-5 h-5 bg-[#3b82f6] text-white rounded-full flex items-center justify-center hover:bg-blue-600 shadow-sm"
                  title="Adicionar à Direita"
                >
                  <Plus size={14} />
                </button>
                <div className="hidden md:flex flex-col gap-1.5 absolute left-8 w-[200px] pointer-events-none">
                  <div className="flex items-center gap-2 text-[11px] text-gray-400 font-medium">
                    <span className="border border-[var(--border)] rounded px-1.5 py-0.5 text-gray-500 bg-[var(--node-bg)]">Tab</span> para criar tópico filho
                  </div>
                </div>
              </div>
              {/* Left Add Button */}
              <div className="absolute -left-10 top-1/2 -translate-y-1/2 flex items-center z-20 flex-row-reverse">
                <button
                  onClick={(e) => { e.stopPropagation(); handleAddChild('left') }}
                  className="w-5 h-5 bg-[#3b82f6] text-white rounded-full flex items-center justify-center hover:bg-blue-600 shadow-sm"
                  title="Adicionar à Esquerda"
                >
                  <Plus size={14} />
                </button>
              </div>
            </>
          ) : !data.hasChildren ? (
            <div className={`absolute top-1/2 -translate-y-1/2 flex items-center z-20 ${data.direction === 'left' ? '-left-10 flex-row-reverse' : '-right-10'}`}>
              <button
                onClick={(e) => { e.stopPropagation(); handleAddChild() }}
                className="w-5 h-5 bg-[#3b82f6] text-white rounded-full flex items-center justify-center hover:bg-blue-600 shadow-sm"
              >
                <Plus size={14} />
              </button>
              <div className={`hidden md:flex flex-col gap-1.5 absolute w-[200px] pointer-events-none ${data.direction === 'left' ? 'right-8 items-end' : 'left-8'}`}>
                <div className="flex items-center gap-2 text-[11px] text-gray-400 font-medium">
                  <span className="border border-[var(--border)] rounded px-1.5 py-0.5 text-gray-500 bg-[var(--node-bg)]">Tab</span> para criar tópico filho
                </div>
                <div className="flex items-center gap-2 text-[11px] text-gray-400 font-medium">
                  <span className="border border-[var(--border)] rounded px-1.5 py-0.5 text-gray-500 bg-[var(--node-bg)]">Enter</span> para criar tópico irmão
                </div>
              </div>
            </div>
          ) : null
        )}

        {/* Add Sibling Button */}
        {selected && !isRoot && !isReadOnly && (
          <button
            onClick={(e) => { e.stopPropagation(); handleAddSibling() }}
            className="absolute -bottom-[26px] left-1/2 -translate-x-1/2 w-5 h-5 bg-[#3b82f6] text-white rounded-full flex items-center justify-center hover:bg-blue-600 shadow-sm z-10"
          >
            <Plus size={14} />
          </button>
        )}
      </div>
    </>
  )
}

export default memo(CustomNode)
