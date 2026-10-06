import { createHmac, timingSafeEqual } from 'node:crypto'

type ExpiringPayload = { exp: number }

const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL)

function sessionSecret() {
  const configured = process.env.SESSION_SECRET
  if (configured) return configured
  if (isProduction) throw new Error('SESSION_SECRET precisa estar configurado em produção.')
  return 'github-ocean-local-development-secret'
}

function signature(payload: string) {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url')
}

export function signToken<T extends ExpiringPayload>(value: T) {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${payload}.${signature(payload)}`
}

export function verifyToken<T extends ExpiringPayload>(token: string | undefined): T | null {
  if (!token) return null
  const [payload, receivedSignature, extra] = token.split('.')
  if (!payload || !receivedSignature || extra) return null
  const expectedSignature = signature(payload)
  const received = Buffer.from(receivedSignature)
  const expected = Buffer.from(expectedSignature)
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T
    return typeof value.exp === 'number' && value.exp > Date.now() ? value : null
  } catch {
    return null
  }
}

export function readCookie(header: string | undefined, name: string) {
  if (!header) return undefined
  for (const cookie of header.split(';')) {
    const [key, ...value] = cookie.trim().split('=')
    if (key === name) return decodeURIComponent(value.join('='))
  }
  return undefined
}

export function cookie(name: string, value: string, maxAgeSeconds: number) {
  const secure = isProduction ? '; Secure' : ''
  return `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secure}`
}

export function sameValue(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}
