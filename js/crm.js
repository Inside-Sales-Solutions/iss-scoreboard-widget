// Every Zoho SDK call the board and the admin page make. Data access goes through the SDK 1.5
// request client (zrc) to API v8; org variables through ZOHO.CRM.API.getOrgVariable.

import { RECORD_FIELDS } from './settings.js';

export const MODULE = 'Scoreboard_Targets';
export const HOLIDAYS_VAR = 'scoreboard_holidays';
export const COQL_PATH = '/crm/v8/coql';

// zrc wraps the HTTP body as { data: body, ... }. Errors come back thrown, with the body inside.
function bodyOf(res) {
  let body = res && !Array.isArray(res.data) && res.data && typeof res.data === 'object' ? res.data : res;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { /* not JSON */ } }
  if (body?.status === 'error') throw new Error(`${body.code}: ${body.message}`);
  return body;
}
async function call(fn) {
  try { return bodyOf(await fn()); } catch (err) {
    const body = err?.data ?? err?.response?.data ?? err;
    throw new Error(body?.message ? `${body.code || 'CRM error'}: ${body.message}` : (err?.message || String(err)));
  }
}

// COQL goes to /crm/v8/coql. ZOHO.CRM.API.coql is pinned to /crm/v2/coql, which has no
// aggregate functions (COUNT/SUM/GROUP BY), and the board depends on them.
export async function coql(query) {
  const body = await call(() => zrc.post(COQL_PATH, { select_query: query }));
  if (!coql.logged) { coql.logged = true; console.info('[ISS Scoreboard] first zrc COQL response', body); }
  return body || { data: [], info: {} };
}

// All Board and Contest records with their subform rows. A few dozen at most.
export async function listSettings() {
  const out = [];
  for (let page = 1; ; page++) {
    const body = await call(() => zrc.get(`/crm/v8/${MODULE}?fields=${RECORD_FIELDS.join(',')}&per_page=200&page=${page}`));
    out.push(...(body?.data || []));
    if (!body?.info?.more_records) break;
  }
  // The list call leaves subforms out (checked 2026-11-02), so read each record on its own.
  return Promise.all(out.map(r => ('Level_Targets' in r ? r : call(() => zrc.get(`/crm/v8/${MODULE}/${r.id}?fields=${RECORD_FIELDS.join(',')}`)).then(b => b?.data?.[0] || r))));
}

const firstResult = body => {
  const d = body?.data?.[0];
  if (!d || d.status !== 'success') throw new Error(d?.message || 'The CRM did not save the record.');
  return { id: String(d.details?.id || '') };
};
export const saveSetting = record => call(() => (record.id ? zrc.put(`/crm/v8/${MODULE}`, { data: [record] }) : zrc.post(`/crm/v8/${MODULE}`, { data: [record] }))).then(firstResult);
export const deleteSetting = id => call(() => zrc.delete(`/crm/v8/${MODULE}?ids=${id}`)).then(firstResult);

export async function getHolidays() {
  const res = await ZOHO.CRM.API.getOrgVariable(HOLIDAYS_VAR);
  if (res?.Error) throw new Error(res.Error.Content || 'Holidays variable not readable');
  return res?.Success?.Content ?? null;
}
export const setHolidays = value => call(() => zrc.put(`/crm/v8/settings/variables/${HOLIDAYS_VAR}`, { variables: [{ value }] }));

export const currentUser = () => ZOHO.CRM.CONFIG.getCurrentUser()
  .then(res => res?.users?.[0] || null)
  .catch(err => { console.warn('[ISS Scoreboard] could not read the current user', err); return null; });

// CRM puts the widget's context in the iframe URL's query string, and the SDK needs it on every page.
export const pageHref = page => page + (globalThis.location?.search || '');
