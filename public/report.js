// Parent progress report and CSV export for ONE saved profile. No DOM code here. window.MQReport (also module.exports).
// Everything is calculated from data already stored on this device (profile.totals and profile.history); nothing is
// sent anywhere. Guests are never saved, so they can never appear in a report. Like the Screen-time Bank, the check
// that a parent has been verified lives here and not only in the UI: both public functions refuse to run otherwise.
(function (root) {
  'use strict';

  const Q = root.MQQuestions || (typeof require === 'function' ? require('./questions.js') : null);

  const RECENT_GAMES = 10;
  const MAX_DAYS = 10;
  const TREND_MIN_GAMES = 4;   // fewer games than this is too little to call a trend
  const TREND_POINTS = 3;      // accuracy must move by at least this many points to count as up or down

  // Fails closed: with no parent module loaded nothing is allowed. Read at call time so tests can swap it.
  const allowed = () => !!(root.MQParent && root.MQParent.isUnlocked());
  const denied = () => ({ denied: true, error: 'Parent verification is needed first.' });

  const percent = (correct, total) => (total > 0 ? Math.round((correct * 100) / total) : null);
  const isNum = (v) => Number.isFinite(v) && v >= 0;

  // Saved games with every number made safe (missing -> 0, correct never above answers). `played` stays absent when
  // it was never recorded, so "not recorded" can be told from 0.
  function gamesOf(profile) {
    return (profile && Array.isArray(profile.history) ? profile.history : []).filter(h => h && typeof h === 'object').map(h => {
      const taps = isNum(h.taps) ? h.taps : 0;
      const game = { ...h, taps, correctTaps: Math.min(isNum(h.correctTaps) ? h.correctTaps : 0, taps) };
      if (!isNum(h.played)) delete game.played;
      return game;
    });
  }

  // Local calendar day (YYYY-MM-DD) of a saved time; null when the game has no saved time.
  function dayOf(t) {
    if (!isNum(t) || !t) return null;
    const d = new Date(t);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  // One row of totals (games, answers, correct, accuracy) from saved games.
  function tally(games) {
    const row = { games: games.length, answers: 0, correct: 0, accuracy: null };
    games.forEach(h => { row.answers += h.taps; row.correct += h.correctTaps; });
    row.accuracy = percent(row.correct, row.answers);
    return row;
  }

  function groupBy(history, keyOf) {
    const groups = new Map();
    history.forEach(h => {
      const key = keyOf(h);
      if (key === null) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(h);
    });
    return groups;
  }

  const levelOrder = (level) => {
    const i = Q.DIFFICULTIES.findIndex(d => d.value === level);
    return i < 0 ? 999 : i;
  };

  // Newer half against the older half of the saved games (history is newest first).
  function trendOf(history) {
    const games = history.filter(h => h.taps > 0);
    if (games.length < TREND_MIN_GAMES) return null;
    const half = Math.floor(games.length / 2);
    const recent = tally(games.slice(0, half));
    const earlier = tally(games.slice(half));
    const diff = recent.accuracy - earlier.accuracy;
    return {
      direction: diff >= TREND_POINTS ? 'up' : diff <= -TREND_POINTS ? 'down' : 'steady',
      recent: recent.accuracy, earlier: earlier.accuracy, recentGames: half, earlierGames: games.length - half
    };
  }

  // The report for one profile, or { denied: true } while no parent is verified.
  // Missing data is null / absent and zero is 0, so the screen and the CSV can tell "not recorded" from "none".
  function build(profile) {
    if (!allowed()) return denied();
    const p = profile && typeof profile === 'object' ? profile : {};
    const totals = p.totals && typeof p.totals === 'object' ? p.totals : {};
    const history = gamesOf(p);
    const games = isNum(totals.games) ? totals.games : 0;
    const answers = isNum(totals.taps) ? totals.taps : 0;
    const correct = isNum(totals.correctTaps) ? totals.correctTaps : 0;
    const detailed = history.length;

    // Play time exists only for games saved with a `played` value (older games never recorded it).
    const timed = history.filter(h => isNum(h.played));
    const time = {
      seconds: timed.length ? timed.reduce((sum, h) => sum + h.played, 0) : null,
      recordedGames: timed.length,
      unrecordedGames: detailed - timed.length
    };

    const byLevel = [...groupBy(history, h => h.level || null)]
      .map(([level, list]) => ({ level, label: Q.difficultyLabel(level), ...tally(list) }))
      .sort((a, b) => levelOrder(a.level) - levelOrder(b.level));
    // Only Grade 1-6 have topics; age-level games have one fixed activity and are left out of this list.
    const byTopic = [...groupBy(history, h => (Q.isGrade(h.level) ? h.topic || 'mixed' : null))]
      .map(([topic, list]) => ({ topic, label: Q.topicLabel(topic), ...tally(list) }))
      .sort((a, b) => b.games - a.games || a.label.localeCompare(b.label));
    const days = [...groupBy(history, h => dayOf(h.t))]
      .map(([day, list]) => ({ day, ...tally(list) }))
      .sort((a, b) => (a.day < b.day ? -1 : 1))
      .slice(-MAX_DAYS);

    const recent = history.slice(0, RECENT_GAMES).map(h => ({
      t: isNum(h.t) && h.t ? h.t : null,
      level: h.level, levelLabel: Q.difficultyLabel(h.level),
      topic: Q.isGrade(h.level) ? Q.topicLabel(h.topic || 'mixed') : '',
      mode: h.mode === 'versus' ? '1 vs 1' : 'Solo',
      timedSeconds: isNum(h.seconds) && h.seconds ? h.seconds : null,
      played: isNum(h.played) ? h.played : null,
      score: isNum(h.score) ? h.score : 0,
      answers: h.taps, correct: h.correctTaps, accuracy: percent(h.correctTaps, h.taps)
    }));

    // 'none' = no games at all (real zero); 'summary' = games were played but no game list is saved
    // (e.g. an old or trimmed backup); 'detailed' = game records are available.
    const state = games === 0 && !detailed ? 'none' : detailed ? 'detailed' : 'summary';
    const notes = [];
    if (state === 'none') notes.push('No games have been played yet. Numbers will appear after the first game.');
    if (state === 'summary') notes.push('Totals are available, but the list of individual games was not saved, so the breakdowns below are not available.');
    if (state === 'detailed') {
      notes.push(games > detailed
        ? `Breakdowns use the last ${detailed} saved games (the game keeps up to 30). Totals cover all ${games} games.`
        : `Breakdowns use all ${detailed} saved ${detailed === 1 ? 'game' : 'games'}.`);
      if (time.recordedGames === 0) notes.push('Play time was not recorded for these games.');
      else if (time.unrecordedGames > 0) notes.push(`Play time is only available for ${time.recordedGames} of ${detailed} saved games (older games did not record it).`);
    }

    return {
      name: String(p.name || ''), avatar: String(p.avatar || ''), state, notes,
      totals: { games, answers, correct, accuracy: percent(correct, answers) },
      saved: { games: detailed, missing: Math.max(0, games - detailed) },
      time, byLevel, byTopic, byDay: days, trend: trendOf(history), recent
    };
  }

  // ---------- CSV ----------
  // RFC 4180 style: a value with a comma, quote or line break is wrapped in quotes and quotes are doubled.
  // Text starting with = + - @ (or a tab / carriage return) gets a leading ' so a spreadsheet cannot run it as a formula.
  function csvCell(value) {
    if (value === null || value === undefined) return '';
    let text = typeof value === 'number' ? (Number.isFinite(value) ? String(value) : '') : String(value);
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  const csvRow = (cells) => cells.map(csvCell).join(',');

  const isoOrBlank = (t) => (isNum(t) && t ? new Date(t).toISOString() : '');

  // The CSV text for one profile (no byte-order mark: the download adds it), or { denied: true }.
  // Blank cells mean "not recorded"; 0 means a real zero.
  function toCsv(profile, now) {
    if (!allowed()) return denied();
    const report = build(profile);
    const history = gamesOf(profile);
    const row = (r) => [r.games, r.answers, r.correct, r.accuracy];
    const rows = [
      ['Math Quiz Battle - progress report'],
      ['Profile', report.name],
      ['Exported (UTC)', new Date(now === undefined ? Date.now() : now).toISOString()],
      [],
      ['Summary'],
      ['Metric', 'Value'],
      ['Games played', report.totals.games],
      ['Answers given (every tap, including second tries)', report.totals.answers],
      ['Correct answers', report.totals.correct],
      ['Accuracy (%)', report.totals.accuracy],
      ['Play time recorded (seconds)', report.time.seconds],
      ['Games with play time recorded', report.time.recordedGames],
      ['Games with saved details', report.saved.games],
      [],
      ['By level (saved games)'],
      ['Level', 'Games', 'Answers given', 'Correct answers', 'Accuracy (%)'],
      ...report.byLevel.map(r => [r.label, ...row(r)]),
      [],
      ['By topic (saved games, Grade 1-6)'],
      ['Topic', 'Games', 'Answers given', 'Correct answers', 'Accuracy (%)'],
      ...report.byTopic.map(r => [r.label, ...row(r)]),
      [],
      ['By day (saved games, local date)'],
      ['Date', 'Games', 'Answers given', 'Correct answers', 'Accuracy (%)'],
      ...report.byDay.map(r => [r.day, ...row(r)]),
      [],
      ['Game history (most recent first)'],
      ['Date and time (UTC)', 'Level', 'Topic', 'Mode', 'Correct answers', 'Answers given', 'Accuracy (%)',
        'Timed length (seconds, blank = endless)', 'Time played (seconds, blank = not recorded)', 'Average answer time (seconds, blank = not recorded)', 'Best streak'],
      ...history.map(h => [
        isoOrBlank(h.t), Q.difficultyLabel(h.level), Q.isGrade(h.level) ? Q.topicLabel(h.topic || 'mixed') : '',
        h.mode === 'versus' ? '1 vs 1' : 'Solo', h.correctTaps, h.taps,
        percent(h.correctTaps, h.taps), isNum(h.seconds) && h.seconds ? h.seconds : '',
        isNum(h.played) ? h.played : '', isNum(h.avgTime) && h.avgTime ? h.avgTime : '', isNum(h.streak) ? h.streak : 0
      ])
    ];
    return rows.map(csvRow).join('\r\n') + '\r\n';
  }

  // e.g. math-quiz-progress-mia-2026-11-09.csv (local date). Letters and digits only, so it is safe on any system.
  function filename(profile, now) {
    const d = new Date(now === undefined ? Date.now() : now);
    const p = (n) => String(n).padStart(2, '0');
    const name = String((profile && profile.name) || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 20).replace(/-+$/, '');
    return `math-quiz-progress-${name || 'profile'}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.csv`;
  }

  const api = { build, toCsv, csvCell, csvRow, filename, RECENT_GAMES, MAX_DAYS };
  root.MQReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
