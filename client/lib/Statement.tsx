import { Data, tk, rm, dt, Remit, User } from './api';
type Props = { data: Data; role?: User['role']; onReceive?: (r: Remit, due: number) => void; onPayout?: (r: Remit) => void; onDelete?: (id: string) => void };
export default function Statement({ data, role, onReceive, onPayout, onDelete }: Props) {
  const { items, total: t } = data;
  return (<>
    <div className="sum">
      <div><span>মোট পাঠানো (মালয়েশিয়া)</span><b>{rm(t.myr)}</b></div>
      <div><span>বাংলাদেশে মোট দেওয়ার কথা</span><b>{tk(t.bdt)}</b></div>
      <div><span>বাংলাদেশে দেওয়া হয়েছে</span><b className="text-good">{tk(t.paidBDT)}</b></div>
      <div><span>দেওয়া বাকি (বাংলাদেশ)</span><b className="text-danger">{tk(t.pendingBDT)}</b></div>
      <div className="bg-amber-50"><span>প্রেরকের কাছে বাকি</span><b className="text-danger">{rm(t.dueMYR)}</b></div>
    </div>
    <table className="tbl w-full border-collapse">
      <thead><tr><th>তারিখ</th><th>প্রেরক</th><th>প্রাপক</th><th>মাধ্যম</th><th>রিংগিত</th><th>টাকা</th><th>RM বাকি</th><th>পরিশোধ</th>{role && <th></th>}</tr></thead>
      <tbody>{items.map(r => {
        const due = r.myr - r.receivedMYR, paid = r.payout.status === 'paid';
        return (<tr key={r._id}>
          <td data-l="তারিখ">{dt(r.date)}</td><td data-l="প্রেরক">{r.sender}</td>
          <td data-l="প্রাপক"><span>{r.receiver}<small>{r.phone}</small></span></td>
          <td data-l="মাধ্যম"><span>{r.method}<small>{r.method === 'Bank' ? r.bank + ' · ' : ''}{r.account}</small></span></td>
          <td data-l="রিংগিত"><span>{rm(r.myr)}<small>রেট {r.rate}</small></span></td>
          <td data-l="টাকা"><b>{tk(r.bdt)}</b></td>
          <td data-l="RM বাকি" className={due > 0.0001 ? 'text-danger' : 'text-good'}>{due > 0.0001 ? rm(due) : 'জমা পূর্ণ'}</td>
          <td data-l="পরিশোধ"><span>{paid ? <span className="tag bg-green-100 text-good">দেওয়া হয়েছে</span> : <span className="tag bg-red-100 text-danger">বাকি</span>}
            {paid && <small>{r.payout.trx} · {r.payout.at && dt(r.payout.at)}</small>}</span></td>
          {role && <td className="act whitespace-nowrap">
            {role === 'malaysia' && due > 0.0001 && <button className="btn btn-sm" onClick={() => onReceive?.(r, due)}>RM জমা নিন</button>}
            {role === 'bangladesh' && !paid && <button className="btn-primary btn-sm" onClick={() => onPayout?.(r)}>টাকা দিয়েছি</button>}
            {role === 'malaysia' && !paid && <button className="btn-ghost btn-sm" onClick={() => onDelete?.(r._id)}>মুছুন</button>}</td>}
        </tr>);
      })}
      {!items.length && <tr><td colSpan={9} className="text-center text-gray-500 py-8">কোনো লেনদেন নেই।</td></tr>}
      </tbody></table>
  </>);
}
