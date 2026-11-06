import type { D1Database } from '@cloudflare/workers-types';
import { checkWriteOrigin, HttpError, verifyAdmin, handleAuth } from './auth';
import { readJson } from './http';
import { validateRecord } from './validation';
export interface Env { DB:D1Database; PUBLIC_DATA_ENABLED?:string; ASSETS:{fetch(request:Request):Promise<Response>} }
export const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function createHandler(auth=verifyAdmin){return async function(request:Request,env:Env):Promise<Response>{
 try{
 const url=new URL(request.url);const parts=url.pathname.replace(/\/$/,'').split('/').filter(Boolean);const admin=parts[1]==='admin';let actor='';
 if(parts[1]==='auth'&&parts.length===3)return handleAuth(request,env,parts[2]);
 if(admin)actor=await auth(request,env);
 if(!admin&&env.PUBLIC_DATA_ENABLED!=='true')throw new HttpError(503,'API awam belum diaktifkan. Portal menggunakan jadual asal.');
 const resource=parts[admin?2:1];const id=parts[admin?3:2];if(parts.length>(admin?4:3))throw new HttpError(404,'Laluan tidak ditemui.');
 if(!admin&&request.method!=='GET')throw new HttpError(405,'Endpoint awam baca sahaja.');
 if(!env.DB)throw new HttpError(503,'Database belum dikonfigurasi.');
 if(admin&&resource==='status'&&request.method==='GET'&&!id){await env.DB.prepare('SELECT id FROM pb_schedules LIMIT 1').all();await env.DB.prepare('SELECT id FROM announcements LIMIT 1').all();await env.DB.prepare('SELECT id FROM audit_logs LIMIT 1').all();return json({connected:true,actor,publicDataEnabled:env.PUBLIC_DATA_ENABLED==='true'})}
 if(admin&&resource==='audit'&&request.method==='GET'&&!id){const page=Math.max(0,Math.min(100000,Number(url.searchParams.get('page'))||0));const data=await env.DB.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC,id DESC LIMIT 100 OFFSET ?').bind(Math.floor(page)*100).all();return json({records:data.results,page})}
 if(resource!=='schedules'&&resource!=='announcements')throw new HttpError(404,'Laluan tidak ditemui.');
 const table=resource==='schedules'?'pb_schedules':'announcements'; // Fixed identifiers, never user SQL.
 if(request.method==='GET'){
  if(id)throw new HttpError(404,'Gunakan senarai rekod.');
  const conditions:string[]=[];const values:string[]=[];
  if(!admin)conditions.push("status = 'published'");
  if(admin){for(const [key,column] of [['status','status'],['category','category']] as const){const value=url.searchParams.get(key);if(value&&(key!=='category'||resource==='schedules')){conditions.push(`${column} = ?`);values.push(value)}}}
  if(resource==='schedules'){const year=url.searchParams.get('year');const month=url.searchParams.get('month');if(year){if(!/^\d{4}$/.test(year))throw new HttpError(400,'Tahun tidak sah.');conditions.push('substr(start_date,1,4) = ?');values.push(year)}if(month){if(!/^(0[1-9]|1[0-2])$/.test(month))throw new HttpError(400,'Bulan tidak sah.');conditions.push('substr(start_date,6,2) = ?');values.push(month)}}
  const search=url.searchParams.get('q');if(search){conditions.push('instr(lower(title),lower(?)) > 0');values.push(search.slice(0,200))}
  const result=await env.DB.prepare(`SELECT * FROM ${table}${conditions.length?' WHERE '+conditions.join(' AND '):''} ORDER BY ${resource==='schedules'?'start_date ASC,id ASC':'updated_at DESC,id DESC'}`).bind(...values).all();return json({records:result.results});
 }
 if(!admin)throw new HttpError(405,'Endpoint awam baca sahaja.');
 if(!['POST','PUT','DELETE'].includes(request.method))throw new HttpError(405,'Kaedah tidak dibenarkan.');
 checkWriteOrigin(request);
 const input=await readJson(request);
 if(request.method==='POST'&&id||request.method!=='POST'&&!id)throw new HttpError(400,'ID rekod tidak sah.');
 if(request.method==='DELETE'&&resource==='schedules')throw new HttpError(405,'Jadual mesti dibatalkan untuk mengekalkan sejarah.');
 let before:Record<string,unknown>|null=null;if(id){before=await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first();if(!before)throw new HttpError(404,'Rekod tidak ditemui.');if(!Number.isInteger(input.version)||input.version!==before.version)throw new HttpError(409,'Rekod telah berubah. Muat semula sebelum menyimpan.')}
 const recordId=id??crypto.randomUUID();const timestamp=new Date().toISOString();let after:Record<string,unknown>|null=null;let sql:string;let values:unknown[];
 if(request.method==='DELETE'){sql=`DELETE FROM ${table} WHERE id = ? AND version = ?`;values=[recordId,input.version]}
 else{const fields=validateRecord(resource,input);after={...fields,id:recordId,created_at:before?.created_at??timestamp,updated_at:timestamp,version:Number(before?.version??0)+1};const columns=Object.keys(after);if(before){sql=`UPDATE ${table} SET ${columns.filter(c=>c!=='id'&&c!=='created_at').map(c=>`${c} = ?`).join(',')} WHERE id = ? AND version = ?`;values=[...columns.filter(c=>c!=='id'&&c!=='created_at').map(c=>after![c]),recordId,input.version]}else{sql=`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`;values=columns.map(c=>after![c])}}
 const action=request.method==='POST'?'create':request.method==='DELETE'?'delete':before?.status!==after?.status?`status:${String(after?.status)}`:'update';
 const result=await env.DB.batch([env.DB.prepare(sql).bind(...values),env.DB.prepare('INSERT INTO audit_logs (id,actor,action,entity_type,entity_id,before_json,after_json,created_at) SELECT ?,?,?,?,?,?,?,? WHERE changes() = 1').bind(crypto.randomUUID(),actor,action,resource,recordId,before?JSON.stringify(before):null,after?JSON.stringify(after):null,timestamp)]);
 if(result[0].meta.changes!==1)throw new HttpError(409,'Rekod telah berubah. Muat semula sebelum menyimpan.');return json({record:after},request.method==='POST'?201:200);
 }catch(error){if(error instanceof HttpError)return json({error:error.message},error.status);return json({error:'Database atau perkhidmatan tidak tersedia. Cuba lagi kemudian.'},503)}
}}
export const handleApi=createHandler();
