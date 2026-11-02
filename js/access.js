// Who gets extra controls. Decided from the CRM user's profile and role names in config.

export function canPickReps(user, cfg) {
  if (!user) return false;
  const rule = cfg.repPicker || {};
  const profile = user.profile?.name || user.profile || '';
  const role = user.role?.name || user.role || '';
  return (rule.profiles || []).includes(profile) || (rule.roles || []).includes(role);
}

// The team a viewer is limited to (Aidan, 2026-11-02: reps only see their own division).
// Null means the full board: admins, and anyone who isn't a rep on the board (managers).
export function viewerTeam(user, reps, cfg) {
  if (!user || canPickReps(user, cfg)) return null;
  return reps.find(r => r.id === String(user.id))?.team || null;
}
