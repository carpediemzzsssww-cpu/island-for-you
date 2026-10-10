import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], resolve:{preserveSymlinks:true}, build: { chunkSizeWarningLimit: 1100, rollupOptions: { output: { manualChunks: { 'three': ['three'], 'world': ['react','react-dom','@react-three/fiber','@react-three/drei'] } } } } });
