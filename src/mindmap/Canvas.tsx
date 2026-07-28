'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  ReactFlowProvider,
  Node,
  Edge,
  useReactFlow,
  useViewport,
  useNodesState,
  useEdgesState,
  addEdge,
  ConnectionMode,
  MarkerType,
  BackgroundVariant
} from '@xyflow/react'
import { toPng, toSvg } from 'html-to-image'
import CustomNode from './CustomNode'
import { supabase } from '@/supabase/client'

const nodeTypes = {
  custom: CustomNode,
}

const BRANCH_COLORS = [
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // yellow
  '#84cc16', // light green
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4'  // cyan
]

const generateId = () => {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)
}

function Flow({ mapId, initialNodes, initialEdges, setSaveStatus, isColorful, theme, presentationMode, slides, setSlides, currentSlideIndex, isCapturingMode, setIsCapturingMode }: any) {
  const { screenToFlowPosition, getNodes, getEdges, fitBounds, fitView, getIntersectingNodes } = useReactFlow()
  const { x: vpX, y: vpY, zoom: vpZoom } = useViewport()
  
  // Drag to select state
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 })
  const [currentPoint, setCurrentPoint] = useState({ x: 0, y: 0 })

  // Presentation Player Engine
  useEffect(() => {
    if (presentationMode === 'playing' && slides && slides[currentSlideIndex]) {
      const { x, y, width, height } = slides[currentSlideIndex].bounds
      fitBounds({ x, y, width, height }, { duration: 800, padding: 0.1 })
    } else if (presentationMode === 'edit') {
      // Return to full view when exiting playing
      fitView({ duration: 800, padding: 0.2 })
    }
  }, [presentationMode, currentSlideIndex, slides, fitBounds, fitView])
  
  // Map our DB types to React Flow types
  const defaultNodes: Node[] = initialNodes.length > 0 ? initialNodes.map((n: any) => {
    let visualData = {}
    if (n.color) {
      try { visualData = JSON.parse(n.color) } 
      catch (e) { visualData = { bg_color: n.color } } // fallback for old data
    }
    return {
      id: n.id,
      type: 'custom',
      position: { x: n.x, y: n.y },
      data: { 
        label: n.text, 
        parent_id: n.parent_id, 
        collapsed: n.collapsed,
        ...visualData
      }
    }
  }) : [{
    id: generateId(),
    type: 'custom',
    position: { x: 250, y: 250 },
    data: { label: 'Raiz do Mapa' }
  }]

  const defaultEdges: Edge[] = initialEdges.map((e: any) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'bezier',
    animated: e.animated,
    style: { stroke: e.color || '#9ca3af', strokeWidth: 2 }
  }))

  const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges)
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // History state for Undo/Redo
  const [past, setPast] = useState<{nodes: Node[], edges: Edge[]}[]>([])
  const [future, setFuture] = useState<{nodes: Node[], edges: Edge[]}[]>([])

  const takeSnapshot = useCallback(() => {
    setPast(p => [...p, { nodes: getNodes(), edges: getEdges() }])
    setFuture([])
  }, [getNodes, getEdges])

  const undo = useCallback(() => {
    setPast(p => {
      if (p.length === 0) return p
      const newPast = [...p]
      const snapshot = newPast.pop()!
      
      setFuture(f => [...f, { nodes: getNodes(), edges: getEdges() }])
      setNodes(snapshot.nodes)
      setEdges(snapshot.edges)
      
      return newPast
    })
  }, [getNodes, getEdges, setNodes, setEdges])

  const redo = useCallback(() => {
    setFuture(f => {
      if (f.length === 0) return f
      const newFuture = [...f]
      const snapshot = newFuture.pop()!
      
      setPast(p => [...p, { nodes: getNodes(), edges: getEdges() }])
      setNodes(snapshot.nodes)
      setEdges(snapshot.edges)
      
      return newFuture
    })
  }, [getNodes, getEdges, setNodes, setEdges])

  useEffect(() => {
    const downloadDataUrl = (dataUrl: string, filename: string) => {
      const a = document.createElement('a')
      a.setAttribute('download', filename)
      a.setAttribute('href', dataUrl)
      a.click()
    }

    const handleExport = async (e: any) => {
      const format = e.detail.format
      
      if (format === 'json') {
        const data = { nodes: getNodes(), edges: getEdges() }
        const jsonStr = JSON.stringify(data, null, 2)
        const dataUrl = `data:text/json;charset=utf-8,${encodeURIComponent(jsonStr)}`
        downloadDataUrl(dataUrl, `mindmap-${mapId}.json`)
        return
      }

      const flowViewport = document.querySelector('.react-flow__viewport') as HTMLElement
      if (!flowViewport) return
      
      try {
        if (format === 'png') {
          const dataUrl = await toPng(flowViewport, { backgroundColor: theme === 'dark' ? '#111827' : '#ffffff' })
          downloadDataUrl(dataUrl, `mindmap-${mapId}.png`)
        } else if (format === 'svg') {
          const dataUrl = await toSvg(flowViewport, { backgroundColor: theme === 'dark' ? '#111827' : '#ffffff' })
          downloadDataUrl(dataUrl, `mindmap-${mapId}.svg`)
        }
      } catch (err) {
        console.error('Failed to export map', err)
      }
    }

    window.addEventListener('export-map', handleExport)
    return () => window.removeEventListener('export-map', handleExport)
  }, [getNodes, getEdges, mapId, theme])

  // Symmetric Tree Auto-Layout
  const applyAutoLayout = useCallback((nodesList: Node[]) => {
    const childrenMap = new Map<string, string[]>()
    nodesList.forEach(n => {
      const pid = n.data.parent_id
      if (pid) {
        if (!childrenMap.has(pid as string)) childrenMap.set(pid as string, [])
        childrenMap.get(pid as string)!.push(n.id)
      }
    })

    const NODE_HEIGHT = 40
    const VERTICAL_SPACING = 20

    const estimateNodeWidth = (nodeId: string) => {
      const node = nodesList.find(n => n.id === nodeId)
      if (!node) return 100
      const label = (node.data.label as string) || ''
      const isRoot = !node.data.parent_id
      // Base width for character
      const charWidth = isRoot ? 12 : 9
      // Padding and toggle button space
      return Math.max(60, label.length * charWidth + 50)
    }

    const getSubtreeHeight = (nodeId: string): number => {
      const children = childrenMap.get(nodeId) || []
      const node = nodesList.find(n => n.id === nodeId)
      if (children.length === 0 || node?.data.collapsed) return NODE_HEIGHT
      
      let total = 0
      for (const cid of children) total += getSubtreeHeight(cid)
      total += (children.length - 1) * VERTICAL_SPACING
      return total
    }

    const positions = new Map<string, {x: number, y: number}>()

    const assignPositions = (nodeId: string, cx: number, cy: number) => {
      positions.set(nodeId, { x: cx, y: cy })
      
      const node = nodesList.find(n => n.id === nodeId)
      if (node?.data.collapsed) return 

      const children = childrenMap.get(nodeId) || []
      if (children.length === 0) return
      
      const totalHeight = getSubtreeHeight(nodeId)
      let currentY = cy - totalHeight / 2
      
      const nodeWidth = estimateNodeWidth(nodeId)
      
      for (const cid of children) {
        const childHeight = getSubtreeHeight(cid)
        const childCenterY = currentY + childHeight / 2
        // Dynamic X placement: Right edge of parent + fixed gap of 60px
        assignPositions(cid, cx + nodeWidth + 60, childCenterY)
        currentY += childHeight + VERTICAL_SPACING
      }
    }

    const roots = nodesList.filter(n => !n.data.parent_id || !nodesList.find(x => x.id === n.data.parent_id))
    roots.forEach(r => assignPositions(r.id, r.position.x, r.position.y))

    return nodesList.map(n => {
      const pos = positions.get(n.id)
      if (pos) {
        return { ...n, position: { x: pos.x, y: pos.y } }
      }
      return n
    })
  }, [])

  // Auto-save logic
  const saveToDb = useCallback(async (currentNodes: Node[], currentEdges: Edge[]) => {
    setSaveStatus('saving')
    
    // We only save to DB if mapId exists
    if (!mapId) return
    
    try {
      const dbNodes = currentNodes.map(n => ({
        id: n.id,
        map_id: mapId,
        text: n.data.label as string,
        x: n.position.x,
        y: n.position.y,
        parent_id: n.data.parent_id || null,
        collapsed: n.data.collapsed as boolean || false,
        color: JSON.stringify({
          bg_color: n.data.bg_color,
          text_color: n.data.text_color,
          image_url: n.data.image_url,
          icon: n.data.icon,
          link_url: n.data.link_url
        })
      }))
      
      const dbEdges = currentEdges.map(e => ({
        id: e.id,
        map_id: mapId,
        source: e.source,
        target: e.target,
      }))
      
      await supabase.from('nodes').upsert(dbNodes)
      await supabase.from('edges').upsert(dbEdges)
      
      // Sync deletions (orphans)
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
    } catch (e) {
      console.error(e)
      setSaveStatus('error')
    }
  }, [mapId, setSaveStatus])

  useEffect(() => {
    // Debounce saves
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      saveToDb(nodes, edges)
    }, 2000)
    
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [nodes, edges, saveToDb])

  // Callbacks for Node Label updates
  const onNodeLabelChange = useCallback((id: string, newLabel: string) => {
    takeSnapshot()
    setNodes((nds) => applyAutoLayout(
      nds.map((n) => {
        if (n.id === id) {
          return { ...n, data: { ...n.data, label: newLabel } }
        }
        return n
      })
    ))
  }, [setNodes, takeSnapshot, applyAutoLayout])

  // Toggle collapse
  const onToggleCollapse = useCallback((id: string) => {
    takeSnapshot()
    setNodes(nds => applyAutoLayout(nds.map(n => {
      if (n.id === id) {
        const isCollapsed = !n.data.collapsed
        if (mapId) supabase.from('nodes').update({ collapsed: isCollapsed }).eq('id', id).then()
        return { ...n, data: { ...n.data, collapsed: isCollapsed } }
      }
      return n
    })))
  }, [setNodes, mapId, applyAutoLayout, takeSnapshot])

  const onAddChild = useCallback((parentId: string) => {
    takeSnapshot()
    const parent = getNodes().find(n => n.id === parentId)
    if (!parent) return

    const newNodeId = generateId()
    const newNode: Node = {
      id: newNodeId,
      type: 'custom',
      position: { x: 0, y: 0 },
      data: { label: 'Novo Nó', parent_id: parentId }
    }
    const newEdge: Edge = {
      id: generateId(),
      source: parentId,
      target: newNodeId,
      type: 'bezier',
      style: { stroke: '#ec4899', strokeWidth: 3 }
    }
    
    setNodes(nds => applyAutoLayout([...nds.map(n => ({...n, selected: false})), {...newNode, selected: true}]))
    setEdges(eds => [...eds, newEdge])
  }, [getNodes, setNodes, setEdges, applyAutoLayout, takeSnapshot])

  const onAddSibling = useCallback((nodeId: string) => {
    takeSnapshot()
    const node = getNodes().find(n => n.id === nodeId)
    if (!node || !node.data.parent_id) return

    const newNodeId = generateId()
    const newNode: Node = {
      id: newNodeId,
      type: 'custom',
      position: { x: 0, y: 0 },
      data: { label: 'Novo Nó', parent_id: node.data.parent_id }
    }
    
    setNodes(nds => applyAutoLayout([...nds.map(n => ({...n, selected: false})), {...newNode, selected: true}]))
    
    if (node.data.parent_id) {
       const newEdge: Edge = {
        id: generateId(),
        source: node.data.parent_id as string,
        target: newNodeId,
        type: 'bezier',
        style: { stroke: '#ec4899', strokeWidth: 3 }
      }
      setEdges(eds => [...eds, newEdge])
    }
  }, [getNodes, setNodes, setEdges, applyAutoLayout, takeSnapshot])

  const onDeleteNode = useCallback((nodeId: string) => {
    const targetNode = getNodes().find(n => n.id === nodeId)
    // Prevent deletion of root node
    if (!targetNode || !targetNode.data.parent_id) return

    takeSnapshot()
    const allNodes = getNodes()
    const nodesToDelete = new Set([nodeId])
    
    let changed = true
    while (changed) {
      changed = false
      allNodes.forEach(n => {
        if (n.data.parent_id && nodesToDelete.has(n.data.parent_id as string) && !nodesToDelete.has(n.id)) {
          nodesToDelete.add(n.id)
          changed = true
        }
      })
    }

    const edgesToDelete = getEdges().filter(edge => 
      edge.selected || nodesToDelete.has(edge.source) || nodesToDelete.has(edge.target)
    )

    setNodes(nds => applyAutoLayout(nds.filter(n => !nodesToDelete.has(n.id))))
    setEdges(eds => eds.filter(e => !edgesToDelete.includes(e)))
  }, [getNodes, getEdges, setNodes, setEdges, applyAutoLayout, takeSnapshot])

  const onAI = useCallback((parentId: string) => {
    takeSnapshot()
    const newNodes: Node[] = []
    const newEdges: Edge[] = []
    const ideas = ['Nova Ideia 1', 'Nova Ideia 2', 'Nova Ideia 3']
    
    ideas.forEach(label => {
      const id = generateId()
      newNodes.push({ id, type: 'custom', position: {x:0, y:0}, data: { label, parent_id: parentId } })
      newEdges.push({ id: generateId(), source: parentId, target: id, type: 'bezier' })
    })
    
    setNodes(nds => applyAutoLayout([...nds.map(n => ({...n, selected: false})), ...newNodes]))
    setEdges(eds => [...eds, ...newEdges])
  }, [setNodes, setEdges, applyAutoLayout, takeSnapshot])

  // Drag and Drop Logic
  const onNodeDrag = useCallback((event: any, node: Node) => {
    // Cannot drag root node
    if (!node.data.parent_id) return
    const intersections = getIntersectingNodes(node)
    
    setNodes(nds => nds.map(n => {
      const isTarget = intersections.length > 0 && n.id === intersections[0].id
      
      // Cycle detection: is `n` a descendant of `node`?
      let isDescendant = false
      let current = n
      while (current && current.data.parent_id) {
        if (current.data.parent_id === node.id) { isDescendant = true; break }
        current = nds.find(x => x.id === current.data.parent_id) as Node
      }

      return {
        ...n,
        data: {
          ...n.data,
          isDropTarget: isTarget && !isDescendant && n.id !== node.id
        }
      }
    }))
  }, [getIntersectingNodes, setNodes])

  const onNodeDragStop = useCallback((event: any, node: Node) => {
    if (!node.data.parent_id) {
      setNodes(nds => applyAutoLayout(nds)) // Snap back root
      return
    }

    takeSnapshot()
    const allNodes = getNodes()
    const targetNode = allNodes.find(n => n.data.isDropTarget)

    if (targetNode) {
      // Reparenting
      setNodes(nds => applyAutoLayout(nds.map(n => {
        if (n.id === node.id) {
          return { ...n, data: { ...n.data, parent_id: targetNode.id, isDropTarget: false } }
        }
        return { ...n, data: { ...n.data, isDropTarget: false } }
      })))

      setEdges(eds => {
        const filtered = eds.filter(e => e.target !== node.id)
        return [...filtered, {
          id: generateId(),
          source: targetNode.id,
          target: node.id,
          type: 'bezier',
          style: { stroke: '#ec4899', strokeWidth: 3 }
        }]
      })
    } else {
      // Reordering siblings based on dropped Y coordinate
      const parentId = node.data.parent_id
      const siblings = allNodes.filter(n => n.data.parent_id === parentId)
      
      // Sort siblings by Y
      siblings.sort((a, b) => a.position.y - b.position.y)
      
      const newNodesList = [...allNodes].map(n => ({ ...n, data: { ...n.data, isDropTarget: false } }))
      const withoutSiblings = newNodesList.filter((n: any) => n.data.parent_id !== parentId)
      const finalNodes = [...withoutSiblings, ...siblings]
      
      setNodes(applyAutoLayout(finalNodes))
    }
  }, [getNodes, getEdges, setNodes, setEdges, applyAutoLayout, takeSnapshot])

  // Function to handle formatting changes (colors, media)
  const onChangeFormatting = useCallback((id: string, updates: any) => {
    takeSnapshot()
    setNodes((nds) => nds.map((n) => {
      if (n.id === id) {
        return { ...n, data: { ...n.data, ...updates } }
      }
      return n
    }))
  }, [setNodes, takeSnapshot])

  // Wrap nodeTypes to inject callbacks
  const memoizedNodeTypes = useMemo(() => {
    return {
      custom: (props: any) => <CustomNode {...props} data={{...props.data, onChange: onNodeLabelChange, onToggleCollapse, onAddChild, onAddSibling, onDelete: onDeleteNode, onAI, onChangeFormatting, isColorful, theme}} />
    }
  }, [onNodeLabelChange, onToggleCollapse, onAddChild, onAddSibling, onDeleteNode, onAI, onChangeFormatting, isColorful, theme])

  // Keyboard bindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return
      
      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        redo()
        return
      }
      
      const selectedNodes = getNodes().filter(n => n.selected)
      
      // Cascade Delete
      if (selectedNodes.length > 0 && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault()
        const targetNode = selectedNodes[0]
        
        // Prevent deletion of root node
        if (!targetNode.data.parent_id) return
        
        onDeleteNode(targetNode.id)
        return
      }

      if (selectedNodes.length === 1) {
        const selected = selectedNodes[0]
        
        if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
          e.preventDefault()
          onAddChild(selected.id)
        } 
        else if (e.key === 'Enter' && e.shiftKey) {
          e.preventDefault()
          onAddSibling(selected.id)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [getNodes, getEdges, setNodes, setEdges, applyAutoLayout, takeSnapshot, undo, redo, onDeleteNode])

  // Combine real nodes/edges and handle visibility
  const { displayNodes, displayEdges } = useMemo(() => {
    // 1. Build children map
    const childrenMap = new Map<string, string[]>()
    nodes.forEach(n => {
      const parentId = n.data.parent_id
      if (parentId) {
        if (!childrenMap.has(parentId as string)) childrenMap.set(parentId as string, [])
        childrenMap.get(parentId as string)!.push(n.id)
      }
    })

    // Sort children by Y position for consistent branch coloring
    childrenMap.forEach(children => {
      children.sort((a, b) => {
        const nodeA = nodes.find(n => n.id === a)
        const nodeB = nodes.find(n => n.id === b)
        return (nodeA?.position.y || 0) - (nodeB?.position.y || 0)
      })
    })

    const nodeColors = new Map<string, string>()
    const roots = nodes.filter(n => !n.data.parent_id || !nodes.find(x => x.id === n.data.parent_id))
    
    roots.forEach(r => {
      nodeColors.set(r.id, '#1f2937') // Root color
      const children = childrenMap.get(r.id) || []
      children.forEach((childId, index) => {
        const color = BRANCH_COLORS[index % BRANCH_COLORS.length]
        
        const assignColor = (id: string) => {
          nodeColors.set(id, color)
          const kids = childrenMap.get(id) || []
          kids.forEach(assignColor)
        }
        assignColor(childId)
      })
    })

    // 2. Traverse to find visible nodes
    const visibleNodeIds = new Set<string>()
    
    const traverse = (nodeId: string, isVisible: boolean) => {
      if (isVisible) visibleNodeIds.add(nodeId)
      
      const node = nodes.find(n => n.id === nodeId)
      const isCollapsed = node?.data.collapsed
      
      const children = childrenMap.get(nodeId) || []
      children.forEach(childId => {
        traverse(childId, isVisible && !isCollapsed)
      })
    }
    roots.forEach(r => traverse(r.id, true))

    // 3. Process nodes
    let finalNodes = nodes.filter(n => n.id !== 'ghost-preview-node').map(n => ({
      ...n,
      hidden: !visibleNodeIds.has(n.id),
      data: {
        ...n.data,
        isColorful,
        hasChildren: (childrenMap.get(n.id) || []).length > 0,
        branchColor: nodeColors.get(n.id) || '#ec4899',
        isRoot: !n.data.parent_id || !nodes.find(x => x.id === n.data.parent_id)
      }
    }))

    // 4. Process edges
    let finalEdges = edges.filter(e => e.id !== 'ghost-preview-edge').map(e => {
      const targetNode = nodes.find(n => n.id === e.target)
      const color = targetNode ? (nodeColors.get(targetNode.id) || '#ec4899') : '#ec4899'
      return {
        ...e,
        hidden: !visibleNodeIds.has(e.source) || !visibleNodeIds.has(e.target),
        style: { ...e.style, stroke: color, strokeWidth: 3 }
      }
    })

    // 5. Inject Drag Preview Ghost Node
    const dropTarget = nodes.find(n => n.data.isDropTarget)
    if (dropTarget) {
      const children = childrenMap.get(dropTarget.id) || []
      let ghostY = dropTarget.position.y
      if (children.length > 0) {
        const lastChild = nodes.find(n => n.id === children[children.length - 1])
        if (lastChild) ghostY = lastChild.position.y + 60 // ~NODE_HEIGHT + VERTICAL_SPACING
      }
      
      const ghostNodeId = 'ghost-preview-node'
      const color = nodeColors.get(dropTarget.id) || '#e5e7eb'
      
      finalNodes.push({
        id: ghostNodeId,
        type: 'custom',
        position: { x: dropTarget.position.x + 160, y: ghostY },
        data: {
          label: '',
          isGhost: true,
          parent_id: dropTarget.id,
          branchColor: color,
          isRoot: false,
          hasChildren: false
        },
        hidden: false
      } as any)
      
      finalEdges.push({
        id: 'ghost-preview-edge',
        source: dropTarget.id,
        target: ghostNodeId,
        type: 'bezier',
        hidden: false,
        animated: false,
        style: { stroke: '#e5e7eb', strokeWidth: 3 }
      })
    }

    return { displayNodes: finalNodes, displayEdges: finalEdges }
  }, [nodes, edges])

  // Mouse Handlers for Drag-to-Select Slide Capture
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only capture if we are in capturing mode
    if (presentationMode !== 'presentation_setup' || !isCapturingMode) return
    
    // Convert screen coordinates to flow coordinates for the selection start
    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    setStartPoint(flowPos)
    setCurrentPoint(flowPos)
    setIsDrawing(true)
    e.preventDefault()
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return
    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    setCurrentPoint(flowPos)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawing) return
    setIsDrawing(false)

    const width = Math.abs(currentPoint.x - startPoint.x)
    const height = Math.abs(currentPoint.y - startPoint.y)
    
    // Only save if it's a decent size box
    if (width > 50 && height > 50) {
      const newSlide = {
        id: generateId(),
        bounds: {
          x: Math.min(startPoint.x, currentPoint.x),
          y: Math.min(startPoint.y, currentPoint.y),
          width,
          height
        }
      }
      if (setSlides) {
        setSlides((prev: any) => [...prev, newSlide])
      }
      if (setIsCapturingMode) {
        setIsCapturingMode(false)
      }
    }
  }

  // Calculate drawing box for rendering
  const drawBox = isDrawing ? {
    left: Math.min(startPoint.x, currentPoint.x),
    top: Math.min(startPoint.y, currentPoint.y),
    width: Math.abs(currentPoint.x - startPoint.x),
    height: Math.abs(currentPoint.y - startPoint.y)
  } : null

  return (
    <div 
      className="w-full h-full relative" 
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onConnect={(params) => { takeSnapshot(); setEdges((eds) => addEdge({ ...params, type: 'bezier' }, eds)) }}
        nodeTypes={memoizedNodeTypes}
        connectionMode={ConnectionMode.Loose}
        nodesDraggable={!isCapturingMode}
        panOnDrag={!isCapturingMode}
        zoomOnDoubleClick={false}
        snapToGrid={false}
        snapGrid={[20, 20]}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
        colorMode={theme === 'dark' ? 'dark' : 'light'}
      >
      <Background 
        variant={BackgroundVariant.Lines}
        color={theme === 'dark' ? '#1f2937' : '#e5e7eb'} 
        gap={24} 
        lineWidth={1} 
      />
      
      {/* Slide Bounds Overlay (Show slides in setup mode) */}
      {presentationMode === 'presentation_setup' && slides && slides.map((slide: any, index: number) => (
        <div
          key={slide.id}
          className="absolute border-2 border-purple-500 bg-purple-500/10 pointer-events-none flex items-start justify-start p-2 z-10"
          style={{
            transform: `translate(${slide.bounds.x * vpZoom + vpX}px, ${slide.bounds.y * vpZoom + vpY}px) scale(${vpZoom})`,
            transformOrigin: '0 0',
            width: `${slide.bounds.width}px`,
            height: `${slide.bounds.height}px`,
          }}
        >
          <span className="bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm" style={{ transform: `scale(${1/vpZoom})`, transformOrigin: 'top left' }}>Slide {index + 1}</span>
        </div>
      ))}

      {/* Current Drawing Box */}
      {isDrawing && drawBox && (
        <div
          className="absolute border-2 border-purple-400 border-dashed bg-purple-400/20 pointer-events-none z-50"
          style={{
            transform: `translate(${drawBox.left * vpZoom + vpX}px, ${drawBox.top * vpZoom + vpY}px) scale(${vpZoom})`,
            transformOrigin: '0 0',
            width: `${drawBox.width}px`,
            height: `${drawBox.height}px`,
          }}
        />
      )}
    </ReactFlow>
    </div>
  )
}

export default function Canvas(props: any) {
  return (
    <ReactFlowProvider>
      <Flow {...props} />
    </ReactFlowProvider>
  )
}
