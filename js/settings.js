// Scoreboard settings from the Scoreboard Competitions CRM module: Board records (everyday
// targets per group) and Contest records. Converts records to the shapes scoring.js and
// comps.js use, and works out each rep's targets. Pure: no DOM, no SDK.

import { isNHLevel, levelNum, monthlyAttended, repTargets } from './scoring.js';
import { periodDates } from './dates.js';

export const LEVELS = ['NH', 'Hit 8', 'Hit 16', 'Avg 16', 'Avg 20', 'Avg 24', 'Avg 28', 'Avg 32', 'Avg 36', 'Avg 40', 'Avg 44', 'Avg 48', 'BDR', 'BDR 8'];
// Reps subform as John built it (2026-11-02): one row per rep, Contest_Side (labelled "Contest Team") for head-to-head contests.
export const TEAMS = ['Team A', 'Team B', 'Team C', 'Team D', 'Team E', 'Team F'];
const REPS = 'Reps_Participants', REP = 'Rep_Participant', TEAM = 'Contest_Side', OVR = 'Override_';
const teamOf = v => (v && v !== '-None-' ? v : '');

export const GROUPS = { SDR: 'P4P Division', BDR: 'BDR Division', Trainee: 'Training' };
export const groupOf = team => Object.keys(GROUPS).find(g => GROUPS[g] === team) || null;

// Target KPI -> subform column. Calls are per day; the rest are per month.
export const TARGET_FIELDS = { calls: 'Calls_Day', scheduled: 'Scheduled_Month', attended: 'Attended_Month', schedPoints: 'Scheduled_Points_Month',
  firstEnc: 'First_Encounters_Month', senior: 'Senior_Contacts_Month', referrals: 'Referrals_Month' };
export const WEIGHT_FIELDS = { points: 'Weight_Attended_Points', schedPoints: 'Weight_Scheduled_Points', scheduled: 'Weight_Scheduled', attended: 'Weight_Attended',
  firstEnc: 'Weight_First_Encounters', calls: 'Weight_Calls', senior: 'Weight_Senior_Contacts', referrals: 'Weight_Referrals' };
export const FIXED_FIELDS = { points: 'Fixed_Attended_Points', schedPoints: 'Fixed_Scheduled_Points', scheduled: 'Fixed_Scheduled', attended: 'Fixed_Attended',
  firstEnc: 'Fixed_First_Encounters', calls: 'Fixed_Calls', senior: 'Fixed_Senior_Contacts', referrals: 'Fixed_Referrals' };

// Internal key <-> CRM picklist label.
export const MEASURES = { score: 'Activity Score', points: 'Attended points', schedPoints: 'Scheduled points', scheduled: 'Scheduled appointments',
  attended: 'Attended appointments', firstEnc: 'First encounters', calls: 'Calls', senior: 'Senior contacts', referrals: 'Referrals' };
export const SCORING = { target: '% of own target', raw: 'Raw total', fixed: '% of fixed target' };
export const FORMATS = { individual: 'Individual', teams: 'Head-to-head teams', division: 'Teams by division' };
export const TEAM_CALC = { avg: 'Average per rep', sum: 'Team total' };
export const ENTRANTS = { group: 'Whole group', picked: 'Picked reps' };
const TYPES = { board: 'Board', contest: 'Contest' };

const keyOf = (map, label, fallback) => Object.keys(map).find(k => map[k] === label) || fallback;
const num = v => (v === null || v === undefined || v === '' || Number.isNaN(+v) ? null : +v);
const row = (src, prefix = '') => Object.fromEntries(Object.entries(TARGET_FIELDS).map(([k, f]) => [k, num(src[prefix + f])]));
const rowOut = (t, prefix = '') => Object.fromEntries(Object.entries(TARGET_FIELDS).map(([k, f]) => [prefix + f, t?.[k] ?? null]));
const idOf = v => String(v?.id ?? v ?? '');

// A contest with picked reps or head-to-head teams lists its entrants in the Reps subform.
const entrantsListed = s => s.type === 'contest' && (s.format === 'teams' || (s.format === 'individual' && s.entrants === 'picked'));

