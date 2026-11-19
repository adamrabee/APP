// Local-date helpers. All "date" columns are local YYYY-MM-DD strings.

export const pad = (n: number) => String(n).padStart(2, '0');

export function ymd(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function diffDays(a: string, b: string): number {
  // a - b in whole days
  return Math.round((parseYmd(a).getTime() - parseYmd(b).getTime()) / 86400000);
}

export const today = () => ymd();

/** Week starts on Saturday (Saudi week). Returns the Saturday on/before the date. */
export function weekStart(s: string = today()): string {
  const d = parseYmd(s);
  const back = (d.getDay() + 1) % 7; // Sat=6 -> 0
  return addDays(s, -back);
}

export function monthStart(s: string = today()): string {
  return s.slice(0, 7) + '-01';
}

export const weekdayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const weekdayShort = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const hijriMonths = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];

export function gregorianLabel(s: string = today()): string {
  const d = parseYmd(s);
  return `${weekdayNames[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

export function shortLabel(s: string): string {
  const d = parseYmd(s);
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

/** Hijri date. Tries the Umm al-Qura calendar via Intl, falls back to the tabular (Kuwaiti) algorithm. */
export function hijriLabel(s: string = today()): string {
  const d = parseYmd(s);
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' })
      .formatToParts(d);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const day = get('day'), month = get('month'), year = get('year');
    if (day && month && year && year > 1300) return `${day} ${hijriMonths[month - 1]} ${year}هـ`;
  } catch {}
  const { day, month, year } = tabularHijri(d);
  return `${day} ${hijriMonths[month - 1]} ${year}هـ`;
}

function tabularHijri(date: Date) {
  const jd = Math.floor(date.getTime() / 86400000 + 2440587.5 + 0.5);
  const l0 = jd - 1948440 + 10632;
  const n = Math.floor((l0 - 1) / 10631);
  const l1 = l0 - 10631 * n + 354;
  const j =
    Math.floor((10985 - l1) / 5316) * Math.floor((50 * l1) / 17719) +
    Math.floor(l1 / 5670) * Math.floor((43 * l1) / 15238);
  const l2 =
    l1 -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const month = Math.floor((24 * l2) / 709);
  const day = l2 - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { day, month, year };
}

export function timeLabel(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const h12 = h % 12 || 12;
  return `${h12}:${pad(m)} ${h < 12 ? 'ص' : 'م'}`;
}

export function durationLabel(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h} س ${m} د`;
  if (h) return `${h} ساعة`;
  return `${m} دقيقة`;
}

export function hhmm(totalMinutes: number): string {
  const m = ((totalMinutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function minutesOf(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Validates loose user input like 2026-11-20. Returns null if invalid. */
export function cleanYmd(input: string): string | null {
  const m = input.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const s = `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;
  return ymd(parseYmd(s)) === s ? s : null;
}
