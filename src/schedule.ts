import { events, type PBEvent } from './data';
export function malaysiaDate(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Kuala_Lumpur', year:'numeric', month:'2-digit', day:'2-digit' }).format(now); }
export function departureInstant(event: PBEvent) {
 const times: Record<number,string> = {1:'14:00',2:'12:00',3:'14:30',4:'14:30',5:'14:30',6:'14:30',7:'14:30',8:'13:30'};
 return new Date(`${event.start}T${times[event.id]}:00+08:00`);
}
export function nextEvent(now = new Date()) { return events.find(e => departureInstant(e).getTime() > now.getTime()); }
export function countdown(event: PBEvent, now: Date) { const seconds=Math.max(0,Math.floor((departureInstant(event).getTime()-now.getTime())/1000)); return {days:Math.floor(seconds/86400),hours:Math.floor(seconds%86400/3600),minutes:Math.floor(seconds%3600/60),seconds:seconds%60}; }
export function filterEvents(query:string,status:string,month:string) { return events.filter(e=>(status==='all'||e.status===status)&&(month==='all'||e.start.slice(5,7)===month)&&`${e.title} ${e.month} ${e.status} ${e.start} ${e.end}`.toLocaleLowerCase('ms').includes(query.trim().toLocaleLowerCase('ms'))); }
export function formatDate(value:string) { return new Intl.DateTimeFormat('ms-MY',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kuala_Lumpur'}).format(new Date(`${value}T00:00:00+08:00`)); }
export function eventsOnDay(day:string) { return events.filter(e=>e.start<=day && e.end>=day); }
