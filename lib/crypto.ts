import CryptoJS from 'crypto-js'

const SECRET = process.env.ENCRYPTION_SECRET || 'fallback-dev-key-change-in-prod'

export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, SECRET).toString()
}

export function decrypt(ciphertext: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET)
  return bytes.toString(CryptoJS.enc.Utf8)
}
