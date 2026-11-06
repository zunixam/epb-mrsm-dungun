import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
export interface AccessConfig { ACCESS_TEAM_DOMAIN?:string; ACCESS_AUD?:string; ADMIN_EMAILS?:string }
export class HttpError extends Error { constructor(public status:number,message:string){ super(message); } }
const keySets=new Map<string,JWTVerifyGetKey>();
export async function verifyAdmin(request:Request,env:AccessConfig,testKeys?:JWTVerifyGetKey):Promise<string>{
 const domain=env.ACCESS_TEAM_DOMAIN?.trim();const aud=env.ACCESS_AUD?.trim();const emails=env.ADMIN_EMAILS?.split(',').map(e=>e.trim().toLowerCase()).filter(Boolean);
 if(!domain||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain)||!aud||!emails?.length||emails.some(e=>!/^\S+@\S+\.\S+$/.test(e)))throw new HttpError(503,'Konfigurasi Cloudflare Access tidak lengkap atau tidak sah.');
 const token=request.headers.get('Cf-Access-Jwt-Assertion');if(!token)throw new HttpError(401,'Log masuk Cloudflare Access diperlukan.');
 try {
  let keys=testKeys??keySets.get(domain);if(!keys){keys=createRemoteJWKSet(new URL(`${domain}/cdn-cgi/access/certs`));keySets.set(domain,keys)}
  const {payload}=await jwtVerify(token,keys,{issuer:domain,audience:aud,algorithms:['RS256'],requiredClaims:['exp','iat','sub','email'],clockTolerance:5});
  if(typeof payload.email!=='string'||!emails.includes(payload.email.toLowerCase()))throw new HttpError(403,'Identiti pentadbir tidak dibenarkan.');
  return payload.email.toLowerCase();
 }catch(error){if(error instanceof HttpError)throw error;throw new HttpError(401,'Token Cloudflare Access tidak sah atau telah tamat tempoh.')}
}
export function checkWriteOrigin(request:Request){if(request.headers.get('Origin')!==new URL(request.url).origin)throw new HttpError(403,'Origin permintaan tidak dibenarkan.');if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw new HttpError(415,'Gunakan application/json.');}
