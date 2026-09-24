import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const roots=['src','tests','scripts'];
const files=[];
const walk=directory=>{for(const entry of readdirSync(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())walk(path);else if(/\.(?:js|mjs)$/.test(entry.name))files.push(path)}};
for(const root of roots)walk(root);
for(const file of files){
  const source=readFileSync(file,'utf8');
  if(/^(?:<{7}|={7}|>{7})/m.test(source))throw Error(`Merge marker trong ${file}`);
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(result.status!==0)throw Error(result.stderr||`Syntax error trong ${file}`);
}
console.log(`Lint PASS · ${files.length} source files`);
