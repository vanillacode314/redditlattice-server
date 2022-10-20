const esbuild = require('esbuild')

esbuild.build({
  entryPoints: ['src/index.ts'],
  outfile: './index.cjs',
  bundle: true,
  platform: 'node',
  external: ['sharp'],
})
