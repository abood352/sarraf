import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/500.css';
import '@fontsource/tajawal/700.css';
import '@fontsource/tajawal/800.css';
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon, type IconName } from '../icons';
import { addDays, daysBetween, fmt, shortDate, todayIso, uid, usePersisted, useRoute, useTitle, useToast } from '../kit';
import { Bar, CountUp, Dialog, Link, s, Tag, Toast } from '../ui';
import w from './sarraf.module.css';

/* ───────── البيانات التجريبية ───────── */
type Cur = 'SYP' | 'USD';
const curLabel: Record<Cur, string> = { SYP: 'ل.س', USD: '$' };
const RATE = 13_100;
const LARGE_SYP = 1_000_000;

const categories = {
  food: { label: 'طعام وتسوق', color: '#2f8a5f', icon: 'tag' },
  bills: { label: 'فواتير', color: '#b07418', icon: 'receipt' },
  transport: { label: 'مواصلات', color: '#2f6fb0', icon: 'truck' },
  family: { label: 'عائلة وأصدقاء', color: '#a24a7c', icon: 'users' },
  other: { label: 'أخرى', color: '#66736f', icon: 'swap' },
  income: { label: 'دخل', color: '#0b5e55', icon: 'down' },
} as const satisfies Record<string, { label: string; color: string; icon: IconName }>;
type Cat = keyof typeof categories;

interface Tx {
  id: string;
  title: string;
  amount: number;
  cur: Cur;
  cat: Cat;
  at: string;
  ref?: string;
}
interface Payee {
  id: string;
  name: string;
  phone: string;
  cat: Cat;
}
interface Bill {
  id: string;
  name: string;
  provider: string;
  amount: number;
  due: string;
  paidAt?: string;
}
interface CardState {
  frozen: boolean;
  online: boolean;
  limit: number;
}

const t0 = todayIso();
const seedTx: Tx[] = [
  { id: 'a', title: 'راتب تشرين الثاني', amount: 3_200_000, cur: 'SYP', cat: 'income', at: addDays(t0, -12) },
  { id: 'b', title: 'سوبرماركت الشام', amount: -186_500, cur: 'SYP', cat: 'food', at: addDays(t0, -10) },
  { id: 'c', title: 'تحويل إلى ماما', amount: -400_000, cur: 'SYP', cat: 'family', at: addDays(t0, -8) },
  { id: 'd', title: 'فاتورة الإنترنت', amount: -95_000, cur: 'SYP', cat: 'bills', at: addDays(t0, -6) },
  { id: 'e', title: 'تكسي — المزة', amount: -42_000, cur: 'SYP', cat: 'transport', at: addDays(t0, -4) },
  { id: 'f', title: 'تحويل من خالد', amount: 50, cur: 'USD', cat: 'income', at: addDays(t0, -3) },
  { id: 'h', title: 'صيدلية الحياة', amount: -36_000, cur: 'SYP', cat: 'other', at: addDays(t0, -2) },
  { id: 'g', title: 'مخبز الأمين', amount: -18_000, cur: 'SYP', cat: 'food', at: addDays(t0, -1) },
];
const seedPayees: Payee[] = [
  { id: 'p1', name: 'ماما', phone: '0944123456', cat: 'family' },
  { id: 'p2', name: 'خالد الحمصي', phone: '0933765432', cat: 'family' },
  { id: 'p3', name: 'سمانة أبو رامي', phone: '0955001122', cat: 'food' },
  { id: 'p4', name: 'تكسي الياسمين', phone: '0988223344', cat: 'transport' },
];
const seedBills: Bill[] = [
  { id: 'b1', name: 'الكهرباء', provider: 'الشركة العامة للكهرباء', amount: 64_000, due: addDays(t0, 2) },
  { id: 'b2', name: 'المياه', provider: 'مؤسسة المياه', amount: 21_500, due: addDays(t0, 9) },
  { id: 'b3', name: 'الهاتف الخلوي', provider: 'باقة شهرية', amount: 55_000, due: addDays(t0, 15) },
  { id: 'b4', name: 'الإنترنت', provider: 'ADSL منزلي', amount: 95_000, due: addDays(t0, 24), paidAt: addDays(t0, -6) },
];
const seedBudget: Record<Exclude<Cat, 'income'>, number> = { food: 600_000, bills: 300_000, transport: 150_000, family: 500_000, other: 200_000 };
const seedCards: Record<Cur, CardState> = { SYP: { frozen: false, online: true, limit: 2_000_000 }, USD: { frozen: false, online: false, limit: 500 } };

