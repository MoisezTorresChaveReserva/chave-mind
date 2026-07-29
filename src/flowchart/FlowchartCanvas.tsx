import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
  addEdge,
  ConnectionMode,
  MarkerType,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import FlowchartNode from './FlowchartNode'
import { MapNode, MapEdge } from '@/types'
import { useMapStore } from '@/store/mapStore'
import { supabase } from '@/supabase/client'
import { Save, MousePointer2, Square, Circle, Triangle, Database, Hexagon, Component, Type } from 'lucide-react'

const generateId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)

type FlowchartCanvasProps = {
  mapId: string
  initialNodes: MapNode[]
  initialEdges: MapEdge[]
  initialNodeTags?: any[]
  setSaveStatus: (status: 'saved' | 'saving' | 'error') => void
  theme: 'light' | 'dark'
  isReadOnly?: boolean
}

function FlowchartCanvasInner({
  mapId,
  initialNodes,
  initialEdges,
  setSaveStatus,
  theme,
  isReadOnly = false
}: FlowchartCanvasProps) {
  const { screenToFlowPosition } = useReactFlow()
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  
  // Transform initial DB nodes to React Flow nodes
  useEffect(() => {
    const formattedNodes = initialNodes.map(n => {
      let data = { label: n.text, ...JSON.parse(n.color || '{}') }
      return {
        id: n.id,
        type: 'flowchart',
        position: { x: n.x, y: n.y },
        data: { ...data, isReadOnly, onDelete: handleDeleteNode, onChange: handleNodeChange, onChangeFormatting: handleChangeFormatting }
      }
    })
    setNodes(formattedNodes)

    const formattedEdges = initialEdges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.label?.split('__')[0] || 'bottom',
      targetHandle: e.label?.split('__')[1] || 'top',
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: e.color || '#94a3b8' },
      style: { stroke: e.color || '#94a3b8', strokeWidth: 2 }
    }))
    setEdges(formattedEdges)
  }, [initialNodes, initialEdges, isReadOnly])

  // Keyboard deletion shortcut for selected nodes & edges
  useEffect(() => {
    if (isReadOnly) return
    const handleKeyDown = (e: KeyboardEvent) => {
      // If typing in input fields, do not trigger deletion
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedNodes = nodes.filter(n => n.selected)
        const selectedEdges = edges.filter(ed => ed.selected)

        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          e.preventDefault()
          
          if (selectedNodes.length > 0) {
            setNodes(nds => nds.filter(n => !n.selected))
            // Also cleanup connected edges
            const selectedIds = new Set(selectedNodes.map(n => n.id))
            setEdges(eds => eds.filter(e => !selectedIds.has(e.source) && !selectedIds.has(e.target)))
          }

          if (selectedEdges.length > 0) {
            setEdges(eds => eds.filter(ed => !ed.selected))
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [nodes, edges, isReadOnly])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds))
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds))
  }, [])

  const onConnect = useCallback((params: Connection) => {
    if (isReadOnly) return
    const newEdge: Edge = {
      ...params,
      id: generateId(),
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
      style: { stroke: '#94a3b8', strokeWidth: 2 }
    }
    setEdges((eds) => addEdge(newEdge, eds))
  }, [isReadOnly])

  const handleDeleteNode = useCallback((id: string) => {
    if (isReadOnly) return
    setNodes(nds => nds.filter(n => n.id !== id))
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id))
  }, [isReadOnly])

  const handleNodeChange = useCallback((id: string, text: string) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, label: text } } : n))
  }, [])

  const handleChangeFormatting = useCallback((id: string, format: any) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...format } } : n))
  }, [])

  const onDragStart = (event: React.DragEvent, nodeType: string, shape: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.setData('application/shape', shape)
    event.dataTransfer.effectAllowed = 'move'
  }

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      if (isReadOnly) return

      const type = event.dataTransfer.getData('application/reactflow')
      const shape = event.dataTransfer.getData('application/shape')
      if (typeof type === 'undefined' || !type) return

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const newNode = {
        id: generateId(),
        type,
        position,
        data: { 
          label: 'Novo ' + shape, 
          shape, 
          isNew: true,
          onDelete: handleDeleteNode, 
          onChange: handleNodeChange, 
          onChangeFormatting: handleChangeFormatting,
          isReadOnly
        },
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [isReadOnly, handleDeleteNode, handleNodeChange, handleChangeFormatting, screenToFlowPosition]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const nodeTypes = useMemo(() => ({ flowchart: FlowchartNode }), [])

  // Auto-save logic
  useEffect(() => {
    if (isReadOnly) return
    const saveTimeout = setTimeout(() => {
      saveToDb(nodes, edges)
    }, 1500)
    return () => clearTimeout(saveTimeout)
  }, [nodes, edges, isReadOnly])

  const saveToDb = async (currentNodes: Node[], currentEdges: Edge[]) => {
    if (isReadOnly || !mapId || currentNodes.length === 0) return
    setSaveStatus('saving')
    
    try {
      const dbNodes = currentNodes.map((n, index) => ({
        id: n.id,
        map_id: mapId,
        text: n.data.label as string,
        x: n.position.x,
        y: n.position.y,
        order: index,
        color: JSON.stringify({
          shape: n.data.shape,
          bg_color: n.data.bg_color,
          text_color: n.data.text_color
        })
      }))
      
      const dbEdges = currentEdges.map(e => ({
        id: e.id,
        map_id: mapId,
        source: e.source,
        target: e.target,
        color: e.style?.stroke || '#94a3b8',
        label: `${e.sourceHandle}__${e.targetHandle}` // Hack to store handles
      }))
      
      await supabase.from('nodes').upsert(dbNodes)
      if (dbEdges.length > 0) {
        await supabase.from('edges').upsert(dbEdges)
      }

      // Cleanup
      const { data: existingNodes } = await supabase.from('nodes').select('id').eq('map_id', mapId)
      const { data: existingEdges } = await supabase.from('edges').select('id').eq('map_id', mapId)

      if (existingNodes) {
        const currentNodesIds = new Set(dbNodes.map(n => n.id))
        const orphanNodeIds = existingNodes.filter(n => !currentNodesIds.has(n.id)).map(n => n.id)
        if (orphanNodeIds.length > 0) await supabase.from('nodes').delete().in('id', orphanNodeIds)
      }

      if (existingEdges) {
        const currentEdgesIds = new Set(dbEdges.map(e => e.id))
        const orphanEdgeIds = existingEdges.filter(e => !currentEdgesIds.has(e.id)).map(e => e.id)
        if (orphanEdgeIds.length > 0) await supabase.from('edges').delete().in('id', orphanEdgeIds)
      }
      
      setSaveStatus('saved')
    } catch (error) {
      console.error(error)
      setSaveStatus('error')
    }
  }

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault()
    if (isReadOnly) return
    setEdges((eds) => eds.filter((e) => e.id !== edge.id))
  }, [isReadOnly])

  return (
    <div className="flex w-full h-full relative" ref={reactFlowWrapper}>
      {/* Sidebar specific for Flowchart shapes */}
      {!isReadOnly && (
        <div className="absolute left-4 top-4 bottom-4 w-16 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col items-center py-4 gap-4 z-50">
          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center cursor-move hover:scale-110 transition-transform" onDragStart={(e) => onDragStart(e, 'flowchart', 'rectangle')} draggable title="Processo (Retângulo)">
             <Square size={20} />
          </div>
          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center cursor-move hover:scale-110 transition-transform" onDragStart={(e) => onDragStart(e, 'flowchart', 'diamond')} draggable title="Decisão (Losango)">
             <Square size={20} className="rotate-45 scale-75" />
          </div>
          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center cursor-move hover:scale-110 transition-transform" onDragStart={(e) => onDragStart(e, 'flowchart', 'circle')} draggable title="Início/Fim (Círculo)">
             <Circle size={20} />
          </div>
          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center cursor-move hover:scale-110 transition-transform" onDragStart={(e) => onDragStart(e, 'flowchart', 'pill')} draggable title="Terminador (Pílula)">
             <div className="w-6 h-4 border-2 border-current rounded-full" />
          </div>
          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center cursor-move hover:scale-110 transition-transform" onDragStart={(e) => onDragStart(e, 'flowchart', 'parallelogram')} draggable title="Dados (Paralelogramo)">
             <div className="w-5 h-4 border-2 border-current -skew-x-12" />
          </div>
          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center cursor-move hover:scale-110 transition-transform" onDragStart={(e) => onDragStart(e, 'flowchart', 'text')} draggable title="Texto Avulso">
             <Type size={20} />
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onEdgeContextMenu={onEdgeContextMenu}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        className="bg-gray-50 dark:bg-[#0f172a]"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={2} color={theme === 'dark' ? '#334155' : '#cbd5e1'} />
        <Controls className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700 !rounded-xl !shadow-lg" />
      </ReactFlow>
    </div>
  )
}

export default function FlowchartCanvas(props: FlowchartCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowchartCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
