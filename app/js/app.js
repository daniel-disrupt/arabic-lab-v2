/* ─────────────── VOCAB DATA (curated starter list + user-saved) ─────────────── */
const SAVED_VOCAB = SEED_VOCAB.slice();

/* ─────────────── READER STATE ─────────────── */
const wordEls = [];
const chunkRanges = [];
const timedWords = [];
const sentenceEls = [];
let liveWordIdx = -1;
let activeSentenceEl = null;
let enVisible = false;
let dragActive = false, dragStartIdx = -1, dragEndIdx = -1;
let lastActionWasDrag = false;
let currentSelectionCtx = null;
let lastScrolledChunkCi = -1;

/* ─────────────── LANGUAGE PREFERENCE (global, top-bar) ─────────────── */
// 'he' = Hebrew-primary with full grammatical scaffolding (בניין, שורש badges, Hebrew
// conjugation column) — English still reachable per word/phrase via the EN chip.
// 'en' = stripped English-only mode, no Hebrew script or Hebrew-specific framing anywhere,
// and every UI label/menu/button switches to English too (not just the learning content).
let appLang = localStorage.getItem('arabicLabLang') || 'he';
// Canonical Hebrew pronoun strings used throughout verbs-data.js conjugation rows.
const PRONOUN_EN = { 'אני':'I', 'אתה':'you (m.)', 'את':'you (f.)', 'הוא':'he', 'היא':'she', 'אנחנו':'we', 'אתם/ן':'you (pl.)', 'הם/ן':'they' };
const TAB_LABELS = {
  en: { reader: 'Reader', vocab: 'Vocab', verbs: 'Verbs', about: 'About' },
  he: { reader: 'קורא', vocab: 'אוצר מילים', verbs: 'פעלים', about: 'אודות' },
};
const INTRO_CONTENT = {
  en: {
    title: "Abed Abu Shehadeh's Speech",
    speakerLabel: 'Speaker:', speaker: 'Abed Abu Shehadeh',
    locationLabel: 'Location:', location: 'Ghazaza Park, Jaffa · June 28, 2026',
    text: "Abed Abu Shehadeh's call to a grieving, frustrated Jaffa — recorded live at a protest against organized crime and police inaction, then cleaned up here into a readable text synced with the real audio. Listen first, then read: tap any word, or drag across a phrase, for its meaning. The full story is in the About tab.",
  },
  he: {
    title: 'נאומו של עבד אבו שחאדה',
    speakerLabel: 'דובר:', speaker: 'עבד אבו שחאדה',
    locationLabel: 'מיקום:', location: 'גן אל-ע׳זאזווה, יפו · 28 ביוני 2026',
    text: 'קריאתו של עבד אבו שחאדה ליפו האבלה והמתוסכלת — הוקלטה בשידור חי בהפגנה נגד הפשיעה המאורגנת וכשלון המשטרה, ונערכה כאן לטקסט קריא המסונכרן עם ההקלטה האמיתית. תחילה הקשיבו, ואז קראו: הקישו על כל מילה, או גררו על פני ביטוי, לקבלת פירושו. הסיפור המלא נמצא בלשונית "אודות".',
  },
};
// Every static UI label/menu/button in Vocab/Verbs/Reader chrome — keyed by appLang.
const STRINGS = {
  en: {
    vocabTitle: 'Saved Vocabulary',
    vocabSearchPlaceholder: 'Search Arabic, Hebrew, English…',
    filterAll: 'All', filterVerbs: 'Verbs', filterPhrases: 'Phrases', filterOtherWords: 'Other words',
    sortSpeech: 'Order in speech', sortAlpha: 'Alphabetical (Arabic)', sortRecent: 'Recently added',
    vocabEmpty: 'No words or phrases saved yet — tap a word or drag across a phrase in the Reader, then Save.',
    vocabNoResults: 'No vocab matches this search or filter.',
    vocabItemsCount: n => n + (n === 1 ? ' item' : ' items'),
    vocabCountOf: (shown, total) => (shown === 1 ? '1 item' : shown + ' items') + ' of ' + total,
    showSourceLine: 'Show source line',
    removeFromVocab: 'Remove from vocab',
    saveWord: 'Save word', savePhrase: 'Save phrase', alreadySaved: 'Already saved',
    savedToVocab: ar => '"' + ar + '" saved to Vocab',
    andVerbs: ' and Verbs',
    removedFromVocab: ar => '"' + ar + '" removed from Vocab',
    verbsTitle: 'Verbs in this lesson',
    verbsCount: n => n + (n === 1 ? ' verb' : ' verbs'),
    audioOn: 'Audio: On', audioOff: 'Audio: Off',
    audioToggleTitle: 'Turn off to read without the player driving audio',
    muteAudio: 'Mute audio', unmuteAudio: 'Unmute audio',
    jumpToAudio: 'Jump to this part of the audio',
  },
  he: {
    vocabTitle: 'אוצר מילים שמור',
    vocabSearchPlaceholder: 'חיפוש בערבית, עברית, אנגלית…',
    filterAll: 'הכול', filterVerbs: 'פעלים', filterPhrases: 'ביטויים', filterOtherWords: 'מילים אחרות',
    sortSpeech: 'לפי סדר בנאום', sortAlpha: 'אלפביתי (ערבית)', sortRecent: 'נוספו לאחרונה',
    vocabEmpty: 'עדיין לא נשמרו מילים או ביטויים — הקישו על מילה או גררו על פני ביטוי בלשונית הקורא, ואז שמרו.',
    vocabNoResults: 'אין פריטי אוצר מילים התואמים לחיפוש או לסינון.',
    vocabItemsCount: n => n + (n === 1 ? ' פריט' : ' פריטים'),
    vocabCountOf: (shown, total) => (shown === 1 ? 'פריט 1' : shown + ' פריטים') + ' מתוך ' + total,
    showSourceLine: 'הצג שורת מקור',
    removeFromVocab: 'הסר מאוצר המילים',
    saveWord: 'שמור מילה', savePhrase: 'שמור ביטוי', alreadySaved: 'כבר נשמר',
    savedToVocab: ar => '"' + ar + '" נשמר באוצר המילים',
    andVerbs: ' ובפעלים',
    removedFromVocab: ar => '"' + ar + '" הוסר מאוצר המילים',
    verbsTitle: 'פעלים בשיעור זה',
    verbsCount: n => n + (n === 1 ? ' פועל' : ' פעלים'),
    audioOn: 'שמע: פועל', audioOff: 'שמע: כבוי',
    audioToggleTitle: 'כבו כדי לקרוא בלי שהנגן ינהל את השמע',
    muteAudio: 'השתק שמע', unmuteAudio: 'בטל השתקה',
    jumpToAudio: 'קפצו לחלק הזה בהקלטה',
  },
};
function t(key) { return STRINGS[appLang][key]; }
function setAppLang(lang) {
  appLang = lang;
  localStorage.setItem('arabicLabLang', lang);
  applyAppLang();
}
function applyAppLang() {
  // Scoped to specific text elements via CSS (body.lang-en ...) — does not flip the app's overall RTL layout.
  document.body.classList.toggle('lang-en', appLang === 'en');
  document.querySelectorAll('.lang-switch-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === appLang));
  const intro = INTRO_CONTENT[appLang];
  document.getElementById('lesson-title').textContent = intro.title;
  document.getElementById('meta-speaker-label').textContent = intro.speakerLabel;
  document.getElementById('meta-speaker-value').textContent = intro.speaker;
  document.getElementById('meta-location-label').textContent = intro.locationLabel;
  document.getElementById('meta-location-value').textContent = intro.location;
  document.getElementById('lesson-intro').textContent = intro.text;
  const tabLabels = TAB_LABELS[appLang];
  document.getElementById('tab-reader').textContent = tabLabels.reader;
  document.getElementById('tab-vocab').textContent = tabLabels.vocab;
  document.getElementById('tab-verbs').textContent = tabLabels.verbs;
  document.getElementById('tab-about').textContent = tabLabels.about;
  document.getElementById('vocab-title').textContent = t('vocabTitle');
  document.getElementById('vocab-search').placeholder = t('vocabSearchPlaceholder');
  document.getElementById('chip-all').textContent = t('filterAll');
  document.getElementById('chip-verb').textContent = t('filterVerbs');
  document.getElementById('chip-phrase').textContent = t('filterPhrases');
  document.getElementById('chip-other').textContent = t('filterOtherWords');
  document.getElementById('sort-speech').textContent = t('sortSpeech');
  document.getElementById('sort-alpha').textContent = t('sortAlpha');
  document.getElementById('sort-recent').textContent = t('sortRecent');
  document.getElementById('vocab-empty').textContent = t('vocabEmpty');
  document.getElementById('verbs-title').textContent = t('verbsTitle');
  document.getElementById('audio-toggle-btn').textContent = audioModeOn ? t('audioOn') : t('audioOff');
  document.getElementById('audio-toggle-btn').title = t('audioToggleTitle');
  document.getElementById('mute-btn').title = audioEl.muted ? t('unmuteAudio') : t('muteAudio');
  document.querySelectorAll('.chunk-time').forEach(el => el.title = t('jumpToAudio'));
  if (document.getElementById('tray').classList.contains('open')) closeTray(); // avoid a stale mixed-language tray after switching mid-selection (header-gloss trays have no currentSelectionCtx)
  renderVocabView();
  renderVerbsView();
  if (document.getElementById('view-about').classList.contains('active')) renderAboutView();
}
function rootMetaHtml(root, sharedRoot) {
  if (!root) return '';
  if (appLang === 'en') {
    return sharedRoot
      ? '<div class="gloss-root"><span class="root-dot"></span>Shared root &middot; ' + root + '</div>'
      : '<div class="gloss-root" style="opacity:.4">Root &middot; ' + root + '</div>';
  }
  return sharedRoot
    ? '<div class="gloss-root"><span class="root-dot"></span>שורש משותף &middot; ' + root + '</div>'
    : '<div class="gloss-root" style="opacity:.4">שורש &middot; ' + root + '</div>';
}
function phraseTypeBadgeHtml(type) {
  if (!type) return '';
  const label = appLang === 'en'
    ? (type === 'proverb' ? 'Proverb' : 'Idiom')
    : (type === 'proverb' ? 'פתגם' : 'ביטוי');
  return '<span class="badge badge-' + type + '">' + label + '</span>';
}

/* ─────────────── AUDIO ─────────────── */
const audioEl = document.getElementById('audio-el');
let speed = 1;
let audioModeOn = true;
function toggleAudioMode() {
  audioModeOn = !audioModeOn;
  document.getElementById('audio-bar').classList.toggle('audio-off', !audioModeOn);
  const btn = document.getElementById('audio-toggle-btn');
  btn.textContent = audioModeOn ? t('audioOn') : t('audioOff');
  btn.classList.toggle('on', audioModeOn);
  if (!audioModeOn) audioEl.pause();
}

/* ─────────────── VERBS STATE ─────────────── */
let activeVerbId = SAVED_VERBS[0] ? SAVED_VERBS[0].id : null;
let activeConjTab = 'present';
let collapsedVerbGroups = new Set();
function toggleVerbGroup(key) {
  key = String(key);
  if (collapsedVerbGroups.has(key)) collapsedVerbGroups.delete(key);
  else collapsedVerbGroups.add(key);
  renderVerbsView();
}

/* ─────────────── TAB SWITCHING ─────────────── */
function switchTab(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const viewEl = document.getElementById('view-' + name);
  if (viewEl) viewEl.classList.add('active');
  else { document.getElementById('view-reader').classList.add('active'); name = 'reader'; }
  const tabs = document.querySelectorAll('.tab');
  const idx = ['reader','vocab','verbs','about'].indexOf(name);
  if (idx !== -1) tabs[idx].classList.add('active');
  if (name === 'verbs') renderVerbsView();
  if (name === 'vocab') renderVocabView();
  if (name === 'about') renderAboutView();
}

/* ─────────────── READER BUILD ─────────────── */
function buildReader() {
  const reader = document.getElementById('reader');
  let gi = 0;
  CHUNKS.forEach((chunk, ci) => {
    const div = document.createElement('div');
    div.className = 'chunk'; div.dataset.ci = ci;
    const timeEl = document.createElement('div');
    timeEl.className = 'chunk-time'; timeEl.textContent = chunk.label;
    timeEl.title = t('jumpToAudio');
    timeEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!audioModeOn) return;
      audioEl.currentTime = chunk.start; audioEl.play();
    });
    div.appendChild(timeEl);
    div.addEventListener('click', () => {
      if (lastActionWasDrag) { lastActionWasDrag = false; return; }
      if (!audioModeOn) return;
      const inThisChunk = audioEl.currentTime >= chunk.start && audioEl.currentTime < chunk.end;
      if (inThisChunk) {
        // Audio is already positioned in this chunk — pause in place so the user can click
        // around freely (translate words, etc.) without losing their spot. Resumes exactly
        // where it paused via the play button, not from the chunk's start.
        audioEl.pause();
      } else {
        audioEl.currentTime = chunk.start; audioEl.play();
      }
    });
    const p = document.createElement('p');
    const startIdx = gi;
    let sentenceSpan = document.createElement('span');
    sentenceSpan.className = 'sentence';
    p.appendChild(sentenceSpan);
    chunk.text.forEach((word) => {
      if (word.sep !== undefined) { sentenceSpan.appendChild(document.createTextNode(word.sep + ' ')); return; }
      if (word.sentT !== undefined) sentenceEls.push({ el: sentenceSpan, t: word.sentT });
      const span = document.createElement('span');
      span.className = 'word'; span.textContent = word.w; span.dataset.idx = gi;
      wordEls.push({ el: span, data: word, globalIdx: gi++ });
      sentenceSpan.appendChild(span);
      if (word.punct) sentenceSpan.appendChild(document.createTextNode(word.punct));
      sentenceSpan.appendChild(document.createTextNode(' '));
      if (word.punct === '.' || word.punct === '؟') {
        sentenceSpan = document.createElement('span');
        sentenceSpan.className = 'sentence';
        p.appendChild(sentenceSpan);
      }
    });
    chunkRanges.push({ ci, startIdx, endIdx: gi - 1 });
    div.appendChild(p); reader.appendChild(div);
  });
  wordEls.forEach(({ data, globalIdx }) => { if (data.t !== undefined) timedWords.push({ idx: globalIdx, t: data.t }); });
  timedWords.sort((a, b) => a.t - b.t);
  sentenceEls.sort((a, b) => a.t - b.t);
  reader.addEventListener('mousedown', onDragStart);
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
  reader.addEventListener('touchstart', onTouchStart, { passive: false });
  reader.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);
  document.addEventListener('touchcancel', onTouchCancel);
  document.getElementById('scroll-area').addEventListener('mousedown', (e) => {
    if (!e.target.classList.contains('word')) { clearSelection(); closeTray(); }
  });
  // Touch equivalent of the mousedown handler above. A plain mousedown listener never fires
  // reliably from touch: any tiny finger jitter during a tap starts a scroll gesture, and once
  // that happens the browser suppresses the synthetic mouse events it would otherwise dispatch
  // after touchend — so taps meant to dismiss the tray were silently swallowed. Tracking touch
  // start/end directly and only treating it as a tap when movement stays under the same
  // long-press-drag threshold used elsewhere fixes that without misfiring on scroll swipes.
  let outsideTouchStartX = 0, outsideTouchStartY = 0, outsideTouchStartTarget = null, outsideTouchTracking = false;
  const scrollAreaEl = document.getElementById('scroll-area');
  scrollAreaEl.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    outsideTouchStartX = t.clientX; outsideTouchStartY = t.clientY;
    outsideTouchStartTarget = e.target; outsideTouchTracking = true;
  }, { passive: true });
  scrollAreaEl.addEventListener('touchend', (e) => {
    if (!outsideTouchTracking) return;
    outsideTouchTracking = false;
    const t = e.changedTouches[0];
    const dx = Math.abs(t.clientX - outsideTouchStartX), dy = Math.abs(t.clientY - outsideTouchStartY);
    if (dx > TOUCH_MOVE_THRESHOLD || dy > TOUCH_MOVE_THRESHOLD) return; // was a scroll, not a tap
    if (!outsideTouchStartTarget.closest('.word')) { clearSelection(); closeTray(); }
  });
}

