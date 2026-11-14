// Game flow and screens. Question generators are in questions.js, saved data in store.js,
// and the Settings/Profiles windows in menus.js.
(() => {
  'use strict';

  const Q = window.MQQuestions;
  const Store = window.MQStore;
  const Menus = window.MQMenus;
  const Trophies = window.MQTrophies;
  // Optional read-aloud and sound effects (audio.js). Every call is safe if the module or the browser feature is missing.
  const Sound = window.MQAudio || { speechSupported: () => false, speakQuestion: () => false, stopSpeech() {}, playSound: () => false, readAloudOn: () => false };
  const { choose, intBetween } = Q;
  const AGE_LEVELS = ['toddler', 'age4', 'age5', 'age6'];

  const state = {
    mode: 'solo',
    players: [],
    questionSets: {},
    round: 0,
    active: false,
    locked: false,
    timer: null,
    advanceTimer: null,
    roundStart: 0,
    length: 'endless',      // 'endless' or 'timed'
    durationSeconds: 60,
    startedAt: 0,
    deadline: 0,
    clockTimer: null
  };

  const $ = (id) => document.getElementById(id);
  const setupPanel = $('setupPanel');
  const gamePanel = $('gamePanel');
  const resultPanel = $('resultPanel');
  const playerTwoConfig = $('playerTwoConfig');

  const levelLabel = (player) => {
    const base = Q.difficultyLabel(player.difficulty);
    return player.topic !== 'mixed' ? `${base} · ${Q.topicLabel(player.topic)}` : base;
  };

  function setStatus(text) {
    $('gameStatus').textContent = text;
  }

  function clearTimers() {
    if (state.timer) clearTimeout(state.timer);
    if (state.advanceTimer) clearTimeout(state.advanceTimer);
    state.timer = null;
    state.advanceTimer = null;
  }

  function stopClock() {
    if (state.clockTimer) clearInterval(state.clockTimer);
    state.clockTimer = null;
  }

  function formatClock(totalSeconds) {
    const seconds = Math.max(0, Math.round(totalSeconds));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function tickClock() {
    if (!state.active || state.length !== 'timed') return;
    const remaining = Math.max(0, Math.ceil((state.deadline - performance.now()) / 1000));
    const countdown = $('countdown');
    countdown.textContent = `⏱ ${formatClock(remaining)}`;
    countdown.classList.toggle('urgent', remaining <= 10);
    if (remaining <= 0) endGame(true);
  }

  function setLength(length) {
    state.length = length;
    document.querySelectorAll('.length-button').forEach(button => {
      const selected = button.dataset.length === length;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    $('durationConfig').classList.toggle('hidden', length !== 'timed');
  }

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll('.mode-button').forEach(button => {
      const selected = button.dataset.mode === mode;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    playerTwoConfig.classList.toggle('hidden', mode !== 'versus');
  }

  // ---------- level and topic selectors ----------
  function fillDifficultySelect(select, selected) {
    select.innerHTML = '';
    Q.DIFFICULTIES.forEach(item => {
      const option = document.createElement('option');
      option.value = item.value;
      option.textContent = item.label;
      select.append(option);
    });
    select.value = selected;
  }

  // Topics exist only for Grade 1-6; the age levels keep their own fixed activity.
  function refreshTopicSelect(number, preferred) {
    const difficulty = $('difficulty' + number).value;
    const row = $('topicRow' + number);
    const select = $('topic' + number);
    const topics = Q.topicsFor(difficulty);
    if (!topics.length) {
      row.classList.add('hidden');
      select.innerHTML = '';
      return;
    }
    const keep = preferred || select.value;
    select.innerHTML = '';
    topics.forEach(topic => {
      const option = document.createElement('option');
      option.value = topic.value;
      option.textContent = topic.label;
      select.append(option);
    });
    select.value = topics.some(t => t.value === keep) ? keep : Q.DEFAULT_TOPIC;
    row.classList.remove('hidden');
  }

  const topicValue = (number) => Q.normaliseTopic($('difficulty' + number).value, $('topic' + number).value);

  // Choosing a saved profile brings back the level and topic that child played last.
  function applyProfileSetup(number, profile) {
    const last = profile && profile.lastSetup;
    if (!last || !Q.DIFFICULTIES.some(d => d.value === last.difficulty)) return;
    $('difficulty' + number).value = last.difficulty;
    refreshTopicSelect(number, last.topic);
  }

  // ---------- question banks and players ----------
  async function loadQuestionSet(difficulty, topic) {
    const key = `${difficulty}|${topic}`;
    if (state.questionSets[key]) return state.questionSets[key];
    // Build a fresh bank locally in the browser. No JSON files, server API or internet needed.
    // De-duplicated, so the same question is not dealt twice before the whole bank has been used.
    state.questionSets[key] = Q.buildQuestionBank(difficulty, topic, 500);
    return state.questionSets[key];
  }

  function createPlayer(number, difficulty, topic, profile) {
    const key = `${difficulty}|${topic}`;
    return {
      id: number,
      name: profile ? `${profile.avatar} ${profile.name}` : `Player ${number}`,
      profile,
      difficulty,
      topic,
      setKey: key,
      deck: Q.createQuestionDeck(state.questionSets[key]), // new per game = repeat tracking resets
      currentQuestion: null,
      score: 0,
      lockedOut: false,
      answeredThisRound: false,
      streak: 0,
      bestStreak: 0,
      stickers: [],
      trophies: [],            // trophies unlocked during this game (for the result card)
      firstTapCorrect: null,   // was the first answer tapped on this question correct?
      stats: { taps: 0, correctTaps: 0, timedQuestions: 0, totalSeconds: 0 },
      // Screen-time rewards: only saved profiles playing Grade 1-6 can earn (age levels never do).
      rewardGrade: profile && Q.isGrade(difficulty) ? Q.gradeOf(difficulty) : null,
      color: number === 1 ? 'blue' : 'orange'
    };
  }

  function nextQuestionFor(player) {
    player.currentQuestion = player.deck.next();
    return player.currentQuestion;
  }

  async function startGame() {
    clearTimers();
    stopClock();
    $('startButton').disabled = true;
    setStatus('Loading questions…');
    const versus = state.mode === 'versus';
    const d1 = $('difficulty1').value, t1 = topicValue(1);
    const d2 = $('difficulty2').value, t2 = topicValue(2);
    const p1 = Menus.selectedProfile(1);
    let p2 = versus ? Menus.selectedProfile(2) : null;
    if (p1 && p2 && p1.id === p2.id) p2 = null;
    try {
      await Promise.all(versus
        ? [loadQuestionSet(d1, t1), loadQuestionSet(d2, t2)]
        : [loadQuestionSet(d1, t1)]);

      state.sessionId = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      state.rewardSaveFailed = false;
      state.players = [createPlayer(1, d1, t1, p1)];
      if (versus) state.players.push(createPlayer(2, d2, t2, p2));
      state.round = 0;
      state.active = true;
      state.locked = false;
      setupPanel.classList.add('hidden');
      resultPanel.classList.add('hidden');
      gamePanel.classList.remove('hidden');
      setStatus('Game in progress');
      document.body.classList.add('playing');
      renderScoreboard();
      state.startedAt = performance.now();
      state.durationSeconds = Number($('duration').value) || 60;
      const countdown = $('countdown');
      countdown.classList.toggle('hidden', state.length !== 'timed');
      if (state.length === 'timed') {
        state.deadline = state.startedAt + state.durationSeconds * 1000;
        countdown.classList.remove('urgent');
        countdown.textContent = `⏱ ${formatClock(state.durationSeconds)}`;
        state.clockTimer = setInterval(tickClock, 200);
      }
      showNextRound();
    } catch (error) {
      alert(`${error.message}\n\nPlease try starting the game again.`);
      setStatus('Ready to play');
    } finally {
      $('startButton').disabled = false;
    }
  }

  function renderScoreboard() {
    $('scoreboard').innerHTML = '';
    state.players.forEach(player => {
      const card = document.createElement('div');
      card.className = `score-card ${player.color}`;
      const details = document.createElement('div');
      const name = document.createElement('span');
      name.className = 'score-name';
      const nameText = document.createElement('span');
      nameText.className = 'name-text';
      nameText.textContent = player.name;
      name.append(nameText);
      if (player.streak >= 2) {
        const badge = document.createElement('span');
        badge.className = 'streak-badge';
        badge.textContent = `🔥 ${player.streak}`;
        badge.setAttribute('aria-label', `${player.streak} correct in a row`);
        name.append(badge);
      }
      const difficulty = document.createElement('span');
      difficulty.className = 'score-detail';
      difficulty.textContent = levelLabel(player);
      details.append(name, difficulty);
      const score = document.createElement('span');
      score.className = 'score-value';
      score.textContent = String(player.score);
      score.setAttribute('aria-label', `${player.name} score`);
      card.append(details, score);
      $('scoreboard').append(card);
    });
  }

  function showNextRound() {
    if (!state.active) return;
    clearTimers();
    Sound.stopSpeech();
    state.round += 1;
    state.locked = false;
    state.roundStart = performance.now();
    $('roundNumber').textContent = String(state.round);
    $('roundHeading').textContent = state.mode === 'solo' ? 'Solve the question' : 'Who will answer first?';
    const boards = $('questionBoards');
    boards.className = `question-boards ${state.mode === 'solo' ? 'solo' : 'versus'}`;
    boards.innerHTML = '';
    state.players.forEach(player => {
      player.lockedOut = false;
      player.answeredThisRound = false;
      player.firstTapCorrect = null;
      const question = nextQuestionFor(player);
      boards.append(createQuestionBoard(player, question));
    });
    const feedback = $('roundFeedback');
    feedback.className = 'round-feedback';
    feedback.textContent = state.mode === 'solo'
      ? 'Tap the correct answer to score a point.'
      : 'First correct answer wins the point. One wrong answer and you are out for this question.';
    // Read-aloud (if on): Solo at Age 2–6 reads the new question once. Nothing waits for it; the 🔊 button replays it.
    const only = state.players[0];
    if (state.mode === 'solo' && only && AGE_LEVELS.includes(only.difficulty) && Sound.readAloudOn()) Sound.speakQuestion(only.currentQuestion);
  }

  // ---------- figures: analogue clock and polygons (SVG) ----------
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function svgEl(name, attrs) {
    const node = document.createElementNS(SVG_NS, name);
    Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, String(v)));
    return node;
  }

  function createClockSvg(hour, minute) {
    const svg = svgEl('svg', { viewBox: '0 0 100 100', class: 'figure figure-clock', role: 'img', 'aria-label': 'Analogue clock' });
    svg.append(svgEl('circle', { cx: 50, cy: 50, r: 47, class: 'clock-face' }));
    for (let i = 0; i < 60; i++) {
      const major = i % 5 === 0;
      const angle = (i * 6 * Math.PI) / 180;
      const r1 = major ? 40 : 43.5, r2 = 45.5;
      svg.append(svgEl('line', {
        x1: 50 + r1 * Math.sin(angle), y1: 50 - r1 * Math.cos(angle),
        x2: 50 + r2 * Math.sin(angle), y2: 50 - r2 * Math.cos(angle),
        class: major ? 'clock-tick major' : 'clock-tick'
      }));
    }
    for (let n = 1; n <= 12; n++) {
      const angle = (n * 30 * Math.PI) / 180;
      const text = svgEl('text', { x: 50 + 32 * Math.sin(angle), y: 50 - 32 * Math.cos(angle) + 3.6, class: 'clock-number', 'text-anchor': 'middle' });
      text.textContent = String(n);
      svg.append(text);
    }
    const hand = (degrees, length, cls) => {
      const a = (degrees * Math.PI) / 180;
      return svgEl('line', { x1: 50, y1: 50, x2: 50 + length * Math.sin(a), y2: 50 - length * Math.cos(a), class: cls });
    };
    svg.append(hand(((hour % 12) + minute / 60) * 30, 22, 'clock-hand hour'));
    svg.append(hand(minute * 6, 33, 'clock-hand minute'));
    svg.append(svgEl('circle', { cx: 50, cy: 50, r: 2.6, class: 'clock-center' }));
    return svg;
  }

  function createPolygonSvg(sides) {
    const svg = svgEl('svg', { viewBox: '0 0 100 100', class: 'figure figure-polygon', role: 'img', 'aria-label': 'A shape' });
    const offset = sides % 2 === 0 ? -90 + 180 / sides : -90;
    const points = Array.from({ length: sides }, (_, i) => {
      const a = ((offset + (360 / sides) * i) * Math.PI) / 180;
      return `${(50 + 40 * Math.cos(a)).toFixed(2)},${(50 + 40 * Math.sin(a)).toFixed(2)}`;
    }).join(' ');
    svg.append(svgEl('polygon', { points, class: 'poly' }));
    return svg;
  }

  // 2D shape (Age 5): drawn inside a 100 x 100 box; every outline stays within 50 units of the centre, so it never
  // clips when turned. `scale`, `rotate`, `ratio` (rectangles) and `variant` (triangles) vary size and orientation.
  const TRIANGLES = ['50,14 88,80 12,80', '50,10 78,88 22,88', '20,16 20,84 80,84'];
  function createShapeSvg(spec, cls, label) {
    const svg = svgEl('svg', { viewBox: '0 0 100 100', class: cls, role: 'img', 'aria-label': label });
    const group = svgEl('g', { transform: `translate(50 50) rotate(${spec.rotate || 0}) scale(${spec.scale || 1}) translate(-50 -50)` });
    const paint = { fill: spec.color, stroke: '#1f2937', 'stroke-width': 3, 'stroke-linejoin': 'round' };
    if (spec.shape === 'circle') group.append(svgEl('circle', { cx: 50, cy: 50, r: 38, ...paint }));
    else if (spec.shape === 'square') group.append(svgEl('rect', { x: 20, y: 20, width: 60, height: 60, ...paint }));
    else if (spec.shape === 'rectangle') {
      const h = 80 / (spec.ratio || 2);
      group.append(svgEl('rect', { x: 10, y: 50 - h / 2, width: 80, height: h, ...paint }));
    } else group.append(svgEl('polygon', { points: TRIANGLES[spec.variant || 0], ...paint }));
    svg.append(group);
    return svg;
  }

  function createFigure(figure) {
    if (figure.type === 'shape') return createShapeSvg(figure, 'figure figure-shape', 'A shape');
    return figure.type === 'clock' ? createClockSvg(figure.hour, figure.minute) : createPolygonSvg(figure.sides);
  }

  // Place-value blocks (Age 5): a rectangle marked 10 is one ten, a circle marked 1 is one one. Never money.
  function createBlocks(spec) {
    const box = document.createElement('span');
    box.className = 'blocks';
    const tens = document.createElement('span');
    tens.className = 'block-tens';
    for (let i = 0; i < spec.tens; i++) {
      const block = document.createElement('span');
      block.className = 'block-ten';
      block.textContent = '10';
      tens.append(block);
    }
    box.append(tens);
    if (spec.ones) {
      const ones = document.createElement('span');
      ones.className = 'block-ones';
      ones.style.setProperty('--cols', String(Math.min(5, spec.ones)));
      for (let i = 0; i < spec.ones; i++) {
        const dot = document.createElement('span');
        dot.className = 'block-one';
        dot.textContent = '1';
        ones.append(dot);
      }
      box.append(ones);
    }
    return box;
  }

  // Visual answer choices (Age 5): a shape or a set of place-value blocks inside the answer button.
  function createVisual(spec) {
    if (spec.type === 'blocks') return createBlocks(spec);
    const svg = createShapeSvg(spec, 'answer-visual', spec.label);
    svg.setAttribute('aria-hidden', 'true');
    return svg;
  }

  // Number sequence on its own line, e.g. 3, 4, ?, 6 (Age 5 counting sequences).
  function createNumberSequence(numbers) {
    const row = document.createElement('div');
    row.className = 'number-sequence';
    row.setAttribute('role', 'img');
    row.setAttribute('aria-label', numbers.map(n => n === '?' ? 'missing number' : n).join(', '));
    numbers.forEach(n => {
      const item = document.createElement('span');
      item.className = n === '?' ? 'seq-item seq-blank' : 'seq-item';
      item.textContent = n;
      item.setAttribute('aria-hidden', 'true');
      row.append(item);
    });
    return row;
  }

  // Visual pattern (Age 5): a short row of shapes ending in an empty box.
  function createPattern(pattern) {
    const row = document.createElement('div');
    row.className = 'pattern-row';
    row.setAttribute('role', 'img');
    row.setAttribute('aria-label', `Pattern: ${pattern.map(p => p ? p.label : 'missing').join(', ')}`);
    pattern.forEach(spec => {
      if (spec) {
        const svg = createShapeSvg(spec, 'pattern-item', spec.label);
        svg.setAttribute('aria-hidden', 'true');
        row.append(svg);
      } else {
        const blank = document.createElement('span');
        blank.className = 'pattern-blank';
        blank.setAttribute('aria-hidden', 'true');
        blank.textContent = '?';
        row.append(blank);
      }
    });
    return row;
  }

  function createPromptBlocks(spec) {
    const box = document.createElement('div');
    box.className = 'counting-visual prompt-visual';
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', spec.label);
    box.append(createBlocks(spec));
    return box;
  }

  function createQuestionBoard(player, question) {
    const board = document.createElement('article');
    board.className = `question-board ${player.color}${state.mode === 'solo' ? ' solo' : ''}${question.simple ? ' toddler' : ''}${question.groups ? ' groups' : ''}${question.answerVisuals ? ' visual-choices' : ''}${question.answerVisuals && question.answerVisuals[0].type === 'blocks' ? ' block-choices' : ''}${question.figure ? ' has-figure' : ''}`;
    board.dataset.playerId = String(player.id);

    const topline = document.createElement('div');
    topline.className = 'question-topline';
    const label = document.createElement('span');
    label.className = 'player-label';
    label.textContent = player.name;
    const level = document.createElement('span');
    level.className = 'difficulty-label';
    level.textContent = levelLabel(player);
    topline.append(label, level);
    if (Sound.speechSupported()) {
      const speak = document.createElement('button');
      speak.type = 'button';
      speak.className = 'speak-button';
      speak.setAttribute('aria-label', `Read ${player.name}'s question and answers aloud`);
      speak.textContent = '🔊 Listen';
      // Same pattern as the answer buttons: pointerdown for touch (two players at once), click only for the keyboard.
      speak.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();
        Sound.speakQuestion(question);
      });
      speak.addEventListener('click', (event) => { if (event.detail === 0) Sound.speakQuestion(question); });
      topline.append(speak);
    }

    const text = document.createElement('h3');
    text.className = 'question-text';
    text.textContent = question.question;

    const grid = document.createElement('div');
    grid.className = 'answer-grid';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', `${player.name} answers`);

    question.answers.forEach((answer, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'answer-button';
      if (question.answerVisuals) button.append(createVisual(question.answerVisuals[index]));
      else button.textContent = question.simple ? answer : `${String.fromCharCode(65 + index)}. ${answer}`;
      if (question.groups || question.answerVisuals) button.setAttribute('aria-label', question.answerLabels[index]);
      // pointerdown fires immediately for every finger, even when two players touch the screen at
      // nearly the same time (Safari can swallow 'click' events during multi-touch).
      button.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();
        handleAnswer(player.id, index, button);
      });
      // Keyboard activation (Enter/Space) still works; real taps/clicks have detail > 0 and are ignored here.
      button.addEventListener('click', (event) => {
        if (event.detail === 0) handleAnswer(player.id, index, button);
      });
      grid.append(button);
    });

    // .board-info holds the question side (name, objects, text); .answer-grid is the answer side.
    // Normally they stack; on a phone held sideways they sit side by side (see style.css).
    const body = document.createElement('div');
    body.className = 'board-body';
    const info = document.createElement('div');
    info.className = 'board-info';
    info.append(topline);
    if (question.stage) info.append(createStage(question.stage));
    if (question.figure) info.append(createFigure(question.figure));
    info.append(text);
    if (question.numbers) info.append(createNumberSequence(question.numbers));
    if (question.pattern) info.append(createPattern(question.pattern));
    if (question.promptVisual) info.append(createPromptBlocks(question.promptVisual));
    if (question.picture) info.append(createPicture(question.picture));
    if (question.visual) {
      const visual = document.createElement('div');
      visual.className = `counting-visual${question.rowsOfFive ? ' rows-of-five' : ''}`;
      visual.setAttribute('role', 'img');
      visual.setAttribute('aria-label', question.visualLabel);
      question.visual.forEach(emoji => {
        const item = document.createElement('span');
        item.textContent = emoji;
        item.setAttribute('aria-hidden', 'true');
        visual.append(item);
      });
      info.append(visual);
    }
    body.append(info, grid);
    board.append(body);
    return board;
  }

  // Age 4 picture: groups of cells (X object, x crossed-out object, O empty slot, . blank), see questions.js.
  const PICTURE_CELLS = { X: 'object', Y: 'object', x: 'object removed', O: 'slot' };

  // Circles (empty slots) and crossed-out objects are teaching aids: they appear a moment AFTER the question, with a
  // short highlight, so children first see the plain objects. They only change how the cells look (never the layout),
  // answers stay tappable and the question timer is untouched. With reduced motion they are shown at once, unanimated.
  const AID_DELAY_MS = 1200;
  const prefersReducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function scheduleAids(box) {
    if (prefersReducedMotion()) return;
    box.classList.add('aids-pending');
    setTimeout(() => {
      if (!box.classList.contains('aids-pending')) return;
      box.classList.remove('aids-pending');
      box.classList.add('aids-flash');
    }, AID_DELAY_MS);
  }

  function createPicture(picture) {
    const box = document.createElement('div');
    box.className = 'counting-visual picture';
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', picture.label);
    let totalCols = 0;
    picture.groups.forEach((group, index) => {
      if (index && picture.joiner) {
        const sign = document.createElement('span');
        sign.className = 'picture-joiner';
        sign.setAttribute('aria-hidden', 'true');
        sign.textContent = picture.joiner;
        box.append(sign);
      }
      const cols = Math.max(...group.rows.map(row => row.length));
      totalCols += cols;
      const grid = document.createElement('div');
      grid.className = `picture-group${group.framed ? ' framed' : ''}`;
      grid.style.setProperty('--cols', String(cols));
      group.rows.forEach(row => [...row.padEnd(cols, '.')].forEach(ch => {
        const cell = document.createElement('span');
        cell.className = `cell${PICTURE_CELLS[ch] ? ' ' + PICTURE_CELLS[ch] : ''}`;
        cell.setAttribute('aria-hidden', 'true');
        if (ch === 'X' || ch === 'x' || ch === 'Y') {
          const obj = document.createElement('span');
          obj.className = 'obj';
          obj.textContent = ch === 'Y' ? group.emoji2 : group.emoji;
          cell.append(obj);
        }
        grid.append(cell);
      }));
      if (group.lead) {
        // equal sharing: a child above the objects that child has
        const share = document.createElement('div');
        share.className = 'picture-share';
        const lead = document.createElement('span');
        lead.className = 'picture-lead';
        lead.setAttribute('aria-hidden', 'true');
        lead.textContent = group.lead;
        share.append(lead, grid);
        box.append(share);
      } else box.append(grid);
    });
    if (totalCols > 5 || picture.groups.length > 1 || picture.groups.some(g => g.framed)) {   // two side-by-side groups (11-20 objects) or framed groups use objects sized to fit the width
      box.classList.add('wide');
      const framed = picture.groups.some(g => g.framed) ? 0.6 : 0;
      const maxCols = Math.max(...picture.groups.map(g => Math.max(...g.rows.map(r => r.length))));
      const tc = totalCols + (picture.groups.length - 1) * 0.6 + picture.groups.length * framed;
      box.style.setProperty('--tc', String(tc));                          // columns needed in one row
      box.style.setProperty('--wc', String(Math.min(tc, Math.max(maxCols + framed, 6))));   // columns per row when the groups wrap
    }
    if (picture.groups.some(g => g.rows.some(row => /[xO]/.test(row)))) scheduleAids(box);
    return box;
  }

  // Ten fixed slots (2 rows of 5) are always rendered, so the block keeps the same height
  // before and after objects are added or removed and nothing below it moves.
  const STAGE_SLOTS = 10;

  function stageLabel(stage, done) {
    const before = `${stage.baseCount} ${stage.base.name}`;
    if (!done) return before;
    return stage.op === 'add'
      ? `${before} and ${stage.change} ${stage.added.name} added`
      : `${before}, ${stage.change} removed`;
  }

  function createStage(stage) {
    const box = document.createElement('div');
    box.className = 'object-stage';
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', stageLabel(stage, false));
    for (let i = 0; i < STAGE_SLOTS; i++) {
      const slot = document.createElement('span');
      slot.className = 'slot';
      slot.setAttribute('aria-hidden', 'true');
      slot.textContent = i < stage.baseCount ? stage.base.emoji : '';
      box.append(slot);
    }
    return box;
  }

  // Called when the correct answer is known: add objects of another type, or remove some.
  function showResult(board, question) {
    if (!board || !question || !(question.stage || question.resultText) || board.dataset.resultShown) return;
    board.dataset.resultShown = '1';
    const stage = question.stage;
    const box = board.querySelector('.object-stage');
    const slots = box ? box.querySelectorAll('.slot') : [];
    for (let i = 0; stage && i < stage.change; i++) {
      if (stage.op === 'add') {
        const slot = slots[stage.baseCount + i];
        if (!slot) continue;
        slot.textContent = stage.added.emoji;
        slot.style.setProperty('--delay', `${i * 0.12}s`);
        slot.classList.add('pop');
      } else {
        const slot = slots[stage.baseCount - 1 - i];
        if (!slot) continue;
        slot.style.setProperty('--delay', `${i * 0.12}s`);
        slot.classList.add('leaving');
      }
    }
    if (box) box.setAttribute('aria-label', stageLabel(stage, true));
    const text = board.querySelector('.question-text');
    if (text && question.resultText) text.textContent = question.resultText;
  }

  // ---------- rewards: streaks, stickers, stars and confetti ----------
  const isMilestone = (n) => n === 3 || n === 5 || n === 10 || (n > 10 && n % 5 === 0);
  const CONFETTI_COLORS = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7'];

  function launchConfetti(count) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const layer = $('confettiLayer');
    if (layer.childElementCount > 160) return;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('span');
      piece.className = 'confetto';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = choose(CONFETTI_COLORS);
      piece.style.setProperty('--dx', `${intBetween(-90, 90)}px`);
      piece.style.setProperty('--rot', `${intBetween(180, 900)}deg`);
      piece.style.animationDuration = `${(1.3 + Math.random() * 1.1).toFixed(2)}s`;
      piece.style.animationDelay = `${(Math.random() * 0.25).toFixed(2)}s`;
      piece.addEventListener('animationend', () => piece.remove());
      layer.append(piece);
    }
  }

  // A sticker the player does not own yet (saved profiles keep them; guests keep them for this game).
  function awardSticker(player) {
    const owned = new Set([...(player.profile ? player.profile.stickers : []), ...player.stickers]);
    const available = Store.STICKERS.filter(s => !owned.has(s));
    if (!available.length) return null;
    const sticker = choose(available);
    player.stickers.push(sticker);
    if (player.profile) {
      player.profile.stickers.push(sticker);
      Store.save();
    }
    return sticker;
  }

  // 3 stars for 90%+ correct answers, 2 for 70%+, otherwise 1 (none if nothing was correct).
  function starsFor(player) {
    const { taps, correctTaps } = player.stats;
    if (!correctTaps) return 0;
    const accuracy = correctTaps / taps;
    return accuracy >= 0.9 ? 3 : accuracy >= 0.7 ? 2 : 1;
  }

  // Trophies: a question counts once, when the round is decided (someone answered correctly, or everyone was
  // out). Every player who answered it gets one completed question; it counts as correct only if their FIRST
  // answer was right, so retrying cannot inflate progress. Players who never answered are not credited.
  // Returns text for the feedback line when a trophy was unlocked. Scores, streaks and stickers are untouched.
  function settleRound() {
    const notes = [];
    let touched = false;
    state.players.forEach(p => {
      if (!p.profile || !p.answeredThisRound) return;
      touched = true;
      const won = Trophies.record(p.profile, p.difficulty, p.firstTapCorrect === true);
      if (!won.length) return;
      p.trophies.push(...won.map(t => t.icon));
      notes.push(`${state.players.length > 1 ? `${p.name} ` : ''}${won.map(t => `${t.icon} ${t.name}`).join(', ')}`);
    });
    if (touched) Store.save();
    if (!notes.length) return '';
    launchConfetti(90);
    return ` · 🏆 New trophy: ${notes.join('; ')}`;
  }

  function handleAnswer(playerId, answerIndex, button) {
    if (!state.active || state.locked) return;
    const player = state.players.find(item => item.id === playerId);
    if (!player || !player.currentQuestion || player.lockedOut) return;
    if (button.disabled) return;

    const versus = state.players.length > 1;
    const feedback = $('roundFeedback');
    const correct = answerIndex === player.currentQuestion.correct;

    // Statistics: accuracy counts every answer tapped; response time is measured from when the
    // question appeared to the player's first answer on that question.
    player.stats.taps += 1;
    if (correct) player.stats.correctTaps += 1;
    if (!player.answeredThisRound) {
      player.answeredThisRound = true;
      player.firstTapCorrect = correct;
      player.stats.timedQuestions += 1;
      player.stats.totalSeconds += (performance.now() - state.roundStart) / 1000;
      // Screen-time bank: only this first answer counts for the question; retries are never reported.
      if (player.rewardGrade) {
        const rewarded = Store.rewardAnswer(player.profile, state.sessionId, player.rewardGrade, correct);
        if (rewarded && rewarded.saved === false) state.rewardSaveFailed = true;
      }
    }

    Sound.playSound(correct ? 'correct' : 'wrong');
    if (correct) Sound.stopSpeech();   // the question is over; a wrong tap does not cut off the other player

    if (!correct) {
      button.classList.add('wrong');
      button.disabled = true;
      player.streak = 0;
      // A wrong answer also ends the trophy run straight away (saved profiles only).
      if (player.profile && Trophies.resetStreak(player.profile, player.difficulty)) Store.save();
      renderScoreboard();

      if (!versus) {
        // Solo: keep trying until the correct answer is chosen.
        feedback.className = 'round-feedback error';
        feedback.textContent = `${player.name} — not quite. Try another answer.`;
        return;
      }

      // 1 vs 1: one wrong answer locks this player out for the rest of the question.
      player.lockedOut = true;
      const board = boardFor(playerId);
      if (board) {
        board.classList.add('locked-out');
        board.querySelectorAll('.answer-button').forEach(b => { b.disabled = true; });
        const badge = document.createElement('span');
        badge.className = 'lock-badge';
        badge.textContent = 'Out this question';
        board.querySelector('.question-topline').append(badge);
      }

      if (state.players.every(p => p.lockedOut)) {
        // Everyone got it wrong: no points, show the answers, move on.
        state.locked = true;
        const trophyNote = settleRound();
        state.players.forEach(p => {
          const b = boardFor(p.id);
          if (!b) return;
          const buttons = b.querySelectorAll('.answer-button');
          if (buttons[p.currentQuestion.correct]) buttons[p.currentQuestion.correct].classList.add('reveal');
          showResult(b, p.currentQuestion);
        });
        const anyStage = state.players.some(p => p.currentQuestion.stage);
        feedback.className = 'round-feedback error';
        feedback.textContent = 'Both answers were wrong — no point this time. Next question!' + trophyNote;
        state.advanceTimer = setTimeout(() => {
          if (state.active) showNextRound();
        }, anyStage ? 2400 : 1800);
      } else {
        feedback.className = 'round-feedback error';
        feedback.textContent = `${player.name} is out for this question. The other player can still answer!`;
      }
      return;
    }

    // First correct tap locks all players' answer buttons immediately.
    state.locked = true;
    player.score += 1;

    // Streak: consecutive questions answered correctly. In 1 vs 1, winning a round also ends the
    // other player's streak. Streaks never change the score, so 1 vs 1 stays fair.
    player.streak += 1;
    player.bestStreak = Math.max(player.bestStreak, player.streak);
    state.players.forEach(p => { if (p !== player) p.streak = 0; });
    let message = `${player.name} answered correctly! +1 point`;
    if (player.streak >= 2) message += ` · 🔥 ${player.streak} in a row!`;
    if (isMilestone(player.streak)) {
      const sticker = awardSticker(player);
      if (sticker) message += ` New sticker ${sticker}`;
      launchConfetti(player.streak >= 10 ? 90 : 55);
    }
    message += settleRound();

    feedback.className = 'round-feedback success';
    feedback.textContent = message;
    const board = boardFor(playerId);
    const buttons = board ? board.querySelectorAll('.answer-button') : [];
    buttons.forEach((answerButton, index) => {
      answerButton.disabled = true;
      if (index === answerIndex) answerButton.classList.add('correct');
    });
    $('questionBoards').querySelectorAll('.answer-button').forEach(answerButton => {
      answerButton.disabled = true;
    });
    renderScoreboard();
    showResult(board, player.currentQuestion);

    // Briefly show the result (a little longer when objects are animating), then load the next round.
    state.advanceTimer = setTimeout(() => {
      if (state.active) showNextRound();
    }, player.currentQuestion.stage ? 1700 : 850);
  }

  function boardFor(playerId) {
    return $('questionBoards').querySelector(`[data-player-id="${playerId}"]`);
  }

  function stopGame() {
    endGame(false);
  }

  // Saves each saved profile's result: totals, recent games, best timed score and last level played.
  function recordProfileResults() {
    const outcome = new Map();
    state.players.forEach(player => {
      const profile = player.profile;
      const { taps, correctTaps, timedQuestions, totalSeconds } = player.stats;
      if (!profile || !taps) return;
      const seconds = state.length === 'timed' ? state.durationSeconds : 0;
      // Same clock as the result screen's "played m:ss". Left out when the game start was not recorded.
      const played = state.startedAt ? Math.min(86400, Math.max(1, Math.round((performance.now() - state.startedAt) / 1000))) : 0;
      profile.totals.games += 1;
      profile.totals.correct += player.score;
      profile.totals.taps += taps;
      profile.totals.correctTaps += correctTaps;
      profile.totals.bestStreak = Math.max(profile.totals.bestStreak, player.bestStreak);
      let newBest = false;
      if (seconds) {
        const key = `${player.difficulty}|${player.topic}|${seconds}`;
        const previous = profile.bests[key];
        if (previous === undefined || player.score > previous) {
          newBest = previous !== undefined;
          profile.bests[key] = player.score;
        }
      }
      profile.history.unshift({
        t: Date.now(),
        level: player.difficulty,
        topic: player.topic,
        mode: state.players.length > 1 ? 'versus' : 'solo',
        seconds,
        score: player.score,
        taps,
        correctTaps,
        avgTime: timedQuestions ? Number((totalSeconds / timedQuestions).toFixed(2)) : 0,
        streak: player.bestStreak,
        ...(played ? { played } : {})
      });
      profile.history.length = Math.min(profile.history.length, Store.MAX_HISTORY);
      profile.lastSetup = { difficulty: player.difficulty, topic: player.topic };
      outcome.set(player.id, { newBest });
    });
    const saved = outcome.size ? Store.save() : true;
    return { outcome, saved };
  }

  // "Screen time" block on the result card: the batch that was paid out, or progress towards the next one.
  function rewardSummary(result) {
    if (!result) return null;
    if (result.saved === false) {
      // Nothing was paid or settled (the store rolled back), so never show a payout here.
      const failBox = document.createElement('div');
      failBox.className = 'reward-summary';
      const failLine = document.createElement('div');
      failLine.className = 'reward-title';
      failLine.textContent = '⚠️ Screen time could not be saved, so no minutes were added.';
      failBox.append(failLine);
      return failBox;
    }
    if (!result.settled) return null;
    const box = document.createElement('div');
    box.className = 'reward-summary';
    const line = (text, className) => {
      const node = document.createElement('div');
      if (className) node.className = className;
      node.textContent = text;
      box.append(node);
    };
    const batch = result.batch;
    const counts = batch || result.pending;
    line(`⏱ Screen time · Grade ${result.grade}`, 'reward-title');
    line(`Completed ${counts.completed} · Correct ${counts.correct} · Accuracy ${Store.rewardPercent(counts.correct, counts.completed)}%`);
    if (batch) {
      line(batch.minutes > 0
        ? `+${batch.minutes} minute${batch.minutes === 1 ? '' : 's'} added to the bank!`
        : `No minutes this time: ${Store.getRewardConfig().minAccuracy}% correct on the first try is needed.`, 'reward-minutes');
    } else {
      line(`${Math.min(counts.completed, result.minBatch)} of ${result.minBatch} questions towards the next reward. Progress is kept for next time.`, 'reward-progress');
    }
    return box;
  }

  function endGame(timedOut) {
    if (!state.active) return;
    state.active = false;
    clearTimers();
    stopClock();
    Sound.stopSpeech();
    document.body.classList.remove('playing');
    gamePanel.classList.add('hidden');
    resultPanel.classList.remove('hidden');
    setStatus(timedOut ? 'Time’s up' : 'Game finished');
    $('resultEyebrow').textContent = timedOut ? 'TIME’S UP' : 'GAME FINISHED';
    $('resultMeta').textContent = state.length === 'timed'
      ? `Timed game · ${formatClock(state.durationSeconds)}`
      : `Endless game · played ${formatClock((performance.now() - state.startedAt) / 1000)}`;
    $('finalScores').innerHTML = '';

    const { outcome, saved } = recordProfileResults();
    // Screen-time rewards: add each eligible player's first-attempt answers to their bank.
    const rewardResults = new Map();
    state.players.forEach(player => {
      if (player.rewardGrade) rewardResults.set(player.id, Store.settleRewards(player.profile, state.sessionId));
    });
    const rewardsSaved = [...rewardResults.values()].every(result => result.saved !== false);
    if (!saved || !rewardsSaved || state.rewardSaveFailed) $('resultMeta').textContent += ' · ⚠️ Progress could not be saved on this device';
    const highest = Math.max(...state.players.map(player => player.score));
    const winners = state.players.filter(player => player.score === highest);
    $('resultTitle').textContent = state.players.length === 1
      ? 'Great effort!'
      : winners.length === 1 ? `${winners[0].name} wins!` : 'It’s a tie!';

    state.players.forEach(player => {
      const card = document.createElement('div');
      card.className = 'final-score';
      const name = document.createElement('span');
      name.textContent = `${player.name} · ${levelLabel(player)}`;
      const score = document.createElement('strong');
      score.textContent = String(player.score);
      card.append(name, score);

      const stars = starsFor(player);
      if (stars) {
        const rating = document.createElement('div');
        rating.className = 'star-rating';
        rating.textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
        rating.setAttribute('aria-label', `${stars} out of 3 stars`);
        card.append(rating);
      }
      if (outcome.get(player.id) && outcome.get(player.id).newBest) {
        const best = document.createElement('div');
        best.className = 'best-badge';
        best.textContent = '🏅 New personal best!';
        card.append(best);
      }

      const { taps, correctTaps, timedQuestions, totalSeconds } = player.stats;
      const accuracy = taps ? `${Math.round((correctTaps / taps) * 100)}% (${correctTaps}/${taps})` : '–';
      const average = timedQuestions ? `${(totalSeconds / timedQuestions).toFixed(1)} s` : '–';
      const stats = document.createElement('div');
      stats.className = 'final-stats';
      [['Correct answers', accuracy], ['Average time', average], ['Best streak', player.bestStreak ? `🔥 ${player.bestStreak}` : '–']].forEach(([labelText, valueText]) => {
        const row = document.createElement('div');
        const label = document.createElement('span');
        label.textContent = labelText;
        const value = document.createElement('b');
        value.textContent = valueText;
        row.append(label, value);
        stats.append(row);
      });
      card.append(stats);

      const rewardBox = rewardSummary(rewardResults.get(player.id));
      if (rewardBox) card.append(rewardBox);

      if (player.stickers.length) {
        const earned = document.createElement('div');
        earned.className = 'earned-stickers';
        const caption = document.createElement('span');
        caption.textContent = player.profile ? 'New stickers' : 'Stickers won (create a profile to keep them)';
        const row = document.createElement('div');
        row.className = 'sticker-row';
        row.textContent = player.stickers.join(' ');
        earned.append(caption, row);
        card.append(earned);
      }
      if (player.trophies.length) {
        const won = document.createElement('div');
        won.className = 'earned-stickers';
        const caption = document.createElement('span');
        caption.textContent = 'New trophies';
        const row = document.createElement('div');
        row.className = 'sticker-row';
        row.textContent = player.trophies.join(' ');
        won.append(caption, row);
        card.append(won);
      }
      $('finalScores').append(card);
    });
    if (state.players.some(player => player.score > 0)) launchConfetti(70);
  }

  function changeSetup() {
    clearTimers();
    stopClock();
    Sound.stopSpeech();
    document.body.classList.remove('playing');
    state.active = false;
    gamePanel.classList.add('hidden');
    resultPanel.classList.add('hidden');
    setupPanel.classList.remove('hidden');
    setStatus('Ready to play');
  }

  // ---------- start-up ----------
  fillDifficultySelect($('difficulty1'), 'grade3');
  fillDifficultySelect($('difficulty2'), 'grade4');
  [1, 2].forEach(n => {
    $('difficulty' + n).addEventListener('change', () => refreshTopicSelect(n));
    refreshTopicSelect(n);
  });

  document.querySelectorAll('.mode-button').forEach(button => {
    button.addEventListener('click', () => setMode(button.dataset.mode));
  });
  document.querySelectorAll('.length-button').forEach(button => {
    button.addEventListener('click', () => setLength(button.dataset.length));
  });
  $('startButton').addEventListener('click', startGame);
  $('stopButton').addEventListener('click', stopGame);
  $('rematchButton').addEventListener('click', startGame);
  $('changeSetupButton').addEventListener('click', changeSetup);

  Menus.onProfileChosen = applyProfileSetup;
  Menus.init();
  setMode('solo');
  setLength('endless');
})();
