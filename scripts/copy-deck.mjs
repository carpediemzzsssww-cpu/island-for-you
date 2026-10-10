#!/usr/bin/env node
// Copy deck: every piece of Chinese text on the island in one Markdown file, in the order she meets it, for editing
// by hand.
//
//   node scripts/copy-deck.mjs export [file]   write the deck (default: 文案清单.md, git-ignored) and its key
//   node scripts/copy-deck.mjs apply [file]    write the edits back into the code, list what changed, re-export
//
// The text is read from the code itself (TypeScript syntax tree: strings, template strings and JSX text; comments are
// never touched), from index.html, and from the photo captions (scripts/photos.py + assets-manifest.json).
// Entries are matched by their `#id` through scripts/copy-deck.key.json, which records where each one came from.
// After apply: npm run build, and python3 scripts/prepare_fonts.py when new characters appear (the fonts are subsets).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DEFAULT_DECK = path.join(ROOT, '文案清单.md');
const KEY = path.join(ROOT, 'scripts', 'copy-deck.key.json');
const CJK = /[\u3400-\u9fff]/;
// Strings that look like copy but are data.
const NOT_COPY = new Set([]);
// Error messages for developers (the page shows its own words when something fails).
const SKIP = new Set(['src/lib/photos.ts']);

// ---------- Where things are, in the order she meets them ----------
// [file, top-level name ('*' for any), section title]
const ORDER = [
  ['index.html', '*', '网页标题（浏览器标签页、分享时的介绍）'],
  ['src/App.tsx', 'Loading', '开场 · 加载中'],
  ['src/App.tsx', 'WorldBoundary', '开场 · 加载失败时'],
  ['src/App.tsx', 'App', '开场和岛上的按钮'],
  ['src/ui/paper.tsx', '*', '通用 · 关闭按钮和照片'],
  ['src/content.ts', 'places', '地点（名字和一句话介绍）'],
  ['src/content.ts', 'coreMemories', '五件小事（手账里的清单）'],
  ['src/ui/Journal.tsx', '*', '手账'],
  ['src/ui/Artifacts.tsx', 'SceneActions', '地点里的按钮和小卡片'],
  ['src/world/Objects.tsx', '*', '岛上的热点和提示条'],
  ['src/world/World.tsx', '*', '岛上的热点和提示条'],
  ['src/ui/Artifacts.tsx', 'PhotoWall', '家 · 照片墙'],
  ['src/ui/Artifacts.tsx', 'Radio', '家 · 唱片机'],
  ['src/ui/Artifacts.tsx', 'Phone', '家 · 床边的手机'],
  ['src/content.ts', 'phoneMessages', '家 · 手机里的消息'],
  ['src/world/MemoryBoard.tsx', '*', '家 · 软木板上的卡片'],
  ['src/bouquet/Studio.tsx', '*', '花店 · 工作台'],
  ['src/content.ts', 'flowers', '花店 · 九种花'],
  ['src/content.ts', 'papers', '花店 · 包装纸'],
  ['src/content.ts', 'ribbons', '花店 · 丝带'],
  ['src/ui/Artifacts.tsx', 'Menu', '食堂 · 菜单'],
  ['src/content.ts', 'menu', '食堂 · 四道菜'],
  ['src/ui/Artifacts.tsx', 'Postcards', '日落收藏处 · 明信片'],
  ['src/ui/Artifacts.tsx', 'Sand', '日落收藏处 · 沙滩写字'],
  ['src/ui/Artifacts.tsx', 'SunriseCard', '等天亮的山坡'],
  ['src/ui/Artifacts.tsx', 'CameraView', '相机'],
  ['src/ui/Story.tsx', 'EveningInvite', '生日夜晚 · 岛心的邀请'],
  ['src/ui/Story.tsx', 'CelebrationCard', '生日夜晚 · 长桌上'],
  ['src/ui/Artifacts.tsx', 'Letter', '信 · 信封'],
  ['src/content.ts', 'letter', '信 · 正文'],
  ['src/ui/Artifacts.tsx', 'Settings', '设置'],
  ['src/store.ts', '*', '设置'],
  ['src/ui/Story.tsx', '*', '时间按钮和读屏用的进度'],
  ['src/ui/Artifacts.tsx', 'Artifacts', '录像和关闭'],
  ['photos', '*', '照片说明（按照片分类，一类一句）'],
];
const sectionOf = (file, name) => (ORDER.find(([f, n]) => f === file && (n === '*' || n === name)) ?? [, , '其他'])[2];