/* ─────────────── MOBILE TRAY: swipe-down-to-close via the drag handle ─────────────── */
function initTrayGestures() {
  const handle = document.getElementById('tray-handle');
  const tray = document.getElementById('tray');
  let startY = null, dragging = false;
  handle.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY; dragging = true;
    tray.style.transition = 'none';
  }, { passive: true });
  handle.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0) { tray.style.transform = 'translateY(' + dy + 'px)'; e.preventDefault(); }
  }, { passive: false });
  handle.addEventListener('touchend', (e) => {
    if (!dragging) return;
    dragging = false;
    const dy = e.changedTouches[0].clientY - startY;
    tray.style.transition = ''; tray.style.transform = '';
    if (dy > 60) closeTray();
  });
  handle.addEventListener('touchcancel', () => {
    dragging = false; tray.style.transition = ''; tray.style.transform = '';
  });
  // A plain tap on the handle (no drag) also closes the tray — not everyone will think to swipe.
  handle.addEventListener('click', closeTray);
}

function wordAtPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  return (el && el.classList.contains('word')) ? parseInt(el.dataset.idx, 10) : -1;
}
function onDragStart(e) { const i = wordAtPoint(e.clientX, e.clientY); if (i<0) return; e.preventDefault(); dragActive=true; dragStartIdx=i; dragEndIdx=i; renderRange(i,i); }
function onDragMove(e) { if (!dragActive) return; const i = wordAtPoint(e.clientX, e.clientY); if (i>=0 && i!==dragEndIdx) { dragEndIdx=i; renderRange(Math.min(dragStartIdx,dragEndIdx), Math.max(dragStartIdx,dragEndIdx)); } }
function onDragEnd() { if (!dragActive) return; dragActive=false; const lo=Math.min(dragStartIdx,dragEndIdx), hi=Math.max(dragStartIdx,dragEndIdx); lastActionWasDrag = lo!==hi; lo===hi ? commitWord(lo) : commitPhrase(lo,hi); }
// Touch is also how mobile scrolls, and nearly all reading text is a `.word` span — so a plain
// swipe-to-scroll that starts on a word must never be mistaken for a phrase drag-select. A
// ~350ms hold arms drag mode (mirrors the long-press-to-select gesture mobile OSes already use);
// anything that moves past a small threshold before that timer fires is treated as a scroll and
// left completely alone (no preventDefault, so native scrolling is untouched).
const TOUCH_LONG_PRESS_MS = 350;
const TOUCH_MOVE_THRESHOLD = 10;
let touchTimer = null, touchStartX = 0, touchStartY = 0, touchStartIdx = -1, touchArmed = false;
function clearTouchTimer() { if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; } }
function onTouchStart(e) {
  const t = e.touches[0], i = wordAtPoint(t.clientX, t.clientY);
  if (i < 0) return;
  e.preventDefault(); // suppresses the synthetic mouse-event sequence, not scrolling
  touchStartX = t.clientX; touchStartY = t.clientY; touchStartIdx = i; touchArmed = false;
  clearTouchTimer();
  touchTimer = setTimeout(() => {
    touchArmed = true; dragActive = true; dragStartIdx = i; dragEndIdx = i;
    renderRange(i, i);
  }, TOUCH_LONG_PRESS_MS);
}
function onTouchMove(e) {
  const t = e.touches[0];
  if (!touchArmed) {
    if (touchStartIdx < 0) return;
    const dx = Math.abs(t.clientX - touchStartX), dy = Math.abs(t.clientY - touchStartY);
    if (dx > TOUCH_MOVE_THRESHOLD || dy > TOUCH_MOVE_THRESHOLD) { clearTouchTimer(); touchStartIdx = -1; }
    return;
  }
  e.preventDefault(); // actively drag-selecting now — block scroll while extending the range
  const i = wordAtPoint(t.clientX, t.clientY);
  if (i >= 0 && i !== dragEndIdx) { dragEndIdx = i; renderRange(Math.min(dragStartIdx, dragEndIdx), Math.max(dragStartIdx, dragEndIdx)); }
}
function onTouchEnd() {
  clearTouchTimer();
  if (touchArmed) {
    touchArmed = false;
    if (dragActive) {
      dragActive = false;
      const lo = Math.min(dragStartIdx, dragEndIdx), hi = Math.max(dragStartIdx, dragEndIdx);
      lastActionWasDrag = lo !== hi;
      lo === hi ? commitWord(lo) : commitPhrase(lo, hi);
    }
  } else if (touchStartIdx >= 0) {
    commitWord(touchStartIdx); // released before the long-press armed — same instant tap as before
  }
  touchStartIdx = -1;
}
function onTouchCancel() {
  clearTouchTimer();
  touchArmed = false; touchStartIdx = -1;
  if (dragActive) { dragActive = false; clearSelection(); }
}
function renderRange(lo, hi) { wordEls.forEach(({el,globalIdx:gi}) => { const inR=gi>=lo&&gi<=hi; el.classList.toggle('in-range',inR); el.classList.toggle('range-start',gi===lo); el.classList.toggle('range-end',gi===hi); el.classList.remove('selected'); }); }
function clearSelection() { wordEls.forEach(({el}) => el.classList.remove('in-range','range-start','range-end','selected')); dragStartIdx=-1; dragEndIdx=-1; }
function ciForIdx(idx) { const r = chunkRanges.find(r => idx>=r.startIdx && idx<=r.endIdx); return r ? r.ci : 0; }
function commitWord(idx) {
  clearSelection();
  const {el,data} = wordEls[idx]; el.classList.add('selected');
  document.getElementById('tray-ar').textContent = data.w;
  document.getElementById('tray-ar').className = 'tray-arabic';
  document.getElementById('tray-he').textContent = appLang === 'en' ? (data.en||'') : data.he;
  document.getElementById('tray-en').textContent = data.en||'';
  document.getElementById('tray-meta').innerHTML = rootMetaHtml(data.root, !!data.sharedRoot);
  currentSelectionCtx = { type:'word', ar:data.w, he:data.he, en:data.en||'', root:data.root||null, sharedRoot:!!data.sharedRoot, isVerb:data.pos==='verb', ci:ciForIdx(idx) };
  refreshSaveButton();
  resetEnChip(); openTray();
}
function commitPhrase(lo, hi) {
  wordEls.forEach(({el,globalIdx:gi}) => { el.classList.toggle('in-range',gi>=lo&&gi<=hi); el.classList.remove('range-start','range-end','selected'); });
  const phrase = wordEls.slice(lo,hi+1).map(w=>w.data.w).join(' ');
  const pws = wordEls.slice(lo,hi+1).map(w=>w.data.w);
  document.getElementById('tray-ar').textContent = phrase;
  document.getElementById('tray-ar').className = 'tray-arabic phrase';
  let gloss = null;
  for (const pg of PHRASE_GLOSSES) { if (pg.keys.filter(k=>pws.includes(k)).length >= Math.min(2,pg.keys.length)) { gloss=pg; break; } }
  const fallbackHe = wordEls.slice(lo,hi+1).map(w=>w.data.he).filter(Boolean).join(' ');
  const fallbackEn = wordEls.slice(lo,hi+1).map(w=>w.data.en).filter(Boolean).join(' ');
  const heText = gloss ? gloss.he : (fallbackHe || '—');
  const enText = gloss ? gloss.en : fallbackEn;
  document.getElementById('tray-he').textContent = appLang === 'en' ? (enText || '—') : heText;
  document.getElementById('tray-en').textContent = enText;
  document.getElementById('tray-meta').innerHTML = phraseTypeBadgeHtml(gloss ? gloss.type : null);
  currentSelectionCtx = { type:'phrase', ar:phrase, he:heText, en:enText, phraseType:gloss?gloss.type:null, ci:ciForIdx(lo) };
  refreshSaveButton();
  resetEnChip(); openTray();
}
function refreshSaveButton() {
  const btn = document.getElementById('save-btn');
  if (!currentSelectionCtx) { btn.style.display = 'none'; return; }
  btn.style.display = '';
  const label = currentSelectionCtx.type === 'phrase' ? t('savePhrase') : t('saveWord');
  const already = SAVED_VOCAB.some(v => v.ar === currentSelectionCtx.ar);
  btn.textContent = already ? t('alreadySaved') : label;
  btn.disabled = already;
  btn.classList.toggle('saved', already);
}
// Lesson header text (title / location) isn't saveable vocab — tapping it just shows a translation
// in the same tray UI, with currentSelectionCtx left null so refreshSaveButton hides the Save button.
const HEADER_GLOSS = {
  title: {
    ar: 'كَلِمَة عَبْد أَبُو شَحَادَة',
    en: "Abed Abu Shehadeh's Speech",
    he: 'נאומו של עבד אבו שחאדה',
  },
  location: {
    ar: 'وقفة يافا — حديقة الغزازوة، ٢٨ حزيران ٢٠٢٦',
    en: 'Ghazaza Park, Jaffa · June 28, 2026',
    he: 'גן אל-ע׳זאזווה, יפו · 28 ביוני 2026',
  },
};
function showHeaderGloss(key) {
  clearSelection();
  const g = HEADER_GLOSS[key];
  document.getElementById('tray-ar').textContent = g.ar;
  document.getElementById('tray-ar').className = key === 'location' ? 'tray-arabic phrase' : 'tray-arabic';
  document.getElementById('tray-he').textContent = appLang === 'en' ? g.en : g.he;
  document.getElementById('tray-en').textContent = g.en;
  document.getElementById('tray-meta').innerHTML = '';
  currentSelectionCtx = null;
  refreshSaveButton();
  resetEnChip(); openTray();
}
function openTray() { document.getElementById('tray').classList.add('open'); }
function closeTray() { document.getElementById('tray').classList.remove('open'); clearSelection(); }
function resetEnChip() {
  const wrap = document.getElementById('gloss-en-wrap');
  if (appLang === 'en') { wrap.style.display = 'none'; enVisible = false; return; }
  wrap.style.display = '';
  enVisible = false;
  document.getElementById('tray-en').classList.add('hidden');
  const c = document.getElementById('en-chip');
  c.classList.remove('showing');
  c.textContent = 'EN ›';
}
function toggleEn(e) { e.stopPropagation(); enVisible=!enVisible; document.getElementById('tray-en').classList.toggle('hidden',!enVisible); const c=document.getElementById('en-chip'); c.classList.toggle('showing',enVisible); c.textContent=enVisible?'EN ×':'EN ›'; }

