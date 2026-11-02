// Holidays tab: the dates taken out of working days, saved to the scoreboard_holidays variable.

import { dow } from '../dates.js';
import { isRealDate, parseHolidays, serializeHolidays, validateHolidays } from '../settings.js';
import { banner, button, el, textInput, toast } from './ui.js';

async function load(state) {
  const h = state.ui.holidays = { list: [], broken: false, readOnly: false, loaded: false };
  try {
    const parsed = parseHolidays(await state.getHolidays());
    h.list = parsed.list; h.broken = parsed.error;
  } catch (e) { h.broken = true; console.warn('[ISS Scoreboard admin] holidays read failed', e); }
  h.loaded = true; state.rerender();
}

export function renderHolidays(root, state) {
  root.append(el('h2', null, 'Holidays'),
    el('p', 'lede', 'Dates listed here are not working days. Every daily target, the digest and contests skip them.'));
  const h = state.ui.holidays;
  if (!h) { root.append(el('p', 'amuted', 'Loading holidays…')); load(state); return; }
  if (!h.loaded) { root.append(el('p', 'amuted', 'Loading holidays…')); return; }
  if (h.broken) root.append(banner("The saved holiday list couldn't be read. Saving here replaces it."));
  if (h.readOnly) root.append(banner("Holidays can't be saved from here. Edit scoreboard_holidays in Setup > Variables.", 'bad'));

  const box = el('div', 'abox');
  if (!h.list.length) box.append(el('p', 'amuted', 'No holidays. Working days are Monday to Friday.'));
  h.list.forEach((row, i) => {
    const r = el('div', 'arow'); r.style.marginBottom = '8px';
    const d = el('input'); d.type = 'date'; d.value = row.date; d.setAttribute('aria-label', 'Holiday date'); d.disabled = h.readOnly;
    d.onchange = () => { row.date = d.value; state.rerender(); };
    const name = textInput(row.name, { label: 'Holiday name', placeholder: 'e.g. Thanksgiving', onChange: v => { row.name = v; } });
    name.style.maxWidth = '280px'; name.disabled = h.readOnly;
    const rm = button('Remove', () => { h.list.splice(i, 1); state.rerender(); }, 'danger'); rm.disabled = h.readOnly;
    r.append(d, name, rm);
    if (isRealDate(row.date) && [0, 6].includes(dow(row.date))) r.append(el('span', 'amuted', "Falls on a weekend, so it doesn't change working days."));
    box.append(r);
  });
  const acts = el('div', 'arow'); acts.style.marginTop = '12px';
  const add = button('Add holiday', () => { h.list.push({ date: '', name: '' }); state.rerender(); }); add.disabled = h.readOnly;
  const save = button('Save', async () => {
    const err = validateHolidays(h.list);
    if (err) return toast(err);
    save.disabled = true;
    try {
      await state.setHolidays(serializeHolidays(h.list));
      h.list.sort((a, b) => a.date.localeCompare(b.date)); h.broken = false;
      toast('Holidays saved'); state.rerender();
    } catch (e) {
      console.warn('[ISS Scoreboard admin] holidays save failed', e);
      h.readOnly = true; state.rerender();
    }
  }, 'primary');
  save.disabled = h.readOnly;
  acts.append(add, save); box.append(acts);
  root.append(box);
}
