import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { events } from './data';
import { countdown, departureInstant, eventsOnDay, filterEvents, malaysiaDate, nextEvent } from './schedule';
describe('data asal PB',()=>{
 it('mengekalkan kesemua lapan peristiwa dan status dari HTML asal',()=>{const html=readFileSync('index (7).html','utf8');const titles=[...html.matchAll(/<td class="px-3 py-4 text-sm text-gray-900 font-medium">(.*?)<\/td>/g)].map(m=>m[1]);expect(events.map(e=>e.title)).toEqual(titles);expect(events.filter(e=>e.status==='PB Wajib')).toHaveLength(5);expect(events.filter(e=>e.status==='PB Pilihan')).toHaveLength(3);expect(events.at(-1)?.end).toBe('2027-01-02');});
 it('menggabungkan carian, status dan bulan',()=>{expect(filterEvents('CUTI','PB Pilihan','07').map(e=>e.id)).toEqual([5]);expect(filterEvents('Ramadan','PB Pilihan','all')).toHaveLength(0);expect(filterEvents('  ramadan  ','all','all')).toHaveLength(1);expect(filterEvents('zzzz','all','all')).toHaveLength(0)});
 it('meliputi tarikh mula, akhir dan rentas tahun dalam kalendar',()=>{expect(eventsOnDay('2026-12-03')[0].id).toBe(8);expect(eventsOnDay('2027-01-02')[0].id).toBe(8);expect(eventsOnDay('2027-01-03')).toHaveLength(0);expect(eventsOnDay('2026-06-01')[0].id).toBe(4)});
});
describe('waktu Malaysia dan countdown',()=>{
 it('menggunakan zon Asia/Kuala_Lumpur di sempadan hari',()=>expect(malaysiaDate(new Date('2026-11-05T16:00:00Z'))).toBe('2026-11-06'));
 it('mengira masa keluar asal dan countdown tepat',()=>{expect(departureInstant(events[7]).toISOString()).toBe('2026-12-03T05:30:00.000Z');expect(countdown(events[7],new Date('2026-12-02T04:28:57Z'))).toEqual({days:1,hours:1,minutes:1,seconds:3});expect(countdown(events[7],new Date('2027-01-01'))).toEqual({days:0,hours:0,minutes:0,seconds:0})});
 it('memilih PB seterusnya serta mengendalikan jadual tamat',()=>{expect(nextEvent(new Date('2026-01-01'))?.id).toBe(1);expect(nextEvent(new Date('2026-11-06'))?.id).toBe(8);expect(nextEvent(new Date('2026-12-03T05:30:00Z'))).toBeUndefined()});
});
