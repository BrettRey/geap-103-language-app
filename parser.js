/* Reads a pack.md file for Teach Your Language.
   Works in the browser (window.TYL) and in Node (module.exports). */
(function (root) {
  'use strict';

  // Labels a student can write, and the field each one fills.
  const KEYS = {
    'phrase': 'phrase', 'word': 'phrase',
    'meaning': 'meaning', 'translation': 'meaning',
    'say it': 'sayIt', 'sounds like': 'sayIt', 'pronunciation': 'sayIt',
    'note': 'note', 'notes': 'note', 'culture note': 'note', 'cultural note': 'note',
    'audio': 'audio', 'sound': 'audio', 'recording': 'audio',
    'made by': 'madeBy', 'by': 'madeBy',
    'language': 'language',
    'language code': 'code', 'code': 'code',
    'for': 'for',
  };
  const PACK_FIELDS = new Set(['language', 'code', 'for']);
  const PHRASE_FIELDS = new Set(['phrase', 'meaning', 'sayIt', 'note', 'audio']);
  const LABEL = {
    phrase: 'phrase', meaning: 'meaning', sayIt: 'say it', note: 'note', audio: 'audio',
    madeBy: 'made by', language: 'language', code: 'language code', for: 'for',
  };
  const TEMPLATE_TITLE = 'my language pack';

  function distance(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1,
          d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return d[a.length][b.length];
  }

  function suggestLabel(word) {
    let best = null;
    let bestDistance = 3;
    for (const key of Object.keys(KEYS)) {
      if (key.length < 4) continue;
      const dist = distance(word, key);
      if (dist < bestDistance) { best = key; bestDistance = dist; }
    }
    return best;
  }

  function short(text) {
    return text.length > 40 ? text.slice(0, 40) + '…' : text;
  }

  function parsePack(text) {
    const pack = { title: '', language: '', code: '', madeBy: '', for: '', situations: [] };
    const problems = [];
    const add = (level, line, message) => problems.push({ level, line, message });

    let situation = null;
    let phrase = null;
    let target = null;
    let field = null;
    let inComment = false;

    const lines = String(text).replace(/^﻿/, '').split(/\r?\n/);

    function assign(name, value, n) {
      if (name === 'phrase') {
        if (!situation) {
          situation = { name: 'Phrases', madeBy: '', phrases: [], line: n };
          pack.situations.push(situation);
        }
        phrase = { phrase: value, meaning: '', sayIt: '', note: '', audio: '', line: n };
        situation.phrases.push(phrase);
        target = phrase;
        field = 'phrase';
        return;
      }
      if (PHRASE_FIELDS.has(name)) {
        if (!phrase) {
          if (value) add('fix', n, `Line ${n}: "${LABEL[name]}:" needs a "phrase:" line above it.`);
          field = null;
          return;
        }
        if (phrase[name] && value) {
          add('check', n, `Line ${n}: the phrase on line ${phrase.line} already has a "${LABEL[name]}:" line. Did you forget a "phrase:" line?`);
          field = null;
          return;
        }
        phrase[name] = value;
        target = phrase;
        field = name;
        return;
      }
      if (name === 'madeBy') {
        const owner = situation || pack;
        if (!owner.madeBy) owner.madeBy = value;
        target = owner;
        field = 'madeBy';
        return;
      }
      if (PACK_FIELDS.has(name)) {
        if (situation && value) {
          add('check', n, `Line ${n}: put "${LABEL[name]}:" near the top, before the first situation (## ...).`);
        }
        if (!pack[name]) pack[name] = value;
        target = pack;
        field = name;
      }
    }

    lines.forEach((raw, i) => {
      const n = i + 1;
      const line = raw.trim();

      if (inComment) {
        if (line.includes('-->')) inComment = false;
        return;
      }
      if (line.startsWith('<!--')) {
        if (!line.includes('-->')) inComment = true;
        return;
      }
      if (line === '') { field = null; return; }
      if (line.startsWith('>') || /^-{3,}$/.test(line)) return;

      let m = line.match(/^#\s+(.+)$/);
      if (m) {
        if (!pack.title) pack.title = m[1].trim();
        else add('check', n, `Line ${n}: a pack has one title (# ...). Use ## for a situation.`);
        field = null;
        return;
      }
      m = line.match(/^#{2,}\s*(.+)$/);
      if (m) {
        situation = { name: m[1].trim(), madeBy: '', phrases: [], line: n };
        pack.situations.push(situation);
        phrase = null;
        field = null;
        return;
      }

      m = line.match(/^([A-Za-z][A-Za-z ]{0,20}?)\s*:\s*(.*)$/);
      if (m) {
        const key = m[1].toLowerCase().replace(/\s+/g, ' ');
        const value = m[2].trim();
        if (KEYS[key]) { assign(KEYS[key], value, n); return; }
        if (key.split(' ').length <= 2) {
          const guess = suggestLabel(key);
          if (guess) {
            add('fix', n, `Line ${n}: "${m[1]}" isn't a label I know. Did you mean "${guess}"?`);
            field = null;
            return;
          }
          if (!field) {
            add('check', n, `Line ${n}: "${m[1]}" isn't a label I know. Use phrase, meaning, say it, note or audio.`);
            return;
          }
        }
      }

      if (field && target) {
        target[field] = target[field] ? `${target[field]} ${line}` : line;
        return;
      }
      add('check', n, `Line ${n}: I don't understand "${short(line)}". Start the line with a label, like "phrase:" or "meaning:".`);
    });

    // Tidy up and look for problems a student can fix.
    for (const s of pack.situations) {
      s.phrases = s.phrases.filter((p) => {
        const empty = !p.phrase && !p.meaning && !p.sayIt && !p.note && !p.audio;
        if (empty) return false;
        if (!p.phrase) {
          add('fix', p.line, `Line ${p.line}: this "phrase:" line is empty, but the lines under it aren't.`);
          return false;
        }
        if (!p.meaning) {
          add('fix', p.line, `Line ${p.line}: "${short(p.phrase)}" has no meaning. Add a "meaning:" line under it.`);
        }
        return true;
      });
      if (!s.phrases.length) {
        add('check', s.line, `Line ${s.line}: the situation "${short(s.name)}" has no phrases yet.`);
      }
    }

    if (!pack.title) {
      add('fix', 1, 'Add a title on the first line. Start it with "# ", for example: # Spanish (Colombia)');
    } else if (pack.title.toLowerCase() === TEMPLATE_TITLE) {
      add('tip', 1, 'Line 1: change the title to the name of your language.');
    }
    if (!pack.code) {
      add('tip', null, 'Add a "language code:" line near the top. It helps the computer read your phrases aloud and show your writing correctly.');
    } else if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(pack.code)) {
      add('check', null, `"${short(pack.code)}" doesn't look like a language code. A code is short, like "es" or "ar". Ask your agent, then check its answer.`);
    }
    const names = [pack.madeBy, ...pack.situations.map((s) => s.madeBy)];
    if (names.some((name) => /\d{4,}/.test(name))) {
      add('check', null, '"made by" has a number in it. Use your first name or a nickname, never your student number.');
    }

    const playable = playablePhrases(pack).length;
    if (playable > 0 && playable < 4) {
      add('tip', null, `The quiz works best with 4 or more phrases. You have ${playable}.`);
    }

    const order = { fix: 0, check: 1, tip: 2 };
    problems.sort((a, b) => (order[a.level] - order[b.level]) || ((a.line || 0) - (b.line || 0)));
    return { pack, problems };
  }

  function playablePhrases(pack) {
    const out = [];
    for (const s of pack.situations) {
      for (const p of s.phrases) if (p.phrase && p.meaning) out.push(p);
    }
    return out;
  }

  const api = { parsePack, playablePhrases };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TYL = api;
})(typeof window !== 'undefined' ? window : this);
