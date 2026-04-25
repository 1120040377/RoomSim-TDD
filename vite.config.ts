/// <reference types="vitest" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import UnoCSS from 'unocss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // 默认根路径；GitHub Pages 等子目录部署时由 CI 通过 BASE_URL 注入 "/<repo>/"
  base: process.env.BASE_URL ?? '/',
  plugins: [vue(), UnoCSS()],
  server: {
    port: 5174,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/unit/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});
