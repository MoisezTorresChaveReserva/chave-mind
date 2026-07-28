import React, { memo, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react'
import { Plus, Wand2, Type, Trash2, Palette, Image as ImageIcon, Link, Link2, Smile, X } from 'lucide-react'

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
  const [isEditing, setIsEditing] = useState(false)
  const [text, setText] = useState(data.label as string || '')
  const [activeMenu, setActiveMenu] = useState<'none' | 'color' | 'image' | 'link' | 'icon'>('none')
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null)
  const [tempUrl, setTempUrl] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { setNodes, setEdges } = useReactFlow()

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null)
      setActiveMenu('none')
    }
    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [])
  
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
      inputRef.current.focus()
      inputRef.current.select()
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
      if (typeof data.onChange === 'function') {
        data.onChange(id, text)
      }
    }
  }

  const onBlur = () => {
    setIsEditing(false)
    if (typeof data.onChange === 'function' && text !== data.label) {
      data.onChange(id, text)
    }
  }

  const handleAddChild = () => {
    if (typeof data.onAddChild === 'function') data.onAddChild(id)
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
                <button onClick={() => setActiveMenu('none')}><X size={14}/></button>
              </div>
              <div className="text-[10px] uppercase font-bold text-gray-400">Fundo</div>
              <div className="flex flex-wrap gap-1">
                {THEME_COLORS.map(c => (
                  <button key={'bg-'+c} onClick={() => updateFormatting({bg_color: c === 'transparent' ? null : c})} className="w-5 h-5 rounded-full border border-gray-300 shadow-sm" style={{backgroundColor: c === 'transparent' ? '#f3f4f6' : c}} />
                ))}
              </div>
              <div className="text-[10px] uppercase font-bold text-gray-400 mt-1">Texto</div>
              <div className="flex flex-wrap gap-1">
                {THEME_COLORS.map(c => (
                  <button key={'tx-'+c} onClick={() => updateFormatting({text_color: c === 'transparent' ? null : c})} className="w-5 h-5 rounded-full border border-gray-300 shadow-sm" style={{backgroundColor: c === 'transparent' ? '#f3f4f6' : c}} />
                ))}
              </div>
            </div>
          )}

          {activeMenu === 'image' && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-3 flex flex-col gap-2 w-48">
               <div className="text-xs font-semibold text-gray-500 flex justify-between">
                <span>URL da Imagem</span>
                <button onClick={() => setActiveMenu('none')}><X size={14}/></button>
              </div>
              <input 
                type="text" 
                placeholder="https://..." 
                value={tempUrl} 
                onChange={e => setTempUrl(e.target.value)}
                className="w-full text-xs p-1 border rounded"
                onKeyDown={(e) => {
                  if(e.key === 'Enter') {
                    updateFormatting({image_url: tempUrl})
                    setActiveMenu('none')
                    setTempUrl('')
                  }
                }}
              />
              <button onClick={() => { updateFormatting({image_url: tempUrl}); setActiveMenu('none'); setTempUrl('') }} className="text-xs bg-blue-500 text-white rounded py-1">Aplicar</button>
              <button onClick={() => { updateFormatting({image_url: null}); setActiveMenu('none') }} className="text-xs text-red-500 py-1">Remover</button>
            </div>
          )}

          {activeMenu === 'link' && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-3 flex flex-col gap-2 w-48">
               <div className="text-xs font-semibold text-gray-500 flex justify-between">
                <span>Link URL</span>
                <button onClick={() => setActiveMenu('none')}><X size={14}/></button>
              </div>
              <input 
                type="text" 
                placeholder="https://..." 
                value={tempUrl} 
                onChange={e => setTempUrl(e.target.value)}
                className="w-full text-xs p-1 border rounded"
                onKeyDown={(e) => {
                  if(e.key === 'Enter') {
                    updateFormatting({link_url: tempUrl})
                    setActiveMenu('none')
                    setTempUrl('')
                  }
                }}
              />
              <button onClick={() => { updateFormatting({link_url: tempUrl}); setActiveMenu('none'); setTempUrl('') }} className="text-xs bg-blue-500 text-white rounded py-1">Aplicar</button>
              <button onClick={() => { updateFormatting({link_url: null}); setActiveMenu('none') }} className="text-xs text-red-500 py-1">Remover</button>
            </div>
          )}

          {activeMenu === 'icon' && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-3 flex flex-col gap-2 w-48">
               <div className="text-xs font-semibold text-gray-500 flex justify-between">
                <span>Ícone (Emoji)</span>
                <button onClick={() => setActiveMenu('none')}><X size={14}/></button>
              </div>
              <div className="flex flex-wrap gap-2 text-lg">
                {['🚀', '💡', '🔥', '✅', '⭐', '❤️', '🎯', '💰', '📊', '🌐', '📌', '⚠️'].map(emoji => (
                  <button key={emoji} onClick={() => { updateFormatting({icon: emoji}); setActiveMenu('none') }} className="hover:scale-125 transition-transform">{emoji}</button>
                ))}
              </div>
              <button onClick={() => { updateFormatting({icon: null}); setActiveMenu('none') }} className="text-xs text-red-500 py-1 mt-1">Remover</button>
            </div>
          )}

          <div className="flex gap-1 bg-[var(--node-bg)] border border-[var(--border)] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] p-1.5">
            <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'color' ? 'none' : 'color') }} className="p-1.5 text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/30 rounded-md transition-colors" title="Cores"><Palette size={16} /></button>
            <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'image' ? 'none' : 'image'); setTempUrl(data.image_url as string || '') }} className="p-1.5 text-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-md transition-colors" title="Imagem"><ImageIcon size={16} /></button>
            <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'link' ? 'none' : 'link'); setTempUrl(data.link_url as string || '') }} className="p-1.5 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-md transition-colors" title="Link"><Link size={16} /></button>
            <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'icon' ? 'none' : 'icon') }} className="p-1.5 text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-md transition-colors" title="Ícone"><Smile size={16} /></button>
            <div className="w-[1px] bg-gray-200 dark:bg-gray-700 mx-1"></div>
            <button onClick={(e) => { e.stopPropagation(); if(typeof data.onAI === 'function') data.onAI(id) }} className="p-1.5 text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-md transition-colors" title="Gerar Ideias (AI)"><Wand2 size={16} /></button>
            <button onClick={(e) => { e.stopPropagation(); setIsEditing(true) }} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors" title="Editar Texto"><Type size={16} /></button>
            {!isRoot && (
              <button onClick={(e) => { e.stopPropagation(); if(typeof data.onDelete === 'function') data.onDelete(id) }} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors" title="Excluir (Delete)"><Trash2 size={16} /></button>
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
        {!isRoot && (
          <Handle 
            type="target" 
            position={Position.Left} 
            className="opacity-0 !-ml-[7px]" 
            style={{ borderColor: branchColor }} 
          />
        )}
        
        {!!data.image_url && (
          <img src={data.image_url as string} alt="Node media" className="max-w-[120px] max-h-[80px] object-contain rounded mb-1 border border-gray-100 dark:border-gray-800" />
        )}

        <div className="flex items-center gap-1.5">
          {!!data.icon && <span className="text-lg">{data.icon as string}</span>}
          
          {isEditing ? (
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={onBlur}
              onMouseDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              className={`nodrag nopan outline-none bg-transparent text-left w-full min-w-[80px] ${isRoot ? 'font-medium text-xl uppercase' : 'font-normal text-[16px]'}`}
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

        {/* Toggle Collapse Button */}
        {!!data.hasChildren && (
          <button 
            onClick={(e) => { e.stopPropagation(); if(typeof data.onToggleCollapse === 'function') data.onToggleCollapse(id) }}
            className="absolute top-1/2 -translate-y-1/2 w-[16px] h-[16px] rounded-full flex items-center justify-center z-20 cursor-pointer bg-white dark:bg-gray-800 transition-transform hover:scale-110 shadow-sm border-[2px]"
            style={{ right: '-16px', borderColor: branchColor }}
            title={data.collapsed ? "Expandir" : "Recolher"}
          >
            {!!data.collapsed && <div className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: branchColor }} />}
          </button>
        )}

        <Handle 
          type="source" 
          position={Position.Right} 
          className="opacity-0" 
          style={{ right: data.hasChildren ? '-8px' : '0px' }} 
          isConnectable={false} 
        />

        {/* Add Child Button */}
        {selected && !isReadOnly && (
          <div className="absolute -right-10 top-1/2 -translate-y-1/2 flex items-center z-20">
            <button 
              onClick={(e) => { e.stopPropagation(); handleAddChild() }}
              className="w-5 h-5 bg-[#3b82f6] text-white rounded-full flex items-center justify-center hover:bg-blue-600 shadow-sm"
            >
              <Plus size={14} />
            </button>
            <div className="hidden md:flex flex-col gap-1.5 absolute left-8 w-[200px] pointer-events-none">
              <div className="flex items-center gap-2 text-[11px] text-gray-400 font-medium">
                <span className="border border-[var(--border)] rounded px-1.5 py-0.5 text-gray-500 bg-[var(--node-bg)]">Tab</span> para criar tópico filho
              </div>
              <div className="flex items-center gap-2 text-[11px] text-gray-400 font-medium">
                <span className="border border-[var(--border)] rounded px-1.5 py-0.5 text-gray-500 bg-[var(--node-bg)]">Enter</span> para criar tópico irmão
              </div>
            </div>
          </div>
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
