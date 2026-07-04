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

/* ─────────────── READER TEXT SIZE ─────────────── */
// An in-app control instead of relying on the browser's pinch-zoom, which would scale the whole
// page — header tabs and the audio bar/tray included — forcing a zoom-out just to reach them.
// Only the reading text itself (the transcript paragraphs) grows; everything else in the frame
// stays put and reachable.
const READER_FONT_SCALES = [0.85, 1, 1.15, 1.3, 1.45, 1.6, 1.8, 2];
let readerScaleIdx = READER_FONT_SCALES.indexOf(parseFloat(localStorage.getItem('arabicLabReaderScale')));
if (readerScaleIdx < 0) readerScaleIdx = READER_FONT_SCALES.indexOf(1);
function applyReaderScale() {
  const scale = READER_FONT_SCALES[readerScaleIdx];
  document.documentElement.style.setProperty('--reader-scale', scale);
  document.getElementById('text-size-label').textContent = Math.round(scale * 100) + '%';
  document.getElementById('text-size-dec').disabled = readerScaleIdx === 0;
  document.getElementById('text-size-inc').disabled = readerScaleIdx === READER_FONT_SCALES.length - 1;
  localStorage.setItem('arabicLabReaderScale', String(scale));
}
function adjustReaderScale(dir) {
  readerScaleIdx = Math.min(READER_FONT_SCALES.length - 1, Math.max(0, readerScaleIdx + dir));
  applyReaderScale();
}

