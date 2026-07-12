# PAM Project Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static academic project page for the PAM paper, served from `docs/` on GitHub Pages, with an interactive section that replays how the FSM memory evolves across Days 1–5 and a routine change.

**Architecture:** One `index.html` with ten sections, styled by Bulma (CDN) plus a custom stylesheet. The one piece of real logic is `memory-evolution.js`: it fetches `pam-fsm.json` and renders a day of the FSM into a fixed-coordinate inline SVG (left pane) and a rules list (right pane) by toggling CSS classes. No build step, no framework, no bundler. Every `<video>` points at its final path and degrades to a gray "Video coming soon" panel when the file is absent.

**Tech Stack:** HTML5, CSS3, vanilla ES2020 JS, Bulma 0.9.x (CDN), Font Awesome + Academicons (CDN), PyMuPDF (`fitz`) for one-time figure extraction, Python 3 for the data validator and local server.

## Global Constraints

- **All page copy is English.** No Korean on the page. (Conversation with the user is Korean; the artifact is not.)
- **Page root is `docs/`.** GitHub Pages source: branch `main`, folder `/docs`. Every asset path in `index.html` is relative to `docs/` (e.g. `static/css/index.css`), never absolute (`/static/...`), so the page also works when served from a subpath.
- **No fabricated numbers.** Every number on the page is traceable to the paper. Specifically: no per-day precision/recall/F1 values anywhere in the Memory Evolution section — the paper reports those as plots only.
- **FSM text is verbatim from the paper.** Triggers, actions, state names, and state descriptions are copied character-for-character from Fig. 12 (Days 1–4), Fig. 13 (Day 5), and Fig. 7 (routine change). Do not paraphrase, do not fix grammar, do not add trailing periods where the paper has none.
- **Highlight convention matches the paper.** A newly added state / transition / (trigger, action) pair renders orange. On an existing pair that gained an `or`-clause, only the new clause is orange; prior clauses stay gray.
- **No arXiv button.** The preprint does not exist yet. Leave commented-out markup for it.
- **Author list, exact:** Dohyun Lee\*, Minho Park\*, Jeonghoon Park, Dongyoon Hwang, Junha Hyung, Sungwon Hwang, Byungkun Lee, Jaegul Choo — KAIST AI. `*` = equal contribution.
- **Commit after every task.** Small commits, conventional-commit style messages.

**Verification is manual — there is no test runner.** Where a task has a machine-checkable invariant (Task 6), it gets a real script with real assertions. Every other task ends with a browser check with the exact command and the exact thing to look for. "It looks fine" is not a pass; the step states what must be on screen.

---

### Task 1: Scaffold the site and move the PDF

**Files:**
- Create: `docs/index.html`
- Create: `docs/.nojekyll`
- Create: `docs/static/css/index.css`
- Create: `docs/static/js/index.js`
- Move: `PAM.pdf` → `docs/static/pdfs/PAM.pdf`

**Interfaces:**
- Consumes: nothing.
- Produces: the directory layout every later task writes into, and a servable `index.html` whose `<head>` already loads Bulma, Font Awesome, Academicons, `static/css/index.css`, and `static/js/index.js`.

- [ ] **Step 1: Create the directory tree and move the PDF**

```bash
cd /home/nas_main/minhopark/repos/PAM
mkdir -p docs/static/{css,js,data,pdfs,images,videos}
git mv PAM.pdf docs/static/pdfs/PAM.pdf
touch docs/.nojekyll
```

`.nojekyll` tells GitHub Pages to serve the directory verbatim instead of running it through Jekyll. Without it, Jekyll can silently drop files and directories it does not recognize.

- [ ] **Step 2: Write the HTML skeleton**

Create `docs/index.html`. This is the shell every later task fills in — the sections are empty on purpose, each one is a later task's deliverable.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PAM: Procedural Assistance Memory for Proactive Robot</title>
  <meta name="description"
        content="A finite-state assistance memory that lets a robot learn when and how to help, from a few days of watching one user.">

  <link href="https://fonts.googleapis.com/css?family=Google+Sans|Noto+Sans|Castoro" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/jpswalsh/academicons@1/css/academicons.min.css">
  <link rel="stylesheet" href="static/css/index.css">
</head>
<body>

  <!-- Task 3 -->
  <section class="hero" id="hero"></section>

  <!-- Task 3 -->
  <section class="section" id="teaser"></section>

  <!-- Task 4 -->
  <section class="section" id="abstract"></section>

  <!-- Task 4 -->
  <section class="section" id="motivation"></section>

  <!-- Task 4 -->
  <section class="section" id="architecture"></section>

  <!-- Task 5 -->
  <section class="section" id="tasks"></section>

  <!-- Task 7 -->
  <section class="section" id="memory-evolution"></section>

  <!-- Task 8 -->
  <section class="section" id="results"></section>

  <!-- Task 8 -->
  <section class="section" id="closed-loop"></section>

  <!-- Task 9 -->
  <section class="section" id="generalization"></section>

  <!-- Task 10 -->
  <section class="section" id="bibtex"></section>

  <!-- Task 10 -->
  <footer class="footer" id="site-footer"></footer>

  <script src="static/js/index.js"></script>
</body>
</html>
```

- [ ] **Step 3: Write the stylesheet foundation**

Create `docs/static/css/index.css`.

```css
:root {
  --pam-orange: #e8710a;
  --pam-orange-soft: #fff1e2;
  --pam-gray: #5f6368;
  --pam-border: #dadce0;
  --pam-bg-alt: #f8f9fa;
}

body {
  font-family: 'Noto Sans', sans-serif;
}

.publication-title {
  font-family: 'Google Sans', sans-serif;
}

.section-heading {
  font-family: 'Google Sans', sans-serif;
  margin-bottom: 1.5rem;
}

.figure {
  margin: 0 auto;
  max-width: 1000px;
}

.figure img {
  width: 100%;
  height: auto;
}

.figure-caption {
  color: var(--pam-gray);
  font-size: 0.95rem;
  margin-top: 0.75rem;
  text-align: left;
}
```

- [ ] **Step 4: Create an empty JS entry point**

Create `docs/static/js/index.js`.

```js
// Site-wide behavior. Sections register their own setup here.
document.addEventListener('DOMContentLoaded', () => {
  // Populated by later tasks.
});
```

- [ ] **Step 5: Serve and verify**

```bash
cd /home/nas_main/minhopark/repos/PAM/docs && python3 -m http.server 8123
```

Open `http://localhost:8123/`. Expected: a blank white page (all sections are empty), the browser tab titled **"PAM: Procedural Assistance Memory for Proactive Robot"**, and **zero 404s and zero errors** in the DevTools console — in particular `static/css/index.css` and `static/js/index.js` must both return 200. Then:

```bash
curl -sI http://localhost:8123/static/pdfs/PAM.pdf | head -1
```

Expected: `HTTP/1.0 200 OK`. Stop the server with Ctrl-C.

- [ ] **Step 6: Commit**

```bash
cd /home/nas_main/minhopark/repos/PAM
git add -A docs PAM.pdf
git commit -m "chore: scaffold project page under docs/ and relocate the paper PDF"
```

---

### Task 2: Extract the paper figures

**Files:**
- Create: `tools/extract_figures.py`
- Create (generated): `docs/static/images/fig{1,2,3,4,5,7,9,10,11,20,21,22}_*.png`

**Interfaces:**
- Consumes: `docs/static/pdfs/PAM.pdf` (Task 1).
- Produces: twelve PNGs at the exact filenames listed in the spec's figure table. Later tasks reference these names and nothing else.

