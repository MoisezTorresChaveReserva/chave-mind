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
import { useRealtimeCollab } from '@/hooks/useRealtimeCollab'

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

function Flow({ mapId, initialNodes, initialEdges, initialNodeTags = [], setSaveStatus, isColorful, isOutlined, globalLineColor, layoutMode = 'mindmap', theme, presentationMode, slides, setSlides, currentSlideIndex, isCapturingMode, setIsCapturingMode, updatingSlideId, setUpdatingSlideId, isReadOnly, user, onCollaboratorsChange }: any) {
  const { screenToFlowPosition, getNodes, getEdges, fitBounds, fitView, zoomTo, getIntersectingNodes } = useReactFlow()
  const { x: vpX, y: vpY, zoom: vpZoom } = useViewport()
  
  // Drag to select state
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 })
  const [currentPoint, setCurrentPoint] = useState({ x: 0, y: 0 })
  const [exportingSlide, setExportingSlide] = useState<any>(null)


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

  const isRemoteUpdate = useRef(false)

  // Strip non-serializable data (callbacks, React Flow internals) from nodes before broadcasting
  const serializeForBroadcast = useCallback((currentNodes: Node[], currentEdges: Edge[]) => {
    const cleanNodes = currentNodes.map(n => ({
      id: n.id,
      type: n.type,
      position: { x: n.position.x, y: n.position.y },
      measured: n.measured,
      data: {
        label: n.data.label,
        parent_id: n.data.parent_id,
        collapsed: n.data.collapsed,
        mapId: n.data.mapId,
        direction: n.data.direction,
        bg_color: n.data.bg_color,
        text_color: n.data.text_color,
        image_url: n.data.image_url,
        icon: n.data.icon,
        link_url: n.data.link_url,
        has_text_border: n.data.has_text_border,
        tags: n.data.tags,
      }
    }))
    const cleanEdges = currentEdges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type || 'bezier',
      animated: e.animated,
      style: e.style ? { stroke: e.style.stroke, strokeWidth: e.style.strokeWidth } : undefined
    }))
    return { nodes: cleanNodes, edges: cleanEdges }
  }, [])


  
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

  useEffect(() => {
    const handleExportPresentation = async (e: any) => {
      const { presentation, format } = e.detail
      const slidesList = presentation.slides || []
      
      if (slidesList.length === 0) {
        alert('A apresentação não tem slides.')
        return
      }

      setSaveStatus('saving')
      
      try {
        let pptx: any = null
        let pdf: any = null

        if (format === 'pptx') {
          const pptxgen = (await import('pptxgenjs')).default
          pptx = new pptxgen()
          pptx.layout = 'LAYOUT_16x9'
        } else if (format === 'pdf') {
          const { jsPDF } = await import('jspdf')
          pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1920, 1080] })
        }

        const flowViewport = document.querySelector('.react-flow__viewport') as HTMLElement
        if (!flowViewport) return

        const originalZoom = vpZoom

        for (let i = 0; i < slidesList.length; i++) {
          const slide = slidesList[i]
          
          setExportingSlide(slide)
          fitBounds(slide.bounds, { padding: 0, duration: 0 })
          
          // Wait for DOM to catch up and React state to re-render nodes
          await new Promise(r => setTimeout(r, 1000))

          const dataUrl = await toJpeg(flowViewport, {
            backgroundColor: theme === 'dark' ? '#111827' : '#ffffff',
            quality: 0.9,
            pixelRatio: 1.5,
            width: 1920,
            height: 1080
          })

          if (format === 'pptx') {
            const pptxSlide = pptx.addSlide()
            pptxSlide.addImage({ data: dataUrl, x: 0, y: 0, w: '100%', h: '100%' })
          } else if (format === 'pdf') {
            if (i > 0) pdf.addPage([1920, 1080], 'landscape')
            pdf.addImage(dataUrl, 'JPEG', 0, 0, 1920, 1080)
          }
        }

        setExportingSlide(null)
        zoomTo(originalZoom, { duration: 500 })
        fitView({ duration: 500 })

        if (format === 'pptx') {
          await pptx.writeFile({ fileName: `${presentation.name}.pptx` })
        } else if (format === 'pdf') {
          pdf.save(`${presentation.name}.pdf`)
        }
      } catch (err) {
        console.error('Failed to export presentation', err)
        alert('Erro ao exportar a apresentação.')
        setExportingSlide(null)
      } finally {
        setSaveStatus('saved')
      }
    }

    window.addEventListener('export-presentation', handleExportPresentation)
    return () => window.removeEventListener('export-presentation', handleExportPresentation)
  }, [fitBounds, zoomTo, fitView, theme, vpZoom, setSaveStatus])

  // Unified Layout Engine
  const applyAutoLayout = useCallback((nodesList: Node[], mode: 'mindmap' | 'orgchart' | 'list' = layoutMode) => {
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
    const HORIZONTAL_SPACING = 40

    const getNodeWidth = (nodeId: string) => {
      const node = nodesList.find(n => n.id === nodeId)
      if (node && node.measured?.width && node.measured.width > 0) return node.measured.width
      
      if (!node) return 100
      const label = (node.data.label as string) || ''
      const isRoot = !node.data.parent_id
      const lines = label.split('\n')
      const maxLineLength = Math.max(...lines.map(l => l.length), 1)
      const charWidth = isRoot ? 14 : 10
      return Math.max(80, maxLineLength * charWidth + 40)
    }

    const getNodeHeight = (nodeId: string) => {
      const node = nodesList.find(n => n.id === nodeId)
      if (node && node.measured?.height && node.measured.height > 0) return node.measured.height
      if (!node) return 36
      
      let h = 36
      const label = (node.data.label as string) || ''
      const lineCount = Math.max(1, label.split('\n').length)
      h += (lineCount - 1) * 22
      if (node.data.image_url) h += 130
      if ((node.data.tags as string[])?.length > 0) h += 20
      return h
    }

    const getSubtreeHeight = (nodeId: string): number => {
      const children = childrenMap.get(nodeId) || []
      const nodeHeight = getNodeHeight(nodeId)
      const node = nodesList.find(n => n.id === nodeId)
      if (children.length === 0 || node?.data.collapsed) return nodeHeight
      
      let total = 0
      for (const cid of children) total += getSubtreeHeight(cid)
      total += (children.length - 1) * VERTICAL_SPACING
      return Math.max(total, nodeHeight)
    }

    const getSubtreeWidthOrgchart = (nodeId: string): number => {
      const children = childrenMap.get(nodeId) || []
      const nodeWidth = getNodeWidth(nodeId)
      const node = nodesList.find(n => n.id === nodeId)
      if (children.length === 0 || node?.data.collapsed) return nodeWidth
      
      let total = 0
      for (const cid of children) total += getSubtreeWidthOrgchart(cid)
      total += (children.length - 1) * HORIZONTAL_SPACING
      return Math.max(total, nodeWidth)
    }

    const positions = new Map<string, {x: number, y: number}>()
    const nodeDirections = new Map<string, string>()
    const roots = nodesList.filter(n => !n.data.parent_id || !nodesList.find(x => x.id === n.data.parent_id))

    if (mode === 'mindmap') {
      const assignPositions = (nodeId: string, cx: number, cy: number, direction: 'left' | 'right' = 'right') => {
        const nodeHeight = getNodeHeight(nodeId)
        positions.set(nodeId, { x: cx, y: cy - nodeHeight / 2 })
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
  
      roots.forEach(r => {
        positions.set(r.id, { x: r.position.x, y: r.position.y })
        const children = childrenMap.get(r.id) || []
        
        const totalLeftHeight = children.filter(cid => {
           const node = nodesList.find(n => n.id === cid)
           return node?.data.direction === 'left' || (!node?.data.direction && node && node.position.x < r.position.x)
        }).reduce((sum, cid) => sum + getSubtreeHeight(cid) + VERTICAL_SPACING, 0) - VERTICAL_SPACING
        
        const totalRightHeight = children.filter(cid => {
           const node = nodesList.find(n => n.id === cid)
           const isLeft = node?.data.direction === 'left' || (!node?.data.direction && node && node.position.x < r.position.x)
           return !isLeft
        }).reduce((sum, cid) => sum + getSubtreeHeight(cid) + VERTICAL_SPACING, 0) - VERTICAL_SPACING
  
        const rootHeight = getNodeHeight(r.id)
        let currentLeftY = (r.position.y + rootHeight / 2) - Math.max(0, totalLeftHeight) / 2
        let currentRightY = (r.position.y + rootHeight / 2) - Math.max(0, totalRightHeight) / 2
        
        const rootWidth = getNodeWidth(r.id)
        
        children.forEach(cid => {
          const childNode = nodesList.find(n => n.id === cid)
          const childHeight = getSubtreeHeight(cid)
          const gap = children.length === 1 ? 40 : 100
          
          const isLeft = childNode?.data.direction === 'left' || (!childNode?.data.direction && childNode && childNode.position.x < r.position.x)
          
          if (isLeft) {
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
    } else if (mode === 'orgchart') {
      const assignOrgchartPositions = (nodeId: string, cx: number, cy: number) => {
        const nodeWidth = getNodeWidth(nodeId)
        positions.set(nodeId, { x: cx - nodeWidth / 2, y: cy })
        
        const node = nodesList.find(n => n.id === nodeId)
        if (node?.data.collapsed) return
        
        const children = childrenMap.get(nodeId) || []
        if (children.length === 0) return
        
        const totalWidth = getSubtreeWidthOrgchart(nodeId)
        let currentX = cx - totalWidth / 2
        
        const nodeHeight = getNodeHeight(nodeId)
        const gap = 60
        
        for (const cid of children) {
          const childWidth = getSubtreeWidthOrgchart(cid)
          const childCenterX = currentX + childWidth / 2
          assignOrgchartPositions(cid, childCenterX, cy + nodeHeight + gap)
          currentX += childWidth + HORIZONTAL_SPACING
        }
      }

      roots.forEach(r => {
        assignOrgchartPositions(r.id, r.position.x + getNodeWidth(r.id)/2, r.position.y)
      })
    } else if (mode === 'list') {
      let currentListY = 0
      
      const assignListPositions = (nodeId: string, depth: number, startX: number) => {
        positions.set(nodeId, { x: startX + depth * 40, y: currentListY })
        
        const node = nodesList.find(n => n.id === nodeId)
        currentListY += getNodeHeight(nodeId) + VERTICAL_SPACING
        
        if (node?.data.collapsed) return
        
        const children = childrenMap.get(nodeId) || []
        for (const cid of children) {
          assignListPositions(cid, depth + 1, startX)
        }
      }

      roots.forEach(r => {
        currentListY = r.position.y
        assignListPositions(r.id, 0, r.position.x)
      })
    }

    return nodesList.map(n => {
      const pos = positions.get(n.id)
      const dir = nodeDirections.has(n.id) ? nodeDirections.get(n.id) : (n.data.direction || 'right')
      if (pos) {
        return { ...n, position: { x: pos.x, y: pos.y }, data: { ...n.data, direction: dir } }
      }
      return { ...n, data: { ...n.data, direction: dir } }
    })
  }, [layoutMode])
  const handleRemoteSync = useCallback(({ nodes: remoteNodes, edges: remoteEdges, mapTags: remoteMapTags }: { nodes: Node[]; edges: Edge[]; mapTags?: any[] }) => {
    isRemoteUpdate.current = true
    
    if (remoteMapTags) {
      useMapStore.getState().setMapTags(remoteMapTags)
    }
    
    setNodes((currentNodes) => {
      // Create a map of current node collapsed states to preserve them locally
      const localCollapsedState = new Map(currentNodes.map(n => [n.id, n.data.collapsed]))
      
      const mergedNodes = remoteNodes.map(rn => {
        const localNode = currentNodes.find(n => n.id === rn.id)
        return {
          ...rn,
          measured: rn.measured || localNode?.measured,
          data: {
            ...rn.data,
            // If the node existed locally, keep its local collapsed state instead of the remote one
            collapsed: localCollapsedState.has(rn.id) ? localCollapsedState.get(rn.id) : rn.data.collapsed
          }
        }
      })

      // Recalculate layout based on the local collapsed state to avoid overlaps from remote positions
      if (layoutMode !== 'free') {
        return applyAutoLayout(mergedNodes as Node[], layoutMode)
      }
      return mergedNodes as Node[]
    })

    setEdges(remoteEdges)
    setTimeout(() => {
      isRemoteUpdate.current = false
    }, 500)
  }, [setNodes, setEdges, applyAutoLayout, layoutMode])

  const { collaborators, broadcastSync, updatePresenceState } = useRealtimeCollab({
    mapId,
    user,
    onRemoteSync: handleRemoteSync,
    isReadOnly
  })

  useEffect(() => {
    if (onCollaboratorsChange) {
      onCollaboratorsChange(collaborators)
    }
  }, [collaborators, onCollaboratorsChange])

  // Add reactive subscription to mapTags
  const mapTags = useMapStore(state => state.mapTags)

  // Debounced broadcast - only send after 300ms of no changes, and never during remote updates
  const broadcastTimerRef = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    if (isRemoteUpdate.current || nodes.length === 0) return
    
    if (broadcastTimerRef.current) clearTimeout(broadcastTimerRef.current)
    broadcastTimerRef.current = setTimeout(() => {
      if (!isRemoteUpdate.current) {
        const { nodes: cleanNodes, edges: cleanEdges } = serializeForBroadcast(nodes, edges)
        broadcastSync(cleanNodes as Node[], cleanEdges as Edge[], useMapStore.getState().mapTags)
      }
    }, 300)
    
    return () => {
      if (broadcastTimerRef.current) clearTimeout(broadcastTimerRef.current)
    }
  }, [nodes, edges, broadcastSync, serializeForBroadcast, mapTags])

  // Presentation Player Engine
  useEffect(() => {
    if (presentationMode === 'playing' && slides && slides[currentSlideIndex]) {
      const slide = slides[currentSlideIndex]
      const { x, y, width, height } = slide.bounds
      fitBounds({ x, y, width, height }, { duration: 800, padding: 0.1 })
      
      if (slide.collapsedNodes) {
        const collapsedSet = new Set(slide.collapsedNodes)
        setNodes((nds: Node[]) => applyAutoLayout(nds.map(n => ({
          ...n,
          data: {
            ...n.data,
            collapsed: collapsedSet.has(n.id)
          }
        }))))
      }
    } else if (presentationMode === 'edit') {
      // Return to full view when exiting playing
      fitView({ duration: 800, padding: 0.2 })
    }
  }, [presentationMode, currentSlideIndex, slides, fitBounds, fitView, setNodes, applyAutoLayout])

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
          link_url: n.data.link_url,
          has_text_border: n.data.has_text_border
        })
      }))
      
      const validNodeIds = new Set(dbNodes.map(n => n.id))
      
      const dbEdges = currentEdges
        .filter(e => validNodeIds.has(e.source) && validNodeIds.has(e.target))
        .map(e => ({
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
        const missingTargets = dbEdges.filter(e => !dbNodes.find(n => n.id === e.target)).map(e => e.target)
        const missingSources = dbEdges.filter(e => !dbNodes.find(n => n.id === e.source)).map(e => e.source)
        console.error('Save error nodes:', JSON.stringify(error, null, 2), 'edges:', JSON.stringify(edgesError, null, 2))
        console.error('Missing targets in dbNodes:', missingTargets)
        console.error('Missing sources in dbNodes:', missingSources)
      } else {
        // Sync node_tags
        const nodeIds = dbNodes.map(n => n.id)
        if (nodeIds.length > 0) {
          // Clean existing tags for these nodes
          const { error: deleteError } = await supabase.from('node_tags').delete().in('node_id', nodeIds)
          if (deleteError) {
            console.error('Node tags delete error:', deleteError)
          }
          
          // Insert current tags (filtering only IDs that exist in mapTags to prevent FK violations)
          const validTagIds = new Set(useMapStore.getState().mapTags.map((t: any) => t.id))
          const tagsToInsert: any[] = []
          currentNodes.forEach(n => {
            const tags = Array.from(new Set((n.data.tags as string[]) || []))
            tags.forEach(tId => {
              if (tId && validTagIds.has(tId)) {
                tagsToInsert.push({ node_id: n.id, tag_id: tId })
              }
            })
          })
          
          if (tagsToInsert.length > 0) {
            try {
              const { error: insertError } = await supabase.from('node_tags').insert(tagsToInsert)
              if (insertError) {
                const details = insertError.message || insertError.code || insertError.details || JSON.stringify(insertError, Object.getOwnPropertyNames(insertError))
                console.warn('[NodeTags] Sync insert warning:', details)
              }
            } catch (err: any) {
              console.warn('[NodeTags] Sync insert exception:', err?.message || err)
            }
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
      
      // Capture thumbnail in background idle time without blocking UI editing thread
      if (Date.now() - lastThumbnailCapture.current > 30000) {
        lastThumbnailCapture.current = Date.now()
        const scheduleIdle = typeof window !== 'undefined' && (window as any).requestIdleCallback 
          ? (window as any).requestIdleCallback 
          : (cb: Function) => setTimeout(cb, 1000)

        scheduleIdle(() => {
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
        })
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

  useEffect(() => {
    const handleSetDepthLevel = (e: any) => {
      if (isReadOnly) return
      const level = e.detail.level
      
      const currentNodes = getNodes()
      const currentEdges = getEdges()

      // Calculate depth for each node
      const depthMap = new Map<string, number>()
      
      // Find roots: nodes with no incoming edges
      const incomingEdges = new Map<string, string[]>()
      currentEdges.forEach(edge => {
        if (!incomingEdges.has(edge.target)) incomingEdges.set(edge.target, [])
        incomingEdges.get(edge.target)!.push(edge.source)
      })

      const roots = currentNodes.filter(n => !incomingEdges.has(n.id))
      
      const queue = roots.map(r => ({ id: r.id, depth: 0 }))
      const visited = new Set<string>()

      while(queue.length > 0) {
        const { id, depth } = queue.shift()!
        if (visited.has(id)) continue
        visited.add(id)
        depthMap.set(id, depth)

        const children = currentEdges.filter(e => e.source === id).map(e => e.target)
        children.forEach(c => {
          queue.push({ id: c, depth: depth + 1 })
        })
      }

      // Update nodes
      setNodes((prev: Node[]) => applyAutoLayout(prev.map(n => {
         const nodeDepth = depthMap.has(n.id) ? depthMap.get(n.id)! : 0
         if (level === 5) {
            return { ...n, data: { ...n.data, collapsed: false } }
         } else {
            const shouldCollapse = nodeDepth >= level
            return { ...n, data: { ...n.data, collapsed: shouldCollapse } }
         }
      })))
    }
    
    window.addEventListener('set-depth-level', handleSetDepthLevel)
    return () => window.removeEventListener('set-depth-level', handleSetDepthLevel)
  }, [getNodes, getEdges, setNodes, isReadOnly, applyAutoLayout])

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

    if (parent.data.collapsed && mapId) {
      supabase.from('nodes').update({ collapsed: false }).eq('id', parentId).then()
    }

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
    
    setNodes(nds => applyAutoLayout([
      ...nds.map(n => n.id === parentId 
        ? { ...n, selected: false, data: { ...n.data, collapsed: false } } 
        : { ...n, selected: false }
      ), 
      { ...newNode, selected: true }
    ]))
    setEdges(eds => [...eds, newEdge])
  }, [getNodes, setNodes, setEdges, applyAutoLayout, takeSnapshot, mapId])

  // Re-apply layout when layoutMode changes
  useEffect(() => {
    setNodes(nds => applyAutoLayout(nds, layoutMode))
  }, [layoutMode, applyAutoLayout, setNodes])

  const prevDimensions = useRef<{ [id: string]: { width: number; height: number } }>({})
  const layoutTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-layout on actual text dimension changes without triggering on selection ring changes
  const onNodesChangeWrapper = useCallback((changes: any[]) => {
    onNodesChange(changes)
    
    let hasActualDimensionChange = false
    changes.forEach(c => {
      if (c.type === 'dimensions' && c.dimensions) {
        const prev = prevDimensions.current[c.id]
        // Ignore minor dimension changes (< 8px) caused by selection outlines/rings/shadows
        if (!prev || Math.abs(prev.width - c.dimensions.width) > 8 || Math.abs(prev.height - c.dimensions.height) > 8) {
          prevDimensions.current[c.id] = { width: c.dimensions.width, height: c.dimensions.height }
          hasActualDimensionChange = true
        }
      }
    })

    if (hasActualDimensionChange) {
      if (layoutTimeoutRef.current) clearTimeout(layoutTimeoutRef.current)
      layoutTimeoutRef.current = setTimeout(() => {
        setNodes(nds => applyAutoLayout(nds))
      }, 30)
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
          const isTargetRoot = !targetNode.data.parent_id
          const newDir = isTargetRoot ? (node.position.x < targetNode.position.x ? 'left' : 'right') : (targetNode.data.direction === 'left' ? 'left' : 'right')
          return { ...n, data: { ...n.data, parent_id: targetNode.id, isDropTarget: false, direction: newDir } }
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
      
      const newNodesList = [...allNodes].map(n => {
        if (n.id === node.id && rootNode && n.data.parent_id === rootNode.id) {
           return { ...n, data: { ...n.data, isDropTarget: false, direction: node.position.x < rootNode.position.x ? 'left' : 'right' } }
        }
        return { ...n, data: { ...n.data, isDropTarget: false } }
      })
      const withoutSiblings = newNodesList.filter((n: any) => n.data.parent_id !== parentId)
      const finalNodes = [...withoutSiblings, ...siblings.map(s => newNodesList.find(n => n.id === s.id) || s)]
      
      setNodes(applyAutoLayout(finalNodes as Node[]))
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
      const slide = exportingSlide || (presentationMode === 'playing' ? slides?.[currentSlideIndex] : null)
      const isCollapsed = slide && slide.collapsedNodes ? slide.collapsedNodes.includes(nodeId) : node?.data.collapsed
      
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
        isOutlined,
        layoutMode,
        hasChildren: (childrenMap.get(n.id) || []).length > 0,
        childCount: (childrenMap.get(n.id) || []).length,
        branchColor: globalLineColor || nodeColors.get(n.id) || '#ec4899',
        isRoot: !n.data.parent_id || !nodes.find(x => x.id === n.data.parent_id),
        onChange: onNodeLabelChange,
        onToggleCollapse,
        onAddChild,
        onAddSibling,
        onDelete: onDeleteNode,
        onAI,
        onChangeFormatting,
        theme,
        isReadOnly
      }
    }))

    // 4. Process edges
    let finalEdges = edges.filter(e => e.id !== 'ghost-preview-edge').map(e => {
      const sourceNode = finalNodes.find(n => n.id === e.source)
      const targetNode = finalNodes.find(n => n.id === e.target)
      const color = globalLineColor || (targetNode ? (nodeColors.get(targetNode.id) || '#ec4899') : '#ec4899')
      
      let edgeType = 'bezier'
      let sHandle = 'right'
      let tHandle = 'left'

      if (layoutMode === 'orgchart') {
        edgeType = 'smoothstep'
        sHandle = 'bottom'
        tHandle = 'top'
      } else if (layoutMode === 'list') {
        edgeType = 'step'
        sHandle = 'bottom'
        tHandle = 'left'
      } else {
        const sourceIsLeft = (sourceNode?.data as any)?.direction === 'left'
        const isSourceRoot = !(sourceNode?.data as any)?.parent_id || !finalNodes.find(x => x.id === (sourceNode?.data as any)?.parent_id)
        const targetIsLeft = (targetNode?.data as any)?.direction === 'left'

        if (isSourceRoot) {
          sHandle = targetIsLeft ? 'left' : 'right'
        } else {
          sHandle = sourceIsLeft ? 'left' : 'right'
        }

        tHandle = targetIsLeft ? 'right' : 'left'
      }

      return {
        ...e,
        type: edgeType,
        sourceHandle: sHandle,
        targetHandle: tHandle,
        hidden: !visibleNodeIds.has(e.source) || !visibleNodeIds.has(e.target),
        style: { ...e.style, stroke: color, strokeWidth: layoutMode === 'list' ? 2 : 3 }
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
  }, [nodes, edges, isColorful, isOutlined, globalLineColor, exportingSlide, presentationMode, currentSlideIndex, slides, onNodeLabelChange, onToggleCollapse, onAddChild, onAddSibling, onDeleteNode, onAI, onChangeFormatting, theme, isReadOnly])

  const playingSlide = exportingSlide || (presentationMode === 'playing' && slides ? slides[currentSlideIndex] : null)
  
  const finalDisplayNodes = useMemo(() => {
     if (!playingSlide) return displayNodes;
     return displayNodes.map(n => {
        const b = playingSlide.bounds;
        const x = n.position.x;
        const y = n.position.y;
        const inSlide = x >= b.x - 100 && x <= b.x + b.width + 100 && y >= b.y - 100 && y <= b.y + b.height + 100;
        return {
           ...n,
           style: { ...n.style, opacity: inSlide ? 1 : 0.2, transition: 'opacity 0.5s ease' }
        }
     });
  }, [displayNodes, playingSlide]);

  const finalDisplayEdges = useMemo(() => {
     if (!playingSlide) return displayEdges;
     return displayEdges.map(e => {
        const sourceNode = displayNodes.find(n => n.id === e.source);
        const targetNode = displayNodes.find(n => n.id === e.target);
        if (!sourceNode || !targetNode) return e;
        const b = playingSlide.bounds;
        const inSlide = sourceNode.position.x >= b.x - 100 && sourceNode.position.x <= b.x + b.width + 100 && 
           targetNode.position.x >= b.x - 100 && targetNode.position.x <= b.x + b.width + 100 &&
           sourceNode.position.y >= b.y - 100 && sourceNode.position.y <= b.y + b.height + 100 &&
           targetNode.position.y >= b.y - 100 && targetNode.position.y <= b.y + b.height + 100;
        return {
           ...e,
           style: { ...e.style, opacity: inSlide ? 1 : 0.2, transition: 'opacity 0.5s ease' }
        }
     });
  }, [displayEdges, displayNodes, playingSlide]);

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
          const collapsedNodes = nodes.filter(n => n.data?.collapsed).map(n => n.id)
          setSlides((prev: any) => prev.map((s: any) => s.id === updatingSlideId ? { ...s, bounds, collapsedNodes } : s))
          if (setUpdatingSlideId) setUpdatingSlideId(null)
          if (setIsCapturingMode) setIsCapturingMode(false)
        } else {
          let autoName = ''
          try {
            const intersectedNodes = nodes.filter(n => {
               const nx = n.position.x;
               const ny = n.position.y;
               return nx >= bounds.x && nx <= bounds.x + bounds.width && ny >= bounds.y && ny <= bounds.y + bounds.height;
            })
            if (intersectedNodes && intersectedNodes.length > 0) {
              // Find the top-most or most prominent node. Here we just take the first one that has a label
              const nodeWithLabel = intersectedNodes.find(n => n.data?.label)
              if (nodeWithLabel) {
                // strip html if any
                const tempDiv = document.createElement('div')
                tempDiv.innerHTML = String(nodeWithLabel.data.label)
                autoName = tempDiv.textContent || tempDiv.innerText || ''
              }
            }
          } catch(e) {
            console.error('Failed to auto-name slide', e)
          }

          const collapsedNodes = nodes.filter(n => n.data?.collapsed).map(n => n.id)
          const newSlide = {
            id: generateId(),
            name: autoName.trim() || undefined,
            bounds,
            collapsedNodes
          }
          setSlides((prev: any) => [...prev, newSlide])
          // We DO NOT set isCapturingMode to false here, allowing continuous capture
        }
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
      className="w-full h-full relative overflow-hidden" 
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >

      <ReactFlow
        nodes={finalDisplayNodes}
        edges={finalDisplayEdges}
        onNodesChange={onNodesChangeWrapper}
        onEdgesChange={onEdgesChange}
        onConnect={(params) => { takeSnapshot(); setEdges((eds) => addEdge({ ...params, type: 'bezier' }, eds)) }}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => {
          // Allow React Flow native selection handling
        }}
        onPaneClick={() => {
          setNodes((nds) => nds.map((n) => ({ ...n, selected: false })))
          setEdges((eds) => eds.map((e) => ({ ...e, selected: false })))
        }}
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
        minZoom={0.2}
        maxZoom={4}
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
      {/* Zoom Bar */}
      {presentationMode !== 'playing' && (
        <div className="absolute bottom-6 left-6 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-2 flex items-center gap-3">
           <span className="text-xs font-medium text-gray-500 w-10 text-right">{Math.round(vpZoom * 100)}%</span>
           <input 
              type="range" 
              min={0.2} 
              max={4} 
              step={0.05} 
              value={vpZoom} 
              onChange={(e) => zoomTo(Number(e.target.value))}
              className="w-24 md:w-32 accent-purple-500"
           />
        </div>
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
