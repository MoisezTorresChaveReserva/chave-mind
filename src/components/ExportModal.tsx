// Export Modal Component with PDF, PNG, JSON, PPTX support
import React, { useState } from 'react';
import { X, Image as ImageIcon, FileJson, Presentation, FileText, Download } from 'lucide-react';

export default function ExportModal({ 
  isOpen, 
  onClose, 
  presentations, 
  onExportMap, 
  onExportPresentation 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  presentations: any[]; 
  onExportMap: (format: 'png' | 'json' | 'pdf') => void;
  onExportPresentation: (presentationId: string, format: 'pptx' | 'pdf') => void;
}) {
  const [selectedPresentation, setSelectedPresentation] = useState(presentations[0]?.id || '');
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col relative">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Download size={20} className="text-blue-500" />
            Exportar
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-6">
          
          {/* Exportar Mapa */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Exportar Mapa Completo</h3>
            <div className="grid grid-cols-3 gap-3">
              <button 
                onClick={() => { onExportMap('png'); onClose(); }}
                className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all text-gray-700 dark:text-gray-300 hover:text-blue-600"
              >
                <ImageIcon size={22} />
                <span className="text-xs font-medium">Imagem PNG</span>
              </button>
              <button 
                onClick={() => { onExportMap('pdf'); onClose(); }}
                className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all text-gray-700 dark:text-gray-300 hover:text-red-600"
              >
                <FileText size={22} />
                <span className="text-xs font-medium">Documento PDF</span>
              </button>
              <button 
                onClick={() => { onExportMap('json'); onClose(); }}
                className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 transition-all text-gray-700 dark:text-gray-300 hover:text-green-600"
              >
                <FileJson size={22} />
                <span className="text-xs font-medium">Dados JSON</span>
              </button>
            </div>
          </div>

          {/* Exportar Apresentação */}
          {presentations.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Exportar Apresentação</h3>
              <select 
                value={selectedPresentation || presentations[0]?.id}
                onChange={(e) => setSelectedPresentation(e.target.value)}
                className="w-full mb-3 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
              >
                {presentations.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => { onExportPresentation(selectedPresentation || presentations[0]?.id, 'pptx'); onClose(); }}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-all text-gray-700 dark:text-gray-300 hover:text-orange-600"
                >
                  <Presentation size={24} />
                  <span className="text-sm font-medium">PowerPoint (PPTX)</span>
                </button>
                <button 
                  onClick={() => { onExportPresentation(selectedPresentation || presentations[0]?.id, 'pdf'); onClose(); }}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all text-gray-700 dark:text-gray-300 hover:text-red-600"
                >
                  <FileText size={24} />
                  <span className="text-sm font-medium">Documento PDF</span>
                </button>
              </div>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}