/* ─────────────── REAL AUDIO PLAYBACK ─────────────── */
function togglePlay() { audioEl.paused ? audioEl.play() : audioEl.pause(); }
function fmtTime(s) { if (!isFinite(s)) return '0:00'; const m=Math.floor(s/60), sec=Math.floor(s%60).toString().padStart(2,'0'); return m+':'+sec; }
function updateTimeLabel() { document.getElementById('time-label').textContent = fmtTime(audioEl.currentTime) + ' / ' + fmtTime(audioEl.duration); }
function updateProgress() {
  const total = audioEl.duration || 1;
  document.getElementById('scrubber-fill').style.width = (audioEl.currentTime/total*100) + '%';
  updateTimeLabel();
  let active = -1;
  CHUNKS.forEach((c,i) => { if (audioEl.currentTime >= c.start && audioEl.currentTime < c.end) active = i; });
  document.querySelectorAll('.chunk').forEach((el,i) => el.classList.toggle('active', i===active));
  // Only auto-scroll when the active chunk actually changes, not on every timeupdate tick —
  // otherwise it fights any manual scrolling the user does while audio keeps playing.
  if (active !== -1 && active !== lastScrolledChunkCi) {
    document.querySelector('.chunk[data-ci="'+active+'"]')?.scrollIntoView({behavior:'smooth',block:'center'});
    lastScrolledChunkCi = active;
  }
  // Per-word live highlighting disabled — word-level ASR timestamps proved too unreliable for
  // Arabic dialectal speech and produced visibly wrong/distracting highlights.
  // updateLiveWord();
  // Sentence-level highlighting disabled too — a second highlight layer nested inside the
  // already-highlighted active chunk read as visual noise rather than useful signal. Chunk-level
  // highlighting alone (above) is the sync UI for now. sentT data and updateActiveSentence() are
  // kept in case a different presentation of sentence-level sync is worth trying later.
  // updateActiveSentence();
}
function updateActiveSentence() {
  const time = audioEl.currentTime;
  let el = null;
  for (let i = 0; i < sentenceEls.length; i++) {
    if (sentenceEls[i].t <= time) el = sentenceEls[i].el; else break;
  }
  if (el === activeSentenceEl) return;
  if (activeSentenceEl) activeSentenceEl.classList.remove('active');
  activeSentenceEl = el;
  if (activeSentenceEl) activeSentenceEl.classList.add('active');
}
function updateLiveWord() {
  const time = audioEl.currentTime;
  let idx = -1;
  for (let i = 0; i < timedWords.length; i++) {
    if (timedWords[i].t <= time) idx = timedWords[i].idx; else break;
  }
  if (idx === liveWordIdx) return;
  if (liveWordIdx >= 0 && wordEls[liveWordIdx]) wordEls[liveWordIdx].el.classList.remove('live');
  liveWordIdx = idx;
  if (liveWordIdx >= 0) wordEls[liveWordIdx].el.classList.add('live');
}
function scrub(e) { const r=e.currentTarget.getBoundingClientRect(); const pct=(e.clientX-r.left)/r.width; audioEl.currentTime = pct * (audioEl.duration||0); updateProgress(); }
function cycleSpeed() { const s=[0.75,1,1.25],l=['0.75×','1×','1.25×'],i=s.indexOf(speed); speed=s[(i+1)%s.length]; audioEl.playbackRate=speed; document.querySelector('.speed-btn').textContent=l[(i+1)%l.length]; }
function toggleMute() { audioEl.muted = !audioEl.muted; }
function updateMuteIcon() {
  const btn = document.getElementById('mute-btn');
  const icon = document.getElementById('mute-icon');
  btn.classList.toggle('muted', audioEl.muted);
  btn.title = audioEl.muted ? t('unmuteAudio') : t('muteAudio');
  icon.innerHTML = audioEl.muted
    ? '<path d="M1 5H3.5L7 2V12L3.5 9H1V5Z" fill="currentColor"/><path d="M9.5 4.5L13 8M13 4.5L9.5 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>'
    : '<path d="M1 5H3.5L7 2V12L3.5 9H1V5Z" fill="currentColor"/><path d="M10 4.5C11 5.5 11 8.5 10 9.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>';
}
audioEl.addEventListener('volumechange', updateMuteIcon);

