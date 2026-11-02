// Builds the scoreboard's DATA object (same shape as Aidan's page) from live CRM queries.
// Filters copy Aidan's "Scoreboard - Rep KPIs" query table, quirks included (see docs/data-model.md).

import { and, between, inList, makeRunner } from './coql.js';
import { buildCalendar, dateIn, dayEnd, dayStart, window, workingDaysBetween } from './dates.js';
import { boardsByGroup, contestDefs, GROUPS, groupOf, isRealDate, parseHolidays, parseRecord, pickLevel, resolveTargets } from './settings.js';
import { buildDigest } from './digest.js';
import { buildComps } from './comps.js';

export const ATT_STATUSES = ['Attended', 'Reschedule - ABD', 'Cancelled - ISS'];
export const SENIOR_LEVELS = ['Director', 'Vice President', 'Chief'];
export const PHONE_EDIT_TYPES = ['Mobile Phone Edit', 'Direct Phone Edit', 'Alternate Phone Edit'];
const SCHEDULED = and("Appointment_Status != 'Cancelled'", 'Appointment_Status is not null');
const REFERRAL = "Call_Result like '%Suggested Colleague%'";

const COLS = ['p', 'sp', 'sch', 'att', 'fe', 'sen', 'calls', 'talk', 'ref', 'mob'];
const SUFFIXES = ['tdy', 'ydy', 'wtd', 'mtd', 'm1', 'm2', 'm3'];

