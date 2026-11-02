// Calendar and date windows, all in ET. Dates are civil 'YYYY-MM-DD' strings;
// windows are [startIso, endIso] with the ET offset for that moment, ready for COQL.

export const TZ = 'America/New_York';
export const FAR_FUTURE = '2099-12-31T23:59:59-05:00';

const pad = n => String(n).padStart(2, '0');
const split = s => s.split('-').map(Number);
const utc = s => { const [y, m, d] = split(s); return new Date(Date.UTC(y, m - 1, d)); };
const fromUtc = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export const addDays = (s, n) => { const d = utc(s); d.setUTCDate(d.getUTCDate() + n); return fromUtc(d); };
export const dow = s => utc(s).getUTCDay();
const NONE = new Set();
export const isWorkingDay = (s, holidays = NONE) => { const w = dow(s); return w >= 1 && w <= 5 && !holidays.has(s); };
export const monthStartOf = s => s.slice(0, 8) + '01';
export const monthEndOf = s => { const [y, m] = split(s); return fromUtc(new Date(Date.UTC(y, m, 0))); };
export const addMonths = (s, n) => {
  const [y, m, d] = split(s);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return fromUtc(new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))));
};

export function workingDaysBetween(a, b, holidays = NONE) {
  const out = [];
  for (let s = a; s <= b; s = addDays(s, 1)) if (isWorkingDay(s, holidays)) out.push(s);
  return out;
}

// The civil date of an instant in the given zone.
export function dateIn(instant, tz = TZ) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(instant instanceof Date ? instant : new Date(instant));
  const get = t => p.find(x => x.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// Offset like '-04:00' in effect at the given local hour of a civil date.
// Probes from an EST guess, which is close enough on both sides of a DST change.
export function offsetAt(s, hour, tz = TZ) {
  const [y, m, d] = split(s);
  const probe = new Date(Date.UTC(y, m - 1, d, hour + 5, 30));
  const name = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
    .formatToParts(probe).find(x => x.type === 'timeZoneName').value;
  const mm = /GMT([+-]\d{2}):?(\d{2})?/.exec(name);
  return mm ? `${mm[1]}:${mm[2] || '00'}` : '+00:00';
}

export const dayStart = (s, tz = TZ) => `${s}T00:00:00${offsetAt(s, 0, tz)}`;
export const dayEnd = (s, tz = TZ) => `${s}T23:59:59${offsetAt(s, 23, tz)}`;
export const window = (a, b, tz = TZ) => [dayStart(a, tz), dayEnd(b, tz)];

export function previousWorkingDay(s, holidays = NONE) {
  let d = addDays(s, -1);
  while (!isWorkingDay(d, holidays)) d = addDays(d, -1);
  return d;
}

// Start and end dates for the admin page's When buttons. Week is Monday to Friday.
export function periodDates(period, today) {
  if (period === 'week') { const mon = addDays(today, -((dow(today) + 6) % 7)); return [mon, addDays(mon, 4)]; }
  if (period === 'month') return [monthStartOf(today), monthEndOf(today)];
  return [today, today];
}

const monthLabel = s => utc(s).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortLabel = s => utc(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export function buildCalendar(now = new Date(), tz = TZ, holidays = NONE) {
  const today = dateIn(now, tz);
  const yesterday = previousWorkingDay(today, holidays);
  const weekStart = addDays(today, -((dow(today) + 6) % 7));
  const monthStart = monthStartOf(today);
  const monthEnd = monthEndOf(today);
  const month = k => { const st = addMonths(monthStart, -k); return { start: st, end: monthEndOf(st) }; };
  const months = { m1: month(1), m2: month(2), m3: month(3) };
  const wdb = (a, b) => workingDaysBetween(a, b, holidays);
  const monthWorkingDays = today >= monthStart ? wdb(monthStart, today) : [];
  const w = (a, b) => window(a, b, tz);
  return {
    tz, holidays, today, yesterday, weekStart, monthStart, monthEnd, months, monthWorkingDays,
    workingDays: {
      monthTotal: wdb(monthStart, monthEnd).length,
      monthElapsed: monthWorkingDays.length,
      weekElapsed: wdb(weekStart, today).length,
      lastMonthTotal: wdb(months.m1.start, months.m1.end).length,
    },
    daysThru: yesterday >= monthStart ? wdb(monthStart, yesterday).length : 0,
    labels: { month: monthLabel(monthStart), week: `Week of ${shortLabel(weekStart)}`, lastMonth: monthLabel(months.m1.start) },
    win: {
      tdy: w(today, today),
      ydy: w(yesterday, yesterday),
      wtd: w(weekStart, today),
      wtdOpen: [dayStart(weekStart, tz), FAR_FUTURE],
      mtd: w(monthStart, today),
      mtdOpen: w(monthStart, monthEnd),
      m1: w(months.m1.start, months.m1.end),
      m2: w(months.m2.start, months.m2.end),
      m3: w(months.m3.start, months.m3.end),
      created7: [dayStart(addMonths(today, -7), tz), dayEnd(today, tz)],
    },
  };
}
