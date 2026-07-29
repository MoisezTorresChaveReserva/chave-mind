import { create } from 'zustand'
import { Node, Edge } from '@xyflow/react'

interface HistoryState {
  past: { nodes: Node[], edges: Edge[] }[]
  future: { nodes: Node[], edges: Edge[] }[]
  takeSnapshot: (nodes: Node[], edges: Edge[]) => void
  undo: (currentNodes: Node[], currentEdges: Edge[]) => { nodes: Node[], edges: Edge[] } | null
  redo: (currentNodes: Node[], currentEdges: Edge[]) => { nodes: Node[], edges: Edge[] } | null
  clear: () => void
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  takeSnapshot: (nodes, edges) => {
    // Save a deep clone to avoid reference mutations
    const snapshotNodes = JSON.parse(JSON.stringify(nodes))
    const snapshotEdges = JSON.parse(JSON.stringify(edges))
    
    set((state) => ({
      past: [...state.past, { nodes: snapshotNodes, edges: snapshotEdges }].slice(-50), // keep last 50
      future: []
    }))
  },
  undo: (currentNodes, currentEdges) => {
    const { past, future } = get()
    if (past.length === 0) return null
    
    const previous = past[past.length - 1]
    const newPast = past.slice(0, past.length - 1)
    
    set({
      past: newPast,
      future: [{ 
        nodes: JSON.parse(JSON.stringify(currentNodes)), 
        edges: JSON.parse(JSON.stringify(currentEdges)) 
      }, ...future]
    })
    
    return {
      nodes: JSON.parse(JSON.stringify(previous.nodes)),
      edges: JSON.parse(JSON.stringify(previous.edges))
    }
  },
  redo: (currentNodes, currentEdges) => {
    const { past, future } = get()
    if (future.length === 0) return null
    
    const next = future[0]
    const newFuture = future.slice(1)
    
    set({
      past: [...past, { 
        nodes: JSON.parse(JSON.stringify(currentNodes)), 
        edges: JSON.parse(JSON.stringify(currentEdges)) 
      }],
      future: newFuture
    })
    
    return {
      nodes: JSON.parse(JSON.stringify(next.nodes)),
      edges: JSON.parse(JSON.stringify(next.edges))
    }
  },
  clear: () => set({ past: [], future: [] })
}))
