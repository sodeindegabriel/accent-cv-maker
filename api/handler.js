export default async function handler(req, res) {
  try {
    const mod = await import('../dist/server/server.js')
    console.log('Server module keys:', Object.keys(mod))

    const server = mod.default
    if (!server || typeof server.fetch !== 'function') {
      throw new Error(`Unexpected export shape: ${JSON.stringify(Object.keys(mod))}`)
    }

    const url = new URL(req.url, `https://${req.headers.host}`)
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
    })

    const response = await server.fetch(request)
    console.log('SSR response status:', response.status)

    res.status(response.status)
    response.headers.forEach((value, key) => res.setHeader(key, value))
    const body = await response.text()
    res.send(body)
  } catch (e) {
    console.error('Handler failed:', e.message)
    console.error(e.stack)
    res.status(500).json({ error: e.message, stack: e.stack })
  }
}
