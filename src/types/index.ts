export type Slide = {
  id: string
  name?: string
  bounds: { x: number; y: number; width: number; height: number }
  collapsedNodes?: string[]
}

export type MapPresentation = {
  id: string
  map_id: string
  name: string
  slides: Slide[]
  created_at?: string
  updated_at?: string
}

export type Tag = {
  id: string
  text: string
  color: string
}

export type MindMap = {
  id: string
  user_id: string
  title: string
  map_type?: string
  favorite: boolean
  color?: string
  thumbnail?: string
  slides?: Slide[]
  created_at: string
  updated_at: string
  last_opened_at: string
}

export type MapNode = {
  id: string
  map_id: string
  parent_id?: string
  text: string
  x: number
  y: number
  color?: string
  collapsed: boolean
  order: number
  created_at: string
  updated_at: string
}

export type MapEdge = {
  id: string
  map_id: string
  source: string
  target: string
  color?: string
  animated: boolean
  label?: string
}

export type UserProfile = {
  id: string
  email: string
  full_name?: string
  avatar_url?: string | null
  role?: 'admin' | 'user'
  last_access_at?: string
  is_online?: boolean
  maps_count?: number
  created_at?: string
}

export type AdminStats = {
  totalUsers: number
  onlineUsers: number
  totalMaps: number
}