audioEl.addEventListener('loadedmetadata', updateTimeLabel);
audioEl.addEventListener('timeupdate', updateProgress);
audioEl.addEventListener('play', () => { document.getElementById('play-icon').innerHTML = '<rect x="3" y="2" width="3" height="10"/><rect x="8" y="2" width="3" height="10"/>'; });
audioEl.addEventListener('pause', () => { document.getElementById('play-icon').innerHTML = '<polygon points="3,1 13,7 3,13"/>'; });
audioEl.addEventListener('ended', () => { audioEl.currentTime = 0; });

/* ─────────────── SAVE (Vocab + auto Verbs) ─────────────── */
function handleSave(e) {
  e.stopPropagation();
  if (!currentSelectionCtx) return;
  if (SAVED_VOCAB.some(v => v.ar === currentSelectionCtx.ar)) { refreshSaveButton(); return; }
  SAVED_VOCAB.unshift({ ...currentSelectionCtx });
  renderVocabView();
  const ar = document.getElementById('tray-ar').textContent;
  let msg = t('savedToVocab')(ar);
  if (currentSelectionCtx.type === 'word' && currentSelectionCtx.isVerb) {
    if (addVerbToVerbsTab(currentSelectionCtx)) msg += t('andVerbs');
  }
  showToast(msg);
  refreshSaveButton();
}
let verbIdCounter = SAVED_VERBS.length;
function addVerbToVerbsTab(ctx) {
  if (SAVED_VERBS.some(v => v.arDisplay === ctx.ar)) return false;
  SAVED_VERBS.unshift({
    id: 'v' + (verbIdCounter++),
    ar: ctx.ar,
    arDisplay: ctx.ar,
    root: ctx.root || null,
    binyan: null,
    formNum: null,
    dialectNote: null,
    gloss_he: ctx.he,
    gloss_en: ctx.en || '',
    participle: null,
    masdar: null,
    conj: null,
  });
  activeVerbId = SAVED_VERBS[0].id;
  activeConjTab = 'present';
  renderVerbsView();
  return true;
}

