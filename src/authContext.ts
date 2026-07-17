import { createContext } from 'react'
import type { AppleLoginPayload } from './api'

export interface AuthUser {
  id: number
  email: string
  is_staff: boolean
  is_superuser: boolean
}

export interface AuthCtx {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signInWithApple: (payload: AppleLoginPayload) => Promise<void>
  signOut: () => void
}

export const AuthContext = createContext<AuthCtx>({} as AuthCtx)
