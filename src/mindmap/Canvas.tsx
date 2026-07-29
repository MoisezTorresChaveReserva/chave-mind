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
import { toJpeg, toPng, toSvg } from 'html-to-image'
import CustomNode from './CustomNode'
import { supabase } from '@/supabase/client'
import { useMapStore } from '@/store/mapStore'
import { useHistoryStore } from '@/store/historyStore'

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

function Flow({ mapId, initialNodes, initialEdges, initialNodeTags = [], setSaveStatus, isColorful, theme, presentationMode, slides, setSlides, currentSlideIndex, isCapturingMode, setIsCapturingMode, updatingSlideId, setUpdatingSlideId, isReadOnly }: any) {
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
    // Find tags for this node
    const nodeTagsIds = initialNodeTags.filter((nt: any) => nt.node_id === n.id).map((nt: any) => nt.tag_id)

    return {
      id: n.id,
      type: 'custom',
      position: { x: n.x, y: n.y },
      data: { 
        label: n.text, 
        parent_id: n.parent_id, 
        collapsed: n.collapsed,
        mapId: mapId,
        isReadOnly: isReadOnly,
        tags: nodeTagsIds,
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
    style: { stroke: e.color || '#ec4899', strokeWidth: 3 }
  }))

  // Auto-heal missing edges based on parent_id
  defaultNodes.forEach(node => {
    if (node.data.parent_id) {
      const edgeExists = defaultEdges.some(e => e.target === node.id)
      if (!edgeExists) {
        defaultEdges.push({
          id: generateId(),
          source: node.data.parent_id as string,
          target: node.id,
          type: 'bezier',
          style: { stroke: '#ec4899', strokeWidth: 3 }
        })
      }
    }
  })

  const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges)
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const lastThumbnailCapture = useRef(0)

  const { takeSnapshot: storeTakeSnapshot, undo: storeUndo, redo: storeRedo } = useHistoryStore()

  const takeSnapshot = useCallback(() => {
    storeTakeSnapshot(getNodes(), getEdges())
  }, [getNodes, getEdges, storeTakeSnapshot])

  const undo = useCallback(() => {
    const prevState = storeUndo(getNodes(), getEdges())
    if (prevState) {
      setNodes(prevState.nodes)
      setEdges(prevState.edges)
    }
  }, [getNodes, getEdges, setNodes, setEdges, storeUndo])

  const redo = useCallback(() => {
    const nextState = storeRedo(getNodes(), getEdges())
    if (nextState) {
      setNodes(nextState.nodes)
      setEdges(nextState.edges)
    }
  }, [getNodes, getEdges, setNodes, setEdges, storeRedo])

  useEffect(() => {
    const handleUndoAction = () => undo()
    const handleRedoAction = () => redo()
    window.addEventListener('undo-action', handleUndoAction)
    window.addEventListener('redo-action', handleRedoAction)
    return () => {
      window.removeEventListener('undo-action', handleUndoAction)
      window.removeEventListener('redo-action', handleRedoAction)
    }
  }, [undo, redo])

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

    const getNodeWidth = (nodeId: string) => {
      const node = nodesList.find(n => n.id === nodeId)
      if (node && node.measured?.width) return node.measured.width
      
      if (!node) return 100
      const label = (node.data.label as string) || ''
      const isRoot = !node.data.parent_id
      // Base width for character (fallback)
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
    const nodeDirections = new Map<string, 'left' | 'right'>()

    const assignPositions = (nodeId: string, cx: number, cy: number, direction: 'left' | 'right' = 'right') => {
      positions.set(nodeId, { x: cx, y: cy })
      nodeDirections.set(nodeId, direction)
      
      const node = nodesList.find(n => n.id === nodeId)
      if (node?.data.collapsed) return 

      const children = childrenMap.get(nodeId) || []
      if (children.length === 0) return
      
      const totalHeight = getSubtreeHeight(nodeId)
      let currentY = cy - totalHeight / 2
      
      const nodeWidth = getNodeWidth(nodeId)
      const gap = children.length === 1 ? 40 : 100
      
      for (const cid of children) {
        const childHeight = getSubtreeHeight(cid)
        const childCenterY = currentY + childHeight / 2
        
        const childNodeWidth = getNodeWidth(cid)
        const newX = direction === 'left' ? cx - childNodeWidth - gap : cx + nodeWidth + gap
        
        assignPositions(cid, newX, childCenterY, direction)
        currentY += childHeight + VERTICAL_SPACING
      }
    }

    const roots = nodesList.filter(n => !n.data.parent_id || !nodesList.find(x => x.id === n.data.parent_id))
    
    roots.forEach(r => {
      positions.set(r.id, { x: r.position.x, y: r.position.y })
      const children = childrenMap.get(r.id) || []
      
      const totalLeftHeight = children.filter(cid => {
         const node = nodesList.find(n => n.id === cid)
         return node && node.position.x < r.position.x
      }).reduce((sum, cid) => sum + getSubtreeHeight(cid) + VERTICAL_SPACING, 0) - VERTICAL_SPACING
      
      const totalRightHeight = children.filter(cid => {
         const node = nodesList.find(n => n.id === cid)
         return !node || node.position.x >= r.position.x
      }).reduce((sum, cid) => sum + getSubtreeHeight(cid) + VERTICAL_SPACING, 0) - VERTICAL_SPACING

      let currentLeftY = r.position.y - Math.max(0, totalLeftHeight) / 2
      let currentRightY = r.position.y - Math.max(0, totalRightHeight) / 2
      
      const rootWidth = getNodeWidth(r.id)
      
      children.forEach(cid => {
        const childNode = nodesList.find(n => n.id === cid)
        const childHeight = getSubtreeHeight(cid)
        const gap = children.length === 1 ? 40 : 100
        
        if (childNode && childNode.position.x < r.position.x) {
          const childCenterY = currentLeftY + childHeight / 2
          const childNodeWidth = getNodeWidth(cid)
          assignPositions(cid, r.position.x - childNodeWidth - gap, childCenterY, 'left')
          currentLeftY += childHeight + VERTICAL_SPACING
        } else {
          const childCenterY = currentRightY + childHeight / 2
          assignPositions(cid, r.position.x + rootWidth + gap, childCenterY, 'right')
          currentRightY += childHeight + VERTICAL_SPACING
        }
      })
    })

    return nodesList.map(n => {
      const pos = positions.get(n.id)
      const dir = nodeDirections.get(n.id) || 'right'
      if (pos) {
        return { ...n, position: { x: pos.x, y: pos.y }, data: { ...n.data, direction: dir } }
      }
      return { ...n, data: { ...n.data, direction: dir } }
    })
  }, [])

  // Auto-save logic
  const saveToDb = useCallback(async (currentNodes: Node[], currentEdges: Edge[]) => {
    if (isReadOnly) return
    setSaveStatus('saving')
    
    // We only save to DB if mapId exists
    if (!mapId) return
    
    try {
      const dbNodes = currentNodes.map((n, index) => ({
        id: n.id,
        map_id: mapId,
        text: n.data.label as string,
        x: n.position.x,
        y: n.position.y,
        parent_id: n.data.parent_id || null,
        collapsed: n.data.collapsed as boolean || false,
        order: index,
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
        color: e.style?.stroke || '#ec4899'
      }))
      
      let error = null
      let edgesError = null
      
      if (dbNodes.length > 0) {
        const res = await supabase.from('nodes').upsert(dbNodes)
        error = res.error
      }
      
      if (dbEdges.length > 0) {
        const res = await supabase.from('edges').upsert(dbEdges)
        edgesError = res.error
      }

      if (error || edgesError) {
        setSaveStatus('error')
        console.error('Save error nodes:', JSON.stringify(error, null, 2), 'edges:', JSON.stringify(edgesError, null, 2))
      } else {
        // Sync node_tags
        const nodeIds = dbNodes.map(n => n.id)
        if (nodeIds.length > 0) {
          // Clean existing tags for these nodes
          await supabase.from('node_tags').delete().in('node_id', nodeIds)
          
          // Insert current tags
          const tagsToInsert: any[] = []
          currentNodes.forEach(n => {
            const tags = (n.data.tags as string[]) || []
            tags.forEach(tId => {
              tagsToInsert.push({ node_id: n.id, tag_id: tId })
            })
          })
          
          if (tagsToInsert.length > 0) {
            await supabase.from('node_tags').insert(tagsToInsert)
          }
        }
        
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
      }
      
      // Capture thumbnail if it has been more than 10 seconds since last capture
      if (Date.now() - lastThumbnailCapture.current > 10000) {
        lastThumbnailCapture.current = Date.now()
        const flowViewport = document.querySelector('.react-flow__viewport') as HTMLElement
        if (flowViewport) {
          toJpeg(flowViewport, { 
            backgroundColor: theme === 'dark' ? '#111827' : '#ffffff',
            quality: 0.1,
            pixelRatio: 0.5
          }).then(dataUrl => {
            const { mapTags } = useMapStore.getState()
            supabase.from('mind_maps').update({ 
              thumbnail: JSON.stringify({ slides: slides || [], preview: dataUrl, mapTags }) 
            }).eq('id', mapId).then()
          }).catch(console.error)
        }
      }

      setSaveStatus('saved')
    } catch (e) {
      console.error(e)
      setSaveStatus('error')
    }
  }, [mapId, setSaveStatus, slides, theme, isReadOnly])

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

  useEffect(() => {
    const handleForceSave = () => saveToDb(getNodes(), getEdges())
    window.addEventListener('force-save', handleForceSave)
    window.addEventListener('beforeunload', handleForceSave)
    return () => {
      window.removeEventListener('force-save', handleForceSave)
      window.removeEventListener('beforeunload', handleForceSave)
    }
  }, [saveToDb, getNodes, getEdges])

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

  const lastRootChildDirection = useRef<'left' | 'right'>('right')

  const onAddChild = useCallback((parentId: string, direction?: 'left' | 'right') => {
    takeSnapshot()
    const parent = getNodes().find(n => n.id === parentId)
    if (!parent) return

    let spawnX = parent.position.x
    const isRoot = !parent.data.parent_id
    if (isRoot) {
        const finalDirection = direction || lastRootChildDirection.current
        lastRootChildDirection.current = finalDirection
        spawnX = finalDirection === 'left' ? parent.position.x - 200 : parent.position.x + 200
    } else {
        const parentDirection = parent.data.direction === 'left' ? 'left' : 'right'
        spawnX = parentDirection === 'left' ? parent.position.x - 200 : parent.position.x + 200
    }

    const newNodeId = generateId()
    const newNode: Node = {
      id: newNodeId,
      type: 'custom',
      position: { x: spawnX, y: parent.position.y },
      data: { label: '', parent_id: parentId, isNew: true }
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

  // Auto-layout on dimension changes (e.g. text edit)
  const onNodesChangeWrapper = useCallback((changes: any[]) => {
    onNodesChange(changes)
    
    if (changes.some(c => c.type === 'dimensions')) {
      // Small delay to let React Flow apply dimensions first
      setTimeout(() => {
        setNodes(nds => applyAutoLayout(nds))
      }, 10)
    }
  }, [onNodesChange, setNodes, applyAutoLayout])

  const onAddSibling = useCallback((nodeId: string) => {
    takeSnapshot()
    const node = getNodes().find(n => n.id === nodeId)
    if (!node || !node.data.parent_id) return

    const newNodeId = generateId()
    const newNode: Node = {
      id: newNodeId,
      type: 'custom',
      position: { x: node.position.x, y: node.position.y },
      data: { label: '', parent_id: node.data.parent_id, isNew: true }
    }
    setNodes(nds => {
      const nodeIndex = nds.findIndex(n => n.id === nodeId)
      const newNds = nds.map(n => ({...n, selected: false}))
      const finalNewNode = {...newNode, selected: true}
      
      if (nodeIndex !== -1) {
        newNds.splice(nodeIndex + 1, 0, finalNewNode)
      } else {
        newNds.push(finalNewNode)
      }
      return applyAutoLayout(newNds)
    })
    
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
    
    // Find a target where the center of the dragged node is inside the target
    const cx = ((node as any).computed?.positionAbsolute?.x || (node as any).positionAbsolute?.x || node.position.x) + (node.measured?.width || 100) / 2
    const cy = ((node as any).computed?.positionAbsolute?.y || (node as any).positionAbsolute?.y || node.position.y) + (node.measured?.height || 40) / 2

    const validTarget = intersections.find(n => {
      const nx = (n as any).computed?.positionAbsolute?.x || (n as any).positionAbsolute?.x || n.position.x
      const ny = (n as any).computed?.positionAbsolute?.y || (n as any).positionAbsolute?.y || n.position.y
      const nw = n.measured?.width || 100
      const nh = n.measured?.height || 40
      return cx >= nx && cx <= nx + nw && cy >= ny && cy <= ny + nh
    })
    
    setNodes(nds => {
      let newNodes = nds.map(n => {
        const isTarget = validTarget && n.id === validTarget.id
        
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
      })

      // Dynamic Reordering Preview
      if (!validTarget) {
        const parentId = node.data.parent_id
        const siblings = newNodes.filter(n => (n as any).data.parent_id === parentId)
        
        // Temporarily override the dragged node's Y for sorting purposes
        const draggedIndex = siblings.findIndex(s => s.id === node.id)
        if (draggedIndex !== -1) {
          siblings[draggedIndex] = { ...siblings[draggedIndex], position: node.position }
        }

        siblings.sort((a, b) => a.position.y - b.position.y)
        
        const withoutSiblings = newNodes.filter(n => (n as any).data.parent_id !== parentId)
        const orderedList = [...withoutSiblings, ...siblings]
        
        const layouted = applyAutoLayout(orderedList)
        
        return layouted.map(n => {
          if (n.id === node.id) {
            return { ...n, position: node.position } // Keep cursor position for the dragged node
          }
          return n
        })
      }

      return newNodes
    })
  }, [getIntersectingNodes, setNodes, applyAutoLayout])

  const onNodeDragStart = useCallback((_: React.MouseEvent, node: Node) => {
    takeSnapshot()
  }, [takeSnapshot])

  const onNodeDragStop = useCallback((event: any, node: Node) => {
    if (!node.data.parent_id) {
      setNodes(nds => applyAutoLayout(nds)) // Snap back root
      return
    }

    takeSnapshot()
    const allNodes = getNodes()
    
    const rootNode = allNodes.find(n => !n.data.parent_id)
    if (rootNode && node.data.parent_id === rootNode.id) {
       lastRootChildDirection.current = node.position.x < rootNode.position.x ? 'left' : 'right'
    }
    
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
      custom: (props: any) => <CustomNode {...props} data={{...props.data, onChange: onNodeLabelChange, onToggleCollapse, onAddChild, onAddSibling, onDelete: onDeleteNode, onAI, onChangeFormatting, isColorful, theme, isReadOnly}} />
    }
  }, [onNodeLabelChange, onToggleCollapse, onAddChild, onAddSibling, onDeleteNode, onAI, onChangeFormatting, isColorful, theme, isReadOnly])

  // Keyboard bindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isReadOnly) return
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
        
        if (e.key === 'Tab') {
          e.preventDefault()
          onAddChild(selected.id)
        } 
        else if (e.key === 'Enter') {
          e.preventDefault()
          onAddSibling(selected.id)
        }
      }
      
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        if (e.shiftKey) {
          e.preventDefault()
          redo()
        } else {
          e.preventDefault()
          undo()
        }
        return
      }
      if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        redo()
        return
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
        childCount: (childrenMap.get(n.id) || []).length,
        branchColor: nodeColors.get(n.id) || '#ec4899',
        isRoot: !n.data.parent_id || !nodes.find(x => x.id === n.data.parent_id)
      }
    }))

    // 4. Process edges
    let finalEdges = edges.filter(e => e.id !== 'ghost-preview-edge').map(e => {
      const targetNode = finalNodes.find(n => n.id === e.target)
      const color = targetNode ? (nodeColors.get(targetNode.id) || '#ec4899') : '#ec4899'
      const isLeft = (targetNode?.data as any)?.direction === 'left'
      return {
        ...e,
        sourceHandle: isLeft ? 'left' : 'right',
        targetHandle: isLeft ? 'right' : 'left',
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
      } as any)
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
      const bounds = {
        x: Math.min(startPoint.x, currentPoint.x),
        y: Math.min(startPoint.y, currentPoint.y),
        width,
        height
      }
      
      if (setSlides) {
        if (updatingSlideId) {
          setSlides((prev: any) => prev.map((s: any) => s.id === updatingSlideId ? { ...s, bounds } : s))
          if (setUpdatingSlideId) setUpdatingSlideId(null)
        } else {
          const newSlide = {
            id: generateId(),
            bounds
          }
          setSlides((prev: any) => [...prev, newSlide])
        }
      }
      if (setIsCapturingMode) {
        setIsCapturingMode(false)
      }
    } else {
       // If box is too small, just cancel the mode
       if (setIsCapturingMode) setIsCapturingMode(false)
       if (setUpdatingSlideId) setUpdatingSlideId(null)
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
        onNodesChange={onNodesChangeWrapper}
        onEdgesChange={onEdgesChange}
        onConnect={(params) => { takeSnapshot(); setEdges((eds) => addEdge({ ...params, type: 'bezier' }, eds)) }}
        nodeTypes={memoizedNodeTypes}
        onNodeDrag={isReadOnly ? undefined : onNodeDrag}
        onNodeDragStop={isReadOnly ? undefined : onNodeDragStop}
        nodesDraggable={!isReadOnly}
        nodesConnectable={!isReadOnly}
        elementsSelectable={true}
        connectionMode={ConnectionMode.Loose}
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
