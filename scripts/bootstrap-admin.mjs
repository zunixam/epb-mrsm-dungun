// Interactive, operator-only first-account bootstrap. Never run automatically.
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { hashPassword } from '../server/password.ts';
import { FIRST_ADMIN_SQL } from '../server/bootstrap.ts';
if (!stdin.isTTY || !stdout.isTTY) throw new Error('Bootstrap memerlukan terminal interaktif; stdin/argv kata laluan tidak disokong.');
const args=process.argv.slice(2);
if(args.length!==1||!['--local','--staging'].includes(args[0]))throw new Error('Gunakan --local atau --staging secara eksplisit.');
const staging=args[0]==='--staging';
const {unstable_readConfig,getPlatformProxy}=await import('wrangler');
const config=unstable_readConfig({config:'wrangler.jsonc',...(staging?{env:'preview'}:{})});
const binding=config.d1_databases.find(d=>d.binding==='DB');
if(!binding||config.vars.PUBLIC_DATA_ENABLED!=='false'||(staging&&(binding.database_name!=='epb-dungun-staging'||binding.database_id!=='20235c71-0c91-428c-80a3-06eee3eab20e'))||(!staging&&binding.database_id!=='00000000-0000-0000-0000-000000000000'))throw Error('Konfigurasi sasaran tidak sepadan.');
const rl=createInterface({input:stdin,output:stdout});
console.log(`Sasaran: ${binding.database_name} (${binding.database_id}) — ${staging?'REMOTE STAGING':'LOCAL ONLY'}`);
const confirm=await rl.question(`Taip BOOTSTRAP ${binding.database_name} untuk meneruskan: `);
if(confirm!==`BOOTSTRAP ${binding.database_name}`){rl.close();throw Error('Dibatalkan.')}
const email=(await rl.question('E-mel pentadbir: ')).trim().toLowerCase();rl.close();
if(!/^\S+@\S+\.\S+$/.test(email)||email.length>254)throw Error('E-mel tidak sah.');
async function secret(prompt){stdout.write(prompt);stdin.setRawMode(true);stdin.resume();return new Promise((resolve,reject)=>{let value='';const finish=()=>{stdin.off('data',onData);stdin.setRawMode(false);stdin.pause();stdout.write('\n')};const onData=chunk=>{for(const c of chunk.toString()){if(c==='\u0003'){finish();reject(Error('Dibatalkan.'));return}if(c==='\r'||c==='\n'){finish();resolve(value);return}if(c==='\u007f'||c==='\b')value=value.slice(0,-1);else if(c>=' '&&value.length<129)value+=c}};stdin.on('data',onData)})}
let password=await secret('Kata laluan (16–128 aksara, tidak dipaparkan): ');
let repeat=await secret('Ulang kata laluan: ');
if(password!==repeat)throw Error('Kata laluan tidak sepadan.');
const passwordHash=await hashPassword(password);password='';repeat='';
let proxy;
try{
 let query;
 if(staging){
  const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
  if(!account||!/^[a-f0-9]{32}$/i.test(account)||!token)throw Error('Akses Cloudflare staging belum dikonfigurasi. Jangan masukkan token dalam argumen atau Git.');
  query=async(sql,params)=>{const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${binding.database_id}/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({sql,params})});const data=await response.json();if(!response.ok||!data.success)throw Error('Operasi staging gagal; butiran sensitif tidak dicetak.');return data.result[0]};
 }else{proxy=await getPlatformProxy({configPath:'wrangler.jsonc',persist:{path:'.wrangler/state/v3'}});query=async(sql,params)=>proxy.env.DB.prepare(sql).bind(...params).all()}
 // One atomic parameterized statement prevents concurrent bootstrap creating a second account.
 const id=crypto.randomUUID();const result=await query(FIRST_ADMIN_SQL,[id,email,passwordHash]);
 if(result.results?.length!==1||result.results[0].id!==id)throw Error('Akaun sudah wujud. Bootstrap pertama sahaja dibenarkan.');
 // The migration's INSERT trigger records provisioning atomically without secrets.
 console.log('Bootstrap selesai. Tiada kata laluan atau token dipaparkan.');
} catch {console.error('Bootstrap tidak dapat diselesaikan sepenuhnya. Semak status akaun melalui proses pentadbiran sebelum mencuba semula.');process.exitCode=1}finally{await proxy?.dispose()}
