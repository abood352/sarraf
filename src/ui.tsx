import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import s from './demo.module.css';
import { useCountUp } from './kit';

export { s };

export interface NavItem<T extends string> {
  id: T;
  label: string;
  count?: number;
}

/** تخطيط تطبيق: قائمة جانبية (شريط أفقي على الهاتف) ومحتوى. */
export function AppLayout<T extends string>({
  nav,
  current,
  onNav,
  note,
  children,
}: {
  nav: NavItem<T>[];
  current: T;
  onNav: (id: T) => void;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={s.app}>
      <aside className={s.side}>
        <nav aria-label="أقسام النموذج">
          <ul className={s.nav}>
            {nav.map((n) => (
              <li key={n.id}>
                <button aria-current={current === n.id ? 'page' : undefined} onClick={() => onNav(n.id)}>
                  {n.label}
                  {!!n.count && <span className={s.count}>{n.count}</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        {note && <div className={s.sideNote}>{note}</div>}
      </aside>
      <main className={s.main} key={current}>
        {children}
      </main>
    </div>
  );
}

export function PageHead({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className={s.pageHead}>
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className={s.row}>{children}</div>}
    </header>
  );
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className={`${s.card} ${s.stat}`}>
      <small>{label}</small>
      <strong className={s.num}>{value}</strong>
      {note && <em>{note}</em>}
    </div>
  );
}

export function Toast({ toast }: { toast: { text: string; tone: 'ok' | 'err'; n: number } | null }) {
  if (!toast) return null;
  return (
    <div key={toast.n} className={`${s.toast} ${toast.tone === 'err' ? s.toastErr : ''}`} role="status">
      {toast.text}
    </div>
  );
}

/** نافذة حوار بسيطة: Escape يغلقها والتركيز يدخلها. */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      previous?.focus?.();
    };
  }, [onClose]);
  return (
    <div className={s.dialogBack} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={s.dialog} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function Bar({ value, color }: { value: number; color?: string }) {
  return (
    <div className={s.bar} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

export const tone = { ok: s.ok, warn: s.warn, bad: s.bad, info: s.info } as const;
export type Tone = keyof typeof tone;

export function Tag({ t, children }: { t: Tone; children: ReactNode }) {
  return <span className={`${s.tag} ${tone[t]}`}>{children}</span>;
}

const avatarColors = ['#054239', '#6b1f2a', '#988561', '#428177', '#4a151e', '#3d3a3b'];
export function Avatar({ name }: { name: string }) {
  const code = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <span className={s.avatar} style={{ background: avatarColors[code % avatarColors.length] }} aria-hidden="true">
      {name.trim()[0]}
    </span>
  );
}

/**
 * رابط داخلي حقيقي: النقر العادي ينتقل داخل النموذج، والنقر الأوسط أو Ctrl يفتح الصفحة في تبويب جديد.
 */
export function Link({
  to,
  go,
  children,
  className,
  style,
  current,
}: {
  to: string;
  go: () => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  current?: boolean;
}) {
  return (
    <a
      href={to}
      className={className}
      style={style}
      aria-current={current ? 'page' : undefined}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        go();
      }}
    >
      {children}
    </a>
  );
}

/** رقم متحرك: يعدّ صعوداً ثم يُعرض بالتنسيق المطلوب */
export function CountUp({ value, digits = 0, format }: { value: number; digits?: number; format?: (n: number) => string }) {
  const v = useCountUp(value);
  return <>{format ? format(v) : v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}</>;
}
