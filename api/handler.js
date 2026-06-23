import server from '../dist/server/server.js'

export default function handler(request) {
  return server.fetch(request)
}
