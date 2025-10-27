//학교 서버 연결시 설정 필요

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/app': {
        target: 'http://ceprj.gachon.ac.kr:60002', 
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
