'use client';
import { useEffect, useState, ChangeEvent, FormEvent } from 'react';
import { z } from 'zod';
import { j, Data, emptyData, User, Remit } from '../lib/api';
import Statement from '../lib/Statement';

const remit = z.object({
  sender: z.string().trim().min(1, 'প্রেরকের নাম দিন'), receiver: z.string().trim().min(1, 'প্রাপকের নাম দিন'),
  phone: z.string().regex(/^(\+?88)?01[3-9]\d{8}$/, 'সঠিক মোবাইল নম্বর দিন'), account: z.string().trim().min(1, 'একাউন্ট নম্বর দিন'),
  myr: z.coerce.number().positive('রিংগিত দিন'), rate: z.coerce.number().positive('রেট দিন'), receivedMYR: z.coerce.number().min(0)
});
const today = () => new Date().toISOString().slice(0, 10);
const blank = { date: today(), sender: '', receiver: '', phone: '', method: 'bKash', account: '', bank: '', myr: '', rate: '', receivedMYR: '0', note: '' };
const ROLE = { malaysia: 'মালয়েশিয়া (প্রেরক)', bangladesh: 'বাংলাদেশ (পরিশোধকারী)' };
type Ev = ChangeEvent<HTMLInputElement | HTMLSelectElement>;
const post = (path: string, body: unknown) => j(path, { method: 'POST', body: JSON.stringify(body) });

function Auth({ onDone }: { onDone: (u: User) => void }) {
  const [reg, setReg] = useState(false), [err, setErr] = useState('');
  const [f, setF] = useState({ name: '', username: '', password: '', role: 'malaysia', code: '' });
  const set = (k: string) => (e: Ev) => setF({ ...f, [k]: e.target.value });
  const go = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    try { const d = await post(reg ? '/api/auth/register' : '/api/auth/login', f); localStorage.setItem('swell_token', d.token); onDone(d.user); }
    catch (x) { setErr((x as Error).message); }
  };
  return (<div className="min-h-screen grid place-items-center p-4 bg-brand"><form className="card w-full max-w-sm flex flex-col gap-3 border-t-[6px] border-t-gold" onSubmit={go}>
    <h1 className="text-brand">সোয়েল এন্টারপ্রাইজ</h1><p className="text-gray-600 -mt-2">মালয়েশিয়া থেকে বাংলাদেশে টাকার হিসাব</p>
    {reg && <label className="field">আপনার নাম<input className="inp" value={f.name} onChange={set('name')} /></label>}
    <label className="field">ইউজারনেম<input className="inp" value={f.username} onChange={set('username')} autoCapitalize="none" /></label>
    <label className="field">পাসওয়ার্ড<input className="inp" type="password" value={f.password} onChange={set('password')} /></label>
    {reg && <><label className="field">আপনি কোথায় থাকেন?<select className="inp" value={f.role} onChange={set('role')}><option value="malaysia">মালয়েশিয়া (টাকা পাঠাব)</option><option value="bangladesh">বাংলাদেশ (টাকা দেব)</option></select></label>
      <label className="field">সাইনআপ কোড<input className="inp" value={f.code} onChange={set('code')} /></label></>}
    {err && <p className="text-danger font-medium">{err}</p>}
    <button className="btn-primary">{reg ? 'একাউন্ট খুলুন' : 'লগইন'}</button>
    <button type="button" className="btn-ghost" onClick={() => { setReg(!reg); setErr(''); }}>{reg ? 'আগে থেকে একাউন্ট আছে' : 'নতুন একাউন্ট খুলুন'}</button>
  </form></div>);
}

