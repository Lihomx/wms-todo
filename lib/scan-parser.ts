/**
 * Scan Parser - extracts and validates scan results
 * Handles: plain text, JSON QR codes, barcodes
 */

export interface ScanRule {
  id?: number
  name: string
  is_active: boolean
  free_mode: boolean
  extract_rules: ExtractRule[]
  prefix_strip: string
  suffix_strip: string
  regex_replace: string
  regex_with: string
  sku_prefix_match: boolean
  sku_exact_match: boolean
}

export interface ExtractRule {
  type: 'json_field' | 'regex' | 'raw'
  field?: string   // for json_field
  pattern?: string // for regex
  group?: number   // for regex (capture group index)
  label: string
}

export interface ParseResult {
  raw: string           // original scan input
  extracted: string     // value after extraction rules
  matched: boolean      // found in SKU list (or free mode)
  matchedSku?: string   // the actual SKU that matched
  rule?: string         // which rule matched
  error?: string
}

/**
 * Apply extraction rules to raw scan input
 * Returns the extracted value or the original if no rule matches
 */
export function extractValue(raw: string, rules: ExtractRule[]): { value: string; ruleName: string } {
  const trimmed = raw.trim()
  
  // Try each extraction rule in order
  for (const rule of rules) {
    if (rule.type === 'json_field' && rule.field) {
      try {
        const obj = JSON.parse(trimmed)
        const val = obj[rule.field]
        if (val && String(val).trim()) {
          return { value: String(val).trim(), ruleName: rule.label }
        }
      } catch { /* not JSON */ }
    }
    
    if (rule.type === 'regex' && rule.pattern) {
      try {
        const re = new RegExp(rule.pattern)
        const m  = trimmed.match(re)
        const group = rule.group ?? 1
        if (m && m[group]) {
          return { value: m[group].trim(), ruleName: rule.label }
        }
      } catch { /* invalid regex */ }
    }
    
    if (rule.type === 'raw') {
      return { value: trimmed, ruleName: '原始值' }
    }
  }
  
  // Fallback: return raw value
  return { value: trimmed, ruleName: '原始值（无规则匹配）' }
}

/**
 * Apply post-extraction transforms (strip prefix/suffix, regex replace)
 */
export function applyTransforms(value: string, settings: Partial<ScanRule>): string {
  let v = value
  if (settings.prefix_strip && v.startsWith(settings.prefix_strip)) {
    v = v.slice(settings.prefix_strip.length)
  }
  if (settings.suffix_strip && v.endsWith(settings.suffix_strip)) {
    v = v.slice(0, v.length - settings.suffix_strip.length)
  }
  if (settings.regex_replace) {
    try {
      const re = new RegExp(settings.regex_replace, 'g')
      v = v.replace(re, settings.regex_with || '')
    } catch { /* invalid regex */ }
  }
  return v.trim()
}

/**
 * Match extracted value against SKU list
 * Supports: exact match, prefix match (SKU is prefix of scanned value)
 */
export function matchSku(
  value: string,
  skus: string[],
  settings: Pick<ScanRule, 'sku_prefix_match' | 'sku_exact_match' | 'free_mode'>
): { matched: boolean; matchedSku?: string } {
  if (settings.free_mode) {
    return { matched: true, matchedSku: value }
  }
  
  const upper = value.toUpperCase()
  
  // Exact match (case-insensitive)
  const exact = skus.find(s => s.toUpperCase() === upper)
  if (exact) return { matched: true, matchedSku: exact }
  
  // Prefix match: SKU is prefix of the scanned value
  // e.g. SKU="N4-37", scanned="N4-37-RED" -> match
  if (settings.sku_prefix_match) {
    const prefix = skus.find(s => upper.startsWith(s.toUpperCase()))
    if (prefix) return { matched: true, matchedSku: prefix }
  }
  
  return { matched: false }
}

/**
 * Full parse pipeline
 */
export function parseScan(
  raw: string,
  settings: ScanRule,
  skus: string[]
): ParseResult {
  if (!raw?.trim()) return { raw, extracted: '', matched: false, error: '空输入' }
  
  // 1. Extract value
  const { value: extracted, ruleName } = extractValue(raw, settings.extract_rules)
  
  // 2. Apply transforms
  const transformed = applyTransforms(extracted, settings)
  
  // 3. Match SKU
  const { matched, matchedSku } = matchSku(transformed, skus, settings)
  
  return {
    raw,
    extracted:    transformed,
    matched,
    matchedSku:   matchedSku || transformed,
    rule:         ruleName,
    error:        !matched && !settings.free_mode ? `未找到匹配SKU: "${transformed}"` : undefined,
  }
}
