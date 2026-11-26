import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * أدوات مشتركة للنماذج التفاعلية.
 * حالة كل نموذج تُحفظ في متصفح الزائر فقط (localStorage) تحت بادئة النموذج،
 * فيعود إليها كما تركها، ويمسحها زر «إعادة البيانات» في رأس النموذج.
 */
const PREFIX = 'pf-demo:';

function read<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* التخزين غير متاح: تبقى الحالة لهذه الجلسة فقط */
  }
}

export function clearDemo(id: string) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${PREFIX}${id}:`)) localStorage.removeItem(key);
    }
  } catch {
    /* لا شيء نمسحه */
  }
}

/** useState محفوظة بين الزيارات. المفتاح بصيغة `<demo>:<name>`. */
export function usePersisted<T>(key: string, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() => {
    const stored = read<T>(key);
    if (stored !== undefined) return stored;
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    write(key, value);
  }, [key, value]);
  return [value, setValue] as const;
}

/** رسالة تأكيد قصيرة تختفي وحدها. */
export function useToast() {
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'err'; n: number } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  const show = useCallback((text: string, tone: 'ok' | 'err' = 'ok') => setToast({ text, tone, n: Date.now() }), []);
  return [toast, show] as const;
}

export const fmt = (n: number, digits = 0) =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const uid = () => Math.random().toString(36).slice(2, 9);

const arMonths = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
export const monthName = (m: number) => arMonths[((m % 12) + 12) % 12];

/** تاريخ قصير بالأرقام اللاتينية واسم الشهر بالعربية */
export function shortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${monthName(d.getMonth())}`;
}

export const todayIso = () => new Date().toISOString().slice(0, 10);

export function addDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

/* ───────── التنقل داخل النموذج: #demo/<id>/<page>/<param> ───────── */
function parse(id: string) {
  const parts = location.hash.replace(/^#demo\//, '').split('/').map(decodeURIComponent);
  return parts[0] === id ? { page: parts[1] || '', param: parts[2] || '' } : { page: '', param: '' };
}

/**
 * صفحات النموذج روابط حقيقية: زر الرجوع والتقدّم يعملان، ويمكن فتح أي صفحة في تبويب جديد.
 * `href(page, param)` للروابط و`go(page, param)` للتنقل من الكود.
 */
export function useRoute<T extends string>(id: string, pages: readonly T[], fallback: T) {
  const [route, setRoute] = useState(() => parse(id));
  useEffect(() => {
    const sync = () => setRoute(parse(id));
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, [id]);
  const page = (pages as readonly string[]).includes(route.page) ? (route.page as T) : fallback;
  const href = useCallback((p: T, param?: string) => `#demo/${id}/${p}${param ? `/${encodeURIComponent(param)}` : ''}`, [id]);
  const go = useCallback(
    (p: T, param?: string) => {
      const next = href(p, param);
      if (location.hash !== next) history.pushState(null, '', next);
      setRoute({ page: p, param: param ?? '' });
      document.querySelector('[data-demo-scroll]')?.scrollTo({ top: 0 });
    },
    [href],
  );
  return { page, param: route.param, go, href };
}

/** عنوان تبويب المتصفح يتبع الصفحة الحالية، كأي موقع حقيقي */
export function useTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** يعدّ الرقم صعوداً عند الظهور، وينتقل بسلاسة إلى أي قيمة جديدة (يحترم تقليل الحركة). */
export function useCountUp(target: number, ms = 900) {
  const [value, setValue] = useState(() => (reduced() ? target : 0));
  const from = useRef(value);
  useEffect(() => {
    if (reduced()) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = a + (target - a) * eased;
      from.current = v;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}
