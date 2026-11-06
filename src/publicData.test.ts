import { afterEach, expect, it, vi } from 'vitest';
import { loadPublished } from './publicData';
const record={id:'dynamic-pb',title:'PB D1',start_date:'2028-01-04',end_date:'2028-01-06',departure_time:'11:45',return_time:'17:00',category:'PB Pilihan',status:'published'};
afterEach(()=>vi.unstubAllGlobals());
it('memetakan jadual diterbitkan dan masa dinamik',async()=>{vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(JSON.stringify({records:url.endsWith('schedules')?[record]:[]}))));const result=await loadPublished();expect(result.events[0]).toMatchObject({id:'dynamic-pb',departureTime:'11:45',status:'PB Pilihan'});expect(result.announcements).toEqual([])});
it('menolak API gagal tanpa menggantikan data asal',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:503})));await expect(loadPublished()).rejects.toThrow()});
it('menolak respons draf, pembatalan, masa atau tarikh palsu',async()=>{for(const patch of [{status:'draft'},{status:'cancelled'},{departure_time:'25:00'},{start_date:'2028-02-30'}]){vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(JSON.stringify({records:url.endsWith('schedules')?[{...record,...patch}]:[]}))));await expect(loadPublished()).rejects.toThrow()}});
it('menolak pengumuman draf walaupun jadual sah',async()=>{vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(JSON.stringify({records:url.endsWith('schedules')?[record]:[{id:'a',title:'Draf',body:'Rahsia',status:'draft'}]}))));await expect(loadPublished()).rejects.toThrow()});
