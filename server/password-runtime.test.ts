import { afterAll, beforeAll, expect, it } from 'vitest';
import { build } from 'esbuild';
import { pbkdf2Sync } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { unstable_splitSqlQuery } from 'wrangler';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { hashPassword, PASSWORD_ITERATIONS, randomToken, verifyPassword } from './password';
let runtime:Miniflare;
const password=randomToken()+'é🌙';
let stored:string;
beforeAll(async()=>{
 stored=await hashPassword(password); // Same module imported by the real bootstrap CLI.
 const result=await build({stdin:{contents:`
 import {hashPassword,verifyPassword} from './server/password';
 import {handleApi} from './server/api';
 const native=crypto.subtle.deriveBits.bind(crypto.subtle);
 crypto.subtle.deriveBits=async function(algorithm,key,length){
   if(algorithm.name==='PBKDF2'&&algorithm.iterations>100000)throw new DOMException('Simulated hosted PBKDF2 iteration limit','NotSupportedError');
   return native(algorithm,key,length);
 };
 export default {async fetch(request,env){if(new URL(request.url).pathname.startsWith('/api/'))return handleApi(request,env);const data=await request.json();
   try{if(data.action==='hash')return Response.json({stored:await hashPassword(data.password)});
   return Response.json({valid:await verifyPassword(data.password,data.stored)});
   }catch{return Response.json({failed:true},{status:503})}
 }};`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
 runtime=new Miniflare(convertV4MiniflareOptions({modules:true,script:result.outputFiles[0].text,compatibilityDate:'2026-08-01',d1Databases:['DB'],bindings:{PUBLIC_DATA_ENABLED:'false'}}));
 const db=await runtime.getD1Database('DB');
 for(const file of ['0001_initial.sql','0002_seed_original.sql','0003_admin_auth.sql'])for(const sql of unstable_splitSqlQuery(await readFile('migrations/'+file,'utf8')))await db.prepare(sql).run();
 await db.prepare('INSERT INTO admin_users (id,email,password_hash) VALUES (?,?,?)').bind('cap-synthetic-user','synthetic@example.test',stored).run();
},30000);
afterAll(async()=>runtime?.dispose());
const call=(body:unknown)=>runtime.dispatchFetch('https://synthetic.example.test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
it('bootstrap verifier remains byte-for-byte standard PBKDF2 SHA256 with 600000 iterations',()=>{
 const [algorithm,work,salt,result]=stored.split('$');
 expect(algorithm==='pbkdf2-sha256'&&work===String(PASSWORD_ITERATIONS)&&salt.length===32&&result.length===64).toBe(true);
 const independent=pbkdf2Sync(Buffer.from(password,'utf8'),Buffer.from(salt,'hex'),600000,32,'sha256').toString('hex');
 expect(result===independent).toBe(true);
});
it('hosted-style 100000 iteration cap can verify an unchanged bootstrap verifier',async()=>{
 const response=await call({password,stored});expect(response.status).toBe(200);
 expect((await response.json() as {valid:boolean}).valid).toBe(true);
},30000);
it('fallback rejects an incorrect password without modifying the verifier',async()=>{
 const response=await call({password:randomToken(),stored});expect(response.status).toBe(200);
 expect((await response.json() as {valid:boolean}).valid).toBe(false);
},30000);
it('hashes generated under the cap remain compatible with native bootstrap verification',async()=>{
 const response=await call({action:'hash',password});expect(response.status).toBe(200);
 const generated=(await response.json() as {stored:string}).stored;
 expect(await verifyPassword(password,generated)).toBe(true);
 expect(generated!==stored&&generated.split('$')[1]==='600000').toBe(true);
},30000);
it('malformed, non-string and weakened verifiers fail closed rather than throw',async()=>{
 const values:unknown[]=[null,undefined,42,{},stored+'$extra',stored.replace('$600000$','$100000$'),stored.replace('$600000$','$0600000$'),stored.replace('pbkdf2-sha256','other')];
 for(const value of values)expect(await verifyPassword(password,value)).toBe(false);
});
it('unrelated native crypto errors do not trigger fallback',async()=>{
 const {vi}=await import('vitest');const derive=vi.spyOn(crypto.subtle,'deriveBits').mockRejectedValueOnce(new DOMException('Synthetic operational failure','OperationError'));
 try{let failed=false;try{await verifyPassword(password,stored)}catch{failed=true}expect(failed).toBe(true)}finally{derive.mockRestore()}
});

it('full login and protected session work under the simulated hosted cap without changing the account verifier',async()=>{
 const origin='https://synthetic.example.test';
 const response=await runtime.dispatchFetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'synthetic@example.test',password})});
 expect(response.status).toBe(200);
 const cookie=(response.headers.get('Set-Cookie')??'').split(';')[0];
 expect((await runtime.dispatchFetch(origin+'/api/admin/status',{headers:{Cookie:cookie}})).status).toBe(200);
 expect((await runtime.dispatchFetch(origin+'/api/admin/status')).status).toBe(401);
 const db=await runtime.getD1Database('DB');
 const record=await db.prepare('SELECT password_hash FROM admin_users WHERE id=?').bind('cap-synthetic-user').first<{password_hash:string}>();
 expect(record?.password_hash===stored).toBe(true);
},30000);