const pages = ['home', 'send', 'cards', 'bills', 'budget', 'activity', 'tx'] as const;
type Page = (typeof pages)[number];
const pageTitle: Record<Page, string> = { home: 'الرئيسية', send: 'إرسال مال', cards: 'بطاقاتي', bills: 'الفواتير', budget: 'الميزانية', activity: 'الحركات', tx: 'تفاصيل الحركة' };
const toSyp = (t: Tx) => (t.cur === 'SYP' ? t.amount : t.amount * RATE);
const money = (n: number, cur: Cur) => (cur === 'USD' ? `$${fmt(n, 2)}` : `${fmt(n)} ل.س`);
const refOf = (t: Tx) => t.ref ?? `SRF-${t.id.toUpperCase().padStart(6, '0')}`;
const payeeColors = ['#0b5e55', '#b4693e', '#2f6fb0', '#a24a7c', '#2f8a5f'];

export default function Sarraf() {
  const { page, param, go, href } = useRoute('sarraf', pages, 'home');
  const [tx, setTx] = usePersisted<Tx[]>('sarraf:tx', seedTx);
  const [payees, setPayees] = usePersisted<Payee[]>('sarraf:payees', seedPayees);
  const [bills, setBills] = usePersisted<Bill[]>('sarraf:bills', seedBills);
  const [budget, setBudget] = usePersisted('sarraf:budget', seedBudget);
  const [cards, setCards] = usePersisted('sarraf:cards', seedCards);
  const [hide, setHide] = usePersisted('sarraf:hide', false);
  const [dialog, setDialog] = useState<null | 'exchange' | 'receive'>(null);
  const [sendTo, setSendTo] = useState<string | null>(null);
  const [toast, show] = useToast();
  useTitle(`${pageTitle[page]} — صرّاف`);

  const balance = useMemo(() => {
    const b: Record<Cur, number> = { SYP: 1_850_000, USD: 270 };
    for (const t of tx) b[t.cur] += t.amount;
    return b;
  }, [tx]);
  const add = (t: Omit<Tx, 'id' | 'at'>) => setTx((all) => [{ ...t, id: uid(), at: todayIso() }, ...all]);

  const monthSpend = useMemo(() => {
    const m = new Date().getMonth();
    const out: Record<string, number> = {};
    for (const t of tx) if (t.amount < 0 && new Date(t.at).getMonth() === m) out[t.cat] = (out[t.cat] ?? 0) - toSyp(t);
    return out;
  }, [tx]);
  const totalSpend = Object.values(monthSpend).reduce((a, b) => a + b, 0);
  const income = tx.filter((t) => t.amount > 0 && new Date(t.at).getMonth() === new Date().getMonth()).reduce((a, t) => a + toSyp(t), 0);

  const payBill = (b: Bill) => {
    if (balance.SYP < b.amount) return show('الرصيد بالليرة غير كافٍ لدفع الفاتورة', 'err');
    add({ title: `فاتورة ${b.name}`, amount: -b.amount, cur: 'SYP', cat: 'bills' });
    setBills((all) => all.map((x) => (x.id === b.id ? { ...x, paidAt: todayIso(), due: addDays(x.due, 30) } : x)));
    show(`دُفعت فاتورة ${b.name}`);
  };
  const isPaid = (b: Bill) => !!b.paidAt && daysBetween(b.paidAt, t0) <= 20;
  const dueSoon = bills.filter((b) => !isPaid(b) && daysBetween(t0, b.due) <= 3);
  const mask = (v: string) => (hide ? '••••••' : v);

  const L = ({ to, p, children, className }: { to: Page; p?: string; children: ReactNode; className?: string }) => (
    <Link to={href(to, p)} go={() => go(to, p)} className={className} current={page === to || (to === 'activity' && page === 'tx')}>
      {children}
    </Link>
  );
  const nav: { id: Page; label: string; icon: IconName; count?: number }[] = [
    { id: 'home', label: 'الرئيسية', icon: 'home' },
    { id: 'send', label: 'تحويل', icon: 'send' },
    { id: 'cards', label: 'البطاقات', icon: 'card' },
    { id: 'activity', label: 'الحركات', icon: 'activity' },
    { id: 'bills', label: 'الفواتير', icon: 'receipt', count: dueSoon.length },
    { id: 'budget', label: 'الميزانية', icon: 'pie' },
  ];

  const TxRow = ({ t }: { t: Tx }) => (
    <L to="tx" p={t.id} className={w.tx}>
      <span className={w.txIcon} style={{ background: `${categories[t.cat].color}17`, color: categories[t.cat].color }}>
        <Icon name={categories[t.cat].icon} size={18} />
      </span>
      <span className={s.grow}>
        <b>{t.title}</b>
        <span className={s.small} style={{ display: 'block', color: 'var(--text-muted)' }}>
          {categories[t.cat].label} · {shortDate(t.at)}
        </span>
      </span>
      <span className={`${w.txAmt} ${t.amount > 0 ? w.pos : ''}`}>
        {t.amount > 0 ? '+' : '−'}
        {money(Math.abs(t.amount), t.cur)}
      </span>
    </L>
  );

  const Top = ({ title, sub, back }: { title: string; sub?: string; back?: Page }) => (
    <div className={w.top}>
      <div className={s.row} style={{ flexWrap: 'nowrap' }}>
        {back && (
          <L to={back} className={w.iconBtn}>
            <Icon name="arrowR" />
          </L>
        )}
        <div>
          <h1>{title}</h1>
          {sub && <p>{sub}</p>}
        </div>
      </div>
      <button className={w.iconBtn} aria-label="الإشعارات" onClick={() => go('bills')}>
        <Icon name="bell" />
        {dueSoon.length > 0 && <em />}
      </button>
    </div>
  );

  return (
    <div className={w.theme}>
      <aside className={w.side}>
        <div className={w.brand}>
          <span className={w.mark}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 9c3-4 13-4 16 0M4 15c3 4 13 4 16 0" />
              <circle cx="12" cy="12" r="2.4" fill="#e8b48f" stroke="none" />
            </svg>
          </span>
          صرّاف
        </div>
        <span className={w.sectionLabel}>الحساب</span>
        {nav.map((n) => (
          <L key={n.id} to={n.id}>
            <Icon name={n.icon} />
            {n.label}
            {!!n.count && <em>{n.count}</em>}
          </L>
        ))}
        <div className={w.sideFoot}>
          <span className={w.ava}>ل</span>
          <div>
            <b style={{ display: 'block' }}>ليلى الحسن</b>
            <span style={{ color: 'var(--text-muted)' }}>حساب موثّق ✓</span>
          </div>
        </div>
      </aside>

      <main className={w.main}>
        <div className={`${w.inner} ${s.enter}`} key={page + param}>
          {page === 'home' && (
            <>
              <Top title="مساء الخير، ليلى" sub={new Date().toLocaleDateString('ar-SY-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' })} />
              <div className={w.split}>
                <div className={s.stack} style={{ gap: 18 }}>
                  <div className={w.hero}>
                    <div className={s.spread}>
                      <small>الرصيد الكلي</small>
                      <button className={w.hideBtn} onClick={() => setHide(!hide)}>
                        {hide ? 'إظهار' : 'إخفاء'}
                      </button>
                    </div>
                    <strong className={w.balance}>
                      <span dir="ltr">{hide ? '••••••' : <CountUp value={balance.SYP + balance.USD * RATE} />}</span> <span style={{ fontSize: '1.1rem', fontWeight: 500 }}>ل.س</span>
                    </strong>
                    <p className={w.balanceSub}>
                      يشمل <span className={s.num}>{mask(money(balance.USD, 'USD'))}</span> بسعر {fmt(RATE)} ل.س للدولار
                    </p>
                    <div className={w.actions}>
                      <L to="send" className={w.action}>
                        <span>
                          <Icon name="send" />
                        </span>
                        إرسال
                      </L>
                      <button className={w.action} onClick={() => setDialog('receive')}>
                        <span>
                          <Icon name="down" />
                        </span>
                        استلام
                      </button>
                      <button className={w.action} onClick={() => setDialog('exchange')}>
                        <span>
                          <Icon name="swap" />
                        </span>
                        تصريف
                      </button>
                      <L to="bills" className={w.action}>
                        <span>
                          <Icon name="receipt" />
                        </span>
                        فواتير
                      </L>
                    </div>
                  </div>
                  <div className={w.box}>
                    <h3>إرسال سريع</h3>
                    <div className={w.payees}>
                      {payees.slice(0, 6).map((p, i) => (
                        <button key={p.id} onClick={() => (setSendTo(p.id), go('send'))}>
                          <i style={{ background: `${payeeColors[i % payeeColors.length]}17`, color: payeeColors[i % payeeColors.length] }}>{p.name[0]}</i>
                          {p.name.split(' ')[0]}
                        </button>
                      ))}
                      <button onClick={() => (setSendTo('new'), go('send'))}>
                        <i style={{ background: 'var(--bg)', color: 'var(--text-muted)', border: '1px dashed var(--border-strong)' }}>
                          <Icon name="plus" />
                        </i>
                        جديد
                      </button>
                    </div>
                  </div>
                  <div className={w.box}>
                    <h3>
                      آخر الحركات <L to="activity">عرض الكل</L>
                    </h3>
                    <div className={s.stagger}>
                      {tx.slice(0, 6).map((t, i) => (
                        <div key={t.id} style={{ '--i': i } as CSSProperties}>
                          <TxRow t={t} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className={s.stack} style={{ gap: 18 }}>
                  {(['SYP', 'USD'] as Cur[]).map((c) => (
                    <L key={c} to="cards">
                      <VCard cur={c} balance={mask(money(balance[c], c))} frozen={cards[c].frozen} />
                    </L>
                  ))}
                  {dueSoon.length > 0 && (
                    <div className={w.box} style={{ borderColor: 'color-mix(in srgb, var(--copper) 45%, transparent)', background: 'color-mix(in srgb, var(--copper) 5%, var(--surface))' }}>
                      <h3>
                        فواتير تستحق قريباً <L to="bills">ادفع</L>
                      </h3>
                      {dueSoon.map((b) => (
                        <div key={b.id} className={s.spread} style={{ padding: '6px 0' }}>
                          <span>{b.name}</span>
                          <Tag t="warn">{daysBetween(t0, b.due) <= 0 ? 'اليوم' : `خلال ${daysBetween(t0, b.due)} يوم`}</Tag>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className={w.box}>
                    <h3>
                      هذا الشهر <L to="budget">الميزانية</L>
                    </h3>
                    <div className={s.spread}>
                      <span style={{ color: 'var(--text-muted)' }}>دخل</span>
                      <b className={`${s.num} ${w.pos}`}>+{fmt(income)}</b>
                    </div>
                    <div className={s.spread} style={{ marginTop: 6 }}>
                      <span style={{ color: 'var(--text-muted)' }}>إنفاق</span>
                      <b className={s.num}>−{fmt(totalSpend)}</b>
                    </div>
                    <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', marginTop: 12, background: 'var(--ornament-soft)' }}>
                      {Object.entries(monthSpend).map(([c, v]) => (
                        <i key={c} style={{ width: `${(v / Math.max(1, totalSpend)) * 100}%`, background: categories[c as Cat].color }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {page === 'send' && (
            <>
              <Top title="إرسال مال" sub="فوري ومجاني بين حسابات صرّاف" back="home" />
              <SendMoney
                key={sendTo ?? 'x'}
                initial={sendTo}
                payees={payees}
                balance={balance}
                frozen={cards}
                onAddPayee={(p) => setPayees((all) => [p, ...all])}
                onSend={(p, amount, cur, note) => {
                  const id = uid();
                  setTx((all) => [{ id, title: note || `تحويل إلى ${p.name}`, amount: -amount, cur, cat: p.cat, at: todayIso() }, ...all]);
                  show(`أُرسل ${money(amount, cur)} إلى ${p.name}`);
                  setSendTo(null);
                  go('tx', id);
                }}
                err={(m) => show(m, 'err')}
              />
            </>
          )}

          {page === 'cards' && (
            <>
              <Top title="بطاقاتي" sub="بطاقة افتراضية لكل عملة، تتحكم بها لحظياً" />
              <div className={s.grid}>
                {(['SYP', 'USD'] as Cur[]).map((c) => {
                  const st = cards[c];
                  const set = (patch: Partial<CardState>) => setCards({ ...cards, [c]: { ...st, ...patch } });
                  return (
                    <div key={c} className={s.stack}>
                      <VCard cur={c} balance={mask(money(balance[c], c))} frozen={st.frozen} />
                      <div className={w.box}>
                        <Setting label="تجميد البطاقة" hint="يوقف كل عمليات الدفع فوراً" on={st.frozen} onChange={(v) => (set({ frozen: v }), show(v ? 'جُمّدت البطاقة' : 'أُعيد تفعيل البطاقة'))} />
                        <Setting label="الدفع عبر الإنترنت" hint="للمتاجر الإلكترونية" on={st.online} onChange={(v) => set({ online: v })} />
                        <label className={s.field} style={{ marginTop: 12 }}>
                          <span>
                            حد الإنفاق الشهري: <b className={s.num}>{money(st.limit, c)}</b>
                          </span>
                          <input type="range" min={c === 'SYP' ? 100_000 : 50} max={c === 'SYP' ? 5_000_000 : 2000} step={c === 'SYP' ? 100_000 : 50} value={st.limit} onChange={(e) => set({ limit: Number(e.target.value) })} style={{ accentColor: 'var(--brand)', direction: 'ltr' }} />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {page === 'activity' && <Activity tx={tx} row={(t) => <TxRow key={t.id} t={t} />} top={<Top title="الحركات" sub={`${tx.length} حركة`} />} />}

          {page === 'tx' &&
            (() => {
              const t = tx.find((x) => x.id === param);
              if (!t) return <Top title="الحركة غير موجودة" back="activity" />;
              return (
                <>
                  <Top title="تفاصيل الحركة" back="activity" />
                  <div className={w.box} style={{ textAlign: 'center', padding: '28px 20px' }}>
                    <span className={w.txIcon} style={{ background: `${categories[t.cat].color}17`, color: categories[t.cat].color, margin: '0 auto 12px', width: 60, height: 60, borderRadius: 18 }}>
                      <Icon name={categories[t.cat].icon} size={24} />
                    </span>
                    <p style={{ color: 'var(--text-muted)' }}>{t.title}</p>
                    <strong className={`${w.balance} ${t.amount > 0 ? w.pos : ''}`} style={{ margin: '6px 0' }}>
                      <span className={s.num}>
                        {t.amount > 0 ? '+' : '−'}
                        {money(Math.abs(t.amount), t.cur)}
                      </span>
                    </strong>
                    <Tag t="ok">مكتملة</Tag>
                  </div>
                  <div className={w.box}>
                    {[
                      ['التاريخ', new Date(t.at).toLocaleDateString('ar-SY-u-nu-latn', { dateStyle: 'full' })],
                      ['التصنيف', categories[t.cat].label],
                      ['البطاقة', t.cur === 'SYP' ? 'بطاقة الليرة •••• 4402' : 'بطاقة الدولار •••• 9017'],
                      ['الرقم المرجعي', refOf(t)],
                      ['ما يعادله بالليرة', `${fmt(Math.abs(toSyp(t)))} ل.س`],
                    ].map(([k, v]) => (
                      <div key={k} className={s.spread} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                        <b>{v}</b>
                      </div>
                    ))}
                    <div className={s.row} style={{ marginTop: 14 }}>
                      <button className={s.btn} onClick={() => show('أُرسل الإيصال إلى بريدك (محاكاة)')}>
                        مشاركة الإيصال
                      </button>
                      <button className={s.btnDanger} onClick={() => show('فُتح بلاغ للدعم بهذه الحركة (محاكاة)')}>
                        الإبلاغ عن مشكلة
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}

          {page === 'bills' && (
            <>
              <Top title="الفواتير" sub="تذكير قبل الاستحقاق ودفع بلمسة" />
              {bills
                .slice()
                .sort((a, b) => a.due.localeCompare(b.due))
                .map((b) => {
                  const paid = isPaid(b);
                  const left = daysBetween(t0, b.due);
                  return (
                    <div key={b.id} className={w.box}>
                      <div className={s.spread}>
                        <div className={s.row} style={{ flexWrap: 'nowrap' }}>
                          <span className={w.txIcon} style={{ background: `${categories.bills.color}17`, color: categories.bills.color }}>
                            <Icon name="receipt" />
                          </span>
                          <div>
                            <b>{b.name}</b>
                            <div className={s.small} style={{ color: 'var(--text-muted)' }}>
                              {b.provider}
                            </div>
                          </div>
                        </div>
                        <b className={s.num}>
                          {fmt(b.amount)} ل.س
                        </b>
                      </div>
                      <div className={s.spread} style={{ marginTop: 12 }}>
                        {paid ? <Tag t="ok">مدفوعة · التالية {shortDate(b.due)}</Tag> : <Tag t={left <= 3 ? 'bad' : 'warn'}>{left <= 0 ? 'مستحقة اليوم' : `تستحق خلال ${left} أيام`}</Tag>}
                        <button className={`${s.btnPrimary} ${s.sm}`} disabled={paid} onClick={() => payBill(b)}>
                          ادفع الآن
                        </button>
                      </div>
                    </div>
                  );
                })}
            </>
          )}

          {page === 'budget' && (
            <>
              <Top title="الميزانية" sub={`${new Date().toLocaleString('ar-SY', { month: 'long' })} · تصنيف تلقائي لكل حركة`} />
              <div className={w.hero}>
                <small>أنفقت هذا الشهر</small>
                <strong className={`${w.balance} ${s.num}`}>{fmt(totalSpend)} ل.س</strong>
                <Bar value={(totalSpend / Object.values(budget).reduce((a, b) => a + b, 0)) * 100} color="var(--copper)" />
              </div>
              <div className={s.grid}>
                {(Object.keys(budget) as (keyof typeof budget)[]).map((c) => {
                  const spent = monthSpend[c] ?? 0;
                  const pct = (spent / budget[c]) * 100;
                  return (
                    <div key={c} className={w.box}>
                      <div className={s.spread}>
                        <div className={s.row} style={{ flexWrap: 'nowrap' }}>
                          <span className={w.txIcon} style={{ background: `${categories[c].color}17`, color: categories[c].color, width: 36, height: 36, borderRadius: 11 }}>
                            <Icon name={categories[c].icon} size={16} />
                          </span>
                          <b>{categories[c].label}</b>
                        </div>
                        {pct > 100 ? <Tag t="bad">تجاوزت</Tag> : pct > 80 ? <Tag t="warn">قاربت</Tag> : null}
                      </div>
                      <div style={{ margin: '12px 0 8px' }}>
                        <Bar value={pct} color={pct > 100 ? 'var(--danger)' : categories[c].color} />
                      </div>
                      <div className={s.spread}>
                        <span className={`${s.small} ${s.num}`}>{fmt(spent)} ل.س</span>
                        <input
                          className={s.input}
                          style={{ width: 120, padding: '0.25rem 0.5rem' }}
                          type="number"
                          min={0}
                          step={10000}
                          aria-label={`حد ${categories[c].label}`}
                          value={budget[c]}
                          onChange={(e) => setBudget({ ...budget, [c]: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>

      <nav className={w.tabbar} aria-label="أقسام المحفظة">
        {nav
          .filter((n) => n.id !== 'budget')
          .map((n) => (
            <L key={n.id} to={n.id}>
              <Icon name={n.icon} size={22} />
              {n.label}
            </L>
          ))}
      </nav>

      {dialog === 'exchange' && (
        <Exchange
          balance={balance}
          onClose={() => setDialog(null)}
          onDone={(from, amount) => {
            const to: Cur = from === 'SYP' ? 'USD' : 'SYP';
            const got = from === 'SYP' ? amount / RATE : amount * RATE;
            setTx((all) => [
              { id: uid(), title: `تصريف إلى ${to === 'USD' ? 'الدولار' : 'الليرة'}`, amount: to === 'USD' ? Math.floor(got * 100) / 100 : Math.floor(got), cur: to, cat: 'other', at: todayIso() },
              { id: uid(), title: `تصريف من ${from === 'USD' ? 'الدولار' : 'الليرة'}`, amount: -amount, cur: from, cat: 'other', at: todayIso() },
              ...all,
            ]);
            setDialog(null);
            show('تم التصريف');
          }}
        />
      )}
      {dialog === 'receive' && (
        <Dialog title="استلام المال" onClose={() => setDialog(null)}>
          <div className={s.stack} style={{ justifyItems: 'center', textAlign: 'center' }}>
            <PseudoQr seed="sarraf-wallet-0944" />
            <p>
              اعرض الرمز للمرسل، أو شارك رقمك: <b className={s.num}>0944 000 321</b>
            </p>
            <button className={s.btn} onClick={() => setDialog(null)}>
              تم
            </button>
          </div>
        </Dialog>
      )}
      <Toast toast={toast} />
    </div>
  );
}

function VCard({ cur, balance, frozen }: { cur: Cur; balance: string; frozen: boolean }) {
  return (
    <div className={`${w.vcard} ${frozen ? w.frozen : ''}`} style={{ background: cur === 'SYP' ? 'linear-gradient(135deg, #0e6b61, #073f39 70%)' : 'linear-gradient(135deg, #c27a4c, #7a3f1f 70%)' }}>
      <div className={s.spread} style={{ position: 'relative', zIndex: 1 }}>
        <b style={{ fontSize: '1.1rem' }}>صرّاف</b>
        <span style={{ opacity: 0.8, fontSize: '0.8rem' }}>{frozen ? '❄ مجمّدة' : cur === 'SYP' ? 'ليرة سورية' : 'دولار أمريكي'}</span>
      </div>
      <div className={w.chip} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className={w.pan}>•••• •••• •••• {cur === 'SYP' ? '4402' : '9017'}</div>
        <div className={s.spread} style={{ marginTop: 6 }}>
          <span style={{ opacity: 0.85 }}>ليلى الحسن</span>
          <b className={s.num}>{balance}</b>
        </div>
      </div>
    </div>
  );
}

function Setting({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={s.spread} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div>
        <b>{label}</b>
        <div className={s.small} style={{ color: 'var(--text-muted)' }}>
          {hint}
        </div>
      </div>
      <button className={w.toggle} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />
    </div>
  );
}

function Activity({ tx, row, top }: { tx: Tx[]; row: (t: Tx) => ReactNode; top: ReactNode }) {
  const [cat, setCat] = useState<Cat | 'all'>('all');
  const [q, setQ] = useState('');
  const list = tx.filter((t) => (cat === 'all' || t.cat === cat) && (!q || t.title.includes(q)));
  const groups = list.reduce<Record<string, Tx[]>>((acc, t) => ((acc[t.at] ??= []).push(t), acc), {});
  return (
    <>
      {top}
      <input className={s.input} placeholder="ابحث في الحركات…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minHeight: 46, borderRadius: 14 }} />
      <div className={w.chips}>
        <button aria-pressed={cat === 'all'} onClick={() => setCat('all')}>
          الكل
        </button>
        {(Object.keys(categories) as Cat[]).map((c) => (
          <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>
            {categories[c].label}
          </button>
        ))}
      </div>
      {Object.keys(groups).length === 0 && <p className={s.empty}>لا حركات مطابقة.</p>}
      {Object.entries(groups)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([day, items]) => (
          <div key={day} className={w.box}>
            <h3 style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(day).toLocaleDateString('ar-SY-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
            {items.map(row)}
          </div>
        ))}
    </>
  );
}

function SendMoney({
  initial,
  payees,
  balance,
  frozen,
  onSend,
  onAddPayee,
  err,
}: {
  initial: string | null;
  payees: Payee[];
  balance: Record<Cur, number>;
  frozen: Record<Cur, CardState>;
  onSend: (p: Payee, amount: number, cur: Cur, note: string) => void;
  onAddPayee: (p: Payee) => void;
  err: (m: string) => void;
}) {
  const [payeeId, setPayeeId] = useState(initial ?? payees[0]?.id ?? '');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [cur, setCur] = useState<Cur>('SYP');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState<{ code: string; typed: string } | null>(null);
  const isNew = payeeId === 'new';
  const value = Number(amount);
  const phoneOk = /^09\d{8}$/.test(phone.replace(/\s/g, ''));
  const large = (cur === 'SYP' ? value : value * RATE) >= LARGE_SYP;

  const resolvePayee = (): Payee | null => {
    if (!isNew) return payees.find((p) => p.id === payeeId) ?? null;
    if (!phoneOk || name.trim().length < 2) return null;
    return { id: uid(), name: name.trim(), phone: phone.replace(/\s/g, ''), cat: 'other' };
  };
  const finish = () => {
    const p = resolvePayee()!;
    if (isNew) onAddPayee(p);
    onSend(p, value, cur, note.trim());
  };
  const submit = () => {
    const p = resolvePayee();
    if (!p) return err(isNew ? 'أدخل اسماً ورقم هاتف سورياً صحيحاً يبدأ بـ09' : 'اختر مستفيداً');
    if (frozen[cur].frozen) return err('بطاقة هذه العملة مجمّدة — فعّلها من «البطاقات»');
    if (!(value > 0)) return err('أدخل مبلغاً صحيحاً');
    if (value > balance[cur]) return err(`الرصيد غير كافٍ: المتاح ${money(balance[cur], cur)}`);
    if (large) return setConfirming({ code: String(1000 + Math.floor(Math.random() * 9000)), typed: '' });
    finish();
  };

  return (
    <div className={w.split}>
      <form
        className={`${w.box} ${s.stack}`}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className={s.segmented} style={{ alignSelf: 'center' }}>
          {(['SYP', 'USD'] as Cur[]).map((c) => (
            <button type="button" key={c} aria-pressed={cur === c} onClick={() => setCur(c)}>
              {c === 'SYP' ? 'ليرة' : 'دولار'}
            </button>
          ))}
        </div>
        <input className={w.amountInput} inputMode="decimal" placeholder={cur === 'USD' ? '$0' : '0'} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} aria-label="المبلغ" autoFocus />
        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          المتاح <span className={s.num}>{money(balance[cur], cur)}</span>
          {large && ' · سيُطلب رمز تأكيد'}
        </p>
        <label className={s.field}>
          <span>ملاحظة (اختياري)</span>
          <input className={s.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً: إيجار الشهر" />
        </label>
        <button className={s.btnPrimary} style={{ padding: '0.85rem' }}>
          متابعة
        </button>
      </form>
      <div className={w.box}>
        <h3>إلى</h3>
        <div className={s.stack} style={{ gap: 6 }}>
          {payees.map((p, i) => (
            <button
              type="button"
              key={p.id}
              onClick={() => setPayeeId(p.id)}
              className={w.tx}
              style={{ border: payeeId === p.id ? '1px solid var(--brand)' : '1px solid transparent', background: payeeId === p.id ? 'var(--bg)' : 'none', textAlign: 'start', width: '100%', marginInline: 0, font: 'inherit' }}
            >
              <span className={w.txIcon} style={{ background: `${payeeColors[i % payeeColors.length]}17`, color: payeeColors[i % payeeColors.length], borderRadius: '50%', fontWeight: 700 }}>
                {p.name[0]}
              </span>
              <span className={s.grow}>
                <b>{p.name}</b>
                <span className={`${s.small} ${s.num}`} style={{ display: 'block', color: 'var(--text-muted)', textAlign: 'right' }}>
                  {p.phone}
                </span>
              </span>
            </button>
          ))}
          <button type="button" className={`${isNew ? s.btnPrimary : s.btn}`} onClick={() => setPayeeId('new')}>
            + مستفيد جديد
          </button>
          {isNew && (
            <div className={s.stack}>
              <input className={s.input} placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} />
              <input className={s.input} dir="ltr" inputMode="tel" placeholder="09XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          )}
        </div>
      </div>
      {confirming && (
        <Dialog title="تأكيد التحويل" onClose={() => setConfirming(null)}>
          <form
            className={s.stack}
            onSubmit={(e) => {
              e.preventDefault();
              if (confirming.typed !== confirming.code) return err('الرمز غير صحيح');
              setConfirming(null);
              finish();
            }}
          >
            <p>
              تحويل <b className={s.num}>{money(value, cur)}</b> إلى <b>{resolvePayee()?.name}</b>.
            </p>
            <p className={s.small} style={{ color: 'var(--text-muted)' }}>
              في التطبيق الحقيقي يصل الرمز برسالة نصية. رمز هذا النموذج: <b className={s.num}>{confirming.code}</b>
            </p>
            <input className={s.input} dir="ltr" inputMode="numeric" maxLength={4} placeholder="••••" value={confirming.typed} onChange={(e) => setConfirming({ ...confirming, typed: e.target.value.replace(/\D/g, '') })} />
            <button className={s.btnPrimary} disabled={confirming.typed.length !== 4}>
              تأكيد وإرسال
            </button>
          </form>
        </Dialog>
      )}
    </div>
  );
}

function Exchange({ balance, onClose, onDone }: { balance: Record<Cur, number>; onClose: () => void; onDone: (from: Cur, amount: number) => void }) {
  const [from, setFrom] = useState<Cur>('USD');
  const [amount, setAmount] = useState('');
  const v = Number(amount);
  const got = from === 'SYP' ? v / RATE : v * RATE;
  const ok = v > 0 && v <= balance[from];
  return (
    <Dialog title="تصريف العملات" onClose={onClose}>
      <div className={s.stack}>
        <div className={s.segmented}>
          <button aria-pressed={from === 'USD'} onClick={() => setFrom('USD')}>
            دولار ← ليرة
          </button>
          <button aria-pressed={from === 'SYP'} onClick={() => setFrom('SYP')}>
            ليرة ← دولار
          </button>
        </div>
        <label className={s.field}>
          <span>
            المبلغ ({curLabel[from]}) — المتاح {money(balance[from], from)}
          </span>
          <input className={s.input} dir="ltr" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <p style={{ color: 'var(--text-muted)' }}>
          السعر التجريبي: <span className={s.num}>1$ = {fmt(RATE)} ل.س</span>
        </p>
        <p>
          ستحصل على: <b className={s.num}>{v > 0 ? money(got, from === 'SYP' ? 'USD' : 'SYP') : '—'}</b>
        </p>
        {v > balance[from] && <Tag t="bad">الرصيد غير كافٍ</Tag>}
        <button className={s.btnPrimary} disabled={!ok} onClick={() => onDone(from, v)}>
          تصريف
        </button>
      </div>
    </Dialog>
  );
}

function PseudoQr({ seed }: { seed: string }) {
  let h = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const n = 21;
  const cells: [number, number][] = [];
  const finder = (x: number, y: number) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      h = (h * 1103515245 + 12345) >>> 0;
      if (!finder(x, y) && h % 100 < 48) cells.push([x, y]);
    }
  const eye = (x: number, y: number) => (
    <g key={`${x}${y}`}>
      <rect x={x} y={y} width={7} height={7} fill="#0b0b0f" />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="#fff" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="#0b0b0f" />
    </g>
  );
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} width={190} height={190} style={{ background: '#fff', borderRadius: 16 }} role="img" aria-label="رمز الاستلام">
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#0b0b0f" />
      ))}
      {eye(0, 0)}
      {eye(n - 7, 0)}
      {eye(0, n - 7)}
    </svg>
  );
}