A figure is cropped by a **vertical band** of its page: figures in this paper span the full text width, so the horizontal crop is the same for all of them (the page's text margins) and only `y0`/`y1` differ. The fractions below are starting estimates — Step 3 is where you look at each PNG and correct them.

- [ ] **Step 1: Write the extraction script**

Create `tools/extract_figures.py`.

```python
"""Render figure crops from PAM.pdf into docs/static/images/ at 300 dpi.

Crops are vertical bands of a page: the paper's figures all span the text
width, so x is fixed to the text margins and only y0/y1 vary per figure.
All values are fractions of the page box.
"""
import pathlib

import fitz

PDF = pathlib.Path("docs/static/pdfs/PAM.pdf")
OUT = pathlib.Path("docs/static/images")
DPI = 300

X0, X1 = 0.10, 0.90  # text margins, same for every figure

# name -> (1-indexed page, y0 fraction, y1 fraction)
FIGURES = {
    "fig1_motivation":          (2,  0.06, 0.34),
    "fig2_overview":            (3,  0.06, 0.34),
    "fig3_pam_example":         (4,  0.30, 0.52),
    "fig4_tasks":               (5,  0.06, 0.36),
    "fig5_multiday":            (6,  0.06, 0.40),
    "fig7_memory_evolution":    (8,  0.06, 0.46),
    "fig9_cameras":             (16, 0.06, 0.30),
    "fig10_pertask":            (17, 0.10, 0.42),
    "fig11_selfevolving":       (18, 0.10, 0.44),
    "fig20_medication":         (25, 0.40, 0.66),
    "fig21_medication_results": (26, 0.06, 0.44),
    "fig22_transfer":           (27, 0.06, 0.60),
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(PDF)
    zoom = DPI / 72.0
    for name, (page_no, y0, y1) in FIGURES.items():
        page = doc[page_no - 1]
        r = page.rect
        clip = fitz.Rect(
            r.x0 + X0 * r.width,
            r.y0 + y0 * r.height,
            r.x0 + X1 * r.width,
            r.y0 + y1 * r.height,
        )
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=clip)
        dest = OUT / f"{name}.png"
        pix.save(dest)
        print(f"{dest}  {pix.width}x{pix.height}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it**

```bash
cd /home/nas_main/minhopark/repos/PAM && python3 tools/extract_figures.py
```

Expected: twelve lines, each naming a PNG with a pixel size roughly 2500px wide. A crop narrower than ~2000px means `X0`/`X1` are wrong.

- [ ] **Step 3: Inspect every crop and correct the fractions**

Open each of the twelve PNGs and check two things: **the whole figure is inside the crop** (no axis label, no legend, no subfigure cut off at an edge) and **the caption is not inside the crop** (the caption is set in the page HTML, so it must not be baked into the image). Nudge that figure's `y0` down / `y1` up in `FIGURES` and re-run Step 2 until both hold. This will take a couple of rounds for the multi-panel figures (5, 10, 11, 21, 22); that is expected, not a sign something is broken.

- [ ] **Step 4: Confirm all twelve exist**

```bash
cd /home/nas_main/minhopark/repos/PAM && ls -1 docs/static/images/*.png | wc -l
```

Expected: `12`.

- [ ] **Step 5: Commit**

```bash
git add tools/extract_figures.py docs/static/images
git commit -m "feat: extract paper figures from the PDF at 300 dpi"
```

---

### Task 3: Hero, teaser video, and the video-placeholder component

**Files:**
- Modify: `docs/index.html` (`#hero`, `#teaser`)
- Modify: `docs/static/css/index.css` (append)
- Modify: `docs/static/js/index.js` (append)

**Interfaces:**
- Consumes: the skeleton from Task 1.
- Produces: **the video-placeholder contract used by Tasks 5 and 8.** Any video on this page is written as:

```html
<div class="video-slot">
  <video controls playsinline preload="metadata" src="static/videos/NAME.mp4"></video>
  <div class="video-slot__fallback"><span>Video coming soon</span></div>
</div>
```

`setupVideoSlots()` in `index.js` adds `is-missing` to the `.video-slot` when the `<video>` fires `error` (which is what a 404 produces), and the CSS reveals the fallback panel. No other task needs to know how this works — it just uses the markup above.

- [ ] **Step 1: Write the hero**

Replace the `<section class="hero" id="hero"></section>` line in `docs/index.html` with:

```html
  <section class="hero" id="hero">
    <div class="hero-body">
      <div class="container is-max-desktop has-text-centered">
        <h1 class="title is-1 publication-title">
          Procedural Assistance Memory for Proactive Robot
        </h1>
        <p class="subtitle is-5 pam-authors">
          <span>Dohyun Lee<sup>*</sup>,</span>
          <span>Minho Park<sup>*</sup>,</span>
          <span>Jeonghoon Park,</span>
          <span>Dongyoon Hwang,</span>
          <span>Junha Hyung,</span>
          <span>Sungwon Hwang,</span>
          <span>Byungkun Lee,</span>
          <span>Jaegul Choo</span>
        </p>
        <p class="pam-affiliation">KAIST AI</p>
        <p class="pam-equal"><sup>*</sup> indicates equal contribution.</p>

        <div class="pam-links">
          <a class="button is-rounded is-dark" href="static/pdfs/PAM.pdf">
            <span class="icon"><i class="fas fa-file-pdf"></i></span>
            <span>Paper</span>
          </a>
          <!-- arXiv button goes here once the preprint is posted:
          <a class="button is-rounded is-dark" href="https://arxiv.org/abs/XXXX.XXXXX">
            <span class="icon"><i class="ai ai-arxiv"></i></span>
            <span>arXiv</span>
          </a>
          -->
          <a class="button is-rounded is-dark" href="#">
            <span class="icon"><i class="fab fa-github"></i></span>
            <span>Code</span>
          </a>
        </div>
      </div>
    </div>
  </section>
```

- [ ] **Step 2: Write the teaser section**

Replace `<section class="section" id="teaser"></section>` with:

```html
  <section class="section" id="teaser">
    <div class="container is-max-desktop">
      <div class="video-slot video-slot--wide">
        <video controls playsinline preload="metadata" src="static/videos/teaser.mp4"></video>
        <div class="video-slot__fallback"><span>Video coming soon</span></div>
      </div>
      <p class="figure-caption has-text-centered">
        A robot that has watched this user for a few days brings the milk before it is asked for.
      </p>
    </div>
  </section>
```

- [ ] **Step 3: Style the hero and the video slot**

Append to `docs/static/css/index.css`:

```css
/* --- hero --- */
.pam-authors span {
  margin-right: 0.35rem;
}

.pam-affiliation {
  font-size: 1.15rem;
  margin-top: 0.5rem;
}

.pam-equal {
  color: var(--pam-gray);
  font-size: 0.9rem;
  margin-top: 0.25rem;
}

.pam-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
  margin-top: 1.75rem;
}

/* --- video slot --- */
.video-slot {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: var(--pam-bg-alt);
  border-radius: 8px;
  overflow: hidden;
}

.video-slot video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.video-slot__fallback {
  display: none;
  position: absolute;
  inset: 0;
  align-items: center;
  justify-content: center;
  background: var(--pam-bg-alt);
  border: 1px dashed var(--pam-border);
  border-radius: 8px;
  color: var(--pam-gray);
  font-size: 0.95rem;
  letter-spacing: 0.02em;
}

.video-slot.is-missing video {
  visibility: hidden;
}

.video-slot.is-missing .video-slot__fallback {
  display: flex;
}
```

- [ ] **Step 4: Wire up the fallback**

Replace the contents of `docs/static/js/index.js` with:

```js
// Site-wide behavior. Sections register their own setup here.

