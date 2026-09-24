import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import {writeFileSync,mkdirSync} from 'node:fs'

export default defineConfig({
  plugins: [react(),{
    name:'preview-viewport-evidence',
    closeBundle(){
      if(process.env.VERCEL_ENV!=='preview')return;
      mkdirSync('dist/__qa',{recursive:true});
      writeFileSync('dist/__qa/viewport.html',`<!doctype html><html lang="vi"><meta charset="utf-8"><title>SCREEN 01 — browser viewport QA</title><style>body{margin:0;background:#eaf1f8}iframe{display:block;border:0;width:390px;height:844px;margin:0 auto}</style><iframe title="App thật — viewport 390 × 844" src="/?__today_qa=no-work"></iframe></html>`);
    }
  }],
  base: './',
  define: { __REFEREE_PREVIEW__: JSON.stringify(process.env.VERCEL_ENV === 'preview') },
})
