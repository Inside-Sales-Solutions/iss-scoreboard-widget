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

// Chips for the chosen reps plus an "Add a rep…" dropdown. `exclude` hides reps used elsewhere.
export function repPicker({ selected, reps, exclude = [], onChange }) {
  const wrap = el('div'); const chips = el('div', 'arow'); chips.style.margin = '0 0 6px';
  const byId = Object.fromEntries(reps.map(r => [r.id, r]));
  for (const id of selected) {
    const c = el('span', 'chipx'); c.append(document.createTextNode(byId[id]?.name || id));
    const x = el('button', null, '×'); x.type = 'button'; x.setAttribute('aria-label', `Remove ${byId[id]?.name || id}`);
    x.onclick = () => onChange(selected.filter(v => v !== id)); c.append(x); chips.append(c);
  }
  if (!selected.length) chips.append(el('span', 'amuted', 'No reps yet'));
  const s = el('select'); s.append(new Option('Add a rep…', ''));
  for (const r of reps) if (!selected.includes(r.id) && !exclude.includes(r.id)) s.append(new Option(repLabel(r), r.id));
  s.onchange = () => { if (s.value) onChange([...selected, s.value]); };
  wrap.append(chips, s);
  return wrap;
}
