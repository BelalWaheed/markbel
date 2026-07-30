export interface APIResponse<T = any> {
  data?: T
  error?: string
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('markbel_token')
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

export const api = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers: getHeaders()
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data as T
  },

  async post<T>(path: string, body: any): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body)
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data as T
  },

  async put<T>(path: string, body: any): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body)
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data as T
  },

  async patch<T>(path: string, body?: any): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data as T
  },

  async delete<T>(path: string, body?: any): Promise<T> {
    const opts: RequestInit = {
      method: 'DELETE',
      headers: getHeaders()
    }
    if (body) {
      opts.body = JSON.stringify(body)
    }
    const res = await fetch(`${API_BASE}${path}`, opts)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data as T
  }
}

