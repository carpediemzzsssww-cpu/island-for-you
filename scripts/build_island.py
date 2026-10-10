"""Author the island in Blender; export small, material-batched, Draco-compressed region GLBs.
Coordinates in helpers use the application's Y-up convention. No downloaded models.
Run: blender --background --python scripts/build_island.py

Visual language: arcaded shophouses — arcade / floors / parapet,
one colour per house, baroque gables with round wind holes, green-glazed vase balustrades —
coconut palms and bougainvillea, a cliffed north shore and a sunset beach.
Soft ambient occlusion and painterly variation are baked into vertex colours.
"""
import bpy, bmesh, math, random, json, zlib
import numpy as np
from mathutils import Vector, Matrix, noise
from mathutils.bvhtree import BVHTree
import time
STARTED=time.time()
def stage(label):print(f'[{time.time()-STARTED:6.1f}s] {label}',flush=True)
from pathlib import Path
random.seed(511)
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/models'; OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
region='terrain'; role='static'; shade='ao'
TOP=1.10; ANCHORS={'signs':[],'steam':[],'chimes':[],'lanterns':[],'lampPosts':[]}
def co(p): return (p[0],-p[2],p[1])
def lin(hexcolor): return tuple((int(hexcolor[i:i+2],16)/255)**2.2 for i in (0,2,4))

# ---------- materials ----------
def paint_image(name,hexcolor,kind):
 size=256 if kind=='wall' else 128;y,x=np.mgrid[0:size,0:size].astype(np.float32);rng=np.random.default_rng(zlib.crc32(name.encode()))
 c=np.array([int(hexcolor[i:i+2],16)/255 for i in (0,2,4)],np.float32)
 if kind=='tile':
  u=(x%32)-15.5;v=(y%32)-15.5;d=np.abs(u)+np.abs(v);px=np.empty((size,size,3),np.float32);px[:]=[.95,.9,.8]
  px[d<12]=[.79,.48,.37];px[np.abs(d-12)<1.3]=[.43,.62,.59];px[u*u+v*v<14]=[.95,.9,.8];px[(np.abs(u)>14.3)|(np.abs(v)>14.3)]=[.84,.78,.68]
  corner=np.minimum(np.hypot(np.abs(u)-15.5,np.abs(v)-15.5),99);px[corner<6]=[.85,.62,.62]
  px*=(.96+rng.uniform(-.03,.03,(size,size,1))).astype(np.float32)
 else:
  if kind=='grain':n=.93+.05*np.sin(y*.8+np.sin(x*.06)*3)+.02*np.sin(y*2.7)
  elif kind=='wall':
   n=.955+.03*np.sin(x*.045+np.sin(y*.03)*2.5)+.025*np.cos(y*.06+x*.021)+.015*np.sin((x-y)*.013)
   for i in range(46):
    # Image rows start at the bottom, so a streak hangs down from `top` and fades toward its tail.
    cx=rng.uniform(0,size);wd=rng.uniform(1.5,5.5);ln=rng.uniform(30,150);top=rng.uniform(0,size);dk=rng.uniform(.025,.075)
    dx=np.minimum(np.abs(x-cx),size-np.abs(x-cx));dy=(top-y)%size
    n-=dk*np.exp(-(dx/wd)**2)*np.clip(1-dy/ln,0,1)*(dy<ln)
   n+=rng.uniform(-.012,.012,(size,size))
  else:n=.95+.028*np.sin(x*.09+np.sin(y*.05)*2)+.022*np.cos(y*.13+x*.04)+.02*np.sin((x+y)*.021)
  n=n+rng.uniform(-.018,.018,(size,size));px=np.clip(c[None,None,:]*n[:,:,None],0,1)
 image=bpy.data.images.new(name+'_paint',size,size);image.pixels.foreach_set(np.dstack([px,np.ones((size,size,1),np.float32)]).astype(np.float32).ravel());image.pack();return image
def material(name,hexcolor,kind=None,emission=0,rough=.87,double=False):
 c=lin(hexcolor);m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;m.use_backface_culling=not double
 bs=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=rough
 if emission:bs.inputs['Emission Color'].default_value=(*c,1);bs.inputs['Emission Strength'].default_value=emission
 if kind:
  t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=paint_image(name,hexcolor,kind);m.node_tree.links.new(t.outputs['Color'],bs.inputs['Base Color'])
 return m
PALETTE={
 # ground
 'meadow':('A9CC8C',None),'grass':('A6C98A',None),'grassLight':('C4DA9F',None),'grassDark':('8DB67B',None),
 'sand':('F2DFB7','plaster'),'wetSand':('D6BE98',None),'path':('EADAB9','plaster'),'stone':('DED1B9',None),'plinth':('CBBEA5',None),
 'rock':('B59E86',None),'rockLight':('CFBB9F',None),'basalt':('7A726C',None),
 # one colour per shophouse
 'wallPink':('EDC6B8','wall'),'wallButter':('F2D9A2','wall'),'wallMint':('C6DDC8','wall'),'wallBlue':('C4D6DF','wall'),
 'wallCream':('F4E8D0','wall'),'wallOchre':('EAC795','wall'),'wallHome':('F6EBD8','wall'),'shopWall':('EFE3CC','wall'),
 'trim':('FCF6EA',None),'plate':('F7EDD6',None),'concrete':('F5F1EA',None),'white':('FFF8EC',None),'cream':('F3EAD7',None),
 # shutters, glaze and cloth
 'teal':('5F9E97',None),'celadon':('79B29A',None),'rose':('D7A0A4',None),'ivory':('F3E8D2',None),'skyBlue':('93B7C8',None),
 'blush':('E7B7B8',None),'paper':('FAEEDC',None),'mint':('A8D0BE',None),'coral':('E49A86',None),
 'roof':('C97A5D','plaster'),'roofLight':('DE9E7E',None),'tileGreen':('4F7D69',None),'lacquer':('B05E4E',None),
 'wood':('AE8F6D','grain'),'darkWood':('86705B',None),'glass':('6E97A1',None),'metal':('3F5D52',None),'mailGreen':('2F6B4F',None),
 # plants
 'leaf':('7FA66F',None),'leafLight':('A6C286',None),'leafDeep':('5E8B69',None),'palm':('8DB86A',None),'palmDark':('6C9C5A',None),
 'trunk':('A88D70',None),'trunkLight':('C3AB8C',None),'coconut':('9AA65A',None),
 'bougain':('D8789E',None),'bougainLight':('EBA3BD',None),'blossom':('EFC2C9',None),'flower':('E9C0C4',None),'yellow':('F1D27E',None),
 'tile':('F2E6CC','tile'),'gold':('E8BC69',None),'pond':('62A7A3',None),'ink':('354F4B',None),'red':('BF715D',None),'peach':('E6C5AB',None),'pink':('DEB4AE',None),'blue':('9CB6AF',None),
 'whiteSand':('F6EEDD','plaster'),'poolBed':('5E9C9A',None),
}
def darker(hexcolor,f=.8):return ''.join(f'{int(int(hexcolor[i:i+2],16)*f):02X}' for i in (0,2,4))
for key in ['teal','celadon','rose','ivory','skyBlue']:PALETTE[key+'Shade']=(darker(PALETTE[key][0]),None)
M={k:material(k,v,kind,double=k in ('palm','palmDark','paper','blush','mint')) for k,(v,kind) in PALETTE.items()}
M['lamp']=material('lamp','FFE0A0',emission=.5)

# ---------- primitives ----------
def apply_mods(obj):
 dg=bpy.context.evaluated_depsgraph_get();data=bpy.data.meshes.new_from_object(obj.evaluated_get(dg),preserve_all_data_layers=True,depsgraph=dg)
 old=obj.data;obj.modifiers.clear();obj.data=data;bpy.data.meshes.remove(old)
def finish(obj,name,mat,bevel=0):
 obj.name=name;obj['region']=region;obj['role']=role;obj['shade']=shade
 for m in (mat if isinstance(mat,list) else [mat]):
  m=M[m] if isinstance(m,str) else m
  if m.name not in obj.data.materials:obj.data.materials.append(m)
 if bevel:
  mod=obj.modifiers.new('soft handmade edges','BEVEL');mod.width=bevel;mod.segments=2;apply_mods(obj)
 return obj
# Primitives are built with bmesh rather than operators: with thousands of objects in the scene,
# every operator call or modifier apply re-evaluates the whole depsgraph and the build slows quadratically.
def _object(name,bm,location):
 me=bpy.data.meshes.new(name);bm.to_mesh(me);bm.free()
 o=bpy.data.objects.new(name,me);o.location=location;bpy.context.collection.objects.link(o);return o
def _scale(bm,s):
 for v in bm.verts:v.co=Vector((v.co.x*s[0],v.co.y*s[2],v.co.z*s[1]))
def cube(name,p,s,mat,bevel=.035):
 bm=bmesh.new();bmesh.ops.create_cube(bm,size=1.0);_scale(bm,s)
 if bevel:bmesh.ops.bevel(bm,geom=list(bm.verts)+list(bm.edges),offset=bevel,offset_type='OFFSET',segments=2,profile=.5,affect='EDGES',clamp_overlap=True)
 return finish(_object(name,bm,co(p)),name,mat)
def mesh(name,vs,faces,mat,smooth=False):
 data=bpy.data.meshes.new(name);data.from_pydata([co(p) for p in vs],[],faces);data.update();o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o['custom_mesh']=True
 finish(o,name,mat)
 if isinstance(mat,list):
  index={m.name:i for i,m in enumerate(o.data.materials)}
  for poly,m in zip(o.data.polygons,mat):poly.material_index=index[m]
 if smooth:
  for poly in o.data.polygons:poly.use_smooth=True
 return o
def sphere(name,p,s,mat,segments=12,rings=8):
 bm=bmesh.new();bmesh.ops.create_uvsphere(bm,u_segments=segments,v_segments=rings,radius=1.0);_scale(bm,s)
 for f in bm.faces:f.smooth=True
 return finish(_object(name,bm,co(p)),name,mat)
def ico(name,p,s,mat,jitter=.22,flat=True):
 bm=bmesh.new();bmesh.ops.create_icosphere(bm,subdivisions=1,radius=1.0);turn=Matrix.Rotation(random.random()*math.tau,3,'Z')
 for v in bm.verts:k=1-jitter+random.random()*2*jitter;c=v.co*k;v.co=turn@Vector((c.x*s[0],c.y*s[2],c.z*s[1]))
 for f in bm.faces:f.smooth=not flat
 return finish(_object(name,bm,co(p)),name,mat)
def rod(name,a,b,r,mat,r2=None,vertices=10):
 av=Vector(co(a));bv=Vector(co(b));d=bv-av
 bm=bmesh.new();bmesh.ops.create_cone(bm,cap_ends=True,cap_tris=False,segments=vertices,radius1=r,radius2=r if r2 is None else r2,depth=max(d.length,1e-4))
 if d.length>1e-6:bmesh.ops.rotate(bm,verts=bm.verts,cent=(0,0,0),matrix=d.to_track_quat('Z','Y').to_matrix())
 return finish(_object(name,bm,(av+bv)/2),name,mat)
def torus(name,p,r,t,mat,major=24,minor=6):
 bpy.ops.mesh.primitive_torus_add(major_segments=major,minor_segments=minor,location=co(p),major_radius=r,minor_radius=t);return finish(bpy.context.object,name,mat)
def lathe(name,cx,y0,cz,profile,mat,seg=6,scale=1):
 vs=[(cx+math.cos(s*math.tau/seg)*r*scale,y0+h*scale,cz+math.sin(s*math.tau/seg)*r*scale) for r,h in profile for s in range(seg)]
 faces=[(k*seg+s,(k+1)*seg+s,(k+1)*seg+(s+1)%seg,k*seg+(s+1)%seg) for k in range(len(profile)-1) for s in range(seg)]
 return mesh(name,vs,faces,mat,True)
