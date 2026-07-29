import { Map, Star, Trash2, ChevronRight, Menu } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (val: boolean) => void }) {
  const router = useRouter()
  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} className="absolute top-[13px] left-4 z-20 p-1.5 rounded-md hover:bg-gray-100 text-gray-500 bg-white border border-transparent hover:border-[var(--border)] transition-all">
        <Menu size={18} />
      </button>
    )
  }

  return (
    <div className="w-64 h-full bg-gray-50 border-r border-[var(--border)] flex flex-col transition-all flex-shrink-0 relative z-20 shadow-sm">
      <div className="h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => { window.dispatchEvent(new CustomEvent('force-save')); setTimeout(() => router.push('/'), 100) }}>
          <div className="w-6 h-6 rounded bg-[#2563EB] text-white flex items-center justify-center font-bold text-xs">M</div>
          <span className="font-semibold text-sm">MindMap Pro</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="p-1 rounded-md hover:bg-gray-200 text-gray-500">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <div className="px-2 mb-6">
          <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">Mapas</h3>
          <button onClick={() => { window.dispatchEvent(new CustomEvent('force-save')); setTimeout(() => router.push('/'), 100) }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-200 text-sm text-gray-700">
            <Map size={16} className="text-gray-400" />
            Dashboard
          </button>
        </div>
        <div className="px-2 mb-6">
          <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">Favoritos</h3>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-200 text-sm text-gray-700">
            <Star size={16} className="text-yellow-500" />
            Meus favoritos
          </button>
        </div>
        <div className="px-2">
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-200 text-sm text-gray-700">
            <Trash2 size={16} className="text-gray-400" />
            Lixeira
          </button>
        </div>
      </div>
    </div>
  )
}
