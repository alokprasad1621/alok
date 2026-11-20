import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
const props = JSON.parse(process.argv[4] || '{}');
const serveUrl = await bundle({ entryPoint: new URL('.', import.meta.url).pathname + '../src/index.ts' });
const composition = await selectComposition({ serveUrl, id: 'MolassesShort', inputProps: props });
const t0 = Date.now();
await renderMedia({
  composition, serveUrl, codec: 'h264', crf: 16, scale: 1, muted: true, inputProps: props,
  frameRange: [600, 611], outputLocation: process.argv[2], concurrency: 1,
  timeoutInMilliseconds: 180000, imageFormat: 'jpeg',
  chromiumOptions: { gl: 'swiftshader' },
});
console.log('PROBE_MS_OK', ((Date.now() - t0) / 1000).toFixed(0), 's');
