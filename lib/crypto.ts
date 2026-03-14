import CryptoJS from 'crypto-js'

const SECRET = process.env.ENCRYPTION_SECRET || 'fallback-dev-key-change-in-prod'

export function encrypt(text: string): string {
  if (!text) return ''
  return CryptoJS.AES.encrypt(text, SECRET).toString()
}

export function decrypt(ciphertext: string): string {
  if (!ciphertext) return ''
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET)
    const result = bytes.toString(CryptoJS.enc.Utf8)
    return result ?? ''
  } catch {
    return ''
  }
}
