# Building Arabic Lab with Agentic AI

*A technical process log for people curious about agentic AI — what it's actually
like to build something real with it, and where it earns its keep on a
mission-driven, one-person project.*

This document is not the project spec (see [`PROJECT.md`](PROJECT.md) for the
pipeline design and [`SCHEMA.md`](SCHEMA.md) for the data model). It's the
story of *how* Arabic Lab actually got built — session by session, mistake by
mistake — for readers who want to understand what working with agentic AI
looks like in practice, not in a demo.

The short version, already on the app's own About page: AI did most of the
heavy lifting — transcription, translation, tashkīl, an AI voiceover, and all
of the actual coding — while a human (me) chose the material, set the
pedagogy, checked every translation, and made the judgment calls no model
should be trusted with alone. This document is the long version.

---

## 1. Two different kinds of "AI" in this project

It's worth separating these, because they get lumped together in casual
conversation but behave completely differently in practice:

**Content-generation AI** — used once per lesson, offline, to turn a raw
recording into structured material: `faster-whisper` for transcription, an
LLM for translation/tashkīl/simplification, OpenAI TTS for the voiceover.
These are largely *single-shot* tools: you run them, you get an output, you
review it.

**Agentic coding AI** (Claude Code) — used continuously, session after
session, to actually build the web app: the reader, the tap-to-translate
tray, the vocab/verb tools, the video player, every CSS breakpoint. This is
*conversational and iterative*: you describe a problem or a goal in plain
language, the agent reads the actual code, makes a change, and — critically —
can verify its own change by launching the app and testing it, not just
asserting that it works.

The second kind is the more interesting one, and where most of the lessons
below come from. But the pipeline is worth walking through first, because it
sets up the core discipline that carries through everything else: **AI output
is always a draft until a human with domain knowledge signs off on it.**

---

## 2. The content pipeline

### Transcription

Input is a phone-recorded video of a real event — in this case, a ~7-minute
protest speech in colloquial Palestinian Arabic. Audio gets pulled out at
16kHz mono (`ffmpeg -i input.mp4 -ar 16000 -ac 1 -c:a pcm_s16le speech.wav`)
and run through `faster-whisper`, model `large-v3`, language forced to `ar`
(auto-detect wanders on noisy crowd audio) with a VAD filter to skip dead air.

The raw transcript is a *draft, never final*. Dialectal speech gets
mis-heard, sentences run on, some spans come out genuinely garbled. That's
expected — Whisper (like most ASR) is trained overwhelmingly on Modern
Standard Arabic and formal registers; colloquial Palestinian Arabic is a
much smaller slice of its training distribution.

### Editing — three passes, each further from the raw audio

1. **Literal clean-up** — fix obvious mis-hearings while preserving the
   spoken register (`الياقس/بيقس` → `اليأس`, `جنات الغزاز` →
   `حديقة الغزازوة`). Still the speaker's actual words, just legible.
2. **Tashkīl (vocalization)** — add full diacritics reflecting *actual dialect
   pronunciation* (بِدّنا، إحنا، مِش، هلّق), not MSA voweling. Colloquial Arabic
   has no fixed orthography, so some of this is genuinely interpretive —
   which is exactly why it needs to be flagged, not silently presented as
   settled fact.
3. **Readability edition** — smooth spoken syntax into essay prose while
   keeping the dialect intact. This is the version the Reader tab actually
   shows.

The rule that governs all three passes, stated in the original project spec
and enforced everywhere downstream: **every pass moves the text further from
what was literally said.** The raw transcript and the reading edition are
both kept, on purpose — the diff between them is itself a learning artifact.
For reconstructed or uncertain spots, the recording is the only source of
truth, and the job of the tooling is to surface uncertainty, not paper over
it.

### Voiceover

The Reader's audio isn't the original recording — it's synthesized from the
final voweled text via OpenAI's TTS (`gpt-4o-mini-tts`), because the source
audio has crowd noise and isn't segmented per-chunk. That decision came with
an explicit, documented limitation: OpenAI's Arabic voices aren't
dialect-specific, so the synthesized voice likely leans closer to MSA
pronunciation than an authentic Palestinian accent. That trade-off is written
directly into the generator script as a comment, not hidden — a small but
deliberate act of not overselling what the tool can do.

