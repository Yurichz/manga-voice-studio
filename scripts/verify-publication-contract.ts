import {promises as fs} from 'node:fs';
import {createHash} from 'node:crypto';
import {VERSION} from '@mvs/publication-format';
async function main(){const pin=JSON.parse(await fs.readFile('vendor/publication-contract.json','utf8'));if(pin.version!==VERSION||createHash('sha256').update(await fs.readFile('vendor/'+pin.file)).digest('hex')!==pin.sha256)throw new Error('Publication contract version/checksum mismatch');console.log('Publication contract version and checksum verified:',VERSION);}void main();
