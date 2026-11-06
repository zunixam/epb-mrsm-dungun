import type { PBEvent } from './data';
import type { AnnouncementRecord, ScheduleRecord } from './shared';
export async function loadPublished():Promise<{events:PBEvent[];announcements:AnnouncementRecord[]}>{
 const responses=await Promise.all(['/api/schedules','/api/announcements'].map(url=>fetch(url,{cache:'no-store'})));if(responses.some(r=>!r.ok))throw Error('API belum disahkan');
 const [s,a]=await Promise.all(responses.map(r=>r.json()));if(!Array.isArray(s.records)||!Array.isArray(a.records))throw Error('Respons API tidak sah');
 const date=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 const time=(v:unknown):v is string=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
 for(const r of s.records){if(r.status!=='published'||typeof r.id!=='string'||typeof r.title!=='string'||!date(r.start_date)||!date(r.end_date)||r.end_date<=r.start_date||!time(r.departure_time)||!time(r.return_time)||!['PB Wajib','PB Pilihan'].includes(r.category))throw Error('Data jadual tidak sah')}
 for(const r of a.records){if(r.status!=='published'||typeof r.id!=='string'||typeof r.title!=='string'||typeof r.body!=='string')throw Error('Data pengumuman tidak sah')}
 return {events:s.records.map((r:ScheduleRecord)=>({id:r.id,title:r.title,start:r.start_date,end:r.end_date,departureTime:r.departure_time,departure:`Selepas ${r.departure_time} MYT`,returnTime:`Sebelum ${r.return_time} MYT`,status:r.category,month:new Intl.DateTimeFormat('ms-MY',{month:'long',timeZone:'Asia/Kuala_Lumpur'}).format(new Date(`${r.start_date}T00:00:00+08:00`))})),announcements:a.records};
}
