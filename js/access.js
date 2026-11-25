// Who gets extra controls. Decided from the CRM user's profile and role names in config.

export function canPickReps(user, cfg) {
  if (!user) return false;
  const rule = cfg.repPicker || {};
  const norm = v => String(v || '').trim().toLowerCase();
  const profile = norm(user.profile?.name || user.profile);
  const role = norm(user.role?.name || user.role);
  const has = (list, v) => !!v && (list || []).some(x => norm(x) === v);
  return has(rule.profiles, profile) || has(rule.roles, role);
}

// The team a viewer is limited to (Aidan, 2026-11-02: reps only see their own division).
// Null means the full board: admins, and anyone who isn't a rep on the board (managers).
export function viewerTeam(user, reps, cfg) {
  if (!user || canPickReps(user, cfg)) return null;
  return reps.find(r => r.id === String(user.id))?.team || null;
}
