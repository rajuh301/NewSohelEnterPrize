import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import mongoose, { Schema } from 'mongoose';
import { z, ZodTypeAny } from 'zod';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const app = express(); app.use(cors(), express.json());
const SECRET = process.env.JWT_SECRET || 'dev-secret';

const User = mongoose.model('User', new Schema({ name: String, username: { type: String, unique: true }, role: String, salt: String, hash: String }));
const Remit = mongoose.model('Remittance', new Schema({
  date: Date, sender: String, receiver: String, phone: String, method: String, account: String, bank: String,
  myr: Number, rate: Number, bdt: Number,
  receivedMYR: { type: Number, default: 0 }, receipts: [{ amount: Number, date: Date, by: String }],
  payout: { status: { type: String, default: 'pending' }, trx: String, note: String, at: Date, by: String },
  note: String, createdBy: String
}, { timestamps: true }));
const Share = mongoose.model('Share', new Schema({ token: String, from: String, to: String, sender: String, status: String }));

// ---------- helpers ----------
type Role = 'malaysia' | 'bangladesh';
const hashPw = (p: string, s: string) => crypto.scryptSync(p, s, 32).toString('hex');
const sign = (u: any) => jwt.sign({ id: String(u._id), role: u.role, name: u.name }, SECRET, { expiresIn: '30d' });
const auth = (...roles: Role[]) => (req: any, res: Response, next: NextFunction) => {
  try { req.user = jwt.verify((req.headers.authorization || '').slice(7), SECRET); }
  catch { return res.status(401).json({ error: 'আবার লগইন করুন' }); }
  if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'এই কাজের অনুমতি আপনার নেই' });
  next();
};
const parse = (schema: ZodTypeAny) => (req: any, res: Response, next: NextFunction) => {
  const r = schema.safeParse(req.body);
  if (!r.success) return res.status(400).json({ error: r.error.issues.map(i => i.message).join(', ') });
  req.data = r.data; next();
};
const wrap = (fn: (req: any, res: Response) => Promise<any>) => (req: Request, res: Response) =>
  fn(req, res).catch((e: Error) => res.status(500).json({ error: e.message }));

// ---------- auth ----------
const regSchema = z.object({
  name: z.string().trim().min(2, 'নাম দিন'), username: z.string().trim().toLowerCase().min(3, 'ইউজারনেম কমপক্ষে ৩ অক্ষর'),
  password: z.string().min(6, 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর'), role: z.enum(['malaysia', 'bangladesh']), code: z.string()
});
const loginSchema = z.object({ username: z.string().trim().toLowerCase(), password: z.string() });
app.post('/api/auth/register', parse(regSchema), wrap(async (req, res) => {
  const d = req.data;
  if (d.code !== process.env.SIGNUP_CODE) return res.status(403).json({ error: 'সাইনআপ কোড ভুল' });
  if (await User.findOne({ username: d.username })) return res.status(400).json({ error: 'এই ইউজারনেম আগে নেওয়া হয়েছে' });
  const salt = crypto.randomBytes(8).toString('hex');
  const u = await User.create({ name: d.name, username: d.username, role: d.role, salt, hash: hashPw(d.password, salt) });
  res.json({ token: sign(u), user: { name: u.name, role: u.role } });
}));
app.post('/api/auth/login', parse(loginSchema), wrap(async (req, res) => {
  const u = await User.findOne({ username: req.data.username });
  if (!u || u.hash !== hashPw(req.data.password, u.salt as string)) return res.status(400).json({ error: 'ইউজারনেম বা পাসওয়ার্ড ভুল' });
  res.json({ token: sign(u), user: { name: u.name, role: u.role } });
}));

// ---------- remittances ----------
const remitSchema = z.object({
  date: z.coerce.date(), sender: z.string().trim().min(1, 'প্রেরকের নাম দিন'), receiver: z.string().trim().min(1, 'প্রাপকের নাম দিন'),
  phone: z.string().trim().regex(/^(\+?88)?01[3-9]\d{8}$/, 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন'),
  method: z.enum(['bKash', 'Nagad', 'Rocket', 'Bank']), account: z.string().trim().min(1, 'একাউন্ট নম্বর দিন'),
  bank: z.string().trim().optional().default(''), myr: z.coerce.number().positive('রিংগিত দিন'), rate: z.coerce.number().positive('রেট দিন'),
  receivedMYR: z.coerce.number().min(0).default(0), note: z.string().trim().optional().default('')
}).refine(d => d.method !== 'Bank' || d.bank, { message: 'ব্যাংকের নাম দিন', path: ['bank'] });
const amountSchema = z.object({ amount: z.coerce.number().positive('টাকার পরিমাণ দিন') });
const payoutSchema = z.object({ trx: z.string().trim().min(1, 'ট্রানজেকশন আইডি/রেফারেন্স দিন'), note: z.string().trim().optional().default('') });

type Filter = { from?: string; to?: string; sender?: string; status?: string };
const buildQuery = ({ from, to, sender, status }: Filter) => {
  const q: Record<string, any> = {};
  if (from || to) q.date = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to + 'T23:59:59') }) };
  if (sender) q.sender = new RegExp(sender.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (status === 'pending' || status === 'paid') q['payout.status'] = status;
  if (status === 'due') q.$expr = { $gt: ['$myr', '$receivedMYR'] };
  return q;
};
const statement = async (f: Filter) => {
  const items = await Remit.find(buildQuery(f)).sort({ date: -1, createdAt: -1 }).lean();
  const t = { myr: 0, bdt: 0, receivedMYR: 0, paidBDT: 0, pendingBDT: 0, dueMYR: 0 };
  for (const r of items as any[]) {
    t.myr += r.myr; t.bdt += r.bdt; t.receivedMYR += r.receivedMYR;
    if (r.payout?.status === 'paid') t.paidBDT += r.bdt; else t.pendingBDT += r.bdt;
  }
  t.dueMYR = t.myr - t.receivedMYR; return { items, total: t };
};

