"""Generate the painted cloud sprite used by the sky (public/textures/cloud.png).
Reproducible (fixed seed); needs Pillow and numpy. Run: python3 scripts/prepare_textures.py
"""
from pathlib import Path
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1];dest=root/'public/textures';dest.mkdir(parents=True,exist_ok=True)
rng=np.random.default_rng(511);S=256
y,x=np.mgrid[0:S,0:S].astype(np.float32)/S
def value_noise(cells):
 grid=rng.random((cells+1,cells+1)).astype(np.float32)
 return np.asarray(Image.fromarray((grid*255).astype(np.uint8)).resize((S,S),Image.BICUBIC),np.float32)/255
fbm=sum(value_noise(c)*w for c,w in [(4,.5),(8,.25),(16,.15),(32,.1)])
# A lumpy, roughly round puff; many rotated puffs build each cloud.
density=np.zeros((S,S),np.float32)
for cx,cy,r in [(.5,.5,.26),(.33,.56,.16),(.67,.55,.17),(.42,.36,.15),(.6,.37,.14),(.3,.4,.1),(.7,.42,.1),(.5,.68,.14),(.36,.7,.1),(.64,.7,.1)]:
 density+=np.exp(-(((x-cx)**2+(y-cy)**2)/(2*(r*.62)**2)))
density=density/density.max()-.42*(fbm-.5)
alpha=np.clip((density-.1)/.62,0,1);alpha=alpha*alpha*(3-2*alpha)
alpha*=np.clip(1-np.hypot(x-.5,y-.5)/.5,0,1)**.6  # always fade out before the sprite edge
# Red channel carries soft inner shading; the page tints it by height in the cloud.
shade=.78+.22*np.clip(density,0,1)+.05*(fbm-.5)
rgb=np.stack([shade*1.0,shade*.995,shade*.985],-1)
img=np.dstack([np.clip(rgb,0,1),alpha[...,None]])
Image.fromarray((img*255).astype(np.uint8)).save(dest/'cloud.png',optimize=True)
print('cloud.png',(dest/'cloud.png').stat().st_size,'bytes')
