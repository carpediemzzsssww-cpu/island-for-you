import * as THREE from 'three';
import {shake} from './Pokes';

// Everything the wind touches: foliage sways, and slow cloud shadows drift across the whole island.
export const wind={value:0},now={value:0};
const swaying:Record<string,number>={foliage:1.1,blooms:.25};
/** Patch an island material: foliage sways in the wind and shakes when tapped; slow cloud shadows drift over everything. */
export function weather(material:THREE.Material){
 if(!(material instanceof THREE.MeshStandardMaterial))return;const amp=swaying[material.name]??0;
 material.onBeforeCompile=shader=>{shader.uniforms.uWind=wind;shader.uniforms.uNow=now;shader.uniforms.uShake=shake;
  shader.vertexShader='uniform float uWind;uniform float uNow;uniform vec4 uShake;\nvarying vec3 vIslandWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vec4 islandWorld=modelMatrix*vec4(transformed,1.);vIslandWorld=islandWorld.xyz;
   ${amp?`float swayH=max(islandWorld.y-1.2,0.);float swayK=min(swayH*swayH*.008,.07)*${amp.toFixed(2)};
   transformed.x+=sin(uWind*1.3+islandWorld.x*.55+islandWorld.z*.3)*swayK+sin(uWind*3.1+islandWorld.y*2.)*swayK*.25;transformed.z+=cos(uWind*1.05+islandWorld.z*.45)*swayK*.6;
   // A tap shakes the leaves around it for a moment.
   float shakeD=distance(islandWorld.xyz,uShake.xyz),shakeT=uNow-uShake.w;float shakeK=exp(-shakeD*shakeD*1.1)*exp(-max(shakeT,0.)*2.2)*step(0.,shakeT)*.11;
   transformed.x+=sin(shakeT*17.+islandWorld.y*3.)*shakeK;transformed.z+=cos(shakeT*13.+islandWorld.x*2.)*shakeK*.7;`:''}`);
  // Leaves right in front of the camera (when she zooms in among the palms) fade out in a fine stipple.
  shader.fragmentShader='uniform float uWind;\nvarying vec3 vIslandWorld;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   ${amp?`float camNear=distance(vIslandWorld,cameraPosition);if(camNear<2.8&&fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))>smoothstep(1.2,2.8,camNear))discard;`:''}
   vec2 cloudUv=vIslandWorld.xz*.045+vec2(uWind*.012,uWind*.005);float cloudShade=smoothstep(.52,.78,sin(cloudUv.x*2.1+sin(cloudUv.y*1.7))*.5+.5+sin(cloudUv.y*2.9+cloudUv.x)*.25);
   diffuseColor.rgb*=1.-.16*cloudShade;`);
 };
 material.customProgramCacheKey=()=>'island-weather-'+amp;
}
