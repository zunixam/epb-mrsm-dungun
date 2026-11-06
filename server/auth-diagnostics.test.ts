import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { unstable_splitSqlQuery } from 'wrangler';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { handleAuth, type AuthEnv } from './auth';
import { hashPassword, randomToken } from './password';
const runtime=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-08-01',d1Databases:['DB']}));
let env:AuthEnv;
const password=randomToken();const marker=randomToken();
const request=()=>new Request('https://preview.example.test/api/auth/login',{method:'POST',headers:{Origin:'https://preview.example.test','Content-Type':'application/json'},body:JSON.stringify({email:'synthetic@example.test',password})});
beforeAll(async()=>{const db=await runtime.getD1Database('DB');env={DB:db as unknown as AuthEnv['DB']};for(const file of ['0001_initial.sql','0003_admin_auth.sql'])for(const sql of unstable_splitSqlQuery(readFileSync('migrations/'+file,'utf8')))await db.prepare(sql).run();await db.prepare('INSERT INTO admin_users (id,email,password_hash) VALUES (?,?,?)').bind('diagnostic-user','synthetic@example.test',await hashPassword(password)).run()},30000);
afterAll(async()=>runtime.dispose());
function breakPrepare(match:string):AuthEnv{return {DB:{prepare:(sql:string)=>{if(sql.includes(match))throw Error(marker);return env.DB.prepare(sql)},batch:env.DB.batch.bind(env.DB)} as AuthEnv['DB']}}
for(const [match,code] of [['INSERT INTO login_rate_limits','AUTH_LOGIN_RATE_LIMIT'],['SELECT id,email,password_hash','AUTH_LOGIN_ACCOUNT_READ'],['INSERT INTO admin_sessions','AUTH_LOGIN_SESSION_CREATE']] as const){
 it(`reports only safe stage ${code}, not raw database exceptions`,async()=>{
  const log=vi.spyOn(console,'error').mockImplementation(()=>{});
  try{const response=await handleAuth(request(),breakPrepare(match),'login');expect(response.status).toBe(503);const body=await response.text();expect(JSON.parse(body).code).toBe(code);expect(body.includes(marker)||body.includes(password)).toBe(false);expect(log).toHaveBeenCalledWith(JSON.stringify({event:'admin_auth_failure',code}));expect(JSON.stringify(log.mock.calls).includes(marker)||JSON.stringify(log.mock.calls).includes(password)).toBe(false)}finally{log.mockRestore()}
 });
}
it('distinguishes a Worker cryptography exception without logging crypto inputs',async()=>{
 const log=vi.spyOn(console,'error').mockImplementation(()=>{});const derive=vi.spyOn(crypto.subtle,'deriveBits').mockRejectedValueOnce(Error(marker));
 try{const response=await handleAuth(request(),env,'login');const body=await response.text();expect(response.status).toBe(503);expect(JSON.parse(body).code).toBe('AUTH_LOGIN_PASSWORD_VERIFY');expect(body.includes(marker)||JSON.stringify(log.mock.calls).includes(marker)).toBe(false)}finally{derive.mockRestore();log.mockRestore()}
});
