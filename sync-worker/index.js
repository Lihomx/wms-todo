/**
 * Railway 定时同步 Worker
 * 领星OMS → 待办系统
 * 环境变量: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_APP_URL, SYNC_SECRET
 */
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL      = process.env.SUPABASE_URL
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY
const NEXT_APP_URL      = process.env.NEXT_APP_URL      // e.g. https://wms-todo.vercel.app
const SYNC_SECRET       = process.env.SYNC_SECRET       // optional auth header
const BATCH_SIZE        = Number(process.env.BATCH_SIZE ?? 10)
const DELAY_MS          = Number(process.env.DELAY_MS   ?? 1500)

if (!SUPABASE_URL || !SUPABASE_KEY || !NEXT_APP_URL) {
  console.error('❌ Missing env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_APP_URL')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function syncTenant(tenantId) {
  const headers = {
    'Content-Type': 'application/json',
    ...(SYNC_SECRET ? { 'x-sync-secret': SYNC_SECRET } : {}),
  }
  const res = await fetch(`${NEXT_APP_URL}/api/lingxing/sync`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tenantId }),
  })
  const json = await res.json()
  if (!res.ok || !json.success) throw new Error(json.error ?? `HTTP ${res.status}`)
  return json
}

async function main() {
  console.log(`\n🚀 同步开始 ${new Date().toISOString()}`)

  // 查询所有启用同步的租户
  const { data: tenants, error } = await supabase
    .from('lingxing_credentials')
    .select('tenant_id')
    .eq('sync_enabled', true)
    .eq('auth_status', 1)

  if (error) {
    console.error('❌ 查询租户失败:', error.message)
    process.exit(1)
  }

  console.log(`📋 共 ${tenants.length} 个租户需要同步`)

  let success = 0, failed = 0

  // 分批处理，避免并发过多
  for (let i = 0; i < tenants.length; i += BATCH_SIZE) {
    const batch = tenants.slice(i, i + BATCH_SIZE)
    await Promise.allSettled(
      batch.map(async ({ tenant_id }) => {
        try {
          const result = await syncTenant(tenant_id)
          console.log(`  ✅ ${tenant_id} → 新建:${result.created} 更新:${result.updated} 跳过:${result.skipped}`)
          if (result.warnings?.length) console.log(`     ⚠️  ${result.warnings.join('; ')}`)
          success++
        } catch (err) {
          console.error(`  ❌ ${tenant_id} → ${err.message}`)
          failed++
        }
      })
    )
    // 批次间等待，避免 OMS 限流
    if (i + BATCH_SIZE < tenants.length) {
      await new Promise(r => setTimeout(r, DELAY_MS))
    }
  }

  console.log(`\n✅ 同步完成：成功 ${success} / 失败 ${failed} / 合计 ${tenants.length}`)
  console.log(`⏱  结束时间 ${new Date().toISOString()}\n`)
}

main().catch(err => {
  console.error('❌ Worker 崩溃:', err)
  process.exit(1)
})
