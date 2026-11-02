// Dashboard-layer settings. Copied from Aidan's DATA.config (snapshot 2026-10-30).
// Targets and weights are drafts until Aidan confirms them (questions 9 and 10).

export const CONFIG = {
  tz: 'America/New_York',
  teams: ['P4P Division', 'BDR Division', 'Training', 'WarDialers'],
  placeholderTargets: true,
  dailyTargets: { calls: 175, scheduled: 2, attended: 1, firstEnc: 1, senior: 1, referrals: 0 },
  weights: { attended: 15, calls: 10, firstEnc: 10, points: 25, referrals: 0, schedPoints: 0, scheduled: 25, senior: 5 },
  cap: 1.5,
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
  // Competitions. This file is published, so list participants by CRM user ID, never by name.
  // { id, name, start: 'YYYY-MM-DD', end, goal, prize,
  //   metric: 'score' | one KPI key, metrics: [KPI keys] (for non-score),
  //   format: 'individual' | 'teams' | 'division', scoring: 'raw' | 'fixed' | 'target',
  //   fixedTargets: { calls: 250 }, teamCalc: 'avg' | 'sum',
  //   who: 'All' | 'BDR Division' | ... (individual), teams: [{ name, members: [userId] }] }
  competitions: [
    // Aidan's October 2026 competitions, copied from his scoreboard page (snapshot 2026-10-30).
    {
      id: 'ozlmzj8xb95fns3kt62m', name: 'Director Activity Play off', start: '2026-10-26', end: '2026-10-30', goal: '', prize: '',
      metric: 'score', metrics: ['score'], format: 'teams', scoring: 'target', teamCalc: 'avg',
      teams: [
        { name: 'Team 1', members: ['6556356000061053071'] },
        { name: 'Team 2', members: ['6556356000061053063'] },
      ],
    },
    {
      id: 'fms54fmytv47pvlea5tc', name: 'Trainnee Comp.', start: '2026-10-28', end: '2026-10-31', goal: '', prize: '',
      metric: 'score', metrics: ['score'], format: 'individual', scoring: 'target', who: 'Picked',
      members: ['6556356000368960010', '6556356000368960006', '6556356000398786739', '6556356000368960002', '6556356000368927318',
        '6556356000368953001', '6556356000369291256', '6556356000368918268', '6556356000398786728', '6556356000368937003'],
    },
    {
      id: 'v2i47kdhr1i5u0k9iv06', name: 'Trainee Comp', start: '2026-10-29', end: '2026-10-29', goal: 'First to 250 then go home', prize: 'GHT',
      metric: 'calls', metrics: ['calls'], format: 'teams', scoring: 'target', teamCalc: 'avg',
      teams: [
        { name: 'Team 1', members: ['6556356000368927318', '6556356000398786741'] },
        { name: 'Team 2', members: ['6556356000326574716', '6556356000398786730'] },
      ],
    },
  ],
};
