import * as esbuild from 'esbuild'

const target = `node${process.version.substring(1)}`; // set build target's node version to the current process's node version which is expected to have been derived from the project's .nvmrc

await esbuild.build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  target,
  outfile: 'build/out.js',
});
