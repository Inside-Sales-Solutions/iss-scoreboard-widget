// Widget entry: initialise the Zoho SDK, load live data from the CRM, render.

import { CONFIG } from './config.js';
import { loadData } from './data.js';
import { mount, setData, setViewer } from './render.js';
import { canPickReps, viewerTeam } from './access.js';

const $ = id => document.getElementById(id);

const safeStorage = s => ({
  get: k => { try { return JSON.parse(s.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { s.setItem(k, JSON.stringify(v)); } catch { /* full or blocked */ } },
});
const local = (() => { try { return safeStorage(window.localStorage); } catch { return null; } })();

// COQL goes through the SDK 1.5 request client (zrc) to API v8. ZOHO.CRM.API.coql is pinned to
// /crm/v2/coql, which has no aggregate functions (COUNT/SUM/GROUP BY), and the board depends on them.
export const COQL_PATH = '/crm/v8/coql';
async function coql(query) {
  let res;
  try {
    res = await zrc.post(COQL_PATH, { select_query: query });
  } catch (err) {
    const body = err?.data ?? err?.response?.data ?? err;
    throw new Error(body?.message ? `${body.code || 'COQL error'}: ${body.message}` : (err?.message || String(err)));
  }
  // zrc wraps the HTTP body as { data: body, ... }; COQL's own body is { data: [rows], info }.
  if (!coql.logged) { coql.logged = true; console.info('[ISS Scoreboard] first zrc COQL response', res); }
  let body = res && !Array.isArray(res.data) && res.data && typeof res.data === 'object' ? res.data : res;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { /* not JSON */ } }
  if (body?.status === 'error') throw new Error(`${body.code}: ${body.message}`);
  return body || { data: [], info: {} };
}

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
const load = () => loadData({ coql, cfg: CONFIG, store: local });

// The viewer is known before the first render, so a rep never sees other divisions flash up.
let viewer = Promise.resolve(null);

async function show() {
  const btn = $('refresh');
  btn.disabled = true; btn.textContent = 'Refreshing…';
  $('failure').hidden = true;
  if ($('app').hidden) $('loading').hidden = false;
  try {
    const [data, user] = await Promise.all([load(), viewer]);
    setViewer({ canPick: canPickReps(user, CONFIG), team: viewerTeam(user, data.reps, CONFIG) });
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
    viewer = ZOHO.CRM.CONFIG.getCurrentUser()
      .then(res => res?.users?.[0] || null)
      .catch(err => { console.warn('[ISS Scoreboard] could not read the current user', err); return null; });
    show();
  });
  setTimeout(() => { if (!started) showError(new Error('This page only works inside Zoho CRM. Open it from the Scoreboard tab.')); }, 10000);
}

start();
