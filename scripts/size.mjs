// The built package as an app ships it: minified (as the Angular CLI does in production) and
// gzipped. Fails when a file is over its budget, so the package does not grow by accident; raise
// a budget on purpose, in the same change that needs it.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { transformSync } from 'esbuild';

/** [file in dist/ng-toast, loader, budget in bytes] */
const budgets = [
  ['fesm2022/stefankuburovic-ng-toast.mjs', 'js', 5000],
  ['toast.css', 'css', 2900],
  ['toast-material.css', 'css', 700]
];

let over = false;
for (const [file, loader, budget] of budgets) {
  const source = readFileSync(`dist/ng-toast/${file}`, 'utf8');
  const { code } = transformSync(source, { loader, minify: true });
  const size = gzipSync(code, { level: 9 }).length;
  const ok = size <= budget;
  over ||= !ok;
  console.log(`${ok ? 'ok  ' : 'OVER'} ${file.padEnd(40)} ${String(size).padStart(5)} B  (budget ${budget} B)`);
}
if (over) {
  process.exitCode = 1;
}
