# 小岛一直在这里 · An Island for You

<img src="docs/preview.webp" width="720" alt="午后的小岛：灯塔、一排彩色的老房子、椰子树，四周是浅浅的海">

> 小岛一直在。想来的时候，就回来。

**[在线体验](https://island-for-you.vercel.app)** · [做一座给朋友的岛](#做一座给朋友的岛) · [English](#english)

## 它是什么

一座可以自己逛的 3D 小岛。点一栋房子，镜头就走过去；房子里的东西可以碰：照片墙、唱片机、床边的手机，还有一本手账。

岛上有九个地方，可以回家看看、包一束花、吃点好吃的、收藏一次日落、等一次天亮。想庆祝的时候，随时去岛心的长桌，写下想庆祝的事。灯一盏一盏亮起来，蛋糕端上来，点蜡烛、许愿、吹灭。生日、毕业、重逢，或只是今天过得还不错，都可以。

它原本是我送给一位朋友的生日礼物。这个仓库是脱敏后的公开版：照片换成了不含人物的风景与静物涂鸦，私人信件和专属称呼隐去了，保留了原版的五首歌。原版的细节和小机关大多留着。

图书馆里还留了一页《绿光》：注明凡尔纳小说与侯麦同名电影的出处。观景时只留一个小入口，想读的时候再翻开。

## 怎么玩

| 你做什么 | 发生什么 |
| --- | --- |
| 拖动、滚轮、双指 | 转着看、凑近看。没有视角按钮，镜头全靠手 |
| 点一栋房子 | 走进那个地方，能碰的东西会轻轻闪一下 |
| 打开手账 | 五件小事的清单、手绘地图、你拍的照片，还有一页按时间记下的日记 |
| 在海边坐下，走上山顶，在白房子旁边等雨停 | 小太阳、海浪和雨云陪着等。绿光、第一缕光、彩虹，都能收进手账 |
| 拿起相机 | 取景框的四条边都能拉，拉成什么形状，照片就是什么形状 |
| 随手点水面、树、花丛和沙滩 | 每次冒出来的东西都不一样 |

没有积分，也不用按顺序走。可以进图书馆，透过洞口看海。雨停后能回到全岛看彩虹；拍下的照片都收进手账，可以保存到本地。庆祝过后，小岛还开着，时间可以自己调。

## 做法

- **点灯时不再重编译全场材质。** 最早每盏路灯是一个点光源，灯的数量一变，全场材质都要重新编译。现在灯的数量从头到尾固定，灯晕用发光贴图画；晚上才出现的蛋糕、彩旗和烟花，开场就建好、藏起来、提前编译。
- **镜头靠手。** 每个地方都有自己的边界和阻尼（camera-controls），拖动、滚轮、双指走同一套平滑。日出那段山路是一条 Catmull-Rom 曲线：镜头走 7 秒，视线看向前方一段路，所以不晃。
- **岛上所有中文都在一份清单里。** `scripts/copy-deck.mjs` 读 TypeScript 语法树，把 页面里的中文（连读屏文字也算）按逛岛的顺序导出成一份 Markdown，改完一条命令写回代码。原版的文案，我就是在这份清单里改的。
- **字体只带用得到的字。** 源雲明體与 Compagnon 按页面里实际出现的字做子集。
- **房间里有声音。** 五首歌在整座岛上顺序播放，换场景不会打断；房间里的唱片机可以暂停或换歌。庆祝时会响起浏览器合成的小段钟琴。原来的公有领域音乐盒生成脚本也保留，方便自行换曲。

## 做一座给朋友的岛

真正让它特别的，是每样东西为什么出现在这里。动手之前，先挑出最像你们的 5 到 12 个瞬间。

1. **名字和文字**：`src/content.ts` 里的 `site` 决定岛怎么称呼来访的人（默认「岛主」）和左上角的字。公开版不带信件；庆祝的主题在岛心填写，只保存在本机。
2. **照片**：按类别放进一个文件夹，再运行
   ```sh
   npm run photos -- import ~/Pictures/island
   ```
   类别是子文件夹的名字：`sunset`（日落和日出，至少一张）、`together`、`food`、`flowers`、`journal`、`street`、`daily`；根目录可以放一段 `video.mp4`。照片会缩成网页尺寸，并去掉 EXIF，拍摄时间和定位不会上网。导入生成的画使用 `npm run photos -- artworks <folder>`；想换回简单占位图使用 `npm run photos -- placeholders`。当前 7 张不含人物的画的生成提示词见 [docs/ARTWORK.md](docs/ARTWORK.md)。
3. **所有文案**：`node scripts/copy-deck.mjs export` 生成 `文案清单.md`，改完运行 `node scripts/copy-deck.mjs apply`。用到新字的话，重新做字体子集：`python3 scripts/prepare_fonts.py`（需要 fontTools，脚本开头有说明）。
4. **招牌**：房子上的英文招牌在 `src/world/anchors.json`。
5. **音乐**：`src/content.ts` 的 `tracks` 指向 `public/music`。只放你有权分发的音乐。

照片里出现的人、地点和聊天内容，公开之前先问过 TA。

## 小红书小工具

公开版另有离线构建，顶部天空为容器导航留出空间。使用简化模型、原创合成音乐和原生相册保存；字体与七张小画都随包提供。

```sh
npm run build:minitool
```

构建需要本机的官方 `minitool-zip-builder` 1.8.0；可通过 `MINITOOL_SKILL_DIR` 指定目录。输出在 `release/`，不会覆盖网页构建。浏览器近似测试与平台真机验证的边界见 [小工具说明](docs/MINITOOL.md)。

## 本地运行

需要 Node.js 22.12+。

```sh
npm ci
npm run dev      # http://localhost:5173
npm run build
npm test
```

地址后面加 `?lite` 会关掉后期效果（帧率低于约 32 fps 时，页面也会自己切过去）。浏览器自动检查见 [docs/QA.md](docs/QA.md)。

## 素材与版权

- 字体：源雲明體（GenWanMin）与 Compagnon，都是 SIL Open Font License 1.1，详见 [public/fonts/LICENSES.md](public/fonts/LICENSES.md)
- 音乐：Imagine Dragons 的 Nice to Meet You、Bad Liar；Taylor Swift 的 Call It What You Want、Down Bad、Babylon。这些录音不属于本项目的 MIT 许可证；庆祝钟琴由浏览器合成
- 图片：imagegen 生成的 7 张无人物风景与静物涂鸦；公开素材不包含参考原图、人物姓名、原文件名或 EXIF
- 3D 模型：`scripts/build_island.py` 在 Blender 4.5 里生成，没有下载任何模型
- Draco 解码器（`public/draco`）：Google，Apache-2.0

## 边界

这个版本包含可运行的源码、生成的涂鸦和五首歌曲。原版里的真实照片、录像、私人信、名字和地名不包含在公开素材与 git 历史里。

## English

An explorable 3D island. Tap a house to visit, wrap a bouquet, sit by the sea, or wait for the rain to stop inside the library. You can return to the whole island to see the rainbow and save your own photos.

The square is always open for a celebration. Write what you are celebrating, light the candles, make a wish, and watch the fireworks. There is no required order or checklist to finish first.

It began as a birthday gift for a friend. This public edition uses seven person-free landscape and still-life drawings, removes the personal letter and identifying details, and retains the five original songs. Reference photographs and their metadata are not included. Edit `site` and the copy in `src/content.ts` to make it yours.

**[Live demo](https://island-for-you.vercel.app)**

## License

代码使用 MIT 许可证（见 [LICENSE](LICENSE)），字体按各自的 OFL 许可证分发。歌曲录音不适用代码许可证。
