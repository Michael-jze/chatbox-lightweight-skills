/** Private fork: analytics disabled — no outbound GA events. */
export async function event(_name: string, _params: Record<string, unknown> = {}) {
  return undefined
}
