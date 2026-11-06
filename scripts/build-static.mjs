import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.join(root,'dist');
const items=['index.html','styles.css','src','assets','vendor'];

// dist is an ignored generated directory, never the source of truth.
rmSync(output,{recursive:true,force:true});
mkdirSync(output,{recursive:true});
for (const item of items) cpSync(path.join(root,item),path.join(output,item),{recursive:true});
console.log(`Built static Site assets in ${output}`);
