import * as Sentry from '@sentry/react'
import omit from 'lodash/omit'
import { FetchError } from 'ofetch'
import { useEffect } from 'react'
import { trackJkClickEvent } from '@/analytics/jk'
import { JK_EVENTS, JK_PAGE_NAMES } from '@/analytics/jk-events'
import { getLogger } from '@/lib/utils'
import * as remote from '../packages/remote'
import platform from '../platform'
import { authInfoStore } from './authInfoStore'
import { settingsStore, useSettingsStore } from './settingsStore'

const log = getLogger('premium-actions')

export function reconcileLoginLicenseState() {
  const settings = settingsStore.getState()
  if (settings.licenseActivationMethod !== 'login' || !settings.licenseKey) {
    return false
  }
  if (authInfoStore.getState().getTokens()) {
    return false
  }

  const licenseKey = settings.licenseKey
  settingsStore.setState((state) => ({
    licenseKey: '',
    licenseDetail: undefined,
    licensePlanName: undefined,
    licenseActivationMethod: undefined,
    licenseInstances: omit(state.licenseInstances, licenseKey),
    hasExpiredLicense: false,
  }))
  log.info('Cleared stale login license state because auth tokens are missing')
  return true
}

export function initLoginLicenseStateReconciliation() {
  reconcileLoginLicenseState()
  return authInfoStore.subscribe(
    (state) => (state.accessToken && state.refreshToken ? 'signed-in' : 'signed-out'),
    (authState) => {
      if (authState === 'signed-out') {
        reconcileLoginLicenseState()
      }
    }
  )
}

/**
 * 自动验证当前的 license 是否有效，如果无效则清除相关数据
 * @returns {boolean} whether the user has validated before
 */
export function useAutoValidate(): boolean {
  const licenseKey = useSettingsStore((state) => state.licenseKey)
  const licenseInstances = useSettingsStore((state) => state.licenseInstances)
  const clearValidatedData = () => {
    settingsStore.setState((state) => ({
      licenseKey: '',
      licenseInstances: omit(state.licenseInstances, state.licenseKey || ''),
      licenseDetail: undefined,
      licensePlanName: undefined,
      licenseActivationMethod: undefined,
      hasExpiredLicense: true,
    }))
  }
  useEffect(() => {
    void (async () => {
      if (!licenseKey || !licenseInstances) {
        return
      }
      const instanceId = licenseInstances[licenseKey] || ''
      try {
        const result = await remote.validateLicense({
          licenseKey: licenseKey,
          instanceId: instanceId,
        })
        if (result.valid === false) {
          clearValidatedData()
          log.info(`clear license validated data due to invalid result: ${JSON.stringify(result)}`)
          return
        }
      } catch (err) {
        if (err instanceof FetchError && err.status && [401, 403, 404].includes(err.status)) {
          clearValidatedData()
          log.info(`clear license validated data due to respones status: ${err.status}`)
        } else {
          Sentry.captureException(err)
        }
      }
    })()
  }, [licenseKey])
  if (!licenseKey || !licenseInstances) {
    return false
  }
  return !!licenseInstances[licenseKey]
}

export async function deactivate(clearLoginState = true) {
  const settings = settingsStore.getState()

  if (clearLoginState && settings.licenseActivationMethod === 'login') {
    const { authInfoStore } = await import('./authInfoStore')
    authInfoStore.getState().clearTokens()
  }

  settingsStore.setState((settings) => ({
    licenseKey: '',
    licenseDetail: undefined,
    licensePlanName: undefined,
    licenseActivationMethod: undefined,
    licenseInstances: omit(settings.licenseInstances, settings.licenseKey || ''),
  }))

  const licenseKey = settings.licenseKey || ''
  const licenseInstances = settings.licenseInstances || {}
  if (licenseKey && licenseInstances[licenseKey]) {
    await remote.deactivateLicense({
      licenseKey,
      instanceId: licenseInstances[licenseKey],
    })
  }
}

export async function activate(
  licenseKey: string,
  method: 'login' | 'manual' = 'manual',
  options?: { pageName?: string }
) {
  console.log('Enter acticate')
  const pageName = options?.pageName ?? JK_PAGE_NAMES.SETTING_PAGE
  const shouldTrackKeyVerifyEvent = method !== 'login'
  const settings = settingsStore.getState()

  if (method === 'manual') {
    const { authInfoStore } = await import('./authInfoStore')
    authInfoStore.getState().clearTokens()
    log.info('🔓 Cleared login tokens due to manual license activation')
  }

  if (settings.licenseKey) {
    const isSwitchingLicense = method === 'login' && settings.licenseActivationMethod === 'login'
    await deactivate(!isSwitchingLicense)
  }
  const result = await remote.activateLicense({
    licenseKey,
    instanceName: await platform.getInstanceName(),
  })
  if (!result.valid) {
    if (shouldTrackKeyVerifyEvent) {
      trackJkClickEvent(JK_EVENTS.KEY_VERIFY_FAILED, {
        pageName,
        content: result.error || 'activation_failed',
        contentType: 'Chatbox AI',
        props: { content_add_info: { content: 'Chatbox AI' } },
      })
    }
    return result
  }
  const licenseDetailResponse = await remote.getLicenseDetailRealtime({ licenseKey })
  if (licenseDetailResponse.error) {
    console.log(`licenseDetailResponse.error: ${licenseDetailResponse.error.code}`)
    const error = licenseDetailResponse.error.code || 'license_error'
    if (error === 'expired' || error === 'expired_license') settingsStore.setState({ hasExpiredLicense: true })
    if (licenseDetailResponse.data) {
      settingsStore.setState({
        licenseDetail: licenseDetailResponse.data,
        licensePlanName: licenseDetailResponse.data.name,
      })
    }
    if (shouldTrackKeyVerifyEvent) {
      trackJkClickEvent(JK_EVENTS.KEY_VERIFY_FAILED, {
        pageName,
        content: error,
        contentType: 'Chatbox AI',
        props: { content_add_info: { content: 'Chatbox AI' } },
      })
    }
    return {
      valid: false,
      error,
    }
  }
  settingsStore.setState((settings) => ({
    licenseKey,
    licenseActivationMethod: method,
    licenseInstances: {
      ...(settings.licenseInstances || {}),
      [licenseKey]: result.instanceId,
    },
    licenseDetail: licenseDetailResponse.data || undefined,
    licensePlanName: licenseDetailResponse.data?.name,
    ...(method === 'manual' ? { memorizedManualLicenseKey: licenseKey } : {}),
  }))
  if (shouldTrackKeyVerifyEvent) {
    trackJkClickEvent(JK_EVENTS.KEY_VERIFY_SUCCESS, {
      pageName,
      content: licenseKey,
      contentType: 'Chatbox AI',
      props: { content_add_info: { content: 'Chatbox AI' } },
    })
  }
  log.info(`✅ Activated license key: ${licenseKey.slice(0, 8)}****`)
  return result
}
