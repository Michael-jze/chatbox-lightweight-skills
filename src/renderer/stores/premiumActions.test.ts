import { beforeEach, describe, expect, it, vi } from 'vitest'

type TestSettingsState = {
  licenseKey?: string
  licenseActivationMethod?: 'login' | 'manual'
  licenseInstances?: Record<string, string>
  licenseDetail?: unknown
  licensePlanName?: string
  hasExpiredLicense?: boolean
}

type AuthState = {
  accessToken: string | null
  refreshToken: string | null
  getTokens: () => { accessToken: string; refreshToken: string } | null
}

const { stateControls, authControls, authSubscribers } = vi.hoisted(() => {
  type MockSettingsState = TestSettingsState
  type MockAuthState = AuthState
  type AuthSubscriber = {
    selector: (state: MockAuthState) => 'signed-in' | 'signed-out'
    listener: (value: 'signed-in' | 'signed-out') => void
    current: 'signed-in' | 'signed-out'
  }

  const settings = {
    current: {} as MockSettingsState,
  }
  const auth: { current: MockAuthState } = {
    current: {
      accessToken: null,
      refreshToken: null,
      getTokens() {
        if (auth.current.accessToken && auth.current.refreshToken) {
          return {
            accessToken: auth.current.accessToken,
            refreshToken: auth.current.refreshToken,
          }
        }
        return null
      },
    },
  }
  const subscribers: AuthSubscriber[] = []

  return {
    stateControls: {
      get current() {
        return settings.current
      },
      set current(next: MockSettingsState) {
        settings.current = next
      },
    },
    authControls: {
      get current() {
        return auth.current
      },
      set current(next: MockAuthState) {
        auth.current = next
      },
    },
    authSubscribers: subscribers,
  }
})

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))
vi.mock('@/analytics/jk', () => ({ trackJkClickEvent: vi.fn() }))
vi.mock('@/analytics/jk-events', () => ({ JK_EVENTS: {}, JK_PAGE_NAMES: { SETTING_PAGE: 'settings' } }))
vi.mock('../platform', () => ({
  default: {
    getInstanceName: vi.fn(() => Promise.resolve('test-instance')),
    appLog: vi.fn(() => Promise.resolve()),
  },
}))
vi.mock('./settingsStore', () => ({
  settingsStore: {
    getState: () => stateControls.current,
    setState: (updater: Partial<TestSettingsState> | ((state: TestSettingsState) => Partial<TestSettingsState>)) => {
      const next = typeof updater === 'function' ? updater(stateControls.current as TestSettingsState) : updater
      stateControls.current = { ...stateControls.current, ...next }
    },
  },
  useSettingsStore: vi.fn(),
}))
vi.mock('./authInfoStore', () => ({
  authInfoStore: {
    getState: () => authControls.current,
    subscribe: (
      selector: (state: AuthState) => 'signed-in' | 'signed-out',
      listener: (value: 'signed-in' | 'signed-out') => void
    ) => {
      const subscriber = {
        selector,
        listener,
        current: selector(authControls.current),
      }
      authSubscribers.push(subscriber)
      return () => {
        const index = authSubscribers.indexOf(subscriber)
        if (index >= 0) authSubscribers.splice(index, 1)
      }
    },
  },
}))

import { initLoginLicenseStateReconciliation, reconcileLoginLicenseState } from './premiumActions'

function resetSettings(next: TestSettingsState) {
  stateControls.current = next
}

function setAuthTokens(accessToken: string | null, refreshToken: string | null) {
  authControls.current = {
    ...authControls.current,
    accessToken,
    refreshToken,
  }
  for (const subscriber of authSubscribers) {
    const next = subscriber.selector(authControls.current)
    if (next !== subscriber.current) {
      subscriber.current = next
      subscriber.listener(next)
    }
  }
}

describe('login license state reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authSubscribers.splice(0)
    setAuthTokens(null, null)
    resetSettings({})
  })

  it('clears stale login license state when auth tokens are missing', () => {
    resetSettings({
      licenseKey: 'login-license',
      licenseActivationMethod: 'login',
      licenseInstances: {
        'login-license': 'instance-id',
        'manual-license': 'manual-instance-id',
      },
      licenseDetail: { name: 'Pro' },
      licensePlanName: 'Pro',
      hasExpiredLicense: true,
    })

    expect(reconcileLoginLicenseState()).toBe(true)

    expect(stateControls.current.licenseKey).toBe('')
    expect(stateControls.current.licenseActivationMethod).toBeUndefined()
    expect(stateControls.current.licenseInstances).toEqual({ 'manual-license': 'manual-instance-id' })
    expect(stateControls.current.licenseDetail).toBeUndefined()
    expect(stateControls.current.licensePlanName).toBeUndefined()
    expect(stateControls.current.hasExpiredLicense).toBe(false)
  })

  it('keeps login license state when auth tokens are present', () => {
    setAuthTokens('access-token', 'refresh-token')
    resetSettings({
      licenseKey: 'login-license',
      licenseActivationMethod: 'login',
      licenseInstances: { 'login-license': 'instance-id' },
    })

    expect(reconcileLoginLicenseState()).toBe(false)
    expect(stateControls.current.licenseKey).toBe('login-license')
  })

  it('does not clear manual license state when auth tokens are missing', () => {
    resetSettings({
      licenseKey: 'manual-license',
      licenseActivationMethod: 'manual',
      licenseInstances: { 'manual-license': 'instance-id' },
    })

    expect(reconcileLoginLicenseState()).toBe(false)
    expect(stateControls.current.licenseKey).toBe('manual-license')
    expect(stateControls.current.licenseActivationMethod).toBe('manual')
  })

  it('clears login license state when auth tokens are removed after startup', () => {
    setAuthTokens('access-token', 'refresh-token')
    resetSettings({
      licenseKey: 'login-license',
      licenseActivationMethod: 'login',
      licenseInstances: { 'login-license': 'instance-id' },
    })

    const unsubscribe = initLoginLicenseStateReconciliation()
    expect(stateControls.current.licenseKey).toBe('login-license')

    setAuthTokens(null, null)

    expect(stateControls.current.licenseKey).toBe('')
    expect(stateControls.current.licenseActivationMethod).toBeUndefined()
    unsubscribe()
  })
})
