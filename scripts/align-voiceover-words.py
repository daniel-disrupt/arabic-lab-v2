#!/usr/bin/env python3
"""
Forced-alignment pass for karaoke-mode word highlighting on the AI voiceover.

Called by generate-voiceover.js, not run standalone. Unlike the real recording
(free speech that deviates from the reading-edition text — see
"abed project/align_words.py", ~65% match rate), the voiceover audio is
synthesized directly from the exact same tokens it's being aligned back to, so
this is closer to forced alignment than free transcription: per-chunk
word-level timestamps from faster-whisper should match the known text far more
reliably, since there's no rephrasing/reordering to account for.

Usage:
  python scripts/align-voiceover-words.py <input.json> <output.json>

input.json:  [{ "file": "<chunk mp3 path>", "offset": <seconds>,
                "words": [{ "idx": <global word index>, "w": "<word>" }, ...] }, ...]
output.json: [{ "idx": <global word index>, "t": <absolute seconds> }, ...]
"""
import sys
import json
import re
import difflib
from faster_whisper import WhisperModel

WHISPER_MODEL = "large-v3"

TASHKEEL = re.compile(r'[ؐ-ًؚ-ٰۖ-ۭـ]')
PUNCT = '.,،؛؟!:'


def norm(s):
    s = TASHKEEL.sub('', s)
    s = s.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').replace('ٱ', 'ا')
    s = s.replace('ى', 'ي')
    return s.strip().strip(PUNCT).strip()


def main():
    in_path, out_path = sys.argv[1], sys.argv[2]
    with open(in_path, encoding='utf-8') as f:
        chunks = json.load(f)

    model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")

    aligned = []
    total_words = sum(len(c['words']) for c in chunks)
    matched = 0
    for ci, c in enumerate(chunks):
        print(f"[{ci + 1}/{len(chunks)}] aligning {c['file']}...", file=sys.stderr)
        segments, _ = model.transcribe(c['file'], word_timestamps=True, language='ar')
        raw_words = []
        for seg in segments:
            for w in seg.words:
                raw_words.append({'word': w.word, 'start': w.start})

        raw_norm = [norm(w['word']) for w in raw_words]
        known_norm = [norm(w['w']) for w in c['words']]

        sm = difflib.SequenceMatcher(None, raw_norm, known_norm, autojunk=False)
        for m in sm.get_matching_blocks():
            for k in range(m.size):
                raw_i = m.a + k
                known_i = m.b + k
                aligned.append({
                    'idx': c['words'][known_i]['idx'],
                    't': round(c['offset'] + raw_words[raw_i]['start'], 3),
                })
                matched += 1

    aligned.sort(key=lambda a: a['t'])
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(aligned, f, ensure_ascii=False)

    rate = round(matched / total_words * 100, 1) if total_words else 0
    print(f"Aligned {matched}/{total_words} words ({rate}%)", file=sys.stderr)


if __name__ == '__main__':
    main()
