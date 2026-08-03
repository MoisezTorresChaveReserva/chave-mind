import React, { useState, useRef, useEffect } from 'react'
import { Handle, Position, NodeProps, useUpdateNodeInternals } from '@xyflow/react'
import { Type, Trash2, Palette } from 'lucide-react'

const THEME_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899', '#ffffff', '#1f2937', 'transparent']

export default function FlowchartNode({ data, selected, id }: NodeProps) {
  const [isEditing, setIsEditing] = useState(!!data.isNew)
  const [text, setText] = useState(data.label as string || '')
  const [showToolbar, setShowToolbar] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  
  const updateNodeInternals = useUpdateNodeInternals()
  const shape = (data.shape as string) || 'rectangle'
  const bgColor = (data.bg_color as string) || '#ffffff'
  const textColor = (data.text_color as string) || '#1f2937'
  const isReadOnly = data.isReadOnly as boolean

  useEffect(() => {
    updateNodeInternals(id)
  }, [shape, id, updateNodeInternals])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.select()
          inputRef.current.style.height = 'auto'
          inputRef.current.style.height = `${inputRef.current.scrollHeight}px`
        }
      }, 50)
    }
  }, [isEditing])

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`
    }
  }

  useEffect(() => {
    if (!showToolbar) return
    const handleOutsideClick = () => setShowToolbar(false)
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [showToolbar])

  const onDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isReadOnly) setIsEditing(true)
  }

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isReadOnly) setShowToolbar(prev => !prev)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      setIsEditing(false)
      if (text.trim() === '') {
        if (typeof data.onDelete === 'function') data.onDelete(id)
      } else {
        if (typeof data.onChange === 'function') data.onChange(id, text)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsEditing(false)
      if (text.trim() === '') {
        if (typeof data.onDelete === 'function') data.onDelete(id)
      } else {
        if (typeof data.onChange === 'function') data.onChange(id, text)
      }
    }
  }

  const onBlur = () => {
    setIsEditing(false)
    if (text.trim() === '') {
      if (typeof data.onDelete === 'function') data.onDelete(id)
    } else {
      if (typeof data.onChange === 'function') data.onChange(id, text)
    }
  }

  const getShapeClasses = () => {
    switch(shape) {
      case 'diamond': return 'rotate-45 w-24 h-24 flex items-center justify-center'
      case 'circle': return 'rounded-full w-24 h-24 flex items-center justify-center'
      case 'pill': return 'rounded-full px-6 py-3 min-w-[120px] flex items-center justify-center'
      case 'parallelogram': return '-skew-x-12 px-6 py-3 min-w-[120px] flex items-center justify-center'
      case 'cylinder': return 'rounded-t-full rounded-b-full px-6 py-4 min-w-[100px] flex items-center justify-center border-t-8 border-black/10'
      case 'text': return 'px-2 py-1 min-w-[80px] min-h-[30px] flex items-center justify-center bg-transparent'
      case 'rectangle':
      default: return 'rounded-md px-4 py-3 min-w-[120px] min-h-[50px] flex items-center justify-center'
    }
  }

  const activeCollaborator = (data.collaborators as any[])?.find((c: any) => c.activeNodeId === id)
  const innerContentClass = shape === 'diamond' ? '-rotate-45' : shape === 'parallelogram' ? 'skew-x-12' : ''
  const isText = shape === 'text'
  const borderAndShadow = isText 
    ? `border-none bg-transparent shadow-none ${selected ? 'ring-2 ring-blue-500 ring-offset-4 rounded' : ''}` 
    : `border border-gray-300 transition-all ${selected ? 'ring-2 ring-blue-500 ring-offset-4 shadow-lg scale-[1.02]' : 'shadow-sm hover:shadow-md'}`

  return (
    <div 
      className="relative group flex items-center justify-center"
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
      <div 
        className={`${getShapeClasses()} ${borderAndShadow}`}
        style={{
          backgroundColor: isText ? 'transparent' : bgColor,
          color: textColor,
          boxShadow: activeCollaborator ? `0 0 0 3px ${activeCollaborator.color}` : undefined
        }}
      >
        <div className={`w-full flex items-center justify-center text-center ${innerContentClass}`}>
          {isEditing ? (
            <textarea
              ref={inputRef}
              value={text}
              rows={1}
              onChange={handleTextChange}
              onKeyDown={onKeyDown}
              onBlur={onBlur}
              className="nodrag nopan bg-transparent outline-none text-center w-full min-w-[80px] resize-none overflow-hidden block"
              style={{ color: textColor }}
            />
          ) : (
            <span className="select-none font-medium text-sm break-words whitespace-pre-wrap max-w-[150px]">
              {text || 'Processo'}
            </span>
          )}
        </div>
      </div>

      {/* Handles */}
      {!isReadOnly && (
        <>
          <Handle type="source" position={Position.Top} id="top" className="!opacity-0 group-hover:!opacity-100 transition-opacity duration-150" style={{ width: 10, height: 10, background: '#3b82f6', border: '2px solid white', zIndex: 50 }} isConnectable={true} />
          <Handle type="source" position={Position.Right} id="right" className="!opacity-0 group-hover:!opacity-100 transition-opacity duration-150" style={{ width: 10, height: 10, background: '#3b82f6', border: '2px solid white', zIndex: 50 }} isConnectable={true} />
          <Handle type="source" position={Position.Bottom} id="bottom" className="!opacity-0 group-hover:!opacity-100 transition-opacity duration-150" style={{ width: 10, height: 10, background: '#3b82f6', border: '2px solid white', zIndex: 50 }} isConnectable={true} />
          <Handle type="source" position={Position.Left} id="left" className="!opacity-0 group-hover:!opacity-100 transition-opacity duration-150" style={{ width: 10, height: 10, background: '#3b82f6', border: '2px solid white', zIndex: 50 }} isConnectable={true} />
        </>
      )}

      {/* Toolbar */}
      {showToolbar && !isReadOnly && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-lg border border-gray-200 p-1 flex gap-1 z-50 after:content-[''] after:absolute after:top-full after:left-0 after:right-0 after:h-4 after:bg-transparent">
          <button onClick={(e) => { e.stopPropagation(); setIsEditing(true) }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="Editar"><Type size={14} /></button>
          <div className="relative group/color">
            <button className="p-1.5 text-pink-500 hover:bg-pink-50 rounded" title="Cor"><Palette size={14} /></button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 bg-white border border-gray-200 rounded-lg shadow-xl p-2 hidden group-hover/color:flex flex-wrap gap-1">
               {THEME_COLORS.map(c => (
                  <button key={c} onClick={(e) => { e.stopPropagation(); if(typeof data.onChangeFormatting === 'function') data.onChangeFormatting(id, { bg_color: c === 'transparent' ? '#ffffff' : c, text_color: c === 'transparent' ? '#1f2937' : '#ffffff' }) }} className="w-4 h-4 rounded-full border border-gray-300 shadow-sm" style={{ backgroundColor: c === 'transparent' ? '#f3f4f6' : c }} />
               ))}
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); if (typeof data.onDelete === 'function') data.onDelete(id) }} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Excluir"><Trash2 size={14} /></button>
        </div>
      )}
    </div>
  )
}