VASE=[(.036,0),(.052,.03),(.036,.07),(.058,.15),(.03,.25),(.048,.285),(.048,.3)]
def prism(name,outline,z0,depth,mat):
 """Extrude a front-facing 2D outline [(x,y)] backwards from z0."""
 n=len(outline);vs=[(x,y,z0) for x,y in outline]+[(x,y,z0-depth) for x,y in outline]
 return mesh(name,vs,[tuple(range(n)),tuple(range(2*n-1,n-1,-1))]+[(i,(i+1)%n,n+(i+1)%n,n+i) for i in range(n)],mat)
def path(name,points,width,mat):
 verts=[]
 for i,p in enumerate(points):
  before=points[max(0,i-1)];after=points[min(len(points)-1,i+1)];dx=after[0]-before[0];dz=after[2]-before[2];l=max(.01,math.hypot(dx,dz));nx=-dz/l*width/2;nz=dx/l*width/2
  verts.extend([(p[0]+nx,p[1],p[2]+nz),(p[0]-nx,p[1],p[2]-nz)])
 return mesh(name,verts,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(points)-1)],mat)
def plate(name,x,y,z,w,d,mat,tile=.5):
 """A flat floor with world-scaled UVs, for repeating patterned tiles."""
 o=mesh(name,[(x-w/2,y,z-d/2),(x+w/2,y,z-d/2),(x+w/2,y,z+d/2),(x-w/2,y,z+d/2)],[(0,3,2,1)],mat);uv=o.data.uv_layers.new(name='UVMap')
 for loop in o.data.loops:
  v=o.data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(v.x/tile,v.y/tile)
 o['uv_set']=True;return o
def disc(name,x,y,z,r,mat,tile=.5,n=40):
 o=mesh(name,[(x,y,z)]+[(x+math.cos(i*math.tau/n)*r,y,z+math.sin(i*math.tau/n)*r) for i in range(n)],[(0,1+(i+1)%n,1+i) for i in range(n)],mat);uv=o.data.uv_layers.new(name='UVMap')
 for loop in o.data.loops:
  v=o.data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(v.x/tile,v.y/tile)
 o['uv_set']=True;return o
def face_up(o):
 """Flat ground pieces: every face points to the sky, and the bake keeps it that way."""
 for p in o.data.polygons:
  if p.normal.z<0:p.flip()
 o.data.update();o['keep_normals']=True;return o
def flat(name,outline,y,mat,tile=None):
 """A flat polygon fan from its centroid; optional world-scaled UVs for patterned floors."""
 n=len(outline);cx=sum(p[0] for p in outline)/n;cz=sum(p[1] for p in outline)/n
 o=mesh(name,[(cx,y,cz)]+[(x,y,z) for x,z in outline],[(0,1+i,1+(i+1)%n) for i in range(n)],mat);face_up(o)
 if tile:
  uv=o.data.uv_layers.new(name='UVMap')
  for loop in o.data.loops:
   v=o.data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(v.x/tile,v.y/tile)
  o['uv_set']=True
 return o
def band(name,outer,inner,y,mat,tile=None):
 """A flat ring between two outlines with the same number of points."""
 n=len(outer);o=mesh(name,[(x,y,z) for x,z in outer]+[(x,y,z) for x,z in inner],[(i,(i+1)%n,n+(i+1)%n,n+i) for i in range(n)],mat);face_up(o)
 if tile:
  uv=o.data.uv_layers.new(name='UVMap')
  for loop in o.data.loops:
   v=o.data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(v.x/tile,v.y/tile)
  o['uv_set']=True
 return o
def skirt(name,outline,top,bottom,mat,facing='out'):
 """A vertical strip along an outline; faces look away from (or toward) its centre."""
 n=len(outline);cx=sum(p[0] for p in outline)/n;cz=sum(p[1] for p in outline)/n
 o=mesh(name,[(x,top,z) for x,z in outline]+[(x,bottom,z) for x,z in outline],[(i,(i+1)%n,n+(i+1)%n,n+i) for i in range(n)],mat)
 for p in o.data.polygons:
  away=(p.center.x-cx)*p.normal.x+(p.center.y+cz)*p.normal.y
  if (away<0)==(facing=='out'):p.flip()
 o.data.update();o['keep_normals']=True;return o
def rounded_rect(cx,cz,w,d,r,seg=5):
 """Outline of a rounded rectangle, counter-clockwise in (x,z)."""
 pts=[]
 for qx,qz,a0 in [(1,1,0),(-1,1,math.pi/2),(-1,-1,math.pi),(1,-1,math.pi*1.5)]:
  ox=cx+qx*(w/2-r);oz=cz+qz*(d/2-r)
  for k in range(seg+1):
   a=a0+k*(math.pi/2)/seg;pts.append((ox+math.cos(a)*r,oz+math.sin(a)*r))
 return pts
def plan_box(name,cx,y0,y1,cz,w,d,r,mat,seg=6,edge=.05):
 """A box with rounded corners in plan and softly rounded top and bottom edges (vertical walls stay vertical)."""
 out=rounded_rect(cx,cz,w,d,r,seg);n=len(out);bm=bmesh.new()
 bot=[bm.verts.new(co((x,y0,z))) for x,z in out];top=[bm.verts.new(co((x,y1,z))) for x,z in out]
 bm.faces.new(bot);bm.faces.new(top)
 for i in range(n):bm.faces.new((bot[i],bot[(i+1)%n],top[(i+1)%n],top[i]))
 bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
 if edge:
  ring=[e for e in bm.edges if all(abs(v.co.z-y0)<1e-6 for v in e.verts) or all(abs(v.co.z-y1)<1e-6 for v in e.verts)]
  bmesh.ops.bevel(bm,geom=ring,offset=edge,offset_type='OFFSET',segments=3,profile=.5,affect='EDGES',clamp_overlap=True)
 return finish(_object(name,bm,(0,0,0)),name,mat)
def arch_ring(name,x,y,z,r0,r1,depth,mat,seg=12):
 """Semicircular moulding centred at (x,y), front face at z."""
 vs=[]
 for j in range(seg+1):
  t=j*math.pi/seg
  for r in (r0,r1):vs.append((x+math.cos(t)*r,y+math.sin(t)*r,z))
 for j in range(seg+1):
  t=j*math.pi/seg
  for r in (r0,r1):vs.append((x+math.cos(t)*r,y+math.sin(t)*r,z-depth))
 m=2*(seg+1);faces=[]
 for j in range(seg):
  a,b,c,d=2*j,2*j+1,2*j+3,2*j+2;faces+=[(a,d,c,b),(m+a,m+b,m+c,m+d),(a,m+a,m+d,d),(b,c,m+c,m+b)]
 return mesh(name,vs,faces,mat)
def box_cutter(p,s):
 bpy.ops.mesh.primitive_cube_add(size=1,location=co(p));o=bpy.context.object;o.scale=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return o
def cyl_cutter(p,r,depth,axis='z',vertices=20,squash=1):
 rot={'z':(math.pi/2,0,0),'x':(0,math.pi/2,0),'y':(0,0,0)}[axis]
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=co(p),rotation=rot);o=bpy.context.object
 if squash!=1:o.scale={'z':(1,squash,1),'x':(squash,1,1),'y':(1,squash,1)}[axis]
 bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);return o
