// Aidan's scoreboard rendering, ported from his page. It reads the same DATA shape;
// the main differences are live data, empty states for the 1st and weekends, and a re-render entry point.

import { KPIS, SFX, isPts, computeRep, levelTitle } from './scoring.js';

let DATA = null, C = null, W = null, active = [];
const state = { period: 'month', div: 'BDR', open: null, raceAll: false, periodChosen: false };
const view = { v: location.hash === '#competitions' ? 'comps' : location.hash === '#digest' ? 'digest' : 'board' };

const fmt = n => Math.round(n).toLocaleString('en-US');
const fmt1 = n => (Math.round(n * 10) / 10).toLocaleString('en-US');
const status = a => a >= 1 ? ['ok', 'On pace'] : a >= 0.7 ? ['warn', 'Close'] : ['bad', 'Behind'];
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const $ = id => document.getElementById(id);
const compute = (r, p) => computeRep(r, p, C);

function bar(frac, marker) {
  const b = el('div', 'bar'); const i = el('i'); i.style.width = Math.max(0, Math.min(frac, 1)) * 100 + '%'; b.append(i);
  if (marker !== undefined) { const u = el('u'); u.style.left = (marker * 100) + '%'; b.append(u); }
  return b;
}
function showTip(e, text) {
  const tip = $('tip'); tip.textContent = text; tip.hidden = false;
  tip.style.left = Math.min(e.clientX + 12, window.innerWidth - tip.offsetWidth - 8) + 'px'; tip.style.top = (e.clientY + 14) + 'px';
}
const hideTip = () => { $('tip').hidden = true; };

export function setData(d) {
  DATA = d; C = d.config; W = C.weights;
  active = DATA.reps.filter(r => r.calls_mtd > 0 || r.sch_mtd > 0 || r.att_mtd > 0 || r.calls_lm > 0 || r.sch_lm > 0 || r.att_lm > 0);
  // Before the month's first working day there is nothing to score yet, so open on last month.
  if (!state.periodChosen) state.period = C.workingDays.monthElapsed === 0 ? 'lastmonth' : 'month';
  render();
}

function notices(P) {
  const box = $('notice'); box.textContent = '';
  const add = (pill, text) => { const n = el('div', 'notice'); if (pill) n.append(el('span', 'pill', pill)); n.append(el('span', null, text)); box.append(n); };
  if (C.placeholderTargets) add('Draft', "Targets follow each rep's Payband Milestone: attended appointments a month = the level number (NH 8, Hit 8 and BDR 12), and scheduled is a third higher to allow for the usual 25% drop-off. Calls are the same at every level.");
  const wd = C.workingDays, cal = DATA.calendar;
  if (P === 'month' && wd.monthElapsed === 0) add('No data yet', `${C.monthLabel} hasn't had a working day yet. Last month shows ${C.lastMonthLabel}'s final standings.`);
  if (P === 'today' && cal && !isWeekday(cal.today)) add('Weekend', "Today isn't a working day, so today's numbers are scored against one day's targets and will mostly be zero.");
  box.className = box.childElementCount ? 'notices' : '';
}
const isWeekday = s => { const d = new Date(s + 'T12:00:00Z').getUTCDay(); return d >= 1 && d <= 5; };