export function parseRecord(rec) {
  const reps = (rec[REPS] || []).filter(r => idOf(r[REP]));
  const hasEntrants = entrantsListed({ type: keyOf(TYPES, rec.Record_Type, 'contest'), format: keyOf(FORMATS, rec.Format, 'individual'), entrants: keyOf(ENTRANTS, rec.Entrants, 'group') });
  const fixedTargets = {};
  for (const [k, f] of Object.entries(FIXED_FIELDS)) if (num(rec[f]) !== null) fixedTargets[k] = num(rec[f]);
  const metrics = (rec.Measured_On || []).map(l => keyOf(MEASURES, l, null)).filter(Boolean);
  return {
    id: rec.id ? String(rec.id) : '', name: rec.Name || '', type: keyOf(TYPES, rec.Record_Type, 'contest'), group: rec.Group || '',
    start: rec.Start_Date || '', end: rec.End_Date || '', goal: rec.Goal || '', prize: rec.Prize || '',
    metrics: metrics.length ? metrics : ['score'],
    scoring: keyOf(SCORING, rec.Scoring_Method, 'target'), fixedTargets,
    format: keyOf(FORMATS, rec.Format, 'individual'), entrants: keyOf(ENTRANTS, rec.Entrants, 'group'), teamCalc: keyOf(TEAM_CALC, rec.Team_Score, 'avg'),
    weights: Object.fromEntries(Object.entries(WEIGHT_FIELDS).map(([k, f]) => [k, num(rec[f]) ?? 0])),
    cap: (num(rec.Score_Cap_Pct) ?? 150) / 100, confirmed: rec.Targets_Confirmed === true, modified: rec.Modified_Time || '',
    levels: Object.fromEntries((rec.Level_Targets || []).filter(r => r.Level).map(r => [r.Level, row(r)])),
    // One Reps subform: a row with a target filled is an override; on a picked or team contest every row is an entrant.
    overrides: Object.fromEntries(reps.filter(r => Object.values(row(r, OVR)).some(v => v !== null)).map(r => [idOf(r[REP]), { targets: row(r, OVR), reason: r.Reason || '' }])),
    participants: hasEntrants ? reps.map(r => ({ id: idOf(r[REP]), team: teamOf(r[TEAM]) })) : [],
    // Subform row ids, so a save updates rows in place and deletes removed ones instead of adding copies.
    rowIds: {
      levels: Object.fromEntries((rec.Level_Targets || []).filter(r => r.id && r.Level).map(r => [r.Level, String(r.id)])),
      reps: Object.fromEntries(reps.filter(r => r.id).map(r => [idOf(r[REP]), String(r.id)])),
    },
  };
}

// One Reps row per rep: entrants first (with their team), then override-only reps. Overrides for reps
// who aren't entrants in a picked or team contest are dropped, since they aren't in it.
function repRows(s) {
  const ov = s.overrides || {}, out = [];
  const add = (id, team) => out.push([id, { [REP]: { id }, [TEAM]: team || null, ...rowOut(ov[id]?.targets, OVR), Reason: ov[id]?.reason || '' }]);
  if (entrantsListed(s)) for (const p of s.participants || []) add(p.id, p.team);
  else for (const id of Object.keys(ov)) add(id, '');
  return out;
}

// Rows keep their CRM row id when they have one; rows that were removed are sent as deletions.
function subform(rows, ids = {}) {
  const keep = new Set(rows.map(([key]) => key));
  return [...rows.map(([key, row]) => (ids[key] ? { id: ids[key], ...row } : row)),
    ...Object.entries(ids).filter(([key]) => !keep.has(key)).map(([, id]) => ({ id, _delete: null }))];
}

export function toRecord(s) {
  const ids = s.rowIds || {};
  const out = {
    Name: s.name, Record_Type: TYPES[s.type], Group: s.group,
    Start_Date: s.start || null, End_Date: s.end || null, Goal: s.goal || '', Prize: s.prize || '',
    Measured_On: s.metrics.map(k => MEASURES[k]), Scoring_Method: SCORING[s.scoring], Format: FORMATS[s.format],
    Entrants: ENTRANTS[s.entrants], Team_Score: TEAM_CALC[s.teamCalc],
    ...Object.fromEntries(Object.entries(FIXED_FIELDS).map(([k, f]) => [f, s.fixedTargets?.[k] ?? null])),
    ...Object.fromEntries(Object.entries(WEIGHT_FIELDS).map(([k, f]) => [f, s.weights?.[k] ?? 0])),
    Score_Cap_Pct: Math.round(s.cap * 100), Targets_Confirmed: !!s.confirmed,
    Level_Targets: subform(Object.entries(s.levels || {}).map(([Level, t]) => [Level, { Level, ...rowOut(t) }]), ids.levels),
    [REPS]: subform(repRows(s), ids.reps),
  };
  if (s.id) out.id = s.id;
  return out;
}

