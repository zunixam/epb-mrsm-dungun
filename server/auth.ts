import type { D1Database } from '@cloudflare/workers-types';
import { checkWriteOrigin, HttpError, json, readJson } from './http';
import { constantEqual, randomToken, sha256, validPassword, verifyPassword } from './password';
export { checkWriteOrigin, HttpError } from './http';
export interface AuthEnv { DB:D1Database }
export const SESSION_COOKIE='__Host-epb-session';
const LIFETIME=8*60*60, IDLE=30*60, WINDOW=15*60;
export function sessionToken(request:Request):string|null {
 const cookies=(request.headers.get('Cookie')??'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(`${SESSION_COOKIE}=`));
 if(cookies.length!==1)return null;const token=cookies[0].slice(SESSION_COOKIE.length+1);return /^[a-f0-9]{64}$/.test(token)?token:null;
}
const cookie=(token:string,age=LIFETIME)=>`${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
export async function getSession(request:Request,env:AuthEnv){
 if(!env.DB)throw new HttpError(503,'Database belum dikonfigurasi.');
 if(new URL(request.url).protocol!=='https:')throw new HttpError(400,'Sesi memerlukan HTTPS.');
 const token=sessionToken(request);if(!token)throw new HttpError(401,'Sesi tidak sah. Sila log masuk.');
 const tokenHash=await sha256(token);const now=Math.floor(Date.now()/1000);
 const row=await env.DB.prepare('SELECT s.token_hash,s.expires_at,s.last_seen_at,u.id AS user_id,u.email FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id WHERE s.token_hash=? AND u.active=1 AND s.expires_at>? AND s.last_seen_at>?').bind(tokenHash,now,now-IDLE).first<{token_hash:string;expires_at:number;last_seen_at:number;user_id:string;email:string}>();
 if(!row)throw new HttpError(401,'Sesi tidak sah atau telah tamat tempoh.');
 if(now-row.last_seen_at>=60)await env.DB.prepare('UPDATE admin_sessions SET last_seen_at=? WHERE token_hash=? AND expires_at>?').bind(now,tokenHash,now).run();
 return {...row,csrfToken:await sha256(`csrf:${token}`)};
}
export async function verifyAdmin(request:Request,env:AuthEnv):Promise<string>{
 const session=await getSession(request,env);
 if(!['GET','HEAD'].includes(request.method)){
  checkWriteOrigin(request);
  if(!/^[a-f0-9]{64}$/.test(request.headers.get('X-CSRF-Token')??'')||!constantEqual(request.headers.get('X-CSRF-Token')??'',session.csrfToken))throw new HttpError(403,'Token CSRF tidak sah. Muat semula sesi.');
 }
 return session.email;
}
async function audit(env:AuthEnv,actor:string,action:string,id:string){return env.DB.prepare('INSERT INTO audit_logs (id,actor,action,entity_type,entity_id) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),actor,action,'admin_users',id)}
// Reserve attempts atomically BEFORE password hashing, including simultaneous requests.
async function limitLogin(request:Request,env:AuthEnv,email:string){
 const now=Math.floor(Date.now()/1000),start=Math.floor(now/WINDOW)*WINDOW;
 // CF-Connecting-IP is set by the Pages edge. X-Forwarded-For is deliberately ignored.
 const ip=request.headers.get('CF-Connecting-IP')??'unknown';
 const reserve=(key:string)=>env.DB.prepare('INSERT INTO login_rate_limits (bucket_key,window_start,attempts) VALUES (?,?,1) ON CONFLICT(bucket_key) DO UPDATE SET attempts=CASE WHEN login_rate_limits.window_start=? THEN login_rate_limits.attempts+1 ELSE 1 END, window_start=? RETURNING attempts').bind(key,start,start,start);
 const global=await reserve(await sha256('global')).first<{attempts:number}>();
 if(!global||global.attempts>100)throw new HttpError(429,'Terlalu banyak percubaan. Cuba semula selepas 15 minit.');
 const hashes=await Promise.all([`ip:${ip}`,`account:${email}`].map(sha256));
 const results=await env.DB.batch(hashes.map(reserve));
 await env.DB.prepare('DELETE FROM login_rate_limits WHERE window_start < ?').bind(start-WINDOW).run();
 if(results.some((r,i)=>Number((r.results[0] as {attempts:number}).attempts)>[20,5][i]))throw new HttpError(429,'Terlalu banyak percubaan. Cuba semula selepas 15 minit.');
}
export async function handleAuth(request:Request,env:AuthEnv,path:string):Promise<Response>{
 try{
 if(!env.DB)throw new HttpError(503,'Database belum dikonfigurasi.');
 if(path==='session'&&request.method==='GET'){const s=await getSession(request,env);return json({actor:s.email,csrfToken:s.csrfToken,expiresAt:s.expires_at})}
 if(path==='logout'&&request.method==='POST'){
  const actor=await verifyAdmin(request,env);const s=await getSession(request,env);
  await env.DB.batch([env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(s.token_hash),await audit(env,actor,'logout',s.user_id)]);
  return json({ok:true},200,{'Set-Cookie':cookie('',0)});
 }
 if(path!=='login'||request.method!=='POST')throw new HttpError(405,'Kaedah tidak dibenarkan.');
 if(new URL(request.url).protocol!=='https:')throw new HttpError(400,'Login memerlukan HTTPS.');
 checkWriteOrigin(request);const input=await readJson(request,2048);
 const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
 if(!/^\S+@\S+\.\S+$/.test(email)||email.length>254||!validPassword(input.password))throw new HttpError(400,'E-mel atau kata laluan tidak sah.');
 await limitLogin(request,env,email);
 const user=await env.DB.prepare('SELECT id,email,password_hash FROM admin_users WHERE email=? AND active=1').bind(email).first<{id:string;email:string;password_hash:string}>();
 // Fixed valid dummy verifier equalises work for unknown and disabled accounts.
 const dummy='pbkdf2-sha256$600000$00000000000000000000000000000000$'+ '0'.repeat(64);
 const valid=await verifyPassword(input.password,user?.password_hash??dummy);
 if(!valid||!user){await (await audit(env,'anonymous','login_failed','redacted')).run();throw new HttpError(401,'E-mel atau kata laluan tidak sah.')}
 const now=Math.floor(Date.now()/1000);const token=randomToken();const tokenHash=await sha256(token);const old=sessionToken(request);
 await env.DB.batch([
  env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at<=? OR last_seen_at<=? OR token_hash=?').bind(now,now-IDLE,old?await sha256(old):''),
  env.DB.prepare('INSERT INTO admin_sessions (token_hash,user_id,created_at,last_seen_at,expires_at) VALUES (?,?,?,?,?)').bind(tokenHash,user.id,now,now,now+LIFETIME),
  await audit(env,user.email,'login',user.id)
 ]);
 return json({actor:user.email,csrfToken:await sha256(`csrf:${token}`),expiresAt:now+LIFETIME},200,{'Set-Cookie':cookie(token)});
 }catch(e){if(e instanceof HttpError)return json({error:e.message},e.status,e.status===429?{'Retry-After':'900'}:{});return json({error:'Perkhidmatan pengesahan tidak tersedia.'},503)}
}
