'use client'
import { useState, useEffect } from 'react'

export interface ClientAuthInfo {
  customerCode: string
  customerName: string
  displayName:  string
  email:        string
  isActive:     boolean
  isImpersonated?: boolean
}

// Helper to get impersonation session from sessionStorage
export function getImpersonationSession(): ClientAuthInfo | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem('wms_client_session')
    if (!raw) return null
    const s = JSON.parse(raw)
    if (s.customerCode) return s
  } catch {}
  return null
}

// Fetch with impersonation headers if needed
export async function clientFetch(url: string, options?: RequestInit): Promise<Response> {
  const session = getImpersonationSession()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  }
  if (session) {
    headers['X-Impersonate-Customer'] = session.customerCode
    headers['X-Impersonate-Name']     = session.customerName || ''
  }
  return fetch(url, { ...options, headers })
}

export function useClientAuth() {
  const [info,  setInfo]  = useState<ClientAuthInfo | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Check sessionStorage first (impersonation)
    const session = getImpersonationSession()
    if (session) { setInfo(session); setReady(true); return }
    // Fall back to API
    fetch('/api/auth-info').then(r => r.json()).then(d => {
      if (d.customerCode) setInfo(d)
      setReady(true)
    })
  }, [])

  return { info, ready, customerCode: info?.customerCode || '' }
}