/* ─────────────── VERBS VIEW ─────────────── */
function renderVerbsView() {
  document.getElementById('verbs-count').textContent = t('verbsCount')(SAVED_VERBS.length);
  const UNSORTED = 'unsorted';
  const groups = {};
  SAVED_VERBS.forEach(v => { const key = v.formNum || UNSORTED; (groups[key] = groups[key]||[]).push(v); });

  const pillsEl = document.getElementById('verb-pills');
  pillsEl.innerHTML = '';

  const orderedForms = [1,2,3,4,5,6,7,8,9,10].filter(n => groups[n]);
  if (groups[UNSORTED]) orderedForms.push(UNSORTED);
  orderedForms.forEach(formNum => {
    const groupKey = String(formNum);
    const isCollapsed = collapsedVerbGroups.has(groupKey);

    const groupWrap = document.createElement('div');
    groupWrap.style.cssText = 'width:100%;display:flex;flex-direction:column;gap:8px;margin-bottom:16px';

    const label = document.createElement('div');
    label.className = 'verb-group-header' + (isCollapsed ? ' collapsed' : '');
    let titleHtml;
    if (formNum === UNSORTED) {
      titleHtml = appLang === 'en' ? 'Unclassified' : 'טרם סווג';
    } else if (appLang === 'en') {
      titleHtml = 'Form ' + formNum;
    } else {
      const binyanName = groups[formNum][0].binyan;
      titleHtml = 'בניין ' + formNum + (binyanName ? '<span class="verb-group-sub">&nbsp;·&nbsp;' + binyanName + '</span>' : '');
    }
    label.innerHTML = '<span class="verb-group-chevron">▾</span><span class="verb-group-title">'+titleHtml+'</span><span class="verb-group-count">'+groups[formNum].length+'</span>';
    label.onclick = () => toggleVerbGroup(groupKey);
    groupWrap.appendChild(label);

    const row = document.createElement('div');
    row.className = 'verb-pill-row' + (isCollapsed ? ' collapsed' : '');
    const sorted = groups[formNum].slice().sort((a, b) => (a.root || '￿').localeCompare(b.root || '￿', 'ar'));
    sorted.forEach(v => {
      const btn = document.createElement('button');
      btn.className = 'verb-pill' + (v.id===activeVerbId?' active':'');
      btn.innerHTML = '<span class="verb-pill-ar">'+v.arDisplay+'</span><span class="verb-pill-root">'+(v.root||'')+'</span>';
      btn.onclick = () => {
        activeVerbId=v.id; activeConjTab='present'; renderVerbsView();
        if (window.matchMedia('(max-width:720px)').matches) {
          document.getElementById('verb-card').scrollIntoView({ behavior:'smooth', block:'start' });
        }
      };
      row.appendChild(btn);
    });
    groupWrap.appendChild(row);
    pillsEl.appendChild(groupWrap);
  });

  if (!activeVerbId && SAVED_VERBS.length) activeVerbId = SAVED_VERBS[0].id;
  const verb = SAVED_VERBS.find(v=>v.id===activeVerbId);
  const card = document.getElementById('verb-card');
  if (!verb) { card.innerHTML = ''; return; }

  const isEn = appLang === 'en';
  const conjTabs = ['past','present','imperative'];
  const conjLabels = isEn
    ? { past:'Past', present:'Present', imperative:'Imperative' }
    : { past:'עָבָר', present:'הוֹוֶה', imperative:'צִיווּי' };

  const binyanHtml = isEn
    ? (verb.formNum ? 'Form ' + verb.formNum : '<span style="opacity:.5">Unclassified</span>')
    : (verb.binyan ? verb.binyan + (verb.formNum ? '<span style="font-weight:400;opacity:.55;margin-right:6px;font-size:11px">&nbsp;·&nbsp;'+verb.formNum+'</span>' : '') : '<span style="opacity:.5">טרם סווג</span>');
  const rootTagHtml = isEn
    ? (verb.root ? 'Root ' + verb.root : 'Root — not yet identified')
    : (verb.root ? 'שורש '+verb.root : 'שורש — טרם זוהה');
  // English mode is a deliberately thinner card: dialect notes, participle, and masdar only
  // exist as Hebrew data today (verbs-data.js has no English fields for them), so rather than
  // show a half-Hebrew "English" card, those sections are omitted entirely until backfilled.
  const arSubHtml = verb.arDisplay + (!isEn && verb.dialectNote ? ' &mdash; <span style="color:var(--mid)">'+verb.dialectNote+'</span>' : '');
  const glossHtml = isEn
    ? `<div class="verb-gloss-he" style="margin-top:12px">${verb.gloss_en || ''}</div>`
    : `<div class="verb-gloss-he" style="margin-top:12px">${verb.gloss_he}</div>
        <div class="verb-gloss-en-wrap" style="margin-top:4px">
          <button class="en-chip" onclick="this.nextElementSibling.classList.toggle('hidden'); this.textContent=this.textContent==='EN ›'?'EN ×':'EN ›'">EN ›</button>
          <span class="verb-gloss-en hidden" style="font-size:13px;color:var(--mid)">${verb.gloss_en}</span>
        </div>`;
  const derivedHtml = isEn ? '' : `
    <div class="verb-derived">
      <div class="derived-label">צורות נגזרות</div>
      ${(verb.participle || verb.masdar) ? `
      <div class="derived-row">
        ${verb.participle ? `
        <div class="derived-item">
          <div style="font-size:10px;font-weight:700;letter-spacing:.07em;color:var(--mid);margin-bottom:6px;text-transform:uppercase">בינוני הפועל</div>
          <div style="display:flex;gap:16px;flex-wrap:wrap">
            <div class="derived-item">
              <div class="derived-ar">${verb.participle.m}</div>
              <div class="derived-sub">זכר</div>
            </div>
            <div class="derived-item">
              <div class="derived-ar">${verb.participle.f}</div>
              <div class="derived-sub">נקבה</div>
            </div>
            <div class="derived-item">
              <div class="derived-ar">${verb.participle.pl}</div>
              <div class="derived-sub">רבים</div>
            </div>
          </div>
          <div style="font-size:13px;color:var(--mid);margin-top:6px;direction:rtl">${verb.participle.he}</div>
        </div>
        ` : ''}
        ${(verb.participle && verb.masdar) ? '<div style="width:1px;background:var(--rule);margin:0 8px;align-self:stretch"></div>' : ''}
        ${verb.masdar ? `
        <div class="derived-item">
          <div style="font-size:10px;font-weight:700;letter-spacing:.07em;color:var(--mid);margin-bottom:6px;text-transform:uppercase">שם פעולה</div>
          <div class="derived-ar">${verb.masdar.ar}</div>
          <div class="derived-sub">${verb.masdar.he}</div>
        </div>
        ` : ''}
      </div>
      ` : `<div style="font-size:13px;color:var(--mid);direction:rtl">טרם הוזנו צורות נגזרות לפועל זה</div>`}
    </div>`;
  const conjHtml = verb.conj ? `
      <div class="conj-tabs">
        ${conjTabs.map(t=>`<div class="conj-tab${t===activeConjTab?' active':''}" onclick="setConjTab('${t}')">${conjLabels[t]}</div>`).join('')}
      </div>
      <div class="conj-table-wrap">
      <table class="conj-table">
        ${verb.conj[activeConjTab].map(row => isEn ? `
          <tr>
            <td class="conj-ar">${row.ar}</td>
            <td class="conj-pronoun">${PRONOUN_EN[row.pronoun] || row.pronoun}</td>
          </tr>
        ` : `
          <tr>
            <td class="conj-ar">${row.ar}</td>
            <td class="conj-he">${row.he}</td>
            <td class="conj-pronoun">${row.pronoun}</td>
            ${row.context ? `<td class="conj-context">${row.context}</td>` : '<td></td>'}
          </tr>
        `).join('')}
      </table>
      </div>
    ` : `<div style="font-size:13px;color:var(--mid);${isEn?'':'direction:rtl'}">${isEn ? 'No conjugations saved yet for this verb — pending edit' : 'אין עדיין נטיות שמורות לפועל זה — ממתין לעריכה'}</div>`;

  card.innerHTML = `
    <div class="verb-card-head">
      <div class="verb-card-ar">
        <div class="verb-ar-main">${verb.ar}</div>
        <div class="verb-ar-sub">${arSubHtml}</div>
        ${glossHtml}
      </div>
      <div class="verb-card-meta">
        <div class="binyan-badge">${binyanHtml}</div>
        <div class="verb-root-tag">${rootTagHtml}</div>
      </div>
    </div>
    ${derivedHtml}
    <div class="verb-conj">${conjHtml}</div>
  `;
}