function render() {
  if (!DATA) return;
  const P = state.period;
  for (const [id, p] of [['p-today', 'today'], ['p-week', 'week'], ['p-month', 'month'], ['p-lastmonth', 'lastmonth']]) $(id).setAttribute('aria-pressed', P === p);
  const asOf = new Date(DATA.asOf);
  $('sub').textContent = P === 'lastmonth' ? `${C.lastMonthLabel || 'Last month'} final standings` : `${P === 'week' ? C.weekLabel : P === 'today' ? 'Today' : C.monthLabel} so far`;
  $('asof').textContent = `Live from Zoho CRM · loaded ${asOf.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
  notices(P);

  const all = active.map(r => compute(r, P)).sort((a, b) => b.score - a.score);
  renderTiles(all, P);
  renderComps();
  renderDigest();

  const pod = $('podium'); pod.textContent = '';
  all.slice(0, 3).forEach((x, i) => {
    const c = el('div', 'pod');
    c.append(el('div', 'rk', String(i + 1)), el('div', 'nm', x.r.name), el('div', 'sc', fmt(x.score)), el('div', 'meta', `${x.div} · ${x.r.level}`)); pod.append(c);
  });
  if (!all.length) pod.append(el('div', 'panel empty', 'No activity logged for this period yet.'));

  const chips = $('chips'); chips.textContent = '';
  for (const d of ['BDR', 'P4P', 'Training', 'All', 'Other']) {
    const b = el('button', 'chip', d); b.type = 'button'; b.setAttribute('aria-pressed', state.div === d);
    b.onclick = () => { state.div = d; state.open = null; render(); }; chips.append(b);
  }

  const list = all.filter(x => state.div === 'All' || x.div === state.div);
  renderLeaderboard(list, P);
  renderRace(list);
  renderDivisions(all);
  renderHow();
  const s = DATA.stats;
  $('stats').textContent = s ? `Loaded with ${s.queries} CRM queries in ${(s.ms / 1000).toFixed(1)}s · ${s.rows ?? '?'} rows · ${s.users ?? '?'} users, ${s.boardReps ?? '?'} on the board, ${s.activeReps ?? '?'} active.` : '';
}

const ICON = {
  'Scheduled appts': '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
  'Attended appts': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  'Attended points': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  'Scheduled points': '<path d="M12 2l3 6.5 7 .9-5 4.8 1.2 7L12 18l-6.2 3.2 1.2-7-5-4.8 7-.9z"/>',
  Calls: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  'Active reps': '<path d="M3 3v18h18"/><path d="M7 16v-4M12 16V8M17 16v-7"/>',
};
const TC = { 'Scheduled appts': 'var(--accent)', 'Attended appts': 'var(--ok)', 'Attended points': 'var(--purple)', 'Scheduled points': 'var(--brand)', Calls: 'var(--gold)', 'Active reps': 'var(--teal)' };

function renderTiles(all, P) {
  const sum = f => all.reduce((s, x) => s + f(x.r), 0);
  const sx = SFX(P);
  const tiles = $('tiles'); tiles.textContent = '';
  const tdata = [['Scheduled appts', sum(r => r['sch_' + sx])], ['Attended appts', sum(r => r['att_' + sx])], ['Scheduled points', sum(r => r['sp_' + sx])],
    ['Attended points', sum(r => r['p_' + sx])], ['Calls', sum(r => r['calls_' + sx])], ['Active reps', all.length]];
  for (const [k, v] of tdata) {
    const t = el('div', 'tile'); t.style.setProperty('--c', TC[k]);
    const hd = el('div', 'hd'), ic = el('div', 'ic');
    ic.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;
    hd.append(ic, el('div', 'k', k.toUpperCase())); t.append(hd, el('div', 'v', /points/i.test(k) ? fmt1(v) : fmt(v))); tiles.append(t);
  }
}

function renderLeaderboard(list, P) {
  const tb = document.querySelector('#lb tbody'); tb.textContent = '';
  list.forEach((x, i) => {
    const r = x.r, tr = el('tr', 'row' + (i < 3 ? ' top' : '')); tr.tabIndex = 0; tr.setAttribute('aria-expanded', state.open === r.id);
    const pts = x.rows[0];
    tr.append(el('td', 'rank l', String(i + 1)));
    const n = el('td', 'name l', r.name); n.append(el('small', null, x.div)); tr.append(n);
    const lv = el('td', 'l'); lv.append(el('span', 'lvl', r.level || '—')); tr.append(lv);
    const sc = el('td'); const sw = el('div', 'score'); sw.append(bar(x.score / 150, 100 / 150), el('b', null, fmt(x.score))); sc.append(sw); tr.append(sc);
    const pt = el('td'); pt.append(document.createTextNode(fmt1(pts.actual)));
    if ((P === 'month' || P === 'lastmonth') && x.ln) pt.append(el('span', 'frac', ' / ' + fmt1(x.ln))); tr.append(pt);
    const v = k => x.rows.find(q => q.key === k).actual;
    tr.append(el('td', null, fmt1(v('schedPoints'))), el('td', null, fmt(v('scheduled'))), el('td', null, fmt(v('attended'))), el('td', null, fmt(v('firstEnc'))),
      el('td', null, fmt(v('calls'))), el('td', null, fmt1((r['talk_' + SFX(P)] || 0) / 3600) + 'h'),
      el('td', null, fmt(v('senior'))), el('td', null, fmt(v('referrals'))));
    const toggle = () => { state.open = state.open === r.id ? null : r.id; render(); };
    tr.onclick = toggle; tr.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } };
    tb.append(tr);
    if (state.open === r.id) { const d = el('tr', 'detail'); const td = el('td'); td.colSpan = 13; td.append(scorecard(x, P)); d.append(td); tb.append(d); }
  });
  if (!list.length) { const tr = el('tr'); const td = el('td', 'l', 'No active reps in this division yet.'); td.colSpan = 13; tr.append(td); tb.append(tr); }
}

function renderRace(list) {
  const race = $('race'); race.textContent = '';
  const racers = list.filter(x => x.div !== 'Other').map(x => ({ x, nxt: x.nxt })).filter(o => o.nxt)
    .sort((a, b) => b.x.avg3 / b.nxt.t - a.x.avg3 / a.nxt.t);
  for (const { x, nxt } of (state.raceAll ? racers : racers.slice(0, 15))) {
    const row = el('div', 'rr'); const t = el('div', 't'); const i = el('i'); i.style.width = Math.min(x.avg3 / nxt.t, 1) * 100 + '%'; t.append(i);
    if (x.ln && !x.isNH) { const u = el('u'); u.style.left = Math.min(x.ln / nxt.t, 1) * 100 + '%'; t.append(u); }
    const need = Math.max(0, nxt.t * 3 - (x.r.p_m2 + x.r.p_m1 + x.r.p_mtd));
    const msg = `${x.r.name}: ${fmt1(x.avg3)} average over the last 3 full months. Next: ${nxt.name} at ${nxt.t}. ${need > 0 ? `${fmt1(need)} more points this month gets there.` : "This month's points already get there."}`;
    t.onmousemove = e => showTip(e, msg); t.onmouseleave = hideTip;
    row.append(el('div', 'n', x.r.name), t, el('div', 'x', `${fmt1(x.avg3)} → ${nxt.t}`)); race.append(row);
  }
  if (!racers.length) race.append(el('div', 'how', 'No reps with a promotion ladder in this view.'));
  if (racers.length > 15) {
    const b = el('button', 'chip', state.raceAll ? 'Show top 15' : `Show all ${racers.length}`); b.type = 'button';
    b.onclick = () => { state.raceAll = !state.raceAll; render(); }; race.append(b);
  }
}

function renderDivisions(all) {
  const dv = $('divs'); dv.textContent = '';
  for (const d of ['P4P', 'BDR', 'Training', 'Other']) {
    const g = all.filter(x => x.div === d); if (!g.length) continue;
    const avg = g.reduce((s, x) => s + x.score, 0) / g.length;
    const row = el('div', 'dv'); const lab = el('div', null, d); lab.append(el('small', null, `${g.length} reps`));
    const t = el('div', 't'); const i = el('i'); i.style.width = Math.min(avg / 150, 1) * 100 + '%'; const u = el('u'); u.style.left = (100 / 150 * 100) + '%'; t.append(i, u);
    t.onmousemove = e => showTip(e, `${d}: average Activity Score ${fmt(avg)} across ${g.length} reps`); t.onmouseleave = hideTip;
    row.append(lab, t, el('b', null, fmt(avg))); dv.append(row);
  }
}

function renderHow() {
  const how = $('how'); how.textContent = '';
  [
    `Activity Score: for each KPI, actual ÷ target (capped at ${C.cap * 100}%), weighted (${KPIS.filter(k => W[k.key] > 0).map(k => `${k.label} ${W[k.key]}`).join(', ')}). KPIs with a weight of 0 are shown but not scored. 100 = on pace. Targets scale with working days so far.`,
    `Attended points target = promotion level (e.g. Avg 24 = 24 points a month). On the leaderboard, This month shows that full monthly number all month; the Activity Score still measures it against pace. Levels come from Zoho and never go down; promotion uses the average of the last 3 completed months. Promotion points count Attended, Reschedule-ABD and Cancelled-ISS meetings by meeting date. New hires (NH) have a points target of 8; their next level is Sales Development Representative at 8. Plain BDR level has no points target, so points are left out of their score. Scheduled points = the points value of every meeting booked, on the day it was booked, except those now Cancelled; its target is the same as the Attended points target unless a manager sets one.`,
    'Attended appointments = Attended, Reschedule-ABD or Cancelled-ISS, on the meeting date. Scheduled appointments = every meeting booked, on the day it was created, except those now Cancelled. First encounters and Senior contacts follow the same rule.',
    'Objective Score (in each scorecard) = share of working days this month the rep hit the daily calls and scheduled targets.',
    "Senior contacts = meetings booked (on the day booked) with a Director, Vice President or Chief-level person, from the appointment's Seniority Level. Referrals = calls logged as Suggested Colleague (conversation or admin); Booked Colleague is not a referral.",
    "Last month shows the previous calendar month's final standings against full monthly targets, recalculated from Zoho each time the board loads, so late status changes (e.g. a meeting marked Attended after month end) still count. It uses each rep's current level.",
    'Working days are Monday to Friday. Days run on Eastern time.',
    'Source: Zoho CRM, read live when the board opens. Numbers are cached for 15 minutes; use Refresh to reload.',
  ].forEach(t => how.append(el('li', null, t)));
}

const MN = { score: 'Activity Score', points: 'Attended points', schedPoints: 'Scheduled points', scheduled: 'Scheduled appointments', attended: 'Attended appointments', firstEnc: 'First encounters', senior: 'Senior contacts', calls: 'Calls', referrals: 'Referrals' };
const SN = { points: 'Att pts', schedPoints: 'Sched pts', scheduled: 'Sched appts', attended: 'Att appts', firstEnc: '1st enc', senior: 'Senior', calls: 'Calls', referrals: 'Refs' };
const fd = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function scoreTable(c, members) {
  const pct = c.metric === 'score' || c.scoring !== 'raw';
  const t = el('table', 'ct'); const hr = el('tr');
  const keys = Object.keys((members[0] || {}).kpis || {});
  if (c.metric === 'score') {
    for (const k of ['Rep', ...keys, 'Score']) { const h = el('th', null, SN[k] || k); if (MN[k]) h.title = MN[k]; hr.append(h); }
    const th = el('thead'); th.append(hr); t.append(th); const tb = el('tbody');
    for (const m of members) {
      const tr = el('tr'); const n = el('td', 'l', m.name); n.append(el('small', null, m.level || '')); tr.append(n);
      for (const k of keys) {
        const [a, g] = m.kpis[k]; const p = g ? Math.min(a / g, c.cap || 1.5) * 100 : 0;
        const td = el('td'); td.append(el('b', null, fmt1(a)), el('span', 'frac', ' / ' + fmt1(g)), el('small', null, fmt(p) + '%')); tr.append(td);
      }
      tr.append(el('td', 'tot', fmt(m.value))); tb.append(tr);
    }
    t.append(tb);
    const wsum = keys.reduce((s, k) => s + (c.weights[k] || 0), 0);
    const note = `Each KPI is actual ÷ target for ${c.days} working day${c.days === 1 ? '' : 's'} (capped at ${Math.round((c.cap || 1.5) * 100)}%), then weighted: ${keys.map(k => `${MN[k] || k} ${Math.round((c.weights[k] || 0) / wsum * 100)}%`).join(', ')}.`;
    return [t, note];
  }
  const ks = keys.length ? keys : (c.metrics || [c.metric]);
  const multi = ks.length > 1;
  const hs = ['Rep']; for (const k of ks) hs.push(MN[k] || k); hs.push(c.scoring === 'raw' ? (multi ? 'Combined total' : 'Total') : (multi ? 'Combined %' : '% of target'));
  for (const h of hs) hr.append(el('th', null, h));
  const th = el('thead'); th.append(hr); t.append(th); const tb = el('tbody');
  for (const m of members) {
    const tr = el('tr'); const n = el('td', 'l', m.name); n.append(el('small', null, m.level || '')); tr.append(n);
    for (const k of ks) {
      const [a, g] = (m.kpis || {})[k] || [0, 0]; const td = el('td'); td.append(el('b', null, fmt1(a)));
      if (c.scoring !== 'raw') { td.append(el('span', 'frac', ' / ' + fmt1(g))); const p = g ? (c.scoring === 'fixed' ? a / g : Math.min(a / g, c.cap || 1.5)) * 100 : 0; td.append(el('small', null, fmt(p) + '%')); }
      tr.append(td);
    }
    tr.append(el('td', 'tot', pct ? fmt(m.value) + '%' : fmt1(m.value))); tb.append(tr);
  }
  t.append(tb);
  const comb = multi ? (c.scoring === 'raw' ? ` The ${ks.length} totals are added together.` : ` The ${ks.length} percentages are averaged with equal weight.`) : '';
  const note = (c.scoring === 'raw' ? 'Raw totals for the competition dates.' : c.scoring === 'fixed' ? `Everyone measured against the same target${multi ? 's' : ''} (${ks.map(k => `${MN[k] || k} ${fmt1((c.fixedTargets || {})[k] || 0)}`).join(', ')}).` : `Target = each rep's own target pro-rated to ${c.days} working day${c.days === 1 ? '' : 's'} (capped at ${Math.round((c.cap || 1.5) * 100)}%).`) + comb;
  return [t, note];
}

