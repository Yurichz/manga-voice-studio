import {cp,mkdir,readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
for (const entry of await readdir('packages',{withFileTypes:true})) {
  if (!entry.isDirectory()) { continue; }
  const manifest = JSON.parse(await readFile(path.join('packages',entry.name,'package.json'),'utf8'));
  if (!manifest.exports) { continue; }
  const output = path.join('packages',entry.name,'dist');
  await mkdir(output,{recursive:true});
  await cp(path.join('dist','packages',entry.name,'src'),output,{recursive:true});
}
