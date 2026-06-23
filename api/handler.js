import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const server = require(path.join(__dirname, '../dist/server/server.bundle.cjs'))

export default async function handler(req, res) {
  try {
    const defaultExport = server.default || server
    console.log('Server keys:', Object.keys(defaultExport))
    const response = await defaultExport.fetch(req)
    return response
  } catch (e) {
    console.error('Handler error:', e.message)
    res.status(500).json({ error: e.message })
  }
}
