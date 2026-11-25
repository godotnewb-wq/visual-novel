/** A saved key belongs to the full endpoint, including its path, not just its host. */
export function sameConnectionEndpoint(left: string, right: string): boolean {
  const clean = (value: string) => value.trim().replace(/\/+$/, '')
  try { return new URL(clean(left)).href === new URL(clean(right)).href } catch { return clean(left) === clean(right) }
}
