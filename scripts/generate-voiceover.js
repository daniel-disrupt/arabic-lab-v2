#!/usr/bin/env node
/* ─────────────── VOICEOVER GENERATOR ───────────────
   Offline dev tool — NOT shipped to the site (GitHub Pages only deploys app/, see
   .github/workflows/pages.yml). Run this locally whenever CHUNKS in lesson-data.js
   changes, and commit the resulting audio + voiceover-data.js.

   What it does:
   1. Reads CHUNKS from app/js/lesson-data.js and builds one plain-text string per
      chunk from the reading-edition tokens (w + punct), skipping he/en glosses.
   2. Sends each chunk's text to OpenAI's TTS API and saves the returned audio as
      app/audio/voiceover/chunk-<i>.mp3.
   3. Concatenates the per-chunk files (via ffmpeg) into one lesson-length file,
      app/audio/voiceover/reading-edition.mp3 — so the reader can swap it in for
      audio-el.src exactly like the original recording.
   4. Measures each chunk's duration (via ffprobe) to compute new start/end
      timestamps against the voiceover's own pacing, and writes them to
      app/js/voiceover-data.js.
   5. Runs scripts/align-voiceover-words.py (faster-whisper) against each chunk's
      audio to get per-word timestamps for karaoke-mode highlighting, aligned back
      to the known reading-edition tokens — reliable here (unlike the real
      recording) because the audio was synthesized directly from that same text.

   Requirements:
   - Node 18+ (uses global fetch)
   - ffmpeg + ffprobe on PATH (brew install ffmpeg / apt install ffmpeg)
   - Python 3 + faster-whisper installed (pip install faster-whisper)
   - OPENAI_API_KEY env var

   Voice: the lesson text is spoken Palestinian Arabic, not MSA. OpenAI's TTS voices
   aren't dialect-specific (no Levantine/Jordanian/Syrian option like Azure has) — the
   model reads the voweled dialectal text in its own general Arabic pronunciation,
   which may lean closer to MSA than an authentic Palestinian accent. gpt-4o-mini-tts
   is used because it accepts a natural-language style instruction alongside the text,
   which at least nudges pacing/tone even though it can't guarantee dialect accuracy.
   Swap OPENAI_VOICE below to compare options: alloy, ash, ballad, coral, echo, fable,
   onyx, nova, sage, shimmer, verse.

   Usage:
     OPENAI_API_KEY=xxx node scripts/generate-voiceover.js
*/

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const OPENAI_MODEL = 'gpt-4o-mini-tts';
const OPENAI_VOICE = process.env.OPENAI_VOICE || 'onyx';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const VOICE_INSTRUCTIONS = 'Speak in a natural, conversational tone with the pacing of someone reading a Levantine Arabic political speech aloud to an audience — measured, clear, slightly formal.';

const ROOT = path.join(__dirname, '..');
const AUDIO_DIR = path.join(ROOT, 'app', 'audio', 'voiceover');
const OUT_DATA_FILE = path.join(ROOT, 'app', 'js', 'voiceover-data.js');
const FINAL_MP3 = path.join(AUDIO_DIR, 'reading-edition.mp3');

function chunkText(chunk) {
  return chunk.text
    .map((tok) => (tok.sep !== undefined ? tok.sep : (tok.w || '') + (tok.punct || '')))
    .join(' ')
    .replace(/\s+([،؛؟.!:])/g, '$1'); // no space before Arabic/ASCII punctuation
}

// Global word index must match buildReader()'s `gi` counter in app.js exactly
// (increments once per non-sep token, in chunk order) so alignment output lines
// up with wordEls[].globalIdx.
function buildAlignmentWords(chunks) {
  let gi = 0;
  return chunks.map((chunk) => {
    const words = [];
    chunk.text.forEach((tok) => {
      if (tok.sep !== undefined) return;
      words.push({ idx: gi++, w: tok.w });
    });
    return words;
  });
}

async function synthesize(text, voice) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      voice,
      input: text,
      instructions: VOICE_INSTRUCTIONS,
      response_format: 'mp3',
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI TTS request failed: ${res.status} ${await res.text()}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function ffprobeDuration(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ]);
  return parseFloat(out.toString().trim());
}

function concatMp3s(files, outFile) {
  const listFile = path.join(AUDIO_DIR, 'concat-list.txt');
  fs.writeFileSync(listFile, files.map((f) => `file '${path.basename(f)}'`).join('\n'));
  execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outFile], {
    cwd: AUDIO_DIR,
  });
  fs.unlinkSync(listFile);
}

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('Set OPENAI_API_KEY env var first.');
    process.exit(1);
  }

  const { CHUNKS } = require(path.join(ROOT, 'app', 'js', 'lesson-data.js'));
  fs.mkdirSync(AUDIO_DIR, { recursive: true });

  const chunkFiles = [];
  for (let i = 0; i < CHUNKS.length; i++) {
    const text = chunkText(CHUNKS[i]);
    console.log(`[${i + 1}/${CHUNKS.length}] synthesizing (${text.length} chars)...`);
    const audio = await synthesize(text, OPENAI_VOICE);
    const file = path.join(AUDIO_DIR, `chunk-${i}.mp3`);
    fs.writeFileSync(file, audio);
    chunkFiles.push(file);
  }

  console.log('Concatenating chunks into reading-edition.mp3...');
  concatMp3s(chunkFiles, FINAL_MP3);

  console.log('Measuring durations for chunk-level sync...');
  let cursor = 0;
  const voiceoverChunks = chunkFiles.map((file, i) => {
    const dur = ffprobeDuration(file);
    const entry = { start: cursor, end: cursor + dur, label: CHUNKS[i].label };
    cursor += dur;
    return entry;
  });

  console.log('Aligning words for karaoke sync (running faster-whisper, this can take a while)...');
  const alignmentWords = buildAlignmentWords(CHUNKS);
  const alignInput = chunkFiles.map((file, i) => ({
    file,
    offset: voiceoverChunks[i].start,
    words: alignmentWords[i],
  }));
  const alignInputFile = path.join(AUDIO_DIR, 'align-input.json');
  const alignOutputFile = path.join(AUDIO_DIR, 'align-output.json');
  fs.writeFileSync(alignInputFile, JSON.stringify(alignInput));
  execFileSync('python', [path.join(__dirname, 'align-voiceover-words.py'), alignInputFile, alignOutputFile], {
    stdio: 'inherit',
  });
  const wordTimes = JSON.parse(fs.readFileSync(alignOutputFile, 'utf-8'));
  fs.unlinkSync(alignInputFile);
  fs.unlinkSync(alignOutputFile);

  chunkFiles.forEach((f) => fs.unlinkSync(f)); // keep only the merged file

  const out = `/* ─────────────── VOICEOVER DATA ───────────────
   Generated by scripts/generate-voiceover.js — do not hand-edit.
   Re-run that script after any change to CHUNKS in lesson-data.js to regenerate
   both the audio file and this file together, so text and audio stay in sync.

   VOICEOVER_WORD_TIMES — per-word timestamps for karaoke-mode highlighting,
   {idx, t} where idx matches wordEls[].globalIdx in app.js. Only used when the
   voiceover is the active audio source.
*/
const VOICEOVER_SRC = "audio/voiceover/reading-edition.mp3";
const VOICEOVER_CHUNKS = ${JSON.stringify(voiceoverChunks, null, 2)};
const VOICEOVER_WORD_TIMES = ${JSON.stringify(wordTimes)};
`;
  fs.writeFileSync(OUT_DATA_FILE, out);
  console.log(`Done. Wrote ${FINAL_MP3} and ${OUT_DATA_FILE}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
