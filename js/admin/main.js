// Scoreboard Admin entry: initialise the SDK, check the Administrator profile, load the
// Scoreboard Targets records and the reps, then show the chosen tab.

import { CONFIG } from '../config.js';
import { canPickReps } from '../access.js';
import { makeRunner } from '../coql.js';
import { isBoardRep, usersQuery } from '../data.js';
import { boardsByGroup, groupOf, parseRecord, pickLevel } from '../settings.js';
import { coql, currentUser, deleteSetting, getHolidays, listSettings, pageHref, saveSetting, setHolidays } from '../crm.js';
import { renderBoards } from './boards.js';
import { renderContests } from './contests.js';
import { renderHolidays } from './holidays.js';
import { banner } from './ui.js';

const $ = id => document.getElementById(id);
const CFG = { ...CONFIG, ...CONFIG.defaults };
const TABS = { boards: renderBoards, contests: renderContests, holidays: renderHolidays };

const state = {
  tab: TABS[location.hash.slice(1)] ? location.hash.slice(1) : 'boards',
  cfg: CFG, settings: [], boards: {}, contests: [], reps: [], drafts: {}, ui: {}, boardGroup: 'SDR',
  save: saveSetting, remove: deleteSetting, getHolidays, setHolidays,
};

function render() {
  for (const b of document.querySelectorAll('#tabs button')) b.setAttribute('aria-pressed', b.dataset.tab === state.tab);
  const root = $('admin');
  // Keep the page from jumping when a tab re-renders.
  const y = window.scrollY;
  root.textContent = '';
  TABS[state.tab](root, state);
  window.scrollTo(0, y);
}
state.rerender = render;

async function reload() {
  const recs = await listSettings();
  state.settings = recs.map(parseRecord);
  state.boards = boardsByGroup(state.settings).boards;
  state.contests = state.settings.filter(s => s.type === 'contest').sort((a, b) => (b.start || '').localeCompare(a.start || ''));
  render();
}
state.reload = reload;

async function loadReps() {
  const users = await makeRunner(coql).all(usersQuery(CONFIG));
  return users.filter(u => isBoardRep(u, CONFIG))
    .map(u => ({ id: String(u.id), name: `${u.first_name || ''} ${u.last_name || ''}`.trim(), team: u.Team, group: groupOf(u.Team), level: pickLevel(u.Payband_Milestone) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function fail(msg) { const root = $('admin'); root.textContent = ''; root.append(banner(msg, 'bad')); }

async function start() {
  $('back').href = pageHref('index.html');
  $('help-link').href = pageHref('help.html') + '#admin';
  const user = await currentUser();
  if (!canPickReps(user, CONFIG)) return fail('You need the Administrator profile to change scoreboard settings.');
  for (const b of document.querySelectorAll('#tabs button')) b.onclick = () => {
    state.tab = b.dataset.tab;
    try { history.replaceState(null, '', '#' + state.tab); } catch { /* sandboxed frame */ }
    render();
  };
  $('tabs').hidden = false;
  try {
    state.reps = await loadReps();
    await reload();
  } catch (err) {
    console.error('[ISS Scoreboard admin] load failed', err);
    fail(`Settings couldn't load: ${err.message}`);
  }
}

if (typeof ZOHO === 'undefined' || !ZOHO.embeddedApp) fail('The Zoho SDK did not load. Open this page from the Scoreboard tab in Zoho CRM.');
else {
  let started = false;
  ZOHO.embeddedApp.init().then(() => { started = true; start(); });
  setTimeout(() => { if (!started) fail('This page only works inside Zoho CRM. Open it from the Scoreboard tab.'); }, 10000);
}
