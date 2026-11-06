import type { PagesFunction } from '@cloudflare/workers-types';
import { verifyAdmin, HttpError } from '../../server/auth';
import type { Env } from '../../server/api';
export const onRequest:PagesFunction<Env> = async context => {
 try{await verifyAdmin(context.request as unknown as Request,context.env);const url=new URL(context.request.url);url.pathname='/index.html';const response=await context.env.ASSETS.fetch(new Request(url,{method:'GET'}));const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('X-Robots-Tag','noindex, nofollow');return new Response(response.body,{status:response.status,headers}) as never}
 catch(error){return new Response(error instanceof HttpError?error.message:'Akses pentadbir ditolak.',{status:error instanceof HttpError?error.status:403,headers:{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'}}) as never}
};