/* ─────────────── WATCH TEXT SIZE ─────────────── */
// Same in-app scaling approach as the Reader, applied to the transcript panel instead --
// separate scale/localStorage key since users may want the two sized differently.
const WATCH_FONT_SCALES = [0.85, 1, 1.15, 1.3, 1.45, 1.6, 1.8, 2];
let watchScaleIdx = WATCH_FONT_SCALES.indexOf(parseFloat(localStorage.getItem('arabicLabWatchScale')));
if (watchScaleIdx < 0) watchScaleIdx = WATCH_FONT_SCALES.indexOf(1);
function applyWatchScale() {
  const scale = WATCH_FONT_SCALES[watchScaleIdx];
  document.documentElement.style.setProperty('--watch-scale', scale);
  document.getElementById('watch-text-size-label').textContent = Math.round(scale * 100) + '%';
  document.getElementById('watch-text-size-dec').disabled = watchScaleIdx === 0;
  document.getElementById('watch-text-size-inc').disabled = watchScaleIdx === WATCH_FONT_SCALES.length - 1;
  localStorage.setItem('arabicLabWatchScale', String(scale));
}
function adjustWatchScale(dir) {
  watchScaleIdx = Math.min(WATCH_FONT_SCALES.length - 1, Math.max(0, watchScaleIdx + dir));
  applyWatchScale();
  // .watch-cue-ar/.watch-cue-tr transition font-size over .15s -- wait for that to finish before
  // re-measuring natural heights, or the sync would lock in a mid-transition (wrong) height.
  setTimeout(() => {
    syncWatchCueHeights();
    // Every cue above the active one just changed height, so the old scroll position no longer
    // lines the two columns up the way it did a moment ago -- snap the active cue to the top of
    // both panels so they visibly reset back into alignment instead of drifting.
    if (activeWatchCueIdx >= 0) {
      watchArCueEls[activeWatchCueIdx].scrollIntoView({ behavior: 'auto', block: 'start' });
      watchTrCueEls[activeWatchCueIdx].scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }, 180);
}

/* ─────────────── LANGUAGE PREFERENCE (global, top-bar) ─────────────── */
// 'he' = Hebrew-primary with full grammatical scaffolding (בניין, שורש badges, Hebrew
// conjugation column) — English still reachable per word/phrase via the EN chip.
// 'en' = stripped English-only mode, no Hebrew script or Hebrew-specific framing anywhere,
// and every UI label/menu/button switches to English too (not just the learning content).
let appLang = localStorage.getItem('arabicLabLang') || 'he';
// Canonical Hebrew pronoun strings used throughout verbs-data.js conjugation rows.
const PRONOUN_EN = { 'אני':'I', 'אתה':'you (m.)', 'את':'you (f.)', 'הוא':'he', 'היא':'she', 'אנחנו':'we', 'אתם/ן':'you (pl.)', 'הם/ן':'they' };
const TAB_LABELS = {
  en: { reader: 'Reader', vocab: 'Vocab', verbs: 'Verbs', watch: 'Home', about: 'About' },
  he: { reader: 'קורא', vocab: 'אוצר מילים', verbs: 'פעלים', watch: 'בית', about: 'אודות' },
};
// Homepage (the "watch" view/tab internally) frames the video as the emotional entry point:
// context on the moment, then the speech itself, then a bridge into the study tools in the
// other tabs. Split into intro (above the video) and outro (below it) paragraph arrays so the
// video sits in between, same trilingual-by-appLang pattern as ABOUT_CONTENT below.
const HOME_CONTENT = {
  en: {
    title: 'Abed Abu Shehadeh, in his own words',
    subtitle: 'Ghazaza Park, Jaffa &middot; June 28, 2026',
    intro: [
      "In June 2026, three young men were killed in Jaffa within the span of three days — the latest in a wave of organized-crime violence that a shaken, furious community felt the police had done nothing to stop. On the evening of June 28, hundreds gathered at Ghazaza Park to demand accountability. Abed Abu Shehadeh, chairman of Jaffa's Islamic Council, addressed the crowd.",
      'To really understand what a community is going through — the grief, the exhaustion, the anger underneath it — reading a summary isn’t enough. We have to listen closely: to the words people reach for, the tone they take, the cry underneath the argument. What follows is Abed, in his own words.',
    ],
    outro: [
      "The tabs above turn this speech into something you can study, not just watch. I took Abed's words and built a simplified, cleaned-up version of the text — fully translated, fully voweled with tashkeel, and read aloud by an AI voice — so Arabic learners can work through it slowly: word by word in Reader, phrase by phrase and verb by verb in Vocab and Verbs. The full story behind the protest, the speaker, and this project is in About.",
    ],
  },
  he: {
    title: 'עבד אבו שחאדה, במילים שלו',
    subtitle: 'גן אל-ע׳זאזווה, יפו &middot; 28 ביוני 2026',
    intro: [
      'ביוני 2026 נרצחו שלושה צעירים ביפו בתוך פרק זמן של שלושה ימים — האחרונה בשורת אלימות של פשיעה מאורגנת שקהילה מזועזעת וזועמת חשה שהמשטרה לא עשתה כלום כדי לעצור. בערב ה-28 ביוני התאספו מאות בגן אל-ע׳זאזווה כדי לדרוש אחריותיות. עבד אבו שחאדה, יו״ר המועצה האסלאמית ביפו, פנה לקהל.',
      'כדי להבין באמת מה עוברת קהילה — האבל, התשישות, הזעם שמתחתיו — לא מספיק לקרוא תקציר. צריך להקשיב מקרוב: למילים שאנשים בוחרים, לטון שהם נוקטים, לזעקה שמתחת לטיעון. מה שבא בהמשך הוא עבד, במילים שלו.',
    ],
    outro: [
      'הלשוניות שמעל הופכות את הנאום הזה לדבר שאפשר ללמוד ממנו, לא רק לצפות בו. לקחתי את מילותיו של עבד ובניתי מהן גרסה מפושטת ומסודרת של הטקסט — מתורגמת במלואה, מנוקדת במלואה בתשכיל, ומוקראת בקול בינה מלאכותית — כך שלומדי ערבית יוכלו לעבוד עליה לאט: מילה במילה בלשונית הקורא, ביטוי-ביטוי ופועל-פועל באוצר המילים ובפעלים. הסיפור המלא על ההפגנה, הדובר, והפרויקט הזה נמצא בלשונית אודות.',
    ],
  },
};
const INTRO_CONTENT = {
  en: {
    title: "Abed Abu Shehadeh's Speech",
    speakerLabel: 'Speaker:', speaker: 'Abed Abu Shehadeh',
    locationLabel: 'Location:', location: 'Ghazaza Park, Jaffa · June 28, 2026',
    text: "Abed Abu Shehadeh's call to a grieving, frustrated Jaffa — recorded live at a protest against organized crime and police inaction, then cleaned up here into a readable text, read aloud by an AI voice synced word-for-word with it. Listen first, then read: tap any word, or drag across a phrase, for its meaning. For the real recording, watch the video on the Home tab. The full story is in the About tab.",
  },
  he: {
    title: 'נאומו של עבד אבו שחאדה',
    speakerLabel: 'דובר:', speaker: 'עבד אבו שחאדה',
    locationLabel: 'מיקום:', location: 'גן אל-ע׳זאזווה, יפו · 28 ביוני 2026',
    text: 'קריאתו של עבד אבו שחאדה ליפו האבלה והמתוסכלת — הוקלטה בשידור חי בהפגנה נגד הפשיעה המאורגנת וכשלון המשטרה, ונערכה כאן לטקסט קריא המוקרא בקול בינה מלאכותית המסונכרן איתו מילה במילה. תחילה הקשיבו, ואז קראו: הקישו על כל מילה, או גררו על פני ביטוי, לקבלת פירושו. את ההקלטה האמיתית אפשר לצפות בסרטון בלשונית "בית". הסיפור המלא נמצא בלשונית "אודות".',
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
    enterTheater: 'Expand', exitTheater: 'Exit expanded view',
    hideTranslation: 'Hide translation', showTranslation: 'Show translation',
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
    enterTheater: 'הרחבה', exitTheater: 'יציאה מתצוגה מורחבת',
    hideTranslation: 'הסתר תרגום', showTranslation: 'הצג תרגום',
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
  document.getElementById('tab-watch').textContent = tabLabels.watch;
  document.getElementById('tab-about').textContent = tabLabels.about;
  document.getElementById('menu-tab-reader').textContent = tabLabels.reader;
  document.getElementById('menu-tab-vocab').textContent = tabLabels.vocab;
  document.getElementById('menu-tab-verbs').textContent = tabLabels.verbs;
  document.getElementById('menu-tab-watch').textContent = tabLabels.watch;
  document.getElementById('menu-tab-about').textContent = tabLabels.about;
  document.getElementById('mobile-header-title').textContent = tabLabels[activeTabName];
  const home = HOME_CONTENT[appLang];
  document.getElementById('watch-title').textContent = home.title;
  document.getElementById('watch-subtitle').innerHTML = home.subtitle;
  document.getElementById('watch-intro').innerHTML = home.intro.map(p => '<p class="watch-p">' + p + '</p>').join('');
  document.getElementById('watch-outro').innerHTML = home.outro.map(p => '<p class="watch-p">' + p + '</p>').join('');
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
  updateWatchTheaterIcon();
  document.querySelectorAll('.chunk-time').forEach(el => el.title = t('jumpToAudio'));
  if (document.getElementById('tray').classList.contains('open')) closeTray(); // avoid a stale mixed-language tray after switching mid-selection (header-gloss trays have no currentSelectionCtx)
  applyWatchTranslationLang();
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
// The Watch tab opens by default; on mobile, Reader/Vocab/Verbs/About live behind the hamburger
// drawer instead of a tab row, since there wasn't room for both that and the language switch.
let activeTabName = 'watch';
function switchTab(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.side-menu-item').forEach(t => t.classList.remove('active'));
  const viewEl = document.getElementById('view-' + name);
  if (viewEl) viewEl.classList.add('active');
  else { document.getElementById('view-reader').classList.add('active'); name = 'reader'; }
  if (activeTabName === 'watch' && name !== 'watch') {
    const video = document.getElementById('watch-video');
    if (video) video.pause();
    exitWatchTheater();
  }
  activeTabName = name;
  const tabs = document.querySelectorAll('.tab');
  const idx = ['watch','reader','vocab','verbs','about'].indexOf(name);
  if (idx !== -1) tabs[idx].classList.add('active');
  const menuItem = document.getElementById('menu-tab-' + name);
  if (menuItem) menuItem.classList.add('active');
  document.getElementById('mobile-header-title').textContent = TAB_LABELS[appLang][name];
  if (name === 'verbs') renderVerbsView();
  if (name === 'vocab') renderVocabView();
  if (name === 'about') renderAboutView();
}

/* ─────────────── HAMBURGER MENU (mobile) ─────────────── */
function openMenu() {
  document.getElementById('menu-backdrop').classList.add('open');
  document.getElementById('side-menu').classList.add('open');
}
function closeMenu() {
  document.getElementById('menu-backdrop').classList.remove('open');
  document.getElementById('side-menu').classList.remove('open');
}
function selectMenuTab(name) {
  switchTab(name);
  closeMenu();
}

/* ─────────────── READER BUILD ─────────────── */
function buildReader() {
  const reader = document.getElementById('reader');
  let gi = 0;
  CHUNKS.forEach((chunk, ci) => {
    const div = document.createElement('div');
    div.className = 'chunk'; div.dataset.ci = ci;
    const timeEl = document.createElement('div');
    timeEl.className = 'chunk-time'; timeEl.textContent = VOICEOVER_CHUNKS[ci].label;
    timeEl.title = t('jumpToAudio');
    timeEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!audioModeOn) return;
      audioEl.currentTime = VOICEOVER_CHUNKS[ci].start; audioEl.play();
    });
    div.appendChild(timeEl);
    div.addEventListener('click', () => {
      if (lastActionWasDrag) { lastActionWasDrag = false; return; }
      if (!audioModeOn) return;
      const activeChunk = VOICEOVER_CHUNKS[ci];
      const inThisChunk = audioEl.currentTime >= activeChunk.start && audioEl.currentTime < activeChunk.end;
      if (inThisChunk) {
        // Audio is already positioned in this chunk — pause in place so the user can click
        // around freely (translate words, etc.) without losing their spot. Resumes exactly
        // where it paused via the play button, not from the chunk's start.
        audioEl.pause();
      } else {
        audioEl.currentTime = activeChunk.start; audioEl.play();
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
  initOutsideTapClose(document.body, (target) => !target.closest('.word') && !target.closest('#tray'), () => { clearSelection(); closeTray(); });
}

/* ─────────────── MOBILE BOTTOM-SHEET DRAWERS: shared gesture helpers ─────────────── */
// Backs both the reader's translation tray and the verbs page's conjugation drawer — a plain
// mousedown-only outside-tap listener never fires reliably from touch: any tiny finger jitter
// during a tap starts a scroll gesture, and once that happens the browser suppresses the
// synthetic mouse events it would otherwise dispatch after touchend. Tracking touch start/end
// directly and only treating it as a tap when movement stays under a small threshold fixes that
// without misfiring on scroll swipes.
function initOutsideTapClose(container, isOutside, onClose) {
  const el = typeof container === 'string' ? document.getElementById(container) : container;
  el.addEventListener('mousedown', (e) => { if (isOutside(e.target)) onClose(); });
  let startX = 0, startY = 0, startTarget = null, tracking = false;
  el.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    startX = t.clientX; startY = t.clientY; startTarget = e.target; tracking = true;
  }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = Math.abs(t.clientX - startX), dy = Math.abs(t.clientY - startY);
    if (dx > TOUCH_MOVE_THRESHOLD || dy > TOUCH_MOVE_THRESHOLD) return; // was a scroll, not a tap
    if (isOutside(startTarget)) onClose();
  });
}
// Swipe-down-to-close (or a plain tap) on a drawer's drag handle. Re-bindable, since the verb
// drawer's handle is recreated from scratch on every renderVerbsView() call.
function initSwipeToClose(handle, panel, onClose) {
  let startY = null, dragging = false;
  handle.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY; dragging = true;
    panel.style.transition = 'none';
  }, { passive: true });
  handle.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0) { panel.style.transform = 'translateY(' + dy + 'px)'; e.preventDefault(); }
  }, { passive: false });
  handle.addEventListener('touchend', (e) => {
    if (!dragging) return;
    dragging = false;
    const dy = e.changedTouches[0].clientY - startY;
    panel.style.transition = ''; panel.style.transform = '';
    if (dy > 60) onClose();
  });
  handle.addEventListener('touchcancel', () => {
    dragging = false; panel.style.transition = ''; panel.style.transform = '';
  });
  // A plain tap on the handle (no drag) also closes the drawer — not everyone will think to swipe.
  handle.addEventListener('click', onClose);
}
function initTrayGestures() {
  initSwipeToClose(document.getElementById('tray-handle'), document.getElementById('tray'), closeTray);
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
// The Reader plays only the AI voiceover (audio/voiceover/reading-edition.mp3, set as
// audio-el's src in index.html) — it's synthesized directly from these exact reading-edition
// tokens, so word-level alignment is reliable enough for karaoke-mode highlighting. The real
// recording lives in the Watch tab instead, alongside the video.
const voiceoverTimedWords = (typeof VOICEOVER_WORD_TIMES !== 'undefined' && VOICEOVER_WORD_TIMES)
  ? VOICEOVER_WORD_TIMES.slice().sort((a, b) => a.t - b.t)
  : [];
function togglePlay() { audioEl.paused ? audioEl.play() : audioEl.pause(); }
function fmtTime(s) { if (!isFinite(s)) return '0:00'; const m=Math.floor(s/60), sec=Math.floor(s%60).toString().padStart(2,'0'); return m+':'+sec; }
function updateTimeLabel() { document.getElementById('time-label').textContent = fmtTime(audioEl.currentTime) + ' / ' + fmtTime(audioEl.duration); }
function updateProgress() {
  const total = audioEl.duration || 1;
  document.getElementById('scrubber-fill').style.width = (audioEl.currentTime/total*100) + '%';
  updateTimeLabel();
  let active = -1;
  VOICEOVER_CHUNKS.forEach((c,i) => { if (audioEl.currentTime >= c.start && audioEl.currentTime < c.end) active = i; });
  document.querySelectorAll('.chunk').forEach((el,i) => el.classList.toggle('active', i===active));
  // Only auto-scroll when the active chunk actually changes, not on every timeupdate tick —
  // otherwise it fights any manual scrolling the user does while audio keeps playing.
  if (active !== -1 && active !== lastScrolledChunkCi) {
    document.querySelector('.chunk[data-ci="'+active+'"]')?.scrollIntoView({behavior:'smooth',block:'center'});
    lastScrolledChunkCi = active;
  }
  // Per-word live highlighting (karaoke mode) -- reliable here since the AI voiceover is
  // synthesized directly from these tokens (see voiceoverTimedWords above).
  updateLiveWord();
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
  for (let i = 0; i < voiceoverTimedWords.length; i++) {
    if (voiceoverTimedWords[i].t <= time) idx = voiceoverTimedWords[i].idx; else break;
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
        if (window.matchMedia('(max-width:720px)').matches) openVerbDrawer();
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
    <div class="tray-handle-row" id="verb-card-handle">
      <div class="tray-handle-bar"></div>
    </div>
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
  // The handle above is rebuilt from scratch on every render, so its swipe/tap-to-close
  // listeners need rebinding each time too.
  initSwipeToClose(document.getElementById('verb-card-handle'), card, closeVerbDrawer);
}
function openVerbDrawer() { document.getElementById('verb-card').classList.add('open'); }
function closeVerbDrawer() { document.getElementById('verb-card').classList.remove('open'); }

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
            <div class="vocab-expand-time">${VOICEOVER_CHUNKS[v.ci].label}</div>
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
        'Three young men were killed in Jaffa within a three-day span in June 2026, the last — Mustafa Abu Lasan — by a car bomb as he was driving his 6-year-old son to school. Frustration at organized crime, and at a police response residents saw as negligent at best, boiled over into a demonstration at Ghazaza Park in Jaffa on Sunday evening, June 28. Protesters demanded the removal of the local police station commander and immediate, concrete steps to stop the killing.',
        'Organizers announced follow-up actions from the same stage: a sit-in tent at Ghazaza Park the following Thursday, where bereaved mothers and sisters could tell their own stories, and a Friday march through Jaffa with black flags.',
      ]},
      { eyebrow: "Who's Speaking", heading: 'Abed Abu Shehadeh', paragraphs: [
        "Abed Abu Shehadeh is the chairman of the Islamic Council (al-Hay'a al-Islamiyya) in Jaffa. He led the June 28 protest and this speech, framing the community's silence in the face of repeated killings as itself dangerous — normalizing what should never be normal — and calling on Jaffa's youth to set aside internal political divisions in favor of solidarity.",
      ]},
      { eyebrow: 'Why I Built This', heading: 'A personal study tool', paragraphs: [
        'I have a decent command of everyday spoken Palestinian Arabic, but seek to push further into the register used in grassroots community organizing and activism — the vocabulary for demanding accountability, mobilizing a community, and speaking publicly about grief and injustice. This speech, given by a community leader who I admire, about an urgent crisis in Jaffa, the city I love and where my daughter was born and lives, became the seed for a personal study tool: real audio, a cleaned-up readable text focused on spoken dialect, and vocabulary/verbs pulled from it, curated to my personal needs and learning style.',
      ]},
      { eyebrow: 'How I Built This', heading: 'The process, and where AI came in', paragraphs: [
        "This isn't a professional build — it's something I put together myself, evenings and weekends, because I wanted this tool to exist and didn't want to wait for someone else to make it.",
        'AI did a lot of the heavy lifting in the development of this tool: transcribing Abed\'s raw audio, translating it into Hebrew and English, producing a simplified written piece, adding the tashkeel that makes spoken Arabic legible to a learner, and generating the AI voiceover you hear in the Reader. I also used an AI coding assistant (Claude Code) to build the site itself — the tap-to-translate reader, the vocab and verb tools, all of it came together through that back-and-forth. My part was choosing the speech, shaping the pedagogy, checking translations, and deciding what a learner at my level actually needs.',
      ]},
    ],
    source: 'Source: <a href="https://www.mawteni48.com/archives/337152" target="_blank" rel="noopener noreferrer">mawteni48.com &middot; coverage of the June 28, 2026 protest</a> (Arabic)',
  },
  he: {
    dir: 'rtl',
    sections: [
      { eyebrow: 'ההפגנה', heading: 'יפו, 28 ביוני 2026', paragraphs: [
        'שלושה צעירים נרצחו ביפו בתוך פרק זמן של שלושה ימים ביוני 2026, האחרון שבהם — מוסטפא אבו לסאן — בפיצוץ מטען חבלה ברכבו, בעודו נוהג את בנו בן השש לבית הספר. תסכול מהפשיעה המאורגנת, ומתגובת המשטרה שתושבים תפסו כרשלנית בלשון המעטה, התפרץ להפגנה בגן אל-ע׳זאזווה ביפו בערב יום ראשון, 28 ביוני. המפגינים דרשו את הדחתו של מפקד תחנת המשטרה המקומית ונקיטת צעדים מיידיים וממשיים לעצירת ההרג.',
        'המארגנים הכריזו מאותה הבמה על צעדי המשך: אוהל מחאה בגן אל-ע׳זאזווה ביום חמישי הקרוב, שבו אמהות ואחיות שכולות יוכלו לספר את סיפוריהן, וצעדה ביום שישי ברחבי יפו עם דגלים שחורים.',
      ]},
      { eyebrow: 'מי מדבר', heading: 'עבד אבו שחאדה', paragraphs: [
        'עבד אבו שחאדה הוא יו״ר המועצה האסלאמית ביפו. הוא הוביל את ההפגנה ואת הנאום הזה ב-28 ביוני, והציג את שתיקת הקהילה מול רציחות חוזרות ונשנות כמסוכנת כשלעצמה — מה שאסור שייחשב לשגרה הופך לשגרה — וקרא לבני הנוער ביפו להניח בצד את הפילוגים הפוליטיים הפנימיים למען אחדות.',
      ]},
      { eyebrow: 'למה בניתי את זה', heading: 'כלי לימוד אישי', paragraphs: [
        'יש לי שליטה סבירה בערבית פלסטינית מדוברת יומיומית, אך אני מבקש להעמיק אל תוך הרובד הלשוני שבו משתמשים בארגון קהילתי ובאקטיביזם בשטח — אוצר המילים לדרישת אחריותיות, לגיוס קהילה, ולדיבור פומבי על אבל ועל אי-צדק. הנאום הזה, שנשא אותו מנהיג קהילתי שאני מעריך, על משבר דוחק ביפו — העיר שאני אוהב ושבה נולדה וחיה בתי — הפך לזרע של כלי לימוד אישי: הקלטת שמע אמיתית, טקסט קריא ומסודר שמתמקד בניב המדובר, ואוצר מילים ופעלים שנשלפו ממנו, שנאספו בהתאמה לצרכים האישיים ולסגנון הלמידה שלי.',
      ]},
      { eyebrow: 'איך בניתי את זה', heading: 'התהליך, והיכן נכנסה בינה מלאכותית', paragraphs: [
        'זה לא פיתוח מקצועי — זה משהו שהרכבתי בעצמי, בערבים ובסופי שבוע, כי רציתי שהכלי הזה יתקיים ולא רציתי לחכות שמישהו אחר יבנה אותו.',
        'בינה מלאכותית עשתה חלק גדול מהעבודה הקשה בפיתוח הכלי הזה: תמלול ההקלטה הגולמית של עבד, תרגומה לעברית ולאנגלית, הפקת נוסח כתוב מפושט, הוספת התשכיל שהופך ערבית מדוברת לקריאה עבור לומד, והפקת הקראת הבינה המלאכותית שנשמעת בלשונית הקורא. השתמשתי גם בעוזר תכנות מבוסס בינה מלאכותית (Claude Code) לבניית האתר עצמו — הקורא המבוסס על הקשה-לתרגום, כלי אוצר המילים והפעלים, הכול נבנה דרך אותו דיאלוג. החלק שלי היה לבחור את הנאום, לעצב את הגישה הפדגוגית, לבדוק תרגומים, ולהחליט מה לומד בשלב שלי צריך בפועל.',
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

/* ─────────────── WATCH TAB ─────────────── */
// Native <track> stays on the <video> for accessibility (CC toggle, screen readers), but the
// primary caption UX is this external synced transcript panel. Each cue pairs its Arabic line
// with a running he/en translation right below it (not tap-to-translate like the Reader) --
// the goal here is watching the speech straight through; anyone who wants word-level study can
// open the Reader instead.
// Karaoke (per-word) highlighting on the Arabic line is layered on top of the cue-level
// highlight, same pairing as the AI voiceover -- reliable here (86.7%, see
// watch-captions-data.js) because both the segment text and the word timestamps come from
// transcribing the same raw speech, unlike the Reader's cleaned-text alignment attempt.
// Karaoke (per-word) highlighting on the Arabic line is layered on top of the cue-level
// highlight, same pairing as the AI voiceover -- reliable here (86.7%, see
// watch-captions-data.js) because both the segment text and the word timestamps come from
// transcribing the same raw speech, unlike the Reader's cleaned-text alignment attempt.
// The translation panel does NOT get word-level karaoke -- it's a full-sentence AI translation
// with no real per-word correspondence to the Arabic, and an interpolated/estimated per-word
// timing there read as distracting rather than helpful. Instead, clicking a word (or dragging
// across a phrase) in the Arabic panel just seeks the video and lets the existing cue-level sync
// highlight the matching line in the translation panel next to it.
let watchArCueEls = [];
let watchTrCueEls = [];
let watchTrWordsByCue = []; // per cue index: array of translation word spans
let activeWatchCueIdx = -1;
let watchWordEls = [];
let watchCueOfWordIdx = []; // parallel to watchWordEls: which cue index each word belongs to
let watchCueWordRanges = []; // per cue: {startIdx, endIdx} into watchWordEls/watchCueOfWordIdx
let watchTimedWords = [];
let liveWatchWordIdx = -1;

function buildWatchTranscript() {
  const arPanel = document.getElementById('watch-transcript-ar');
  const trPanel = document.getElementById('watch-transcript-tr');
  const video = document.getElementById('watch-video');
  arPanel.innerHTML = '';
  trPanel.innerHTML = '';
  watchWordEls = [];
  watchCueOfWordIdx = [];
  watchCueWordRanges = [];
  watchTimedWords = [];

  const seekToCue = (cue) => {
    const inThisCue = video.currentTime >= cue.start && video.currentTime < cue.end;
    if (inThisCue) video.pause();
    else { video.currentTime = cue.start; video.play(); }
  };

  watchArCueEls = WATCH_CAPTIONS.map((cue, ci) => {
    const div = document.createElement('div');
    div.className = 'watch-cue watch-cue-ar';
    const startIdx = watchWordEls.length;
    cue.words.forEach((wd) => {
      const span = document.createElement('span');
      span.className = 'watch-word';
      span.textContent = wd.w;
      span.dataset.widx = watchWordEls.length;
      div.appendChild(span);
      div.appendChild(document.createTextNode(' '));
      const wi = watchWordEls.length;
      watchWordEls.push(span);
      watchCueOfWordIdx.push(ci);
      if (wd.t !== undefined) watchTimedWords.push({ idx: wi, t: wd.t });
    });
    watchCueWordRanges.push({ startIdx, endIdx: watchWordEls.length - 1 });
    div.addEventListener('click', (e) => {
      if (watchLastActionWasDrag) { watchLastActionWasDrag = false; return; }
      const wordEl = e.target.closest('.watch-word');
      if (wordEl) {
        clearWatchSelection();
        wordEl.classList.add('selected');
        const gi = parseInt(wordEl.dataset.widx, 10);
        linkWatchSelectionToTranslation(gi, gi);
      }
      seekToCue(cue);
    });
    arPanel.appendChild(div);
    return div;
  });

  watchTrWordsByCue = [];
  watchTrCueEls = WATCH_CAPTIONS.map((cue) => {
    const div = document.createElement('div');
    div.className = 'watch-cue watch-cue-tr';
    const text = appLang === 'en' ? cue.en : cue.he;
    const words = text.split(/\s+/).filter(Boolean);
    const spans = words.map((w) => {
      const span = document.createElement('span');
      span.className = 'watch-word';
      span.textContent = w;
      div.appendChild(span);
      div.appendChild(document.createTextNode(' '));
      return span;
    });
    watchTrWordsByCue.push(spans);
    div.addEventListener('click', () => seekToCue(cue));
    trPanel.appendChild(div);
    return div;
  });

  watchTimedWords.sort((a, b) => a.t - b.t);
  video.addEventListener('timeupdate', () => { updateWatchActiveCue(); updateWatchLiveWord(); });
  initWatchDragSelect();
  applyWatchTranslationVisibility();
  syncWatchCueHeights();
}
// The Arabic and translation columns lay out independently (separate scrollable panels), so the
// same cue can wrap to a different number of lines in each -- distractingly so once the user
// bumps the text size, since Arabic and its English/Hebrew translation are rarely the same
// length. Force each cue's pair of boxes to share the taller of their two natural heights,
// re-run whenever text size or language changes since both affect wrapping.
function syncWatchCueHeights() {
  for (let i = 0; i < watchArCueEls.length; i++) {
    watchArCueEls[i].style.minHeight = '';
    watchTrCueEls[i].style.minHeight = '';
  }
  for (let i = 0; i < watchArCueEls.length; i++) {
    const h = Math.max(watchArCueEls[i].offsetHeight, watchTrCueEls[i].offsetHeight);
    watchArCueEls[i].style.minHeight = h + 'px';
    watchTrCueEls[i].style.minHeight = h + 'px';
  }
}
function applyWatchTranslationLang() {
  watchTrHighlighted = []; // the old spans are about to be discarded
  watchTrCueEls.forEach((el, ci) => {
    el.innerHTML = '';
    const text = appLang === 'en' ? WATCH_CAPTIONS[ci].en : WATCH_CAPTIONS[ci].he;
    watchTrWordsByCue[ci] = text.split(/\s+/).filter(Boolean).map((w) => {
      const span = document.createElement('span');
      span.className = 'watch-word';
      span.textContent = w;
      el.appendChild(span);
      el.appendChild(document.createTextNode(' '));
      return span;
    });
  });
  syncWatchCueHeights();
  renderMobileCueOverlay(activeWatchCueIdx);
}

/* ─────────────── WATCH TAB: mobile fullscreen overlay captions ───────────────
   Mobile theater mode (see CSS) hides the two scrolling transcript columns and shows the video
   near-fullscreen instead, with the active cue's Arabic (karaoke-highlighted, same word timing
   as the desktop column) and translation burned in as an overlay ribbon -- a real subtitle-player
   feel on a small screen, where three side-by-side columns wouldn't fit. */
let overlayWordEls = {}; // global word idx -> overlay span, only for the currently-shown cue
let watchTranslationVisible = true;
function renderMobileCueOverlay(cueIdx) {
  const arEl = document.getElementById('watch-mobile-cap-ar');
  const trEl = document.getElementById('watch-mobile-cap-tr');
  arEl.innerHTML = '';
  overlayWordEls = {};
  if (cueIdx < 0) { trEl.textContent = ''; return; }
  const cue = WATCH_CAPTIONS[cueIdx];
  const range = watchCueWordRanges[cueIdx];
  for (let gi = range.startIdx; gi <= range.endIdx; gi++) {
    const span = document.createElement('span');
    span.className = 'watch-word';
    span.textContent = watchWordEls[gi].textContent;
    if (liveWatchWordIdx === gi) span.classList.add('live');
    arEl.appendChild(span);
    arEl.appendChild(document.createTextNode(' '));
    overlayWordEls[gi] = span;
  }
  trEl.textContent = appLang === 'en' ? cue.en : cue.he;
}
function toggleWatchTranslationVisible() {
  watchTranslationVisible = !watchTranslationVisible;
  applyWatchTranslationVisibility();
}
function applyWatchTranslationVisibility() {
  document.getElementById('watch-transcript-tr').classList.toggle('watch-tr-hidden', !watchTranslationVisible);
  document.getElementById('watch-mobile-cap-tr').classList.toggle('watch-tr-hidden', !watchTranslationVisible);
  const btn = document.getElementById('watch-tr-toggle-btn');
  btn.classList.toggle('active', watchTranslationVisible);
  btn.title = watchTranslationVisible ? t('hideTranslation') : t('showTranslation');
}

/* ─────────────── WATCH TAB: word click / phrase drag-select ───────────────
   Visual-only (no translation tray, no vocab save -- that workflow lives in the Reader). A tap
   seeks the video via the cue click handler above (word clicks bubble to it). A drag across
   multiple words shows a phrase selection and seeks to the first word's cue on release. */
let watchDragActive = false, watchDragStartIdx = -1, watchDragEndIdx = -1;
let watchLastActionWasDrag = false;
function watchWordAtPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  return (el && el.classList.contains('watch-word')) ? parseInt(el.dataset.widx, 10) : -1;
}
function renderWatchRange(lo, hi) { watchWordEls.forEach((el, gi) => { el.classList.remove('selected'); el.classList.toggle('in-range', gi >= lo && gi <= hi); el.classList.toggle('range-start', gi === lo); el.classList.toggle('range-end', gi === hi); }); }
function clearWatchSelection() { watchWordEls.forEach((el) => el.classList.remove('in-range', 'range-start', 'range-end', 'selected')); watchDragStartIdx = -1; watchDragEndIdx = -1; }
// Highlights the SPECIFIC words in the translation that correspond to the selected Arabic
// range -- not the whole cue block. There's no real word-level alignment between the Arabic and
// the AI-translated sentence (different word order/count), so this maps by PROPORTIONAL
// POSITION within the sentence (e.g. a selection starting a third of the way through the Arabic
// cue highlights words starting a third of the way through its translation) -- an estimate, not
// a measured correspondence, same honesty rule as the karaoke timing elsewhere in this tab.
let watchTrHighlighted = [];
function linkWatchSelectionToTranslation(loGlobal, hiGlobal) {
  watchTrHighlighted.forEach((el) => el.classList.remove('tr-phrase-highlight'));
  watchTrHighlighted = [];
  const ci = watchCueOfWordIdx[loGlobal];
  const range = watchCueWordRanges[ci];
  const totalWords = range.endIdx - range.startIdx + 1;
  const loLocal = loGlobal - range.startIdx;
  const hiLocal = Math.min(hiGlobal, range.endIdx) - range.startIdx;
  const trWords = watchTrWordsByCue[ci];
  const n = trWords.length;
  const trLo = Math.floor(loLocal / totalWords * n);
  const trHi = Math.max(trLo, Math.ceil((hiLocal + 1) / totalWords * n) - 1);
  for (let i = trLo; i <= Math.min(trHi, n - 1); i++) {
    trWords[i].classList.add('tr-phrase-highlight');
    watchTrHighlighted.push(trWords[i]);
  }
  watchTrCueEls[ci].scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function commitWatchDrag(lo, hi) {
  const video = document.getElementById('watch-video');
  const ci = watchCueOfWordIdx[lo];
  const cue = WATCH_CAPTIONS[ci];
  linkWatchSelectionToTranslation(lo, hi);
  video.currentTime = cue.start; video.play();
}
function onWatchDragStart(e) { const i = watchWordAtPoint(e.clientX, e.clientY); if (i < 0) return; e.preventDefault(); watchDragActive = true; watchDragStartIdx = i; watchDragEndIdx = i; renderWatchRange(i, i); }
function onWatchDragMove(e) { if (!watchDragActive) return; const i = watchWordAtPoint(e.clientX, e.clientY); if (i >= 0 && i !== watchDragEndIdx) { watchDragEndIdx = i; renderWatchRange(Math.min(watchDragStartIdx, watchDragEndIdx), Math.max(watchDragStartIdx, watchDragEndIdx)); } }
function onWatchDragEnd() {
  if (!watchDragActive) return;
  watchDragActive = false;
  const lo = Math.min(watchDragStartIdx, watchDragEndIdx), hi = Math.max(watchDragStartIdx, watchDragEndIdx);
  watchLastActionWasDrag = lo !== hi;
  if (lo !== hi) commitWatchDrag(lo, hi);
  else clearWatchSelection();
}
const WATCH_TOUCH_LONG_PRESS_MS = 350;
const WATCH_TOUCH_MOVE_THRESHOLD = 10;
let watchTouchTimer = null, watchTouchStartX = 0, watchTouchStartY = 0, watchTouchStartIdx = -1, watchTouchArmed = false;
function clearWatchTouchTimer() { if (watchTouchTimer) { clearTimeout(watchTouchTimer); watchTouchTimer = null; } }
function onWatchTouchStart(e) {
  const t = e.touches[0], i = watchWordAtPoint(t.clientX, t.clientY);
  if (i < 0) return;
  watchTouchStartX = t.clientX; watchTouchStartY = t.clientY; watchTouchStartIdx = i; watchTouchArmed = false;
  clearWatchTouchTimer();
  watchTouchTimer = setTimeout(() => {
    watchTouchArmed = true; watchDragActive = true; watchDragStartIdx = i; watchDragEndIdx = i;
    renderWatchRange(i, i);
  }, WATCH_TOUCH_LONG_PRESS_MS);
}
function onWatchTouchMove(e) {
  const t = e.touches[0];
  if (!watchTouchArmed) {
    if (watchTouchStartIdx < 0) return;
    const dx = Math.abs(t.clientX - watchTouchStartX), dy = Math.abs(t.clientY - watchTouchStartY);
    if (dx > WATCH_TOUCH_MOVE_THRESHOLD || dy > WATCH_TOUCH_MOVE_THRESHOLD) { clearWatchTouchTimer(); watchTouchStartIdx = -1; }
    return;
  }
  e.preventDefault();
  const i = watchWordAtPoint(t.clientX, t.clientY);
  if (i >= 0 && i !== watchDragEndIdx) { watchDragEndIdx = i; renderWatchRange(Math.min(watchDragStartIdx, watchDragEndIdx), Math.max(watchDragStartIdx, watchDragEndIdx)); }
}
function onWatchTouchEnd() {
  clearWatchTouchTimer();
  if (watchTouchArmed) {
    watchTouchArmed = false;
    if (watchDragActive) {
      watchDragActive = false;
      const lo = Math.min(watchDragStartIdx, watchDragEndIdx), hi = Math.max(watchDragStartIdx, watchDragEndIdx);
      watchLastActionWasDrag = lo !== hi;
      if (lo !== hi) commitWatchDrag(lo, hi);
      else clearWatchSelection();
    }
  }
  watchTouchStartIdx = -1;
}
function onWatchTouchCancel() {
  clearWatchTouchTimer();
  watchTouchArmed = false; watchTouchStartIdx = -1;
  if (watchDragActive) { watchDragActive = false; clearWatchSelection(); }
}
function initWatchDragSelect() {
  const panel = document.getElementById('watch-transcript-ar');
  panel.addEventListener('mousedown', onWatchDragStart);
  document.addEventListener('mousemove', onWatchDragMove);
  document.addEventListener('mouseup', onWatchDragEnd);
  panel.addEventListener('touchstart', onWatchTouchStart, { passive: true });
  panel.addEventListener('touchmove', onWatchTouchMove, { passive: false });
  document.addEventListener('touchend', onWatchTouchEnd);
  document.addEventListener('touchcancel', onWatchTouchCancel);
  panel.addEventListener('contextmenu', (e) => e.preventDefault());
}


/* ─────────────── WATCH TAB: bottom toolbar (mirrors Reader's audio-bar) ─────────────── */
let watchSpeed = 1;
function toggleWatchPlay() { const v = document.getElementById('watch-video'); v.paused ? v.play() : v.pause(); }
function scrubWatch(e) { const v = document.getElementById('watch-video'); const r = e.currentTarget.getBoundingClientRect(); const pct = (e.clientX - r.left) / r.width; v.currentTime = pct * (v.duration || 0); updateWatchProgress(); }
function cycleWatchSpeed() { const v = document.getElementById('watch-video'); const s = [0.75, 1, 1.25], l = ['0.75×', '1×', '1.25×'], i = s.indexOf(watchSpeed); watchSpeed = s[(i + 1) % s.length]; v.playbackRate = watchSpeed; document.getElementById('watch-speed-btn').textContent = l[(i + 1) % l.length]; }
function toggleWatchMute() { document.getElementById('watch-video').muted = !document.getElementById('watch-video').muted; }
function updateWatchMuteIcon() {
  const v = document.getElementById('watch-video');
  const btn = document.getElementById('watch-mute-btn');
  const icon = document.getElementById('watch-mute-icon');
  btn.classList.toggle('muted', v.muted);
  btn.title = v.muted ? t('unmuteAudio') : t('muteAudio');
  icon.innerHTML = v.muted
    ? '<path d="M1 5H3.5L7 2V12L3.5 9H1V5Z" fill="currentColor"/><path d="M9.5 4.5L13 8M13 4.5L9.5 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>'
    : '<path d="M1 5H3.5L7 2V12L3.5 9H1V5Z" fill="currentColor"/><path d="M10 4.5C11 5.5 11 8.5 10 9.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>';
}
function updateWatchTimeLabel() { const v = document.getElementById('watch-video'); document.getElementById('watch-time-label').textContent = fmtTime(v.currentTime) + ' / ' + fmtTime(v.duration); }
function updateWatchProgress() {
  const v = document.getElementById('watch-video');
  const total = v.duration || 1;
  document.getElementById('watch-scrubber-fill').style.width = (v.currentTime / total * 100) + '%';
  updateWatchTimeLabel();
}
function initWatchToolbar() {
  const v = document.getElementById('watch-video');
  v.addEventListener('volumechange', updateWatchMuteIcon);
  v.addEventListener('loadedmetadata', updateWatchTimeLabel);
  v.addEventListener('timeupdate', updateWatchProgress);
  v.addEventListener('play', () => { document.getElementById('watch-play-icon').innerHTML = '<rect x="3" y="2" width="3" height="10"/><rect x="8" y="2" width="3" height="10"/>'; document.querySelector('.watch-video-wrap').classList.add('playing'); enterWatchTheater(); });
  v.addEventListener('pause', () => { document.getElementById('watch-play-icon').innerHTML = '<polygon points="3,1 13,7 3,13"/>'; document.querySelector('.watch-video-wrap').classList.remove('playing'); });
  v.addEventListener('ended', () => { v.currentTime = 0; document.querySelector('.watch-video-wrap').classList.remove('playing'); });
  updateWatchTheaterIcon();
}

/* ─────────────── WATCH TAB: theater/expanded mode ─────────────── */
// Fills the whole view with video + transcript (no scrolling) instead of the normal
// head/intro + capped-height layout. Entered automatically on play (so hitting play jumps
// straight into it), and toggleable independently via the toolbar button.
let watchTheaterOn = false;
const WATCH_THEATER_ICON = { enter: '<path d="M1 5V1H5"/><path d="M13 5V1H9"/><path d="M1 9V13H5"/><path d="M13 9V13H9"/>', exit: '<path d="M1 1L5 5"/><path d="M1 5H5V1"/><path d="M13 1L9 5"/><path d="M13 5H9V1"/><path d="M1 13L5 9"/><path d="M1 9H5V13"/><path d="M13 13L9 9"/><path d="M13 9H9V13"/>' };
function enterWatchTheater() {
  if (watchTheaterOn) return;
  watchTheaterOn = true;
  document.getElementById('view-watch').classList.add('theater');
  // Body-level class since the app's global header sits outside #view-watch -- on mobile
  // (see CSS) this hides it too, so the player reads as truly full-screen instead of boxed
  // in below the nav bar.
  document.body.classList.add('watch-theater-active');
  updateWatchTheaterIcon();
}
function exitWatchTheater() {
  if (!watchTheaterOn) return;
  watchTheaterOn = false;
  document.getElementById('view-watch').classList.remove('theater');
  document.body.classList.remove('watch-theater-active');
  updateWatchTheaterIcon();
}
function toggleWatchTheater() { watchTheaterOn ? exitWatchTheater() : enterWatchTheater(); }
function updateWatchTheaterIcon() {
  const btn = document.getElementById('watch-theater-btn');
  document.getElementById('watch-theater-icon').innerHTML = watchTheaterOn ? WATCH_THEATER_ICON.exit : WATCH_THEATER_ICON.enter;
  btn.title = watchTheaterOn ? t('exitTheater') : t('enterTheater');
}
function updateWatchLiveWord() {
  const time = document.getElementById('watch-video').currentTime;
  let idx = -1;
  for (let i = 0; i < watchTimedWords.length; i++) {
    if (watchTimedWords[i].t <= time) idx = watchTimedWords[i].idx; else break;
  }
  if (idx === liveWatchWordIdx) return;
  if (liveWatchWordIdx >= 0) {
    watchWordEls[liveWatchWordIdx]?.classList.remove('live');
    overlayWordEls[liveWatchWordIdx]?.classList.remove('live');
  }
  liveWatchWordIdx = idx;
  if (idx >= 0) {
    watchWordEls[idx].classList.add('live');
    overlayWordEls[idx]?.classList.add('live');
  }
}
function updateWatchActiveCue() {
  const time = document.getElementById('watch-video').currentTime;
  let idx = -1;
  for (let i = 0; i < WATCH_CAPTIONS.length; i++) {
    if (WATCH_CAPTIONS[i].start <= time) idx = i; else break;
  }
  if (idx === activeWatchCueIdx) return;
  if (activeWatchCueIdx >= 0) {
    watchArCueEls[activeWatchCueIdx]?.classList.remove('active');
    watchTrCueEls[activeWatchCueIdx]?.classList.remove('active');
  }
  activeWatchCueIdx = idx;
  renderMobileCueOverlay(idx);
  if (idx >= 0) {
    watchArCueEls[idx].classList.add('active');
    watchTrCueEls[idx].classList.add('active');
    watchArCueEls[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
    watchTrCueEls[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

buildReader();
buildWatchTranscript();
initWatchToolbar();
initTrayGestures();
applyReaderScale();
applyWatchScale();
initOutsideTapClose('verbs-scroll', (target) => !target.closest('.verb-pill') && !target.closest('.verb-card'), closeVerbDrawer);
renderVerbsView();
applyAppLang();
