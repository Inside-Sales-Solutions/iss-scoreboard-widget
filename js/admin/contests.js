// Contests tab: list, create, copy, edit and delete Contest records. Every control from
// Aidan's Competitions form, plus the contest's own targets and weights (collapsed).

import { statusOf } from '../comps.js';
import { dateIn, periodDates } from '../dates.js';
import { FORMATS, GROUPS, MEASURES, SCORING, TEAMS, TEAM_CALC, copyContest, newContest, participantsFromTeams, prefillFromBoards, teamsOf, toRecord, validateContest } from '../settings.js';
import { targetsEditor } from './boards.js';
import { banner, button, el, field, numInput, repPicker, seg, select, textInput, toast } from './ui.js';

const clone = v => JSON.parse(JSON.stringify(v));
const today = () => dateIn(new Date());
const FILTERS = [['active', 'Active'], ['upcoming', 'Upcoming'], ['ended', 'Ended'], ['all', 'All']];
const WHEN = [['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['custom', 'Custom']];

// The form edits a draft that keeps head-to-head teams as `teams`.
const editable = s => ({ ...clone(s), teams: s.format === 'teams' ? teamsOf(s) : [{ name: TEAMS[0], members: [] }, { name: TEAMS[1], members: [] }], when: 'custom' });
const fresh = state => ({ ...newContest('SDR', state.boards, today(), state.cfg), when: 'week' });
const repsFor = (state, group) => group === 'All' ? state.reps : state.reps.filter(r => r.group === group);

function summary(c) {
  const metric = c.metrics.map(k => MEASURES[k]).join(' + ');
  const scoring = c.metrics[0] === 'score' ? '' : c.scoring === 'raw' ? ' · raw total' : c.scoring === 'fixed' ? ` · % of ${c.metrics.map(k => c.fixedTargets[k]).join(' / ')}` : ' · % of own target';
  const fmt = c.format === 'teams' ? teamsOf(c).map(t => t.name).join(' vs ') : FORMATS[c.format];
  const who = c.format === 'teams' ? '' : c.entrants === 'picked' ? ` · ${c.participants.length} picked reps` : ` · ${c.group === 'All' ? 'Everyone' : c.group}`;
  return `${metric}${scoring} · ${fmt}${who} · ${c.start === c.end ? c.start : `${c.start} to ${c.end}`}`;
}

function list(state) {
  const box = el('div', 'abox'); const now = today();
  const f = state.ui.contestFilter || 'active';
  box.append(seg(FILTERS, f, v => { state.ui.contestFilter = v; state.rerender(); }, 'Which contests'));
  const name = id => state.reps.find(r => r.id === id)?.name || id;
  const shown = state.contests.filter(c => { const st = statusOf(c, now); return f === 'all' || (f === 'active' ? st === 'live' : st === f); });
  if (!shown.length) box.append(el('p', 'amuted', f === 'all' ? 'No contests yet. Create the first one with the form.' : `No ${FILTERS.find(x => x[0] === f)[1].toLowerCase()} contests.`));
  for (const c of shown) {
    const st = statusOf(c, now); const item = el('div', 'aitem'); const info = el('div');
    const top = el('div', 'arow'); top.append(el('b', null, c.name), el('span', `tag ${st === 'live' ? 'live' : st}`, st));
    info.append(top, el('div', 'amuted', summary(c)));
    if (c.format === 'teams') for (const t of teamsOf(c)) info.append(el('div', 'amuted', `${t.name}: ${t.members.map(name).join(', ')}`));
    else if (c.entrants === 'picked') info.append(el('div', 'amuted', `Reps: ${c.participants.map(p => name(p.id)).join(', ')}`));
    if (c.goal) info.append(el('div', 'amuted', `Goal: ${c.goal}`));
    if (c.prize) info.append(el('div', 'amuted', `Prize: ${c.prize}`));
    const acts = el('div', 'arow');
    const del = button('Delete', async () => {
      if (del.dataset.confirm !== '1') { del.dataset.confirm = '1'; del.textContent = 'Select again to delete'; return; }
      try { await state.remove(c.id); toast('Competition deleted'); if (state.contestDraft?.id === c.id) state.contestDraft = null; await state.reload(); }
      catch (e) { toast(`Couldn't delete: ${e.message}`); }
    }, 'danger');
    acts.append(button('Edit', () => { state.contestDraft = editable(c); state.rerender(); }),
      button('Copy', () => { state.contestDraft = editable(copyContest(c)); state.rerender(); toast('Copied into the form'); }), del);
    item.append(info, acts); box.append(item);
  }
  return box;
}

function measuredOn(D, state) {
  const g = el('div', 'seg'); g.setAttribute('role', 'group'); g.setAttribute('aria-label', 'Measured on');
  for (const [k, l] of Object.entries(MEASURES)) {
    const b = el('button', null, l); b.type = 'button'; b.setAttribute('aria-pressed', D.metrics.includes(k));
    b.onclick = () => {
      if (k === 'score') D.metrics = ['score'];
      else {
        let m = D.metrics.filter(x => x !== 'score');
        if (m.includes(k)) m = m.filter(x => x !== k);
        else { if (m.length >= 3) return toast('Pick up to three KPIs.'); m.push(k); }
        D.metrics = m.length ? m : ['score'];
      }
      state.rerender();
    };
    g.append(b);
  }
  const note = D.metrics[0] === 'score' ? 'Activity Score uses this contest\'s scoring weights. Or pick up to three KPIs.'
    : D.metrics.length > 1 ? `${D.metrics.length} KPIs: each rep's result is the average of their % on each one, or the combined total for raw scoring.` : 'Pick up to two more to combine them.';
  return field('Measured on', g, el('div', 'amuted', note));
}

function teamPicker(D, state, reps) {
  const box = el('div'); const taken = D.teams.flatMap(t => t.members);
  D.teams.forEach((t, i) => {
    const c = el('div', 'kcell'); c.style.marginBottom = '10px';
    const hr = el('div', 'arow');
    // Team names come from the Contest_Side picklist; each can only be used once.
    const free = TEAMS.filter(s => s === t.name || !D.teams.some(o => o.name === s));
    hr.append(select(free.map(s => [s, s]), t.name, v => { t.name = v; state.rerender(); }, `Team ${i + 1}`));
    if (D.teams.length > 2) hr.append(button('Remove team', () => { D.teams.splice(i, 1); state.rerender(); }, 'danger'));
    c.append(hr, el('div', 'd', t.members.length === 1 ? '1 rep' : `${t.members.length} reps`),
      repPicker({ selected: t.members, reps, exclude: taken.filter(id => !t.members.includes(id)), onChange: v => { t.members = v; state.rerender(); } }));
    box.append(c);
  });
  const next = TEAMS.find(s => !D.teams.some(t => t.name === s));
  const addTeam = button('Add another team', () => { D.teams.push({ name: next, members: [] }); state.rerender(); });
  addTeam.disabled = !next;
  box.append(addTeam);
  return field('Teams', box, el('div', 'amuted', 'For a 1v1, put one rep on each team. For 2v2, two each.'));
}

function form(state) {
  const D = state.contestDraft || (state.contestDraft = fresh(state));
  const box = el('div', 'abox'); const reps = repsFor(state, D.group);
  box.append(el('b', null, D.id ? 'Edit competition' : 'New competition'));
  box.append(field('Name', textInput(D.name, { label: 'Name', placeholder: 'e.g. Director Appointment Play Off', onChange: v => { D.name = v; } })));
  box.append(field('Group', seg([...Object.keys(GROUPS).map(g => [g, g]), ['All', 'All']], D.group, v => {
    D.group = v;
    if (!D.id) Object.assign(D, clone(prefillFromBoards(v, state.boards, state.cfg)));
    if (v !== 'All' && D.format === 'division') D.format = 'individual';
    state.rerender();
  }, 'Group')));
  box.append(measuredOn(D, state));
  if (D.metrics[0] !== 'score') {
    box.append(field('Scoring', select(Object.entries(SCORING), D.scoring, v => { D.scoring = v; state.rerender(); }, 'Scoring')));
    if (D.scoring === 'fixed') {
      const row = el('div', 'arow');
      for (const k of D.metrics) {
        const w = el('div'); if (D.metrics.length > 1) w.append(el('div', 'amuted', MEASURES[k]));
        w.append(numInput(D.fixedTargets[k], { min: 1, label: `${MEASURES[k]} target`, onChange: v => { D.fixedTargets[k] = v; } })); row.append(w);
      }
      box.append(field(D.metrics.length > 1 ? 'Target per rep for the whole competition (each KPI)' : 'Target per rep for the whole competition', row,
        el('div', 'amuted', 'Everyone is measured against the same number, whatever their level.')));
    }
  }
  const formats = Object.entries(FORMATS).filter(([k]) => k !== 'division' || D.group === 'All');
  box.append(field('Format', select(formats, D.format, v => { D.format = v; state.rerender(); }, 'Format')));
  if (D.format === 'teams') box.append(teamPicker(D, state, reps));
  if (D.format === 'individual') {
    box.append(field("Who's in", select([['group', D.group === 'All' ? 'Everyone' : `Everyone in ${D.group}`], ['picked', 'Pick reps…']], D.entrants, v => { D.entrants = v; state.rerender(); }, "Who's in")));
    if (D.entrants === 'picked') box.append(field('Reps in this competition', repPicker({ selected: D.participants.map(p => p.id), reps,
      onChange: v => { D.participants = v.map(id => ({ id, team: '' })); state.rerender(); } })));
  }
  if (D.format !== 'individual') box.append(field('Team score', select(Object.entries(TEAM_CALC), D.teamCalc, v => { D.teamCalc = v; }, 'Team score')));

  const when = el('div');
  when.append(seg(WHEN, D.when, v => { D.when = v; if (v !== 'custom') [D.start, D.end] = periodDates(v, today()); state.rerender(); }, 'When'));
  if (D.when === 'custom') {
    const row = el('div', 'arow'); row.style.marginTop = '8px';
    const s = el('input'); s.type = 'date'; s.value = D.start; s.setAttribute('aria-label', 'Start date'); s.onchange = () => { D.start = s.value; };
    const e = el('input'); e.type = 'date'; e.value = D.end; e.setAttribute('aria-label', 'End date'); e.onchange = () => { D.end = e.value; };
    row.append(s, el('span', 'amuted', 'to'), e); when.append(row);
  } else when.append(el('div', 'amuted', D.start === D.end ? D.start : `${D.start} to ${D.end}`));
  box.append(field('When', when));
  box.append(field('Goal (optional)', textInput(D.goal, { label: 'Goal', placeholder: 'e.g. First to 5 senior meetings', onChange: v => { D.goal = v; } })));
  box.append(field('Prize (optional)', textInput(D.prize, { label: 'Prize', placeholder: 'e.g. $100 gift card', onChange: v => { D.prize = v; } })));

  const more = el('details', 'more'); more.open = !!state.ui.contestMore;
  more.ontoggle = () => { state.ui.contestMore = more.open; };
  more.append(el('summary', null, 'Targets and weights for this contest'),
    el('p', 'amuted', `Copied from the ${D.group === 'All' ? 'SDR, BDR and Trainee' : D.group} Board when the form opened. Changes here only apply to this contest.`),
    targetsEditor(D, { reps, cfg: state.cfg, ui: state.ui, rerender: state.rerender }));
  box.append(more);

  const actions = el('div', 'arow'); actions.style.marginTop = '14px';
  const save = button(D.id ? 'Save changes' : 'Create competition', async () => {
    const out = { ...D, name: D.name.trim(), goal: D.goal.trim(), prize: D.prize.trim() };
    out.participants = D.format === 'teams' ? participantsFromTeams(D.teams) : D.format === 'individual' && D.entrants === 'picked' ? D.participants : [];
    if (out.metrics[0] === 'score') out.scoring = 'target';
    out.fixedTargets = out.scoring === 'fixed' ? Object.fromEntries(out.metrics.filter(k => k !== 'score').map(k => [k, D.fixedTargets[k]])) : {};
    const err = validateContest(out);
    if (err) return toast(err);
    save.disabled = true;
    try {
      await state.save(toRecord(out));
      toast(D.id ? 'Competition saved' : 'Competition created');
      state.contestDraft = null; await state.reload();
    } catch (e) { toast(`Couldn't save: ${e.message}`); save.disabled = false; }
  }, 'primary');
  actions.append(save);
  if (D.id || D.name) actions.append(button('Clear form', () => { state.contestDraft = null; state.rerender(); }));
  box.append(actions);
  return box;
}

export function renderContests(root, state) {
  root.append(el('h2', null, 'Contests'),
    el('p', 'lede', "Run a contest on one to three KPIs (or the Activity Score), for any group of reps, over any dates. Each contest has its own targets and weights, copied from its group's Board."));
  if (!Object.keys(state.boards).length) root.append(banner('No Board records were found, so new contests start from the default targets.', 'info'));
  const g = el('div', 'agrid'); g.append(list(state), form(state));
  root.append(g);
}
