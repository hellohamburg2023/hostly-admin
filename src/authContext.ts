import { createContext } from 'react'

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
  signInWithApple: (identityToken: string, state: string, fullName?: string) => Promise<void>
  signOut: () => void
}

export const AuthContext = createContext<AuthCtx>({} as AuthCtx)
