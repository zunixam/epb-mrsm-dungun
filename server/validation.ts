import { HttpError } from './auth';
function text(value:unknown,max:number){if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw new HttpError(400,`Teks wajib diisi (maksimum ${max} aksara).`);return value.trim()}
function date(value:unknown){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number(value.slice(0,4))<2000||Number(value.slice(0,4))>2100||!Number.isFinite(Date.parse(`${value}T00:00:00Z`))||new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)!==value)throw new HttpError(400,'Tarikh tidak sah (2000–2100).');return value}
function time(value:unknown){if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw new HttpError(400,'Masa keluar dan masuk wajib diisi dalam format HH:mm.');return value}
export function validateRecord(kind:'schedules'|'announcements',data:Record<string,unknown>){
 const title=text(data.title,200);if(kind==='announcements'){if(!['draft','published'].includes(String(data.status)))throw new HttpError(400,'Status pengumuman tidak sah.');return {title,body:text(data.body,5000),status:data.status as string}}
 const start_date=date(data.start_date),end_date=date(data.end_date);if(end_date<=start_date)throw new HttpError(400,'Tarikh masuk mesti selepas tarikh keluar.');
 if(!['PB Wajib','PB Pilihan'].includes(String(data.category)))throw new HttpError(400,'Kategori tidak sah.');if(!['draft','published','cancelled'].includes(String(data.status)))throw new HttpError(400,'Status jadual tidak sah.');
 return {title,start_date,end_date,departure_time:time(data.departure_time),return_time:time(data.return_time),category:data.category as string,status:data.status as string};
}