function renderComps() {
  const cbox = $('comps'); cbox.textContent = '';
  const comps = DATA.comps || [];
  const liveN = comps.filter(c => c.status === 'live').length;
  $('comp-count').textContent = liveN ? String(liveN) : '';
  if (!comps.length) cbox.append(el('div', 'panel empty', 'No competitions right now.'));
  const order = { live: 0, upcoming: 1, ended: 2 };
  for (const c of [...comps].sort((a, b) => order[a.status] - order[b.status])) {
    const card = el('div', 'cc'); const top = el('div', 'top');
    top.append(el('b', 't', c.name), el('span', 'pill ' + c.status, c.status));
    const isTeams = c.format === 'teams', isDiv = c.format === 'division';
    const pct = c.metric === 'score' || c.scoring !== 'raw';
    const ms = c.metrics || [c.metric];
    const how = c.metric === 'score' ? 'Activity Score' : `${ms.map(k => MN[k] || k).join(' + ')}${c.scoring === 'raw' ? (ms.length > 1 ? ' (combined total)' : ' (total)') : c.scoring === 'fixed' ? (ms.length > 1 ? ' (avg % of fixed targets)' : ` (% of ${fmt1(((c.fixedTargets || {})[ms[0]]) ?? c.fixedTarget)})`) : (ms.length > 1 ? ' (avg % of own targets)' : ' (% of own target)')}`;
    const h2h = isTeams && c.standings.length === 2 && c.standings.every(t => t.n === 1);
    const fmtTxt = isTeams ? (h2h ? 'Head-to-head' : 'Teams') : isDiv ? 'Divisions' : 'Individual';
    card.append(top, el('div', 'm', `${how} · ${fmtTxt} · ${c.start === c.end ? fd(c.start) : fd(c.start) + ' – ' + fd(c.end)}${c.prize ? ' · Prize: ' + c.prize : ''}`));
    if (c.goal) card.append(el('div', 'm', 'Goal: ' + c.goal));
    const val = v => pct ? fmt(v) + (c.metric === 'score' ? '' : '%') : fmt1(v);
    if (c.status === 'upcoming') { card.append(el('div', 'm', 'Starts ' + fd(c.start) + '.')); cbox.append(card); continue; }
    if (!c.standings.length) { card.append(el('div', 'm', 'No results yet.')); cbox.append(card); continue; }
    const det = el('details', 'how2'); det.open = (isTeams || isDiv) || c.standings.length <= 5; det.append(el('summary', null, 'How the scores are worked out'));
    if ((isTeams || isDiv) && c.standings.length === 2) {
      const [a, b] = c.standings; const tot = (a.value + b.value) || 1;
      const vs = el('div', 'vs');
      for (const [t, side] of [[a, 'l'], [b, 'r']]) { const s = el('div', 'side ' + side); s.append(el('div', 'tn', t.name), el('div', 'tv', val(t.value)), el('div', 'tm', t.members.map(m => m.name).join(' · '))); vs.append(s); }
      const tug = el('div', 'tug'); const i = el('i'); i.style.width = (a.value / tot * 100) + '%'; tug.append(i);
      card.append(vs, tug, el('div', 'm', a.value === b.value ? 'All square.' : `${a.name} leads by ${val(a.value - b.value).replace('%', ' pts')}.`));
    } else if (isTeams || isDiv) {
      const ol = el('ol'); c.standings.forEach((x, i) => { const li = el('li'); li.append(el('span', 'r', String(i + 1)), el('span', 'n', `${x.name} (${x.n})`), el('span', 'v', val(x.value))); ol.append(li); }); card.append(ol);
    } else {
      const ol = el('ol'); c.standings.slice(0, 5).forEach((x, i) => { const li = el('li'); li.append(el('span', 'r', String(i + 1)), el('span', 'n', x.name), el('span', 'v', val(x.value))); ol.append(li); }); card.append(ol);
    }
    if (isTeams || isDiv) {
      for (const t of c.standings) {
        det.append(el('div', 'sideh', `${t.name}: ${val(t.value)}${t.n > 1 ? (c.teamCalc === 'sum' ? ' (team total)' : ' (average of ' + t.n + ' reps)') : ''}`));
        const [tbl] = scoreTable(c, t.members); const w = el('div', 'ctw'); w.append(tbl); det.append(w);
      }
      det.append(el('div', 'm', scoreTable(c, c.standings[0].members)[1]));
    } else {
      const [tbl, note] = scoreTable(c, c.standings); const w = el('div', 'ctw'); w.append(tbl); det.append(w, el('div', 'm', note));
      det.querySelector('summary').textContent = `How the scores are worked out (all ${c.standings.length} reps)`;
    }
    card.append(det); cbox.append(card);
  }
}