function setConjTab(tab) { activeConjTab=tab; renderVerbsView(); }

/* ─────────────── VOCAB VIEW ─────────────── */
const expandedVocab = new Set();
let vocabSearch = '';
let vocabTypeFilter = 'all'; // all | verb | phrase | other (mutually exclusive: a saved verb only matches 'verb', not 'other')
let vocabSort = 'speech'; // speech | alpha | recent

function setVocabSearch(q) { vocabSearch = q; renderVocabView(); }
function setVocabTypeFilter(f) {
  vocabTypeFilter = f;
  document.querySelectorAll('#vocab-type-chips .vocab-chip').forEach(c => c.classList.toggle('active', c.dataset.filter === f));
  renderVocabView();
}
function setVocabSort(s) { vocabSort = s; renderVocabView(); }

function vocabMatchesFilter(v) {
  if (vocabTypeFilter === 'other' && (v.type !== 'word' || v.isVerb)) return false;
  if (vocabTypeFilter === 'phrase' && v.type !== 'phrase') return false;
  if (vocabTypeFilter === 'verb' && !v.isVerb) return false;
  if (vocabSearch.trim()) {
    const q = vocabSearch.trim().toLowerCase();
    const hay = (v.ar + ' ' + v.he + ' ' + (v.en||'')).toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function renderVocabView() {
  document.getElementById('vocab-toolbar').style.display = SAVED_VOCAB.length ? 'flex' : 'none';
  document.getElementById('vocab-empty').style.display = SAVED_VOCAB.length ? 'none' : 'block';

  const visible = SAVED_VOCAB
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => vocabMatchesFilter(v));
  visible.sort((a, b) => {
    if (vocabSort === 'alpha') return a.v.ar.localeCompare(b.v.ar, 'ar');
    if (vocabSort === 'recent') return a.i - b.i;
    return (a.v.ci - b.v.ci) || (a.i - b.i); // order in speech
  });

  document.getElementById('vocab-count').textContent = visible.length === SAVED_VOCAB.length ? t('vocabItemsCount')(visible.length) : t('vocabCountOf')(visible.length, SAVED_VOCAB.length);

  const list = document.getElementById('vocab-list');
  if (SAVED_VOCAB.length && !visible.length) {
    list.innerHTML = '<div class="vocab-no-results">' + t('vocabNoResults') + '</div>';
    return;
  }
  list.innerHTML = visible.map(({ v, i }) => {
    const meta = v.type === 'phrase' ? phraseTypeBadgeHtml(v.phraseType) : rootMetaHtml(v.root, !!v.sharedRoot);
    const isOpen = expandedVocab.has(i);
    const chunk = CHUNKS[v.ci];
    const primary = appLang === 'en' ? (v.en||'') : v.he;
    const enWrapHtml = appLang === 'en' ? '' : `
          <div class="vocab-row-en-wrap">
            <button class="en-chip" onclick="toggleVocabEn(event, ${i})">EN &rsaquo;</button>
            <span class="vocab-row-en hidden" id="vocab-en-${i}">${v.en||''}</span>
          </div>`;
    return `
      <div class="vocab-item">
        <div class="vocab-card-head">
          <div class="vocab-row-ar${v.type==='phrase'?' phrase':''}">${v.ar}</div>
          <div class="vocab-card-actions">
            <button class="vocab-row-toggle${isOpen?' open':''}" title="${t('showSourceLine')}" onclick="toggleVocabExpand(${i})"><span class="chev">&#9662;</span></button>
            <button class="vocab-row-delete" title="${t('removeFromVocab')}" onclick="removeVocabItem(event, ${i})">&times;</button>
          </div>
        </div>
        <div class="vocab-card-divider"></div>
        <div class="vocab-row-gloss">
          <div class="vocab-row-he">${primary}</div>
          <div class="vocab-row-meta">${meta}</div>${enWrapHtml}
        </div>
        <div class="vocab-expand${isOpen?' open':''}">
          <div class="vocab-expand-inner">
            <div class="vocab-expand-time">${chunk.label}</div>
            <p class="vocab-expand-text">${renderChunkPreview(v.ci, v.ar)}</p>
          </div>
        </div>
      </div>
    `;
  }).join('');
}
function toggleVocabEn(e, i) {
  e.stopPropagation();
  const span = document.getElementById('vocab-en-'+i);
  const showing = !span.classList.contains('hidden');
  span.classList.toggle('hidden', showing);
  e.currentTarget.textContent = showing ? 'EN ×' : 'EN ›';
  e.currentTarget.classList.toggle('showing', !showing);
}
function toggleVocabExpand(i) {
  expandedVocab.has(i) ? expandedVocab.delete(i) : expandedVocab.add(i);
  renderVocabView();
}
function removeVocabItem(e, i) {
  e.stopPropagation();
  const removed = SAVED_VOCAB[i];
  SAVED_VOCAB.splice(i, 1);
  const shifted = new Set();
  expandedVocab.forEach(idx => { if (idx < i) shifted.add(idx); else if (idx > i) shifted.add(idx - 1); });
  expandedVocab.clear();
  shifted.forEach(idx => expandedVocab.add(idx));
  renderVocabView();
  showToast(t('removedFromVocab')(removed.ar));
  if (currentSelectionCtx && currentSelectionCtx.ar === removed.ar) refreshSaveButton();
}
function renderChunkPreview(ci, targetAr) {
  const allTokens = CHUNKS[ci].text;
  const wordTokens = allTokens.filter(t => t.sep === undefined);
  const targetWords = targetAr.split(' ').filter(Boolean);
  let matchStart = -1;
  for (let i = 0; i <= wordTokens.length - targetWords.length; i++) {
    let ok = true;
    for (let j = 0; j < targetWords.length; j++) { if (wordTokens[i+j].w !== targetWords[j]) { ok = false; break; } }
    if (ok) { matchStart = i; break; }
  }
  let wi = -1;
  return allTokens.map(t => {
    if (t.sep !== undefined) return t.sep;
    wi++;
    const isMatch = matchStart >= 0 && wi >= matchStart && wi < matchStart + targetWords.length;
    const text = t.w + (t.punct || '');
    return isMatch ? '<mark class="chunk-preview-hl">'+text+'</mark>' : text;
  }).join(' ');
}

function showToast(msg) { const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2200); }

