# PAM Project Page — Design

**Date:** 2026-07-11
**Paper:** Procedural Assistance Memory for Proactive Robot (Lee\*, Park\*, Park, Hwang, Hyung, Hwang, Lee, Choo — KAIST AI)
**Reference site:** https://jen-pan.github.io/memer/ (MemER — Bulma / academic-project-page template)

## Goal

A static academic project page for the PAM paper, hosted on GitHub Pages. All page content is in
English. The page follows MemER's structure and visual language, with one addition: an interactive
**Memory Evolution** section that replays how the FSM memory grows across Days 1–5 and how it is
revised when the user's routine changes.

Videos do not exist yet. Every video is a named placeholder slot; dropping a file at the specified
path makes it play, with no other edit.

## Constraints

- No build step. Plain HTML/CSS/vanilla JS, served directly by GitHub Pages.
- Page root is `docs/`. GitHub Pages source: branch `main`, folder `/docs`.
- No fabricated numbers. Every value on the page is traceable to the paper. Per-day
  precision/recall/F1 appear only as figure images, because the paper reports them as plots, not
  tables.
- The paper PDF ships with the site; the Paper button links to it. There is no arXiv entry yet.

## Site Structure

Sections, in page order:

1. **Hero** — title, authors (`*` = equal contribution), KAIST AI, and buttons:
   - `Paper` → `static/pdfs/PAM.pdf`
   - `Code` → `#` (placeholder until the repo URL is decided)
   - arXiv button is omitted. Commented-out markup is left in place so it can be restored in one
     line when the preprint is posted.
2. **Method Teaser** — full-width `<video controls>` for the narrated method walkthrough.
   Path: `static/videos/teaser.mp4`.
3. **Motivation** — Fig. 1 plus one paragraph: visually identical observations map to different
   correct actions depending on the user's habits, so a zero-shot VLM defaults to inaction.
4. **Abstract** — the paper's abstract verbatim.
5. **Architecture** — Fig. 2. Two paragraphs: (a) the System 1–2 split — a 1 Hz Qwen3.5-27B task
   predictor reading PAM plus the last W=5 frames, emitting a language subtask or `NO_ACT`, and a
   fine-tuned π0.5 executor realizing it; (b) the nightly reflector loop that rewrites PAM from the
   day's video with no weight updates.
6. **Proactive Tasks** — the six tasks T1–T6 as a responsive video grid (3 columns desktop,
   2 tablet, 1 mobile), each captioned with its atomic instruction from the paper.
7. **Memory Evolution** — the interactive section. Detailed below.
8. **Results** — Fig. 5 (multi-day precision / recall / F1 / first-fire delay across baselines) and
   Fig. 11 (self-evolving vs. frozen-at-Day-1 vs. zero-shot). Each figure gets a short caption
   stating the finding, not restating the axes.
9. **Closed-Loop Comparison** — a 3-column video grid, π0.5 / π0.5 (Reasoning) / Ours, on the same
   moment of the routine (mirrors MemER's method-comparison grid and the paper's Fig. 6). Below it,
   the Tab. 1 per-task success-rate table as HTML.
10. **Generalization** — the supplementary experiments, condensed: the medication routine
    (Fig. 20, 21) showing PAM transfers to a low-cue routine, and the A↔B memory-transfer study
    (Fig. 22) showing a stale memory only hurts when reflection is switched off.
11. **BibTeX** — a `<pre>` block, with a copy button.

## Memory Evolution Section

The signature interaction. It is the only place the paper's central claim — that the FSM structure,
not memory alone, drives the gains — can be shown rather than asserted.

**Data source.** Verbatim from the paper: Fig. 12 (the FSM after each of Days 1–4), Fig. 13 (the
final Day-5 memory), and Fig. 7 (the routine-change revision). Nothing is invented.

**Control.** A day selector across the top: `Day 1 · Day 2 · Day 3 · Day 4 · Day 5 · Routine
Change`. Clicking a day re-renders both panes.

**Left pane — FSM graph.** The five states (`meal_preparation`, `eating`, `working`,
`cleaning_break`, `leaving`) laid out at fixed coordinates in an inline SVG, with labeled
transitions. Selecting a day toggles CSS classes only; no layout engine, no graph library. Nodes and
edges introduced on the selected day get the `is-new` class (orange), matching the paper's
highlighting convention. `cleaning_break` and the `working ↔ cleaning_break` loop therefore appear
in orange on Day 4 and settle to gray on Day 5.

Clicking a state selects it and drives the right pane. Default selection on each day is the state
that changed.

**Right pane — rules for the selected state.** The state's (trigger, action) pairs. Highlighting
follows the paper exactly:
- a pair added on the selected day → whole card orange
- an existing pair whose trigger gained an `or`-clause → only the new clause is orange, prior
  clauses stay gray

**Caption.** One line per day, stating what the reflector did. For example, Day 4: *"A new
`cleaning_break` state appears; the wet-wipe rule is attached to it, and both put-away triggers
broaden."*

