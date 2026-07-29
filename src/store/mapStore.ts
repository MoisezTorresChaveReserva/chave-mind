import { create } from 'zustand'
import { Tag } from '@/types'

interface MapState {
  mapTags: Tag[]
  setMapTags: (tags: Tag[]) => void
  addMapTag: (tag: Tag) => void
  removeMapTag: (tagId: string) => void
}

export const useMapStore = create<MapState>((set) => ({
  mapTags: [],
  setMapTags: (tags) => set({ mapTags: tags }),
  addMapTag: (tag) => set((state) => ({ mapTags: [...state.mapTags, tag] })),
  removeMapTag: (tagId) => set((state) => ({ mapTags: state.mapTags.filter(t => t.id !== tagId) }))
}))
