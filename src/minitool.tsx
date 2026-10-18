import './minitool/polyfills';
import React from 'react';import {createRoot} from 'react-dom/client';import App from './App';import {useIsland} from './store';
import {hydrate} from './minitool/storage';import {installLayoutVars} from './minitool/bridge';
import './style.css';import './minitool/safe-area.css';
installLayoutVars({minTop:68,nav:44});
window.addEventListener('island-storage-error',()=>useIsland.setState({storageError:true}));
const gap=document.createElement('div');gap.style.cssText='display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden';gap.appendChild(document.createElement('div'));gap.appendChild(document.createElement('div'));document.body.appendChild(gap);if(gap.scrollHeight!==1)document.documentElement.classList.add('no-flex-gap');gap.remove();
hydrate().then(save=>useIsland.setState({save})).catch(()=>useIsland.setState({storageError:true})).finally(()=>createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>));
