// Boards tab: the everyday targets for SDR, BDR and Trainee. targetsEditor() is shared with the
// Contests tab, which edits the same weights, cap, level targets and overrides on a contest.

import { GROUPS, LEVELS, MEASURES, WEIGHT_FIELDS, defaultLevelRow, toRecord, validateBoard } from '../settings.js';
import { banner, button, el, numInput, select, seg, textInput, toast } from './ui.js';

const TARGET_LABELS = { calls: 'Calls / day', scheduled: 'Scheduled / month', attended: 'Attended / month', schedPoints: 'Scheduled points / month',
  firstEnc: 'First encounters / month', senior: 'Senior contacts / month', referrals: 'Referrals / month' };
const NULL_ROW = () => Object.fromEntries(Object.keys(TARGET_LABELS).map(k => [k, null]));
const clone = v => JSON.parse(JSON.stringify(v));

function weightsTable(draft) {
  const t = el('table', 'atable'); const hr = el('tr');
  for (const h of ['KPI', 'Weight', 'Share of score']) hr.append(el('th', null, h));
  t.append(el('thead')); t.tHead.append(hr);
  const tb = el('tbody'); const bars = {};
  const refresh = () => {
    const total = Object.keys(WEIGHT_FIELDS).reduce((s, k) => s + (+draft.weights[k] || 0), 0);
    for (const [k, [fill, pct]] of Object.entries(bars)) { const p = total ? (+draft.weights[k] || 0) / total : 0; fill.style.width = p * 100 + '%'; pct.textContent = Math.round(p * 100) + '%'; }
  };
  for (const k of Object.keys(WEIGHT_FIELDS)) {
    const tr = el('tr'); tr.append(el('td', 'lv', MEASURES[k]));
    const td = el('td'); td.append(numInput(draft.weights[k] ?? 0, { label: `${MEASURES[k]} weight`, onChange: v => { draft.weights[k] = v ?? 0; refresh(); } })); tr.append(td);
    const sh = el('td'); const row = el('div', 'arow'); const bar = el('div', 'wbar'); const fill = el('i'); bar.append(fill); const pct = el('span', 'amuted');
    row.append(bar, pct); sh.append(row); tr.append(sh); bars[k] = [fill, pct]; tb.append(tr);
  }
  t.append(tb); refresh();
  const cap = numInput(Math.round(draft.cap * 100), { min: 100, label: 'Cap on any one KPI', onChange: v => { draft.cap = (v ?? 150) / 100; } });
  const capField = el('div', 'afield'); capField.style.marginTop = '12px';
  capField.append(el('div', 'lab', 'Cap on any one KPI (% of target)'), cap, el('div', 'amuted', 'Stops one huge number from carrying the whole score. 150 means no extra credit past 150% of a target.'));
  const box = el('div'); box.append(el('div', 'ascroll'), capField); box.firstChild.append(t);
  return box;
}

function levelsTable(draft, cfg) {
  const t = el('table', 'atable'); const hr = el('tr');
  for (const h of ['Level', ...Object.values(TARGET_LABELS)]) hr.append(el('th', null, h));
  t.append(el('thead')); t.tHead.append(hr);
  const tb = el('tbody');
  for (const lv of LEVELS) {
    if (!draft.levels[lv]) draft.levels[lv] = NULL_ROW();
    const row = draft.levels[lv], start = defaultLevelRow(lv, cfg);
    const tr = el('tr'); tr.append(el('td', 'lv', lv));
    for (const k of Object.keys(TARGET_LABELS)) {
      const td = el('td');
      td.append(numInput(row[k], { label: `${lv} ${TARGET_LABELS[k]}`, placeholder: k === 'schedPoints' ? '= level' : String(start[k] ?? ''), onChange: v => { row[k] = v; } }));
      tr.append(td);
    }
    tb.append(tr);
  }
  t.append(tb);
  const box = el('div', 'ascroll'); box.append(t); return box;
}

