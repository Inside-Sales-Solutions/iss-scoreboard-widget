// Competition standings over each competition's own dates, in the shape Aidan's page renders.

import { monthEndOf, monthStartOf, window, workingDaysBetween } from './dates.js';
import { KPIS, scoreKpis, divOf, repTargets } from './scoring.js';

const DIVS = { BDR: 'BDR Division', P4P: 'P4P Division', Training: 'Training' };

export function statusOf(def, today) {
  return today < def.start ? 'upcoming' : today > def.end ? 'ended' : 'live';
}

// One rep's competition value and per-KPI [actual, target] pairs.
export function repValue(def, r, m, days, cfg) {
  const act = k => m?.[k.key] || 0;
  if (def.metric === 'score') {
    const keys = KPIS.filter(k => (cfg.weights[k.key] || 0) > 0).map(k => k.key);
    const { rows, score } = scoreKpis(r, days, cfg, act, keys);
    return { value: score, actual: null, kpis: Object.fromEntries(rows.map(k => [k.key, [k.actual, k.target || 0]])) };
  }
  const metrics = def.metrics || [def.metric];
  const kpis = {}, pcts = [];
  let total = 0;
  for (const key of metrics) {
    const { rows } = scoreKpis(r, days, cfg, act, [key]);
    const a = rows[0]?.actual || 0;
    const g = def.scoring === 'raw' ? 0 : def.scoring === 'fixed' ? (def.fixedTargets?.[key] ?? def.fixedTarget ?? 0) : (rows[0]?.target || 0);
    kpis[key] = [a, g];
    total += a;
    if (def.scoring !== 'raw') pcts.push(g ? (def.scoring === 'fixed' ? a / g : Math.min(a / g, cfg.cap)) * 100 : 0);
  }
  const value = def.scoring === 'raw' ? total : pcts.reduce((s, p) => s + p, 0) / (pcts.length || 1);
  return { value, actual: metrics.length === 1 ? total : null, kpis };
}

function participants(def, reps) {
  const byId = Object.fromEntries(reps.map(r => [r.id, r]));
  if (def.format === 'teams') return (def.teams || []).map(t => ({ name: t.name, members: (t.members || []).map(id => byId[String(id)]).filter(Boolean) }));
  if (def.format === 'division') return Object.entries(DIVS).map(([name, team]) => ({ name, members: reps.filter(r => r.team === team) }));
  if (def.who === 'Picked') return (def.members || []).map(id => byId[String(id)]).filter(Boolean);
  return reps.filter(r => !def.who || def.who === 'All' || r.team === def.who);
}

export function buildComps(defs, fetchWindow, cal, cfg, reps) {
  return Promise.all(defs.map(def => buildComp(def, fetchWindow, cal, cfg, reps)));
}

async function buildComp(def, fetchWindow, cal, cfg, reps) {
  const status = statusOf(def, cal.today);
  const base = { ...def, status, standings: [], hasData: false, days: 0, weights: def.metric === 'score' ? cfg.weights : {}, cap: cfg.cap };
  if (status === 'upcoming') return base;
  const end = def.end < cal.today ? def.end : cal.today;
  const days = workingDaysBetween(def.start, end).length;
  const m = await fetchWindow(window(def.start, end, cal.tz));
  // Targets use the working days of the competition's own month, as Aidan's page did.
  const ms = monthStartOf(def.start);
  const monthTotal = workingDaysBetween(ms, monthEndOf(ms)).length;
  const c = { ...cfg, workingDays: { ...cfg.workingDays, monthTotal } };
  const member = r => ({ name: r.name, level: r.level, div: divOf(r.team), team: null,
    ...repValue(def, { ...r, targets: repTargets(r.level, c, monthTotal) }, m[r.id], days, c) });
  let standings;
  if (def.format === 'teams' || def.format === 'division') {
    standings = participants(def, reps).map(t => {
      const members = t.members.map(member).sort((a, b) => b.value - a.value);
      const sum = members.reduce((s, x) => s + x.value, 0);
      return { name: t.name, value: def.teamCalc === 'sum' ? sum : sum / (members.length || 1), n: members.length, members };
    });
  } else standings = participants(def, reps).map(member);
  standings.sort((a, b) => b.value - a.value);
  return { ...base, standings, hasData: true, days };
}
