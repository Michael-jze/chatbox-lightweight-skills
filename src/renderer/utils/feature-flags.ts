import platform from '@/platform'

export const featureFlags = {
  skills: platform.type === 'desktop',
  taskMode: false,
  workspaceSandbox: platform.type === 'desktop',
}
