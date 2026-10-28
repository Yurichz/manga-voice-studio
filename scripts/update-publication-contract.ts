import {promises as fs} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
async function main(){const input=process.argv[2];if(!input||!input.endsWith('mvs-publication-format-1.0.0.tgz'))throw new Error('Usage: node --import tsx scripts/update-publication-contract.ts <1.0.0 tarball>');
await fs.mkdir('vendor',{recursive:true});const bytes=await fs.readFile(input),name=path.basename(input);await fs.writeFile(path.join('vendor',name),bytes);await fs.writeFile('vendor/publication-contract.json',JSON.stringify({version:'1.0.0',file:name,sha256:createHash('sha256').update(bytes).digest('hex')},null,2)+'\n');console.log('Contract 1.0.0 vendored; run pnpm install and pnpm contract:verify.');
}void main();
