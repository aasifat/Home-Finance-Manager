const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api'

// The session cookie only works when frontend and backend share a site
// (local dev). In production (Vercel calling Render) it's cross-site, and
// browsers may withhold it regardless of SameSite — so the login token is
// also kept here and sent as an Authorization header on every request.
const TOKEN_KEY = 'ledger_token'

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}
export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

let onUnauthorized = null
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

async function request(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    credentials: 'include',
  })
  if (res.status === 401) {
    clearToken()
    onUnauthorized?.()
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      // ignore — no JSON body
    }
    const err = new Error(message)
    err.status = res.status
    throw err
  }
  if (res.status === 204) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' }),
}
