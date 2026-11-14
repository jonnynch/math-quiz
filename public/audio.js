// Optional read-aloud (browser speechSynthesis) and short sound effects (Web Audio, no audio files).
// Uses only built-in browser APIs. Every call is wrapped so a missing or blocked API never breaks the game.
// Whether each feature is on is a saved setting (MQStore settings `readAloud` and `sound`, both default 'off').
(() => {
  'use strict';

  const root = window;
  const settingOn = (name) => {
    try { return !!root.MQStore && root.MQStore.getSettings()[name] === 'on'; } catch (error) { return false; }
  };

  // ---------- read-aloud ----------
  const speechSupported = () => {
    try { return !!root.speechSynthesis && typeof root.SpeechSynthesisUtterance === 'function'; } catch (error) { return false; }
  };

  // Turns maths symbols into words so speech engines read them naturally ("7 + 5" -> "7 plus 5").
  // Never describes pictures/objects (that could give the answer away); only the question text and answers.
  function spokenText(text) {
    return String(text == null ? '' : text)
      .replace(/^Compare:\s*(.+?)\s+\?\s+(.+?)$/, 'Compare $1 and $2')
      .replace(/[<=>]\s*\(([^)]+)\)/g, '$1')                 // "< (less than)" -> "less than"
      .replace(/\$(\d+)/g, '$1 dollars')
      .replace(/(\d+)c\b/g, '$1 cents')
      .replace(/(\d+)\s*\/\s*(\d+)/g, '$1 over $2')
      .replace(/\+/g, ' plus ')
      .replace(/[−–]/g, ' minus ')
      .replace(/(?<=\d|\s)-(?=\s|\d)/g, ' minus ')
      .replace(/×/g, ' times ')
      .replace(/÷/g, ' divided by ')
      .replace(/=/g, ' equals ')
      .replace(/</g, ' less than ')
      .replace(/>/g, ' greater than ')
      .replace(/(^|[\s/])\?(?=[\s/]|$)/g, '$1 what ')         // a blank to fill in, not a sentence-ending "?"
      .replace(/\s+/g, ' ')
      .trim();
  }

  // One string: the question, then "A, 5. B, 7. ..." (the letters are shown on screen except for the youngest boards).
  function questionSpeech(question) {
    const letters = !question.simple;
    const answers = (question.answerLabels || question.answers || []).map((answer, index) =>
      `${letters ? `${String.fromCharCode(65 + index)}, ` : ''}${spokenText(answer)}`);
    // A counting sequence is part of the question (3, 4, ?, 6); pictures are never described.
    const sequence = question.numbers ? ` ${question.numbers.join(', ').replace('?', 'what')}.` : '';
    const intro = spokenText(question.question) + sequence;
    return answers.length ? `${intro} ${/[?.!]$/.test(intro) ? '' : '. '}${answers.join('. ')}.` : intro;
  }

  function stopSpeech() {
    if (!speechSupported()) return;
    try { root.speechSynthesis.cancel(); } catch (error) { /* nothing to stop */ }
  }

  // Replaces whatever is being said (a replay never queues up). Returns true when speech was handed to the browser.
  function speak(text) {
    if (!speechSupported() || !text) return false;
    try {
      const synth = root.speechSynthesis;
      synth.cancel();
      const utterance = new root.SpeechSynthesisUtterance(text);
      utterance.lang = document.documentElement.lang || 'en-US';
      utterance.rate = 0.9;
      synth.speak(utterance);
      return true;
    } catch (error) {
      return false;
    }
  }

  const speakQuestion = (question) => speak(questionSpeech(question));

  // ---------- sound effects ----------
  let context = null;
  function audioContext() {
    if (context) return context;
    const Ctor = root.AudioContext || root.webkitAudioContext;
    if (!Ctor) return null;
    try { context = new Ctor(); } catch (error) { context = null; }
    return context;
  }

  // Short, soft notes: a happy rising pair for correct, one gentle low note for wrong (never harsh).
  const SOUNDS = {
    correct: { type: 'sine', notes: [[659.25, 0], [880, 0.11]], length: 0.16, volume: 0.12 },
    wrong: { type: 'triangle', notes: [[220, 0]], length: 0.22, volume: 0.09 }
  };

  // Plays nothing unless the Sound effects setting is on. Returns true when a sound was started.
  function playSound(kind) {
    const sound = SOUNDS[kind];
    if (!sound || !settingOn('sound')) return false;
    const ctx = audioContext();
    if (!ctx) return false;
    try {
      if (ctx.state === 'suspended' && ctx.resume) {
        const resumed = ctx.resume();
        if (resumed && resumed.catch) resumed.catch(() => {});
      }
      const start = ctx.currentTime + 0.01;
      sound.notes.forEach(([frequency, offset]) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = sound.type;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(sound.volume, start + offset);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + sound.length);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(start + offset);
        oscillator.stop(start + offset + sound.length + 0.02);
      });
      return true;
    } catch (error) {
      return false;   // blocked or unsupported: the game simply stays silent
    }
  }

  // Leaving the page (tab switch, closing) must never leave speech running.
  root.addEventListener('pagehide', stopSpeech);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopSpeech(); });

  root.MQAudio = { speechSupported, spokenText, questionSpeech, speak, speakQuestion, stopSpeech, playSound, readAloudOn: () => settingOn('readAloud') };
})();
