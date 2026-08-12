import { defineConfig } from 'vite'

// GitHub Pages 프로젝트 사이트는 /<저장소명>/ 아래에 놓인다.
// 커스텀 도메인이나 로컬로 옮기면 이 값만 바꾸면 된다.
export default defineConfig({
  base: process.env.PAGES_BASE ?? '/gambit_chess/',
})