// ---------- Reading the code ----------
const ATTR = { 'aria-label': '读屏文字（页面上不显示）', title: '鼠标停在上面时的提示', label: '热点的读屏文字', alt: '图片的替代文字（不显示）', placeholder: '输入框里的提示' };
const TAG = { h1: '大标题', h2: '标题', h3: '小标题', p: '正文', button: '按钮', span: '小字', small: '小字', time: '时间', li: '清单', figure: '说明', label: '标签', div: '文字', b: '强调', i: '小字' };
const PROP = { name: '名字', en: '英文名', description: '一句话介绍', hint: '提示（没做时显示）', note: '一句话', price: '价格那一栏', caption: '说明', title: '标题', salutation: '称呼', signature: '署名', date: '日期', text: '文字' };
function topName(node) {
  let n = node;
  while (n.parent && !ts.isSourceFile(n.parent)) n = n.parent;
  if (ts.isFunctionDeclaration(n) && n.name) return n.name.text;
  if (ts.isVariableStatement(n)) return n.declarationList.declarations[0]?.name.getText() ?? '';
  if (ts.isClassDeclaration(n) && n.name) return n.name.text;
  if (ts.isExportAssignment(n)) return 'default';
  return '';
}
function roleOf(node) {
  let child = node;
  for (let n = node.parent, depth = 0; n && depth < 8; child = n, n = n.parent, depth++) {
    if (ts.isJsxAttribute(n)) return ATTR[n.name.getText()] ?? `属性 ${n.name.getText()}`;
    if (ts.isJsxElement(n)) return TAG[n.openingElement.tagName.getText()] ?? '文字';
    if (ts.isCallExpression(n)) {
      const callee = n.expression.getText();
      if (/notify$/.test(callee)) return '屏幕下方的提示条';
      if (callee === 'card') return ['卡片标题', '卡片正文'][n.arguments.indexOf(child)] ?? '卡片';
      if (/fillText$/.test(callee)) return '画在卡片上的字';
    }
    if (ts.isPropertyAssignment(n)) return PROP[n.name.getText()] ?? `“${n.name.getText()}”`;
    if (ts.isArrayLiteralExpression(n) && ts.isPropertyAssignment(n.parent) && n.parent.name.getText() === 'paragraphs') return `第 ${n.elements.indexOf(child) + 1} 段`;
  }
  return '文字';
}
function scanTs(rel) {
  const file = path.join(ROOT, rel), text = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out = [];
  const visit = node => {
    if (ts.isImportDeclaration(node)) return;
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && CJK.test(node.text) && !NOT_COPY.has(node.text)) {
      out.push({ kind: 'string', text: node.text, start: node.getStart(sf), end: node.getEnd(), quote: text[node.getStart(sf)], jsxAttr: ts.isJsxAttribute(node.parent), node });
    } else if (ts.isTemplateExpression(node) && [node.head, ...node.templateSpans.map(s => s.literal)].some(p => CJK.test(p.text))) {
      let shown = node.head.text;
      const exprs = node.templateSpans.map((span, i) => { shown += `{${i + 1}}` + span.literal.text; return span.expression.getText(sf); });
      out.push({ kind: 'template', text: shown, exprs, start: node.getStart(sf), end: node.getEnd(), node });
      node.templateSpans.forEach(span => visit(span.expression)); // words inside the {…} parts are entries of their own
      return;
    } else if (ts.isJsxText(node) && CJK.test(node.text)) {
      const raw = node.text, lead = raw.length - raw.trimStart().length;
      out.push({ kind: 'jsx', text: raw.trim(), start: node.getStart(sf) + lead, end: node.getStart(sf) + lead + raw.trim().length, node });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out.map(e => ({ file: rel, kind: e.kind, text: e.text, exprs: e.exprs, quote: e.quote, jsxAttr: e.jsxAttr, start: e.start, end: e.end, name: topName(e.node), role: roleOf(e.node) }));
}
function scanHtml() {
  const text = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), out = [];
  const title = text.match(/<title>([^<]*)<\/title>/), desc = text.match(/<meta name="description" content="([^"]*)"/);
  if (title) out.push({ file: 'index.html', kind: 'html', text: title[1], role: '标签页上的标题', name: 'title' });
  if (desc) out.push({ file: 'index.html', kind: 'html', text: desc[1], role: '分享或搜索时的一句介绍', name: 'description' });
  return out;
}
const CATEGORY = { portrait: '你', together: '我们', flowers: '花', food: '好吃的', daily: '日常', street: '路上', sunset: '日落', journal: '手账' };
function scanPhotos() {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets-manifest.json'), 'utf8')), seen = new Map();
  for (const p of m.photos) if (p.caption && !seen.has(p.category)) seen.set(p.category, p.caption);
  const out = [...seen].map(([category, caption]) => ({ file: 'photos', kind: 'caption', category, text: caption, role: `“${CATEGORY[category] ?? category}”这一类照片的说明`, name: category }));
  if (m.video?.caption) out.push({ file: 'photos', kind: 'video', text: m.video.caption, role: '录像的说明', name: 'video' });
  return out;
}
function sources() {
  const files = [];
  const walk = dir => { for (const f of fs.readdirSync(path.join(ROOT, dir))) { const rel = `${dir}/${f}`; if (fs.statSync(path.join(ROOT, rel)).isDirectory()) walk(rel); else if (/\.tsx?$/.test(f) && !f.endsWith('.d.ts') && !SKIP.has(rel)) files.push(rel); } };
  walk('src');
  return files;
}
function collect() {
  const entries = [...scanHtml(), ...sources().flatMap(scanTs), ...scanPhotos()];
  // Stable ids: file, place in the code and the original words; repeats get a counter.
  const count = new Map();
  for (const e of entries) {
    const base = `${e.file}|${e.name}|${e.kind}|${e.category ?? ''}|${e.text}`;
    const n = (count.get(base) ?? 0) + 1; count.set(base, n);
    e.id = crypto.createHash('sha1').update(`${base}|${n}`).digest('hex').slice(0, 6);
    e.section = sectionOf(e.file, e.name);
  }
  const rank = s => { const i = ORDER.findIndex(o => o[2] === s); return i < 0 ? ORDER.length : i; };
  return entries.map((e, i) => ({ ...e, i })).sort((a, b) => rank(a.section) - rank(b.section) || a.i - b.i);
}