One thing this pipeline stage got *right* by construction: per-word
timestamp alignment for karaoke-style highlighting is reliable here, because
the audio was synthesized directly from the known text — there's no ASR
guessing involved, just measuring. That's a good general pattern: **push
alignment problems to wherever you have ground truth**, rather than trying to
solve them against noisy real-world audio if you don't have to.

### Where alignment against the *real* recording is unavoidable

The Watch tab plays the actual protest video, not synthesized audio, so its
captions have to align to real ASR output. That pipeline runs
`faster-whisper` with `word_timestamps=True` for per-word timing, then aligns
those raw ASR words to the clean reading-edition text using `difflib`'s
sequence matcher — critically, **windowed per chunk** rather than matched
globally. A first attempt at global matching only hit 45.7% alignment,
because a 7-minute speech re-uses common words (بدي, احنا, إنه) constantly and
the matcher kept latching onto the wrong occurrence. Constraining the search
to each chunk's known time window raised that to 65.1%, with zero
out-of-order timestamps. The remaining ~35% — words that were rephrased or
dropped during cleanup and have no literal spoken counterpart — simply don't
get a timestamp. No interpolation, no faking it. That's the same
anti-fabrication principle from the editing passes, showing up again in a
completely different part of the pipeline.

---

## 3. Working with an agentic coding assistant

This is the part that's genuinely different from "using AI tools" in the
single-shot sense above. A session with Claude Code doesn't look like typing
a prompt and getting a finished file back. It looks like:

1. **You describe a problem in plain language**, often vaguely, the way you'd
   describe it to a colleague — *"I don't see it on mobile,"* not a bug
   report with repro steps.
2. **The agent reads the actual code** — not a memory of similar code, the
   literal current state of the files — to understand what's really there
   before proposing anything.
3. **When the cause isn't obvious from reading, it goes and checks** — spins
   up a local server, drives a real headless browser at the actual viewport
   width in question, and measures. Guessing is cheap; a five-line script
   that prints real pixel coordinates is cheaper than being wrong.
4. **It makes the smallest change that fixes the actual cause**, not a
   defensive rewrite of everything nearby.
5. **It verifies the fix the same way it found the bug** — re-running the
   same measurement, this time expecting the opposite result — before
   reporting anything as done.

That loop matters more than any individual line of code it writes. The
value of an agentic tool isn't that it can write JavaScript — plenty of tools
can do that. It's that it can *close the loop itself*: reproduce, fix,
re-verify, without you having to be the one who catches every regression.

### A concrete example of that loop, from this project

You reported: *"when I open up the video from the homepage, there's no way to
exit the video, and I don't see a subtitle toggle."* Nothing in that
description says *why*. The investigation:

- Read the actual HTML/CSS for the video view, noticed a `theater` (fullscreen)
  mode that auto-triggers on play, and a control toolbar with eight buttons
  crammed into one row with no wrap and no overflow scrolling.
- That's a hypothesis, not a diagnosis. So: spun up the app locally with
  `http-server`, drove it with Playwright at a real phone width (390px), and
  read out the actual bounding boxes of every toolbar button.
- The two buttons you couldn't find were rendering at `x: -12` and `x: -62` —
  physically off the left edge of the screen. Not a logic bug, not a CSS
  typo — just too many controls for the available width, silently clipped
  with no visual indication anything was missing.
- Fix: a dedicated close button burned directly onto the video (not
  competing for toolbar space), the translation toggle relocated to a row
  with actual room, and the redundant fullscreen button hidden on mobile
  specifically.
- Verification: the same Playwright script, re-run, now asserting every
  control's `x` position is inside `[0, 390]` — not just eyeballing a
  screenshot and hoping.

Two follow-up requests refined this further — restoring the fullscreen toggle
to the toolbar *as well* once there was room, and wiring the phone's physical
back button (via `history.pushState`/`popstate`) to close the fullscreen view
instead of leaving the page entirely. Each one got the same treatment:
reproduce with a real simulated back-navigation, confirm the failure, fix,
confirm the fix, *then* say it's done.

---

## 4. Case studies: where this actually went wrong, and what that taught

The clean success stories are less instructive than the failures. Three from
this project's history are worth walking through in full, because each one
teaches something an "agentic AI is magic" narrative would skip.

