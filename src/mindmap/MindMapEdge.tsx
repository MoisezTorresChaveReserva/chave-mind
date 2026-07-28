import React from 'react'
import { BaseEdge, EdgeProps } from '@xyflow/react'

/**
 * Custom mindmap edge that draws a smooth curve from source to target.
 * Uses cubic bezier with horizontal tangents at both endpoints,
 * ensuring curves never loop regardless of vertical distance.
 * 
 * The control points are placed at 60% of the horizontal distance
 * to produce curves that leave the source horizontally for longer
 * before smoothly sweeping toward the target — matching the
 * classic mind-map look.
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
  // Control points at 60% horizontal distance for a flowing, asymmetric curve
  const controlX1 = sourceX + dx * 0.6
  const controlX2 = sourceX + dx * 0.4
  const path = `M ${sourceX},${sourceY} C ${controlX1},${sourceY} ${controlX2},${targetY} ${targetX},${targetY}`

  return <BaseEdge path={path} style={style} markerEnd={markerEnd} />
}
