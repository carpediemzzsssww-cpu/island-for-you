#!/usr/bin/env node
// 小红书小工具产物的静态检查（官方 audit 只查体积，这里查内容）。
// 合并自 Lot 665 音乐盒 scripts/check-minitool.mjs 和 POT POT tools/minitool/audit.mjs。
//
//   node scripts/minitool/check-minitool.mjs [buildDir]      默认 dist-minitool
//
// 查五类问题：
//  1. JS 语法不超过 ES2017，而且是经典脚本（Android 8.1 WebView / Chrome 61 基线），正则语法也算
//  2. 官方能力扫描清单（device-capabilities.md §6）里的调用和残留
//  3. Chrome 61 上会让整条规则失效的 CSS
//  4. 文件类型是否在平台上传白名单里，引用是否都是包内相对路径且存在
//  5. 大 base64、音视频引用（平台拒收音视频文件）
// 解析器按顺序找：rolldown/parseAst → rollup/parseAst → acorn（装了 Vite 就至少有一个）。
import fs from 'node:fs'
import path from 'node:path'

const dir = path.resolve(process.argv[2] || 'dist-minitool')
if (!fs.existsSync(dir)) {
  console.error(`${dir} 不存在，先构建`)
  process.exit(1)
}
const errors = []
const notes = []

// 平台上传实际接受的扩展名（音视频会被拒收，和官方文档写的不一样）
const ALLOWED = new Set(['.html', '.css', '.js', '.json', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.woff', '.woff2'])
const MEDIA = /\.(mp3|m4a|aac|ogg|oga|wav|flac|opus|mp4|webm|mov|m4v)$/i

// ── 文件清单 ──────────────────────────────────────────────
const files = []
;(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else files.push(path.relative(dir, p).split(path.sep).join('/'))
  }
})(dir)
const has = (f) => files.includes(f)
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8')

for (const f of files) {
  if (MEDIA.test(f)) errors.push(`${f}: 音视频文件，平台上传会被拒收（改用 Web Audio 合成，见 xhs-minitool §2）`)
  else if (!ALLOWED.has(path.extname(f).toLowerCase())) errors.push(`${f}: 不在上传白名单里`)
  if (/(^|\/)(\.DS_Store|__MACOSX|node_modules|\.git)(\/|$)|\.map$/.test(f)) errors.push(`${f}: 开发文件不能进包`)
}
if (!has('index.html')) errors.push('index.html 不在根目录')
const htmlFiles = files.filter((f) => f.endsWith('.html'))
if (htmlFiles.length > 1) notes.push(`包里有 ${htmlFiles.length} 个 HTML：${htmlFiles.join(', ')}（入口只认根目录 index.html）`)

