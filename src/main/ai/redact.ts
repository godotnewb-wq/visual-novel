export function redactConnectionDetail(message: string, connection: { baseUrl: string; apiKey: string }): string {
  let safe = message
  try {
    const url = new URL(connection.baseUrl)
    safe = safe.replaceAll(connection.baseUrl, `${url.origin}${url.pathname}`)
    for (const secret of [url.username, url.password]) if (secret) safe = safe.replaceAll(secret, '[redacted]')
  } catch { /* Invalid endpoint errors still have their known key removed. */ }
  if (connection.apiKey) {
    for (const secret of new Set([connection.apiKey, encodeURIComponent(connection.apiKey), encodeURI(connection.apiKey)])) {
      safe = safe.replaceAll(secret, '[redacted]')
    }
  }
  return safe
}