function renderDigest() {
  const D = DATA.digest, box = $('digest'); box.textContent = '';
  if (!D) { box.append(el('div', 'panel empty', 'No digest available.')); return; }
  const fdl = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  $('dg-title').textContent = 'Daily digest · ' + fdl(D.date);
  $('dg-lede').textContent = `Yesterday (${fdl(D.yesterday)}) in review, who's on the move, and what it takes to finish the month strong.`;
  const card = (title, sub) => { const c = el('div', 'cc dg'); c.append(el('h3', null, title)); if (sub) c.append(el('p', 'm', sub)); return c; };
  const table = rows => { const t = el('table'); const tb = el('tbody'); rows.forEach(r => tb.append(r)); t.append(tb); return t; };
  const who = (name, level) => { const td = el('td'); td.append(document.createTextNode(name)); td.append(el('small', null, level)); return td; };
  for (const grp of D.stars) {
    box.append(el('h2', null, "Yesterday's stars" + (grp.division ? ' · ' + grp.division : '')));
    const g1 = el('div', 'dgrid');
    for (const k of ['scheduled', 'attended', 'schedPoints']) {
      const st = grp.cards[k]; const c = card(st.label, `Division total: ${isPts(k) ? fmt1(st.total) : fmt(st.total)}`);
      if (!st.top.length) c.append(el('div', 'empty', 'None logged yesterday.'));
      else c.append(table(st.top.map((x, i) => { const tr = el('tr'); tr.append(el('td', 'r', String(i + 1)), who(x.name, x.level), el('td', 'r', isPts(k) ? fmt1(x.v) : fmt(x.v))); return tr; })));
      g1.append(c);
    }
    box.append(g1);
  }
  if (!D.inMonth || !D.daysThru) box.append(el('p', 'how', 'Month-to-date sections start after the first working day of the month.'));
  else {
    box.append(el('h2', null, 'On the move'));
    const g2 = el('div', 'dgrid');
    const mv = card('Biggest climbers', 'Month-to-date pace on scheduled + attended appointments, before and after yesterday (100% = on target).');
    if (!D.movers.length) mv.append(el('div', 'empty', 'No big moves yesterday.'));
    else mv.append(table(D.movers.map(m => {
      const tr = el('tr'); const n = who(m.name, `${m.level} · ${m.ydy}`); const v = el('td', 'r'); const w = el('div', 'mv');
      w.append(el('span', null, m.from + '%'), el('span', null, '→'), el('span', 'up', m.to + '%')); v.append(w); tr.append(n, v); return tr;
    })));
    const pr = card('Closing in on promotion', 'On course to lift their 3-month average to the next level by month end.');
    if (!D.promo.length) pr.append(el('div', 'empty', 'Nobody on course for a level-up yet this month.'));
    else pr.append(table(D.promo.map(p => { const tr = el('tr'); tr.append(who(p.name, `${p.level} → ${p.next} (${p.nextPts})`), el('td', 'r', p.need > 0 ? `${fmt1(p.need)} pts to go` : 'There already')); return tr; })));
    g2.append(mv, pr); box.append(g2);
    box.append(el('h2', null, 'Catch-up targets'));
    const g3 = el('div', 'dgrid');
    const bh = card('Within reach of pace', `Between 50% and 70% of pace after ${D.daysThru} working day${D.daysThru === 1 ? '' : 's'}. Here's what a day it takes to finish on target.`);
    if (!D.behind.length) bh.append(el('div', 'empty', D.behindOthers ? 'Nobody in the 50–70% band today.' : 'Everyone is at 70% of pace or better. Great work.'));
    else bh.append(table(D.behind.map(b => { const tr = el('tr'); tr.append(who(b.name, `${b.level} · ${b.pace}% of pace`), el('td', 'r', `${fmt1(b.schedPerDay)} booked / day`)); return tr; })));
    if (D.behindOthers) bh.append(el('p', 'm', `${D.behindOthers} more rep${D.behindOthers === 1 ? ' is' : 's are'} under 50% of pace. Every booking today counts.`));
    g3.append(bh); box.append(g3);
  }
  box.append(el('h2', null, 'Competitions'));
  const g4 = el('div', 'dgrid');
  if (!D.comps.length) g4.append(card('No live competitions'));
  for (const c of D.comps) {
    const k = card(c.name, `Ends ${fd(c.end)}${c.prize ? ' · Prize: ' + c.prize : ''}`);
    const v = x => c.pct ? fmt(x) + '%' : fmt1(x);
    k.append(el('p', null, c.second ? `${c.leader} leads with ${v(c.value)}, ${c.gap === 0 ? 'tied with' : (c.pct ? fmt(c.gap) + ' pts' : fmt1(c.gap)) + ' ahead of'} ${c.second}.` : `${c.leader} leads with ${v(c.value)}.`));
    g4.append(k);
  }
  box.append(g4);
}