### The karaoke-highlighting saga (shipped twice, killed twice)

Word-level highlighting — the little bouncing-ball effect that tracks the
currently-spoken word — is objectively the fanciest feature attempted here.
It got built, using Whisper's `word_timestamps=True` against the real
recording, aligned per-chunk with `difflib`. It shipped. Then it got killed,
because it "visibly didn't match the spoken word" and was, in your words,
"really distracting" — not almost-right, actually wrong in a way that hurt
the reading experience.

The response wasn't to tune the alignment harder. It was to drop to a coarser
but *more trustworthy* signal: sentence-level highlighting, anchored to
Whisper's segment-level timestamps (which are meaningfully more reliable than
its per-word attention for dialectal speech — a documented limitation of the
model, not a bug in this project's code). That version hit 89% coverage with
zero out-of-order timestamps — genuinely better data than the word-level
attempt.

**It got killed too** — not because the data was wrong this time, but because
having a second highlight nested inside the already-highlighted active
paragraph read as visual noise, regardless of how accurate it was. That's the
real lesson: **more accurate data does not automatically mean a better
feature.** The chunk-level highlight that survived both rounds was the
simplest one, and it survived because a human sat with it and said "this
doesn't feel right" twice, about two technically-improving iterations, for
two completely different reasons (mistiming, then layering). No amount of
model capability substitutes for that kind of taste-check.

### The punctuation that silently disappeared

An early version of the reader tokenized the speech by hand — typing out each
word as its own token. It worked, until you compared it closely against the
approved, teacher-reviewed docx and noticed commas, periods, and colons were
just missing from the app, along with one specific em-dash between two words
in the middle of the speech. Nobody had *decided* to drop punctuation; the
hand-typed word list simply never included it, and the rendering code for
standalone punctuation tokens had a latent bug on top of that.

The fix wasn't to patch in the missing marks by hand. It was to re-derive
every token programmatically, straight from the source docx's paragraph text,
and then run a structural sanity check — comparing the new machine-derived
word sequence against the old hand-typed one, position by position, before
trusting it (668 of 668 matched, once one regex bug in the ellipsis handling
was found and fixed). **Rebuilding from source beat hand-transcribing a
second time**, and the sanity check is what made it safe to trust the
rebuild instead of just hoping it was right.

### The binyan bug only a Hebrew/Arabic speaker would catch

Verbs were originally grouped in the Verbs tab by their closest Hebrew
grammatical category (בניין). That's a reasonable UI decision — until you
realize Hebrew only has seven of these categories and Arabic has ten, so four
distinct Arabic verb forms (5, 6, 8, and 10) were silently collapsing into one
shared bucket because they all *happen* to map loosely to the same Hebrew
approximation. Technically nothing crashed; the app just quietly presented
inaccurate linguistic structure. Nothing in the code would have flagged that
as a bug — it took someone who actually knows both languages to notice the
categories didn't feel right, and to know *why*: this was a domain-knowledge
gap, not a software one. The fix — group by the actual Arabic form number
(1–10), with the Hebrew approximation shown only as a secondary label — is
a one-line reframing once someone points at the actual linguistic problem.
No amount of code review catches a bug in a domain the reviewer doesn't
understand.

---

## 5. What generalizes from all of this

Pulling the threads together, a few principles kept proving themselves
across very different parts of the project — pipeline scripts, CSS layout
bugs, and linguistic data alike:

- **Treat every AI output as a draft with a visible "not yet reviewed"
  state**, not as a finished artifact. This project's verb cards literally
  render a draft badge for anything not yet reviewed by a teacher — the
  discipline is baked into the UI, not just the process.
- **Never let an interpolation quietly pass as fact.** Missing timestamps
  stay missing rather than being guessed at. Uncertain transcription spans
  get flagged rather than smoothed over. This matters more, not less, for
  underserved dialects and niche subject matter — there's no large,
  authoritative reference corpus to silently fall back on if your own data
  goes wrong.
- **Verify empirically, not by asking the model if it worked.** The
  recurring pattern in every bug fix above was: reproduce with a real
  measurement (pixel coordinates, word-position diffs, alignment percentages),
  fix, then re-run the *same* measurement expecting the opposite result.
  An agent that tells you "this should work now" is not the same as an agent
  that shows you it does.
