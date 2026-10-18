// 小红书小工具端能力的薄封装（保存相册、一键发笔记、本地存储、安全区变量）。
// Checked against the online contract on 2026-10-18 with builder 1.8.0.
// （实况：live_photo_resources → live_photo_sources），动手前先对照在线文档：
// https://miniapp-sandbox.xiaohongshu.com/minitool/doc
//
// 在普通浏览器里也能调用：拿不到 bridge 时返回 'unavailable'，调用方给提示并保留作品。
// 故意不用 ?. / ?? / catch {}，粘到不经转译的纯 JS 项目里也能在 Chrome 61 上跑（删掉类型即可）。

export type BridgeResult = 'done' | 'unavailable' | 'failed'

interface LaunchOptions {
  miniToolEnv?: { buildVersion?: number | string; userDataPath?: string }
}
interface MiniTool {
  saveFile?: (o:{tempFilePath:string;filePath?:string})=>Promise<{savedFilePath:string}>
  readFile?: (o:{filePath:string;encoding:"base64";position?:number;length?:number})=>Promise<{data:string;bytesRead:number;eof:boolean}>
  unlink?: (o:{filePath:string})=>Promise<unknown>
  getFileStorageInfo?: ()=>Promise<{readChunkMaxBytes:number}>
  writeTempFile?: (o: { data: string }) => Promise<{ filePath: string }>
  saveImageToPhotosAlbum?: (o: { filePath: string }) => Promise<unknown>
  postNote?: (o: Record<string, unknown>) => Promise<unknown>
  getLaunchOptions?: () => Promise<LaunchOptions>
  setStorage?: (o: { key: string; data: string; encrypt?: boolean }) => Promise<unknown>
  getStorage?: (o: { key: string; encrypt?: boolean }) => Promise<{ data: string }>
  removeStorage?: (o: { key: string }) => Promise<unknown>
}
declare global {
  interface Window {
    xhs?: { miniTool?: MiniTool; launchOptions?: LaunchOptions }
  }
}

export function getMiniTool(): MiniTool | null {
  const xhs = window.xhs
  return (xhs && xhs.miniTool) || null
}

/** 端能力偶尔不回调；每一步最多等 ms（罐罐用 20 s）。 */
export function withTimeout<T>(p: Promise<T>, ms = 20000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('bridge timeout')), ms)
    Promise.resolve(p).then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

/** 客户端版本：buildVersion 末三位是编译序号，9462004 → 9462（= 9.46.2）。拿不到返回 0。 */
let versionPromise: Promise<number> | null = null
export function getClientVersion(): Promise<number> {
  if (!versionPromise) {
    versionPromise = (async () => {
      const read = (o?: LaunchOptions) =>
        Math.floor((Number(o && o.miniToolEnv && o.miniToolEnv.buildVersion) || 0) / 1000)
      const sync = read(window.xhs && window.xhs.launchOptions)
      if (sync) return sync
      const mt = getMiniTool()
      if (!mt || typeof mt.getLaunchOptions !== 'function') return 0
      try {
        return read(await withTimeout(mt.getLaunchOptions(), 5000))
      } catch (_e) {
        return 0
      }
    })()
  }
  return versionPromise
}

/** 画布转 PNG data URI，长边不超过 maxSide。WebGL 画布要在同一帧先 render 一次（或开 preserveDrawingBuffer）。 */
export function canvasToDataUrl(canvas: HTMLCanvasElement, maxSide = 1440): string {
  const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height))
  if (scale >= 1) return canvas.toDataURL('image/png')
  const out = document.createElement('canvas')
  out.width = Math.round(canvas.width * scale)
  out.height = Math.round(canvas.height * scale)
  const ctx = out.getContext('2d')
  if (ctx) ctx.drawImage(canvas, 0, 0, out.width, out.height)
  const url = out.toDataURL('image/png')
  out.width = out.height = 1 // 尽快释放显存
  return url
}

/** 大图先写成临时文件（官方建议）；失败就直接用 data URI。 */
async function toLocalPath(mt: MiniTool, image: HTMLCanvasElement | string): Promise<string> {
  if (typeof image === 'string' && !image.startsWith('data:')) return image // 已经是本地路径
  const dataUrl = typeof image === 'string' ? image : canvasToDataUrl(image)
  if (typeof mt.writeTempFile !== 'function') return dataUrl
  try {
    const r = await withTimeout(mt.writeTempFile({ data: dataUrl }))
    return (r && r.filePath) || dataUrl
  } catch (_e) {
    return dataUrl
  }
}

/** 保存到系统相册。只能在用户点击里调用（首次会弹权限）。失败不要清掉作品。 */
export async function saveToAlbum(image: HTMLCanvasElement | string): Promise<BridgeResult> {
  const mt = getMiniTool()
  if (!mt || typeof mt.saveImageToPhotosAlbum !== 'function') return 'unavailable'
  try {
    const filePath = await toLocalPath(mt, image)
    await withTimeout(mt.saveImageToPhotosAlbum({ filePath }))
    return 'done'
  } catch (_e) {
    return 'failed'
  }
}

