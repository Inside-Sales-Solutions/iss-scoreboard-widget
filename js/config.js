// Dashboard-layer settings. Copied from Aidan's DATA.config (snapshot 2026-10-30).
// Targets, weights and competitions live in the Scoreboard Targets CRM module (Board and Contest
// records); holidays in the scoreboard_holidays variable. `defaults` is only used when a Board record
// can't be loaded. Edit the CRM records on the Scoreboard Admin page, not these numbers.

export const CONFIG = {
  tz: 'America/New_York',
  // WarDialers left off for now (Aidan, 2026-11-02).
  teams: ['P4P Division', 'BDR Division', 'Training'],
  defaults: {
    dailyTargets: { calls: 175, scheduled: 2, attended: 1, firstEnc: 1, senior: 1, referrals: 0 },
    weights: { attended: 15, calls: 10, firstEnc: 10, points: 25, referrals: 0, schedPoints: 0, scheduled: 25, senior: 5 },
    cap: 1.5,
  },
  nhPoints: 8,
  // Monthly attended target for levels without a number above 12 ("Hit 8", "BDR", "BDR 8").
  minAttendedLevel: 12,
  ladder: [
    [0, 'Trainee'],
    [8, 'Sales Development Representative'],
    [16, 'Senior Sales Development Representative'],
    [20, 'Senior Sales Development Specialist'],
    [24, 'Sales Development Analyst'],
    [28, 'Senior Sales Development Analyst'],
    [32, 'Sales Development Associate'],
    [36, 'Senior Sales Development Associate'],
    [40, 'Sales Consultant'],
    [44, 'Sales Development Consultant'],
    [48, 'Sales Advisor'],
    [52, 'Senior Sales Advisor'],
    [56, 'Sales Executive'],
    [60, 'Senior Sales Executive'],
  ],
  // Who sees the "View rep" picker, by CRM profile or role name. Add role names here later.
  repPicker: { profiles: ['Administrator'], roles: [] },
};