// One Board per group. If someone made a second one, the most recently changed one wins.
export function boardsByGroup(settings) {
  const boards = {}, counts = {}, notices = [];
  for (const s of settings) {
    if (s.type !== 'board' || !GROUPS[s.group]) continue;
    counts[s.group] = (counts[s.group] || 0) + 1;
    if (!boards[s.group] || Date.parse(s.modified || 0) > Date.parse(boards[s.group].modified || 0)) boards[s.group] = s;
  }
  for (const g of Object.keys(GROUPS)) if (counts[g] > 1) notices.push(`There are ${counts[g]} ${g} Board records. Using the one changed most recently.`);
  return { boards, notices };
}

// NH sits below Hit 8; "BDR" has no number and counts as 12.
export function levelRank(m) {
  const v = (m || '').trim();
  if (isNHLevel(v)) return 7.5;
  if (/^BDR$/i.test(v)) return 12;
  return levelNum(v);
}

// A rep's "Payband Milestone" can hold several values. Use the highest; ties go to the later level.
export function pickLevel(value) {
  const vals = Array.isArray(value) ? value : String(value || '').split(',');
  let best = '', rank = -1;
  for (const v of vals.map(x => x.trim())) {
    const r = levelRank(v);
    if (r === null) continue;
    if (r > rank || (r === rank && LEVELS.indexOf(v) > LEVELS.indexOf(best))) { best = v; rank = r; }
  }
  return best;
}

// The starting rule as a monthly row (calls per day). Same numbers as repTargets().
export function defaultLevelRow(level, cfg) {
  const att = monthlyAttended(level, cfg);
  return { calls: cfg.dailyTargets.calls, scheduled: Math.ceil(att * 4 / 3), attended: att, schedPoints: null,
    firstEnc: Math.ceil(att * 2 / 3), senior: Math.ceil(att * 2 / 3), referrals: cfg.dailyTargets.referrals };
}

// Per-day targets for one rep from one record: override cell, then the level row, then the starting rule.
export function resolveTargets(rep, setting, cfg, monthTotal) {
  const base = repTargets(rep.level, cfg, monthTotal);
  if (!setting) return base;
  const ovr = setting.overrides?.[rep.id]?.targets || {};
  const lvl = setting.levels?.[rep.level] || {};
  const out = {};
  for (const k of Object.keys(TARGET_FIELDS)) {
    const v = ovr[k] ?? lvl[k] ?? null;
    if (v === null) { if (k in base) out[k] = base[k]; continue; }
    out[k] = k === 'calls' ? v : v / monthTotal;
  }
  return out;
}

// ---- Validation. Messages match Aidan's admin page. ----

const blankWeights = w => !Object.values(w || {}).some(v => +v > 0);
const emptyTargets = t => Object.values(t || {}).every(v => v === null || v === undefined || v === '');

// Head-to-head teams: the form keeps `teams` while editing; saved records only have participants.
export function teamsOf(s) {
  if (s.teams) return s.teams;
  const by = new Map();
  for (const p of s.participants || []) { if (!by.has(p.team)) by.set(p.team, []); by.get(p.team).push(p.id); }
  return [...by].map(([name, members]) => ({ name, members }));
}
export const participantsFromTeams = teams => teams.flatMap(t => t.members.map(id => ({ id, team: t.name.trim() })));

function checkTargets(s) {
  if (blankWeights(s.weights)) return 'At least one weight must be above 0.';
  if (!(s.cap >= 1)) return "The cap can't be below 100%.";
  if (Object.values(s.overrides || {}).some(o => emptyTargets(o.targets))) return 'Each override needs at least one target.';
  return null;
}

export const validateBoard = s => checkTargets(s);

export function validateContest(s) {
  if (!s.name?.trim()) return 'Give the competition a name.';
  if (!s.start || !s.end || s.end < s.start) return "Check the dates: the end can't be before the start.";
  const kpis = s.metrics.filter(k => k !== 'score');
  if (kpis.length > 3) return 'Pick up to three KPIs.';
  if (kpis.length && s.scoring === 'fixed' && kpis.some(k => !(+s.fixedTargets?.[k] > 0))) return 'Enter the target everyone is measured against for each KPI.';
  if (s.format === 'teams') {
    const teams = teamsOf(s);
    if (teams.length < 2 || teams.some(t => !t.members.length)) return 'Each team needs at least one rep.';
    if (teams.some(t => !t.name?.trim())) return 'Give each team a name.';
    if (new Set(teams.map(t => t.name.trim().toLowerCase())).size !== teams.length) return 'Each team needs a different name.';
  }
  if (s.format === 'individual' && s.entrants === 'picked' && !(s.participants || []).length) return 'Pick at least one rep.';
  if (s.format === 'division' && s.group !== 'All') return 'Teams by division needs the group set to All.';
  return checkTargets(s);
}