def carve(target,cutters):
 if not cutters:return target
 bpy.ops.object.select_all(action='DESELECT')
 for c in cutters:c.select_set(True)
 bpy.context.view_layer.objects.active=cutters[0]
 if len(cutters)>1:bpy.ops.object.join()
 cutter=bpy.context.view_layer.objects.active
 mod=target.modifiers.new('carve','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter;mod.use_self=True;mod.use_hole_tolerant=True
 apply_mods(target);bpy.data.objects.remove(cutter,do_unlink=True);target['custom_mesh']=True;return target

# ---------- landforms ----------
def wobble(a):return 1+.065*math.sin(a*3+.5)+.045*math.cos(a*5)+.025*math.sin(a*9)
def adiff(a,c):return (a-c+math.pi)%math.tau-math.pi
def bump(a,c,w):
 d=abs(adiff(a,c))/w;return 0. if d>=1 else .5+.5*math.cos(d*math.pi)
# Same sector functions are mirrored in the sea shader (src/world/World.tsx).
def main_cliff(a):return min(1.,bump(a,-1.25,1.2)+.9*bump(a,.28,.36))
def main_beach(a):return bump(a,2.05,.8)
SHORE=[(1.045,-.6),(1.065,-.02),(1.035,.13),(1.0,.36),(.94,.78),(.895,1.04),(.87,TOP)]
CLIFF=[(1.03,-.6),(1.036,-.02),(1.03,.32),(1.022,.62),(1.012,.92),(1.0,TOP+.03),(.985,TOP)]
BEACH=[(1.11,-.6),(1.135,-.02),(1.09,.10),(1.03,.28),(.95,.60),(.86,1.02),(.82,TOP)]
def yscale(y,top):return y if y<=.36 else .36+(y-.36)*(top-.36)/(TOP-.36)
def profile(a,cliff,beach):
 c=cliff(a);b=beach(a);s=1-c-b
 return [(s*p[0]+c*q[0]+b*r[0],s*p[1]+c*q[1]+b*r[1]) for p,q,r in zip(SHORE,CLIFF,BEACH)],c
def orient(o,cx,cz):
 """Meadows face up; shore bands face away from the island centre."""
 for p in o.data.polygons:
  n=p.normal;c=p.center
  if abs(n.z)>.85:
   if n.z<0:p.flip()
  elif n.x*(c.x-cx)+n.y*(c.y+cz)<0:p.flip()
 o.data.update();o['keep_normals']=True
def meadow_disc(name,cx,cz,rx,rz,top,lips,n,mat='meadow'):
 global shade
 shade='meadow';fr=[.3,.5,.65,.78,.88,.95,1.];vs=[(cx,top,cz)]
 for r in fr:
  for i in range(n):a=i*math.tau/n;w=wobble(a)*lips[i]*r;vs.append((cx+math.cos(a)*rx*w,top,cz+math.sin(a)*rz*w))
 faces=[(0,1+i,1+(i+1)%n) for i in range(n)]
 for k in range(len(fr)-1):faces+=[(1+k*n+i,1+(k+1)*n+i,1+(k+1)*n+(i+1)%n,1+k*n+(i+1)%n) for i in range(n)]
 o=mesh(name,vs,faces,mat);orient(o,cx,cz);shade='ao';return o
def landmass(name,cx,cz,rx,rz,top,cliff,beach,n=160):
 global shade
 shade='edge';rings=len(SHORE);vs=[];cl=[]
 for k in range(rings):
  for i in range(n):
   a=i*math.tau/n;prof,c=profile(a,cliff,beach);f,y=prof[k];y=yscale(y,top)
   if 1<=k<=4 and c>.05:f+=(random.random()-.5)*.02*c;y+=(random.random()-.5)*.08*c*(k>1)
   w=wobble(a);vs.append((cx+math.cos(a)*rx*f*w,y,cz+math.sin(a)*rz*f*w));cl.append(c)
 faces=[];mats=[]
 for k in range(rings-1):
  for i in range(n):
   j=(i+1)%n;faces.append((k*n+i,k*n+j,(k+1)*n+j,(k+1)*n+i))
   mats.append(['basalt','basalt','rock','rockLight','rock','grassDark'][k] if (cl[k*n+i]+cl[k*n+j])/2>.5 else ['wetSand','wetSand','sand','sand','sand','sand'][k])
 o=mesh(name+' shore',vs,faces,mats);orient(o,cx,cz);shade='ao'
 meadow_disc(name+' meadow',cx,cz,rx,rz,top,[profile(i*math.tau/n,cliff,beach)[0][-1][0] for i in range(n)],n)
HILL=[(1.0,TOP-.03),(.96,1.36),(.9,1.76),(.84,2.06),(.78,2.25)]
def hill_height(x,z,cx=0,cz=-8.,rx=4.1,rz=3.0):
 a=math.atan2((z-cz)/rz,(x-cx)/rx);r=math.hypot((x-cx)/rx,(z-cz)/rz)/wobble(a)
 if r>=1:return TOP
 for (f0,y0),(f1,y1) in zip(HILL,HILL[1:]):
  if r>=f1:return y0+(y1-y0)*(f0-r)/(f0-f1)
 return HILL[-1][1]
def ground(x,z):return max(TOP,hill_height(x,z))
def mound(name,cx,cz,rx,rz,rock_centre,n=96):
 global shade
 vs=[];rw=[]
 for k,(f,y) in enumerate(HILL):
  for i in range(n):
   a=i*math.tau/n;c=bump(a,rock_centre,1.1);ff=f+(random.random()-.5)*.03*c*(0<k<4);w=wobble(a)
   vs.append((cx+math.cos(a)*rx*ff*w,y+(random.random()-.5)*.06*c*(0<k<4),cz+math.sin(a)*rz*ff*w));rw.append(c)
 faces=[];mats=[]
 for k in range(len(HILL)-1):
  for i in range(n):
   j=(i+1)%n;faces.append((k*n+i,k*n+j,(k+1)*n+j,(k+1)*n+i));mats.append(['rock','rockLight','rock','grassDark'][k] if (rw[k*n+i]+rw[k*n+j])/2>.55 else 'grassDark')
 shade='edge';o=mesh(name+' slope',vs,faces,mats);orient(o,cx,cz);shade='ao'
 meadow_disc(name+' crown',cx,cz,rx,rz,HILL[-1][1],[HILL[-1][0]]*n,n,'grassDark')
def rock(x,y,z,s,mat=None,flat=.62):
 global shade
 prev=shade;shade='rock';o=ico('rock',(x,y,z),(s*(.8+random.random()*.4),s*flat*(.8+random.random()*.5),s*(.8+random.random()*.4)),mat or random.choice(['rock','rock','rockLight','basalt']));shade=prev;return o
def shore_point(a,f,cx=0,cz=0,rx=13.3,rz=11.1):
 w=wobble(a);return cx+math.cos(a)*rx*f*w,cz+math.sin(a)*rz*f*w

# ---------- plants ----------
def pot(x,y,z,flowers=False,size=.22,bloom='flower'):
 rod('terracotta pot',(x,y,z),(x,y+size*1.4,z),size*.72,'roof',size,10)
 torus('pot lip',(x,y+size*1.4,z),size,.025,'roofLight',16,4)
 global shade
 shade='canopy'
 for i in range(4):
  a=i*2.4;dx=math.cos(a)*size*.5;dz=math.sin(a)*size*.5
  sphere('leaf',(x+dx,y+size*2,z+dz),(.11,.2,.08),'leafLight',8,5)
  if flowers:sphere('flower',(x+dx,y+size*2.9,z+dz),(.085,.075,.085),bloom,8,5)
 shade='ao'
def tree(x,y,z,s=1,pink=False):
 global shade
 rod('tree trunk',(x,y,z),(x+.12*s,y+1.7*s,z),.12*s,'wood',.055*s,8)
 shade='canopy'
 for i in range(8):
  a=i*2.4;r=.25+(i%3)*.20;dx=math.sin(a)*r*s;dz=math.cos(a)*r*s;height=1.95+.27*math.cos(i*1.2)
  sphere('leaf cluster',(x+dx,y+height*s,z+dz),(.5*s,.43*s,.48*s),'blossom' if pink else ['leaf','leafLight','leafDeep'][i%3],12,8)
  if i%2==0:sphere('leaf tip',(x+dx+.16*s,y+(height+.22)*s,z+dz-.12*s),(.30*s,.27*s,.32*s),'flower' if pink else 'leafLight',10,6)
 shade='ao'
def palm(x,y,z,s=1,lean=None,fronds=10):
 """Coconut palm: segmented, sea-leaning trunk and pinnate, drooping fronds."""
 global shade
 if lean is None:
  d=Vector((x,z));lean=d.normalized()*(.55+random.random()*.5) if d.length>.5 else Vector((.3,.2))
 H=(2.7+random.random()*.6)*s;pts=[]
 for i in range(10):
  t=i/9;pts.append((x+lean.x*t*t*1.3*s,y+t*H,z+lean.y*t*t*1.3*s))
 for i in range(9):rod('palm trunk',pts[i],pts[i+1],(.15-.045*i/9)*s,'trunk' if i%2 else 'trunkLight',(.15-.045*(i+1)/9)*s,8)
 tx,ty,tz=pts[-1];shade='canopy';verts={'palm':[],'palmDark':[]};faces={'palm':[],'palmDark':[]}
 for k in range(fronds):
  heading=k*math.tau/fronds+random.uniform(-.2,.2);rise=random.uniform(.25,.75);L=random.uniform(1.55,1.95)*s;mat='palm' if k%2 else 'palmDark'
  dirv=Vector((math.cos(heading),0,math.sin(heading)));side=Vector((-math.sin(heading),0,math.cos(heading)));spine=[]
  for j in range(9):
   t=j/8;spine.append(Vector((tx,ty,tz))+dirv*L*t+Vector((0,L*(math.sin(rise)*t-.62*t*t),0)))
  vs=verts[mat];fs=faces[mat]
  for j in range(1,9):
   t=j/8;p=spine[j];prev=spine[j-1];tan=(p-prev).normalized();ll=(.46*math.sin(min(1,t*1.1)*math.pi*.92)+.07)*s
   for sd in (-1,1):
    tip=p+side*ll*sd+Vector((0,-.32*ll,0))+tan*.1*s;base=len(vs);vs+=[tuple(prev+tan*.02),tuple(p),tuple(tip)];fs.append((base,base+1,base+2))
   base=len(vs);vs+=[tuple(prev+side*.018*s),tuple(prev-side*.018*s),tuple(p-side*.012*s),tuple(p+side*.012*s)];fs.append((base,base+1,base+2,base+3))
 for mat in verts:
  if verts[mat]:
   o=mesh('palm crown',verts[mat],faces[mat],mat);o['keep_normals']=True
 for i in range(4):
  a=i*1.7;sphere('coconut',(tx+math.cos(a)*.13*s,ty-.14*s,tz+math.sin(a)*.13*s),(.1*s,.1*s,.1*s),'coconut',8,6)
 shade='ao'
def bougainvillea(points,step=.11,size=.1,leafy=.22):
 """Bougainvillea: papery magenta bracts tumbling along a polyline."""
 global shade
 shade='canopy'
 for a,b in zip(points,points[1:]):
  n=max(1,int((Vector(a)-Vector(b)).length/step))
  for i in range(n):
   t=i/n;p=[a[j]+(b[j]-a[j])*t for j in range(3)]
   for k in range(2):
    s=size*.62*(.7+random.random()*.6);q=[p[0]+random.uniform(-.07,.07),p[1]+random.uniform(-.06,.05),p[2]+random.uniform(-.05,.05)]
    m='leafDeep' if random.random()<leafy else random.choice(['bougain','bougain','bougainLight'])
    sphere('bougainvillea',q,(s,s*.78,s),m,7,5)
 shade='ao'
def flower_patch(cx,cz,r,count,colours=('flower','white','bougainLight','yellow'),yfn=None):
 global shade
 shade='canopy'
 for i in range(count):
  a=random.random()*math.tau;d=r*math.sqrt(random.random());x=cx+math.cos(a)*d;z=cz+math.sin(a)*d
  if not clear_of(x,z):continue
  y=(yfn or ground_at)(x,z)
  sphere('meadow tuft',(x,y+.05,z),(.13,.09,.13),'grassLight',6,4)
  sphere('wildflower',(x+.03,y+.17,z),(.055,.05,.055),random.choice(colours),6,4)
 shade='ao'

# ---------- furniture ----------
def bench(x,y,z,rot=0):
 for i in range(4):cube('bench slat',(x,y+.48,z+(i-1.5)*.12),(1.5,.07,.10),'wood',.02)
 for i in range(3):cube('bench back',(x,y+.75+i*.13,z-.26),(1.5,.10,.065),'wood',.02)
 for dx in [-.52,.52]:
  rod('bench leg',(x+dx,y,z+.18),(x+dx,y+.48,z+.18),.045,'metal',vertices=6);rod('bench leg',(x+dx,y,z-.2),(x+dx,y+1.04,z-.2),.045,'metal',vertices=6)
def awning(x,y,z,w,colours,depth=.8,stripes=12):
 for i in range(stripes):
  o=cube('striped canopy',(x-w*.48+w*.96/stripes*(i+.5),y,z+depth/2),(w*.96/stripes,.07,depth),colours[i%2],.01);o.rotation_euler.x=.16
  cube('awning scallop',(x-w*.48+w*.96/stripes*(i+.5),y-.2,z+depth-.02),(w*.96/stripes,.2,.06),colours[i%2],.03)
def balusters(x0,x1,y,z,mat='celadon',spacing=.13,height=.32):
 n=max(2,int((x1-x0)/spacing))
 for i in range(n+1):lathe('vase baluster',x0+(x1-x0)*i/n,y,z,VASE,mat,6,height/.3)
def finial(x,y,z,h=.26,mat='trim'):
 cube('parapet post',(x,y+h/2,z),(.15,h,.17),mat,.02);sphere('ball finial',(x,y+h+.07,z),(.075,.075,.075),mat,8,6)

# ---------- Arcaded shophouse ----------
def shophouse(name,x,z,w,d,floors,wall,crown='gable',shutter='teal',bays=3,awn=None,balcony=False,sign=None,blade=None,base=1.12):
 global shade
 g=1.45;u=1.1;h=g+u*floors;fz=z+d/2;depth=.62;cw=.2;yt=base+h
 cube(name+' plinth',(x,base-.02,z),(w+.18,.14,d+.18),'plinth',.03)
 cube(name+' back',(x,base+h/2,z-d/2+.075),(w,h,.15),wall,0)
 for s in (-1,1):
  cube(name+' side',(x+s*(w/2-.075),base+g/2,z-depth/2),(.15,g,d-depth),wall,0)
  cube(name+' upper side',(x+s*(w/2-.075),base+g+(h-g)/2,z),(.15,h-g,d),wall,0)
 # Five-foot way: recessed shopfront behind a colonnade of round arches.
 cube(name+' shopfront',(x,base+g/2,fz-depth),(w-.3,g,.1),'shopWall',0)
 cube(name+' arcade ceiling',(x,base+g-.06,fz-depth/2-.08),(w-.1,.12,depth-.16),wall,0)
 plate(name+' arcade tiles',x,base+.012,fz-depth/2,w-.12,depth,'tile' if 'tile' in M else 'stone')
 front=cube(name+' arcade front',(x,base+g/2,fz-.08),(w,g,.16),wall,0);cuts=[];cols=[x-w/2+cw/2+j*(w-cw)/bays for j in range(bays+1)]
 bay=(w-cw)/bays;ow=bay-cw;r=ow/2;spring=base+g-.2-r
 for j in range(bays):
  cxb=(cols[j]+cols[j+1])/2;cuts.append(box_cutter((cxb,(base-.05+spring)/2,fz-.08),(ow,spring-base+.05,.6)));cuts.append(cyl_cutter((cxb,spring,fz-.08),r,.6))
 carve(front,cuts)
 for j,cx_ in enumerate(cols):
  cube('column capital',(cx_,spring,fz-.08),(cw+.06,.06,.2),'trim',.01);cube('column base',(cx_,base+.07,fz-.08),(cw+.06,.14,.2),'trim',.01)
  for k in range(1,5):cube('pier groove',(cx_,base+.14+k*(spring-base-.14)/5,fz+.001),(cw+.004,.014,.006),'plinth',0)
 for j in range(bays):
  cxb=(cols[j]+cols[j+1])/2;arch_ring('arch moulding',cxb,spring,fz+.012,r,r+.07,.03,'trim',10)
  rod('lamp cord',(cxb,base+g-.12,fz-depth/2),(cxb,base+g-.3,fz-depth/2),.006,'metal',vertices=4);sphere('arcade lamp',(cxb,base+g-.35,fz-depth/2),(.055,.06,.055),'lamp',10,6)
  if j==bays//2:
   # Half-open timber doors onto a dim shop interior.
   cube('shop interior',(cxb,base+.6,fz-depth+.052),(ow*.62,1.16,.012),'ink',0);cube('door frame',(cxb,base+1.2,fz-depth+.06),(ow*.72,.07,.06),'darkWood',.01)
   for sd in (-1,1):
    a=.62;lw=ow*.3;hx=cxb+sd*ow*.31;o=cube('door leaf',(hx-sd*lw/2*math.cos(a),base+.6,fz-depth+.07+lw/2*math.sin(a)),(lw,1.12,.035),shutter,.01);o.rotation_euler.z=sd*a
  else:
   cube('display window',(cxb,base+.78,fz-depth+.06),(ow*.72,.66,.03),'glass',.01);cube('display sill',(cxb,base+.43,fz-depth+.08),(ow*.8,.06,.1),'darkWood',.01)
 cube('floor band',(x,base+g+.02,fz+.02),(w+.06,.09,.07),'trim',.01)
 # Upper storeys: arched shutters between pilasters.
 upper=cube(name+' upper front',(x,base+g+(h-g)/2,fz-.08),(w,h-g,.16),wall,0);cuts=[]
 ww=min(.44,bay*.5);wr=ww/2
 for f in range(floors):
  y0=base+g+f*u
  for j in range(bays):
   cxb=(cols[j]+cols[j+1])/2;door=balcony and f==0 and j==bays//2;wh=.84 if door else .56;yb=y0+(.06 if door else .2)
   cuts.append(box_cutter((cxb,yb+wh/2,fz-.08),(ww,wh,.5)));cuts.append(cyl_cutter((cxb,yb+wh,fz-.08),wr,.5,vertices=16))
   shade='glass';cube('window glass',(cxb,yb+(wh+wr)/2,fz-.13),(ww+.02,wh+wr,.02),'glass',0);shade='ao'
   cube('mullion',(cxb,yb+(wh+wr*.9)/2,fz-.115),(.022,wh+wr*.9,.02),'trim',0);cube('transom',(cxb,yb+wh,fz-.115),(ww,.022,.02),'trim',0)
   for s in (-1,1):
    # Shutters stay inside their own bay so neighbouring windows never overlap.
    sw=min(ww*.5,(bay-ww)/2-.07);sx=cxb+s*(ww/2+.035+sw/2);sh=wh+wr*.55;sy=yb+wh*.5+.05;cube('open shutter',(sx,sy,fz+.02),(sw,sh,.035),shutter,.01)
    for k in range(6):cube('louvre',(sx,sy-sh/2+(k+.5)*sh/6,fz+.04),(sw*.84,.022,.012),shutter+'Shade',0)
    cube('sill bracket',(cxb+s*ww*.42,yb-.075,fz+.04),(.04,.06,.06),'trim',0)
   arch_ring('window hood',cxb,yb+wh,fz+.012,wr,wr+.06,.03,'trim',8);cube('keystone',(cxb,yb+wh+wr+.035,fz+.03),(.075,.11,.05),'trim',.01)
   cube('window sill',(cxb,yb-.02,fz+.04),(ww+.14,.05,.1),'trim',.01)
   if door:
    cube('balcony slab',(cxb,y0+.03,fz+.2),(bay*.95,.07,.4),'trim',.01);cube('balcony rail',(cxb,y0+.4,fz+.38),(bay*.95,.05,.06),'trim',.01)
    balusters(cxb-bay*.44,cxb+bay*.44,y0+.07,fz+.38,'celadon',.12,.3)
    pot(cxb-bay*.32,y0+.07,fz+.18,True,.1,'bougain');pot(cxb+bay*.32,y0+.07,fz+.18,True,.1)
   elif not balcony and f==floors-1 and floors>1 and j!=bays//2:
    cube('window flower box',(cxb,yb-.08,fz+.1),(ww+.1,.12,.16),'cream',.03)
    shade='canopy'
    for i in range(4):sphere('window blossoms',(cxb-.15+i*.1,yb+.01,fz+.1),(.07,.06,.07),'flower' if i%2 else 'leafLight',8,5)
    shade='ao'
 carve(upper,cuts)
 for cx_ in cols[1:-1]:cube('pilaster',(cx_,base+g+(h-g)/2,fz+.015),(.12,h-g-.05,.05),'trim',0);cube('pilaster capital',(cx_,yt-.14,fz+.03),(.17,.06,.07),'trim',0)
 for sd in (-1,1):
  for k in range(int((h-g-.1)/.22)):qw=.2 if k%2==0 else .13;cube('quoin',(x+sd*(w/2-qw/2),base+g+.13+k*.22,fz+.012),(qw,.17,.04),'trim',.01)
 for i in range(int((w-.1)/.11)):cube('dentil',(x-w/2+.08+i*.11,yt-.035,fz+.03),(.05,.05,.05),'trim',0)
 for f in range(1,floors):cube('storey band',(x,base+g+f*u,fz+.02),(w+.04,.07,.06),'trim',.01)
 # Parapet: the most decorative part of a shophouse.
 cube('cornice',(x,yt+.05,fz-.02),(w+.16,.1,.22),'trim',.02)
 if crown=='gable':
  cube('parapet wall',(x,yt+.31,fz-.05),(w,.42,.14),wall,0)
  gw=w*.5;outline=[]
  right=[(gw/2,0),(gw/2,.1),(gw*.4,.13),(gw*.34,.22),(gw*.3,.32),(gw*.22,.4),(gw*.15,.44),(gw*.13,.49)]
  rr=gw*.13;top=[(math.cos(t)*rr,.49+math.sin(t)*rr*.9) for t in [i*math.pi/8 for i in range(1,8)]]
  outline=right+top+[(-px,py) for px,py in reversed(right)]
  gable=prism(name+' baroque gable',[(x+px,yt+.52+py) for px,py in outline],fz+.02,.14,wall)
  carve(gable,[cyl_cutter((x,yt+.52+.27,fz-.05),.095,.5,'z',16,.8)])
  cube('gable coping',(x,yt+.53,fz-.05),(gw+.08,.05,.18),'trim',.01)
  o=torus('wind hole ring',(x,yt+.52+.27,fz+.025),.122,.017,'trim',24,6);o.rotation_euler.x=math.pi/2
  sphere('gable finial',(x,yt+.52+.49+rr*.9+.06,fz-.05),(.055,.06,.055),'trim',10,6)
  for sd in (-1,1):rod('gable scroll',(x+sd*gw/2,yt+.6,fz-.13),(x+sd*gw/2,yt+.6,fz+.03),.045,'trim',vertices=10)
  for s in (-1,1):finial(x+s*(w/2-.08),yt+.47,fz-.05)
  cube('name plate',(x,yt+.3,fz+.035),(w*.46,.24,.03),'plate',.01)
  if sign:ANCHORS['signs'].append({'id':name.replace(' ','-'),'text':sign,'position':[x,yt+.3,fz+.055],'size':[w*.42,.2],'rotationY':0})
  cube(name+' roof deck',(x,yt+.02,z),(w-.05,.08,d-.1),'stone',0);roof(x,yt,z-.04,w+.12,d-.17)
 else:
  if crown=='balustrade':
   cube('parapet base',(x,yt+.15,fz-.05),(w,.1,.16),'trim',.01);cube('parapet rail',(x,yt+.5,fz-.05),(w+.04,.07,.18),'trim',.01)
   posts=[x-w/2+.08,x,x+w/2-.08]
   for p in posts:finial(p,yt+.1,fz-.05,.48)
   for a,b in zip(posts,posts[1:]):balusters(a+.1,b-.1,yt+.2,fz-.05)
  else:
   cube('deco parapet',(x,yt+.28,fz-.05),(w,.36,.15),wall,0);cube('deco step',(x,yt+.58,fz-.05),(w*.6,.26,.15),wall,0);cube('deco crown',(x,yt+.8,fz-.05),(w*.28,.2,.15),wall,0)
   for s in (-1,1):
    for k in range(3):cube('deco fluting',(x+s*(w*.1+k*.09),yt+.55,fz+.03),(.035,.3,.03),'trim',0)
   cube('name plate',(x,yt+.3,fz+.03),(w*.4,.2,.03),'plate',.01)
   if sign:ANCHORS['signs'].append({'id':name.replace(' ','-'),'text':sign,'position':[x,yt+.3,fz+.05],'size':[w*.36,.17],'rotationY':0})
  cube(name+' flat roof',(x,yt+.02,z-.05),(w-.05,.08,d-.1),'stone',0)
 if awn:awning(x,base+g-.06,fz+.02,w-.1,awn,.72)
 if blade:
  bx=x+w/2-.12;rod('sign bracket',(bx,base+g+.82,fz),(bx,base+g+.82,fz+.52),.018,'metal',vertices=6)
  cube('blade sign',(bx,base+g+.52,fz+.32),(.05,.56,.34),'plate',.01)
  for s in (-1,1):ANCHORS['signs'].append({'id':name.replace(' ','-')+('-l' if s<0 else '-r'),'text':blade,'position':[bx+s*.028,base+g+.52,fz+.32],'size':[.3,.5],'rotationY':s*math.pi/2,'vertical':True})
 return yt
def roof(x,y,z,w,d,pitch=.78):
 vs=[(x-w/2,y,z-d/2),(x+w/2,y,z-d/2),(x+w/2,y,z+d/2),(x-w/2,y,z+d/2),(x,y+pitch,z-d/2),(x,y+pitch,z+d/2)]
 mesh('tiled gable',vs,[(0,3,5,4),(4,5,2,1),(0,4,1),(3,2,5)],'roof')
 for side in (-1,1):cube('fascia',(x+side*w/2,y+.02,z),(.04,.07,d+.04),'trim',0)
 rod('ridge',(x,y+pitch+.04,z-d/2-.04),(x,y+pitch+.04,z+d/2+.04),.085,'roofLight',vertices=8)
 for i in range(int(d/.22)+1):
  zz=z-d/2+i*.22
  for side in [-1,1]:rod('tile rib',(x,y+pitch+.02,zz),(x+side*w/2,y+.035,zz),.023,'roofLight',vertices=5)
def arch(x,y,z,width,height,mat='cream'):
 global shade
 radius=width/2;spring=y+height-radius
 shade='glass';cube('arch shade',(x,y+height*.46,z-.035),(width,height*.88,.05),'glass',.02);shade='ao'
 for side in [-1,1]:cube('arcade column',(x+side*(radius+.045),y+(height-radius)/2,z),(.16,height-radius,.23),mat,.035)
 arch_ring('arched lintel',x,spring,z+.1,radius,radius+.17,.2,mat,12)
def cottage(name,x,z,w,d,h,mat,base=1.12):
 """Her home: a tiled cottage whose front wall and roof hide for the interior view."""
 global role,shade
 role='static';cube(name+' foundation',(x,base+.1,z),(w+.22,.2,d+.22),'stone',.09)
 cube(name+' back',(x,base+h/2,z-d/2),(w,h,.15),mat)
 for dx in [-w/2,w/2]:cube(name+' side',(x+dx,base+h/2,z),(.15,h,d),mat)
 role='home_front'
 cube(name+' facade',(x,base+h/2,z+d/2),(w,h,.16),mat)
 cube('cornice',(x,base+h-.16,z+d/2+.08),(w+.2,.18,.28),'trim')
 fz=z+d/2
 for i in range(3):
  xx=x+(i-1)*w/3.25
  if i==1:
   cube('door frame',(xx,base+.78,fz+.1),(.78,1.3,.05),'trim',.01);cube('front door',(xx,base+.74,fz+.12),(.62,1.18,.06),'rose',.02)
   for k in range(2):cube('door panel',(xx,base+.48+k*.5,fz+.155),(.44,.36,.015),'roseShade',0)
   sphere('door knob',(xx+.22,base+.74,fz+.17),(.025,.025,.025),'gold',8,6)
   o=cube('door canopy',(xx,base+1.56,fz+.3),(1.02,.05,.46),'roof',.01);o.rotation_euler.x=.32
   for sd in (-1,1):cube('canopy bracket',(xx+sd*.44,base+1.42,fz+.17),(.04,.18,.14),'trim',0)
   cube('door step',(xx,base+.05,fz+.32),(.94,.1,.34),'stone',.02)
   cube('porch lamp back',(xx+.56,base+1.24,fz+.1),(.08,.16,.04),'metal',0);sphere('porch lamp',(xx+.56,base+1.24,fz+.17),(.05,.07,.05),'lamp',10,6)
   cube('house plate',(xx-.58,base+1.24,fz+.09),(.3,.18,.02),'trim',.005)
   ANCHORS['signs'].append({'id':'home-plate','text':'No.1','position':[xx-.58,base+1.24,fz+.102],'size':[.27,.15],'rotationY':0,'bg':'#2f5e8c','ink':'#ffffff','hideInside':True})
  else:arch(xx,base+.16,z+d/2+.12,w/4*.82,1.32,'trim')
  shade='glass';cube('window',(xx,base+2.12,z+d/2+.115),(.49,.72,.06),'glass',.025);shade='ao'
  cube('window mullion',(xx,base+2.12,z+d/2+.15),(.025,.72,.02),'trim',0);cube('window transom',(xx,base+2.26,z+d/2+.15),(.49,.025,.02),'trim',0)
  for side in [-1,1]:
   cube('shutter',(xx+side*.33,base+2.12,z+d/2+.18),(.16,.82,.06),'rose',.015)
   for k in range(6):cube('louvre',(xx+side*.33,base+1.77+k*.14,z+d/2+.215),(.13,.022,.012),'roseShade',0)
  cube('window sill',(xx,base+1.7,z+d/2+.22),(.86,.10,.30),'trim')
  cube('window flower box',(xx,base+1.82,z+d/2+.34),(.58,.16,.24),'cream',.04)
  shade='canopy'
  for k in range(4):sphere('window blossoms',(xx-.18+k*.12,base+1.96,z+d/2+.35),(.08,.07,.08),'bougainLight' if k%2 else 'leafLight',8,5)
  shade='ao'
 for sd in (-1,1):
  for k in range(int(h/.24)):qw=.22 if k%2==0 else .14;cube('quoin',(x+sd*(w/2-qw/2+.07),base+.24+k*.24,fz+.09),(qw,.18,.04),'trim',.01)
 role='home_roof';roof(x,base+h,z,w+.45,d+.4,.9)
 cube('terracotta chimney',(x+.9,base+h+.8,z-.7),(.32,.7,.34),'peach',.03);cube('chimney rim',(x+.9,base+h+1.16,z-.7),(.4,.1,.41),'cream',.03)
 role='static'

# ================= terrain =================
stage('terrain');region='terrain'
landmass('main island',0,0,13.3,11.1,TOP,main_cliff,main_beach)
landmass('secret islet',-18,-8,2.9,2.1,.75,lambda a:bump(a,-2.3,.9),lambda a:bump(a,.9,1.0),64)
# The hill and the sunset beach are built here too, so everything after this stands on the real ground.
region='hill';mound('hill terrace',0,-8.0,4.1,3.0,-math.pi/2)
region='coast';shade='sand';sphere('beach',(-6.7,.875,7.9),(3.8,.12,2.35),'sand',40,8);shade='ao'
region='terrain'
def world_bvh(o):
 mw=o.matrix_world;return BVHTree.FromPolygons([mw@v.co for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons])
GROUND=[world_bvh(bpy.data.objects[n]) for n in ('main island meadow','main island shore','hill terrace slope','hill terrace crown','beach')]
def ground_at(x,z):
 """Height of the real ground (meadow, shore, hill or beach) under (x, z)."""
 best=None
 for t in GROUND:
  hit=t.ray_cast(Vector((x,-z,30.)),Vector((0,0,-1.)))
  if hit[0] is not None and (best is None or hit[0].z>best):best=hit[0].z
 return best if best is not None else 0.
# One road network, drawn as a single surface from a distance field, so crossings never overlap (no z-fighting)
# and every vertex is draped on the ground (no road sinking into a slope).
ROADS=[
 ([(-8.8,5.2),(-6.6,4.5),(-4.4,4.45),(-2.0,4.4)],1.35),                       # promenade, west half
 ([(2.0,4.4),(4.4,4.5),(6.2,4.55),(7.4,4.15)],1.35),                          # promenade, east half, to the library pool
 ([(5.6,4.3),(6.35,2.6),(6.6,.4),(7.0,-1.6)],.95),                            # lane to Home's garden gate
 ([(-6.3,4.3),(-6.35,2.6),(-6.2,.4),(-6.25,-1.5),(-6.15,-3.2),(-5.6,-4.4),(-4.2,-4.75),(-3.0,-5.05)],.9),  # park lane
 ([(-3.0,-5.05),(-2.3,-5.7),(-.8,-5.75),(1.3,-6.45),(.7,-7.35),(0.,-7.75)],.62),  # hill trail to the lighthouse
 ([(-4.8,4.7),(-5.4,6.0),(-5.75,6.45)],.9),                                    # down to the beach
 ([(-.3,7.2),(-.7,8.4),(-1.0,9.0)],.8),                                        # to the pier
]
SQUARE=(0.,5.35,2.1)
def road_sdf(px,pz):
 px=np.asarray(px,float);pz=np.asarray(pz,float);d=np.full(px.shape,9.)
 for pts,w in ROADS:
  for (ax,az),(bx,bz) in zip(pts,pts[1:]):
   vx,vz=bx-ax,bz-az;t=np.clip(((px-ax)*vx+(pz-az)*vz)/(vx*vx+vz*vz),0,1)
   d=np.minimum(d,np.hypot(px-(ax+t*vx),pz-(az+t*vz))-w/2)
 d=d+.035*np.sin(px*3.1+pz*1.7)+.025*np.sin(pz*4.3-px*2.2)
 return np.maximum(d,SQUARE[2]+.03-np.hypot(px-SQUARE[0],pz-SQUARE[1]))
def draped(name,sdf,bounds,h,lift,mat,mode):
 """A ground surface traced from a distance field (marching squares) and draped on the real ground."""
 global shade
 x0,x1,z0,z1=bounds;xs=np.arange(x0,x1+.001,h);zs=np.arange(z0,z1+.001,h);PX,PZ=np.meshgrid(xs,zs,indexing='ij');D=sdf(PX,PZ);inside=D<0
 cells=np.argwhere(inside[:-1,:-1]|inside[1:,:-1]|inside[1:,1:]|inside[:-1,1:])
 verts=[];index={};faces=[]
 def vid(key,x,z):
  if key not in index:index[key]=len(verts);verts.append((float(x),float(z)))
  return index[key]
 for i,j in cells:
  i=int(i);j=int(j);c=[(i,j),(i+1,j),(i+1,j+1),(i,j+1)];ds=[float(D[a]) for a in c];poly=[]
  for k in range(4):
   a=c[k];b=c[(k+1)%4];da=ds[k];db=ds[(k+1)%4]
   if da<0:poly.append(vid(('v',)+a,xs[a[0]],zs[a[1]]))
   if (da<0)!=(db<0):
    t=da/(da-db);poly.append(vid(('e',)+tuple(sorted([a,b])),xs[a[0]]+(xs[b[0]]-xs[a[0]])*t,zs[a[1]]+(zs[b[1]]-zs[a[1]])*t))
  if len(poly)>=3:faces.append(poly)
 prev=shade;shade=mode;o=mesh(name,[(x,ground_at(x,z)+lift,z) for x,z in verts],faces,mat);face_up(o);shade=prev;return o
draped('island roads',road_sdf,(-11.,11.,-9.,10.),.08,.03,'path','road')
shade='sand'
# The square: only its stone kerb is built here. The paving itself (pale pink pavers laid in rings, a few petal
# inlays) is a painted disc in the app (src/world/Plaza.tsx), at SY, inside this kerb.
sx,sz,_=SQUARE;SY=1.14
torus('square kerb',(sx,SY,sz),2.11,.05,'trim',64,5)
shade='ao'
# Footprints of things placed later (ellipses cx, cz, rx, rz), so scattered flowers, grass and shells keep clear.
CLEAR=[(-8.7,-1.6,1.6,1.15),(-8.0,-4.4,1.3,1.3),(-8.6,1.6,1.25,.8),(-10.4,1.85,.45,1.25),(-7.0,-.2,.35,1.15),(-10.0,-.1,.8,.62),(-9.4,-3.0,.95,.5),
 (8.8,2.4,3.1,2.7),(0.,5.35,2.35,2.35)]
def clear_of(x,z,margin=.15):
 if float(road_sdf(x,z))<margin:return False
 return all(((x-cx)/rx)**2+((z-cz)/rz)**2>=1 for cx,cz,rx,rz in CLEAR)
# Rocks: basalt at the foot of the northern cliffs, a sea stack off the eastern headland, stepping stones at the beach ends.
for i in range(46):
 a=-2.45+i*2.45/45+random.uniform(-.02,.02);x,z=shore_point(a,random.uniform(1.03,1.075));rock(x,random.uniform(-.15,.25),z,random.uniform(.35,.8),random.choice(['basalt','basalt','rock']))
for a in [-.02,.12,.3,.46,.6]:
 x,z=shore_point(a,random.uniform(1.04,1.07));rock(x,.05,z,random.uniform(.4,.7),random.choice(['basalt','rock']))
x,z=shore_point(-.42,1.18);rock(x,.3,z,.62,'basalt',1.1);rock(x+.5,.05,z+.4,.42,'basalt');rock(x-.4,0,z-.5,.35,'rock')
x,z=shore_point(-1.9,1.16);rock(x,.4,z,.6,'rock',1.5);rock(x+.4,0,z+.3,.35,'basalt')
for a in [1.18,1.3,2.86,2.98]:
 x,z=shore_point(a,random.uniform(1.06,1.12));rock(x,.02,z,random.uniform(.3,.55))
for i in range(10):
 a=random.uniform(-3,-1.5);x,z=-18+math.cos(a)*2.9*1.05,-8+math.sin(a)*2.1*1.05;rock(x,.05,z,random.uniform(.25,.45))
# Coconut palms lean toward the sea; a few round-crowned shade trees.
for p in [(-11.2,-2.4),(-9,3),(-10,-4),(10.6,-5.2),(12,2.2),(3.8,8.6),(10.9,3.7),(-3,-7),(5,-7),(11.6,-2.8),(2.4,8.7),(-9.6,-6.2)]:palm(p[0],ground_at(*p),p[1],random.uniform(.85,1.15))
for p in [(-7,-7),(8,-8.1),(5.2,-8.4),(-10.8,-4.6)]:tree(p[0],ground_at(*p),p[1],random.uniform(.8,1.2))
# Meadow: clustered wild flowers, and the flower slope between Home and the sunrise hill.
for i in range(120):
 x=random.uniform(-11,11);z=random.uniform(-8,8)
 if (abs(x)<6.8 and -4.8<z<6.4) or (x/10.8)**2+(z/8.8)**2>1 or (abs(x)<2.6 and z>2.8):continue
 flower_patch(x,z,.25,2)
flower_patch(3.9,-6.4,1.2,26,('bougainLight','flower','white','yellow','blossom'));flower_patch(-2.8,-5.8,.8,12)
for i in range(60):
 a=i*2.399;r=8.8+random.random()*1.2;x=math.cos(a)*r;z=math.sin(a)*r*.82
 if (x>5 and z< -2) or (-4<x<5 and z<1) or main_beach(math.atan2(z/11.1,x/13.3))>.3:continue
 if not clear_of(x,z):continue
 gy=ground_at(x,z)
 for j in range(3):rod('coastal grass',(x+j*.06,gy,z),(x+(j-1)*.12,gy+.24+random.random()*.14,z+.04),.012,'grassLight',.002,4)
for i in range(22):
 x=-8+random.random()*3.4;z=8.4+random.random()*1.3;sphere('seashell',(x,.99,z),(.08,.035,.055),'white' if i%3 else 'pink',8,5)
# A green post box and a coconut cart for ordinary street life.
cube('post box',(1.9,1.62,3.6),(.34,.62,.3),'mailGreen',.04);cube('post box lid',(1.9,1.96,3.6),(.4,.06,.36),'mailGreen',.02);cube('post slot',(1.9,1.78,3.76),(.18,.03,.02),'ink',0);rod('post box foot',(1.9,1.12,3.6),(1.9,1.32,3.6),.06,'mailGreen',vertices=8)
cube('coconut cart',(-3.1,1.52,6.7),(1.0,.36,.55),'wood',.03)
for dx in (-.35,.35):torus('cart wheel',(-3.1+dx,1.3,7.01),.18,.03,'darkWood',16,4)
for i in range(7):sphere('green coconut',(-3.4+(i%4)*.18,1.78+(i//4)*.09,6.65+(i%2)*.1),(.11,.1,.11),'coconut',8,6)
rod('cart parasol pole',(-2.8,1.7,6.55),(-2.8,2.9,6.55),.02,'metal',vertices=6);rod('cart parasol',(-2.8,2.72,6.55),(-2.8,3.02,6.55),.75,'blush',0,12)

stage('town')
# ================= Shophouse town =================
region='town'
shophouse('flower shop',-4.2,1.1,2.65,2.7,1,'wallPink','gable','celadon',3,('blush','paper'),sign='SLOW BLOOM')
shophouse('diner',3.7,1.7,3.0,2.9,1,'wallButter','gable','teal',3,('mint','paper'),sign='EAT WELL DINER')
shophouse('bookshop',-1.25,-1.1,2.35,2.5,2,'wallMint','balustrade','ivory',2,blade='BOOKS')
shophouse('coffee',1.15,-1.25,2.1,2.45,2,'wallBlue','stepped','rose',2,sign='COFFEE')
shophouse('bakery',-4.1,-2.35,2.7,2.65,2,'wallCream','gable','teal',3,sign='BAKERY')
shophouse('residence',4.1,-2.25,2.7,2.3,2,'wallOchre','balustrade','celadon',3,balcony=True)
# Diner chimney (steam is animated in the page) and the flower shop wind chime.
cube('diner chimney',(4.85,4.15,.9),(.3,.8,.3),'peach',.03);cube('chimney rim',(4.85,4.58,.9),(.38,.08,.38),'cream',.03)
ANCHORS['steam'].append([4.85,4.66,.9]);ANCHORS['chimes'].append([-3.35,2.42,2.62])
# Bougainvillea spilling over the flower shop corner and along the bakery parapet.
bougainvillea([(-5.55,3.95,2.4),(-5.6,3.2,2.45),(-5.62,2.4,2.3),(-5.65,1.6,2.1)],.1,.12)
bougainvillea([(-5.5,3.75,2.45),(-4.8,3.8,2.47)],.1,.1)
bougainvillea([(-5.45,5.36,-1.08),(-4.95,5.4,-1.1),(-4.6,5.36,-1.08)],.1,.11)  # on the parapet top, clear of the 面包房 plate
bougainvillea([(-2.8,5.0,-1.02),(-2.72,4.2,-.98),(-2.7,3.3,-.96)],.1,.1)
bougainvillea([(5.3,4.9,-1.08),(5.45,4.0,-1.05),(5.5,3.1,-1.0)],.1,.11)
for i in range(6):pot(-5.9+i*.32,1.12,3.02,True,.19,'bougainLight' if i%2 else 'flower')
for x in (-3.1,-2.85):pot(x,1.12,2.25,True,.14)
for x,z in [(-.8,2),(1.2,2.4),(6.8,5.8)]:
 rod('cafe table leg',(x,1.1,z),(x,1.72,z),.05,'metal',vertices=8);rod('round cafe table',(x,1.72,z),(x,1.8,z),.44,'wood',vertices=20)
 for side in [-1,1]:
  cube('cafe chair',(x+side*.62,1.48,z),(.36,.08,.40),'skyBlue')
  for dx in [-.12,.12]:rod('chair leg',(x+side*.62+dx,1.12,z),(x+side*.62+dx,1.48,z),.025,'metal',vertices=5)
  cube('chair back',(x+side*.82,1.74,z),(.045,.45,.40),'skyBlue')
 cube('coffee cup',(x,1.86,z),(.1,.14,.1),'paper',.04)
for x in [-2.5,-1.6]:
 o=torus('bicycle wheel',(x,1.48,1.7),.33,.035,'metal',20,4);o.rotation_euler.x=math.pi/2
for a,b in [((-2.5,1.48,1.7),(-2.05,1.95,1.7)),((-2.05,1.95,1.7),(-1.6,1.48,1.7)),((-2.5,1.48,1.7),(-1.88,1.48,1.7)),((-1.88,1.48,1.7),(-2.05,1.95,1.7))]:rod('bicycle frame',a,b,.035,'pink',vertices=6)
cube('bicycle saddle',(-2.05,2.02,1.7),(.24,.055,.16),'wood');cube('bicycle basket',(-1.55,1.98,1.7),(.26,.18,.22),'darkWood',.03);sphere('basket flowers',(-1.55,2.1,1.7),(.13,.08,.1),'bougainLight',8,5)
# Rooftop life: a water tank, laundry and potted plants.
rod('water tank',(3.5,4.8,-2.6),(3.5,5.3,-2.6),.3,'white',vertices=16);rod('tank lid',(3.5,5.3,-2.6),(3.5,5.4,-2.6),.3,'skyBlue',0,16)
rod('washing line',(3.0,5.4,-1.7),(5.3,5.4,-1.7),.014,'wood',vertices=5)
for x in (3.0,5.3):rod('line post',(x,4.82,-1.7),(x,5.43,-1.7),.02,'wood',vertices=5)
for i in range(4):cube('linen',(3.35+i*.55,5.15,-1.7),(.38,.45,.025),['paper','blush','skyBlue','paper'][i],.01)
for p in [(.5,4.83,-2.0),(1.8,4.83,-1.9),(-.6,4.83,-1.9),(-1.9,4.83,-1.6)]:pot(*p,True,.16)
rod('rooftop parasol pole',(1.3,4.83,-1.6),(1.3,5.6,-1.6),.02,'metal',vertices=6);rod('rooftop parasol',(1.3,5.45,-1.6),(1.3,5.7,-1.6),.62,'coral',0,12)

# ================= Home =================
region='home';cottage('home',7,-4.3,3.7,3.1,2.8,'wallHome')
cube('home floor',(7,1.25,-4.3),(3.65,.12,3.05),'wood')
cube('woven rug',(7,1.32,-3.95),(2.2,.035,1.5),'pink',.12)
cube('bed frame',(8.13,1.51,-4.65),(1.05,.36,1.95),'wood')
cube('linen duvet',(8.13,1.76,-4.65),(1.01,.22,1.90),'paper',.12)
cube('pillow',(8.13,1.9,-5.22),(.72,.14,.42),'pink',.12)
cube('desk',(6.1,1.92,-4.0),(1.42,.12,.70),'wood')
for xx in [5.5,6.7]:
 for zz in [-4.25,-3.75]:rod('desk leg',(xx,1.28,zz),(xx,1.9,zz),.045,'wood',vertices=6)
cube('bookshelf',(5.35,2.0,-5.1),(.25,1.5,1.0),'wood')
for i in range(8):cube('book',(5.57,1.65+i*.10,-5.1),(.25,.07,.63),'paper' if i%3 else 'pink')
for i in range(3):cube('garden step',(7,1.1-i*.06,-2.62+i*.24),(2,.14,.4),'stone')
for x in [5.2,8.8]:pot(x,1.1,-2.15,True,.3,'bougainLight')
tree(4.85,1.1,-6.9,.91,True)
bench(7.7,1.12,-1.4)
for i in range(10):
 x=5.2+i*.38
 if abs(x-7)>.45:rod('garden fence',(x,1.1,-1.8),(x,1.7,-1.8),.035,'trim',vertices=6)
for a,b in [(5.2,6.55),(7.45,8.7)]:rod('fence rail',(a,1.48,-1.8),(b,1.48,-1.8),.04,'trim',vertices=6)
# Garden gate: an arch of bougainvillea.
for s in (-1,1):rod('gate post',(7+s*.5,1.1,-1.8),(7+s*.5,2.35,-1.8),.05,'trim',vertices=8)
gate=[(7-.5+(1-math.cos(t))*.5,2.35+math.sin(t)*.45,-1.8) for t in [i*math.pi/10 for i in range(11)]]
bougainvillea(gate,.08,.12,.3);bougainvillea([(6.5,2.3,-1.8),(6.45,1.8,-1.78),(6.4,1.3,-1.75)],.1,.1,.35);bougainvillea([(7.5,2.2,-1.8),(7.56,1.6,-1.77)],.1,.1,.35)
bougainvillea([(8.95,3.9,-2.7),(9.0,3.1,-2.8),(9.02,2.2,-3.0),(9.05,1.4,-3.2)],.1,.12)

# ================= Park =================
# Laid out so nothing touches: pond in the middle, swing and slide to the south-west, carousel to the north,
# the park lane along the town side (footprints are mirrored in CLEAR above and in src/world/Objects.tsx).
region='park'
PX,PZ=-8.7,-1.6
pond=sphere('pond',(PX,1.14,PZ),(1.4,.06,.95),'pond',32,6)
for i in range(18):
 a=i*math.tau/18;rock(PX+1.45*math.cos(a),1.16,PZ+1.0*math.sin(a),.2,random.choice(['stone','rockLight']),.7)
for a in (2.5,3.3):sphere('lily pad',(PX+math.cos(a)*.75,1.205,PZ+math.sin(a)*.45),(.16,.01,.16),'leafLight',10,3)
bench(-9.4,1.12,-3.0)
tree(-9.9,ground_at(-9.9,-5.5),-5.5,1,True);tree(-5.6,ground_at(-5.6,-6.0),-6.0,1.05,True)
SX,SZ=-8.6,1.6
for dx in [-.9,.9]:
 for zz in [-.5,.5]:rod('swing stand',(SX+dx,1.12,SZ+zz),(SX+dx,3.35,SZ),.065,'wood',vertices=8)
rod('swing beam',(SX-1,3.35,SZ),(SX+1,3.35,SZ),.09,'roof',vertices=8)
CX,CZ=-8.0,-4.4
for i in range(8):
 a=i*math.tau/8;rod('carousel pole',(CX+math.cos(a)*.75,1.3,CZ+math.sin(a)*.75),(CX+math.cos(a)*.75,2.55,CZ+math.sin(a)*.75),.025,'gold',vertices=6)
rod('carousel platform',(CX,1.12,CZ),(CX,1.3,CZ),.95,'pink',vertices=28)
rod('carousel step',(CX,1.1,CZ),(CX,1.19,CZ),1.06,'cream',vertices=28)
rod('carousel centre',(CX,1.3,CZ),(CX,2.55,CZ),.16,'paper',.13,16)
rod('carousel canopy',(CX,2.55,CZ),(CX,3.0,CZ),1.05,'pink',0,28)
for i in range(14):
 a=i*math.tau/14;cube('canopy scallop',(CX+math.cos(a)*1.02,2.5,CZ+math.sin(a)*1.02),(.2,.12,.04),'paper' if i%2 else 'blush',.02).rotation_euler.z=-a
rod('carousel finial',(CX,3.,CZ),(CX,3.27,CZ),.055,'gold',vertices=6)
# Slide by the western meadow: ladder at the north end, chute running south.
LX_,LZ_=-10.4,1.0
for s_ in (-1,1):rod('slide ladder',(LX_+s_*.22,1.1,LZ_),(LX_+s_*.22,2.2,LZ_+.15),.035,'coral',vertices=6)
for i in range(4):rod('ladder rung',(LX_-.22,1.35+i*.24,LZ_+.04+i*.03),(LX_+.22,1.35+i*.24,LZ_+.04+i*.03),.025,'coral',vertices=5)
cube('slide deck',(LX_,2.2,LZ_+.35),(.6,.07,.45),'yellow',.02)
o=cube('slide chute',(LX_,1.68,LZ_+1.15),(.5,.05,1.5),'mint',.02);o.rotation_euler.x=.62
for s_ in (-1,1):o=cube('chute rail',(LX_+s_*.24,1.76,LZ_+1.15),(.04,.1,1.5),'mint',.01);o.rotation_euler.x=.62
# Seesaw between the pond and the park lane, running north-south.
cube('seesaw plank',(-7.0,1.48,-.2),(.22,.07,1.9),'skyBlue',.02);rod('seesaw pivot',(-7.12,1.12,-.2),(-6.88,1.12,-.2),.2,'coral',vertices=10)
for s_ in (-1,1):rod('seesaw handle',(-7.0,1.5,-.2+s_*.8),(-7.0,1.72,-.2+s_*.8),.025,'metal',vertices=5)
# Picnic blanket in pink gingham, with a basket.
plate('picnic blanket',-10.0,1.125,-.1,1.2,.9,'blush',.3);cube('picnic basket',(-9.7,1.28,.05),(.36,.22,.26),'wood',.04);sphere('picnic apples',(-10.25,1.18,-.32),(.08,.08,.08),'red',8,6)
bougainvillea([(-10.65,1.3,-1.25),(-10.6,1.7,-.95),(-10.62,1.4,-.62)],.08,.16,.3)
flower_patch(-7.25,-2.95,.45,7);flower_patch(-9.95,-2.35,.35,5);flower_patch(-7.4,2.7,.4,6,('blossom','white','yellow'))

# ================= Sunset coast & cloud library =================
region='coast'
bench(-6.4,.99,7.7)
for i in range(17):cube('pier plank',(-1.0,.45,9.0+i*.21),(1.35,.09,.18),'wood',.01)
for zz in [9.0,10.5,12.0]:
 for xx in [-1.56,-.44]:rod('pier post',(xx,-.5,zz),(xx,.85,zz),.075,'darkWood',vertices=8)
for xx in [-1.56,-.44]:rod('pier rope',(xx,.8,9),(xx,.8,12),.025,'stone',vertices=5)
# California-style lifeguard hut on stilts, pastel.
lx,lz=-9.3,7.3
for sx in (-.4,.4):
 for sz in (-.35,.35):rod('lifeguard stilt',(lx+sx,.85,lz+sz),(lx+sx,1.95,lz+sz),.05,'trim',vertices=6)
cube('lifeguard deck',(lx,1.97,lz),(1.2,.08,1.1),'wood',.02);cube('lifeguard hut',(lx,2.4,lz-.08),(.95,.8,.75),'skyBlue',.03)
cube('hut stripe',(lx,2.14,lz+.3),(.97,.1,.02),'coral',0);cube('hut window',(lx,2.5,lz+.3),(.55,.3,.02),'glass',0)
o=cube('hut roof',(lx,2.86,lz-.08),(1.15,.08,1.0),'coral',.02);o.rotation_euler.x=.12
o=cube('hut ramp',(lx+1.1,1.45,lz),(1.4,.05,.36),'wood',.02);o.rotation_euler=(0,.7,0)
cube('surfboard',(lx-.62,1.4,lz+.5),(.08,1.1,.3),'coral',.04)
# The library by the sea: one continuous white concrete shell without right angles;
# cave-like openings on the ground floor, a ribbon of glass toward the sea, round skylights and a roof terrace.
# A covered foyer links it to a small amenity block with a roof garden. White sand, plantings and a reflecting pool.
def rounded(name,p,size,r,mat,seg=5):
 bpy.ops.mesh.primitive_cube_add(size=1,location=co(p));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 mod=o.modifiers.new('rounded','BEVEL');mod.width=r;mod.segments=seg;mod.limit_method='NONE';apply_mods(o);return finish(o,name,mat)
def smooth_by_angle(o,angle=.7):
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 bpy.ops.object.shade_auto_smooth(angle=angle)
 if o.modifiers:apply_mods(o)
def through(name,cx,cy,cz,axis,outline,depth,mat):
 """Extrude a 2D outline [(u,v)] (u across the wall, v up from cy) along `axis` ('x' or 'z')."""
 n=len(outline)
 if axis=='x':pts=[(cx+sd*depth/2,cy+v,cz+u) for sd in (1,-1) for u,v in outline]
 else:pts=[(cx+u,cy+v,cz+sd*depth/2) for sd in (1,-1) for u,v in outline]
 o=mesh(name,pts,[tuple(range(n)),tuple(range(2*n-1,n-1,-1))]+[(i,(i+1)%n,n+(i+1)%n,n+i) for i in range(n)],mat)
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free();o['keep_normals']=True;return o
def cave(width,height,seg=14):
 """A cave mouth: short straight jambs and a tall elliptic crown; v=0 is the sill."""
 r=width/2;rise=min(height*.62,r*1.35);spring=height-rise
 return [(-r,0.),(r,0.)]+[(math.cos(t)*r,spring+math.sin(t)*rise) for t in [k*math.pi/seg for k in range(seg+1)]]
def slot(length,height,seg=8):
 """A stadium-shaped ribbon window centred on (0, 0)."""
 r=height/2;h=length/2-r
 return [(h+math.cos(t)*r,math.sin(t)*r) for t in [-math.pi/2+k*math.pi/seg for k in range(seg+1)]]+[(-h+math.cos(t)*r,math.sin(t)*r) for t in [math.pi/2+k*math.pi/seg for k in range(seg+1)]]
def oval(rx,ry,seg=28):return [(math.cos(k*math.tau/seg)*rx,math.sin(k*math.tau/seg)*ry) for k in range(seg)]
LX,LZ=9.0,1.65;FLOOR=1.285
# White sand garden, draped over the meadow edge so it runs down toward the water like a small beach.
def sand_sdf(px,pz):
 px=np.asarray(px,float);pz=np.asarray(pz,float);a=np.arctan2((pz-2.4)/2.5,(px-8.8)/2.95)
 return (np.hypot((px-8.8)/2.95,(pz-2.4)/2.5)-1-.07*np.sin(3*a+.6)-.04*np.cos(5*a))*2.4
draped('white sand garden',sand_sdf,(5.5,12.5,-1.,6.),.1,.016,'whiteSand','sand')
shade='sand'
# Long and low, pill-shaped in plan, under a roof lip that overhangs every side; caves cut deep into the rounded ends.
HW,HD=3.6,2.3;TOPY=2.85
hall=plan_box('cloudscape hall',LX,1.1,TOPY,LZ,HW,HD,.75,'concrete',8,.08)
carve(hall,[plan_box('hall void',LX,FLOOR,TOPY-.15,LZ,HW-.3,HD-.3,.6,'concrete',8,.06)])
E,W,S,N=LX+HW/2,LX-HW/2,LZ+HD/2,LZ-HD/2
cut=[
 through('c',E,FLOOR+.02,LZ-.55,'x',cave(.9,.85),2.0,'concrete'),through('c',E,FLOOR+.02,LZ+.55,'x',cave(.75,.85),2.0,'concrete'),
 through('c',E,2.42,LZ,'x',slot(1.5,.3),2.0,'concrete'),
 through('c',W,FLOOR+.02,LZ-.48,'x',cave(.78,.85),2.0,'concrete'),through('c',W,FLOOR+.02,LZ+.6,'x',cave(.6,.75),2.0,'concrete'),
 through('c',W,2.3,LZ+.06,'x',oval(.2,.2),2.0,'concrete'),
 through('c',LX-.75,FLOOR+.02,S,'z',cave(1.2,1.15),2.0,'concrete'),
 through('c',LX+.85,2.02,S,'z',oval(.28,.28),2.0,'concrete'),through('c',LX+1.38,1.62,S,'z',oval(.14,.14),2.0,'concrete'),
 through('c',LX+.15,FLOOR+.02,N,'z',cave(1.0,1.05),2.0,'concrete'),
 rod('wormhole',(LX-2.55,2.0,LZ+1.85),(LX-1.0,2.0,LZ+.3),.24,'concrete',vertices=28)]
carve(hall,cut)
lip=plan_box('cloudscape roof lip',LX,TOPY-.2,TOPY+.06,LZ,HW+.38,HD+.38,.92,'concrete',8,.09)
sky=lambda:[cyl_cutter((LX-.6,2.9,LZ-.05),.4,1.2,'y',40),cyl_cutter((LX+.6,2.9,LZ+.35),.24,1.2,'y',32),cyl_cutter((LX+1.25,2.9,LZ-.6),.16,1.2,'y',24)]
carve(lip,sky());carve(hall,sky())
for o in (hall,lip):smooth_by_angle(o,.5)
shade='glass'
through('ribbon glass',E-.12,2.42,LZ,'x',[(u*.98,v*.95) for u,v in slot(1.5,.3)],.025,'glass')
through('round glass',LX+.85,2.02,S-.1,'z',oval(.275,.275),.025,'glass');through('round glass',W+.1,2.3,LZ+.06,'x',oval(.195,.195),.025,'glass')
shade='ao'
# Inside: a stepped reading room, a mezzanine toward the sea, warm lamps that show through the caves at night.
cube('library floor',(LX,FLOOR+.012,LZ),(2.3,.02,1.1),'wood',0)
for i in range(4):h=.13*(i+1);cube('reading step',(LX-.2-i*.3,FLOOR+h/2,LZ-.1),(.3,h,1.05),'wood',.01)
for i in range(5):cube('book pile',(LX-.25-i*.28,FLOOR+.13*(i%4+1)+.04,LZ+.25-(i%2)*.5),(.16,.08,.11),random.choice(['blush','skyBlue','paper','coral','mint']),.01)
cube('mezzanine',(LX+.85,2.08,LZ-.05),(.95,.07,1.4),'concrete',.03);cube('mezzanine rail',(LX+.38,2.22,LZ-.05),(.04,.22,1.35),'trim',.01)
for p in [(LX-.6,2.45,LZ-.05),(LX+.8,2.5,LZ+.2),(LX+.2,1.9,LZ+.45)]:sphere('reading lamp',p,(.08,.065,.08),'lamp',10,6)
# Roof terrace on the lip: a soft parapet, a parasol and two loungers.
rim=plan_box('terrace parapet',LX,TOPY+.06,TOPY+.22,LZ,HW+.12,HD+.12,.8,'concrete',8,.04)
carve(rim,[plan_box('parapet void',LX,TOPY,TOPY+.4,LZ,HW,HD,.74,'concrete',8,0)])
rod('roof parasol pole',(LX+.35,TOPY+.06,LZ-.35),(LX+.35,TOPY+.78,LZ-.35),.018,'metal',vertices=6);rod('roof parasol',(LX+.35,TOPY+.62,LZ-.35),(LX+.35,TOPY+.84,LZ-.35),.5,'coral',0,14)
for dz in (-.5,-.05):o=cube('lounger',(LX+1.05,TOPY+.1,LZ+dz),(.42,.05,.2),'skyBlue',.02);o.rotation_euler.y=.18
# Amenity block (café, showers) with a roof garden, joined to the hall by a covered foyer with an oculus.
shade='sand'
amen=plan_box('cloudscape amenities',9.1,1.1,2.25,-.6,1.6,1.0,.42,'concrete',8,.07)
carve(amen,[plan_box('amenity void',9.1,1.2,2.12,-.6,1.36,.76,.3,'concrete',8,.04)])
carve(amen,[through('c',9.1,1.13,-.1,'z',cave(.62,.86),.8,'concrete'),through('c',9.9,1.72,-.6,'x',oval(.21,.21),.8,'concrete'),through('c',8.3,1.62,-.6,'x',oval(.16,.16),.8,'concrete')])
smooth_by_angle(amen,.5)
foyer=plan_box('foyer roof',LX+.1,2.24,2.36,.2,1.7,.85,.28,'concrete',6,.03);carve(foyer,[cyl_cutter((LX+.1,2.3,.2),.2,.6,'y',28)])
shade='ao'
plan_box('roof garden',9.1,2.25,2.31,-.6,1.2,.62,.26,'grassDark',6,.02)
for p in [(8.75,2.36,-.72),(9.45,2.36,-.48),(9.15,2.38,-.78)]:ico('roof shrub',p,(.16,.12,.16),random.choice(['leafDeep','leaf']),.2,False)
tree(9.45,2.31,-.62,.42)
# Reflecting pool with stepping stones, a concrete bench, plantings and palms.
PLX,PLZ=8.7,4.0
outer=rounded_rect(PLX,PLZ,2.5,1.05,.32);inner=rounded_rect(PLX,PLZ,2.26,.81,.2)
band('pool rim',outer,inner,1.17,'stone');skirt('pool rim side',outer,1.17,1.1,'stone','out');skirt('pool wall',inner,1.17,1.124,'stone','in')
flat('pool bed',inner,1.124,'poolBed')
for p in [(8.25,3.72),(8.5,4.02),(8.3,4.3)]:rod('stepping stone',(p[0],1.12,p[1]),(p[0],1.18,p[1]),.13,'stone',vertices=14)
rounded('sea bench',(PLX,1.31,4.92),(1.2,.18,.3),.07,'concrete',3)
for x,z,sz in [(7.45,.25,1.),(10.75,3.25,.9),(10.4,-.15,.8),(7.85,5.2,.85),(11.15,1.4,.7)]:
 gy=ground_at(x,z)
 for k in range(3):ico('sea grape',(x+math.cos(k*2.1)*.18*sz,gy+.14*sz,z+math.sin(k*2.1)*.18*sz),(.24*sz,.18*sz,.24*sz),random.choice(['leafDeep','leaf','leafDeep']),.2,False)
for p,sc in [((10.9,3.9),.95),((7.9,6.3),.8),((11.0,-.7),.85),((6.4,7.0),.8),((10,6.5),.8)]:palm(p[0],ground_at(*p),p[1],sc)
ANCHORS['pool']=[PLX,1.15,PLZ,2.27,.82,.2]
x=.4;z=11.35
vs=[(x-.4,.12,z-.75),(x+.4,.12,z-.75),(x+.43,.12,z+.58),(x,.12,z+.95),(x-.43,.12,z+.58),(x-.28,-.02,z-.60),(x+.28,-.02,z-.60),(x+.28,-.02,z+.50),(x,-.02,z+.73),(x-.28,-.02,z+.50)]
mesh('rowboat hull',vs,[(i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5)]+[(5,6,7,8,9)],'skyBlue')
for zz in [z-.4,z+.3]:cube('boat seat',(x,.14,zz),(.68,.05,.15),'wood',.02)
rod('wooden oar',(x-.60,.23,z-.62),(x+.66,.23,z+.59),.023,'wood',vertices=6)
rod('boat mooring',(x-.3,.16,z-.6),(-.44,.68,10.5),.012,'stone',vertices=4)

# ================= Sunrise hill & lighthouse =================
region='hill'
# (The hill itself and its trail are built with the terrain, so the trail can be draped on it.)
rod('lighthouse base',(0,2.2,-8.5),(0,2.55,-8.5),.95,'stone',vertices=28)
rod('lighthouse tower',(0,2.55,-8.5),(0,5.2,-8.5),.6,'white',.46,28)
# Bands stand a little proud of the tapering tower; at its exact radius they z-fought and flickered.
rod('lighthouse band',(0,4.35,-8.5),(0,4.62,-8.5),.527,'coral',.513,28)
rod('lighthouse band low',(0,3.2,-8.5),(0,3.32,-8.5),.588,'coral',.584,28)
cube('lighthouse door',(0,2.95,-7.93),(.34,.62,.12),'rose',.03)
cube('lighthouse window',(0,3.55,-7.96),(.18,.3,.06),'glass',.01)
rod('lantern floor',(0,5.2,-8.5),(0,5.32,-8.5),.72,'trim',vertices=28);torus('gallery rail',(0,5.62,-8.5),.7,.018,'metal',28,4)
for i in range(12):
 a=i*math.tau/12;rod('rail post',(.7*math.cos(a),5.32,-8.5+.7*math.sin(a)),(.7*math.cos(a),5.62,-8.5+.7*math.sin(a)),.015,'metal',vertices=4)
rod('lighthouse lantern',(0,5.32,-8.5),(0,5.95,-8.5),.4,'glass',vertices=12)
rod('lens pedestal',(0,5.32,-8.5),(0,5.45,-8.5),.12,'metal',vertices=10);sphere('lighthouse lens',(0,5.64,-8.5),(.17,.21,.17),'lamp',14,10)
for i in range(8):
 a=i*math.tau/8;rod('lantern frame',(.42*math.cos(a),5.32,-8.5+.42*math.sin(a)),(.42*math.cos(a),5.96,-8.5+.42*math.sin(a)),.022,'trim',vertices=4)
rod('lantern roof',(0,5.96,-8.5),(0,6.42,-8.5),.62,'coral',0,24);sphere('roof finial',(0,6.48,-8.5),(.07,.07,.07),'gold',8,6)
ANCHORS['lanterns'].append([0,5.64,-8.5])
cube("keeper's cottage",(1.7,2.62,-9.6),(1.2,.8,.9),'white',.04);roof(1.7,3.02,-9.6,1.35,1.05,.5)
cube('cottage door',(1.7,2.5,-9.13),(.28,.52,.04),'skyBlue',.01)
bench(1.6,2.25,-8)
# The hilltop bench keeps a clear view north-east, where the sun rises over the sea.
for p in [(-2.3,-8.2),(-2.6,-9.5),(-1.8,-10.4)]:tree(p[0],ground_at(*p),p[1],.65)
# Secret islet: a small pavilion (亭), a tree and a bench, only for composition and imagination.
region='terrain'
px,pz=-18.4,-8.35
cube('pavilion platform',(px,.8,pz),(1.3,.12,1.3),'stone',.03)
for sx in (-.45,.45):
 for sz in (-.45,.45):rod('pavilion column',(px+sx,.86,pz+sz),(px+sx,1.7,pz+sz),.05,'lacquer',vertices=8)
vs=[(px,2.32,pz)]+[(px+math.cos(a)*.95,1.72+(.12 if i%2==0 else 0),pz+math.sin(a)*.95) for i,a in enumerate([k*math.pi/4+math.pi/4 for k in range(8)])]
mesh('pavilion roof',vs,[(0,1+(i+1)%8,1+i) for i in range(8)],'tileGreen');sphere('pavilion finial',(px,2.38,pz),(.08,.1,.08),'gold',8,6)
tree(-17.1,.75,-7.4,.72);bench(-17.6,.78,-6.9)

stage('vertex colour')
# ---------- baked vertex colour: soft AO and painterly variation ----------
SHARED={'paint':material('paint','FFFFFF'),'plaster':material('plaster','FFFFFF','plaster'),'walls':material('walls','FFFFFF','wall'),'grain':material('grain','FFFFFF','grain'),
 'foliage':material('foliage','FFFFFF',double=True),'blooms':material('blooms','FFFFFF',double=True)}
FOLIAGE={'leaf','leafLight','leafDeep','palm','palmDark','blossom'};BLOOMS={'flower','bougain','bougainLight'};KEEP={'glass','tile','lamp'}
def shared_for(name):
 if name in KEEP or name not in PALETTE:return None
 if name in FOLIAGE:return 'foliage'
 if name in BLOOMS:return 'blooms'
 kind=PALETTE[name][1];return 'walls' if kind=='wall' else 'plaster' if kind=='plaster' else 'grain' if kind=='grain' else 'paint'
def smooth(e0,e1,x):
 t=min(1,max(0,(x-e0)/(e1-e0)));return t*t*(3-2*t)
for o in list(bpy.data.objects):
 if o.type!='MESH':continue
 # Consistent normals for generated meshes; world-scaled box UVs wherever a painted texture is used.
 textured=any(m and m.node_tree and any(n.type=='TEX_IMAGE' for n in m.node_tree.nodes) for m in o.data.materials) and not o.get('uv_set')
 if (o.get('custom_mesh') and not o.get('keep_normals')) or textured:
  bm=bmesh.new();bm.from_mesh(o.data)
  if o.get('custom_mesh') and not o.get('keep_normals'):bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
  if textured:
   uv=bm.loops.layers.uv.verify();mw_=o.matrix_world;us=.32 if any(m and PALETTE.get(m.name,(0,None))[1]=='wall' for m in o.data.materials) else .5
   for f in bm.faces:
    n=f.normal;ax=max(range(3),key=lambda i:abs(n[i]))
    for l in f.loops:
     v=mw_@l.vert.co;l[uv].uv=((v.y,v.z) if ax==0 else (v.x,v.z) if ax==1 else (v.x,v.y))
     l[uv].uv=(l[uv].uv[0]*us,l[uv].uv[1]*us)
  bm.to_mesh(o.data);bm.free()
 me=o.data;mw=o.matrix_world;mode=o.get('shade','ao');ws=[mw@v.co for v in me.vertices];ymin=min(p.z for p in ws) if ws else 0;ymax=max(p.z for p in ws) if ws else 1
 nm=mw.to_3x3();cols=[]
 # Roads: worn, slightly darker edges from the same distance field that traced them.
 edge=road_sdf([p.x for p in ws],[-p.y for p in ws]) if mode=='road' else None
 for vi,(v,p) in enumerate(zip(me.vertices,ws)):
  n=(nm@v.normal).normalized();x,z,y=p.x,-p.y,p.z;g=noise.noise(Vector((x*.23,z*.23,y*.23)));fine=noise.noise(Vector((x*1.3,z*1.3,y*1.3)))
  if mode=='meadow':
   k=1+.07*g+.03*fine;c=(k*(1+.05*g),k,k*(1-.06*g))
  elif mode=='edge':
   wet=smooth(-.05,.42,y);k=(.62+.38*wet)*(1+.05*g+.03*fine);c=(k,k*(1+.02*wet),k*(1+.04*(1-wet)))
  elif mode=='canopy':
   k=(.66+.34*(n.z*.5+.5))*(.9+.1*smooth(ymin,ymax,p.z))*(1+.04*fine);c=(k,k,k)
  elif mode=='glass':
   k=.5+.62*smooth(ymin,ymax,p.z);c=(k,k,k*1.03)
  elif mode=='sand':
   k=1+.035*g+.02*fine;c=(k,k,k)
  elif mode=='road':
   k=(.86+.14*smooth(0,.3,-float(edge[vi])))*(1+.04*g+.025*fine);c=(k,k*.995,k*.985)
  elif mode=='rock':
   k=(.7+.3*(n.z*.5+.5))*(.8+.2*smooth(-.2,.6,y))*(1+.06*fine);c=(k,k,k*.98)
  else:
   k=(.68+.32*smooth(ymin,ymin+.85,p.z))*(1+.03*g+.015*fine);c=(k,k,k)
  cols.append(c)
 # Colour moves from ~60 palette materials into face-corner vertex colours, so each region draws with a handful of shared materials.
 slots=list(me.materials);old=[poly.material_index for poly in me.polygons];corner=[]
 for poly,mi in zip(me.polygons,old):
  m=slots[mi] if slots else None;base=lin(PALETTE[m.name][0]) if m is not None and shared_for(m.name) else (1,1,1)
  for li in poly.loop_indices:
   a=cols[me.loops[li].vertex_index];corner+=[base[0]*a[0],base[1]*a[1],base[2]*a[2],1]
 at=me.color_attributes.new('Col','FLOAT_COLOR','CORNER');at.data.foreach_set('color',corner);me.color_attributes.active_color=at;me.color_attributes.render_color_index=me.color_attributes.find('Col')
 targets=[SHARED[shared_for(m.name)] if shared_for(m.name) else m for m in slots];unique=list(dict.fromkeys(targets))
 me.materials.clear()
 for m in unique:me.materials.append(m)
 for poly,mi in zip(me.polygons,old):poly.material_index=unique.index(targets[mi]) if targets else 0

stage('join and export')
# Batch static geometry per region/role and export Draco-compressed GLBs.
groups={}
for o in list(bpy.data.objects):
 if o.type=='MESH':
  if o.data.validate(clean_customdata=False):print('repaired mesh',o.name)
  groups.setdefault((o['region'],o['role']),[]).append(o)
for (reg,r),objects in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name=reg+'_'+r
for reg in ['terrain','town','home','park','coast','hill']:
 bpy.ops.object.select_all(action='DESELECT')
 for o in bpy.data.objects:
  if o.type=='MESH' and o.get('region')==reg:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/f'{reg}.glb'),use_selection=True,export_format='GLB',export_apply=True,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',
  export_vertex_color='ACTIVE',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=7,export_draco_position_quantization=14,export_draco_normal_quantization=10,export_draco_color_quantization=10)
(ROOT/'src/world/anchors.json').write_text(json.dumps(ANCHORS,ensure_ascii=False,indent=1))
(ROOT/'art-source').mkdir(exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art-source/island.blend'))
print('Island regions exported:',[(p.name,round(p.stat().st_size/1024)) for p in OUT.glob('*.glb')])
