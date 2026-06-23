import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const server = require(path.join(__dirname, '../dist/server/server.bundle.cjs'))

export default async function handler(req, res) {
  try {
    const defaultExport = server.default || server

    // Convert Node.js IncomingMessage to Web API Request
    const protocol = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost'
    const url = new URL(req.url, `${protocol}://${host}`)

    const webRequest = new Request(url.toString(), {
      method: req.method,
      headers: req.headers,
    })

    const response = await defaultExport.fetch(webRequest)

    // Convert Web API Response back to Node.js response
    res.status(response.status)
    response.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })

    const body = await response.text()
    res.send(body)

  } catch (e) {
    console.error('Handler error:', e.message)
    res.status(500).json({ error: e.message })
  }
}
