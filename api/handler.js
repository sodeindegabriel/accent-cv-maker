import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const server = require(path.join(__dirname, '../dist/server/server.bundle.cjs'))

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  console.log('Handler called:', req.method, req.url)
  console.log('Headers:', JSON.stringify(req.headers))

  try {
    const defaultExport = server.default || server

    const protocol = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost'
    const url = new URL(req.url, `${protocol}://${host}`)

    console.log('Full URL:', url.toString())

    const body = req.method !== 'GET' && req.method !== 'HEAD'
      ? await getRawBody(req)
      : undefined

    const webRequest = new Request(url.toString(), {
      method: req.method,
      headers: req.headers,
      body,
    })

    console.log('Calling server.fetch...')
    const response = await defaultExport.fetch(webRequest)
    console.log('Response status:', response.status)

    res.status(response.status)
    response.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })

    const responseBody = await response.text()
    console.log('Response body length:', responseBody.length)
    console.log('Response body preview:', responseBody.substring(0, 200))
    res.send(responseBody)

  } catch (e) {
    console.error('Handler error:', e.message)
    console.error('Stack:', e.stack)
    res.status(500).json({ error: e.message })
  }
}