app.get('/api/remittances', auth(), wrap(async (req, res) => res.json(await statement(req.query as Filter))));
app.post('/api/remittances', auth('malaysia'), parse(remitSchema), wrap(async (req, res) => {
  const d = req.data; d.bdt = +(d.myr * d.rate).toFixed(2);
  if (d.receivedMYR > d.myr) return res.status(400).json({ error: 'জমা রিংগিত মোটের বেশি হতে পারে না' });
  res.status(201).json(await Remit.create({ ...d, createdBy: req.user.name }));
}));
app.post('/api/remittances/:id/receive', auth('malaysia'), parse(amountSchema), wrap(async (req, res) => {
  const r = await Remit.findById(req.params.id); if (!r) return res.status(404).json({ error: 'পাওয়া যায়নি' });
  if (req.data.amount > r.myr! - r.receivedMYR! + 1e-9) return res.status(400).json({ error: 'বাকির চেয়ে বেশি জমা নেওয়া যাবে না' });
  r.receivedMYR! += req.data.amount; r.receipts.push({ amount: req.data.amount, date: new Date(), by: req.user.name });
  res.json(await r.save());
}));
app.post('/api/remittances/:id/payout', auth('bangladesh'), parse(payoutSchema), wrap(async (req, res) => {
  const r = await Remit.findById(req.params.id); if (!r) return res.status(404).json({ error: 'পাওয়া যায়নি' });
  if (r.payout?.status === 'paid') return res.status(400).json({ error: 'এটি আগেই পরিশোধ করা হয়েছে' });
  r.payout = { status: 'paid', trx: req.data.trx, note: req.data.note, at: new Date(), by: req.user.name };
  res.json(await r.save());
}));
app.delete('/api/remittances/:id', auth('malaysia'), wrap(async (req, res) => {
  const r = await Remit.findById(req.params.id);
  if (r?.payout?.status === 'paid') return res.status(400).json({ error: 'পরিশোধ হয়ে গেছে, মোছা যাবে না' });
  await Remit.findByIdAndDelete(req.params.id); res.json({ ok: true });
}));

// ---------- share (public, read-only) ----------
app.post('/api/share', auth(), wrap(async (req, res) => {
  const { from = '', to = '', sender = '', status = '' } = req.body; const token = crypto.randomBytes(8).toString('hex');
  await Share.create({ token, from, to, sender, status }); res.json({ token });
}));
app.get('/api/share/:token', wrap(async (req, res) => {
  const s = await Share.findOne({ token: req.params.token }); if (!s) return res.status(404).json({ error: 'লিংকটি সঠিক নয়' });
  const f = { from: s.from || '', to: s.to || '', sender: s.sender || '', status: s.status || '' };
  res.json({ filter: f, ...(await statement(f)) });
}));

mongoose.connect(process.env.MONGO_URI as string)
  .then(() => app.listen(process.env.PORT || 5000, () => console.log('API চালু: http://localhost:' + (process.env.PORT || 5000))))
  .catch((e: Error) => { console.error('MongoDB সংযোগ ব্যর্থ:', e.message); process.exit(1); });
