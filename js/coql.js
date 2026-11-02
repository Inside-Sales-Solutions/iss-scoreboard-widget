// COQL helpers. COQL wants conditions joined two at a time, so and() nests them.

export const and = (...conds) => conds.filter(Boolean).reduce((a, b) => `(${a} and ${b})`);
export const between = (field, [a, b]) => `${field} between '${a}' and '${b}'`;
export const inList = (field, vals) => `${field} in (${vals.map(v => `'${v.replace(/'/g, "\\'")}'`).join(',')})`;

export const PAGE = 2000;

// Wraps the SDK call: counts queries, caps how many run at once, and normalises the response.
export function makeRunner(coqlFn, { concurrency = 6 } = {}) {
  let active = 0;
  const queue = [];
  const stats = { queries: 0, failed: 0 };
  const next = () => {
    if (active >= concurrency || !queue.length) return;
    const { query, resolve, reject } = queue.shift();
    active++; stats.queries++;
    Promise.resolve()
      .then(() => coqlFn(query))
      .then(res => resolve({ data: res?.data || [], more: !!res?.info?.more_records }),
        err => { stats.failed++; reject(Object.assign(new Error(describe(err)), { query, cause: err })); })
      .finally(() => { active--; next(); });
  };
  const run = query => new Promise((resolve, reject) => { queue.push({ query, resolve, reject }); next(); });
  const all = async query => {
    const out = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data, more } = await run(`${query} limit ${offset}, ${PAGE}`);
      out.push(...data);
      if (!more || data.length < PAGE) return out;
    }
  };
  return { run, all, stats };
}

function describe(err) {
  if (!err) return 'COQL query failed';
  if (typeof err === 'string') return err;
  return err.message || err.data?.[0]?.message || err.code || JSON.stringify(err).slice(0, 300);
}
