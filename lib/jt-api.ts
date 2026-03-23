// Helper for calling J&T API from client pages
// Automatically attaches WMS session headers

function getWmsHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (typeof window === 'undefined') return headers
  // Check warehouse admin session (Supabase auth cookie - just mark as admin)
  const warehouseSession = sessionStorage.getItem('wms_warehouse_role')
  if (warehouseSession === 'admin') {
    headers['x-wms-role'] = 'admin'
    return headers
  }
  // Check OMS client session
  try {
    const s = sessionStorage.getItem('wms_client_session')
    if (s) {
      const p = JSON.parse(s)
      if (p.customerCode) {
        headers['x-wms-role']       = 'client'
        headers['x-customer-code']  = p.customerCode
        return headers
      }
    }
  } catch {}
  return headers
}

export function jtApi(action: string, body: object = {}): Promise<any> {
  return fetch(`/api/jt?action=${action}`, {
    method:  'POST',
    headers: getWmsHeaders(),
    body:    JSON.stringify(body),
  }).then(r => r.json()).then(d => {
    if (!d.success) throw new Error(d.msg || '请求失败')
    return d.data
  })
}
