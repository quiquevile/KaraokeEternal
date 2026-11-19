import type { Provider } from '../../shared/types.js'
import { can } from '../lib/permissions.js'

export interface ProviderUser {
  isAdmin: boolean
  permissions?: Record<string, boolean>
}

export function canUseProvider (user: ProviderUser, provider: Provider): boolean {
  if (user.isAdmin) return true
  if (provider.visibility === 'public') return true
  return provider.visibility === 'manager' && can(user, 'manageProviders')
}