// ── 1. JS 语法 ───────────────────────────────────────────
async function loadParser() {
  try {
    const { parseAst } = await import('rolldown/parseAst')
    return { name: 'rolldown', parse: (code) => parseAst(code, { sourceType: 'script' }) }
  } catch {}
  try {
    const { parseAst } = await import('rollup/parseAst')
    return { name: 'rollup', parse: (code) => parseAst(code) }
  } catch {}
  try {
    const acorn = await import('acorn')
    return { name: 'acorn', parse: (code) => acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script' }) }
  } catch {}
  return null
}

const jsFiles = files.filter((f) => f.endsWith('.js'))
const parser = await loadParser()
if (!parser) notes.push('没找到 JS 解析器（rolldown / rollup / acorn），**跳过了语法检查**，交付说明里要写明')

const FUNCTION_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])
function checkSyntax(file, code) {
  let ast
  try {
    ast = parser.parse(code)
  } catch (e) {
    errors.push(`${file}: 不能按经典脚本解析（${parser.name}）：${e.message}`)
    return
  }
  const found = new Map()
  const hit = (what, node) => {
    const entry = found.get(what) || { n: 0, sample: '' }
    entry.n++
    if (!entry.sample && typeof node.start === 'number')
      entry.sample = code.slice(Math.max(0, node.start - 30), Math.min(code.length, node.end + 20)).replace(/\s+/g, ' ')
    found.set(what, entry)
  }
  const walk = (node, depth) => {
    if (!node || typeof node.type !== 'string') return
    switch (node.type) {
      case 'ImportDeclaration':
      case 'ExportNamedDeclaration':
      case 'ExportDefaultDeclaration':
      case 'ExportAllDeclaration':
        hit('import / export（模块语法）', node)
        break
      case 'ImportExpression':
        hit('动态 import()（ES2020）', node)
        break
      case 'MetaProperty':
        if (node.meta && node.meta.name === 'import') hit('import.meta', node)
        break
      case 'ChainExpression':
        hit('可选链 ?.（ES2020）', node)
        break
      case 'LogicalExpression':
        if (node.operator === '??') hit('空值合并 ??（ES2020）', node)
        break
      case 'AssignmentExpression':
        if (['||=', '&&=', '??='].includes(node.operator)) hit('逻辑赋值（ES2021）', node)
        break
      case 'PropertyDefinition':
      case 'AccessorProperty':
        hit('class 字段（ES2022）', node)
        break
      case 'PrivateIdentifier':
        hit('私有 #name（ES2022）', node)
        break
      case 'StaticBlock':
        hit('class static 块（ES2022）', node)
        break
      case 'ObjectExpression':
        if (node.properties.some((p) => p.type === 'SpreadElement')) hit('对象展开 {...x}（ES2018）', node)
        break
      case 'ObjectPattern':
        if (node.properties.some((p) => p.type === 'RestElement')) hit('对象剩余 {...x} =（ES2018）', node)
        break
      case 'ForOfStatement':
        if (node.await) hit('for await（ES2018）', node)
        break
      case 'CatchClause':
        if (!node.param) hit('catch 不带参数（ES2019）', node)
        break
      case 'AwaitExpression':
        if (depth === 0) hit('顶层 await', node)
        break
      case 'Literal': {
        if (typeof node.bigint === 'string') hit('BigInt 字面量（ES2020）', node)
        else if (typeof node.raw === 'string' && typeof node.value === 'number' && node.raw.includes('_')) hit('数字分隔符（ES2021）', node)
        else if (node.regex) {
          const { pattern, flags } = node.regex
          if (flags.includes('s')) hit('正则 /s（ES2018）', node)
          if (/[dv]/.test(flags)) hit('正则 /d 或 /v（ES2022+）', node)
          if (/\(\?<[=!]/.test(pattern)) hit('正则后行断言（ES2018）', node)
          if (/\(\?<[A-Za-z_$]/.test(pattern)) hit('正则命名分组（ES2018）', node)
          if (/\\[pP]\{/.test(pattern)) hit('正则 \\p{} 转义（ES2018）', node)
        }
        break
      }
      case 'TemplateElement':
        if (node.value && node.value.cooked === null) hit('模板字符串非法转义（ES2018）', node)
        break
    }
    const nextDepth = FUNCTION_TYPES.has(node.type) ? depth + 1 : depth
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue
      const v = node[key]
      if (Array.isArray(v)) v.forEach((c) => c && typeof c === 'object' && walk(c, nextDepth))
      else if (v && typeof v === 'object') walk(v, nextDepth)
    }
  }
  walk(ast.program || ast, 0)
  for (const [what, { n, sample }] of found) errors.push(`${file}: ${what} × ${n}${sample ? ` —— …${sample}…` : ''}`)
}
if (parser) for (const f of jsFiles) checkSyntax(f, read(f))

// ── 2. 官方能力扫描清单 ─────────────────────────────────────
const BANNED = [
  ['fetch(', /\bfetch\(/],
  ['XMLHttpRequest', /XMLHttpRequest/],
  ['WebSocket / EventSource / RTCPeerConnection', /new (WebSocket|EventSource|RTCPeerConnection)\(/],
  ['geolocation', /geolocation\.(getCurrentPosition|watchPosition)/],
  ['clipboard', /navigator\.clipboard|execCommand\(\s*['"`](copy|cut|paste)/],
  ['bluetooth / usb / hid / serial', /navigator\.(bluetooth|usb|hid|serial)\b/],
  ['getBattery / connection / credentials / locks', /navigator\.(getBattery|connection|credentials|locks)\b/],
  ['enumerateDevices / getDisplayMedia', /(enumerateDevices|getDisplayMedia)\(/],
  ['storage.persist / serviceWorker', /storage\.persist\(|serviceWorker\.register\(/],
  ['Worker / SharedWorker', /new (Shared)?Worker\(/],
  ['传感器', /new (Accelerometer|Gyroscope|Magnetometer)\(|DeviceMotionEvent|DeviceOrientationEvent|['"`]device(motion|orientation)['"`]/],
  ['全屏', /(webkitR|r)equestFullscreen/],
  ['eval / new Function / WebAssembly', /(^|[^\w$.])eval\(|new Function\(|WebAssembly\./],
  ['window.open / prompt', /window\.(open|prompt)\(/],
  ['站外跳转', /location\.href\s*=[^=]|location\.assign\(/],
  ['浏览器下载', /\.download\s*=[^=]|<a\b[^>]*\sdownload\b|\bdownload\s*:\s*(!0|true|['"`])/],
  ['新窗口', /target\s*[:=]\s*['"`]_blank/],
  ['外部资源', /(src|href)\s*[:=]\s*['"`]https?:\/\/|url\(\s*['"]?https?:/],
]
const textFiles = files.filter((f) => /\.(js|css|html)$/.test(f))
for (const f of textFiles) {
  const text = read(f)
  for (const [label, re] of BANNED) {
    const m = text.match(new RegExp(re.source, 'g'))
    if (m) errors.push(`${f}: 命中能力扫描「${label}」× ${m.length}`)
  }
}

// ── 3. Chrome 61 的 CSS ──────────────────────────────────
for (const f of files.filter((x) => x.endsWith('.css'))) {
  const css = read(f)
  const unguarded = css.replace(/@supports[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
  for (const [, selRaw, body] of unguarded.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = selRaw.trim()
    if (sel.startsWith('@')) continue
    const short = sel.slice(0, 70)
    if (/:(is|where|has)\(/.test(sel)) errors.push(`${f}: 选择器 ${short} 用了 :is / :where / :has，Chrome 61 会丢掉整条规则`)
    if (sel.includes(':focus-visible') && sel.includes(',')) errors.push(`${f}: :focus-visible 混在选择器列表里，Chrome 61 会丢掉整条规则 —— ${short}`)
    if (/(^|[\s,>+~])&/.test(sel)) errors.push(`${f}: CSS 嵌套 & —— ${short}`)
    const decls = body.split(';').map((d) => d.trim()).filter(Boolean)
    decls.forEach((d, i) => {
      const prop = d.split(':')[0].trim()
      const hasFallback = decls.slice(0, i).some((e) => e.split(':')[0].trim() === prop)
      if (/^inset\s*:/.test(d)) errors.push(`${f}: inset 简写（Chrome 87）—— ${short}`)
      if (/\b(clamp|min|max)\(/.test(d) && !hasFallback) errors.push(`${f}: ${d.slice(0, 60)} 前面没有普通值兜底 —— ${short}`)
      // 含 var() 的声明在解析时永远合法，env() 不认只会在计算时失效 → 属性变成初始值，前面的兜底也救不回来
      if (/\benv\(/.test(d) && (/\bvar\(/.test(d) || !hasFallback))
        notes.push(`${f}: ${d.slice(0, 70)}：Chrome 61 不认 env()，这条会失效且没有兜底（用 @supports 守护的变量或 kit 的 JS 变量）`)
      if (/\b\d*\.?\d+(dvh|svh|lvh)\b/.test(d) && !hasFallback) notes.push(`${f}: ${prop} 用了动态视口单位，前面没有 vh 兜底 —— ${short}`)
      if (/^(aspect-ratio|backdrop-filter|padding-inline|padding-block|margin-inline|margin-block|inset-inline|inset-block)\b/.test(prop))
        notes.push(`${f}: ${prop} 在 Chrome 61 不可用，确认有回退 —— ${short}`)
      if (/^(gap|row-gap|column-gap)$/.test(prop) && !/flex-gap|grid/i.test(sel))
        notes.push(`${f}: ${prop}：Flex 布局的 gap 要 Chrome 84（Grid 可以；已用能力检测类守护的忽略）—— ${short}`)
    })
  }
  if (/@layer\b/.test(css)) errors.push(`${f}: @layer（Chrome 99），Chrome 61 会丢掉整块`)
  if (/@container\b/.test(unguarded)) notes.push(`${f}: @container 查询在 Chrome 61 不生效`)
}

// ── 4. 引用 ───────────────────────────────────────────────
if (has('index.html')) {
  const html = read('index.html')
  for (const [, ref] of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
    if (ref.startsWith('data:') || ref.startsWith('#')) continue
    if (!ref.startsWith('./')) errors.push(`index.html: 引用 "${ref}" 不是 ./ 开头的相对路径`)
    else if (!has(decodeURI(ref.slice(2)).split(/[?#]/)[0])) errors.push(`index.html: "${ref}" 不在包里`)
  }
  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) errors.push('index.html: 内联 <script>')
  if (/type\s*=\s*["']module["']/i.test(html)) errors.push('index.html: type="module" 脚本')
  if (/\son[a-z]+\s*=\s*["']/i.test(html)) errors.push('index.html: 内联事件处理（onclick= 之类）')
  if (/<(base|iframe|object|form)\b|http-equiv\s*=\s*["']Content-Security-Policy/i.test(html)) errors.push('index.html: <base> / <iframe> / <object> / <form> / CSP meta')
  if (!/viewport-fit\s*=\s*cover/.test(html)) notes.push('index.html: viewport 没有 viewport-fit=cover，安全区变量不会生效')
}
for (const f of files.filter((x) => x.endsWith('.css'))) {
  const css = read(f)
  for (const [, raw] of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    const url = raw.trim()
    if (url.startsWith('data:') || url.startsWith('#') || url.startsWith('%23')) continue
    if (/^https?:|^\//.test(url)) errors.push(`${f}: url(${url}) 不是包内相对路径`)
    else {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(f), url.split(/[?#]/)[0]))
      if (!has(target)) errors.push(`${f}: url(${url}) 指向的 ${target} 不在包里`)
    }
  }
}
// JS 里写死的包内路径（相对 index.html 解析）
const ASSET_REF = /['"`](?:\.\/)?((?:[\w-]+\/)*[\w.-]+\.(?:png|jpe?g|gif|webp|svg|json|woff2?))['"`]/g
for (const f of jsFiles) {
  const js = read(f)
  for (const [, ref] of js.matchAll(ASSET_REF)) {
    if (!ref.includes('/') && !/^(assets|images|img|fonts|textures)/.test(ref)) continue // 只看像路径的
    if (!has(ref)) errors.push(`${f}: 引用了 ${ref}，包里没有`)
  }
  const media = js.match(/['"`][^'"`\s]*\.(mp3|m4a|aac|ogg|oga|wav|flac|opus|mp4|webm|mov)['"`]/gi) || []
  media.forEach((m) => errors.push(`${f}: 引用了音视频文件 ${m}，平台不收音视频`))
}

// ── 5. 大 base64 ─────────────────────────────────────────
for (const f of textFiles) {
  const text = read(f)
  for (const m of text.matchAll(/data:([\w/+.-]+);base64,([A-Za-z0-9+/=]{1000,})/g)) {
    const bytes = Math.floor((m[2].length * 3) / 4)
    const kib = (bytes / 1024).toFixed(0)
    if (bytes > 1024 * 1024) errors.push(`${f}: ${m[1]} base64 解码后 ${kib} KiB，超过 1 MiB，必须改成包内文件`)
    else if (bytes > 100 * 1024) notes.push(`${f}: ${m[1]} base64 解码后 ${kib} KiB，超过 100 KiB，优先改成包内文件`)
    if (/^(audio|video)\//.test(m[1])) notes.push(`${f}: 内嵌 ${m[1]}：只能交给 Web Audio 解码，不能当 <audio>/<video> 的 src（容器 CSP 不支持 data: 媒体）`)
  }
}

// ── 输出 ─────────────────────────────────────────────────
let total = 0
console.log(`检查 ${dir}（${files.length} 个文件${parser ? `，语法解析：${parser.name}` : ''}）`)
for (const f of files) {
  const size = fs.statSync(path.join(dir, f)).size
  total += size
  console.log(`  ${f}  ${(size / 1024).toFixed(1)} KiB`)
}
console.log(`  合计 ${(total / 1048576).toFixed(2)} MiB（未压缩）`)
;[...new Set(notes)].forEach((n) => console.log(`NOTE: ${n}`))
;[...new Set(errors)].forEach((e) => console.log(`ERROR: ${e}`))
console.log(errors.length ? `FAILED：${new Set(errors).size} 个问题` : 'PASS：ES2017 经典脚本、无禁用能力、CSS 有回退、引用完整、只含白名单文件')
process.exitCode = errors.length ? 1 : 0