/**
 * 一键发图文笔记：title ≤ 20 字，content ≤ 1000 字，图片 1–18 张。
 * 返回 'done' 只代表发布页打开了，不代表笔记发出去或过审。
 * 视频用 pageType 'video_publish' + video_resources；实况用 'slides_edit' + live_photo_sources（9.43+）。
 */
export async function postImageNote(
  images: Array<HTMLCanvasElement | string>,
  text: { title?: string; content?: string } = {},
): Promise<BridgeResult> {
  const mt = getMiniTool()
  if (!mt || typeof mt.postNote !== 'function') return 'unavailable'
  try {
    const urls: string[] = []
    for (const image of images.slice(0, 18)) urls.push(await toLocalPath(mt, image))
    await withTimeout(
      mt.postNote({
        title: (text.title || '').slice(0, 20),
        content: (text.content || '').slice(0, 1000),
        pageType: 'photo_publish',
        mediaInfo: { image_resources: urls.map((url) => ({ url })) },
      }),
      30000,
    )
    return 'done'
  } catch (_e) {
    return 'failed'
  }
}

/** 本地存储：9.46+ 用小工具 Storage（单 key ≤ 1 MB，总共 ≤ 10 MB），更低版本退回 localStorage。返回是否写成功。 */
const STORAGE_MIN_CLIENT = 9460
export async function setLocalData(key: string, value: unknown): Promise<boolean> {
  let data: string
  try {
    data = JSON.stringify(value)
  } catch (_e) {
    return false
  }
  if (typeof data !== 'string') return false
  const mt = getMiniTool()
  if (mt && typeof mt.setStorage === 'function' && (await getClientVersion()) >= STORAGE_MIN_CLIENT) {
    try {
      await withTimeout(mt.setStorage({ key, data }))
      return true
    } catch (_e) {
      return false
    }
  }
  try {
    window.localStorage.setItem(key, data)
    return true
  } catch (_e) {
    return false
  }
}

export async function getLocalData<T>(key: string): Promise<T | null> {
  const mt = getMiniTool()
  if (mt && typeof mt.getStorage === 'function' && (await getClientVersion()) >= STORAGE_MIN_CLIENT) {
    try {
      const r = await withTimeout(mt.getStorage({ key }))
      if (r && typeof r.data === 'string' && r.data) return JSON.parse(r.data) as T
    } catch (_e) {
      return null
    }
  }
  try {
    const s = window.localStorage.getItem(key)
    return s ? (JSON.parse(s) as T) : null
  } catch (_e) {
    return null
  }
}

/**
 * 把安全区、顶部避让和可视高度写成 px 变量，配合 safe-area.css 使用：
 *   --mt-safe-top / --mt-safe-bottom / --mt-top（= max(64, 安全区 + 44)）/ --app-height
 * Chrome 61 不认 env()，所以用一个探针元素量出实际值。PC 模拟器注入的是 --safe-area-inset-* 变量，一起兼容。
 * 开发时在 URL 加 ?safetop=47 可以模拟刘海屏。返回 update，布局变化时可以手动再调。
 */
export function installLayoutVars(opts: { nav?: number; minTop?: number } = {}): () => void {
  const nav = opts.nav == null ? 44 : opts.nav
  const minTop = opts.minTop == null ? 64 : opts.minTop
  const probe = document.createElement('div')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText =
    'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
    'padding-top:var(--safe-area-inset-top, env(safe-area-inset-top, 0px));' +
    'padding-bottom:var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));'
  document.body.appendChild(probe)
  const forced = Number(new URLSearchParams(window.location.search).get('safetop')) || 0
  const update = () => {
    const cs = getComputedStyle(probe)
    const top = forced > 0 ? forced : parseFloat(cs.paddingTop) || 0
    const bottom = parseFloat(cs.paddingBottom) || 0
    const vv = window.visualViewport
    const s = document.documentElement.style
    s.setProperty('--mt-safe-top', top + 'px')
    s.setProperty('--mt-safe-bottom', bottom + 'px')
    s.setProperty('--mt-top', Math.max(minTop, top + nav) + 'px')
    // 页面不可见时量到的高度是 0：这时不写，让 CSS 退回 100vh，等可见了再量
    const height = Math.round(vv ? vv.height : window.innerHeight)
    if (height > 0) s.setProperty('--app-height', height + 'px')
    else s.removeProperty('--app-height')
  }
  update()
  window.addEventListener('resize', update)
  window.addEventListener('orientationchange', update)
  document.addEventListener('visibilitychange', update)
  if (window.visualViewport) window.visualViewport.addEventListener('resize', update)
  return update
}
