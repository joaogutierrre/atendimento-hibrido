import { create } from 'zustand'
import { jwtDecode } from '../lib/jwt'
import type { AuthUser } from '../types'

interface AuthState {
  user: AuthUser | null
  token: string | null
  setToken: (token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  setToken: (token) => {
    localStorage.setItem('accessToken', token)
    const user = jwtDecode(token) as unknown as AuthUser
    set({ token, user })
  },
  logout: () => {
    localStorage.removeItem('accessToken')
    set({ token: null, user: null })
  },
}))

// Rehydrate from localStorage on module load
const stored = localStorage.getItem('accessToken')
if (stored) {
  try {
    const user = jwtDecode(stored) as unknown as AuthUser
    // Check expiry
    const payload = JSON.parse(atob(stored.split('.')[1]))
    if (payload.exp && payload.exp * 1000 > Date.now()) {
      useAuthStore.setState({ token: stored, user })
    } else {
      localStorage.removeItem('accessToken')
    }
  } catch {
    localStorage.removeItem('accessToken')
  }
}
