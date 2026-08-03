import React, { memo, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position, NodeProps, useReactFlow, useUpdateNodeInternals } from '@xyflow/react'
import { Plus, Wand2, Type, Trash2, Palette, Image as ImageIcon, Link, Link2, Smile, X, Tag as TagIcon, Check, Edit2, Upload } from 'lucide-react'
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
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editTagText, setEditTagText] = useState('')
  const [editTagColor, setEditTagColor] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  
  const { mapTags, addMapTag } = useMapStore()
  
  const nodeTagsIds = (data.tags as string[]) || []
  const nodeTags = mapTags.filter(t => nodeTagsIds.includes(t.id))
  const { setNodes, setEdges } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()

  useEffect(() => {
    updateNodeInternals(id)
  }, [id, data.direction, data.layoutMode, data.hasChildren, data.tags, data.image_url, data.icon, data.link_url, data.label, text, nodeTags.length, updateNodeInternals])

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
  const branchColor = (data.branchColor as string) || (data.branch_color as string) || '#ec4899'
  
  const customStyle = {
    backgroundColor: customBg || undefined,
    border: (data.has_text_border || data.isOutlined) ? `2px solid ${customText || branchColor}` : undefined
  } as React.CSSProperties
  
  const isRoot = data.isRoot as boolean
  const isReadOnly = data.isReadOnly as boolean
  const layoutMode = (data.layoutMode as string) || 'mindmap'

  // Handle configuration based on layout mode
  let targetPosition = data.direction === 'left' ? Position.Right : Position.Left
  let targetId = data.direction === 'left' ? 'right' : 'left'
  let targetStyle: any = { top: '50%' }
  let targetClass = `opacity-0 ${data.direction === 'left' ? '!-mr-[7px]' : '!-ml-[7px]'}`
  
  let sourcePosition = data.direction === 'left' ? Position.Left : Position.Right
  let sourceId = data.direction === 'left' ? 'left' : 'right'
  let sourceStyle: any = { [data.direction === 'left' ? 'left' : 'right']: data.hasChildren ? '-22px' : '0px', top: '50%' }

  if (layoutMode === 'orgchart') {
    targetPosition = Position.Top
    targetId = 'top'
    targetStyle = { left: '50%' }
    targetClass = 'opacity-0 !-mt-[7px]'
    
    sourcePosition = Position.Bottom
    sourceId = 'bottom'
    sourceStyle = { left: '50%', bottom: data.hasChildren ? '-16px' : '0px' }
  } else if (layoutMode === 'list') {
    targetPosition = Position.Left
    targetId = 'left'
    targetStyle = { top: '50%' }
    targetClass = 'opacity-0 !-ml-[7px]'
    
    sourcePosition = Position.Bottom
    sourceId = 'bottom'
    sourceStyle = { left: '20px', bottom: data.hasChildren ? '-16px' : '0px' }
  }

  useEffect(() => {
    setText(data.label as string || '')
  }, [data.label])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      const timeoutId = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.select()
          inputRef.current.style.height = 'auto'
          inputRef.current.style.height = `${inputRef.current.scrollHeight}px`
        }
      }, 50) // Small delay to let React Flow finish rendering and event propagation
      return () => clearTimeout(timeoutId)
    }
  }, [isEditing])

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`
    }
  }

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

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      setIsEditing(false)
      if (text.trim() === '') {
        if (typeof data.onDelete === 'function') data.onDelete(id)
        return
      }
      if (typeof data.onChange === 'function') {
        data.onChange(id, text)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 400
        const MAX_HEIGHT = 400
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
        
        updateFormatting({ image_url: dataUrl })
        setActiveMenu('none')
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const THEME_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899', '#ffffff', '#1f2937', 'transparent']

  if (data.isGhost) {
    return (
      <div className="w-16 h-8 bg-gray-200 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-400 dark:border-gray-600 opacity-60">
        <Handle type="target" position={Position.Left} className="opacity-0" />
      </div>
    )
  }

  const activeCollaborator = data.activeCollaborator || (data.collaborators as any[])?.find((c: any) => c.activeNodeId === id)

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
              <div className="text-[10px] uppercase font-bold text-gray-400 mt-1">Texto / Contorno</div>
              <div className="flex flex-wrap gap-1">
                {THEME_COLORS.map(c => (
                  <button key={'tx-' + c} onClick={() => updateFormatting({ text_color: c === 'transparent' ? null : c })} className="w-5 h-5 rounded-full border border-gray-300 shadow-sm" style={{ backgroundColor: c === 'transparent' ? '#f3f4f6' : c }} />
                ))}
              </div>
              
              <div className="h-px bg-gray-200 dark:bg-gray-700 w-full my-1" />
              
              <label className="flex items-center gap-2 cursor-pointer w-full text-xs text-gray-700 dark:text-gray-300">
                <input 
                  type="checkbox" 
                  checked={!!data.has_text_border}
                  onChange={(e) => updateFormatting({ has_text_border: e.target.checked })}
                  className="rounded border-gray-300 text-blue-500 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 w-4 h-4"
                />
                Ativar contorno
              </label>
            </div>
          )}

          {activeMenu === 'image' && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-3 flex flex-col gap-2 w-56">
              <div className="text-xs font-semibold text-gray-500 flex justify-between">
                <span>Imagem do Nó</span>
                <button onClick={() => setActiveMenu('none')}><X size={14} /></button>
              </div>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 text-xs bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded py-2 transition-colors border border-dashed border-gray-300 dark:border-gray-600"
              >
                <Upload size={14} /> Fazer Upload
              </button>
              <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
              
              <div className="flex items-center gap-2 my-1">
                <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
                <span className="text-[10px] text-gray-400">OU URL</span>
                <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
              </div>

              <input
                type="text"
                placeholder="https://..."
                value={tempUrl}
                onChange={e => setTempUrl(e.target.value)}
                className="w-full text-xs p-1.5 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tempUrl.trim()) {
                    updateFormatting({ image_url: tempUrl })
                    setActiveMenu('none')
                    setTempUrl('')
                  }
                }}
              />
              <button onClick={() => { if(tempUrl.trim()) { updateFormatting({ image_url: tempUrl }); setActiveMenu('none'); setTempUrl('') } }} className="text-xs bg-blue-500 hover:bg-blue-600 text-white rounded py-1.5 transition-colors">Aplicar URL</button>
              
              {!!data.image_url && (
                <button onClick={() => { updateFormatting({ image_url: null }); setActiveMenu('none') }} className="text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded py-1.5 transition-colors mt-1">Remover Imagem atual</button>
              )}
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
                  
                  if (editingTagId === tag.id) {
                    return (
                      <div key={tag.id} className="flex flex-col gap-2 p-1.5 border rounded border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                        <div className="flex items-center gap-1">
                          <input type="color" value={editTagColor} onChange={e => setEditTagColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0" />
                          <input type="text" value={editTagText} onChange={e => setEditTagText(e.target.value)} className="flex-1 text-xs p-1 border rounded" />
                        </div>
                        <div className="flex justify-between mt-1">
                          <button onClick={async (e) => {
                             e.stopPropagation()
                             setEditingTagId(null)
                             useMapStore.getState().setMapTags(useMapStore.getState().mapTags.filter(t => t.id !== tag.id))
                             await supabase.from('map_tags').delete().eq('id', tag.id)
                          }} className="text-xs text-red-500 hover:underline">Excluir</button>
                          <div className="flex gap-2">
                            <button onClick={(e) => { e.stopPropagation(); setEditingTagId(null) }} className="text-xs text-gray-500 hover:underline">Cancelar</button>
                            <button onClick={async (e) => {
                               e.stopPropagation()
                               if (!editTagText.trim()) return
                               const updatedTag = { ...tag, text: editTagText.trim(), color: editTagColor }
                               useMapStore.getState().setMapTags(useMapStore.getState().mapTags.map(t => t.id === tag.id ? updatedTag : t))
                               setEditingTagId(null)
                               await supabase.from('map_tags').update({ text: updatedTag.text, color: updatedTag.color }).eq('id', tag.id)
                            }} className="text-xs text-blue-500 font-semibold hover:underline">Salvar</button>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={tag.id} className="flex items-center group relative p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          const isActive = nodeTagsIds.includes(tag.id)
                          const newIds = isActive ? nodeTagsIds.filter(id => id !== tag.id) : [...nodeTagsIds, tag.id]
                          updateFormatting({ tags: newIds }) 
                        }}
                        className="flex-1 flex items-center gap-2 text-xs"
                      >
                        <div className={`w-3 h-3 rounded-full flex items-center justify-center`} style={{ backgroundColor: tag.color }}>
                          {isActive && <Check size={8} color="#fff" />}
                        </div>
                        <span className="truncate">{tag.text}</span>
                      </button>
                      <button onClick={(e) => {
                         e.stopPropagation()
                         setEditingTagId(tag.id)
                         setEditTagText(tag.text)
                         setEditTagColor(tag.color)
                      }} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 p-1">
                        <Edit2 size={12} />
                      </button>
                    </div>
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
                        
                        const { data: inserted, error: insertError } = await supabase.from('map_tags').insert({ map_id: mapId, text: newTag.text, color: newTag.color }).select().single()
                        if (insertError) {
                           console.error('Map tag insert error:', insertError)
                           alert('Erro ao criar etiqueta: ' + insertError.message)
                           useMapStore.getState().setMapTags(useMapStore.getState().mapTags.filter(t => t.id !== tempId))
                           updateFormatting({ tags: nodeTagsIds.filter(id => id !== tempId) })
                        } else if (inserted) {
                           useMapStore.getState().setMapTags([...useMapStore.getState().mapTags.filter(t => t.id !== tempId), inserted])
                           updateFormatting({ tags: [...nodeTagsIds.filter(id => id !== tempId), inserted.id] })
                        }
                      }
                    }}
                    className="flex-1 text-xs p-1 border rounded"
                  />
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation()
                      if (newTagText.trim()) {
                        const mapId = data.mapId as string
                        const tempId = generateId()
                        const newTag = { id: tempId, text: newTagText.trim(), color: newTagColor }
                        addMapTag(newTag) // Optimistic
                        updateFormatting({ tags: [...nodeTagsIds, tempId] })
                        setNewTagText('')
                        
                        const { data: inserted, error: insertError } = await supabase.from('map_tags').insert({ map_id: mapId, text: newTag.text, color: newTag.color }).select().single()
                        if (insertError) {
                           console.error('Map tag insert error:', insertError)
                           alert('Erro ao criar etiqueta: ' + insertError.message)
                           useMapStore.getState().setMapTags(useMapStore.getState().mapTags.filter(t => t.id !== tempId))
                           updateFormatting({ tags: nodeTagsIds.filter(id => id !== tempId) })
                        } else if (inserted) {
                           useMapStore.getState().setMapTags([...useMapStore.getState().mapTags.filter(t => t.id !== tempId), inserted])
                           updateFormatting({ tags: [...nodeTagsIds.filter(id => id !== tempId), inserted.id] })
                        }
                      }
                    }}
                    className="bg-blue-500 text-white text-xs px-2 py-1 rounded hover:bg-blue-600"
                  >
                    +
                  </button>
                </div>
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
        style={{
          ...customStyle,
          boxShadow: activeCollaborator ? `0 0 0 3px ${activeCollaborator.color}` : (customStyle as any).boxShadow
        }}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
      >
        {activeCollaborator && (
          <div
            className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-lg z-50 flex items-center gap-1 whitespace-nowrap"
            style={{ backgroundColor: activeCollaborator.color }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            {activeCollaborator.name}
          </div>
        )}
        {!!data.hasChildren && layoutMode === 'orgchart' && (
          <button
            onClick={(e) => { e.stopPropagation(); if (typeof data.onToggleCollapse === 'function') data.onToggleCollapse(id) }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="nodrag nopan absolute bottom-[-24px] left-1/2 -translate-x-1/2 w-[16px] h-[16px] rounded-full flex items-center justify-center z-20 cursor-pointer bg-white dark:bg-gray-800 transition-transform hover:scale-110 shadow-sm border-[2px]"
            style={{ borderColor: branchColor }}
            title={data.collapsed ? "Expandir" : "Recolher"}
          >
            {!!data.collapsed && <div className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: branchColor }} />}
          </button>
        )}
        {!!data.hasChildren && layoutMode === 'list' && (
          <button
            onClick={(e) => { e.stopPropagation(); if (typeof data.onToggleCollapse === 'function') data.onToggleCollapse(id) }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="nodrag nopan absolute bottom-[-24px] left-[12px] w-[16px] h-[16px] rounded-full flex items-center justify-center z-20 cursor-pointer bg-white dark:bg-gray-800 transition-transform hover:scale-110 shadow-sm border-[2px]"
            style={{ borderColor: branchColor }}
            title={data.collapsed ? "Expandir" : "Recolher"}
          >
            {!!data.collapsed && <div className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: branchColor }} />}
          </button>
        )}

        {isRoot && (layoutMode === 'orgchart' || layoutMode === 'list') && (
          <>
            {layoutMode === 'orgchart' && (
               <Handle type="source" position={Position.Bottom} id="bottom" className="opacity-0" style={{ left: '50%', bottom: '0px' }} isConnectable={false} />
            )}
            {layoutMode === 'list' && (
               <Handle type="source" position={Position.Bottom} id="bottom" className="opacity-0" style={{ left: '20px', bottom: '0px' }} isConnectable={false} />
            )}
          </>
        )}

        {!isRoot && (layoutMode === 'orgchart' || layoutMode === 'list') && (
          <>
            <Handle
              type="target"
              id={targetId}
              position={targetPosition}
              className={targetClass}
              style={{ borderColor: branchColor, ...targetStyle }}
            />
            <Handle
              type="source"
              id={sourceId}
              position={sourcePosition}
              className="opacity-0"
              style={sourceStyle}
              isConnectable={false}
            />
          </>
        )}

        {!!data.image_url && (
          <img src={data.image_url as string} alt="Node media" className="max-w-[180px] max-h-[120px] object-contain rounded mb-1 border border-gray-100 dark:border-gray-800 relative z-10" />
        )}

        <div className="flex flex-col w-full relative z-10">
          {/* Main Content Row (Text + Handles aligned to text level) */}
          <div className="relative flex items-center justify-center w-full min-h-[28px]">
            {!isRoot && layoutMode === 'mindmap' && (
              <Handle
                type="target"
                id={targetId}
                position={targetPosition}
                className={targetClass}
                style={{ borderColor: branchColor, ...targetStyle }}
              />
            )}

            {!!data.hasChildren && layoutMode === 'mindmap' && (
              <>
                <div
                  className={`absolute top-1/2 -translate-y-1/2 z-0`}
                  style={{
                    [data.direction === 'left' ? 'left' : 'right']: '-14px',
                    width: '14px',
                    height: '3px',
                    backgroundColor: branchColor
                  }}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); if (typeof data.onToggleCollapse === 'function') data.onToggleCollapse(id) }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="nodrag nopan absolute top-1/2 -translate-y-1/2 w-[16px] h-[16px] rounded-full flex items-center justify-center z-20 cursor-pointer bg-white dark:bg-gray-800 transition-transform hover:scale-110 shadow-sm border-[2px]"
                  style={{
                    [data.direction === 'left' ? 'left' : 'right']: '-22px',
                    borderColor: branchColor
                  }}
                  title={data.collapsed ? "Expandir" : "Recolher"}
                >
                  {!!data.collapsed && <div className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: branchColor }} />}
                </button>
              </>
            )}

            {isRoot && layoutMode === 'mindmap' && (
              <>
                <Handle type="source" position={Position.Right} id="right" className="opacity-0" style={{ right: '0px', top: '50%' }} isConnectable={false} />
                <Handle type="source" position={Position.Left} id="left" className="opacity-0" style={{ left: '0px', top: '50%' }} isConnectable={false} />
              </>
            )}

            {!isRoot && layoutMode === 'mindmap' && (
              <Handle
                type="source"
                id={sourceId}
                position={sourcePosition}
                className="opacity-0"
                style={sourceStyle}
                isConnectable={false}
              />
            )}

            {!!data.icon && <span className="text-lg">{data.icon as string}</span>}

            {isEditing ? (
              <textarea
                ref={inputRef}
                value={text}
                autoFocus
                rows={1}
                onChange={handleTextChange}
                onKeyDown={onKeyDown}
                onBlur={onBlur}
                onMouseDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                className={`nodrag nopan outline-none bg-transparent text-left w-full min-w-[80px] px-2 resize-none overflow-hidden block ${isRoot
                  ? 'text-[42px] font-bold tracking-tight text-slate-800'
                  : 'text-[18px] font-normal'}`}
                style={{ color: customText || 'inherit' }}
              />
            ) : (
              <span className={`select-none text-left px-2 whitespace-pre-wrap break-words ${customText ? '' : 'text-gray-800 dark:text-gray-100'} ${isRoot ? 'font-medium text-xl uppercase' : 'font-normal text-[16px]'}`} style={{ color: customText || 'inherit' }}>
                {text || 'Novo Nó'}
              </span>
            )}

            {!!data.link_url && (
              <a href={data.link_url as string} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline flex items-center justify-center gap-1 mt-1">
                <Link2 size={10} /> Link Externo
              </a>
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
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="nodrag nopan w-5 h-5 bg-[#3b82f6] text-white rounded-full flex items-center justify-center hover:bg-blue-600 shadow-sm cursor-pointer"
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
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="nodrag nopan w-5 h-5 bg-[#3b82f6] text-white rounded-full flex items-center justify-center hover:bg-blue-600 shadow-sm cursor-pointer"
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
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="nodrag nopan w-5 h-5 bg-[#3b82f6] text-white rounded-full flex items-center justify-center hover:bg-blue-600 shadow-sm cursor-pointer"
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
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="nodrag nopan absolute -bottom-[26px] left-1/2 -translate-x-1/2 w-5 h-5 bg-[#3b82f6] text-white rounded-full flex items-center justify-center hover:bg-blue-600 shadow-sm z-10 cursor-pointer"
          >
            <Plus size={14} />
          </button>
        )}
      </div>
    </>
  )
}

export default memo(CustomNode)
