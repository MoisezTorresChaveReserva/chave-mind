'use client'

import { supabase } from '@/supabase/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        alert('Verifique seu e-mail para confirmar o cadastro (ou faça login se auto-confirmado).')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/')
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--background)]">
      <form onSubmit={handleAuth} className="flex flex-col gap-4 w-80 p-8 border border-[var(--border)] rounded-2xl shadow-sm bg-white">
        <h1 className="text-xl font-bold mb-2 text-[var(--foreground)]">{isSignUp ? 'Criar Conta' : 'Entrar'}</h1>
        
        {error && <div className="text-red-500 text-sm">{error}</div>}
        
        <input 
          type="email" 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          placeholder="E-mail" 
          required
          className="p-2 border border-[var(--border)] rounded-lg outline-none focus:border-[#2563EB]"
        />
        <input 
          type="password" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          placeholder="Senha" 
          required
          className="p-2 border border-[var(--border)] rounded-lg outline-none focus:border-[#2563EB]"
        />
        
        <button type="submit" disabled={loading} className="bg-[#2563EB] text-white p-2 rounded-lg font-medium mt-2 hover:bg-blue-700 transition-colors disabled:opacity-50">
          {loading ? 'Aguarde...' : isSignUp ? 'Cadastrar' : 'Login'}
        </button>
        
        <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-sm text-gray-500 hover:text-gray-900 mt-2">
          {isSignUp ? 'Já tem conta? Entrar' : 'Não tem conta? Cadastrar'}
        </button>
      </form>
    </div>
  )
}