- **Rebuilding from a trustworthy source beats patching a shaky one.** Both
  the punctuation bug and the word-timing bugs got fixed by re-deriving data
  from its origin (the docx, the synthesized audio's own text) rather than
  hand-patching the derived artifact.
- **Domain expertise is the part that doesn't automate.** The binyan bug,
  the choice to keep Hebrew as the primary gloss language over English, the
  decision that a nested highlight reads as noise — none of that comes from
  writing better prompts. It comes from a human who actually knows the
  language, the learner, and the material sitting with the output and
  noticing when something is subtly off.
- **Small, continuously-updated persistent memory beats re-explaining
  context every session.** Hard-won, easy-to-relearn-the-hard-way lessons —
  "don't re-extract text from the PDF, the docx's XML is the reliable
  source," "use a real HTTP server that supports Range requests or audio
  seeking silently breaks in local testing" — get written down once and
  carried forward, instead of being rediscovered by trial and error in every
  new session.

---

## 6. Where this actually matters for mission-driven work

None of the above is unique to language learning. But it's worth being
explicit about why agentic AI is a genuinely good fit for a project like this
one specifically, rather than just a convenient way to avoid hiring a
developer.

**The economics change who gets to build things.** A properly resourced
team — a developer, a translator, a linguist, a voice actor, a UI designer —
is simply not available for a personal study tool built around one
politically significant speech in one specific dialect. Agentic AI collapses
most of that team into a conversation one person can have in their spare
time. That's not a shortcut around quality; it's the difference between this
existing at all and not existing.

**The mission and the engineering discipline turn out to be the same
discipline.** This project's whole premise is preserving and teaching a
specific, undocumented, politically-loaded register of a marginalized
dialect — the language of grief, accountability, and community organizing in
Jaffa, spoken by people whose speech doesn't show up in formal corpora. Get
the tashkīl wrong, or silently paper over an uncertain transcription, and
you're not shipping a minor bug — you're teaching someone the wrong way to
grieve publicly, or to demand accountability, in a language that matters to
them and their community. The "never fabricate, always flag uncertainty"
rule that shows up in every part of this pipeline isn't a generic software
best practice borrowed from somewhere else. It's the actual ethical
requirement of the mission, and it happens to also be good engineering. For
work like this, that alignment is the whole point: the discipline the tool
needs from you is the same discipline the mission needs from you.

**Human judgment is the bottleneck you should protect, not remove.** Every
case study above is a moment where a human's specific knowledge — of the
dialect, of the speaker, of what a highlight *feels* like when you're
actually trying to read — caught something a general-purpose model had no
way to catch on its own. Agentic AI is extremely good at execution: writing
the alignment script, measuring the pixel coordinates, rebuilding the token
list from source, running the sanity check. It is not a substitute for
someone who knows the subject caring enough to notice when the output is
subtly wrong. The projects where this kind of tooling adds the most value
are the ones where a domain expert who isn't a professional developer can
now act directly on their own expertise, instead of losing it in translation
to someone else who has to build it for them.

---

## 7. If you want to try this yourself

A few practical starting points, distilled from the sessions above:

- **Describe problems the way you'd describe them to a person**, not the way
  you'd write a bug ticket. "I don't see it on mobile" is a perfectly good
  starting point — a competent agentic tool should be able to go find out
  why, not ask you to first diagnose it yourself.
- **Ask to see the verification, not just the claim.** If a fix is real, it
  should be checkable — a measurement, a test, a screenshot at the actual
  viewport size in question — not just an assurance.
- **Keep a running memory of hard-won lessons**, however small. The
  cumulative effect of never re-solving the same problem twice is bigger than
  any single clever prompt.
- **Spend your own attention where your own expertise actually lives.** Let
  the tool carry the mechanical weight — transcribing, aligning, writing
  boilerplate CSS — and save your time for the calls only you can make: does
  this sound right, does this feel right, is this actually true to what was
  said.
- **Build the "this is a draft" signal into the product itself**, not just
  your own process. If your users will ever see AI-generated content, give
  them the same visibility into its confidence that you'd want as the
  reviewer.

The result, for this project, is a study tool that wouldn't have gotten built
any other way — and that's really the argument for all of this: not that AI
writes good code, but that it makes real, specific, personally-motivated
projects like this one *reachable* by the person who actually cares about
them.
