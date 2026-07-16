import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import path from 'node:path'

const port = Number(process.env.PORT || 3000)
const distDirectory = path.resolve('dist')
const apiTarget = new URL(process.env.API_PROXY_TARGET || 'https://app.meet-hostly.com')
const apiHostHeader = process.env.API_PROXY_HOST || 'app.meet-hostly.com'

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
}

function proxyApiRequest(request, response) {
  const target = new URL(request.url, apiTarget)
  const headers = {
    host: apiHostHeader,
    'user-agent': request.headers['user-agent'] || 'Hostly-Admin-Proxy/1.0',
  }
  for (const name of ['accept', 'accept-language', 'authorization', 'content-length', 'content-type']) {
    if (request.headers[name]) headers[name] = request.headers[name]
  }

  const upstreamRequest = apiTarget.protocol === 'http:' ? httpRequest : httpsRequest
  const upstream = upstreamRequest({
    protocol: apiTarget.protocol,
    hostname: apiTarget.hostname,
    port: apiTarget.port || (apiTarget.protocol === 'http:' ? 80 : 443),
    method: request.method,
    path: `${target.pathname}${target.search}`,
    headers,
  }, (upstreamResponse) => {
    const responseHeaders = { ...upstreamResponse.headers }
    delete responseHeaders.connection
    delete responseHeaders['transfer-encoding']
    response.writeHead(upstreamResponse.statusCode || 502, responseHeaders)
    upstreamResponse.pipe(response)
  })

  upstream.on('error', (error) => {
    console.error('API proxy request failed:', error.message)
    if (!response.headersSent) {
      response.writeHead(502, { 'content-type': 'application/json; charset=utf-8' })
    }
    response.end(JSON.stringify({
      detail: 'Die Hostly-API ist vorübergehend nicht erreichbar.',
    }))
  })

  request.pipe(upstream)
}

async function resolveStaticFile(urlPath) {
  let pathname
  try {
    pathname = decodeURIComponent(new URL(urlPath, 'http://localhost').pathname)
  } catch {
    return null
  }
  const requestedPath = pathname === '/' ? '/index.html' : pathname
  const candidate = path.resolve(distDirectory, `.${requestedPath}`)
  if (!candidate.startsWith(`${distDirectory}${path.sep}`)) return null

  try {
    const file = await stat(candidate)
    if (file.isFile()) return candidate
  } catch {
    // Client-side routes fall back to index.html below.
  }

  if (pathname.startsWith('/assets/')) return null
  return path.join(distDirectory, 'index.html')
}

async function serveFrontend(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD' })
    response.end()
    return
  }

  const filePath = await resolveStaticFile(request.url)
  if (!filePath) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('Not found')
    return
  }

  const extension = path.extname(filePath).toLowerCase()
  const isAsset = filePath.includes(`${path.sep}assets${path.sep}`)
  response.writeHead(200, {
    'content-type': contentTypes[extension] || 'application/octet-stream',
    'cache-control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  if (request.method === 'HEAD') {
    response.end()
    return
  }
  createReadStream(filePath).pipe(response)
}

const server = createServer((request, response) => {
  if (request.url?.startsWith('/api/')) {
    proxyApiRequest(request, response)
    return
  }
  serveFrontend(request, response).catch((error) => {
    console.error('Frontend request failed:', error.message)
    if (!response.headersSent) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
    }
    response.end('Internal server error')
  })
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Hostly Admin listening on port ${port}`)
})

process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})