// ---------- The deck ----------
const NUM = '一二三四五六七八九十';
const cn = n => n <= 10 ? NUM[n - 1] : n < 20 ? '十' + NUM[n - 11] : NUM[Math.floor(n / 10) - 1] + '十' + (n % 10 ? NUM[n % 10 - 1] : '');
function writeDeck(file, entries) {
  const sections = [...new Set(entries.map(e => e.section))];
  const today = new Date().toISOString().slice(0, 10);
  let md = `# 小岛 · 文案清单\n\n生成于 ${today}。这里是小岛上所有的中文，按她在岛上遇到的顺序排。改完运行 \`node scripts/copy-deck.mjs apply\` 写回代码，再 \`npm run build\` 看看效果。\n\n`;
  md += `## 怎么改\n\n- 只改 \`中文:\` 后面的文字，每条保持一行。\n- 每条标题后面 # 开头的那串编号，是它在网站里的位置，别改也别删。\n- \`{1}\`、\`{2}\` 会被换成名字或数字（比如找到了几件、哪一道菜），保留它们，可以挪位置。\n- 标着「读屏文字」「替代文字」的，页面上看不到，是给读屏软件和测试用的，可以不管。\n- 名字（岛主、你的朋友）在 src/content.ts 的 \`site\` 里统一改；房子上的英文招牌（SLOW BLOOM、EAT WELL DINER、BOOKS、COFFEE、BAKERY）在 src/world/anchors.json 里改。\n- 不想改的就不动。\n\n## 目录\n\n${sections.map((s, i) => `- ${cn(i + 1)}、${s}`).join('\n')}\n\n---\n`;
  sections.forEach((s, i) => {
    md += `\n## ${cn(i + 1)}、${s}\n\n`;
    for (const e of entries.filter(x => x.section === s)) {
      const where = e.kind === 'template' ? `${e.role}（含 ${e.exprs.map((x, k) => `{${k + 1}}`).join('、')}）` : e.role;
      md += `**${where}** \`#${e.id}\`\n- 中文: ${e.text.replace(/\n/g, '\\n')}\n\n`;
    }
  });
  fs.writeFileSync(file, md);
  fs.writeFileSync(KEY, JSON.stringify(entries.map(({ id, file, kind, text, exprs, quote, jsxAttr, start, name, category }) => ({ id, file, kind, text, exprs, quote, jsxAttr, start, name, category })), null, 1) + '\n');
  return entries.length;
}
function readDeck(file) {
  const edits = new Map(), lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const id = lines[i].match(/`#([0-9a-f]{6})`/)?.[1];
    if (!id) continue;
    const line = lines.slice(i + 1, i + 4).find(l => l.startsWith('- 中文:'));
    if (line !== undefined) edits.set(id, line.slice('- 中文:'.length).trim().replace(/\\n/g, '\n'));
  }
  return edits;
}