**Routine Change tab.** Fig. 7's revision: the user now takes a pill before eating, so the
`Person sits down` trigger's action is rewritten from *deliver cereal* to *deliver pill*. This is
the one tab that shows a rule being **modified** rather than added — the distinction the section
exists to make.

**Deliberately excluded.** No per-day metric readout on the slider. The paper reports those as plots
only; attaching numbers to each day would mean inventing them. The Results section's figures carry
that load.

**Data file.** `static/data/pam-fsm.json`, one entry per day:

```json
{
  "day1": {
    "caption": "...",
    "states": [{"id": "meal_preparation", "desc": "...", "isNew": true}],
    "transitions": [{"from": "meal_preparation", "to": "eating", "label": "Person picks up a spoon", "isNew": true}],
    "rules": {
      "meal_preparation": [
        {"triggers": [{"text": "Person places a bowl on the desk", "isNew": true}],
         "action": "Pick up the cereal bag and place it next to the person.",
         "isNew": true}
      ]
    }
  }
}
```

Keeping the FSM in a data file rather than in markup means the section can later be regenerated from
real reflector logs without touching the renderer.

## File Layout

```
docs/
  index.html
  .nojekyll
  static/
    css/index.css              # template styles + PAM custom (FSM graph, video placeholders)
    js/index.js                # carousel, video autoplay-on-scroll
    js/memory-evolution.js     # day selector -> FSM render
    data/pam-fsm.json
    pdfs/PAM.pdf               # moved from repo root
    images/                    # figures extracted from the PDF
    videos/                    # all placeholders for now
  superpowers/specs/           # design docs (this file)
```

`PAM.pdf` moves from the repo root to `docs/static/pdfs/PAM.pdf`.

## Figure Extraction

Figures are rendered from the PDF with PyMuPDF at 300 dpi and cropped to the figure bounding box —
rendered, not screenshotted, so they stay crisp on retina displays.

| File | Source | Used in |
|---|---|---|
| `fig1_motivation.png` | Fig. 1, p2 | Motivation |
| `fig2_overview.png` | Fig. 2, p3 | Architecture |
| `fig3_pam_example.png` | Fig. 3, p4 | Architecture (inset) |
| `fig4_tasks.png` | Fig. 4, p5 | Proactive Tasks |
| `fig5_multiday.png` | Fig. 5, p6 | Results |
| `fig7_memory_evolution.png` | Fig. 7, p8 | Memory Evolution (static fallback) |
| `fig9_cameras.png` | Fig. 9, p16 | Architecture (setup) |
| `fig10_pertask.png` | Fig. 10, p17 | Results |
| `fig11_selfevolving.png` | Fig. 11, p18 | Results |
| `fig20_medication.png` | Fig. 20, p25 | Generalization |
| `fig21_medication_results.png` | Fig. 21, p26 | Generalization |
| `fig22_transfer.png` | Fig. 22, p27 | Generalization |

## Video Placeholders

Every `<video>` points at its final path. When the file is absent, a CSS fallback shows a gray panel
labeled *"Video coming soon."* Adding the file at that exact path is the only step needed to
activate it.

| Path | Content |
|---|---|
| `static/videos/teaser.mp4` | Narrated method walkthrough (hero) |
| `static/videos/t1_cereal_to_person.mp4` | T1 execution |
| `static/videos/t2_milk_to_person.mp4` | T2 |
| `static/videos/t3_cereal_to_storage.mp4` | T3 |
| `static/videos/t4_milk_to_storage.mp4` | T4 |
| `static/videos/t5_bowl_to_storage.mp4` | T5 |
| `static/videos/t6_wipe_to_trash.mp4` | T6 |
| `static/videos/compare_pi05.mp4` | Closed-loop: π0.5 |
| `static/videos/compare_pi05_reasoning.mp4` | Closed-loop: π0.5 (Reasoning) |
| `static/videos/compare_ours.mp4` | Closed-loop: Ours |

Poster images are optional; if `static/images/posters/<name>.jpg` exists it is used, otherwise the
placeholder panel shows.

## Error Handling

Two failure modes matter on a static page, and both are handled by degrading rather than breaking:

- **Missing video** — the `<video>` element's `error` event adds a `.video-missing` class to its
  wrapper, which reveals the placeholder panel. The page never shows a broken black box.
- **Missing or malformed `pam-fsm.json`** — the fetch failure hides the interactive section and
  reveals a static `<img>` of Fig. 7 in its place. The section degrades to the paper's own figure.

## Testing

Manual, since there is no build system:

- Serve `docs/` with `python -m http.server` and confirm the page renders with zero console errors.
- Step through all six Memory Evolution tabs; check each day's orange highlights against Fig. 12 and
  Fig. 13 line by line. This is the check that matters most — the data is transcribed by hand and
  transcription is where errors will be.
- Confirm every video slot shows the placeholder panel (no files exist yet), then drop one dummy
  `.mp4` in and confirm it plays.
- Check layout at 1440px, 1024px, and 390px widths.
- Confirm the Paper button opens the PDF.

## Out of Scope

- Any research code, model weights, or dataset release.
- A dark mode.
- Analytics.
