// Small DOM helpers shared by the admin tabs.

export const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
}

export const banner = (text, kind = '') => el('div', `abanner ${kind}`.trim(), text);

export function button(text, onClick, cls = '') {
  const b = el('button', `btn ${cls}`.trim(), text); b.type = 'button'; b.onclick = onClick; return b;
}

// A number input whose blank value reads as null (blank means "use the level's number").
export function numInput(value, { min = 0, placeholder = '', label = '', onChange } = {}) {
  const i = el('input'); i.type = 'number'; i.min = String(min); i.step = '1';
  i.value = value ?? ''; i.placeholder = placeholder ?? '';
  if (label) i.setAttribute('aria-label', label);
  i.oninput = () => onChange?.(i.value === '' ? null : Math.max(min, Number(i.value)));
  return i;
}

export function textInput(value, { placeholder = '', label = '', onChange } = {}) {
  const i = el('input'); i.type = 'text'; i.value = value ?? ''; i.placeholder = placeholder;
  if (label) i.setAttribute('aria-label', label);
  i.oninput = () => onChange?.(i.value);
  return i;
}

export function select(options, value, onChange, label = '') {
  const s = el('select');
  for (const [v, l] of options) s.append(new Option(l, v));
  s.value = value; if (label) s.setAttribute('aria-label', label);
  s.onchange = () => onChange(s.value);
  return s;
}

// Segmented buttons, like the board's period switch.
export function seg(options, value, onChange, label = '') {
  const g = el('div', 'seg'); g.setAttribute('role', 'group'); if (label) g.setAttribute('aria-label', label);
  for (const [v, l] of options) { const b = el('button', null, l); b.type = 'button'; b.setAttribute('aria-pressed', v === value); b.onclick = () => onChange(v); g.append(b); }
  return g;
}

export function field(label, ...nodes) {
  const f = el('div', 'afield'); f.append(el('div', 'lab', label), ...nodes); return f;
}

const repLabel = r => `${r.name} · ${r.level || 'no level'}`;

// Checkbox list of reps with a filter, Select all / Clear, and shift-click to tick or untick a
// range. `exclude` hides reps used elsewhere. Every change re-renders the form, so the shift-click
// anchor, filter text and list scroll are kept per picker `key`.
const pickerState = {};
export function repPicker({ selected, reps, exclude = [], onChange, key = 'reps' }) {
  const ps = pickerState[key] || (pickerState[key] = { anchor: null, filter: '', scroll: 0 });
  const list = reps.filter(r => selected.includes(r.id) || !exclude.includes(r.id));
  const matches = r => repLabel(r).toLowerCase().includes(ps.filter.trim().toLowerCase());
  const visible = () => list.filter(matches);
  const apply = (ids, on) => {
    const out = selected.filter(id => on || !ids.includes(id));
    if (on) for (const id of ids) if (!out.includes(id)) out.push(id);
    onChange(out);
  };

  const wrap = el('div', 'rpick'); const head = el('div', 'rpick-head');
  const q = el('input'); q.type = 'text'; q.placeholder = 'Filter reps…'; q.value = ps.filter; q.setAttribute('aria-label', 'Filter reps');
  head.append(q, el('span', 'amuted', `${selected.length} of ${list.length} selected`),
    button('Select all', () => apply(visible().map(r => r.id), true)),
    button('Clear', () => apply(visible().map(r => r.id), false)));

  const box = el('div', 'rpick-list'); const items = [];
  for (const r of list) {
    const lab = el('label', 'rpick-item'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = selected.includes(r.id);
    cb.onclick = e => {
      let ids = [r.id]; const vis = visible();
      const i = vis.findIndex(x => x.id === ps.anchor), j = vis.findIndex(x => x.id === r.id);
      if (e.shiftKey && i >= 0 && j >= 0) ids = vis.slice(Math.min(i, j), Math.max(i, j) + 1).map(x => x.id);
      ps.anchor = r.id; ps.scroll = box.scrollTop;
      apply(ids, cb.checked);
    };
    lab.append(cb, el('span', null, r.name), el('span', 'amuted', r.level || 'no level'));
    lab.hidden = !matches(r); items.push([r, lab]); box.append(lab);
  }
  if (!list.length) box.append(el('span', 'amuted', 'No reps available'));
  q.oninput = () => { ps.filter = q.value; for (const [r, lab] of items) lab.hidden = !matches(r); };
  wrap.append(head, box, el('div', 'amuted', 'Shift-click to tick or untick every rep between two clicks.'));
  requestAnimationFrame(() => { box.scrollTop = ps.scroll; });
  return wrap;
}
