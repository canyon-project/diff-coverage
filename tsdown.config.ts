import { defineConfig } from 'tsdown'

export default defineConfig({
  platform: 'neutral',
  dts: true,
  exports: {
    customExports(exports) {
      exports['./style.css'] = './dist/style.css'
      exports['./src/style.css'] = './dist/style.css'
      return exports
    },
  },
  copy: [{ from: 'src/style.css', to: 'dist', flatten: true }],
})
