// Who gets extra controls. Decided from the CRM user's profile and role names in config.

export function canPickReps(user, cfg) {
  if (!user) return false;
  const rule = cfg.repPicker || {};
  const profile = user.profile?.name || user.profile || '';
  const role = user.role?.name || user.role || '';
  return (rule.profiles || []).includes(profile) || (rule.roles || []).includes(role);
}