/* ─────────────── ABOUT VIEW (follows the global HE/EN language preference) ─────────────── */
const ABOUT_CONTENT = {
  en: {
    dir: 'ltr',
    sections: [
      { eyebrow: 'The Protest', heading: 'Jaffa, June 28, 2026', paragraphs: [
        'Three young men were killed in Jaffa within a three-day span in June 2026, the last — Mustafa Abu Lasan — by a car bomb in Holon. Frustration at organized crime, and at a police response residents saw as negligent at best, boiled over into a demonstration at Ghazaza Park in Jaffa on Sunday evening, June 28. Protesters demanded the removal of the local police station commander and immediate, concrete steps to stop the killing.',
        'Organizers announced follow-up actions from the same stage: a sit-in tent at Ghazaza Park the following Thursday, where bereaved mothers and sisters could tell their own stories, and a Friday march through Jaffa with black flags.',
      ]},
      { eyebrow: "Who's Speaking", heading: 'Abed Abu Shehadeh', paragraphs: [
        "Abed Abu Shehadeh is the chairman of the Islamic Council (al-Hay'a al-Islamiyya) in Jaffa. He led the June 28 protest and this speech, framing the community's silence in the face of repeated killings as itself dangerous — normalizing what should never be normal — and calling on Jaffa's youth to set aside internal political divisions in favor of solidarity.",
      ]},
      { eyebrow: 'Why I Built This', heading: 'A personal study tool', paragraphs: [
        'I have a decent command of everyday spoken Palestinian Arabic, but seek to push further into the register used in grassroots community organizing and activism — the vocabulary for demanding accountability, mobilizing a community, and speaking publicly about grief and injustice. This speech, given by a community leader who I admire, about an urgent crisis in Jaffa, the city I love and where my daughter was born and raised, became the seed for a personal study tool: real audio, a cleaned-up readable text focused on spoken dialect, and vocabulary/verbs pulled from it, curated to my level and style.',
      ]},
    ],
    source: 'Source: <a href="https://www.mawteni48.com/archives/337152" target="_blank" rel="noopener noreferrer">mawteni48.com &middot; coverage of the June 28, 2026 protest</a> (Arabic)',
  },
  he: {
    dir: 'rtl',
    sections: [
      { eyebrow: 'ההפגנה', heading: 'יפו, 28 ביוני 2026', paragraphs: [
        'שלושה צעירים נרצחו ביפו בתוך פרק זמן של שלושה ימים ביוני 2026, האחרון שבהם — מוסטפא אבו לסאן — בפיצוץ מטען חבלה ברכבו בחולון. תסכול מהפשיעה המאורגנת, ומתגובת המשטרה שתושבים תפסו כרשלנית בלשון המעטה, התפרץ להפגנה בגן אל-ע׳זאזווה ביפו בערב יום ראשון, 28 ביוני. המפגינים דרשו את הדחתו של מפקד תחנת המשטרה המקומית ונקיטת צעדים מיידיים וממשיים לעצירת ההרג.',
        'המארגנים הכריזו מאותה הבמה על צעדי המשך: אוהל מחאה בגן אל-ע׳זאזווה ביום חמישי הקרוב, שבו אמהות ואחיות שכולות יוכלו לספר את סיפוריהן, וצעדה ביום שישי ברחבי יפו עם דגלים שחורים.',
      ]},
      { eyebrow: 'מי מדבר', heading: 'עבד אבו שחאדה', paragraphs: [
        'עבד אבו שחאדה הוא יו״ר המועצה האסלאמית ביפו. הוא הוביל את ההפגנה ואת הנאום הזה ב-28 ביוני, והציג את שתיקת הקהילה מול רציחות חוזרות ונשנות כמסוכנת כשלעצמה — מה שאסור שייחשב לשגרה הופך לשגרה — וקרא לבני הנוער ביפו להניח בצד את הפילוגים הפוליטיים הפנימיים למען אחדות.',
      ]},
      { eyebrow: 'למה בניתי את זה', heading: 'כלי לימוד אישי', paragraphs: [
        'יש לי שליטה סבירה בערבית פלסטינית מדוברת יומיומית, אך אני מבקש להעמיק אל תוך הרובד הלשוני שבו משתמשים בארגון קהילתי ובאקטיביזם בשטח — אוצר המילים לדרישת אחריותיות, לגיוס קהילה, ולדיבור פומבי על אבל ועל אי-צדק. הנאום הזה, שנשא אותו מנהיג קהילתי שאני מעריך, על משבר דוחק ביפו — העיר שאני אוהב ושבה נולדה וגדלה בתי — הפך לזרע של כלי לימוד אישי: הקלטת שמע אמיתית, טקסט קריא ומסודר שמתמקד בניב המדובר, ואוצר מילים ופעלים שנשלפו ממנו, שנאספו בהתאמה לרמה ולסגנון שלי.',
      ]},
    ],
    source: 'מקור: <a href="https://www.mawteni48.com/archives/337152" target="_blank" rel="noopener noreferrer">mawteni48.com &middot; סיקור ההפגנה מ-28 ביוני 2026</a> (בערבית)',
  },
};
function renderAboutView() {
  const data = ABOUT_CONTENT[appLang];
  const inner = document.getElementById('about-inner');
  inner.style.direction = data.dir;
  inner.style.textAlign = data.dir === 'rtl' ? 'right' : 'left';
  inner.innerHTML = data.sections.map(s => `
    <div class="about-section">
      <div class="about-eyebrow">${s.eyebrow}</div>
      <h2 class="about-heading">${s.heading}</h2>
      ${s.paragraphs.map(p => `<p class="about-text">${p}</p>`).join('')}
    </div>
  `).join('') + `<div class="about-source">${data.source}</div>`;
}

buildReader();
initTrayGestures();
renderVerbsView();
applyAppLang();
