export type Publication = 'draft' | 'published' | 'cancelled';
export interface ScheduleRecord { id:string; title:string; start_date:string; end_date:string; departure_time:string; return_time:string; category:'PB Wajib'|'PB Pilihan'; status:Publication; created_at:string; updated_at:string; version:number }
export interface AnnouncementRecord { id:string; title:string; body:string; status:'draft'|'published'; created_at:string; updated_at:string; version:number }
export interface AuditRecord { id:string; actor:string; action:string; entity_type:string; entity_id:string; before_json:string|null; after_json:string|null; created_at:string }