// A <video> whose src 404s fires `error`. Reveal the placeholder panel instead
// of leaving a broken black box on the page.
function setupVideoSlots() {
  document.querySelectorAll('.video-slot').forEach((slot) => {
    const video = slot.querySelector('video');
    if (!video) return;
    video.addEventListener('error', () => slot.classList.add('is-missing'));
    // If the browser already failed before this listener attached, catch it now.
    if (video.error) slot.classList.add('is-missing');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupVideoSlots();
});
```

- [ ] **Step 5: Verify the placeholder appears**

Serve `docs/` (`python3 -m http.server 8123` from `docs/`) and open `http://localhost:8123/`.

Expected: the title, the eight authors with `*` on the first two, KAIST AI, and two buttons — **Paper** and **Code**, no arXiv button. Below them, a gray dashed panel reading **"Video coming soon"** where the teaser will go. Clicking **Paper** opens the PDF. The console will log a 404 for `teaser.mp4` — that is the mechanism working, not a bug.

- [ ] **Step 6: Verify a real video would play**

```bash
cd /home/nas_main/minhopark/repos/PAM
python3 - <<'PY'
# 1-second black 16:9 clip, so we can prove the slot plays a real file.
import subprocess, shutil, sys
if not shutil.which("ffmpeg"):
    sys.exit("ffmpeg not installed - skip this step and check it by hand later")
subprocess.run(["ffmpeg","-y","-f","lavfi","-i","color=c=black:s=640x360:d=1",
                "-pix_fmt","yuv420p","docs/static/videos/teaser.mp4"], check=True)
PY
```

Reload. Expected: the dashed panel is gone and a black video player with controls is in its place. Then delete the dummy so the repo ships no fake media:

```bash
rm -f docs/static/videos/teaser.mp4
```

Reload once more and confirm the "Video coming soon" panel is back. If `ffmpeg` is not installed, skip this step — the fallback path was already proven in Step 5.

- [ ] **Step 7: Commit**

```bash
git add docs/index.html docs/static/css/index.css docs/static/js/index.js
git commit -m "feat: add hero, teaser slot, and video placeholder fallback"
```

---

### Task 4: Abstract, Motivation, and Architecture

**Files:**
- Modify: `docs/index.html` (`#abstract`, `#motivation`, `#architecture`)
- Modify: `docs/static/css/index.css` (append)

**Interfaces:**
- Consumes: `.figure` / `.figure-caption` (Task 1), the figure PNGs (Task 2).
- Produces: nothing later tasks depend on.

Section order on the page is Abstract → Motivation → Architecture, matching the skeleton.

- [ ] **Step 1: Write the Abstract section**

Replace `<section class="section" id="abstract"></section>` with the paper's abstract, verbatim:

```html
  <section class="section" id="abstract">
    <div class="container is-max-desktop">
      <h2 class="title is-3 section-heading has-text-centered">Abstract</h2>
      <div class="content is-medium">
        <p>
          Proactive robot assistance requires acting on user needs before explicit requests, but
          zero-shot vision-language models struggle in this setting: lacking knowledge of the user's
          personal routine, they treat every situation as general and uncertain, defaulting to
          inaction rather than risking an incorrect intervention. We observe that everyday routines
          are highly repetitive, so even a few interactions reveal stable user-specific patterns that
          can ground proactive decisions. Based on this, we propose a System 1&ndash;2 framework in
          which a VLM task predictor reads a Procedural Assistance Memory (PAM) alongside the current
          observation to decide when and how to assist, and a VLA executor realizes the predicted
          task as low-level robot action. PAM is structured as a finite-state machine over activity
          phases, per-state assistance rules, and event-driven transitions; a reflection VLM revises
          PAM from each day's interaction trace without weight updates or retraining. We evaluate on
          a multi-day desk-assistance scenario with six pick-and-place tasks. Memory-free baselines
          remain conservative across all five evaluation days, yielding near-zero recall on proactive
          tasks. Our system improves consistently with accumulated experience, achieving the highest
          precision, recall, and F1 and reducing first-fire delay from approximately 5 seconds on
          Day 1 to 1 second by Day 5. Ablations further show that the FSM structure, rather than
          memory alone, is the primary driver of these gains.
        </p>
      </div>
    </div>
  </section>
```

- [ ] **Step 2: Write the Motivation section**

Replace `<section class="section" id="motivation"></section>` with:

```html
  <section class="section" id="motivation">
    <div class="container is-max-desktop">
      <h2 class="title is-3 section-heading has-text-centered">The same scene, a different right answer</h2>
      <div class="figure">
        <img src="static/images/fig1_motivation.png"
             alt="Three ways to respond to a person arriving at a desk with a bowl: explicit command, intention prediction, and memory-based prediction.">
      </div>
      <div class="content is-medium" style="margin-top: 1.5rem;">
        <p>
          A person sits down with an empty bowl. Oatmeal? Cereal? Yogurt? Nothing in the scene
          settles it &mdash; the answer lives in the user's habits, not in the pixels. A zero-shot
          VLM, unable to tell which of several plausible interventions is the right one, does the
          safe thing and does nothing. That conservatism is why memory-free baselines score
          near-zero recall on every proactive task, on every one of the five evaluation days.
        </p>
        <p>
          The missing information is learnable, and cheaply. Everyday routines repeat, so a handful
          of days of watching one person is enough to fix what "a bowl on the desk" means for
          <em>this</em> person. PAM accumulates exactly that, at deployment time, with no weight
          updates.
        </p>
      </div>
    </div>
  </section>
```

- [ ] **Step 3: Write the Architecture section**

Replace `<section class="section" id="architecture"></section>` with:

```html
  <section class="section" id="architecture">
    <div class="container is-max-desktop">
      <h2 class="title is-3 section-heading has-text-centered">Architecture</h2>
      <div class="figure">
        <img src="static/images/fig2_overview.png"
             alt="Overview: a VLM task predictor reads PAM and recent frames to set a task for the VLA executor; a reflector updates PAM at the end of each day.">
      </div>
      <div class="content is-medium" style="margin-top: 1.5rem;">
        <p>
          <strong>System 1&ndash;2, split.</strong> Once per second, a Qwen3.5-27B task predictor
          (thinking off) reads the PAM memory together with the last <em>W</em> = 5 frames and emits
          either a language subtask &mdash; <em>"bring milk"</em> &mdash; or <code>NO_ACT</code>.
          Anything that is not <code>NO_ACT</code> goes to a &pi;<sub>0.5</sub> executor fine-tuned
          on the six atomic skills, which turns it into robot action. Neither model has to do the
          other's job, which is exactly the failure mode of a monolithic VLA under limited robot
          data.
        </p>
        <p>
          <strong>The memory writes itself.</strong> At the end of each day, a reflector &mdash; the
          same backbone, thinking on &mdash; watches the day's recording and rewrites PAM: adding
          the assistive opportunities the robot missed, broadening triggers that fired too late,
          introducing new states, and revising rules that no longer match what the user does. No
          gradients, no retraining, no human writing rules.
        </p>
      </div>
      <div class="figure" style="margin-top: 2.5rem; max-width: 800px;">
        <img src="static/images/fig9_cameras.png"
             alt="Camera setup: two back-facing cameras observe the user and the desk; a wrist camera provides close-up grasp context.">
        <p class="figure-caption">
          A Franka Research 3 arm and three RealSense cameras. The VLM stack sees only the two
          back-facing views; the VLA additionally sees the wrist camera.
        </p>
      </div>
    </div>
  </section>
```

- [ ] **Step 4: Alternate the section backgrounds**

Append to `docs/static/css/index.css`:

```css
#abstract,
#tasks,
#results,
#generalization {
  background: var(--pam-bg-alt);
}
```

- [ ] **Step 5: Verify**

Serve `docs/` and reload. Expected: three sections render in order, the two figure images load (no broken-image icons), and the console shows no 404 for either PNG. Confirm the Abstract sits on a light-gray band and Motivation on white.

- [ ] **Step 6: Commit**

```bash
git add docs/index.html docs/static/css/index.css
git commit -m "feat: add abstract, motivation, and architecture sections"
```

---

### Task 5: Proactive Tasks video grid

**Files:**
- Modify: `docs/index.html` (`#tasks`)
- Modify: `docs/static/css/index.css` (append)

**Interfaces:**
- Consumes: the `.video-slot` markup contract from Task 3.
- Produces: nothing later tasks depend on.

The six captions are the atomic instructions from the paper's Appendix A.3, verbatim.

- [ ] **Step 1: Write the section**

Replace `<section class="section" id="tasks"></section>` with:

```html
  <section class="section" id="tasks">
    <div class="container is-max-widescreen">
      <h2 class="title is-3 section-heading has-text-centered">Six Proactive Tasks</h2>
      <p class="content is-medium has-text-centered" style="max-width: 760px; margin: 0 auto 2rem;">
        The six tasks form one continuous desk routine. The robot is never told which one to do, or
        when &mdash; it is given a single fixed prompt, <em>"Proactively help the user before they
        ask."</em>, and must decide the rest.
      </p>

      <div class="task-grid">
        <div class="task-card">
          <div class="video-slot">
            <video controls playsinline preload="metadata" src="static/videos/t1_cereal_to_person.mp4"></video>
            <div class="video-slot__fallback"><span>Video coming soon</span></div>
          </div>
          <p class="task-card__label"><strong>T1 &middot; Cereal &rarr; Person</strong></p>
          <p class="task-card__caption">Pick up the cereal and place it next to the person.</p>
        </div>

        <div class="task-card">
          <div class="video-slot">
            <video controls playsinline preload="metadata" src="static/videos/t2_milk_to_person.mp4"></video>
            <div class="video-slot__fallback"><span>Video coming soon</span></div>
          </div>
          <p class="task-card__label"><strong>T2 &middot; Milk &rarr; Person</strong></p>
          <p class="task-card__caption">Pick up the milk and place it next to the person.</p>
        </div>

        <div class="task-card">
          <div class="video-slot">
            <video controls playsinline preload="metadata" src="static/videos/t3_cereal_to_storage.mp4"></video>
            <div class="video-slot__fallback"><span>Video coming soon</span></div>
          </div>
          <p class="task-card__label"><strong>T3 &middot; Cereal &rarr; Storage</strong></p>
          <p class="task-card__caption">Pick up the cereal and place it in the designated storage area.</p>
        </div>

        <div class="task-card">
          <div class="video-slot">
            <video controls playsinline preload="metadata" src="static/videos/t4_milk_to_storage.mp4"></video>
            <div class="video-slot__fallback"><span>Video coming soon</span></div>
          </div>
          <p class="task-card__label"><strong>T4 &middot; Milk &rarr; Storage</strong></p>
          <p class="task-card__caption">Pick up the milk and place it in the designated storage area.</p>
        </div>

        <div class="task-card">
          <div class="video-slot">
            <video controls playsinline preload="metadata" src="static/videos/t5_bowl_to_storage.mp4"></video>
            <div class="video-slot__fallback"><span>Video coming soon</span></div>
          </div>
          <p class="task-card__label"><strong>T5 &middot; Bowl &rarr; Storage</strong></p>
          <p class="task-card__caption">Pick up the bowl and place it in the designated storage area.</p>
        </div>

        <div class="task-card">
          <div class="video-slot">
            <video controls playsinline preload="metadata" src="static/videos/t6_wipe_to_trash.mp4"></video>
            <div class="video-slot__fallback"><span>Video coming soon</span></div>
          </div>
          <p class="task-card__label"><strong>T6 &middot; Used wet wipe &rarr; Trash</strong></p>
          <p class="task-card__caption">Pick up the used wet wipe and place it in the trash can.</p>
        </div>
      </div>
    </div>
  </section>
```

- [ ] **Step 2: Style the grid**

Append to `docs/static/css/index.css`:

```css
.task-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

.task-card__label {
  margin-top: 0.75rem;
}

.task-card__caption {
  color: var(--pam-gray);
  font-size: 0.9rem;
}

@media (max-width: 1023px) {
  .task-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 640px) {
  .task-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 3: Verify**

Serve and reload. Expected: six "Video coming soon" panels in a 3&times;2 grid, each with its T-label and instruction. Narrow the window below 1024px and confirm it becomes 2 columns, and below 640px a single column, with no horizontal page scrollbar at any width.

- [ ] **Step 4: Commit**

```bash
git add docs/index.html docs/static/css/index.css
git commit -m "feat: add the six-task video grid"
```

---

### Task 6: Transcribe the FSM memory and validate it

**Files:**
- Create: `docs/static/data/pam-fsm.json`
- Create: `tools/validate_fsm.py`

**Interfaces:**
- Consumes: nothing.
- Produces: **the data contract Task 7 renders.** Shape:

```
{ days: [ { id, label, caption, states, transitions, rules } ] }
  states:      [ { id, desc, isNew } ]
  transitions: [ { from, to, label, isNew } ]
  rules:       { <stateId>: [ { triggers: [ {text, isNew} ], action, isNew, isRevised } ] }
```

`isNew` means "introduced by the reflection at the end of the previous day, i.e. new on this day". `isRevised` is used only on the routine-change day, where an existing rule's **action** was rewritten. Each day carries the **full** memory as of that day, not a diff — the renderer never has to accumulate state.

This is the highest-risk task in the plan: the content is hand-transcribed from the paper, and a wrong trigger will look perfectly plausible on the page. The validator exists to catch structural transcription errors; Step 4 catches the rest by reading it against the figures.

- [ ] **Step 1: Write the data file**

Create `docs/static/data/pam-fsm.json`. Text is verbatim from Fig. 12 (Days 1–4), Fig. 13 (Day 5), Fig. 7 (routine change).

```json
{
  "days": [
    {
      "id": "day1",
      "label": "Day 1",
      "caption": "The first reflection installs the skeleton: four states and two rules — bring the cereal, put the bowl away.",
      "states": [
        {"id": "meal_preparation", "desc": "Person is gathering ingredients and preparing food.", "isNew": true},
        {"id": "eating", "desc": "Person is consuming the meal.", "isNew": true},
        {"id": "working", "desc": "Person is working on the laptop.", "isNew": true},
        {"id": "leaving", "desc": "Person is leaving the desk.", "isNew": true}
      ],
      "transitions": [
        {"from": "meal_preparation", "to": "eating", "label": "Person picks up a spoon", "isNew": true},
        {"from": "eating", "to": "working", "label": "Person starts typing", "isNew": true},
        {"from": "working", "to": "leaving", "label": "Person closes laptop", "isNew": true}
      ],
      "rules": {
        "meal_preparation": [
          {"triggers": [{"text": "Person places a bowl on the desk", "isNew": true}],
           "action": "Pick up the cereal bag and place it next to the person.", "isNew": true}
        ],
        "eating": [
          {"triggers": [{"text": "Person opens laptop", "isNew": true}],
           "action": "Pick up the empty bowl and place it in the designated storage area.", "isNew": true}
        ],
        "working": [],
        "leaving": []
      }
    },
    {
      "id": "day2",
      "label": "Day 2",
      "caption": "The bring-milk rule appears, and the bring-cereal trigger broadens: sitting down is enough, the bowl need not be on the desk yet.",
      "states": [
        {"id": "meal_preparation", "desc": "Person is gathering ingredients and preparing food.", "isNew": false},
        {"id": "eating", "desc": "Person is consuming the meal.", "isNew": false},
        {"id": "working", "desc": "Person is working on the laptop.", "isNew": false},
        {"id": "leaving", "desc": "Person is leaving the desk.", "isNew": false}
      ],
      "transitions": [
        {"from": "meal_preparation", "to": "eating", "label": "Person picks up a spoon", "isNew": false},
        {"from": "eating", "to": "working", "label": "Person starts typing", "isNew": false},
        {"from": "working", "to": "leaving", "label": "Person closes laptop", "isNew": false}
      ],
      "rules": {
        "meal_preparation": [
          {"triggers": [
             {"text": "Person places a bowl on the desk", "isNew": false},
             {"text": "Person sits down at the desk", "isNew": true}
           ],
           "action": "Pick up the cereal bag and place it next to the person.", "isNew": false},
          {"triggers": [{"text": "Person pours cereal into the bowl", "isNew": true}],
           "action": "Pick up the milk bottle and place it next to the person.", "isNew": true}
        ],
        "eating": [
          {"triggers": [{"text": "Person opens laptop", "isNew": false}],
           "action": "Pick up the empty bowl and place it in the designated storage area.", "isNew": false}
        ],
        "working": [],
        "leaving": []
      }
    },
    {
      "id": "day3",
      "label": "Day 3",
      "caption": "Both put-away rules arrive. Neither can trigger on the object it moves, so the reflector fires them on the user reaching for the next ingredient instead.",
      "states": [
        {"id": "meal_preparation", "desc": "Person is gathering ingredients and preparing food.", "isNew": false},
        {"id": "eating", "desc": "Person is consuming the meal.", "isNew": false},
        {"id": "working", "desc": "Person is working on the laptop.", "isNew": false},
        {"id": "leaving", "desc": "Person is leaving the desk.", "isNew": false}
      ],
      "transitions": [
        {"from": "meal_preparation", "to": "eating", "label": "Person picks up a spoon", "isNew": false},
        {"from": "eating", "to": "working", "label": "Person starts typing", "isNew": false},
        {"from": "working", "to": "leaving", "label": "Person closes laptop", "isNew": false}
      ],
      "rules": {
        "meal_preparation": [
          {"triggers": [
             {"text": "Person places a bowl on the desk", "isNew": false},
             {"text": "Person sits down at the desk", "isNew": false}
           ],
           "action": "Pick up the cereal bag and place it next to the person.", "isNew": false},
          {"triggers": [
             {"text": "Person pours cereal into the bowl", "isNew": false},
             {"text": "Person places the cereal bag on the desk", "isNew": true}
           ],
           "action": "Pick up the milk bottle and place it next to the person.", "isNew": false},
          {"triggers": [{"text": "Person reaches for the milk bottle", "isNew": true}],
           "action": "Pick up the cereal bag and place it in the designated storage area.", "isNew": true},
          {"triggers": [{"text": "Person picks up a spoon", "isNew": true}],
           "action": "Pick up the milk bottle and place it in the designated storage area.", "isNew": true}
        ],
        "eating": [
          {"triggers": [
             {"text": "Person opens laptop", "isNew": false},
             {"text": "Person puts down the spoon", "isNew": true}
           ],
           "action": "Pick up the empty bowl and place it in the designated storage area.", "isNew": false}
        ],
        "working": [],
        "leaving": []
      }
    },
    {
      "id": "day4",
      "label": "Day 4",
      "caption": "A new cleaning_break state appears with the wet-wipe rule, looping out of and back into working. Both put-away triggers broaden again.",
      "states": [
        {"id": "meal_preparation", "desc": "Person is gathering ingredients and preparing food.", "isNew": false},
        {"id": "eating", "desc": "Person is consuming the meal.", "isNew": false},
        {"id": "working", "desc": "Person is working on the laptop.", "isNew": false},
        {"id": "cleaning_break", "desc": "Person is cleaning hands after eating.", "isNew": true},
        {"id": "leaving", "desc": "Person is leaving the desk.", "isNew": false}
      ],
      "transitions": [
        {"from": "meal_preparation", "to": "eating", "label": "Person picks up a spoon", "isNew": false},
        {"from": "eating", "to": "working", "label": "Person starts typing", "isNew": false},
        {"from": "working", "to": "cleaning_break", "label": "Person reaches for wet wipes", "isNew": true},
        {"from": "cleaning_break", "to": "working", "label": "Person types on the laptop", "isNew": true},
        {"from": "working", "to": "leaving", "label": "Person closes laptop", "isNew": false}
      ],
      "rules": {
        "meal_preparation": [
          {"triggers": [
             {"text": "Person places a bowl on the desk", "isNew": false},
             {"text": "Person sits down at the desk", "isNew": false}
           ],
           "action": "Pick up the cereal bag and place it next to the person.", "isNew": false},
          {"triggers": [
             {"text": "Person pours cereal into the bowl", "isNew": false},
             {"text": "Person places the cereal bag on the desk", "isNew": false}
           ],
           "action": "Pick up the milk bottle and place it next to the person.", "isNew": false},
          {"triggers": [
             {"text": "Person reaches for the milk bottle", "isNew": false},
             {"text": "Person finishes pouring cereal", "isNew": true}
           ],
           "action": "Pick up the cereal bag and place it in the designated storage area.", "isNew": false},
          {"triggers": [
             {"text": "Person picks up a spoon", "isNew": false},
             {"text": "Person finishes pouring milk", "isNew": true}
           ],
           "action": "Pick up the milk bottle and place it in the designated storage area.", "isNew": false}
        ],
        "eating": [
          {"triggers": [
             {"text": "Person opens laptop", "isNew": false},
             {"text": "Person puts down the spoon", "isNew": false}
           ],
           "action": "Pick up the empty bowl and place it in the designated storage area.", "isNew": false}
        ],
        "working": [],
        "cleaning_break": [
          {"triggers": [{"text": "Person starts typing", "isNew": true}],
           "action": "Pick up the used wet wipe and place it in the trash can.", "isNew": true}
        ],
        "leaving": []
      }
    },
    {
      "id": "day5",
      "label": "Day 5",
      "caption": "No new rules and no new states. The reflector only finishes broadening the remaining triggers, so the robot fires earlier — first-fire delay is down to about one second.",
      "states": [
        {"id": "meal_preparation", "desc": "Person is gathering ingredients and preparing food.", "isNew": false},
        {"id": "eating", "desc": "Person is consuming the meal.", "isNew": false},
        {"id": "working", "desc": "Person is working on the laptop.", "isNew": false},
        {"id": "cleaning_break", "desc": "Person is cleaning hands after eating.", "isNew": false},
        {"id": "leaving", "desc": "Person is leaving the desk.", "isNew": false}
      ],
      "transitions": [
        {"from": "meal_preparation", "to": "eating", "label": "Person picks up a spoon", "isNew": false},
        {"from": "eating", "to": "working", "label": "Person starts typing", "isNew": false},
        {"from": "working", "to": "cleaning_break", "label": "Person reaches for wet wipes", "isNew": false},
        {"from": "cleaning_break", "to": "working", "label": "Person types on the laptop", "isNew": false},
        {"from": "working", "to": "leaving", "label": "Person closes laptop", "isNew": false}
      ],
      "rules": {
        "meal_preparation": [
          {"triggers": [
             {"text": "Person places a bowl on the desk", "isNew": false},
             {"text": "Person sits down at the desk", "isNew": false}
           ],
           "action": "Pick up the cereal bag and place it next to the person.", "isNew": false},
          {"triggers": [
             {"text": "Person pours cereal into the bowl", "isNew": false},
             {"text": "Person places the cereal bag on the desk", "isNew": false}
           ],
           "action": "Pick up the milk bottle and place it next to the person.", "isNew": false},
          {"triggers": [
             {"text": "Person reaches for the milk bottle", "isNew": false},
             {"text": "Person finishes pouring cereal", "isNew": false},
             {"text": "Person places the cereal bag on the desk", "isNew": true}
           ],
           "action": "Pick up the cereal bag and place it in the designated storage area.", "isNew": false},
          {"triggers": [
             {"text": "Person picks up a spoon", "isNew": false},
             {"text": "Person finishes pouring milk", "isNew": false},
             {"text": "Person places the milk bottle on the desk", "isNew": true}
           ],
           "action": "Pick up the milk bottle and place it in the designated storage area.", "isNew": false}
        ],
        "eating": [
          {"triggers": [
             {"text": "Person opens laptop", "isNew": false},
             {"text": "Person puts down the spoon", "isNew": false},
             {"text": "Person places the empty bowl on the desk", "isNew": true}
           ],
           "action": "Pick up the empty bowl and place it in the designated storage area.", "isNew": false}
        ],
        "working": [],
        "cleaning_break": [
          {"triggers": [
             {"text": "Person starts typing", "isNew": false},
             {"text": "Person finishes wiping", "isNew": true},
             {"text": "Person places the used wet wipe on the desk", "isNew": true}
           ],
           "action": "Pick up the used wet wipe and place it in the trash can.", "isNew": false}
        ],
        "leaving": []
      }
    },
    {
      "id": "routine-change",
      "label": "Routine Change",
      "caption": "The user starts taking medication before eating. The reflector does not append a rule — it rewrites one: sitting down now means deliver the pill, and the cereal moves behind it.",
      "states": [
        {"id": "meal_preparation", "desc": "Person is gathering ingredients and preparing food.", "isNew": false},
        {"id": "eating", "desc": "Person is consuming the meal.", "isNew": false},
        {"id": "working", "desc": "Person is working on the laptop.", "isNew": false},
        {"id": "cleaning_break", "desc": "Person is cleaning hands after eating.", "isNew": false},
        {"id": "leaving", "desc": "Person is leaving the desk.", "isNew": false}
      ],
      "transitions": [
        {"from": "meal_preparation", "to": "eating", "label": "Person picks up a spoon", "isNew": false},
        {"from": "eating", "to": "working", "label": "Person starts typing", "isNew": false},
        {"from": "working", "to": "cleaning_break", "label": "Person reaches for wet wipes", "isNew": false},
        {"from": "cleaning_break", "to": "working", "label": "Person types on the laptop", "isNew": false},
        {"from": "working", "to": "leaving", "label": "Person closes laptop", "isNew": false}
      ],
      "rules": {
        "meal_preparation": [
          {"triggers": [
             {"text": "Person places a bowl on the desk", "isNew": false},
             {"text": "Person sits down at the desk", "isNew": false}
           ],
           "action": "Pick up the pill and place it next to the person.", "isNew": false, "isRevised": true,
           "wasAction": "Pick up the cereal bag and place it next to the person."},
          {"triggers": [{"text": "Person picks up the pill", "isNew": true}],
           "action": "Pick up the cereal bag and place it next to the person.", "isNew": true},
          {"triggers": [
             {"text": "Person pours cereal into the bowl", "isNew": false},
             {"text": "Person places the cereal bag on the desk", "isNew": false}
           ],
           "action": "Pick up the milk bottle and place it next to the person.", "isNew": false},
          {"triggers": [
             {"text": "Person reaches for the milk bottle", "isNew": false},
             {"text": "Person finishes pouring cereal", "isNew": false},
             {"text": "Person places the cereal bag on the desk", "isNew": false}
           ],
           "action": "Pick up the cereal bag and place it in the designated storage area.", "isNew": false},
          {"triggers": [
             {"text": "Person picks up a spoon", "isNew": false},
             {"text": "Person finishes pouring milk", "isNew": false},
             {"text": "Person places the milk bottle on the desk", "isNew": false}
           ],
           "action": "Pick up the milk bottle and place it in the designated storage area.", "isNew": false}
        ],
        "eating": [
          {"triggers": [
             {"text": "Person opens laptop", "isNew": false},
             {"text": "Person puts down the spoon", "isNew": false},
             {"text": "Person places the empty bowl on the desk", "isNew": false}
           ],
           "action": "Pick up the empty bowl and place it in the designated storage area.", "isNew": false}
        ],
        "working": [],
        "cleaning_break": [
          {"triggers": [
             {"text": "Person starts typing", "isNew": false},
             {"text": "Person finishes wiping", "isNew": false},
             {"text": "Person places the used wet wipe on the desk", "isNew": false}
           ],
           "action": "Pick up the used wet wipe and place it in the trash can.", "isNew": false}
        ],
        "leaving": []
      }
    }
  ]
}
```

- [ ] **Step 2: Write the validator**

Create `tools/validate_fsm.py`. These assertions encode invariants that a transcription slip would violate.

```python
"""Structural checks on docs/static/data/pam-fsm.json.

Catches transcription errors that would otherwise render as plausible-looking
but wrong rules on the page.
"""
import json
import pathlib
import sys

DATA = pathlib.Path("docs/static/data/pam-fsm.json")
DAY_IDS = ["day1", "day2", "day3", "day4", "day5", "routine-change"]

errors: list[str] = []


def check(cond: bool, msg: str) -> None:
    if not cond:
        errors.append(msg)


def rule_key(rule: dict) -> str:
    """A rule's identity is its action - the reflector broadens triggers, but
    an action string is stable across days."""
    return rule["action"]


def main() -> int:
    days = json.loads(DATA.read_text())["days"]
    check([d["id"] for d in days] == DAY_IDS, f"day ids must be {DAY_IDS}")

    by_id = {d["id"]: d for d in days}

    for day in days:
        ids = [s["id"] for s in day["states"]]
        check(len(ids) == len(set(ids)), f"{day['id']}: duplicate state id")
        check(set(day["rules"]) == set(ids),
              f"{day['id']}: rules keys {sorted(day['rules'])} != states {sorted(ids)}")
        for t in day["transitions"]:
            check(t["from"] in ids, f"{day['id']}: transition from unknown state {t['from']}")
            check(t["to"] in ids, f"{day['id']}: transition to unknown state {t['to']}")
        for state, rules in day["rules"].items():
            for r in rules:
                check(bool(r["triggers"]), f"{day['id']}/{state}: rule with no trigger")
                check(r["action"].endswith("."), f"{day['id']}/{state}: action missing period")

    # Days 1-5 are monotone: the memory only ever grows. A rule or trigger that
    # disappears means a line was dropped in transcription.
    for prev_id, cur_id in zip(DAY_IDS[:-2], DAY_IDS[1:-1]):
        prev, cur = by_id[prev_id], by_id[cur_id]
        check(set(s["id"] for s in prev["states"]) <= set(s["id"] for s in cur["states"]),
              f"{cur_id}: lost a state that existed on {prev_id}")
        for state, prev_rules in prev["rules"].items():
            cur_rules = {rule_key(r): r for r in cur["rules"].get(state, [])}
            for pr in prev_rules:
                key = rule_key(pr)
                check(key in cur_rules, f"{cur_id}/{state}: lost rule '{key}' from {prev_id}")
                if key not in cur_rules:
                    continue
                prev_triggers = [t["text"] for t in pr["triggers"]]
                cur_triggers = [t["text"] for t in cur_rules[key]["triggers"]]
                check(cur_triggers[:len(prev_triggers)] == prev_triggers,
                      f"{cur_id}/{state}/'{key}': existing triggers changed or reordered")

    # isNew must mean "not present on the previous day".
    for prev_id, cur_id in zip(DAY_IDS[:-2], DAY_IDS[1:-1]):
        prev, cur = by_id[prev_id], by_id[cur_id]
        prev_states = {s["id"] for s in prev["states"]}
        for s in cur["states"]:
            check(s["isNew"] == (s["id"] not in prev_states),
                  f"{cur_id}: state {s['id']} isNew={s['isNew']} contradicts {prev_id}")
        for state, rules in cur["rules"].items():
            prev_keys = {rule_key(r) for r in prev["rules"].get(state, [])}
            prev_trigs = {rule_key(r): {t["text"] for t in r["triggers"]}
                          for r in prev["rules"].get(state, [])}
            for r in rules:
                key = rule_key(r)
                check(r["isNew"] == (key not in prev_keys),
                      f"{cur_id}/{state}: rule '{key}' isNew={r['isNew']} contradicts {prev_id}")
                for t in r["triggers"]:
                    was_there = t["text"] in prev_trigs.get(key, set())
                    check(t["isNew"] == (not was_there),
                          f"{cur_id}/{state}/'{key}': trigger '{t['text']}' "
                          f"isNew={t['isNew']} contradicts {prev_id}")

    # Day 1 is the memory's birth: everything on it is new.
    d1 = by_id["day1"]
    check(all(s["isNew"] for s in d1["states"]), "day1: every state must be isNew")
    check(all(t["isNew"] for t in d1["transitions"]), "day1: every transition must be isNew")

    # Day 5 introduces no new rules and no new states (paper, Appendix C.1).
    d5 = by_id["day5"]
    check(not any(s["isNew"] for s in d5["states"]), "day5: must introduce no new state")
    check(not any(r["isNew"] for rs in d5["rules"].values() for r in rs),
          "day5: must introduce no new rule")

    # The routine change is a rewrite, not an append.
    rc = by_id["routine-change"]
    revised = [r for rs in rc["rules"].values() for r in rs if r.get("isRevised")]
    check(len(revised) == 1, "routine-change: expected exactly one revised rule")
    for r in revised:
        check("wasAction" in r, "routine-change: a revised rule must carry wasAction")

    if errors:
        for e in errors:
            print(f"FAIL  {e}")
        print(f"\n{len(errors)} problem(s)")
        return 1
    print(f"OK  {len(days)} days, all invariants hold")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 3: Run the validator**

```bash
cd /home/nas_main/minhopark/repos/PAM && python3 tools/validate_fsm.py
```

Expected: `OK  6 days, all invariants hold`. If it fails, the JSON is wrong — fix the JSON, not the validator. (The one exception: `routine-change` is deliberately excluded from the monotonicity checks, because it is a rewrite of the Day-5 memory rather than a sixth day of growth.)

- [ ] **Step 4: Read the data against the paper**

The validator proves the data is *self-consistent*; it cannot prove it *matches the paper*. Open `PAM.pdf` to Fig. 12 (p. 19), Fig. 13 (p. 20), and Fig. 7 (p. 8), and read each day's triggers and actions against the JSON, line by line. Every string must match character-for-character. This is the step that catches a dropped `or`-clause.

- [ ] **Step 5: Commit**

```bash
git add docs/static/data/pam-fsm.json tools/validate_fsm.py
git commit -m "feat: transcribe the five-day FSM memory with a structural validator"
```

---

### Task 7: The Memory Evolution section

**Files:**
- Modify: `docs/index.html` (`#memory-evolution`)
- Create: `docs/static/js/memory-evolution.js`
- Modify: `docs/static/css/index.css` (append)

**Interfaces:**
- Consumes: `docs/static/data/pam-fsm.json` (Task 6), `static/images/fig7_memory_evolution.png` (Task 2).
- Produces: nothing later tasks depend on.

Layout: a day selector across the top; below it, the FSM graph on the left and the selected state's rules on the right. State positions are hard-coded in the SVG — there are five nodes, a layout engine would be dead weight.

- [ ] **Step 1: Write the section markup**

Replace `<section class="section" id="memory-evolution"></section>` with:

```html
  <section class="section" id="memory-evolution">
    <div class="container is-max-widescreen">
      <h2 class="title is-3 section-heading has-text-centered">Watch the Memory Write Itself</h2>
      <p class="content is-medium has-text-centered" style="max-width: 820px; margin: 0 auto 2rem;">
        Every night, the reflector watches the day's recording and edits PAM. Step through the days
        to see what it changed. <span class="fsm-legend-swatch"></span> marks what the reflection at
        the end of the previous day added.
      </p>

      <div class="fsm" id="fsm" hidden>
        <div class="fsm__days" id="fsm-days" role="tablist" aria-label="Day"></div>
        <p class="fsm__caption" id="fsm-caption"></p>

        <div class="fsm__panes">
          <div class="fsm__graph">
            <svg id="fsm-svg" viewBox="0 0 460 560" role="img" aria-label="Finite-state machine of the user's routine"></svg>
          </div>
          <div class="fsm__rules" id="fsm-rules"></div>
        </div>
      </div>

      <div class="figure" id="fsm-fallback">
        <img src="static/images/fig7_memory_evolution.png"
             alt="The FSM memory on Day 3, Day 5, and after a routine change.">
        <p class="figure-caption">
          The interactive view could not load, so here is the same content as it appears in the
          paper (Fig. 7).
        </p>
      </div>
    </div>
  </section>
```

The static figure is visible by default and the interactive view is `hidden`; the script swaps them once the data has loaded. If the fetch fails, the visitor simply sees the paper's figure and never knows anything was meant to happen.

- [ ] **Step 2: Write the renderer**

Create `docs/static/js/memory-evolution.js`.

```js
// Renders one day of the PAM FSM: a fixed-layout SVG graph plus the rules of
// the selected state. Everything is driven by static/data/pam-fsm.json.

const SVG_NS = 'http://www.w3.org/2000/svg';

// Hard-coded layout. Five states down the left spine; cleaning_break sits to
// the right of `working`, which is the loop it belongs to.
const NODE_W = 230;
const NODE_H = 62;
const POS = {
  meal_preparation: { x: 20, y: 20 },
  eating: { x: 20, y: 140 },
  working: { x: 20, y: 260 },
  cleaning_break: { x: 20, y: 380 },
  leaving: { x: 20, y: 480 },
};

function el(name, attrs = {}, text = null) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== null) node.textContent = text;
  return node;
}

function centerOf(id) {
  const p = POS[id];
  return { x: p.x + NODE_W / 2, y: p.y + NODE_H / 2 };
}

function drawGraph(svg, day, selectedState, onSelect) {
  svg.replaceChildren();
  const present = new Set(day.states.map((s) => s.id));

  // Edges first, so nodes paint over them.
  for (const t of day.transitions) {
    if (!present.has(t.from) || !present.has(t.to)) continue;
    const a = centerOf(t.from);
    const b = centerOf(t.to);
    const cls = `fsm-edge${t.isNew ? ' is-new' : ''}`;

    // A back-edge (cleaning_break -> working) bows out to the right so it does
    // not sit on top of the forward edge.
    const isBackEdge = POS[t.to].y < POS[t.from].y;
    const bow = isBackEdge ? 70 : 0;
    const path = bow
      ? `M ${a.x} ${a.y} C ${a.x + NODE_W / 2 + bow} ${a.y}, `
        + `${b.x + NODE_W / 2 + bow} ${b.y}, ${b.x} ${b.y}`
      : `M ${a.x} ${a.y} L ${b.x} ${b.y}`;

    svg.appendChild(el('path', { d: path, class: cls, fill: 'none', 'marker-end': 'url(#arrow)' }));

    const label = el('text', {
      x: (a.x + b.x) / 2 + (bow ? NODE_W / 2 + bow / 2 : 8),
      y: (a.y + b.y) / 2,
      class: `fsm-edge-label${t.isNew ? ' is-new' : ''}`,
      'text-anchor': 'start',
    }, t.label);
    svg.appendChild(label);
  }

  for (const s of day.states) {
    const p = POS[s.id];
    const g = el('g', {
      class: `fsm-node${s.isNew ? ' is-new' : ''}${s.id === selectedState ? ' is-selected' : ''}`,
      tabindex: '0',
      role: 'button',
      'aria-label': `${s.id}: ${s.desc}`,
    });
    g.appendChild(el('rect', { x: p.x, y: p.y, width: NODE_W, height: NODE_H, rx: 8 }));
    g.appendChild(el('text', { x: p.x + 14, y: p.y + 26, class: 'fsm-node-title' }, s.id));

    const ruleCount = (day.rules[s.id] || []).length;
    const sub = ruleCount === 0
      ? 'no rules'
      : `${ruleCount} rule${ruleCount > 1 ? 's' : ''}`;
    g.appendChild(el('text', { x: p.x + 14, y: p.y + 46, class: 'fsm-node-sub' }, sub));

    g.addEventListener('click', () => onSelect(s.id));
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(s.id); }
    });
    svg.appendChild(g);
  }

  const defs = el('defs');
  const marker = el('marker', {
    id: 'arrow', viewBox: '0 0 10 10', refX: '9', refY: '5',
    markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse',
  });
  marker.appendChild(el('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'fsm-arrowhead' }));
  defs.appendChild(marker);
  svg.prepend(defs);
}

function drawRules(container, day, stateId) {
  const state = day.states.find((s) => s.id === stateId);
  const rules = day.rules[stateId] || [];
  container.replaceChildren();

  const head = document.createElement('div');
  head.className = 'fsm-rules__head';
  head.innerHTML = `<h3>${stateId}</h3><p>${state ? state.desc : ''}</p>`;
  container.appendChild(head);

  if (rules.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'fsm-rules__empty';
    empty.textContent = 'No assistance rules in this state — the robot stays out of the way.';
    container.appendChild(empty);
    return;
  }

  for (const rule of rules) {
    const card = document.createElement('div');
    card.className = 'fsm-rule'
      + (rule.isNew ? ' is-new' : '')
      + (rule.isRevised ? ' is-revised' : '');

    const trig = document.createElement('p');
    trig.className = 'fsm-rule__triggers';
    trig.appendChild(document.createTextNode('when '));
    rule.triggers.forEach((t, i) => {
      if (i > 0) {
        const or = document.createElement('span');
        or.className = 'fsm-rule__or';
        or.textContent = ' or ';
        trig.appendChild(or);
      }
      const span = document.createElement('span');
      span.className = `fsm-rule__trigger${t.isNew ? ' is-new' : ''}`;
      span.textContent = t.text;
      trig.appendChild(span);
    });
    card.appendChild(trig);

    const act = document.createElement('p');
    act.className = 'fsm-rule__action';
    act.textContent = rule.action;
    card.appendChild(act);

    if (rule.isRevised && rule.wasAction) {
      const was = document.createElement('p');
      was.className = 'fsm-rule__was';
      was.textContent = `revised — previously: ${rule.wasAction}`;
      card.appendChild(was);
    }

    container.appendChild(card);
  }
}

// The state a day is "about": the one the reflector touched. Prefer a revised
// rule, then a new state, then a new rule; fall back to the first state.
function defaultState(day) {
  for (const [stateId, rules] of Object.entries(day.rules)) {
    if (rules.some((r) => r.isRevised)) return stateId;
  }
  const newState = day.states.find((s) => s.isNew);
  if (newState) return newState.id;
  for (const [stateId, rules] of Object.entries(day.rules)) {
    if (rules.some((r) => r.isNew)) return stateId;
  }
  return day.states[0].id;
}

async function setupMemoryEvolution() {
  const root = document.getElementById('fsm');
  const fallback = document.getElementById('fsm-fallback');
  if (!root) return;

  let data;
  try {
    const res = await fetch('static/data/pam-fsm.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
    if (!data.days || !data.days.length) throw new Error('no days in pam-fsm.json');
  } catch (err) {
    console.warn('Memory Evolution: falling back to the static figure.', err);
    return; // fallback figure is already on screen
  }

  const svg = document.getElementById('fsm-svg');
  const rules = document.getElementById('fsm-rules');
  const caption = document.getElementById('fsm-caption');
  const tabs = document.getElementById('fsm-days');

  let dayIndex = 0;
  let stateId = defaultState(data.days[0]);

  function render() {
    const day = data.days[dayIndex];
    if (!day.states.some((s) => s.id === stateId)) stateId = defaultState(day);

    caption.textContent = day.caption;
    drawGraph(svg, day, stateId, (id) => { stateId = id; render(); });
    drawRules(rules, day, stateId);

    [...tabs.children].forEach((btn, i) => {
      btn.classList.toggle('is-active', i === dayIndex);
      btn.setAttribute('aria-selected', String(i === dayIndex));
    });
  }

  data.days.forEach((day, i) => {
    const btn = document.createElement('button');
    btn.className = 'fsm__day';
    btn.type = 'button';
    btn.role = 'tab';
    btn.textContent = day.label;
    btn.addEventListener('click', () => {
      dayIndex = i;
      stateId = defaultState(data.days[i]);
      render();
    });
    tabs.appendChild(btn);
  });

  fallback.hidden = true;
  root.hidden = false;
  render();
}

document.addEventListener('DOMContentLoaded', setupMemoryEvolution);
```

- [ ] **Step 3: Load the script**

In `docs/index.html`, add the module after `index.js`:

```html
  <script src="static/js/index.js"></script>
  <script src="static/js/memory-evolution.js"></script>
```

- [ ] **Step 4: Style it**

Append to `docs/static/css/index.css`:

```css
/* --- memory evolution --- */
.fsm-legend-swatch {
  display: inline-block;
  width: 0.9em;
  height: 0.9em;
  border-radius: 3px;
  background: var(--pam-orange);
  vertical-align: -1px;
}

.fsm__days {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.fsm__day {
  background: #fff;
  border: 1px solid var(--pam-border);
  border-radius: 999px;
  color: var(--pam-gray);
  cursor: pointer;
  font-family: 'Google Sans', sans-serif;
  font-size: 0.95rem;
  padding: 0.5rem 1.1rem;
}

.fsm__day:hover {
  border-color: var(--pam-orange);
  color: var(--pam-orange);
}

.fsm__day.is-active {
  background: #202124;
  border-color: #202124;
  color: #fff;
}

.fsm__caption {
  color: var(--pam-gray);
  margin: 1.25rem auto 2rem;
  max-width: 760px;
  text-align: center;
}

.fsm__panes {
  display: grid;
  grid-template-columns: 460px 1fr;
  gap: 2rem;
  align-items: start;
}

.fsm__graph svg {
  width: 100%;
  height: auto;
}

.fsm-node rect {
  fill: #fff;
  stroke: var(--pam-border);
  stroke-width: 1.5;
}

.fsm-node { cursor: pointer; }
.fsm-node:focus { outline: none; }
.fsm-node:focus rect,
.fsm-node:hover rect { stroke: var(--pam-orange); }

.fsm-node.is-selected rect {
  fill: #f1f3f4;
  stroke: #202124;
  stroke-width: 2;
}

.fsm-node.is-new rect {
  fill: var(--pam-orange-soft);
  stroke: var(--pam-orange);
  stroke-width: 2;
}

.fsm-node-title {
  font-family: 'Google Sans', sans-serif;
  font-size: 15px;
  fill: #202124;
}

.fsm-node-sub {
  font-size: 12px;
  fill: var(--pam-gray);
}

.fsm-edge {
  stroke: var(--pam-border);
  stroke-width: 1.5;
}

.fsm-edge.is-new {
  stroke: var(--pam-orange);
  stroke-width: 2;
}

.fsm-arrowhead { fill: var(--pam-gray); }

.fsm-edge-label {
  font-size: 11px;
  fill: var(--pam-gray);
}

.fsm-edge-label.is-new { fill: var(--pam-orange); }

.fsm-rules__head h3 {
  font-family: 'Google Sans', sans-serif;
  font-size: 1.25rem;
}

.fsm-rules__head p {
  color: var(--pam-gray);
  margin-bottom: 1.25rem;
}

.fsm-rules__empty { color: var(--pam-gray); }

.fsm-rule {
  background: #fff;
  border: 1px solid var(--pam-border);
  border-left: 3px solid var(--pam-border);
  border-radius: 6px;
  margin-bottom: 0.85rem;
  padding: 0.85rem 1rem;
}

.fsm-rule.is-new,
.fsm-rule.is-revised {
  background: var(--pam-orange-soft);
  border-color: var(--pam-orange);
  border-left-color: var(--pam-orange);
}

.fsm-rule__triggers {
  color: var(--pam-gray);
  font-size: 0.92rem;
}

.fsm-rule__trigger.is-new {
  color: var(--pam-orange);
  font-weight: 600;
}

.fsm-rule__or { color: #9aa0a6; }

.fsm-rule__action {
  font-weight: 600;
  margin-top: 0.35rem;
}

.fsm-rule__was {
  color: var(--pam-orange);
  font-size: 0.85rem;
  margin-top: 0.35rem;
}

@media (max-width: 1023px) {
  .fsm__panes { grid-template-columns: 1fr; }
}
```

- [ ] **Step 5: Verify each day against the paper**

Serve `docs/` and open the section. Walk all six tabs and check, against Fig. 12 / 13 / 7:

- **Day 1** — four nodes, all orange. `meal_preparation` selected. One rule, orange: *when Person places a bowl on the desk → Pick up the cereal bag and place it next to the person.*
- **Day 2** — nothing orange in the graph. `meal_preparation` has two rules; the bring-milk card is fully orange, and on the bring-cereal card only *"Person sits down at the desk"* is orange while *"Person places a bowl on the desk"* stays gray. **This is the highlight rule that matters most — check it carefully.**
- **Day 3** — four rules in `meal_preparation`, the two put-away cards orange.
- **Day 4** — `cleaning_break` is an orange node, and the two edges to and from `working` are orange. Its one rule is orange.
- **Day 5** — nothing is orange except individual `or`-clauses inside existing triggers. No orange card anywhere. (If a whole card is orange on Day 5, the JSON is wrong — the validator's day-5 check should have caught it.)
- **Routine Change** — `meal_preparation` selected, five rules, the first one orange and reading *"revised — previously: Pick up the cereal bag and place it next to the person."* with the action now the pill.

Click a state on the left and confirm the right pane follows. Confirm zero console errors.

- [ ] **Step 6: Verify the fallback**

Temporarily break the fetch:

```bash
mv docs/static/data/pam-fsm.json docs/static/data/pam-fsm.json.bak
```

Reload. Expected: the interactive view is gone and Fig. 7 is shown in its place, with the caption explaining it. One `console.warn`, no uncaught error, and the rest of the page still works. Restore it:

```bash
mv docs/static/data/pam-fsm.json.bak docs/static/data/pam-fsm.json
```

- [ ] **Step 7: Commit**

```bash
git add docs/index.html docs/static/js/memory-evolution.js docs/static/css/index.css
git commit -m "feat: add the interactive memory evolution section"
```

---

### Task 8: Results and closed-loop comparison

**Files:**
- Modify: `docs/index.html` (`#results`, `#closed-loop`)
- Modify: `docs/static/css/index.css` (append)

**Interfaces:**
- Consumes: the `.video-slot` contract (Task 3), figures `fig5`, `fig10`, `fig11` (Task 2).
- Produces: nothing later tasks depend on.

Table 1's numbers are copied verbatim from the paper. Bold marks the best method per task, exactly as the paper does.

- [ ] **Step 1: Write the Results section**

Replace `<section class="section" id="results"></section>` with:

```html
  <section class="section" id="results">
    <div class="container is-max-desktop">
      <h2 class="title is-3 section-heading has-text-centered">Results</h2>

      <div class="figure">
        <img src="static/images/fig5_multiday.png"
             alt="Per-day precision, recall, F1, and first-fire delay for all methods across five days.">
        <p class="figure-caption">
          Memory-free baselines never move: with no knowledge of the routine they fall back on
          <code>NO_ACT</code>, and their recall on the six proactive tasks stays near zero for all
          five days. Our FSM memory climbs every day, and the robot fires sooner as it goes &mdash;
          first-fire delay falls from about 5 seconds on Day 1 to about 1 second by Day 5.
        </p>
      </div>

      <div class="figure" style="margin-top: 3rem;">
        <img src="static/images/fig11_selfevolving.png"
             alt="Self-evolving memory compared against a memory frozen after Day 1 and a zero-shot VLM.">
        <p class="figure-caption">
          Having a memory is not the point &mdash; keeping it up to date is. A memory frozen after
          Day 1 gains once, then tracks the zero-shot curve. Only the self-evolving memory keeps
          pulling away, and the gap widens with every day of reflection.
        </p>
      </div>

      <div class="figure" style="margin-top: 3rem;">
        <img src="static/images/fig10_pertask.png"
             alt="Per-task precision, recall, and F1 for every method.">
        <p class="figure-caption">
          Memory helps most exactly where the scene is not enough: T2 (Milk&rarr;Person) and T3
          (Cereal&rarr;Storage), where what to do next depends on this user's habitual pairing rather
          than on anything visible. The FSM's lead over a flat list is largest on the put-away
          actions, which must fire within a narrow window and are easily confused with similar
          moments elsewhere in the routine.
        </p>
      </div>
    </div>
  </section>
```

- [ ] **Step 2: Write the closed-loop comparison**

Replace `<section class="section" id="closed-loop"></section>` with:

```html
  <section class="section" id="closed-loop">
    <div class="container is-max-widescreen">
      <h2 class="title is-3 section-heading has-text-centered">Closed-Loop Execution</h2>
      <p class="content is-medium has-text-centered" style="max-width: 820px; margin: 0 auto 2rem;">
        The same moment of the routine, run by three systems. A monolithic &pi;<sub>0.5</sub> has to
        learn <em>when</em> to act and <em>how</em> to act inside one network, under 10
        demonstrations; it does neither well. Splitting the two lets each half be good at its job.
      </p>

      <div class="compare-grid">
        <div class="compare-cell">
          <p class="compare-cell__label"><strong>&pi;<sub>0.5</sub></strong></p>
          <div class="video-slot">
            <video controls playsinline preload="metadata" src="static/videos/compare_pi05.mp4"></video>
            <div class="video-slot__fallback"><span>Video coming soon</span></div>
          </div>
        </div>
        <div class="compare-cell">
          <p class="compare-cell__label"><strong>&pi;<sub>0.5</sub> (Reasoning)</strong></p>
          <div class="video-slot">
            <video controls playsinline preload="metadata" src="static/videos/compare_pi05_reasoning.mp4"></video>
            <div class="video-slot__fallback"><span>Video coming soon</span></div>
          </div>
        </div>
        <div class="compare-cell">
          <p class="compare-cell__label"><strong>Ours</strong></p>
          <div class="video-slot">
            <video controls playsinline preload="metadata" src="static/videos/compare_ours.mp4"></video>
            <div class="video-slot__fallback"><span>Video coming soon</span></div>
          </div>
        </div>
      </div>

      <div class="table-container" style="margin-top: 2.5rem;">
        <table class="table is-fullwidth pam-table">
          <thead>
            <tr>
              <th>Method</th>
              <th>Cereal&rarr;Person</th>
              <th>Milk&rarr;Person</th>
              <th>Cereal&rarr;Storage</th>
              <th>Milk&rarr;Storage</th>
              <th>Bowl&rarr;Storage</th>
              <th>Wet wipe&rarr;Trash</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>&pi;<sub>0.5</sub></td>
              <td>7 / 10</td><td>1 / 10</td><td>6 / 10</td><td>0 / 10</td><td>5 / 10</td><td>4 / 10</td>
            </tr>
            <tr>
              <td>&pi;<sub>0.5</sub> (Reasoning)</td>
              <td>6 / 10</td><td>0 / 10</td><td>0 / 10</td><td>0 / 10</td><td>5 / 10</td><td>5 / 10</td>
            </tr>
            <tr class="pam-table__ours">
              <td><strong>Ours</strong></td>
              <td><strong>9 / 10</strong></td><td><strong>3 / 10</strong></td>
              <td><strong>8 / 10</strong></td><td><strong>5 / 10</strong></td>
              <td><strong>8 / 10</strong></td><td><strong>8 / 10</strong></td>
            </tr>
          </tbody>
        </table>
        <p class="figure-caption">
          Task-wise success rate over 10 trials each. Milk&rarr;Storage is the hardest skill &mdash;
          it needs a grasp on the rounded cap &mdash; and a monolithic model spending its capacity on
          reasoning never lands it.
        </p>
      </div>
    </div>
  </section>
```

- [ ] **Step 3: Style the comparison grid and table**

Append to `docs/static/css/index.css`:

```css
.compare-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

.compare-cell__label {
  margin-bottom: 0.5rem;
  text-align: center;
}

.pam-table th,
.pam-table td {
  text-align: center;
  vertical-align: middle;
}

.pam-table th:first-child,
.pam-table td:first-child {
  text-align: left;
}

.pam-table__ours { background: var(--pam-orange-soft); }

@media (max-width: 768px) {
  .compare-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 4: Verify**

Serve and reload. Expected: three figures with captions, three "Video coming soon" panels in a row under Closed-Loop Execution, and the success-rate table with the Ours row tinted orange. Check the table's numbers against Tab. 1 of the paper, cell by cell. At mobile width the table scrolls horizontally inside its container while the page itself does not.

- [ ] **Step 5: Commit**

```bash
git add docs/index.html docs/static/css/index.css
git commit -m "feat: add results figures and the closed-loop comparison"
```

---

### Task 9: Generalization

**Files:**
- Modify: `docs/index.html` (`#generalization`)

**Interfaces:**
- Consumes: figures `fig20`, `fig21`, `fig22` (Task 2).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the section**

Replace `<section class="section" id="generalization"></section>` with:

```html
  <section class="section" id="generalization">
    <div class="container is-max-desktop">
      <h2 class="title is-3 section-heading has-text-centered">Does It Only Work on One Routine?</h2>

      <h3 class="title is-5" style="margin-top: 1rem;">A harder routine, with almost no cues</h3>
      <div class="figure">
        <img src="static/images/fig20_medication.png"
             alt="The medication routine: the person enters empty-handed, takes a pill with water, then drinks a Coke while working.">
      </div>
      <div class="content is-medium" style="margin-top: 1.25rem;">
        <p>
          In the desk routine, an empty bowl is a strong hint. So we built a routine that offers
          almost none: the user walks in empty-handed, takes a pill with water, then drinks a Coke
          while working. Nothing on the desk says what comes next &mdash; which is precisely the
          knowledge a memory is supposed to supply.
        </p>
      </div>
      <div class="figure" style="margin-top: 1.5rem;">
        <img src="static/images/fig21_medication_results.png"
             alt="Five-day results on the medication routine.">
        <p class="figure-caption">
          The FSM memory still improves day over day and still leads on precision, recall, and F1,
          cutting first-fire delay from roughly 17 seconds to about 10. The event-driven baseline,
          with no memory and nothing in the scene to react to, never fires at all.
        </p>
      </div>

      <h3 class="title is-5" style="margin-top: 3rem;">What if the user's routine changes entirely?</h3>
      <div class="figure">
        <img src="static/images/fig22_transfer.png"
             alt="Adapting a memory built on one routine to a different one, in both directions.">
        <p class="figure-caption">
          Loading a memory built for a different routine and freezing it is worse than having no
          memory at all &mdash; the old routine's vocabulary fires on the new content. But leave the
          reflector running and the problem evaporates: within a day or two it has replaced the stale
          pairs and caught up with a memory started from scratch. A deployed robot does not need its
          memory wiped when the user's life changes.
        </p>
      </div>
    </div>
  </section>
```

- [ ] **Step 2: Verify**

Serve and reload. Expected: three figures load, two subheadings, no console 404s.

- [ ] **Step 3: Commit**

```bash
git add docs/index.html
git commit -m "feat: add the generalization section"
```

---

### Task 10: BibTeX, footer, and the full-page pass

**Files:**
- Modify: `docs/index.html` (`#bibtex`, `#site-footer`)
- Modify: `docs/static/css/index.css` (append)
- Modify: `docs/static/js/index.js` (append)

**Interfaces:**
- Consumes: everything above.
- Produces: the finished page.

The BibTeX entry uses `@misc` with no `eprint` field, because there is no arXiv ID yet. When the preprint is posted, this block and the hero's commented-out button are the two places to update.

- [ ] **Step 1: Write the BibTeX section**

Replace `<section class="section" id="bibtex"></section>` with:

```html
  <section class="section" id="bibtex">
    <div class="container is-max-desktop">
      <h2 class="title is-3 section-heading">BibTeX</h2>
      <div class="bibtex">
        <button class="button is-small is-rounded bibtex__copy" id="bibtex-copy" type="button">
          <span class="icon"><i class="fas fa-copy"></i></span>
          <span>Copy</span>
        </button>
        <pre id="bibtex-text">@misc{lee2026pam,
  title  = {Procedural Assistance Memory for Proactive Robot},
  author = {Lee, Dohyun and Park, Minho and Park, Jeonghoon and Hwang, Dongyoon
            and Hyung, Junha and Hwang, Sungwon and Lee, Byungkun and Choo, Jaegul},
  year   = {2026},
}</pre>
      </div>
    </div>
  </section>
```

- [ ] **Step 2: Write the footer**

Replace `<footer class="footer" id="site-footer"></footer>` with:

```html
  <footer class="footer" id="site-footer">
    <div class="container has-text-centered">
      <p class="is-size-7">
        Page template adapted from
        <a href="https://github.com/nerfies/nerfies.github.io">Nerfies</a>, used under
        <a href="http://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.
      </p>
    </div>
  </footer>
```

- [ ] **Step 3: Style and wire the copy button**

Append to `docs/static/css/index.css`:

```css
.bibtex {
  position: relative;
}

.bibtex pre {
  background: var(--pam-bg-alt);
  border-radius: 6px;
  font-size: 0.85rem;
  overflow-x: auto;
  padding: 1.25rem;
}

.bibtex__copy {
  position: absolute;
  right: 0.75rem;
  top: 0.75rem;
}
```

Append to `docs/static/js/index.js`, inside the existing `DOMContentLoaded` handler, and add the function above it:

```js
function setupBibtexCopy() {
  const button = document.getElementById('bibtex-copy');
  const pre = document.getElementById('bibtex-text');
  if (!button || !pre) return;
  button.addEventListener('click', async () => {
    await navigator.clipboard.writeText(pre.textContent);
    const label = button.querySelector('span:last-child');
    label.textContent = 'Copied';
    setTimeout(() => { label.textContent = 'Copy'; }, 1500);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupVideoSlots();
  setupBibtexCopy();
});
```

(Replace the existing `DOMContentLoaded` block rather than adding a second one.)

- [ ] **Step 4: Full-page pass**

Serve `docs/` and go through the whole page top to bottom at **1440px**, then **1024px**, then **390px**. At every width:

- No horizontal scrollbar on `<body>`.
- All twelve figures load; ten "Video coming soon" panels show (1 teaser + 6 tasks + 3 comparison).
- The Memory Evolution graph and rules stack vertically below 1024px instead of overflowing.
- Console: zero errors, zero warnings other than the expected video 404s and (if you tested it) the FSM fallback warning.

Then click **Copy** under BibTeX and paste somewhere to confirm the entry landed on the clipboard.

- [ ] **Step 5: Re-run the validator as a final guard**

```bash
cd /home/nas_main/minhopark/repos/PAM && python3 tools/validate_fsm.py
```

Expected: `OK  6 days, all invariants hold`.

- [ ] **Step 6: Commit**

```bash
git add docs/index.html docs/static/css/index.css docs/static/js/index.js
git commit -m "feat: add bibtex, footer, and finish the page pass"
```

- [ ] **Step 7: Tell the user what is left**

Report to the user, in Korean:

- GitHub Pages must be switched on by hand: **Settings → Pages → Source: Deploy from a branch → `main` / `/docs`**. Nobody but the repo owner can do this.
- The **Code** button still points at `#`. It needs the repo URL.
- Ten videos are still placeholders. List the exact paths from the spec's video table so the files can be dropped in.
- The arXiv button and the BibTeX `eprint` field are waiting on the preprint.

---

## Self-Review

**Spec coverage.** Every spec section maps to a task: site structure §1–11 → Tasks 3, 4, 5, 7, 8, 9, 10; Memory Evolution → Tasks 6 and 7; file layout → Task 1; figure extraction → Task 2; video placeholders → Task 3 (contract) and Tasks 5, 8 (uses); error handling → Task 3 Step 4 (missing video) and Task 7 Steps 1, 2, 6 (missing JSON); testing → the verify step of every task, plus Task 10 Step 4.

**Known gap, accepted.** The spec mentions optional poster images (`static/images/posters/<name>.jpg`). No task implements them, because with no videos there are no posters to make, and a `poster` attribute pointing at a missing file is just a second broken path. When the videos land, adding `poster="..."` to each `<video>` is a one-line change per slot. This is deliberate, not an oversight.

**Type consistency.** `setupVideoSlots()` and `setupBibtexCopy()` are the only two functions in `index.js`; `memory-evolution.js` is self-contained and shares no globals with it. The `.video-slot` / `.video-slot__fallback` / `is-missing` triple is used identically in Tasks 3, 5, and 8. The JSON keys written in Task 6 (`days`, `id`, `label`, `caption`, `states`, `transitions`, `rules`, `triggers`, `text`, `isNew`, `isRevised`, `wasAction`, `action`, `desc`, `from`, `to`) are exactly the keys read in Task 7 and asserted in Task 6's validator.
