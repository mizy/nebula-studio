import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import pkg from './package.json';

const proxyHost = '127.0.0.1:9000';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      plugins: [['@swc/plugin-emotion', {}]],
    }),
    // topLevelAwait(),
    // legacy({
    //   targets: ['chrome >= 87', 'safari >= 14', 'firefox >= 78'],
    //   polyfills: ['es.promise.finally', 'es/map', 'es/set', 'es/array'],
    //   modernPolyfills: ['es.promise.finally'],
    // }),
  ],
  server: {
    port: 7001,
    open: true,
    host: '0.0.0.0',
    proxy: {
      // '/api-nebula': {
      //   target: `http://${proxyHost}`,
      //   changeOrigin: true,
      // },
      '/api': {
        target: `http://${proxyHost}`,
        changeOrigin: true,
      },
      // '/nebula_ws': {
      //   target: `ws://${proxyHost}`,
      //   changeOrigin: true,
      //   secure: false,
      //   ws: true,
      // },
    },
  },
  resolve: {
    alias: {
      '@': path.join(__dirname, './src/'),
      '@public': path.join(__dirname, './public/'),
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
  },
  define: {
    'process.env': {
      VERSION: pkg.version,
    },
  },
  // build: {
  //   sourcemap: 'inline',
  // },
});