// ---------- Writing back ----------
const jsString = (t, q) => q + t.replace(/\\/g, '\\\\').replace(new RegExp(q, 'g'), '\\' + q).replace(/\n/g, '\\n') + q;
function replacement(e, text, original) {
  if (e.kind === 'jsx') return /[{}<>]/.test(text) ? `{${jsString(text, "'")}}` : text;
  if (e.kind === 'template') {
    const parts = text.split(/\{(\d+)\}/);
    let out = '`';
    parts.forEach((p, k) => { out += k % 2 ? '${' + e.exprs[Number(p) - 1] + '}' : p.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${'); });
    return out + '`';
  }
  if (e.jsxAttr) return text.includes('"') ? `{${jsString(text, "'")}}` : `"${text}"`;
  return jsString(text, original[0] === '`' ? '`' : original[0]);
}
function apply(deckFile) {
  const key = JSON.parse(fs.readFileSync(KEY, 'utf8')), edits = readDeck(deckFile), changed = [], missing = [];
  const byFile = new Map();
  for (const e of key) {
    const edited = edits.get(e.id);
    if (edited === undefined) continue;
    // Spaces at either end belong to the layout (" · 至少 3 枝"), not to the words: they are kept as they were.
    const next = e.text.match(/^\s*/)[0] + edited.trim() + e.text.match(/\s*$/)[0];
    if (next === e.text) continue;
    if (e.kind === 'template') {
      const want = e.exprs.map((_, k) => `{${k + 1}}`), have = [...next.matchAll(/\{(\d+)\}/g)].map(m => m[0]);
      if (want.some(w => !have.includes(w)) || have.some(h => !want.includes(h))) { missing.push(`${e.file} #${e.id}：要保留 ${want.join('、')}，这条先没改`); continue; }
    }
    if (!byFile.has(e.file)) byFile.set(e.file, []);
    byFile.get(e.file).push({ ...e, next });
  }
  for (const [file, list] of byFile) {
    if (file === 'photos') {
      const manifest = path.join(ROOT, 'assets-manifest.json'), prep = path.join(ROOT, 'scripts/photos.py');
      const m = JSON.parse(fs.readFileSync(manifest, 'utf8'));let py = fs.readFileSync(prep, 'utf8');
      for (const e of list) {
        if (e.kind === 'video') { m.video.caption = e.next; py = py.replace(`'caption': '${e.text}'`, `'caption': '${e.next}'`); }
        else { for (const p of m.photos) if (p.category === e.category && p.caption === e.text) p.caption = e.next; py = py.replace(`'${e.category}': '${e.text}'`, `'${e.category}': '${e.next}'`); }
        changed.push(`照片说明：${e.text} → ${e.next}`);
      }
      fs.writeFileSync(manifest, JSON.stringify(m, null, 1) + '\n');fs.writeFileSync(prep, py);
      continue;
    }
    const abs = path.join(ROOT, file);let text = fs.readFileSync(abs, 'utf8');
    if (file === 'index.html') { for (const e of list) { if (!text.includes(e.text)) { missing.push(`${file} #${e.id}`); continue; } text = text.replace(e.text, e.next); changed.push(`${file}：${e.text} → ${e.next}`); } fs.writeFileSync(abs, text); continue; }
    // Find each original again in the current code (by kind, words and place), then rewrite from the end backwards.
    // An edit that encloses another one (a template around a quoted word) waits for the next pass.
    let todo = list;
    for (let pass = 0; todo.length && pass < 4; pass++) {
      fs.writeFileSync(abs, text);
      const current = scanTs(file), plans = [], later = [];
      for (const e of todo) {
        const same = current.filter(c => c.kind === e.kind && c.text === e.text && c.name === e.name);
        const hit = same.sort((a, b) => Math.abs(a.start - e.start) - Math.abs(b.start - e.start))[0];
        if (!hit) { missing.push(`${file} #${e.id}（代码里已经找不到原文「${e.text.slice(0, 20)}」）`); continue; }
        plans.push({ e, start: hit.start, end: hit.end, to: replacement({ ...e, exprs: hit.exprs ?? e.exprs }, e.next, text.slice(hit.start, hit.end)) });
      }
      plans.sort((a, b) => b.start - a.start);
      const done = [];
      for (const p of plans) {
        if (done.some(d => d.start >= p.start && d.end <= p.end)) { later.push(p.e); continue; }
        text = text.slice(0, p.start) + p.to + text.slice(p.end); done.push(p); changed.push(`${file}：${p.e.text} → ${p.e.next}`);
      }
      todo = later;
    }
    fs.writeFileSync(abs, text);
  }
  console.log(changed.length ? `改了 ${changed.length} 条：\n` + changed.map(c => '  ' + c).join('\n') : '没有改动。');
  if (missing.length) console.log(`\n没能写回的（${missing.length}）：\n` + missing.map(m => '  ' + m).join('\n'));
  // Button names are also how the browser checks find things; flag any that the checks still use.
  const tests = fs.readdirSync(path.join(ROOT, 'scripts')).filter(f => /^verify-.*\.mjs$/.test(f));
  const used = [...byFile.values()].flat().filter(e => tests.some(t => fs.readFileSync(path.join(ROOT, 'scripts', t), 'utf8').includes(e.text)));
  if (used.length) console.log('\n这些原文还被浏览器检查脚本用来找按钮，记得同步改：\n' + used.map(e => '  ' + e.text).join('\n'));
  const n = writeDeck(deckFile, collect());
  console.log(`\n清单已按新的代码重新生成（${n} 条）。`);
}

const [command = 'export', file = DEFAULT_DECK] = process.argv.slice(2);
if (command === 'export') console.log(`写好了 ${path.relative(ROOT, file)}：${writeDeck(file, collect())} 条。`);
else if (command === 'apply') apply(path.resolve(file));
else { console.error('用法：node scripts/copy-deck.mjs export|apply [文件]'); process.exit(1); }
