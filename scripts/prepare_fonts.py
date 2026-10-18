"""Subset locally installed OFL fonts. Install fonttools and brotli, then run this script.
Override ISLAND_FONT_DIR to use another local font directory. Builds use the committed WOFF2 files.
"""
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
import os,json
root=Path(__file__).resolve().parents[1]
fonts=Path(os.environ.get('ISLAND_FONT_DIR',Path.home()/'Library/Fonts'))
text=''.join(p.read_text() for p in (root/'src').rglob('*') if p.suffix in ('.ts','.tsx','.json'))+(root/'assets-manifest.json').read_text()
chars=''.join(sorted(set(c for c in text if '\u3400'<=c<='\u9fff')))+''.join(chr(i) for i in range(32,127))+'·…「」，。：；！？、（）—“”‘’×↗℃'
# Use the complete OFL from the installed Compagnon font; both typefaces are licensed under OFL 1.1.
license_font=TTFont(fonts/'Compagnon-Roman.otf');ofl=license_font['name'].getDebugName(13)
licenses=[];dest=root/'public/fonts';dest.mkdir(exist_ok=True)
for source,name,label in [('GenWanMinTW-Regular.ttf','island-song','Island Song'),('Compagnon-Roman.otf','island-latin','Island Latin')]:
 options=subset.Options();options.flavor='woff2';options.layout_features=['*'];options.name_IDs=['*'];options.name_legacy=True
 font=subset.load_font(str(fonts/source),options)
 licenses.append({'file':name+'.woff2','originalFamily':font['name'].getDebugName(1),'copyright':font['name'].getDebugName(0),'license':'SIL Open Font License 1.1','licenseText':ofl})
 used=chars if name=='island-song' else ''.join(chr(i) for i in range(32,256))+'…—–’‘“”'
 missing=[c for c in used if '\u3400'<=c<='\u9fff' and ord(c) not in font.getBestCmap()]
 if missing:print('Fallback characters:', ''.join(missing))
 sub=subset.Subsetter(options);sub.populate(text=used);sub.subset(font)
 # Distinguish this modified subset from the fonts' reserved names.
 for rec in font['name'].names:
  if rec.nameID in (1,3,4,6,16,17):
   value='Regular' if rec.nameID==17 else label.replace(' ','') if rec.nameID==6 else label
   rec.string=value.encode(rec.getEncoding(),errors='replace')
 subset.save_font(font,str(dest/(name+'.woff2')),options)
 print(name,len(used),(dest/(name+'.woff2')).stat().st_size)
(dest/'font-licenses.json').write_text(json.dumps(licenses,ensure_ascii=False,indent=2)+'\n')
for old in ['island-serif.woff2','island-hand.woff2','island-hand-body.woff2','island-hand-latin.woff2']:(dest/old).unlink(missing_ok=True)
