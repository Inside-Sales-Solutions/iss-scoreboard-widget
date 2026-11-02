// Daily digest, in the shape Aidan's page renders. Aidan's generator isn't available, so these
// rules are reconstructed from his page copy and the 2026-10-30 snapshot.

import { computeRep } from './scoring.js';

const DIVISIONS = ['BDR Division', 'P4P Division', 'Training'];
const round1 = n => Math.round(n * 10) / 10;

// Month-to-date pace on scheduled + attended appointments, as a whole percent (100 = on target).
export function pace(r, days, sch, att) {
  const parts = [];
  if (r.targets.scheduled > 0) parts.push(sch / (r.targets.scheduled * days));
  if (r.targets.attended > 0) parts.push(att / (r.targets.attended * days));
  return days > 0 && parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length * 100) : 0;
}

function stars(reps) {
  return DIVISIONS.map(division => {
    const g = reps.filter(r => r.team === division);
    const card = (label, col) => ({
      label,
      total: g.reduce((s, r) => s + (r[col] || 0), 0),
      top: g.filter(r => r[col] > 0).sort((a, b) => b[col] - a[col]).slice(0, 3).map(r => ({ name: r.name, level: r.level, v: r[col] })),
    });
    return { division, cards: { scheduled: card('Scheduled appointments', 'sch_ydy'), attended: card('Attended appointments', 'att_ydy'), schedPoints: card('Scheduled points', 'sp_ydy') } };
  });
}

export function buildDigest(reps, cal, cfg, comps = []) {
  const wd = cfg.workingDays;
  const inMonth = cal.yesterday >= cal.monthStart;
  const daysThru = cal.daysThru;
  const out = { date: cal.today, yesterday: cal.yesterday, inMonth, daysThru, stars: stars(reps), movers: [], behind: [], behindOthers: 0, promo: [] };

  if (inMonth && daysThru) {
    const left = Math.max(1, wd.monthTotal - daysThru);
    for (const r of reps) {
      const sch = r.sch_mtd - r.sch_tdy, att = r.att_mtd - r.att_tdy;
      const to = pace(r, daysThru, sch, att);
      const from = daysThru > 1 ? pace(r, daysThru - 1, sch - r.sch_ydy, att - r.att_ydy) : 0;
      if (to > from) out.movers.push({ name: r.name, level: r.level, from, to, ydy: `${r.sch_ydy} booked, ${r.att_ydy} attended yesterday` });
      if (to >= 50 && to < 70) {
        const schedLeft = Math.max(0, Math.ceil(r.targets.scheduled * wd.monthTotal - sch));
        const attLeft = Math.max(0, Math.ceil(r.targets.attended * wd.monthTotal - att));
        out.behind.push({ name: r.name, level: r.level, pace: to, schedLeft, attLeft, schedPerDay: round1(schedLeft / left) });
      } else if (to < 50) out.behindOthers++;
    }
    out.movers.sort((a, b) => (b.to - b.from) - (a.to - a.from));
    out.movers = out.movers.slice(0, 8);
    out.behind.sort((a, b) => b.pace - a.pace);

    for (const r of reps) {
      const x = computeRep(r, 'month', cfg);
      if (!x.nxt) continue;
      const goal = x.nxt.t * 3, have = r.p_m2 + r.p_m1 + r.p_mtd;
      const need = Math.max(0, round1(goal - have));
      const projected = r.p_m2 + r.p_m1 + (wd.monthElapsed ? r.p_mtd / wd.monthElapsed * wd.monthTotal : 0);
      if (need <= 0) out.promo.push({ name: r.name, level: r.level, next: x.nxt.name, nextPts: x.nxt.t, need: 0, status: 'There already' });
      else if (projected >= goal) out.promo.push({ name: r.name, level: r.level, next: x.nxt.name, nextPts: x.nxt.t, need, status: 'On course' });
    }
    out.promo.sort((a, b) => a.need - b.need);
    out.promo = out.promo.slice(0, 6);
  }

  out.comps = comps.filter(c => c.status === 'live' && c.standings.length).map(c => {
    const [a, b] = c.standings;
    return { name: c.name, leader: a.name, value: round1(a.value), second: b?.name, gap: b ? round1(a.value - b.value) : 0,
      pct: c.metric === 'score' || c.scoring !== 'raw', end: c.end, prize: c.prize || '' };
  });
  return out;
}
