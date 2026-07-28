'use client'

import React, { useState, useEffect } from 'react'
import { X, Copy, Check, Globe, Lock, UserPlus, Trash2 } from 'lucide-react'
import { supabase } from '@/supabase/client'

interface Collaborator {
  id: string
  email: string
  role: string
}

interface ShareModalProps {
  mapId: string
  isOpen: boolean
  onClose: () => void
  isOwner: boolean
}

export default function ShareModal({ mapId, isOpen, onClose, isOwner }: ShareModalProps) {
  const [isPublic, setIsPublic] = useState(false)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('reader')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: mapData } = await supabase
        .from('mind_maps')
        .select('is_public')
        .eq('id', mapId)
        .single()

      if (mapData) setIsPublic(mapData.is_public)

      const { data: collabs } = await supabase
        .from('map_collaborators')
        .select('*')
        .eq('map_id', mapId)
        .order('created_at', { ascending: false })

      if (collabs) setCollaborators(collabs)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const togglePublic = async (checked: boolean) => {
    setIsPublic(checked)
    await supabase.from('mind_maps').update({ is_public: checked }).eq('id', mapId)
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleAddCollaborator = async () => {
    if (!newEmail.trim() || !newEmail.includes('@')) return

    try {
      const { data, error } = await supabase
        .from('map_collaborators')
        .insert([{ map_id: mapId, email: newEmail.trim(), role: newRole }])
        .select()
        .single()

      if (error) {
        if (error.code === '23505') alert('Este e-mail já foi convidado.')
        else alert('Erro ao convidar.')
        return
      }

      if (data) {
        setCollaborators([data, ...collaborators])
        setNewEmail('')
      }
    } catch (error) {
      console.error(error)
    }
  }

  const handleRemoveCollaborator = async (id: string) => {
    await supabase.from('map_collaborators').delete().eq('id', id)
    setCollaborators(collaborators.filter(c => c.id !== id))
  }

  const handleRoleChange = async (id: string, role: string) => {
    await supabase.from('map_collaborators').update({ role }).eq('id', id)
    setCollaborators(collaborators.map(c => c.id === id ? { ...c, role } : c))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Compartilhar Mapa</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-6">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {/* Privacy Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${isPublic ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                    {isPublic ? <Globe size={24} /> : <Lock size={24} />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {isPublic ? 'Mapa Público' : 'Mapa Privado'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {isPublic ? 'Qualquer pessoa com o link pode visualizar.' : 'Apenas convidados podem acessar.'}
                    </p>
                  </div>
                </div>
                
                {/* Switch */}
                {isOwner && (
                  <button
                    onClick={() => togglePublic(!isPublic)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isPublic ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isPublic ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                )}
              </div>

              {/* Link Copy */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Link de Acesso</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== 'undefined' ? window.location.href : ''}
                    className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:outline-none"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>

              <div className="h-px bg-gray-100 dark:bg-gray-800 my-2"></div>

              {/* Invite Section */}
              <div className="flex flex-col gap-4">
                {isOwner && (
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-1">Convite Privado</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                      Conceda acesso específico usando o e-mail do colaborador.
                    </p>
                    
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="email"
                          placeholder="email@exemplo.com"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddCollaborator()}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg pl-3 pr-4 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all dark:text-white"
                        />
                      </div>
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none dark:text-white"
                      >
                        <option value="reader">Leitor</option>
                        <option value="editor">Editor</option>
                      </select>
                      <button
                        onClick={handleAddCollaborator}
                        disabled={!newEmail.trim()}
                        className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        <UserPlus size={16} /> Enviar
                      </button>
                    </div>
                  </div>
                )}

                {/* Collaborators List */}
                {collaborators.length > 0 && (
                  <div className="flex flex-col gap-2 mt-2 max-h-[150px] overflow-y-auto pr-2">
                    {collaborators.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 group">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium text-sm">
                            {c.email.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{c.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={c.role}
                            onChange={(e) => handleRoleChange(c.id, e.target.value)}
                            disabled={!isOwner}
                            className="bg-transparent text-sm text-gray-500 dark:text-gray-400 outline-none cursor-pointer disabled:opacity-70 disabled:cursor-default"
                          >
                            <option value="reader">Leitor</option>
                            <option value="editor">Editor</option>
                          </select>
                          {isOwner && (
                            <button
                              onClick={() => handleRemoveCollaborator(c.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title="Remover acesso"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
