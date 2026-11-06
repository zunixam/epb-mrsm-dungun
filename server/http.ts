export class HttpError extends Error { constructor(public status:number,message:string){ super(message); } }
export function checkWriteOrigin(request:Request){
 if(request.headers.get('Origin')!==new URL(request.url).origin || ['cross-site','none'].includes(request.headers.get('Sec-Fetch-Site')??''))throw new HttpError(403,'Origin permintaan tidak dibenarkan.');
 if(request.headers.get('Content-Type')?.split(';')[0].trim()!=='application/json')throw new HttpError(415,'Gunakan application/json.');
}
export async function readJson(request: Request, limit=32768):Promise<Record<string,unknown>> {
 if(Number(request.headers.get('Content-Length'))>limit)throw new HttpError(413,'Permintaan terlalu besar.');
 const reader=request.body?.getReader();const chunks:Uint8Array[]=[];let size=0;
 if(reader){while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new HttpError(413,'Permintaan terlalu besar.')}chunks.push(value)}}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 try{const data=JSON.parse(new TextDecoder().decode(bytes));if(!data||Array.isArray(data)||typeof data!=='object')throw Error();return data}catch{throw new HttpError(400,'JSON tidak sah.')}
}
export function json(data:unknown,status=200,extra:Record<string,string>={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}})}
