// Targets and the Activity Score. compute() is Aidan's logic from his scoreboard page,
// moved out of the page so it can be tested and reused by competitions.

export const SFX = p => p === 'week' ? 'wtd' : p === 'today' ? 'tdy' : p === 'lastmonth' ? 'lm' : p === 'custom' ? 'cus' : 'mtd';

export const KPIS = [
  { key: 'points', label: 'Attended points', col: 'p' },
  { key: 'schedPoints', label: 'Scheduled points', col: 'sp' },
  { key: 'scheduled', label: 'Scheduled appointments', col: 'sch' },
  { key: 'attended', label: 'Attended appointments', col: 'att' },
  { key: 'firstEnc', label: 'First encounters', col: 'fe' },
  { key: 'calls', label: 'Calls', col: 'calls' },
  { key: 'senior', label: 'Senior contacts', col: 'sen' },
  { key: 'referrals', label: 'Referrals', col: 'ref' },
].map(k => ({ ...k, act: (r, p) => r[k.col + '_' + SFX(p)] || 0 }));

export const isPts = k => k === 'points' || k === 'schedPoints';
export const levelNum = l => { const m = /(\d+)/.exec(l || ''); return m ? +m[1] : null; };
export const isNHLevel = l => /^NH$/i.test((l || '').trim());
export const divOf = t => t === 'P4P Division' ? 'P4P' : t === 'BDR Division' ? 'BDR' : t === 'Training' ? 'Training' : 'Other';
export const nextLevel = (n, ladder) => { for (const [t, name] of ladder) if (t > (n || 0)) return { t, name }; return null; };
export const levelTitle = (n, ladder) => { let out = ladder[0][1]; for (const [t, name] of ladder) if (n !== null && n >= t) out = name; return out; };

// Monthly attended appointments a rep is expected to hit, from their Payband Milestone.
export function monthlyAttended(level, cfg) {
  if (isNHLevel(level)) return cfg.nhPoints;
  const n = levelNum(level);
  if (n !== null) return Math.max(n, cfg.minAttendedLevel);
  return /BDR/i.test(level || '') ? cfg.minAttendedLevel : null;
}

// Per-day targets. Attended = the level, scheduled a third higher, first encounters and senior two thirds.
export function repTargets(level, cfg, monthTotal) {
  const L = monthlyAttended(level, cfg);
  const dt = cfg.dailyTargets;
  if (L === null || !monthTotal) return { ...dt };
  return {
    calls: dt.calls,
    scheduled: Math.ceil(L * 4 / 3) / monthTotal,
    attended: L / monthTotal,
    firstEnc: Math.ceil(L * 2 / 3) / monthTotal,
    senior: Math.ceil(L * 2 / 3) / monthTotal,
    referrals: dt.referrals,
  };
}

// Score a rep's KPIs over `days` working days against their own pro-rated targets.
// `act(kpi)` returns the actual for a KPI. Shared by the leaderboard and competitions.
export function scoreKpis(r, days, cfg, act, keys = null) {
  // Weights and cap come from the rep's own Board record when it has one.
  const W = r.weights ?? cfg.weights, cap = r.cap ?? cfg.cap, T = cfg.dailyTargets, mt = cfg.workingDays.monthTotal;
  const isNH = isNHLevel(r.level);
  const ln = isNH ? cfg.nhPoints : levelNum(r.level);
  const rows = [];
  let ws = 0, wsum = 0;
  for (const k of KPIS) {
    if (keys && !keys.includes(k.key)) continue;
    const actual = act(k);
    let target;
    if (k.key === 'schedPoints' && r.targets?.schedPoints) target = r.targets.schedPoints * days;
    else if (isPts(k.key)) {
      if (!ln) { rows.push({ ...k, actual, target: null }); continue; }
      target = ln * days / mt;
    } else if (!(r.targets?.[k.key] ?? T[k.key])) { rows.push({ ...k, actual, target: null, noTarget: true }); continue; }
    else target = (r.targets?.[k.key] ?? T[k.key]) * days;
    const att = target > 0 ? Math.min(actual / target, cap) : 0;
    ws += (W[k.key] || 0) * att; wsum += (W[k.key] || 0);
    rows.push({ ...k, actual, target, att });
  }
  return { rows, score: wsum ? ws / wsum * 100 : 0, ln, isNH };
}

export function daysFor(period, wd) {
  return period === 'week' ? wd.weekElapsed : period === 'today' ? 1 : period === 'lastmonth' ? wd.monthTotal : period === 'custom' ? (wd.custom || 0) : wd.monthElapsed;
}

export function computeRep(r, period, cfg) {
  const wd = cfg.workingDays;
  const days = daysFor(period, wd);
  const { rows, score, ln, isNH } = scoreKpis(r, days, cfg, k => k.act(r, period));
  const nxt = isNH ? { t: cfg.nhPoints, name: cfg.ladder.find(l => l[0] === cfg.nhPoints)?.[1] || 'Next level' } : nextLevel(ln, cfg.ladder);
  const objective = wd.monthElapsed ? ((r.days_calls_hit + r.days_sched_hit) / 2) / wd.monthElapsed * 100 : 0;
  const avg3 = (r.p_m3 + r.p_m2 + r.p_m1) / 3;
  return { r, ln, isNH, nxt, rows, score, objective, avg3, div: divOf(r.team) };
}
