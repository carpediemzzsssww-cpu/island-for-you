// 小红书小工具版的 Vite 配置模板（合并自 Lot 665 音乐盒、POT POT 的实战配置）。
//
// 放到项目根目录，改下面几个常量；package.json 加：
//   "dev:minitool":   "vite --config vite.minitool.config.ts"
//   "build:minitool": "vite build --config vite.minitool.config.ts && node scripts/minitool/package-minitool.mjs --force"
//
// 产物：<OUT_DIR>/assets/app.js（经典 IIFE 脚本，不是 module）+ assets/app.css，
// 目标 ES2017 / Chrome 61（Android 8.1 WebView 基线），全部相对路径，不联网。
// index.html 由 package-minitool.mjs 写，不经过 Vite 的 HTML 处理（那会生成 type="module"）。
// 代码里用 import.meta.env.MODE === 'minitool' 区分小工具版和网页版的行为。
import { defineConfig, version as viteVersion, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import miniAdapt from './scripts/minitool/transform.mjs'
import compatCSS from './scripts/minitool/compat-css.mjs'

const ENTRY = 'src/minitool.tsx' // 小工具入口：import 安全区样式、调 installLayoutVars()、再挂主应用
const OUT_DIR = 'dist-minitool' // 独立目录，不覆盖网页版 dist
const DEV_PORT = 5174
const STUB_THREE_XR = true // 小工具用不到 WebXR：换成空实现，也少一截代码
const ROLLDOWN = Number(viteVersion.split('.')[0]) >= 8 // Vite 8 起用 rolldown，IIFE 默认就不拆包

/**
 * 容器不联网，包里也不能留联网代码（官方能力扫描会命中）。常见的几处：
 *  - three 的 FileLoader / ImageBitmapLoader 用了 fetch()。贴图都在内存里画、或用 <img> / ImageLoader
 *    加载包内图片时，可以直接桩掉；如果项目靠 FileLoader 读包内文件，先改掉，别留着 fetch。
 *  - three 的 WebXRManager（requestSession 等）。
 *  - React DOM 读 navigator.connection 估算带宽。
 * three 或 React 升级后结构变了、匹配不到时，这里会报错或警告，提醒人工复核，而不是悄悄留下联网代码。
 */
function offlineOnly(): Plugin {
  const fetchStub =
    'function __mtOffline(){return Promise.reject(new Error("offline: the mini-tool loads nothing from the network"))}\n'
  const xrStub =
    'class WebXRManager extends EventDispatcher{constructor(){super();this.enabled=false;this.isPresenting=false;this.cameraAutoUpdate=false}' +
    'getSession(){return null}getCamera(){return null}getController(){return null}getControllerGrip(){return null}getHand(){return null}' +
    'setAnimationLoop(){}dispose(){}getEnvironmentBlendMode(){return "opaque"}hasDepthSensing(){return false}getDepthSensingMesh(){return null}}'
  let stubbedXR = false
  let sawThree = false
  return {
    name: 'minitool-offline-only',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0]
      // three r160+ 拆成 three.core.js + three.module.js；更早只有 three.module.js
      if (/[\\/]three[\\/]build[\\/]three\.(core|module)\.js$/.test(file)) {
        sawThree = true
        let out = code
        if (out.includes('fetch(')) out = fetchStub + out.replace(/\bfetch\(/g, '__mtOffline(')
        if (STUB_THREE_XR && out.includes('class WebXRManager')) {
          const ctx = this as unknown as { parse?: (code: string) => { body: Array<Record<string, any>> } }
          if (typeof ctx.parse !== 'function') this.error('当前构建器没有 this.parse：把 STUB_THREE_XR 改成 false')
          const node = ctx.parse!(out).body.find((n) => n.type === 'ClassDeclaration' && n.id && n.id.name === 'WebXRManager')
          if (!node) this.error('three 的 WebXRManager 结构变了：先打开 three.module.js 复核，再改这个插件')
          out = out.slice(0, node!.start) + xrStub + out.slice(node!.end)
          stubbedXR = true
        }
        return out === code ? null : { code: out, map: null }
      }
      if (
        /[\\/]react-dom[\\/]cjs[\\/]react-dom(-client)?\.(production|development)(\.min)?\.js$/.test(file) &&
        code.includes('navigator.connection')
      ) {
        return { code: code.replace(/navigator\.connection/g, 'undefined'), map: null }
      }
      return null
    },
    buildEnd() {
      if (STUB_THREE_XR && sawThree && !stubbedXR) this.warn('用了 three，但没找到 WebXRManager：XR 桩没生效，检查一下 three 的结构')
    },
  }
}

export default defineConfig(({ command }) => ({
  mode: 'minitool',
  plugins: [miniAdapt(), offlineOnly(), react()],
  base: './',
  // dev 时照常用 public/；打包时不自动拷 public，包里只放需要的文件（字体、海报放进 package-minitool 的 EXTRA_DIR）。
  // CSS / JS 里引用资源要用相对路径或 import，写成 /fonts/x.woff2 这种绝对路径会被 check-minitool 拦下。
  publicDir: command === 'serve' ? 'public' : false,
  server: { host: true, port: DEV_PORT },
  // 项目在 iCloud 桌面、node_modules 是指向 .nosync 目录的软链接时，打开这一行
  resolve: { preserveSymlinks: true },
  css: {postcss:{plugins:[compatCSS()]}},
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    target: ['es2017', 'chrome61'],
    cssTarget: ['chrome61'],
    modulePreload: false, // preload 辅助代码用 fetch()，容器里不能有
    cssCodeSplit: false,
    sourcemap: false,
    assetsInlineLimit: 0, // 不把资源偷偷转成 base64（官方对大 base64 有上限）
    reportCompressedSize: false,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      input: ENTRY,
      output: {
        format: 'iife',
        banner: 'var globalThis=window;', // 经典脚本：没有 type="module"，没有 import / export
        ...(ROLLDOWN ? {} : { inlineDynamicImports: true }), // Vite 7 及以前：IIFE 必须把动态 import 内联
        entryFileNames: 'assets/app.js',
        assetFileNames: (info) => {
          const name = (info.names && info.names[0]) || info.name || ''
          return name.endsWith('.css') ? 'assets/app.css' : 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
}))
