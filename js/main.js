// Widget entry: initialise the Zoho SDK, load live data from the CRM, render.

import { CONFIG } from './config.js';
import { loadData } from './data.js';
import { mount, setData, setViewer } from './render.js';
import { canPickReps, viewerTeam } from './access.js';
import { coql, currentUser, getHolidays, listSettings, pageHref } from './crm.js';

const $ = id => document.getElementById(id);

const safeStorage = s => ({
  get: k => { try { return JSON.parse(s.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { s.setItem(k, JSON.stringify(v)); } catch { /* full or blocked */ } },
});
const local = (() => { try { return safeStorage(window.localStorage); } catch { return null; } })();

function showError(err) {
  $('loading').hidden = true;
  const box = $('failure'); box.hidden = false; box.textContent = '';
  const h = document.createElement('h3'); h.textContent = "The scoreboard couldn't load";
  const p = document.createElement('p'); p.textContent = err?.message || String(err);
  box.append(h, p);
  if (err?.query) { const q = document.createElement('p'); const c = document.createElement('code'); c.textContent = err.query; q.append('Query: ', c); box.append(q); }
  const r = document.createElement('p'); r.textContent = 'Try Refresh. If it keeps failing, send this message to John.'; box.append(r);
  $('refresh').hidden = false; $('refresh').disabled = false;
}

// Always live: every open and every Refresh queries the CRM. Only completed past days'
// call counts are reused (localStorage), since those days are over.
const load = () => loadData({ coql, listSettings, getHolidays, cfg: CONFIG, store: local });

// The viewer is known before the first render, so a rep never sees other divisions flash up.
let viewer = Promise.resolve(null);

async function show() {
  const btn = $('refresh');
  btn.disabled = true; btn.textContent = 'Refreshing…';
  $('failure').hidden = true;
  if ($('app').hidden) $('loading').hidden = false;
  try {
    const [data, user] = await Promise.all([load(), viewer]);
    const admin = canPickReps(user, CONFIG);
    setViewer({ canPick: admin, team: viewerTeam(user, data.reps, CONFIG) });
    $('admin-link').hidden = !admin;
    if (admin) $('admin-link').href = pageHref('admin.html');
    setData(data);
    $('loading').hidden = true; $('app').hidden = false;
  } catch (err) {
    console.error('Scoreboard load failed', err);
    showError(err);
  } finally {
    btn.hidden = false; btn.disabled = false; btn.textContent = 'Refresh';
  }
}

function start() {
  mount();
  $('refresh').onclick = () => show();
  if (typeof ZOHO === 'undefined' || !ZOHO.embeddedApp) { showError(new Error('The Zoho SDK did not load. Open this page from the Scoreboard tab in Zoho CRM.')); return; }
  // JS SDK 1.5: init() resolves once CRM has handed the widget its context.
  let started = false;
  ZOHO.embeddedApp.init().then(() => {
    started = true;
    viewer = currentUser();
    show();
  });
  setTimeout(() => { if (!started) showError(new Error('This page only works inside Zoho CRM. Open it from the Scoreboard tab.')); }, 10000);
}

start();
