#!/usr/bin/env node
// 小工具产物的本地预览：严格 CSP + 挂在子目录下（像容器那样从非根路径加载，顺便验证相对路径）。
// 改自 POT POT tools/minitool/serve.mjs。
//
//   node scripts/minitool/serve-csp.mjs [buildDir] [port]     默认 dist-minitool 5176
//   打开 http://localhost:5176/nested/app/
//
// 终端会打印每个 404（包里缺的文件）。这只是本地近似，不等于创服平台模拟器或真机验收。
import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(process.argv[2] || 'dist-minitool')
const port = Number(process.argv[3] || 5176)
const PREFIX = '/nested/app/'
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "media-src 'self'",
  "connect-src 'none'",
  "worker-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost')
    let p = decodeURIComponent(url.pathname)
    if (p === '/' || p === PREFIX.slice(0, -1)) {
      res.writeHead(302, { Location: PREFIX })
      return res.end()
    }
    if (!p.startsWith(PREFIX)) {
      console.log(`404 包外路径（引用了绝对路径？）：${p}`)
      res.writeHead(404)
      return res.end('outside the package')
    }
    p = p.slice(PREFIX.length) || 'index.html'
    const file = path.resolve(root, p)
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403)
      return res.end()
    }
    try {
      const body = await fs.readFile(file)
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Security-Policy': CSP,
        'Cache-Control': 'no-store',
      })
      res.end(body)
    } catch {
      console.log(`404 包里没有：${p}`)
      res.writeHead(404)
      res.end('not in the package')
    }
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`严格 CSP 预览：http://localhost:${port}${PREFIX}`)
    console.log('看浏览器控制台里的 CSP 报错：任何外部请求、内联脚本、eval 都会在那里出现')
  })