function overridesEditor(draft, ctx) {
  const ui = ctx.ui; const reps = ctx.reps; const byId = Object.fromEntries(reps.map(r => [r.id, r]));
  const wrap = el('div', 'agrid');
  const list = el('div');
  const ids = Object.keys(draft.overrides);
  if (!ids.length) list.append(el('p', 'amuted', "No overrides. Everyone uses their level's targets."));
  for (const id of ids) {
    const o = draft.overrides[id]; const item = el('div', 'aitem'); const info = el('div');
    const set = Object.entries(o.targets).filter(([, v]) => v !== null).map(([k, v]) => `${TARGET_LABELS[k]} ${v}`).join(' · ');
    info.append(el('b', null, byId[id]?.name || id), el('div', 'amuted', set || 'No changes'));
    if (o.reason) info.append(el('div', 'amuted', o.reason));
    const acts = el('div', 'arow');
    acts.append(button('Edit', () => { ui.ovRep = id; ctx.rerender(); }), button('Remove', () => { delete draft.overrides[id]; if (ui.ovRep === id) ui.ovRep = ''; ctx.rerender(); }, 'danger'));
    item.append(info, acts); list.append(item);
  }
  const ed = el('div');
  ed.append(select([['', 'Choose a rep…'], ...reps.map(r => [r.id, `${r.name} · ${r.level || 'no level'}`])], ui.ovRep || '', v => { ui.ovRep = v; ctx.rerender(); }, 'Rep'));
  const rep = byId[ui.ovRep];
  if (rep) {
    const cur = clone(draft.overrides[rep.id] || { targets: NULL_ROW(), reason: '' });
    const lvl = draft.levels[rep.level] || {}; const start = rep.level ? defaultLevelRow(rep.level, ctx.cfg) : {};
    const grid = el('div', 'kgrid'); grid.style.marginTop = '10px';
    for (const k of Object.keys(TARGET_LABELS)) {
      const levelValue = lvl[k] ?? start[k] ?? (k === 'schedPoints' ? '= level' : '—');
      const c = el('div', 'kcell'); c.append(el('div', 'k', TARGET_LABELS[k]),
        numInput(cur.targets[k], { label: `${TARGET_LABELS[k]} for ${rep.name}`, placeholder: String(levelValue), onChange: v => { cur.targets[k] = v; } }),
        el('div', 'd', `Level: ${levelValue}`));
      grid.append(c);
    }
    const reason = textInput(cur.reason, { label: 'Reason (optional)', placeholder: 'Reason (optional), e.g. ramping up', onChange: v => { cur.reason = v; } });
    reason.style.marginTop = '10px';
    const apply = button('Apply override', () => {
      if (Object.values(cur.targets).every(v => v === null)) return toast('Enter at least one target, or use Remove.');
      draft.overrides[rep.id] = cur; ctx.rerender(); toast(`Override set for ${rep.name}. Select Save to keep it.`);
    });
    apply.style.marginTop = '10px';
    ed.append(el('p', 'amuted', `Level: ${rep.level || 'no level'}. Leave a box empty to keep the level's number.`), grid, reason, el('div'), apply);
  } else ed.append(el('p', 'amuted', "Pick a rep to see their level's targets and set their own."));
  wrap.append(list, ed);
  return wrap;
}

// Weights, cap, level targets and rep overrides for one record. ctx: { reps, cfg, ui, rerender }.
export function targetsEditor(draft, ctx) {
  const box = el('div');
  box.append(el('h3', null, 'Scoring weights'),
    el('p', 'amuted', "How much each KPI counts toward the Activity Score. Weights are relative and don't need to add up to 100. A KPI with weight 0 is shown but not scored."),
    weightsTable(draft),
    el('h3', null, 'Level targets'),
    el('p', 'amuted', 'Targets for each Payband Milestone. Calls are per day; the rest are per month and pro-rated by working day. Attended points always equal the level number. A blank box uses the starting rule shown in grey.'),
    levelsTable(draft, ctx.cfg));
  const noLevel = ctx.reps.filter(r => !r.level);
  if (noLevel.length) box.append(el('p', 'amuted', `Reps with no level (they use the starting rule unless they have an override): ${noLevel.map(r => r.name).join(', ')}.`));
  box.append(el('h3', null, 'Rep overrides'),
    el('p', 'amuted', 'Give one rep different targets from their level, for example while ramping up or on reduced hours.'),
    overridesEditor(draft, ctx));
  return box;
}

// state: { boards, reps, cfg, boardGroup, drafts, ui, save(setting) -> Promise, rerender() }
export function renderBoards(root, state) {
  const g = state.boardGroup || 'SDR';
  root.append(el('h2', null, 'Boards'),
    el('p', 'lede', "The everyday targets and weights for each group. The main scoreboard always uses these; a contest's own numbers only apply inside that contest."),
    seg(Object.keys(GROUPS).map(x => [x, x]), g, v => { state.boardGroup = v; state.ui.ovRep = ''; state.rerender(); }, 'Group'));
  const board = state.boards[g];
  if (!board) { root.append(el('div', null), banner(`The ${g} Board record is missing. Ask John to recreate it.`, 'bad')); return; }
  const draft = state.drafts[board.id] || (state.drafts[board.id] = clone(board));
  const box = el('div', 'abox'); box.style.marginTop = '14px';
  if (!board.confirmed) box.append(banner('These are placeholder targets. Check them and select Save.'));
  const reps = state.reps.filter(r => r.group === g);
  box.append(targetsEditor(draft, { reps, cfg: state.cfg, ui: state.ui, rerender: state.rerender }));
  const save = button('Save', async () => {
    const err = validateBoard(draft);
    if (err) return toast(err);
    save.disabled = true;
    try { await state.save(toRecord({ ...draft, confirmed: true })); delete state.drafts[board.id]; toast(`${g} board saved`); await state.reload(); }
    catch (e) { toast(`Couldn't save: ${e.message}`); save.disabled = false; }
  }, 'primary');
  save.style.marginTop = '16px';
  box.append(save);
  root.append(box);
}
