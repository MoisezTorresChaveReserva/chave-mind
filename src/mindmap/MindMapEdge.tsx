import React from 'react'
import { BaseEdge, EdgeProps } from '@xyflow/react'

/**
 * Custom mindmap edge that draws a smooth S-curve from source to target.
 * Uses cubic bezier with horizontal tangents at both endpoints,
 * ensuring curves never loop regardless of vertical distance.
 */
export default function MindMapEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
}: EdgeProps) {
  const dx = targetX - sourceX
  // Control points at 50% horizontal distance, keeping tangents horizontal
  const controlX = sourceX + dx * 0.5
  const path = `M ${sourceX},${sourceY} C ${controlX},${sourceY} ${controlX},${targetY} ${targetX},${targetY}`

  return <BaseEdge path={path} style={style} markerEnd={markerEnd} />
}
