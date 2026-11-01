'use client';
import { useEffect, useState } from 'react';
import { j, Data } from '../../../lib/api';
import Statement from '../../../lib/Statement';
export default function Share({ params }: { params: { token: string } }) {
  const [d, setD] = useState<Data | null>(null), [err, setErr] = useState('');
  useEffect(() => { j<Data>('/api/share/' + params.token).then(setD).catch(e => setErr(e.message)); }, [params.token]);
  return (<><header className="bg-brand text-white mb-5 px-3 py-4 border-b-[6px] border-gold"><div className="max-w-6xl mx-auto"><h1>সোয়েল এন্টারপ্রাইজ</h1><p className="opacity-85">স্টেটমেন্ট</p></div></header>
    <main className="max-w-6xl mx-auto px-3 pb-12"><section className="card">
      {err ? <p className="text-danger font-medium">{err}</p> : d ? <Statement data={d} /> : <p>লোড হচ্ছে…</p>}
      <button className="btn mt-4 noprint" onClick={() => window.print()}>প্রিন্ট / PDF</button></section></main></>);
}