// One grouped query: `cols` receive the selected aggregates in order.
const agg = (sfx, cols, module, by, select, where) => {
  const aggs = select.split(/,\s*(?=[A-Z]+\()/);
  return { sfx, cols, by, aggs, query: `select ${by}, ${aggs.join(', ')} from ${module} where ${where} group by ${by}` };
};

export function aggregateSpecs(cal) {
  const w = cal.win;
  const attended = win => and(inList('Appointment_Status', ATT_STATUSES), between('Appointment_Date', win), `Created_Time >= '${w.created7[0]}'`);
  const specs = [];
  for (const [sfx, win] of [['tdy', w.tdy], ['ydy', w.ydy], ['wtd', w.wtdOpen], ['mtd', w.mtdOpen], ['m1', w.m1], ['m2', w.m2], ['m3', w.m3]])
    specs.push(agg(sfx, ['att', 'p'], 'ISS_Appointments', 'Created_By', 'COUNT(id), SUM(Points)', attended(win)));
  const lmSched = and(SCHEDULED, between('Created_Time', w.m1));
  specs.push(agg('m1', ['sch', 'sp'], 'ISS_Appointments', 'Created_By', 'COUNT(id), SUM(Points)', lmSched));
  specs.push(agg('m1', ['fe'], 'ISS_Appointments', 'Created_By', 'COUNT(id)', and(lmSched, 'First_Encounter = true')));
  specs.push(agg('m1', ['sen'], 'ISS_Appointments', 'Created_By', 'COUNT(id)', and(lmSched, inList('Seniority_Level', SENIOR_LEVELS))));
  for (const sfx of ['tdy', 'ydy', 'wtd', 'mtd', 'm1'])
    specs.push(agg(sfx, ['calls', 'talk'], 'Calls', 'Owner', 'COUNT(id), SUM(Call_Duration_in_seconds)', between('Created_Time', w[sfx])));
  for (const sfx of ['tdy', 'wtd', 'mtd', 'm1']) {
    specs.push(agg(sfx, ['ref'], 'Calls', 'Owner', 'COUNT(id)', and(REFERRAL, between('Created_Time', w[sfx]))));
    specs.push(agg(sfx, ['mob'], 'Motivator_Tracker', 'Owner', 'COUNT(id)', and(inList('Type', PHONE_EDIT_TYPES), between('Created_Time', w[sfx]))));
  }
  return specs;
}

// Metrics for an arbitrary window (competitions). Returns { repId: { kpiKey: value } }.
export function windowSpecs(win) {
  const sched = and(SCHEDULED, between('Created_Time', win));
  return [
    agg('x', ['attended', 'points'], 'ISS_Appointments', 'Created_By', 'COUNT(id), SUM(Points)', and(inList('Appointment_Status', ATT_STATUSES), between('Appointment_Date', win))),
    agg('x', ['scheduled', 'schedPoints'], 'ISS_Appointments', 'Created_By', 'COUNT(id), SUM(Points)', sched),
    agg('x', ['firstEnc'], 'ISS_Appointments', 'Created_By', 'COUNT(id)', and(sched, 'First_Encounter = true')),
    agg('x', ['senior'], 'ISS_Appointments', 'Created_By', 'COUNT(id)', and(sched, inList('Seniority_Level', SENIOR_LEVELS))),
    agg('x', ['calls'], 'Calls', 'Owner', 'COUNT(id)', between('Created_Time', win)),
    agg('x', ['referrals'], 'Calls', 'Owner', 'COUNT(id)', and(REFERRAL, between('Created_Time', win))),
  ];
}

// Leaderboard columns for a custom date range (the "Custom" period), merged as `${col}_cus`.
export function rangeSpecs(win) {
  const sched = and(SCHEDULED, between('Created_Time', win));
  return [
    agg('cus', ['att', 'p'], 'ISS_Appointments', 'Created_By', 'COUNT(id), SUM(Points)', and(inList('Appointment_Status', ATT_STATUSES), between('Appointment_Date', win))),
    agg('cus', ['sch', 'sp'], 'ISS_Appointments', 'Created_By', 'COUNT(id), SUM(Points)', sched),
    agg('cus', ['fe'], 'ISS_Appointments', 'Created_By', 'COUNT(id)', and(sched, 'First_Encounter = true')),
    agg('cus', ['sen'], 'ISS_Appointments', 'Created_By', 'COUNT(id)', and(sched, inList('Seniority_Level', SENIOR_LEVELS))),
    agg('cus', ['calls', 'talk'], 'Calls', 'Owner', 'COUNT(id), SUM(Call_Duration_in_seconds)', between('Created_Time', win)),
    agg('cus', ['ref'], 'Calls', 'Owner', 'COUNT(id)', and(REFERRAL, between('Created_Time', win))),
    agg('cus', ['mob'], 'Motivator_Tracker', 'Owner', 'COUNT(id)', and(inList('Type', PHONE_EDIT_TYPES), between('Created_Time', win))),
  ];
}

// Values of an aggregate row, in the spec's select order, read by aggregate name.
const values = (row, aggs) => aggs.map(a => +row[a] || 0);
const ownerId = (row, by) => String(row[by]?.id ?? row[by] ?? '');

export function mergeAggregate(target, spec, rows, key = (col, sfx) => `${col}_${sfx}`) {
  for (const row of rows) {
    const id = ownerId(row, spec.by);
    if (!target[id]) continue;
    values(row, spec.aggs).forEach((v, i) => { if (spec.cols[i]) target[id][key(spec.cols[i], spec.sfx)] = v; });
  }
}

// Scheduled appointments created from `from` to today, bucketed by ET day into tdy, ydy, wtd and mtd.
export function bucketScheduled(target, rows, cal) {
  for (const row of rows) {
    const id = String(row.Created_By?.id ?? '');
    const r = target[id];
    if (!r) continue;
    const d = dateIn(row.Created_Time, cal.tz);
    const pts = +row.Points || 0;
    const fe = row.First_Encounter === true ? 1 : 0;
    const sen = SENIOR_LEVELS.includes(row.Seniority_Level) ? 1 : 0;
    const add = sfx => { r[`sch_${sfx}`]++; r[`sp_${sfx}`] += pts; r[`fe_${sfx}`] += fe; r[`sen_${sfx}`] += sen; };
    if (d === cal.today) add('tdy');
    if (d === cal.yesterday) add('ydy');
    if (d >= cal.weekStart && d <= cal.today) add('wtd');
    if (d >= cal.monthStart && d <= cal.today) { add('mtd'); r.sch_days[d] = (r.sch_days[d] || 0) + 1; }
  }
}

export function scheduledRawQuery(cal) {
  const from = [cal.weekStart, cal.monthStart, cal.yesterday].sort()[0];
  return `select Created_By, Created_Time, Points, First_Encounter, Seniority_Level from ISS_Appointments where ${and(SCHEDULED, between('Created_Time', [dayStart(from, cal.tz), dayEnd(cal.today, cal.tz)]))} order by id asc`;
}

// `boards` are the Board records by group. A rep's targets, weights and cap come from their group's
// Board, or the config defaults when it's missing.
export function blankRep(u, cfg, monthTotal, boards = {}) {
  // Values like "N/A" don't rank; keep them for display (they match no level row).
  const level = pickLevel(u.Payband_Milestone) || (Array.isArray(u.Payband_Milestone) ? u.Payband_Milestone.join(', ') : (u.Payband_Milestone || ''));
  const id = String(u.id), group = groupOf(u.Team), board = boards[group] || null;
  const r = { id, name: u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim(), team: u.Team || '', level, group,
    targets: resolveTargets({ id, level }, board, cfg, monthTotal), weights: board?.weights ?? cfg.weights, cap: board?.cap ?? cfg.cap,
    confirmed: board?.confirmed ?? false, override: !!board?.overrides?.[id], sch_days: {}, call_days: {}, days_calls_hit: 0, days_sched_hit: 0 };
  for (const c of COLS) for (const s of SUFFIXES) r[`${c}_${s}`] = 0;
  return r;
}

// Reps come from COQL on the users module, which returns the custom fields (Is_SDR, Team,
// Payband_Milestone). The SDK's getAllUsers (API v2) does not, so every rep was filtered out.
export function usersQuery(cfg) {
  return `select id, first_name, last_name, Is_SDR, Team, Payband_Milestone, status from users where ${and("Is_SDR = true", "status = 'active'", inList('Team', cfg.teams))} order by id asc`;
}

export const isBoardRep =(u, cfg) => (u.status || u.Status || '').toLowerCase() === 'active' && u.Is_SDR === true && cfg.teams.includes(u.Team);

export function countHitDays(r, cal) {
  let calls = 0, sched = 0;
  for (const d of cal.monthWorkingDays) {
    const c = d === cal.today ? r.calls_tdy : (r.call_days[d] || 0);
    if (r.targets.calls > 0 && c >= r.targets.calls) calls++;
    if (r.targets.scheduled > 0 && (r.sch_days[d] || 0) >= r.targets.scheduled) sched++;
  }
  r.days_calls_hit = calls; r.days_sched_hit = sched;
}

// Calls per rep for one past day, cached in localStorage for 12 hours.
async function callsOnDay(run, d, cal, store) {
  const key = `iss-sb:calls:${d}`;
  const hit = store?.get(key);
  if (hit && Date.now() - hit.t < 12 * 3600e3) return hit.v;
  const spec = agg(d, ['calls'], 'Calls', 'Owner', 'COUNT(id)', between('Created_Time', window(d, d, cal.tz)));
  const { data } = await run(`${spec.query} limit 2000`);
  const v = {};
  for (const row of data) v[ownerId(row, 'Owner')] = +row['COUNT(id)'] || 0;
  store?.set(key, { t: Date.now(), v });
  return v;
}

const settle = p => Promise.resolve().then(p).then(value => ({ ok: true, value }), error => ({ ok: false, error }));

// Board and Contest records, holidays and their notices. Missing loaders count as "nothing saved".
export function readSettings(settingsRes, holidaysRes) {
  const notices = [];
  const hol = holidaysRes.ok ? parseHolidays(holidaysRes.value) : { set: new Set(), list: [], error: true };
  if (hol.error) notices.push("Holidays couldn't be loaded, so working days are Monday to Friday.");
  if (!settingsRes.ok) {
    console.warn('[ISS Scoreboard] settings load failed', settingsRes.error);
    notices.push("Scoreboard settings couldn't be loaded, so default targets are in use.");
    return { boards: {}, contests: [], hol, notices };
  }
  const all = (settingsRes.value || []).map(parseRecord);
  const { boards, notices: dup } = boardsByGroup(all);
  notices.push(...dup);
  for (const g of Object.keys(GROUPS)) if (!boards[g]) notices.push(`Using default targets: the ${g} Board record couldn't be loaded.`);
  // A contest made in the CRM without proper dates would break scoring for everyone, so skip it.
  const contests = all.filter(s => s.type === 'contest').filter(s => {
    const ok = isRealDate(s.start) && isRealDate(s.end) && s.end >= s.start;
    if (!ok) notices.push(`The contest "${s.name}" has no valid dates, so it is not shown.`);
    return ok;
  });
  return { boards, contests, hol, notices };
}

export async function loadData({ coql, getUsers, listSettings, getHolidays, now = new Date(), cfg, store = null }) {
  const started = Date.now();
  const runner = makeRunner(coql);
  const [allUsers, settingsRes, holidaysRes] = await Promise.all([
    getUsers ? getUsers() : runner.all(usersQuery(cfg)),
    settle(listSettings || (() => [])),
    settle(getHolidays || (() => null)),
  ]);
  const { boards, contests, hol, notices } = readSettings(settingsRes, holidaysRes);
  const cal = buildCalendar(now, cfg.tz, hol.set);
  const C = { ...cfg, ...cfg.defaults, workingDays: cal.workingDays, monthLabel: cal.labels.month, weekLabel: cal.labels.week, lastMonthLabel: cal.labels.lastMonth };
  const users = allUsers.filter(u => isBoardRep(u, cfg));
  const byId = Object.fromEntries(users.map(u => [String(u.id), blankRep(u, C, cal.workingDays.monthTotal, boards)]));

  const specs = aggregateSpecs(cal);
  const pastDays = cal.monthWorkingDays.filter(d => d < cal.today);
  const [aggRows, raw, dayCounts] = await Promise.all([
    Promise.all(specs.map(s => runner.run(`${s.query} limit 2000`).then(r => r.data))),
    runner.all(scheduledRawQuery(cal)),
    Promise.all(pastDays.map(d => callsOnDay(runner.run, d, cal, store))),
  ]);
  specs.forEach((s, i) => mergeAggregate(byId, s, aggRows[i]));
  bucketScheduled(byId, raw, cal);
  pastDays.forEach((d, i) => { for (const [id, n] of Object.entries(dayCounts[i])) if (byId[id]) byId[id].call_days[d] = n; });

  const reps = Object.values(byId);
  for (const r of reps) {
    for (const c of COLS) r[`${c}_lm`] = r[`${c}_m1`];
    countHitDays(r, cal);
  }

  const fetchWindow = async win => {
    const out = {};
    for (const r of reps) out[r.id] = {};
    const ws = windowSpecs(win);
    const rows = await Promise.all(ws.map(s => runner.run(`${s.query} limit 2000`).then(x => x.data)));
    ws.forEach((s, i) => mergeAggregate(out, s, rows[i], col => col));
    return out;
  };
  const comps = await buildComps(contestDefs(contests), fetchWindow, cal, C, reps);
  const active = reps.filter(r => r.calls_mtd > 0 || r.sch_mtd > 0 || r.att_mtd > 0 || r.calls_lm > 0 || r.sch_lm > 0 || r.att_lm > 0);
  const digest = buildDigest(active, cal, C, comps);
  // Custom period: totals for from..to, scored against the working days in the range up to today.
  const loadRange = async (from, to) => {
    const ws = rangeSpecs(window(from, to, cal.tz));
    const rows = await Promise.all(ws.map(s => runner.run(`${s.query} limit 2000`).then(x => x.data)));
    for (const r of reps) for (const c of COLS) r[`${c}_cus`] = 0;
    ws.forEach((s, i) => mergeAggregate(byId, s, rows[i]));
    const end = to < cal.today ? to : cal.today;
    C.workingDays.custom = end >= from ? workingDaysBetween(from, end, hol.set).length : 0;
    C.customRange = { from, to };
  };
  return { asOf: now.toISOString(), config: C, reps, comps, digest, calendar: cal, settings: { boards, contests }, holidays: hol.list, notices, loadRange, stats: { ...runner.stats, ms: Date.now() - started, users: allUsers.length, boardReps: reps.length, activeReps: active.length } };
}