function scorecard(x, P) {
  const box = el('div', 'card');
  for (const k of x.rows) {
    const c = el('div', 'kpi'); c.append(el('div', 'k', k.label));
    const v = el('div', 'v', isPts(k.key) ? fmt1(k.actual) : fmt(k.actual));
    if (k.target !== null && k.target !== undefined) v.append(el('span', null, ' / ' + ((isPts(k.key) || k.target < 10) ? fmt1(k.target) : fmt(k.target))));
    c.append(v);
    if (k.target) { const a = k.actual / k.target; c.append(bar(a / C.cap, 1 / C.cap)); const [cls, txt] = status(a); c.append(el('div', 'st ' + cls, `${txt} · ${fmt(a * 100)}%`)); }
    else c.append(el('div', 'st', k.noTarget ? 'No target set yet' : (k.target === 0 ? 'No working days yet' : 'No points target for this level')));
    box.append(c);
  }
  if (P !== 'lastmonth') {
    const ob = el('div', 'kpi'); ob.append(el('div', 'k', 'Objective score (month)'), el('div', 'v', fmt(x.objective)));
    ob.append(bar(x.objective / 100)); ob.append(el('div', 'st', 'Days hitting daily calls and scheduled targets')); box.append(ob);
  }
  const pr = el('div', 'promo'); const nxt = x.nxt;
  pr.append(el('span', null, 'Current level'), el('strong', null, `${x.r.level || '—'} · ${x.isNH || !x.ln ? 'Trainee' : levelTitle(x.ln, C.ladder)}`));
  pr.append(el('span', null, 'Avg, last 3 full months'), el('strong', null, fmt1(x.avg3)));
  if (nxt) {
    const need = Math.max(0, nxt.t * 3 - (x.r.p_m2 + x.r.p_m1 + x.r.p_mtd));
    pr.append(el('span', null, 'Next'), el('strong', null, `${nxt.name} (${nxt.t})`), el('span', null, need > 0 ? `${fmt1(need)} more points this month gets you there` : 'On track for the next level'));
  }
  box.append(pr);
  return box;
}

function setView(v) {
  view.v = v;
  for (const k of ['board', 'comps', 'digest']) { $('v-' + k).hidden = k !== v; $('v-' + k + '-btn').setAttribute('aria-pressed', k === v); }
  document.querySelector('.controls').style.visibility = v === 'board' ? 'visible' : 'hidden';
  try { history.replaceState(null, '', v === 'comps' ? '#competitions' : v === 'digest' ? '#digest' : '#'); } catch (e) { /* sandboxed frame */ }
}

export function mount() {
  for (const [id, p] of [['p-today', 'today'], ['p-week', 'week'], ['p-month', 'month'], ['p-lastmonth', 'lastmonth']])
    $(id).onclick = () => { state.period = p; state.periodChosen = true; render(); };
  $('v-digest-btn').onclick = () => setView('digest');
  $('v-board-btn').onclick = () => setView('board');
  $('v-comps-btn').onclick = () => setView('comps');
  setView(view.v);
}
