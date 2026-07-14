require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');

const { basicAuth } = require('./src/auth');
const db = require('./src/db');
const lessons = require('./src/lessons');
const { publishLesson, unpublishLesson, buildBundle, ensureRepo } = require('./src/publish');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '.data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const REPO_APP_DIR = path.join(DATA_DIR, 'repo', 'app');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({ dest: UPLOAD_DIR });

const app = express();
app.use(basicAuth);
app.use(express.json({ limit: '15mb' })); // lesson JSON blobs (chunks/verbs/etc.) can be sizeable
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/lessons', async (req, res, next) => {
  try { res.json(await lessons.listLessons()); }
  catch (err) { next(err); }
});

app.post('/api/lessons', async (req, res, next) => {
  try { res.status(201).json(await lessons.createLesson(req.body || {})); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/lessons/:slug', async (req, res, next) => {
  try {
    const lesson = await lessons.getLesson(req.params.slug);
    if (!lesson) return res.status(404).json({ error: 'not found' });
    res.json(lesson);
  } catch (err) { next(err); }
});

app.put('/api/lessons/:slug/json/:field', async (req, res) => {
  try { res.json(await lessons.updateLessonJson(req.params.slug, req.params.field, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/lessons/:slug/media/:kind', upload.single('file'), async (req, res) => {
  try {
    if (!lessons.MEDIA_COLUMNS[req.params.kind]) return res.status(400).json({ error: 'unknown media kind' });
    if (!req.file) return res.status(400).json({ error: 'no file uploaded' });
    const destPath = path.join(UPLOAD_DIR, req.params.slug + '-' + req.params.kind + path.extname(req.file.originalname));
    fs.renameSync(req.file.path, destPath);
    res.json(await lessons.updateLessonMediaPath(req.params.slug, req.params.kind, destPath));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/lessons/:slug/publish', async (req, res) => {
  try {
    const lesson = await lessons.getLesson(req.params.slug);
    if (!lesson) return res.status(404).json({ error: 'not found' });
    const result = publishLesson(lesson);
    if (result.pushed) await lessons.markPublished(req.params.slug);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message, stderr: err.stderr ? err.stderr.toString() : undefined });
  }
});

app.post('/api/lessons/:slug/unpublish', async (req, res) => {
  try {
    const lesson = await lessons.getLesson(req.params.slug);
    if (!lesson) return res.status(404).json({ error: 'not found' });
    if (lesson.status !== 'published') return res.status(400).json({ error: 'lesson is not currently published' });
    const result = unpublishLesson(lesson);
    if (result.pushed) await lessons.markUnpublished(req.params.slug);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message, stderr: err.stderr ? err.stderr.toString() : undefined });
  }
});

// Deleting a still-published lesson takes it down off the live site first -- never leaves
// public content behind with no CMS record backing it.
app.delete('/api/lessons/:slug', async (req, res) => {
  try {
    const lesson = await lessons.getLesson(req.params.slug);
    if (!lesson) return res.status(404).json({ error: 'not found' });
    if (lesson.status === 'published') {
      const result = unpublishLesson(lesson);
      if (!result.pushed && result.reason !== 'no changes (already unpublished)') {
        return res.status(500).json({ error: 'failed to unpublish before delete', result });
      }
    }
    for (const p of [lesson.video_asset_path, lesson.voiceover_audio_path, lesson.captions_vtt_path]) {
      if (p) { try { fs.unlinkSync(p); } catch { /* already gone, fine */ } }
    }
    await lessons.deleteLesson(req.params.slug);
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────── PREVIEW ───────────────
   Serves the real public app/ shell (lesson.html, js/app.js, css/style.css -- straight from
   this service's own git working copy, the same one publish uses) but with its data/media
   fetches redirected to live CMS content instead of committed repo files -- so a lesson shows
   exactly as it will once published, including edits that were never actually published. Gated
   by the same Basic Auth as everything else in this app; never reachable by a real site visitor.
   These routes are registered BEFORE the static mount so they take precedence for any slug,
   published or not. */
app.get('/preview/app/lessons/manifest.json', async (req, res, next) => {
  try {
    const all = await lessons.listLessons();
    res.json(all.map((l) => ({ slug: l.slug, title: l.title, subtitle: l.subtitle || '' })));
  } catch (err) { next(err); }
});

app.get('/preview/app/lessons/:slug/data.json', async (req, res, next) => {
  try {
    const lesson = await lessons.getLesson(req.params.slug);
    if (!lesson) return res.status(404).json({ error: 'not found' });
    const bundle = buildBundle(lesson);
    if (lesson.video_asset_path) bundle.meta.videoPath = 'video/' + path.basename(lesson.video_asset_path);
    if (lesson.captions_vtt_path) bundle.meta.captionsPath = 'video/' + path.basename(lesson.captions_vtt_path);
    if (lesson.voiceover_audio_path) bundle.voiceover.src = 'audio/voiceover/' + path.basename(lesson.voiceover_audio_path);
    res.json(bundle);
  } catch (err) { next(err); }
});

app.get('/preview/app/lessons/:slug/video/:file', async (req, res) => {
  const lesson = await lessons.getLesson(req.params.slug);
  const isCaptions = req.params.file.endsWith('.vtt');
  const filePath = isCaptions ? lesson?.captions_vtt_path : lesson?.video_asset_path;
  if (!filePath || !fs.existsSync(filePath)) return res.status(404).end();
  res.sendFile(filePath);
});

app.get('/preview/app/lessons/:slug/audio/voiceover/:file', async (req, res) => {
  const lesson = await lessons.getLesson(req.params.slug);
  if (!lesson?.voiceover_audio_path || !fs.existsSync(lesson.voiceover_audio_path)) return res.status(404).end();
  res.sendFile(lesson.voiceover_audio_path);
});

app.use('/preview/app', async (req, res, next) => {
  try {
    if (!fs.existsSync(path.join(REPO_APP_DIR, '..', '.git'))) ensureRepo();
    next();
  } catch (err) { res.status(500).json({ error: 'preview unavailable: ' + err.message }); }
}, express.static(REPO_APP_DIR));

const PORT = process.env.PORT || 3000;
db.init()
  .then(() => {
    // Clone the repo working copy BEFORE opening the port, not on the first Publish/Unpublish/
    // Preview request -- the initial `git clone` includes the public repo's full history
    // (video/audio media, ~90MB+), which can take long enough that a request triggering it
    // could silently fail (client/gateway timeout, no error surfaced) instead of just being
    // slow. Doing it here blocks startup, not request-handling, and can't race a real request
    // into cloning the same directory twice.
    if (process.env.REPO_URL) {
      try { ensureRepo(); console.log('Repo working copy ready.'); }
      catch (err) { console.error('Warm repo clone failed at startup (will retry on first publish/preview):', err.message); }
    }
  })
  .then(() => app.listen(PORT, () => console.log('Arabic Lab CMS listening on :' + PORT)))
  .catch((err) => { console.error('Failed to initialize database', err); process.exit(1); });

module.exports = app;
