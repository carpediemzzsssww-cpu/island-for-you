# 做一座自己的岛

[← 回到 README](../README.md)

可以把它做成毕业纪念、旅行小岛、送给朋友的礼物，或者一个只放自己喜欢的东西的地方。先让现有小岛在电脑上跑起来，再一点点换成你的内容。

- [准备自己的副本](#准备自己的副本)
- [名字和文案](#名字和文案)
- [替换图片](#替换图片)
- [替换音乐](#替换音乐)
- [颜色和字体](#颜色和字体)
- [场景和交互](#场景和交互)
- [部署自己的岛](#部署自己的岛)
- [制作小红书小工具](#制作小红书小工具)
- [遇到问题](#遇到问题)

## 准备自己的副本

在 GitHub 点 **Fork**，把仓库复制到自己名下，再从自己的仓库页面复制克隆地址。下面的 `YOUR_USERNAME` 换成你的用户名：

```sh
git clone https://github.com/YOUR_USERNAME/island-for-you.git
cd island-for-you
npm ci
npm run dev
```

需要 Git 和 Node.js 22.12+。可以用 VS Code、Cursor 或其他编辑器打开这个目录。网页能跑起来后，在 `src/content.ts` 把 `site.brand` 从 `Hi` 改成 `Sea` 并保存：左上角的变化就是你的第一次二创。

普通运行使用已经提交的素材。只有处理图片才需要 Python / Pillow，生成音乐才需要 FFmpeg，重建建筑才需要 Blender。不要为了改一句话先把所有工具装齐。

## 名字和文案

在 [src/content.ts](../src/content.ts) 修改现有的 `site`，不要另加一个同名变量：

```ts
export const site = {
  friend: '来访的人',
  from: '海边的朋友',
  brand: 'Sea',
};
```

`brand` 是左上角的短标识，建议保持几个字符；`friend` 和 `from` 用在称呼、手机消息等位置。场景名和介绍在同文件的 `places` 中，例如改 `home.name`、`home.description`。先保留 `home`、`sunset` 等对象键名，它们也是程序与存档中的标识。

欢迎语、手账、按钮等文字分散在组件里，可以统一导出：

```sh
node scripts/copy-deck.mjs export
```

打开根目录生成的 `文案清单.md`，只改每条 `- 中文:` 后面的内容。保留标题里的 `#编号` 和 `{1}`、`{2}` 占位符；每条保持一行，需要换行的地方使用字面量 `\n`。完成后写回：

```sh
node scripts/copy-deck.mjs apply
npm run build
```

导出会同时生成 `scripts/copy-deck.key.json`，写回时需要它。两份文件都是本地编辑辅助文件，已被 Git 忽略；真正应提交的是写回后的源码。**未写回的清单不要再次 export，否则手动修改会被覆盖。** 如果期间改过源码，先备份清单，查看 apply 输出中的未匹配提示。

浏览器标签页标题和搜索介绍在 [index.html](../index.html)，也会进入清单。英文场景介绍仍在 `content.ts`。新增中文若显示成不同字体或方框，见[字体说明](#颜色和字体)。

## 替换图片

图片由两部分组成：[public/photos](../public/photos) 中的 WebP 文件，以及根目录 [assets-manifest.json](../assets-manifest.json) 中的清单。照片墙、桌面和海边明信片共用它们。

### 只换一张

例如把 `sunset-03` 换成自己的天空：

1. 准备一张不带定位等元数据的图片，导出最长边不超过 1440 px 的 `sunset-03.webp`，以及最长边不超过 320 px 的 `sunset-03_thumb.webp`，替换 `public/photos/` 下对应文件。
2. 在清单中找到 `id: "sunset-03"`，更新 `caption`、`width`、`height`；宽高使用图片真实比例，保留 `id`、`category`、`src` 和 `thumbnail`。
3. 刷新网页，打开照片墙，再去海边查看明信片。横图和竖图都要看完整。

保留 ID 可以继续关联已有手账记录。清单中的一个条目长这样（数值按你的图片填写）：

```json
{
  "id": "sunset-03",
  "category": "sunset",
  "width": 1200,
  "height": 800,
  "caption": "那天下午，海很安静。",
  "src": "./photos/sunset-03.webp",
  "thumbnail": "./photos/sunset-03_thumb.webp"
}
```

原始大图放在仓库外；网页只提交处理过的展示图和缩略图。

### 批量换成自己的图片

使用 Python 3.10+，在仓库外创建一个工具虚拟环境并安装 Pillow：

```sh
python3 -m venv ../island-tools
```

macOS / Linux 激活：`source ../island-tools/bin/activate`。Windows PowerShell 激活：`..\island-tools\Scripts\Activate.ps1`。激活后：

```sh
python -m pip install pillow
```

把图片放在仓库外，例如与项目同级的 `my-island-pictures/`：

```text
my-island-pictures/
  sunset/       至少一张天空或风景，供桌面和海边明信片使用
    01-sea.jpg
    02-dawn.png
  food/         可选
  flowers/      可选
  journal/      可选
  street/       可选
  daily/        可选
```

支持 JPG、JPEG、PNG、WebP；HEIC 转换还需要已加入 PATH 的 FFmpeg。文件按名称排序。只准备 `sunset/` 也能导入；无需人像。`portrait/`、`together/` 是自己的版本可选择的额外分类，导入器不会自动判断画面是否有人。

**导入会重建整个 `public/photos/` 和图片清单，不是追加。** 先提交或备份当前图片与清单，再在项目根目录运行：

```sh
python scripts/photos.py import ../my-island-pictures
npm run build
```

脚本生成展示图和缩略图并去除 EXIF，不会改动源文件。图片里的文字、人脸等可见信息仍需自己检查。导入后在 `assets-manifest.json` 修改每张图的说明，再打开图库和手账检查结果；重新编号的图片可能与旧存档的关联不同。

根目录下的 MP4 / MOV / M4V 会被当作可选视频处理，需要 FFmpeg；小工具只支持有限文件类型，准备小工具时不要附带视频。已有的 `artworks` 模式使用同样的目录结构，并标注生成画的来源；`placeholders` 会重建旧的完整占位图集合，其中包含人物类别，不适合直接恢复当前七张无人物示例图。当前示例见 [ARTWORK](ARTWORK.md)。

## 替换音乐

演示网页中的五首歌曲录音不属于代码的 MIT 许可范围。发布自己的岛时，请替换成你可以分发的音频。

1. 把音频放在 `public/music/`，使用简短文件名，例如 `sea-piano.mp3`。
2. 修改 [src/content.ts](../src/content.ts) 的 `tracks` 中对应条目：

```ts
arrival: {
  src: '/music/sea-piano.mp3',
  title: '海边的午后',
  artist: '你的署名',
  volume: 0.7,
},
```

3. 保留 `arrival`、`home`、`diner`、`sunrise`、`ending` 五个键，并逐一更新路径、标题、作者与音量。文件名无需和示例一致。`records` 决定播放顺序，名字来自历史场景映射，播放时会在全岛连续轮播。
4. 从你的副本中移除不再使用的录音；只改清单不会阻止旧文件随 `public/` 一起被部署。

也可以在安装带 `libmp3lame` 的 FFmpeg 后运行 `npm run music`，生成脚本里的五首音乐盒编曲：`minuet-in-g.mp3`、`twinkle.mp3`、`ode-to-joy.mp3`、`auld-lang-syne.mp3`、`prelude-in-c.mp3`。这条命令只生成文件，**不会自动更新 `tracks` 或删除旧录音**，仍要完成上面的映射和清理。

小工具用的是 [src/minitool/audio.ts](../src/minitool/audio.ts) 中的实时合成旋律，网页 MP3 不会进入小工具 ZIP。改网页曲目不会同步替换小工具旋律。

## 颜色和字体

页面基础色在 [src/style.css](../src/style.css) 的 `:root` 中：`--ink` 是文字，`--paper` 是纸张底色，`--rose` 是强调色。手机工具栏与底部操作排列在 [src/ui/hud.css](../src/ui/hud.css)。改配色不会改变建筑本身的顶点颜色。

仓库已经带字体子集，所以第一次运行无需安装字体。新增文字后，子集没收录的字可能回退到系统字体。若想继续使用同款字体，准备完整的 `GenWanMinTW-Regular.ttf` 和 `Compagnon-Roman.otf`，放在仓库外同一个目录中，再在上面创建的 Python 环境中安装：

```sh
python -m pip install fonttools brotli
```

macOS / Linux 示例：

```sh
ISLAND_FONT_DIR=../island-fonts python scripts/prepare_fonts.py
```

Windows PowerShell：

```powershell
$env:ISLAND_FONT_DIR = '../island-fonts'
python scripts/prepare_fonts.py
```

`ISLAND_FONT_DIR` 指向你实际保存这两个完整字体文件的目录。脚本会扫描源码、重新生成 `public/fonts/` 中的两个 WOFF2 子集和许可记录。**仓库里的 WOFF2 是裁剪后的字库，不能用来补出原本没有的字。** 字体版权信息见 [字体声明](../public/fonts/LICENSES.md)。

也可选用自己可分发的字体：同时修改 `style.css` 的 `@font-face`、相应 `font-family` 和字体许可说明；若继续运行子集脚本，还要把其中的源文件名与许可读取逻辑改成实际字体。不要仅把任意字体重命名成脚本要求的文件名。

## 场景和交互

| 任务 | 主要文件与注意点 |
| --- | --- |
| 改场景名称、介绍、默认视角 | [content.ts](../src/content.ts) 的 `places`；`camera` 是相机位置，`target` 是看向的点，`position` 是场景标记位置，均为 `[x, y, z]`，Y 向上 |
| 改剧情镜头 | [world/World.tsx](../src/world/World.tsx) 的 `Cameras`；吃饭、日出、看海等镜头会覆盖默认视角 |
| 改日落、日出、雨天时长 | [experience.ts](../src/experience.ts) 的 `TIMING`，单位为秒 |
| 改已有花材名称或颜色 | `content.ts` 的 `flowers`、`papers`、`ribbons`；花的几何形状在 [bouquet/geometry.ts](../src/bouquet/geometry.ts) |
| 改菜单文案或食物形状 | `content.ts` 的 `menu`；网页模型在 [world/Dishes.tsx](../src/world/Dishes.tsx)，小工具另有 [minitool/Dishes.tsx](../src/minitool/Dishes.tsx) |
| 改弹窗与按钮流程 | [ui/Artifacts.tsx](../src/ui/Artifacts.tsx)、[ui/Story.tsx](../src/ui/Story.tsx) 与 [store.ts](../src/store.ts) |
| 改现有英文招牌 | [world/anchors.json](../src/world/anchors.json) 的 `signs[].text`，普通改字无需 Blender |
| 改建筑、道路、地形 | [scripts/build_island.py](../scripts/build_island.py)，需要 Blender 4.5 |

例如想让日落更快，可以把 `TIMING.sunset` 从 `26` 改成 `20`。保留其他字段，运行页面去海边确认天空变化、倒计时与绿光仍衔接正常。

重新生成建筑时，确保 `blender` 命令可用，然后运行：

```sh
npm run models
npm run build
```

模型脚本会重写 `public/models/` 和 `src/world/anchors.json`。若你改过招牌，重建前也要把对应文字改进脚本，避免被旧文字覆盖。不要用它来覆盖你尚未导出的其他 Blender 工程。

花、菜、庆祝与小工具不是只靠配置表就能任意新增：它们还有对应的几何、点击处理和存档逻辑。建议先修改已有项目，再扩展新项目。保持场景的真实灯光数量固定；做精细物件时保留支撑结构，并检查手机近景。小工具有独立的替换组件，网页改好后还需要单独构建和验证小工具。

## 部署自己的岛

先在本地确认构建成功：

```sh
npm test
npm run build
npm run preview
```

检查一遍：照片墙、包花带回家、点菜、日落、日出、图书馆、雨后彩虹、庆祝、拍照与刷新恢复。手机竖屏和横屏都看一下，确认按钮不重叠。

提交到自己的 GitHub 仓库，然后在 Vercel 新建项目，导入这个仓库。当前项目配置为：

| 配置项 | 值 |
| --- | --- |
| Framework Preset | Vite |
| Root Directory | 仓库根目录 |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm ci` |
| Node.js | 22.x 或兼容的新版本 |
| 环境变量 | 普通网页不需要 |

仓库已有 [vercel.json](../vercel.json)。连接自己的 Git 仓库后，后续推送由 Vercel 构建发布；具体平台操作见 [Vercel 的 Vite 文档](https://vercel.com/docs/frameworks/frontend/vite)。

也可将 `dist/` 上传到静态托管服务。当前网页按域名根路径部署，图片、音乐等部分路径以 `/` 开头；若放在 GitHub Pages 的 `/仓库名/` 子路径，不能只改 Vite 的 `base`，还要检查这些资源路径与模型加载路径。首次部署建议使用独立域名根路径。

最后看一眼 `git diff` 和将提交的文件：原始照片、私信、密钥不要上传；字体许可和代码的 [MIT 声明](../LICENSE) 应保留。需要私人内容的版本，使用适当的访问控制；“没有把链接发出去”不会让静态资源变成私密。

## 制作小红书小工具

网页完成后，再处理这一支构建。需要 Python 3、`zip`、`unzip` 以及官方 **minitool-zip-builder 1.8.0**。先从 [官方 skill 包](https://fe-static.xhscdn.com/minitool/20261015161653/minitool-zip-builder-1.8.0.skill) 下载并解压，阅读里面的 `SKILL.md`；示例把它放在项目外的 `../minitool-zip-builder/`。

macOS / Linux：

```sh
MINITOOL_SKILL_DIR=../minitool-zip-builder npm run build:minitool
```

变量必须指向**包含 `scripts/audit_artifact.py` 的目录**。Windows 建议在 WSL 中完成这一构建，因为打包脚本会直接调用 `python3`、`zip` 和 `unzip`。

产物在 `dist-minitool/` 和 `release/island-for-you-minitool-v*.zip`。这是单独的离线目录；不要直接压缩网页的 `dist/`。版本名目前写在 `scripts/minitool/package.mjs` 中，发布自己的版本时应同步修改文件名和 `version` 字段；同版本重新构建会覆盖原 ZIP。

规范审计会在构建末尾执行；没有安装官方 skill 时，网页仍能正常构建，但小工具打包不会通过。平台规范会变化，上传前再核对 [官方文档](https://miniapp-sandbox.xiaohongshu.com/minitool/doc)。构建通过后，还需按模拟器 → Android → iOS 的顺序验证同一个 ZIP。详细预算、接口与验证边界见 [MINITOOL](MINITOOL.md)。

## 遇到问题

| 问题 | 可以先检查 |
| --- | --- |
| `npm ci` 提示 Node 不支持 | 用 `node -v` 检查版本；本项目从 Node 22.12+ 开始运行 |
| 双击 `index.html` 是空白 | 从 `npm run dev` 或 `npm run preview` 提供的地址打开；源码入口需要构建工具处理 |
| 第一次没有音乐 | 先点击进入小岛，再检查声音开关；浏览器需要用户操作才能启动声音 |
| 换图后图册不对 | 检查清单中的路径、宽高、缩略图与至少一张 `sunset` 分类；查看控制台有无 404 |
| 导入图片提示缺 `sunset/` | 目录名要准确，文件扩展名须受支持，图片需直接放在分类目录内 |
| 新中文字体不统一 | 当前字库是子集，按字体章节用完整字体重新生成，或配置合适的系统回退 |
| 调了默认镜头却没变化 | 检查 `World.tsx` 中当前场景的剧情镜头是否覆盖了 `places.camera` |
| 手机上卡顿或发热 | 试试地址后加 `?lite`，在设置中减少动画，再检查新模型面数、贴图大小和绘制次数 |
| 换设备后没有进度 | 当前版本没有账号或云同步；照片可先保存到本地 |
| 想从头验收 | 设置 →「重新认识这座小岛」；会清除当前浏览器的探索记录与拍立得，先保存想留的照片 |

同一站点上做多个副本时，要避免共用存档名：网页进度键在 `src/store.ts` 的 `SAVE_KEY`，照片数据库名在 `src/lib/photos.ts`。普通部署到不同域名时，浏览器存储本来就相互独立。

如果还没解决，可以开 [Issue](https://github.com/carpediemzzsssww-cpu/island-for-you/issues)，附设备、浏览器版本、场景、操作步骤和控制台错误。检查脚本与截图要求见 [QA](QA.md)。
