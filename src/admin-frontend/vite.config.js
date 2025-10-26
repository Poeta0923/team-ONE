//학교 서버 연결시 설정 필요

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // API 요청을 학교 서버로 프록시
      '/app': {
        target: 'http://ceprj.gachon.ac.kr:60002', // 학교 서버 주소로 변경
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