function Dashboard({ user, logout }: { user: User; logout: () => void }) {
  const [data, setData] = useState<Data>(emptyData);
  const [f, setF] = useState(blank), [msg, setMsg] = useState(''), [link, setLink] = useState('');
  const [flt, setFlt] = useState({ from: '', to: '', sender: '', status: user.role === 'bangladesh' ? 'pending' : '' });
  const load = () => j<Data>('/api/remittances?' + new URLSearchParams(flt)).then(setData).catch(e => setMsg(e.message));
  useEffect(() => { load(); }, [flt]);
  const set = (k: string) => (e: Ev) => setF({ ...f, [k]: e.target.value });
  const fl = (k: string) => (e: Ev) => setFlt({ ...flt, [k]: e.target.value });
  const bdt = (Number(f.myr) * Number(f.rate)) || 0;

  const save = async (e: FormEvent) => {
    e.preventDefault(); setMsg(''); const v = remit.safeParse(f); if (!v.success) return setMsg(v.error.issues[0].message);
    try { await post('/api/remittances', f); setF({ ...blank, sender: f.sender, method: f.method, rate: f.rate }); setMsg('✔ লেনদেন সংরক্ষিত হয়েছে'); load(); }
    catch (x) { setMsg((x as Error).message); }
  };
  const receive = async (r: Remit, due: number) => {
    const a = prompt(`${r.sender} এর কাছে বাকি RM ${due}। কত রিংগিত জমা নিলেন?`); if (!a) return;
    try { await post(`/api/remittances/${r._id}/receive`, { amount: a }); load(); } catch (x) { alert((x as Error).message); }
  };
  const payout = async (r: Remit) => {
    const trx = prompt(`${r.receiver} (${r.method} ${r.account}) কে ${r.bdt} টাকা দিয়েছেন। ট্রানজেকশন আইডি লিখুন:`); if (!trx) return;
    try { await post(`/api/remittances/${r._id}/payout`, { trx }); load(); } catch (x) { alert((x as Error).message); }
  };
  const del = async (id: string) => { if (confirm('মুছে ফেলবেন?')) try { await j('/api/remittances/' + id, { method: 'DELETE' }); load(); } catch (x) { alert((x as Error).message); } };
  const share = async () => { const { token } = await post('/api/share', flt); const u = location.origin + '/share/' + token; setLink(u); navigator.clipboard?.writeText(u); };

  return (<>
    <header className="bg-brand text-white mb-5 px-3 py-4 border-b-[6px] border-gold"><div className="max-w-6xl mx-auto flex justify-between items-center gap-3">
      <div><h1>সোয়েল এন্টারপ্রাইজ</h1><p className="opacity-85">{user.name} · {ROLE[user.role]}</p></div>
      <button className="btn bg-transparent text-white border-white/50" onClick={logout}>লগআউট</button></div></header>
    <main className="max-w-6xl mx-auto px-3 pb-12">
      {user.role === 'malaysia' && <section className="card"><h2 className="text-lg font-bold mb-3">নতুন লেনদেন (টাকা পাঠান)</h2>
        <form onSubmit={save} className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
          <label className="field">তারিখ<input className="inp" type="date" value={f.date} onChange={set('date')} /></label>
          <label className="field">প্রেরক (যে টাকা দিল)<input className="inp" value={f.sender} onChange={set('sender')} /></label>
          <label className="field">প্রাপকের নাম<input className="inp" value={f.receiver} onChange={set('receiver')} /></label>
          <label className="field">প্রাপকের মোবাইল<input className="inp" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="01XXXXXXXXX" /></label>
          <label className="field">মাধ্যম<select className="inp" value={f.method} onChange={set('method')}>{['bKash', 'Nagad', 'Rocket', 'Bank'].map(m => <option key={m}>{m}</option>)}</select></label>
          {f.method === 'Bank' && <label className="field">ব্যাংকের নাম<input className="inp" value={f.bank} onChange={set('bank')} /></label>}
          <label className="field">{f.method === 'Bank' ? 'ব্যাংক একাউন্ট নম্বর' : 'মোবাইল একাউন্ট নম্বর'}<input className="inp" value={f.account} onChange={set('account')} /></label>
          <label className="field">রিংগিত (RM)<input className="inp" type="number" inputMode="decimal" step="any" value={f.myr} onChange={set('myr')} /></label>
          <label className="field">রেট (১ RM = ? টাকা)<input className="inp" type="number" inputMode="decimal" step="any" value={f.rate} onChange={set('rate')} /></label>
          <label className="field">এখনই জমা পেয়েছি (RM)<input className="inp" type="number" inputMode="decimal" step="any" value={f.receivedMYR} onChange={set('receivedMYR')} /></label>
          <label className="field col-span-full">নোট<input className="inp" value={f.note} onChange={set('note')} /></label>
          <div className="col-span-full flex flex-wrap items-center justify-between gap-3">
            <div>বাংলাদেশে দেওয়া হবে <b>৳{bdt.toLocaleString('bn-BD')}</b> · RM বাকি <b className="text-danger">{(Number(f.myr || 0) - Number(f.receivedMYR || 0)).toLocaleString('bn-BD')}</b></div>
            <button className="btn-primary">সংরক্ষণ করুন</button></div>
        </form></section>}
      {msg && <p className="card font-medium">{msg}</p>}
      <section className="card"><h2 className="text-lg font-bold mb-3">{user.role === 'bangladesh' ? 'বাংলাদেশে যাদের টাকা দিতে হবে' : 'হিসাব ও স্টেটমেন্ট'}</h2>
        <div className="noprint grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 items-end mb-4">
          <label className="field">অবস্থা<select className="inp" value={flt.status} onChange={fl('status')}><option value="">সব</option><option value="pending">বাংলাদেশে দেওয়া বাকি</option><option value="paid">বাংলাদেশে দেওয়া হয়েছে</option><option value="due">প্রেরকের কাছে RM বাকি</option></select></label>
          <label className="field">শুরু<input className="inp" type="date" value={flt.from} onChange={fl('from')} /></label>
          <label className="field">শেষ<input className="inp" type="date" value={flt.to} onChange={fl('to')} /></label>
          <label className="field">প্রেরকের নাম<input className="inp" value={flt.sender} onChange={fl('sender')} /></label>
          <div className="flex gap-2 flex-wrap"><button className="btn" onClick={() => window.print()}>প্রিন্ট / PDF</button><button className="btn-primary" onClick={share}>স্টেটমেন্ট শেয়ার</button></div>
        </div>
        {link && <p className="font-medium mb-3 break-all">লিংক কপি হয়েছে: <a className="underline" href={link} target="_blank">{link}</a>{' '}
          <a className="text-good font-bold ml-2" href={'https://wa.me/?text=' + encodeURIComponent('সোয়েল এন্টারপ্রাইজ স্টেটমেন্ট: ' + link)} target="_blank">WhatsApp এ পাঠান</a></p>}
        <Statement data={data} role={user.role} onReceive={receive} onPayout={payout} onDelete={del} />
      </section>
    </main></>);
}

export default function Home() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    const t = localStorage.getItem('swell_token'); if (!t) return setUser(null);
    try {
      const b = atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'));
      const p = JSON.parse(new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0))));
      if (p.exp * 1000 < Date.now()) throw 0; setUser({ name: p.name, role: p.role });
    } catch { localStorage.removeItem('swell_token'); setUser(null); }
  }, []);
  if (user === undefined) return null;
  if (!user) return <Auth onDone={setUser} />;
  return <Dashboard user={user} logout={() => { localStorage.removeItem('swell_token'); setUser(null); }} />;
}
