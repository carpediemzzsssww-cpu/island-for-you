import {getLocalData,setLocalData} from './bridge';
import {restoreSave,type WorldSave} from '../lib/state';
export const MINI_KEY='island-minitool:save:v1';
let pending:WorldSave|null=null,timer:ReturnType<typeof setTimeout>|null=null,writing=false;
export async function hydrate(){return restoreSave(JSON.stringify(await getLocalData<WorldSave>(MINI_KEY)))}
export function queueSave(save:WorldSave){pending=save;if(timer)clearTimeout(timer);timer=setTimeout(flush,180)}
async function flush(){timer=null;if(writing)return;writing=true;while(pending){const s=pending;pending=null;const ok=await setLocalData(MINI_KEY,s);if(!ok)window.dispatchEvent(new Event('island-storage-error'))}writing=false}
