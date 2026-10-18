/* Teach Your Language: a GEAP 103 class app.
   Packs are plain text files (pack.md). All pack text is shown with
   text nodes, never as HTML. */
(function () {
  'use strict';

  const { parsePack, playablePhrases } = window.TYL;
  const REPO = 'https://github.com/BrettRey/geap-103-language-app';
  const AUDIO_FILE = /\.(mp3|m4a|wav|ogg|oga|webm|aac|mp4)$/i;

  const app = document.getElementById('app');
  const state = {
    packs: new Map(),
    order: [],
    loadError: '',
    mine: null,
    mineUrls: [],
    voices: [],
    homeMessage: '',
    view: '',
  };

  // ---------- small helpers ----------

  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (value == null || value === false) continue;
        if (key === 'class') node.className = value;
        else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
        else node.setAttribute(key, value === true ? '' : String(value));
      }
    }
    for (const child of children.flat(Infinity)) {
      if (child == null || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  function speakerIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    const attrs = { viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor',
      'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
    for (const d of ['M11 5 6 9H3v6h3l5 4V5z', 'M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13']) {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      svg.append(path);
    }
    return svg;
  }

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function plural(n, word) {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
  }

  function makers(pack) {
    const names = [pack.madeBy, ...pack.situations.map((s) => s.madeBy)].filter(Boolean);
    return [...new Set(names)].join(', ');
  }

  function show(...nodes) {
    app.replaceChildren(...nodes);
    const heading = app.querySelector('h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
    window.scrollTo(0, 0);
  }

  function targetText(pack, text, cls) {
    return el('div', { class: cls, lang: pack.code || null, dir: 'auto' }, text);
  }

  function targetSpan(pack, text) {
    return el('span', { lang: pack.code || null, dir: 'auto' }, text);
  }

  function sortProblems(problems) {
    const order = { fix: 0, check: 1, tip: 2 };
    problems.sort((a, b) => (order[a.level] - order[b.level]) || ((a.line || 0) - (b.line || 0)));
  }

  // ---------- sound ----------

  function refreshVoices() {
    if ('speechSynthesis' in window) state.voices = window.speechSynthesis.getVoices();
  }

  function voiceFor(code) {
    if (!code || !state.voices.length) return null;
    const want = code.toLowerCase().replace(/_/g, '-');
    const norm = (v) => v.lang.toLowerCase().replace(/_/g, '-');
    const exact = state.voices.find((v) => norm(v) === want);
    if (exact) return exact;
    const base = want.split('-')[0];
    return state.voices.find((v) => norm(v).split('-')[0] === base) || null;
  }

  function soundFor(pack, phrase) {
    if (phrase.audio) {
      const url = pack.audioUrl(phrase.audio);
      if (url) {
        return () => { new Audio(url).play().catch(() => {}); };
      }
    }
    const voice = voiceFor(pack.code);
    if (!voice) return null;
    return () => {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(phrase.phrase);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    };
  }

  function listenButton(pack, phrase) {
    const play = soundFor(pack, phrase);
    if (!play) return null;
    return el('button', { type: 'button', class: 'listen', onclick: play, 'aria-label': `Listen: ${phrase.phrase}` },
      speakerIcon(), el('span', { 'aria-hidden': 'true' }, 'Listen'));
  }

  // ---------- loading packs ----------

  function record(id, text, audioUrl, extra) {
    const { pack, problems } = parsePack(text);
    return Object.assign({ id, problems, audioUrl, local: false }, pack, extra || {});
  }

  function hostedAudio(id) {
    return (name) => {
      const parts = String(name).split('/').filter(Boolean);
      if (!parts.length || parts.some((p) => p === '..' || p === '.')) return null;
      return `packs/${id}/` + parts.map(encodeURIComponent).join('/');
    };
  }

  async function loadPacks() {
    let ids;
    try {
      const res = await fetch('packs/list.txt', { cache: 'no-cache' });
      if (!res.ok) throw new Error(String(res.status));
      ids = (await res.text()).split(/\r?\n/).map((s) => s.trim())
        .filter((s) => s && !s.startsWith('#') && /^[a-z0-9][a-z0-9-]*$/.test(s));
    } catch (e) {
      state.loadError = "The class packs didn't load. Check your internet connection and reload the page.";
      return;
    }
    await Promise.all(ids.map(async (id) => {
      try {
        const res = await fetch(`packs/${id}/pack.md`, { cache: 'no-cache' });
        if (!res.ok) throw new Error(String(res.status));
        state.packs.set(id, record(id, await res.text(), hostedAudio(id)));
      } catch (e) {
        // A pack that can't load is left out of the list.
      }
    }));
    state.order = ids.filter((id) => state.packs.has(id));
  }

  async function loadMine(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const path = (f) => f.webkitRelativePath || f.name;
    const depth = (f) => path(f).split('/').length;
    const texts = files.filter((f) => /\.(md|txt)$/i.test(f.name)).sort((a, b) => depth(a) - depth(b));
    const packFile = texts.find((f) => f.name.toLowerCase() === 'pack.md') || texts[0];
    if (!packFile) {
      state.homeMessage = "I couldn't find pack.md. Choose the folder that has your pack.md file in it.";
      state.mine = null;
      if (location.hash === '' || location.hash === '#/') route(); else location.hash = '#/';
      return;
    }
    const text = await packFile.text();

    state.mineUrls.forEach((u) => URL.revokeObjectURL(u));
    state.mineUrls = [];
    const audio = new Map();
    for (const f of files) {
      if (AUDIO_FILE.test(f.name) || (f.type || '').startsWith('audio/')) {
        const url = URL.createObjectURL(f);
        state.mineUrls.push(url);
        audio.set(f.name.toLowerCase(), { url, name: f.name });
      }
    }
    const keyOf = (name) => String(name).split('/').pop().toLowerCase();
    const lookup = (name) => (audio.get(keyOf(name)) || {}).url || null;

    const mine = record('mine', text, lookup, { local: true, fileName: packFile.name, audioCount: audio.size });
    const used = new Set();
    for (const s of mine.situations) {
      for (const p of s.phrases) {
        if (!p.audio) continue;
        used.add(keyOf(p.audio));
        if (!audio.has(keyOf(p.audio))) {
          mine.problems.push({ level: 'fix', line: p.line,
            message: `Line ${p.line}: the recording "${p.audio}" isn't in the folder you chose. Check the file name.` });
        }
      }
    }
    for (const [key, info] of audio) {
      if (!used.has(key)) {
        mine.problems.push({ level: 'tip', line: null,
          message: `"${info.name}" is in your folder, but no phrase uses it. Add "audio: ${info.name}" under the right phrase.` });
      }
    }
    if (packFile.name.toLowerCase() !== 'pack.md') {
      mine.problems.push({ level: 'tip', line: null, message: `I opened "${packFile.name}". Name your file pack.md.` });
    }
    sortProblems(mine.problems);

    state.mine = mine;
    state.homeMessage = '';
    if (location.hash === '#/pack/mine') route(); else location.hash = '#/pack/mine';
  }

  function pickers() {
    const folderInput = el('input', { type: 'file', multiple: true, class: 'visually-hidden', tabindex: '-1', 'aria-hidden': 'true' });
    folderInput.setAttribute('webkitdirectory', '');
    folderInput.webkitdirectory = true;
    const filesInput = el('input', { type: 'file', multiple: true, accept: '.md,.txt,audio/*', class: 'visually-hidden', tabindex: '-1', 'aria-hidden': 'true' });
    folderInput.addEventListener('change', () => loadMine(folderInput.files));
    filesInput.addEventListener('change', () => loadMine(filesInput.files));
    return {
      inputs: [folderInput, filesInput],
      folderButton: el('button', { type: 'button', class: 'primary', onclick: () => folderInput.click() }, 'Choose my pack folder'),
      filesButton: el('button', { type: 'button', onclick: () => filesInput.click() }, 'Choose files instead'),
    };
  }

  async function downloadTemplate() {
    try {
      const res = await fetch('template/pack.md', { cache: 'no-cache' });
      if (!res.ok) throw new Error(String(res.status));
      const blob = new Blob([await res.text()], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = el('a', { href: url, download: 'pack.md' });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      window.location.href = `${REPO}/blob/main/template/pack.md`;
    }
  }

  // ---------- pages ----------

  function problemList(problems) {
    if (!problems.length) return el('p', { class: 'ok' }, 'No problems found. Try the flashcards and the quiz.');
    const names = { fix: 'Fix', check: 'Check', tip: 'Tip' };
    return el('ul', { class: 'problems' },
      problems.map((p) => el('li', { class: p.level }, el('span', { class: 'level' }, `${names[p.level]}:`), p.message)));
  }

  function showHome() {
    state.view = 'home';
    const pick = pickers();
    const packs = state.order.map((id) => state.packs.get(id));
    show(
      el('h1', null, 'Teach Your Language'),
      el('p', null, 'A class app for GEAP 103. Each language pack teaches everyday phrases, made by someone who knows the language.'),
      el('h2', null, 'Language packs'),
      state.loadError
        ? el('p', { class: 'feedback bad' }, state.loadError)
        : el('ul', { class: 'cards' }, packs.map((pack) => el('li', null,
          el('a', { class: 'pack-link', href: `#/pack/${pack.id}` },
            el('strong', null, pack.title || pack.id),
            el('span', { class: 'muted small' }, [
              plural(playablePhrases(pack).length, 'phrase'),
              pack.for ? `for ${pack.for}` : '',
              makers(pack) ? `made by ${makers(pack)}` : '',
            ].filter(Boolean).join(' · ')))))),
      el('section', { class: 'panel' },
        el('h2', null, 'Try my pack'),
        el('p', null, 'Made a pack? Open it here to check it and practise with it.'),
        el('p', { class: 'small muted' }, 'Your files stay on your computer. Your browser may say "upload", but this page only reads the files. Nothing is sent anywhere.'),
        state.homeMessage ? el('p', { class: 'feedback bad', role: 'alert' }, state.homeMessage) : null,
        el('div', { class: 'row' }, pick.folderButton, pick.filesButton, pick.inputs),
        el('p', { class: 'small muted' }, 'Choose files instead: select pack.md and your recordings together.'),
        el('div', { class: 'row' },
          el('button', { type: 'button', onclick: downloadTemplate }, 'Download the template'),
          el('a', { class: 'button', href: `${REPO}#readme` }, 'How to make a pack'))),
      el('footer', null, 'GEAP 103 · Fall 2026 · ', el('a', { href: REPO }, 'Instructions and code on GitHub')));
  }

  function phraseItem(pack, p) {
    return el('li', { class: 'phrase' },
      el('div', { class: 'phrase-top' },
        el('div', null,
          targetText(pack, p.phrase, 'target'),
          p.meaning ? el('div', { class: 'meaning' }, p.meaning) : el('div', { class: 'meaning muted' }, '(no meaning yet)')),
        listenButton(pack, p)),
      p.sayIt ? el('div', { class: 'sayit' }, `Say it: ${p.sayIt}`) : null,
      p.note ? el('div', { class: 'note' }, p.note) : null);
  }

  function showPack(pack) {
    state.view = 'pack';
    const base = `#/pack/${pack.id}`;
    const canPlay = playablePhrases(pack).length >= 2;
    const parts = [
      el('a', { href: '#/', class: 'back' }, '← All packs'),
      el('h1', null, pack.title || 'Untitled pack'),
      el('p', { class: 'muted' },
        pack.for ? `For: ${pack.for}` : null,
        pack.for && makers(pack) ? ' · ' : null,
        makers(pack) ? `Made by: ${makers(pack)}` : null),
    ];

    if (pack.local) {
      const pick = pickers();
      parts.push(el('section', { class: 'panel' },
        el('h2', null, 'Check your pack'),
        el('p', null, `From your computer (${pack.fileName}): ${plural(pack.situations.length, 'situation')}, ${plural(playablePhrases(pack).length, 'phrase')}, ${plural(pack.audioCount, 'recording')}.`),
        problemList(pack.problems),
        el('p', { class: 'small muted' }, 'Changed your file? Save it, then choose it again.'),
        el('div', { class: 'row' }, pick.folderButton, pick.filesButton, pick.inputs)));
    }

    parts.push(el('div', { class: 'row' },
      canPlay ? el('a', { class: 'button primary', href: `${base}/cards` }, 'Flashcards') : el('button', { type: 'button', disabled: true }, 'Flashcards'),
      canPlay ? el('a', { class: 'button primary', href: `${base}/quiz` }, 'Quiz') : el('button', { type: 'button', disabled: true }, 'Quiz')));
    if (!canPlay) parts.push(el('p', { class: 'muted small' }, 'Add at least 2 phrases with meanings to use the flashcards and the quiz.'));

    for (const s of pack.situations) {
      parts.push(el('h2', null, s.name, s.madeBy ? el('span', { class: 'by' }, ` · made by ${s.madeBy}`) : null));
      parts.push(s.phrases.length
        ? el('ul', { class: 'phrase-list' }, s.phrases.map((p) => phraseItem(pack, p)))
        : el('p', { class: 'muted' }, 'No phrases yet.'));
    }

    if (!pack.local && pack.problems.length) {
      parts.push(el('details', { class: 'panel' }, el('summary', null, 'Check this pack'), problemList(pack.problems)));
    }
    show(...parts);
  }

  function segmented(options, get, set) {
    const wrap = el('div', { class: 'segmented', role: 'group', 'aria-label': 'Show first' });
    const paint = () => wrap.replaceChildren(...options.map(([value, label]) =>
      el('button', { type: 'button', 'aria-pressed': String(get() === value), onclick: () => { set(value); paint(); } }, label)));
    paint();
    return wrap;
  }

  function showCards(pack) {
    state.view = 'cards';
    const all = playablePhrases(pack);
    if (all.length < 2) { showPack(pack); return; }
    let front = 'phrase';
    let filter = 'all';
    let queue = [];
    let total = 0;
    let revealed = false;
    const stage = el('div');

    const toggle = segmented([['phrase', 'Phrase'], ['meaning', 'Meaning']], () => front, (v) => { front = v; start(); });
    const select = el('select', { 'aria-label': 'Situation' },
      el('option', { value: 'all' }, 'All situations'),
      pack.situations.map((s, i) => (s.phrases.some((p) => p.meaning) ? el('option', { value: String(i) }, s.name) : null)));
    select.addEventListener('change', () => { filter = select.value; start(); });

    function pool() {
      if (filter === 'all') return all;
      return pack.situations[Number(filter)].phrases.filter((p) => p.phrase && p.meaning);
    }
    function start() {
      queue = shuffle(pool());
      total = queue.length;
      revealed = false;
      draw();
    }
    function draw() {
      if (!queue.length) {
        const again = el('button', { type: 'button', class: 'primary', onclick: start }, 'Start again');
        stage.replaceChildren(el('div', { class: 'flashcard' },
          el('p', { class: 'big' }, 'Finished!'),
          el('p', null, `You went through ${plural(total, 'card')}.`),
          el('div', { class: 'row', style: 'justify-content:center' }, again)));
        again.focus();
        return;
      }
      const p = queue[0];
      const done = total - queue.length;
      const card = el('div', { class: 'flashcard' });
      if (front === 'phrase') {
        card.append(targetText(pack, p.phrase, 'target'));
        const listen = listenButton(pack, p);
        if (listen) card.append(el('div', { class: 'row', style: 'justify-content:center' }, listen));
      } else {
        card.append(el('div', { class: 'big' }, p.meaning));
      }
      if (revealed) {
        card.append(el('hr'));
        if (front === 'phrase') {
          card.append(el('div', { class: 'big' }, p.meaning));
        } else {
          card.append(targetText(pack, p.phrase, 'target'));
          const listen = listenButton(pack, p);
          if (listen) card.append(el('div', { class: 'row', style: 'justify-content:center' }, listen));
        }
        if (p.sayIt) card.append(el('p', { class: 'sayit' }, `Say it: ${p.sayIt}`));
        if (p.note) card.append(el('p', { class: 'note' }, p.note));
      }
      const main = revealed
        ? el('button', { type: 'button', class: 'primary', onclick: () => { queue.shift(); revealed = false; draw(); } }, 'Got it')
        : el('button', { type: 'button', class: 'primary', onclick: () => { revealed = true; draw(); } }, 'Show answer');
      const buttons = revealed
        ? el('div', { class: 'row' }, el('button', { type: 'button', onclick: () => { queue.push(queue.shift()); revealed = false; draw(); } }, 'Again'), main)
        : el('div', { class: 'row' }, main);
      stage.replaceChildren(
        el('p', { class: 'small muted' }, `${queue.length} left`),
        el('div', { class: 'progress', role: 'progressbar', 'aria-label': 'Cards finished', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(done) },
          el('div', { style: `width:${total ? Math.round((done / total) * 100) : 0}%` })),
        card,
        buttons);
      main.focus({ preventScroll: true });
    }

    show(
      el('a', { href: `#/pack/${pack.id}`, class: 'back' }, '← Back to the pack'),
      el('h1', null, `Flashcards: ${pack.title || 'Untitled pack'}`),
      el('div', { class: 'row' }, el('span', null, 'Show first:'), toggle, select),
      stage);
    start();
  }

  function makeQuestion(pack, answer, pool) {
    const kinds = ['meaning-to-phrase', 'phrase-to-meaning'];
    if (soundFor(pack, answer)) kinds.push('listen');
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const key = kind === 'meaning-to-phrase'
      ? (p) => p.phrase.trim().toLowerCase()
      : (p) => p.meaning.trim().toLowerCase();
    const seen = new Set([key(answer)]);
    const others = [];
    for (const p of shuffle(pool)) {
      if (others.length === 3) break;
      if (p === answer || seen.has(key(p))) continue;
      seen.add(key(p));
      others.push(p);
    }
    return { kind, answer, options: shuffle([answer, ...others]) };
  }

  function showQuiz(pack) {
    state.view = 'quiz';
    const pool = playablePhrases(pack);
    if (pool.length < 2) { showPack(pack); return; }
    const stage = el('div');
    let questions = [];
    let index = 0;
    let score = 0;
    let missed = [];

    function build(list, all) {
      const chosen = all ? shuffle(list).slice(0, Math.min(10, list.length)) : shuffle(list);
      questions = chosen.map((p) => makeQuestion(pack, p, pool));
      index = 0;
      score = 0;
      missed = [];
      ask();
    }

    function ask() {
      const q = questions[index];
      const feedback = el('div', { 'aria-live': 'polite' });
      const next = el('div', { class: 'row' });
      const buttons = q.options.map((opt) => {
        const b = el('button', { type: 'button' },
          q.kind === 'meaning-to-phrase' ? targetSpan(pack, opt.phrase) : opt.meaning);
        b.addEventListener('click', () => answer(opt, b));
        return b;
      });

      function answer(opt, button) {
        buttons.forEach((b) => { b.disabled = true; });
        const right = opt === q.answer;
        buttons[q.options.indexOf(q.answer)].classList.add('correct');
        if (right) score += 1;
        else { button.classList.add('wrong'); missed.push(q.answer); }
        const p = q.answer;
        feedback.replaceChildren(el('div', { class: `feedback ${right ? 'good' : 'bad'}` },
          el('p', null, el('strong', null, right ? 'Correct!' : 'Not quite.')),
          el('p', null, targetSpan(pack, p.phrase), ' = ', p.meaning),
          p.sayIt ? el('p', { class: 'sayit' }, `Say it: ${p.sayIt}`) : null,
          p.note ? el('p', { class: 'note' }, p.note) : null));
        const last = index === questions.length - 1;
        const go = el('button', { type: 'button', class: 'primary',
          onclick: () => { if (last) finish(); else { index += 1; ask(); } } },
        last ? 'See my score' : 'Next question');
        const listen = q.kind === 'meaning-to-phrase' ? listenButton(pack, p) : null;
        next.replaceChildren(...[go, listen].filter(Boolean));
        go.focus({ preventScroll: true });
      }

      let prompt;
      let play = null;
      if (q.kind === 'meaning-to-phrase') {
        prompt = [el('p', null, 'How do you say this?'), el('p', { class: 'big' }, q.answer.meaning)];
      } else if (q.kind === 'phrase-to-meaning') {
        prompt = [el('p', null, 'What does this mean?'),
          el('div', { class: 'row' }, targetText(pack, q.answer.phrase, 'big'), listenButton(pack, q.answer))];
      } else {
        play = soundFor(pack, q.answer);
        prompt = [el('p', null, 'Listen. What does it mean?'),
          el('div', { class: 'row' }, el('button', { type: 'button', class: 'primary', onclick: play }, speakerIcon(), 'Play'))];
      }
      const heading = el('p', { class: 'small muted', tabindex: '-1' }, `Question ${index + 1} of ${questions.length} · Score: ${score}`);
      stage.replaceChildren(
        heading,
        el('div', { class: 'progress' }, el('div', { style: `width:${Math.round((index / questions.length) * 100)}%` })),
        el('div', { class: 'panel' }, prompt,
          el('div', { class: 'options', role: 'group', 'aria-label': 'Answers' }, buttons),
          feedback, next));
      heading.focus({ preventScroll: true });
      if (play) { try { play(); } catch (e) { /* the Play button still works */ } }
    }

    function finish() {
      const n = questions.length;
      const practise = missed.slice();
      stage.replaceChildren(el('div', { class: 'panel' },
        el('p', { class: 'big', tabindex: '-1' }, `You got ${score} out of ${n}.`),
        practise.length
          ? [el('p', null, 'Practise these:'),
            el('ul', null, practise.map((p) => el('li', null, targetSpan(pack, p.phrase), ' = ', p.meaning)))]
          : el('p', null, 'All correct. Well done!'),
        el('div', { class: 'row' },
          practise.length ? el('button', { type: 'button', class: 'primary', onclick: () => build(practise, false) }, 'Practise the missed ones') : null,
          el('button', { type: 'button', onclick: () => build(pool, true) }, 'New quiz'),
          el('a', { class: 'button', href: `#/pack/${pack.id}` }, 'Back to the pack'))));
      stage.querySelector('.big').focus({ preventScroll: true });
    }

    show(
      el('a', { href: `#/pack/${pack.id}`, class: 'back' }, '← Back to the pack'),
      el('h1', null, `Quiz: ${pack.title || 'Untitled pack'}`),
      stage);
    build(pool, true);
  }

  function showMissing(id) {
    state.view = 'missing';
    if (id === 'mine') {
      const pick = pickers();
      show(el('a', { href: '#/', class: 'back' }, '← All packs'),
        el('h1', null, 'Your pack'),
        el('p', null, 'Your pack isn\'t open. Choose your pack folder again.'),
        el('div', { class: 'row' }, pick.folderButton, pick.filesButton, pick.inputs));
      return;
    }
    show(el('a', { href: '#/', class: 'back' }, '← All packs'),
      el('h1', null, 'Pack not found'),
      el('p', null, "I can't find that pack. Go back to the list of packs."));
  }

  function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (parts[0] === 'pack' && parts[1]) {
      const pack = parts[1] === 'mine' ? state.mine : state.packs.get(parts[1]);
      if (!pack) { showMissing(parts[1]); return; }
      if (parts[2] === 'cards') { showCards(pack); return; }
      if (parts[2] === 'quiz') { showQuiz(pack); return; }
      showPack(pack);
      return;
    }
    showHome();
  }

  // ---------- start ----------

  async function init() {
    if ('speechSynthesis' in window) {
      refreshVoices();
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        const before = state.voices.length;
        refreshVoices();
        if (before === 0 && state.voices.length && state.view === 'pack') route();
      });
    }
    await loadPacks();
    window.addEventListener('hashchange', route);
    route();
  }

  init();
})();
