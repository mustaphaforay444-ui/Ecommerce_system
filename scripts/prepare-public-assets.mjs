import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const publicRoot = path.join(root, 'public');
fs.mkdirSync(publicRoot, { recursive: true });
// Remove an obsolete build copy of the previous auto-parts catalog images.
fs.rmSync(path.join(publicRoot, 'calxin.images'), { recursive: true, force: true });

for (const assetDirectory of ['bookstore-images']) {
  const source = path.join(root, assetDirectory);
  if (!fs.existsSync(source)) continue;
  fs.cpSync(source, path.join(publicRoot, assetDirectory), { recursive: true });
}
