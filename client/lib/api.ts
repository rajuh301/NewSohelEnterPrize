export const API = process.env.NEXT_PUBLIC_API || 'http://localhost:5000';
export type Remit = { _id: string; date: string; sender: string; receiver: string; phone: string; method: string; account: string; bank?: string; myr: number; rate: number; bdt: number; receivedMYR: number; payout: { status: 'pending' | 'paid'; trx?: string; at?: string } };
export type Total = { myr: number; bdt: number; receivedMYR: number; paidBDT: number; pendingBDT: number; dueMYR: number };
export type Data = { items: Remit[]; total: Total };
export type User = { name: string; role: 'malaysia' | 'bangladesh' };
export const emptyData: Data = { items: [], total: { myr: 0, bdt: 0, receivedMYR: 0, paidBDT: 0, pendingBDT: 0, dueMYR: 0 } };

export const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('swell_token') : null);
export async function j<T = any>(path: string, opt: RequestInit = {}): Promise<T> {
  const t = getToken();
  const r = await fetch(API + path, { ...opt, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) } });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && t) { localStorage.removeItem('swell_token'); location.reload(); }
  if (!r.ok) throw new Error(d.error || 'ত্রুটি হয়েছে');
  return d as T;
}
const n = (v: number, d = 2) => Number(v || 0).toLocaleString('bn-BD', { maximumFractionDigits: d });
export const tk = (v: number) => '৳' + n(v);
export const rm = (v: number) => 'RM ' + n(v);
export const dt = (d: string) => new Date(d).toLocaleDateString('bn-BD');
