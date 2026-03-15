import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()
    if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })

    // Detect language (simple heuristic: if has Chinese chars → zh, else → es)
    const hasChinese = /[\u4e00-\u9fa5]/.test(text)
    const sourceLang  = hasChinese ? 'zh' : 'es'
    const targetLang  = hasChinese ? 'es' : 'zh'
    const targetLabel = hasChinese ? 'Spanish' : 'Chinese'

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Translate the following text to ${targetLabel}. Return ONLY the translation, no explanation:\n\n${text}`
        }]
      })
    })

    const data = await response.json()
    const translated = data.content?.[0]?.text?.trim() ?? ''

    return NextResponse.json({
      original:   text,
      translated,
      sourceLang,
      targetLang,
      content_zh: sourceLang === 'zh' ? text : translated,
      content_es: sourceLang === 'es' ? text : translated,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
