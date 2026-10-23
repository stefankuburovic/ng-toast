// ng-packagr writes tslib into the built manifest whether or not the bundle imports it. This one
// never does (importHelpers is off), so the dependency would only make every install fetch it.
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'dist/ng-toast/package.json';
const manifest = JSON.parse(readFileSync(path, 'utf8'));
if (readFileSync('dist/ng-toast/fesm2022/stefankuburovic-ng-toast.mjs', 'utf8').includes('tslib')) {
  throw new Error('the bundle imports tslib; keep the dependency');
}
delete manifest.dependencies?.tslib;
if (manifest.dependencies && Object.keys(manifest.dependencies).length === 0) {
  delete manifest.dependencies;
}
writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