// ---- Holidays: the scoreboard_holidays variable holds {"YYYY-MM-DD": "Name"}. ----

export const isRealDate = d => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return false;
  const [y, m, day] = d.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, day));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === day;
};

export function parseHolidays(value) {
  const none = { set: new Set(), list: [], error: false };
  if (value === null || value === undefined || String(value).trim() === '') return none;
  let obj;
  try { obj = JSON.parse(value); } catch { return { ...none, error: true }; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || !Object.keys(obj).every(isRealDate)) return { ...none, error: true };
  const list = Object.entries(obj).map(([date, name]) => ({ date, name: String(name ?? '') })).sort((a, b) => a.date.localeCompare(b.date));
  return { set: new Set(list.map(h => h.date)), list, error: false };
}

export const serializeHolidays = list => JSON.stringify(Object.fromEntries([...list].sort((a, b) => a.date.localeCompare(b.date)).map(h => [h.date, h.name.trim()])));

export function validateHolidays(list) {
  if (list.some(h => !isRealDate(h.date))) return 'Each holiday needs a real date.';
  if (new Set(list.map(h => h.date)).size !== list.length) return 'Each date can only be listed once.';
  if (list.some(h => !h.name?.trim())) return 'Give each holiday a name.';
  return null;
}

// ---- Contest drafts for the admin form ----

const clone = v => JSON.parse(JSON.stringify(v));

// A contest's own targets start as a copy of its group's Board. "All" takes SDR's weights and
// merges level rows SDR first, then BDR and Trainee. A missing Board falls back to the starting rule.
export function prefillFromBoards(group, boards, cfg) {
  const order = group === 'All' ? ['SDR', 'BDR', 'Trainee'] : [group];
  const levels = {};
  for (const g of order) for (const [lv, row] of Object.entries(boards[g]?.levels || {})) if (!levels[lv]) levels[lv] = clone(row);
  if (!order.some(g => boards[g])) for (const lv of LEVELS) levels[lv] = defaultLevelRow(lv, cfg);
  const first = boards[order[0]];
  return { weights: clone(first?.weights || cfg.weights), cap: first?.cap ?? cfg.cap, levels };
}

export function newContest(group, boards, today, cfg) {
  const [start, end] = periodDates('week', today);
  return {
    id: '', name: '', type: 'contest', group, start, end, goal: '', prize: '',
    metrics: ['score'], scoring: 'target', fixedTargets: {}, format: 'individual', entrants: 'group', teamCalc: 'avg',
    confirmed: false, modified: '', overrides: {}, participants: [],
    teams: [{ name: TEAMS[0], members: [] }, { name: TEAMS[1], members: [] }],
    ...prefillFromBoards(group, boards, cfg),
  };
}

export const copyContest = s => ({ ...clone(s), id: '', modified: '', name: `${s.name} (copy)`, rowIds: { levels: {}, reps: {} } });

// Contest records in the shape comps.js scores. The record itself rides along as `setting`
// so a contest is scored with its own targets, weights and cap.
export function contestDefs(contests) {
  return contests.map(s => {
    const def = { id: s.id, name: s.name, start: s.start, end: s.end, goal: s.goal, prize: s.prize,
      metric: s.metrics.length === 1 ? s.metrics[0] : 'multi', metrics: s.metrics, format: s.format,
      scoring: s.metrics[0] === 'score' ? 'target' : s.scoring, fixedTargets: s.fixedTargets, teamCalc: s.teamCalc, setting: s };
    if (s.format === 'teams') def.teams = teamsOf({ participants: s.participants });
    else if (s.entrants === 'picked') { def.who = 'Picked'; def.members = s.participants.map(p => p.id); }
    else def.who = s.group === 'All' ? 'All' : GROUPS[s.group];
    return def;
  });
}

// Fields to ask for when reading records (subforms included).
export const RECORD_FIELDS = ['Name', 'Record_Type', 'Group', 'Start_Date', 'End_Date', 'Goal', 'Prize', 'Measured_On', 'Scoring_Method', 'Format',
  'Entrants', 'Team_Score', 'Score_Cap_Pct', 'Targets_Confirmed', 'Modified_Time', ...Object.values(FIXED_FIELDS), ...Object.values(WEIGHT_FIELDS),
  'Level_Targets', REPS];
