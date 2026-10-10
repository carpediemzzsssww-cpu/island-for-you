"""Download licensed (SIL Open Font License), self-hosted font subsets for the current UI characters.

island-serif: Noto Serif SC, every heading and line of text.
The journal's handwriting: island-hand (Long Cang) for its titles and tabs, island-hand-body (LXGW WenKai, clearer)
for its sentences, island-hand-latin (Caveat) for dates and numbers. Long Cang and LXGW WenKai only carry the
characters the journal can show (src/ui/Journal.tsx and src/content.ts).

LXGW WenKai is subset locally from its release font (cached in art-source/fonts, not in git), which needs fontTools:
  python3.11 -m venv /tmp/fontenv && /tmp/fontenv/bin/pip install fonttools brotli && /tmp/fontenv/bin/python scripts/prepare_fonts.py"""
from pathlib import Path
import subprocess,urllib.parse,re
root=Path(__file__).resolve().parents[1]
texts=[p for p in (root/'src').rglob('*') if p.suffix in ['.ts','.tsx','.json']]+[root/'assets-manifest.json',root/'index.html']
cjk=''.join(sorted(set(c for p in texts for c in p.read_text() if '\u3400'<=c<='\u9fff')))
ascii_=''.join(chr(c) for c in range(32,127))
chars=cjk+ascii_+'·…「」，。：；！？、（）—'
agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
dest=root/'public/fonts';dest.mkdir(exist_ok=True,parents=True)
def fetch(family,text,name):
 url='https://fonts.googleapis.com/css2?'+urllib.parse.urlencode({'family':family,'display':'swap','text':text})
 css=subprocess.run(['curl','-fsSL','--max-time','45','-H','User-Agent: '+agent,url],capture_output=True,text=True,check=True).stdout
 urls=re.findall(r'url\(([^)]+)\)',css)
 if not urls:raise RuntimeError(f'Font URL missing for {family}')
 subprocess.run(['curl','-fsSL','--max-time','45',urls[0],'-o',str(dest/name)],check=True)
 data=(dest/name).read_bytes()
 if data[:4]!=b'wOF2':raise RuntimeError(f'{family} did not return WOFF2')
 print(f'{name}: {len(text)} characters; {len(data)} bytes; valid WOFF2.')
fetch('Noto Serif SC:wght@500',chars,'island-serif.woff2')
journal=''.join(sorted(set(c for p in [root/'src/ui/Journal.tsx',root/'src/content.ts'] for c in p.read_text() if '\u3400'<=c<='\u9fff')))+ascii_+'·…「」，。：；！？、（）—“”'
fetch('Long Cang',journal,'island-hand.woff2')
# LXGW WenKai: pinned release, subset here (Google Fonts only carries its Traditional Chinese edition).
ttf=root/'art-source/fonts/LXGWWenKai-Regular.ttf'
if not ttf.exists():
 ttf.parent.mkdir(parents=True,exist_ok=True)
 subprocess.run(['curl','-fsSL','--max-time','300','-o',str(ttf),'https://github.com/lxgw/LxgwWenKai/releases/download/v1.522/LXGWWenKai-Regular.ttf'],check=True)
try:
 from fontTools import subset
 options=subset.Options();options.flavor='woff2';options.layout_features=['*'];options.name_IDs=['*']
 font=subset.load_font(str(ttf),options);sub=subset.Subsetter(options);sub.populate(text=journal);sub.subset(font)
 subset.save_font(font,str(dest/'island-hand-body.woff2'),options)
 print(f"island-hand-body.woff2: {len(journal)} characters; {(dest/'island-hand-body.woff2').stat().st_size} bytes; subset locally.")
except ImportError:print('island-hand-body.woff2 skipped: fontTools is not installed (see the note at the top of this script).')
fetch('Caveat:wght@500',ascii_+'·—',  'island-hand-latin.woff2')
