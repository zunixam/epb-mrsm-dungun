export type PBStatus = "PB Wajib" | "PB Pilihan";
export interface PBEvent { id: number; month: string; start: string; end: string; departure: string; returnTime: string; title: string; status: PBStatus }
// Transcribed from the preserved original: index (7).html.
export const events: PBEvent[] = [
  {
    "id": 1,
    "month": "Februari",
    "start": "2026-02-12",
    "end": "2026-02-21",
    "departure": "Selepas 2.00 ptg",
    "returnTime": "Sebelum 6.00 ptg",
    "title": "Cuti Tahun Baru Cina & Awal Ramadan",
    "status": "PB Wajib"
  },
  {
    "id": 2,
    "month": "Mac",
    "start": "2026-03-17",
    "end": "2026-03-28",
    "departure": "Selepas 12.00 tgh",
    "returnTime": "Sebelum 6.00 ptg",
    "title": "Hari Raya Aidil Fitri & Cuti Semester",
    "status": "PB Wajib"
  },
  {
    "id": 3,
    "month": "April",
    "start": "2026-04-23",
    "end": "2026-04-26",
    "departure": "Selepas 2.30 ptg",
    "returnTime": "Sebelum 6.00 ptg",
    "title": "Hari Keputeraan Sultan Terengganu",
    "status": "PB Pilihan"
  },
  {
    "id": 4,
    "month": "Mei",
    "start": "2026-05-21",
    "end": "2026-06-06",
    "departure": "Selepas 2.30 ptg",
    "returnTime": "Sebelum 6.00 ptg",
    "title": "Cuti Semester & Hari Raya Aidil Adha",
    "status": "PB Wajib"
  },
  {
    "id": 5,
    "month": "Julai",
    "start": "2026-07-30",
    "end": "2026-08-01",
    "departure": "Selepas 2.30 ptg",
    "returnTime": "Sebelum 6.00 ptg",
    "title": "Cuti Hujung Minggu",
    "status": "PB Pilihan"
  },
  {
    "id": 6,
    "month": "Ogos",
    "start": "2026-08-27",
    "end": "2026-09-05",
    "departure": "Selepas 2.30 ptg",
    "returnTime": "Sebelum 6.00 ptg",
    "title": "Hari Kebangsaan & Cuti Semester",
    "status": "PB Wajib"
  },
  {
    "id": 7,
    "month": "Oktober",
    "start": "2026-10-29",
    "end": "2026-10-31",
    "departure": "Selepas 2.30 ptg",
    "returnTime": "Sebelum 6.00 ptg",
    "title": "Cuti Hujung Minggu",
    "status": "PB Pilihan"
  },
  {
    "id": 8,
    "month": "Disember",
    "start": "2026-12-03",
    "end": "2027-01-02",
    "departure": "Selepas 1.30 ptg",
    "returnTime": "Sebelum 6.00 ptg",
    "title": "Cuti Akhir Tahun",
    "status": "PB Wajib"
  }
];
