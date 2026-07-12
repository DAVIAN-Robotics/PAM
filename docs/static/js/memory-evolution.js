// Renders one day of the PAM FSM: a fixed-layout SVG graph plus the rules of
// the selected state. Everything is driven by static/data/pam-fsm.json.
//
// Wrapped in an IIFE so nothing (el, POS, NODE_W, drawGraph, ...) leaks onto
// the global scope — a future section script could otherwise redeclare one
// of these names and take down both scripts with a parse-time SyntaxError.
(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Hard-coded layout. Four states run down a left spine (meal_preparation,
  // eating, working, leaving); cleaning_break sits in its own column to the
  // right of `working`, since it is a side loop out of and back into `working`
  // rather than a stop on the main spine.
  const NODE_W = 210;
  const NODE_H = 60;
  const POS = {
    meal_preparation: { x: 20, y: 20 },
    eating: { x: 20, y: 140 },
    working: { x: 20, y: 260 },
    cleaning_break: { x: 300, y: 260 },
    leaving: { x: 20, y: 460 },
  };
  const VIEWBOX_PAD = 20;

  // Two previous iterations of this got it wrong in opposite directions:
  //
  //   1. A per-day viewBox fit to the bounding box of just the nodes drawn
  //      *that day*. Days 1-3 have no cleaning_break node, so their content
  //      bbox was smaller, so that viewBox was smaller, so the SVG — which
  //      scales to its container at a fixed aspect ratio (width: 100%;
  //      height: auto in CSS) — scaled *up* to fill the column on those
  //      days. A node that stayed exactly the same size and position
  //      appeared to grow or shrink, and a genuinely new node no longer
  //      read as *appearing* — it read as the whole graph rescaling.
  //   2. A single FIXED_VIEWBOX covering the complete fixed layout on every
  //      day — every node in POS, every edge route, and every edge label,
  //      whether or not a given day draws it. Scale was constant, but the
  //      origin was also constant, so Days 1-3 (which draw less than the
  //      full layout) rendered pushed to one side with dead space beside
  //      them instead of looking centered.
  //
  // The fix: keep the viewBox's *size* constant (FIXED_SIZE below, derived
  // once from the complete layout — this is what pins the scale) but choose
  // its *origin* per day (viewBoxForDay) so that day's actually-drawn
  // content is centered inside that constant-size window. Node positions
  // (POS) and the edge-route table are never touched, and neither is the
  // window's size — only where that fixed-size window is *placed* moves,
  // per day. On Days 1-3 the window is centered over the four-node column;
  // on Days 4-6, centering the complete layout lands the window exactly
  // where the old single FIXED_VIEWBOX sat.
  function numbersFromPath(d) {
    return (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  }

  // Bounding box (in the fixed layout's coordinate space) of a set of
  // states plus a set of edge routes. Shared by the "complete layout" bbox
  // (-> FIXED_SIZE, computed once below) and the "this day's content" bbox
  // (-> viewBoxForDay, computed per render) — same math, different input
  // sets. Returns null if given no states and no edges to consider (an
  // empty day), so callers can fall back rather than divide by a bbox that
  // doesn't exist.
  function computeBBox(stateIds, edgeRoutes) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const consider = (x, y) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    };
    for (const id of stateIds) {
      const p = POS[id];
      if (!p) continue;
      consider(p.x, p.y);
      consider(p.x + NODE_W, p.y + NODE_H);
    }
    for (const route of edgeRoutes) {
      const nums = numbersFromPath(route.d);
      for (let i = 0; i + 1 < nums.length; i += 2) consider(nums[i], nums[i + 1]);
      consider(route.label.x, route.label.y);
    }
    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY };
  }

  // Every edge that can ever appear (5 total, across all six days) gets an
  // explicit hand-routed path rather than a generic center-to-center line, so
  // paths start/end exactly at node borders and labels have dedicated,
  // collision-free slots. This is a small enough, fixed enough graph that a
  // routing table is simpler and more reliable than general edge geometry.
  //
  // NOTE: every coordinate below is a literal, hand-tuned to the current
  // POS / NODE_W / NODE_H values above (e.g. 80 = meal_preparation's y (20)
  // + NODE_H (60); 320 = working's y (260) + NODE_H (60)). None of it is
  // computed at runtime. If POS, NODE_W, or NODE_H ever change, this whole
  // table must be re-tuned by hand — it will not update itself.
  const EDGE_ROUTES = {
    // Vertical spine edges: label sits centered in the gap between the two
    // nodes it connects, well clear of both borders.
    'meal_preparation->eating': {
      d: 'M 125 80 L 125 140',
      label: { x: 137, y: 112, anchor: 'start' },
    },
    'eating->working': {
      d: 'M 125 200 L 125 260',
      label: { x: 137, y: 232, anchor: 'start' },
    },
    'working->leaving': {
      // The working-leaving gap is tall (it also has to clear the loop's
      // back-edge label below), so its label sits low in the gap.
      d: 'M 125 320 L 125 460',
      label: { x: 137, y: 420, anchor: 'start' },
    },
    // Forward: a short straight hop from working's right border to
    // cleaning_break's left border, along the upper third of the row. Label
    // sits above the row, in the gap between it and the row above.
    'working->cleaning_break': {
      d: 'M 230 278 L 300 278',
      label: { x: 265, y: 250, anchor: 'middle' },
      isBack: false,
    },
    // Back-edge: bows below the row so it never overlaps the forward edge, and
    // carries a dashed stroke (see .fsm-edge--back in CSS) so it stays visually
    // distinct even when both edges are colored the same (e.g. both isNew).
    // Its label sits just under the dip, well above the working->leaving
    // label lower in the same gap.
    'cleaning_break->working': {
      d: 'M 300 302 C 280 356, 250 356, 230 302',
      label: { x: 265, y: 372, anchor: 'middle' },
      isBack: true,
    },
  };

  // Computed once, here, after POS and EDGE_ROUTES are both defined — not
  // per render, not per day. FIXED_SIZE.width/height is the same for every
  // drawGraph() call below, so a node's rendered *size* never changes as
  // the visitor steps through days; only the window's origin (x/y) moves,
  // computed per day by viewBoxForDay.
  const FULL_BBOX = computeBBox(Object.keys(POS), Object.values(EDGE_ROUTES));
  const FIXED_SIZE = {
    width: (FULL_BBOX.maxX - FULL_BBOX.minX) + VIEWBOX_PAD * 2,
    height: (FULL_BBOX.maxY - FULL_BBOX.minY) + VIEWBOX_PAD * 2,
  };

  // The edge routes actually relevant to a given day: both endpoints must
  // be states the day draws. Mirrors the same present-set filtering
  // drawGraph's edge loop below does, kept in sync deliberately — this is
  // used to compute *what to center*, drawGraph decides *what to draw*, and
  // they must agree on that set or the window would center on content the
  // day doesn't actually show.
  function edgeRoutesForDay(day) {
    const present = new Set(day.states.map((s) => s.id));
    const routes = [];
    for (const t of day.transitions) {
      if (!present.has(t.from) || !present.has(t.to)) continue;
      const route = EDGE_ROUTES[`${t.from}->${t.to}`];
      if (route) routes.push(route);
    }
    return routes;
  }

  // This day's viewBox: FIXED_SIZE's width/height (constant, pins the
  // scale — see the history above) with an origin chosen so this day's own
  // content bbox sits centered inside that constant window. Days 4-6 draw
  // the complete layout, so their centered bbox *is* FULL_BBOX and this
  // returns exactly the old single FIXED_VIEWBOX's origin, byte-for-byte
  // (padding is added symmetrically on every side, so it cancels out of the
  // center — the centering math below never needs to add it back in).
  function viewBoxForDay(day) {
    const bbox = computeBBox(day.states.map((s) => s.id), edgeRoutesForDay(day));
    if (!bbox) {
      // No states this day (the legitimate "day has zero states" case
      // defaultState() already warns about below) — nothing to center on;
      // fall back to the full layout's own window rather than divide by a
      // bbox that doesn't exist.
      return {
        x: FULL_BBOX.minX - VIEWBOX_PAD,
        y: FULL_BBOX.minY - VIEWBOX_PAD,
        width: FIXED_SIZE.width,
        height: FIXED_SIZE.height,
      };
    }
    const cx = (bbox.minX + bbox.maxX) / 2;
    const cy = (bbox.minY + bbox.maxY) / 2;
    return {
      x: cx - FIXED_SIZE.width / 2,
      y: cy - FIXED_SIZE.height / 2,
      width: FIXED_SIZE.width,
      height: FIXED_SIZE.height,
    };
  }

  function viewBoxString(box) {
    return `${box.x} ${box.y} ${box.width} ${box.height}`;
  }

  // Parses an SVG viewBox attribute string back into {x, y, width, height}.
  // Used to read the *currently rendered* origin off the live <svg> so a day
  // switch can pan from wherever the window actually is (which, mid-hammer,
  // may be a just-cancelled pan's settled target rather than the previous
  // day's own origin) to the new day's target. Returns null for a missing
  // or malformed attribute (e.g. the very first render, before drawGraph has
  // ever set one) so callers can treat "no prior value" as "don't pan".
  function parseViewBox(str) {
    if (!str) return null;
    const parts = str.trim().split(/\s+/).map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;
    return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
  }

  // --- animation layer ---------------------------------------------------
  //
  // Everything below animates a day's *arrival* on top of an already-final
  // DOM: drawGraph/drawRules always build the exact same classes/attributes
  // they built before this file grew an animation layer — isNew/isRevised
  // styling is untouched CSS, applied unconditionally. The animation is a
  // purely cosmetic Web Animations API layer bolted on top of that final
  // DOM, which gives us two properties for free:
  //
  //   1. prefers-reduced-motion is satisfied by simply never calling
  //      .animate() — the DOM these functions build is already the final,
  //      correct state with no animation involved.
  //   2. Cancelling mid-flight is always safe: an Animation's .cancel() call
  //      unconditionally removes its effect and reverts the target to its
  //      underlying (non-animated, final) style, regardless of fill mode or
  //      how far through the animation it was. We never hand-write a
  //      "hidden" state into an element's real style/class — only into
  //      keyframes — so there is nothing for a cancel to get stuck in.
  const DUR = {
    viewBoxPan: 280,
    panLead: 40,
    nodeEnter: 240,
    nodePulse: 480,
    edgeDraw: 260,
    edgeStagger: 80,
    edgeAfterNewNode: 120,
    arrowFade: 100,
    cardRise: 220,
    cardStagger: 90,
    triggerPulse: 420,
    // The Routine Change rewrite (see animateRevisedCard below): a ghost
    // plays the old sentence descending out of the action slot into the
    // "previously" line while its style fades and the "revised —
    // previously:" prefix reveals itself, then the real new action pops
    // into the vacated slot. Numbers are tuned so the whole sequence lands
    // well under the section's ~600ms budget: prefix reveal ends exactly
    // as the descent (revisedGhostDur) completes, the real "was" line
    // fades in right after, and the new action's pop-in starts just before
    // the descent finishes so the two beats overlap slightly rather than
    // reading as two separate events.
    revisedGhostDur: 300,
    revisedPrefixDur: 150,
    revisedPrefixDelay: 150,
    revisedWasDur: 140,
    revisedWasDelay: 210,
    revisedActionDur: 260,
    revisedActionDelay: 260,
  };

  const reduceMotionQuery = typeof matchMedia === 'function'
    ? matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  function reduceMotion() {
    return !!(reduceMotionQuery && reduceMotionQuery.matches);
  }
  // A render only ever animates when it was triggered by a day switch *and*
  // the visitor hasn't asked for reduced motion. Selecting a state (clicking
  // a node) always passes animate=false at the call site, regardless of this
  // check, so it never needs to consult reduceMotion() itself.
  function shouldAnimate(animate) {
    return !!animate && !reduceMotion();
  }

  // Every Animation object currently in flight, so a new render (day switch
  // or state click, whichever comes first) can cancel stragglers before
  // building the next frame. Belt-and-suspenders alongside svg.replaceChildren
  // / container.replaceChildren, which already detach the old animated
  // elements — explicit cancellation just means we never leave an Animation
  // running against a detached node.
  let activeAnimations = [];
  function trackAnim(anim) {
    if (anim) activeAnimations.push(anim);
    return anim;
  }
  function cancelActiveAnimations() {
    for (const a of activeAnimations) {
      try { a.cancel(); } catch (_) { /* already finished/idle — fine */ }
    }
    activeAnimations = [];
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // Pans the SVG's viewBox origin from `from` to `to` (same width/height —
  // only x/y move) over `duration` ms, on a day switch. viewBox is a plain
  // attribute, not a CSS property, so Element.animate() (used by every other
  // animation in this file) can't touch it — WAAPI only drives style /
  // presentation properties that have a CSS equivalent, and viewBox has
  // none. This hand-rolled requestAnimationFrame loop is the only way to
  // animate it.
  //
  // It exposes the same `.cancel()` shape an Animation object does, purely
  // so activeAnimations / cancelActiveAnimations() (above) can track and
  // cancel a pan exactly like every other animation here, with no special
  // case at the call site. Cancelling always lands exactly on `to` rather
  // than freezing mid-interpolation: hammering tabs mid-pan must never
  // strand the viewBox at a half-panned value, and the next render reads
  // this element's *current* viewBox attribute as its own pan's `from` — it
  // needs a settled value, not one still in flight.
  function animateViewBoxPan(svg, from, to, duration) {
    const now = typeof performance !== 'undefined' ? () => performance.now() : () => Date.now();
    const start = now();
    let rafId = null;
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      svg.setAttribute('viewBox', viewBoxString(to));
    };
    const step = () => {
      const t = Math.min(1, (now() - start) / duration);
      if (t >= 1) { settle(); return; }
      const eased = easeOutCubic(t);
      svg.setAttribute('viewBox', viewBoxString({
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased,
        width: to.width,
        height: to.height,
      }));
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return {
      cancel() {
        if (rafId !== null) cancelAnimationFrame(rafId);
        settle();
      },
    };
  }

  function el(name, attrs = {}, text = null) {
    const node = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== null) node.textContent = text;
    return node;
  }

  // New state node: scales up from center and fades in. `delay` lets a day
  // switch that's also panning the viewBox (see animateViewBoxPan) hold the
  // node at its pre-entrance keyframe (opacity 0, scale 0.85) for a beat so
  // the pan visibly opens the space *first* — fill: 'backwards' is what
  // makes the delay actually show that first keyframe instead of the node's
  // plain final CSS appearance while it waits.
  function animateNodeEnter(g, delay = 0) {
    trackAnim(g.animate(
      [
        { opacity: 0, transform: 'scale(0.85)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: DUR.nodeEnter, delay, easing: 'ease-out', fill: 'backwards' },
    ));
  }

  // New transition: the line draws itself (stroke-dasharray/dashoffset),
  // then the arrowhead and label fade in right as it lands. `baseDelay`
  // lets callers stagger several new edges, and push them all behind a
  // newly-arriving node so an edge never appears to land on empty space.
  function animateEdgeDraw(path, arrowPath, label, baseDelay) {
    const length = path.getTotalLength();
    trackAnim(path.animate(
      [
        { strokeDasharray: `${length} ${length}`, strokeDashoffset: `${length}` },
        { strokeDasharray: `${length} ${length}`, strokeDashoffset: '0' },
      ],
      { duration: DUR.edgeDraw, delay: baseDelay, easing: 'ease-out', fill: 'backwards' },
    ));
    const landDelay = baseDelay + Math.max(DUR.edgeDraw - DUR.arrowFade, 0);
    trackAnim(arrowPath.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: DUR.arrowFade, delay: landDelay, easing: 'ease-out', fill: 'backwards' },
    ));
    trackAnim(label.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: DUR.arrowFade, delay: landDelay, easing: 'ease-out', fill: 'backwards' },
    ));
  }

  // New rule card: rises and fades in. `delay` staggers several new cards on
  // the same day so they arrive one after another rather than all at once.
  function animateCardEnter(card, delay) {
    trackAnim(card.animate(
      [
        { opacity: 0, transform: 'translateY(10px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: DUR.cardRise, delay, easing: 'ease-out', fill: 'backwards' },
    ));
  }

  // A new or-clause on an existing trigger: a brief highlight pulse that
  // settles into the blue resting state already painted by
  // .fsm-rule__trigger.is-new (--pam-blue = #1a73e8 = rgb(26, 113, 232) —
  // hardcoded here, same as the CSS token, because Web Animations keyframes
  // don't resolve custom properties the way declarative CSS does). Only the
  // temporary background is animated — the text's own color/weight are the
  // permanent CSS and never touched here — so once the pulse finishes (or is
  // cancelled) the span reverts straight to its normal, final appearance.
  function animateTriggerPulse(span) {
    trackAnim(span.animate(
      [
        { backgroundColor: 'rgba(26, 115, 232, 0.35)' },
        { backgroundColor: 'rgba(26, 115, 232, 0)' },
      ],
      { duration: DUR.triggerPulse, easing: 'ease-out' },
    ));
  }

  // A state whose *rules* changed today but which is not itself new (e.g.
  // Day 2/3/5's meal_preparation): a brief swell-and-settle so the left
  // graph gives the visitor a clue even on days where no state/edge is new.
  // Deliberately weaker than animateNodeEnter — no opacity change, and the
  // node never leaves scale 1 by much — so a "changed" node reads as a
  // lesser event than a "new" one, and the two are never confusable. Like
  // every other animation in this file, it touches only a temporary WAAPI
  // effect (never a class or attribute), so it needs no cleanup beyond the
  // shared cancelActiveAnimations() — cancelling or letting it finish both
  // revert the node to its plain, unanimated final appearance.
  function animateNodePulse(g) {
    trackAnim(g.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.06)', offset: 0.5 },
        { transform: 'scale(1)' },
      ],
      { duration: DUR.nodePulse, easing: 'ease-in-out' },
    ));
  }

  // The revised rule (Routine Change only): make the rewrite physical
  // rather than a card just appearing. Three beats, read as one motion:
  //
  //   1. The card opens showing the OLD rule as if it were still in force —
  //      the old sentence sitting in the action slot, dark/full-weight, no
  //      prefix. That's `ghost`'s starting look: it is built with `act`'s
  //      own class (`fsm-rule__action`) so it inherits the exact same CSS,
  //      no hand-copied styling to drift out of sync.
  //   2. The old sentence is demoted: `ghost` physically translates down
  //      into `was`'s slot while its color/size/weight fade from the
  //      action style to `was`'s style, and a "revised — previously: "
  //      prefix span reveals itself (width + opacity, from 0) in front of
  //      the sentence text as it lands.
  //   3. The real `act` (new action, already the final blue/revised
  //      styling — untouched by any of this) pops into the now-vacated
  //      action slot with a scale overshoot.
  //
  // `ghost` and its prefix span are the ONLY elements this function ever
  // creates or mutates the geometry/text of — `act` and `was` are the real,
  // already-final DOM nodes drawRules built; only their *opacity* is
  // animated (fill: 'backwards'), so cancelling mid-flight (or just letting
  // the animation finish) always reverts them to their plain, correct,
  // final CSS with nothing to clean up. `ghost` itself is genuinely
  // temporary: appended here, removed the instant its own animations
  // settle or are cancelled, so the settled DOM is exactly what drawRules
  // built — this function never leaves a trace once it's done.
  function animateRevisedCard(card, act, was, wasActionText) {
    // Capture real geometry/computed style *before* anything is animated —
    // once act/was's own .animate() calls are made, getComputedStyle would
    // start reflecting their in-flight WAAPI effect instead of their true
    // resting values.
    const cardRect = card.getBoundingClientRect();
    const actRect = act.getBoundingClientRect();
    const wasRect = was.getBoundingClientRect();
    const actStyle = getComputedStyle(act);
    const wasStyle = getComputedStyle(was);
    const startColor = actStyle.color;
    const startSize = actStyle.fontSize;
    const startWeight = actStyle.fontWeight;
    const endColor = wasStyle.color;
    const endSize = wasStyle.fontSize;
    const endWeight = wasStyle.fontWeight;
    const dy = wasRect.top - actRect.top;

    const ghost = document.createElement('p');
    ghost.className = 'fsm-rule__action';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.position = 'absolute';
    ghost.style.margin = '0';
    ghost.style.left = `${actRect.left - cardRect.left}px`;
    ghost.style.top = `${actRect.top - cardRect.top}px`;
    ghost.style.width = `${actRect.width}px`;
    ghost.style.pointerEvents = 'none';
    ghost.style.color = startColor;

    // The prefix is styled in `was`'s (fixed, final) style from the start —
    // only its width/opacity animate — so its target width is stable to
    // measure once, rather than a moving target chasing the ghost's own
    // color/size/weight transition.
    const prefix = document.createElement('span');
    prefix.textContent = 'revised — previously: ';
    prefix.style.display = 'inline-block';
    prefix.style.overflow = 'hidden';
    prefix.style.whiteSpace = 'nowrap';
    prefix.style.verticalAlign = 'baseline';
    prefix.style.color = endColor;
    prefix.style.fontSize = endSize;
    prefix.style.fontWeight = endWeight;
    ghost.appendChild(prefix);
    ghost.appendChild(document.createTextNode(wasActionText));
    card.appendChild(ghost);

    const prefixWidth = prefix.getBoundingClientRect().width;

    const ghostAnim = ghost.animate(
      [
        { transform: 'translateY(0)', color: startColor, fontSize: startSize, fontWeight: startWeight },
        { transform: `translateY(${dy}px)`, color: endColor, fontSize: endSize, fontWeight: endWeight },
      ],
      { duration: DUR.revisedGhostDur, easing: 'ease-in', fill: 'both' },
    );
    const prefixAnim = prefix.animate(
      [
        { width: '0px', opacity: 0 },
        { width: `${prefixWidth}px`, opacity: 1 },
      ],
      {
        duration: DUR.revisedPrefixDur,
        delay: DUR.revisedPrefixDelay,
        easing: 'ease-out',
        fill: 'both',
      },
    );

    // Belt-and-suspenders cleanup, same spirit as cancelActiveAnimations()
    // elsewhere in this file: remove `ghost` (and explicitly cancel its two
    // animations) the moment they settle *or* the moment a new render
    // cancels this one — whichever comes first — so a ghost never outlives
    // its own animation, whether that animation ran to completion or was
    // cut short by rapid tab/node switching.
    let ghostRemoved = false;
    const removeGhost = () => {
      if (ghostRemoved) return;
      ghostRemoved = true;
      try { ghostAnim.cancel(); } catch (_) { /* already finished/idle */ }
      try { prefixAnim.cancel(); } catch (_) { /* already finished/idle */ }
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
    };
    Promise.all([ghostAnim.finished, prefixAnim.finished]).catch(() => {}).then(removeGhost);
    trackAnim({ cancel: removeGhost });

    trackAnim(was.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      {
        duration: DUR.revisedWasDur,
        delay: DUR.revisedWasDelay,
        easing: 'ease-out',
        fill: 'backwards',
      },
    ));

    trackAnim(act.animate(
      [
        { opacity: 0, transform: 'scale(0.85)' },
        { opacity: 1, transform: 'scale(1.06)', offset: 0.7 },
        { opacity: 1, transform: 'scale(1)' },
      ],
      {
        duration: DUR.revisedActionDur,
        delay: DUR.revisedActionDelay,
        easing: 'ease-out',
        fill: 'backwards',
      },
    ));
  }

  // A state "changed" today if any of its rules is new or revised, or any
  // trigger inside any of its rules is new — even when the state itself is
  // not new. Days 2, 3, 5, and Routine Change touch only rules, never add a
  // state, so without this the left graph would sit perfectly still on
  // those days while the right pane shows real edits. Drives two things in
  // drawGraph: a persistent .is-changed class (painted for as long as the
  // day stays selected, not just during the arrival animation — a visitor
  // who looks away for a second must still see which state the day
  // touched) and, only on an animated day-switch render, a one-shot
  // attention pulse (animateNodePulse). States that are themselves new
  // (Day 1's four states, Day 4's cleaning_break) are deliberately excluded
  // by the caller below — a new state already gets the stronger
  // animateNodeEnter treatment plus its own persistent .is-new styling, and
  // "new" and "changed" are mutually exclusive by design (see
  // .fsm-node.is-changed in index.css).
  function changedStates(day) {
    const ids = new Set();
    for (const [stateId, rules] of Object.entries(day.rules)) {
      const changed = rules.some((r) => r.isNew || r.isRevised
        || r.triggers.some((t) => t.isNew));
      if (changed) ids.add(stateId);
    }
    return ids;
  }

  function drawGraph(svg, day, selectedState, onSelect, animate) {
    // Read the window's *current, settled* origin before touching anything
    // — by the time drawGraph runs, render() has already cancelled any
    // in-flight pan (cancelActiveAnimations, called just before this), which
    // snaps the attribute to a real resting value. That's this render's
    // `from`, if it turns out to be panning at all.
    const prevViewBox = svg.getAttribute('viewBox');
    svg.replaceChildren();

    const target = viewBoxForDay(day);
    const animateThisRender = shouldAnimate(animate);
    // Only pan when this render is an animated day switch (a node click, or
    // a reduced-motion visitor, must leave the graph completely still) *and*
    // the origin is actually moving — same day, same content bbox, same
    // origin, so re-setting an identical viewBox is a no-op rather than a
    // wasted zero-distance "animation".
    const prevBox = animateThisRender ? parseViewBox(prevViewBox) : null;
    const panning = !!prevBox && (prevBox.x !== target.x || prevBox.y !== target.y);
    svg.setAttribute('viewBox', viewBoxString(panning ? prevBox : target));

    const present = new Set(day.states.map((s) => s.id));
    const nodeIsArriving = animateThisRender && day.states.some((s) => s.isNew);
    // When the pan is actually moving the window, let it lead a newly
    // arriving node by a beat: the space visibly opens first, then the node
    // grows into it, so panning and arrival read as one motion ("making
    // room for the arrival") instead of two coincidentally-simultaneous
    // animations. A day switch that isn't panning (no origin change) or
    // isn't animated at all gets no lead — nothing to lead with.
    const nodeEnterDelay = (panning && nodeIsArriving) ? DUR.panLead : 0;
    const changed = changedStates(day);

    const defs = el('defs');
    svg.appendChild(defs);

    // Edges first, so nodes paint over their endpoints. Each edge gets its
    // own <marker> instance (rather than two markers shared by every edge)
    // so a new edge's arrowhead can fade in on its own timeline without
    // dragging every other edge's arrowhead along with it.
    let newEdgeIndex = 0;
    for (const t of day.transitions) {
      if (!present.has(t.from) || !present.has(t.to)) continue;
      const route = EDGE_ROUTES[`${t.from}->${t.to}`];
      if (!route) continue; // shouldn't happen with the current data, but stay safe

      const markerId = `fsm-arrow-${t.from}-${t.to}`;
      const marker = el('marker', {
        id: markerId, viewBox: '0 0 10 10', refX: '8.5', refY: '5',
        markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse',
      });
      const arrowCls = `fsm-arrowhead${t.isNew ? ' is-new' : ''}`;
      const arrowPath = el('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: arrowCls });
      marker.appendChild(arrowPath);
      defs.appendChild(marker);

      const cls = ['fsm-edge']
        .concat(t.isNew ? ['is-new'] : [])
        .concat(route.isBack ? ['fsm-edge--back'] : [])
        .join(' ');
      const path = el('path', { d: route.d, class: cls, fill: 'none', 'marker-end': `url(#${markerId})` });
      svg.appendChild(path);

      const labelCls = `fsm-edge-label${t.isNew ? ' is-new' : ''}`;
      const label = el('text', {
        x: route.label.x, y: route.label.y, class: labelCls, 'text-anchor': route.label.anchor,
      }, t.label);
      svg.appendChild(label);

      if (animateThisRender && t.isNew) {
        // Let a newly-arriving node finish taking shape before its edges
        // start growing out of it, then stagger the edges themselves.
        // nodeEnterDelay (the pan's head start, if any) shifts this whole
        // chain back by the same beat the node itself was shifted, so the
        // node-then-edges sequencing relative to *the node* is unchanged —
        // only its position relative to wall-clock time (and the pan) moves.
        const baseDelay = nodeEnterDelay
          + (nodeIsArriving ? DUR.edgeAfterNewNode : 0)
          + newEdgeIndex * DUR.edgeStagger;
        animateEdgeDraw(path, arrowPath, label, baseDelay);
        newEdgeIndex += 1;
      }
    }

    for (const s of day.states) {
      const p = POS[s.id];
      if (!p) {
        console.warn(`Memory Evolution: no layout position for state "${s.id}" — skipping.`);
        continue; // symmetric with the EDGE_ROUTES guard above: don't throw, don't blank the graph
      }
      // A state whose rules changed today (but which isn't itself new) gets
      // a persistent .is-changed class — the accent must stay painted for
      // as long as this day is selected, not just flash during the arrival
      // pulse below. Mutually exclusive with is-new: a new state is always
      // the stronger signal, so it never also carries is-changed even
      // though a brand-new state's rules are, definitionally, also "new".
      const isChangedState = !s.isNew && changed.has(s.id);
      const g = el('g', {
        class: `fsm-node${s.isNew ? ' is-new' : ''}${isChangedState ? ' is-changed' : ''}${s.id === selectedState ? ' is-selected' : ''}`,
        tabindex: '0',
        role: 'button',
        'aria-label': `${s.id}: ${s.desc}`,
      });
      g.appendChild(el('rect', {
        x: p.x, y: p.y, width: NODE_W, height: NODE_H, rx: 8, class: 'fsm-node__box',
      }));
      g.appendChild(el('text', { x: p.x + 14, y: p.y + 26, class: 'fsm-node-title' }, s.id));

      const ruleCount = (day.rules[s.id] || []).length;
      const sub = ruleCount === 0
        ? 'no rules'
        : `${ruleCount} rule${ruleCount > 1 ? 's' : ''}`;
      g.appendChild(el('text', { x: p.x + 14, y: p.y + 46, class: 'fsm-node-sub' }, sub));
      // Decorative "leads somewhere" chevron — part of making the node's
      // clickability discoverable at rest, not just on hover. Purely visual
      // (pointer-events: none in CSS); the <g> above already owns the real
      // click/keydown handlers, so this never needs one of its own.
      g.appendChild(el('text', {
        x: p.x + NODE_W - 14, y: p.y + 46, class: 'fsm-node-chevron', 'text-anchor': 'end',
      }, '›'));

      // Selection is drawn as its own inset ring rect, not as a style on the
      // main rect above — see .fsm-node-selected-ring in index.css. The main
      // rect carries its own class (.fsm-node__box) precisely so the base /
      // is-new / hover / focus rules in CSS can target *that* box only —
      // "any rect inside a node" would otherwise also match this ring and
      // repaint it every time a node is new/hovered/focused (see the CSS
      // comment above .fsm-node__box for how that bit previously). Keeping
      // the ring a separate element with its own class means it never
      // shares a paint property with the "new" fill/stroke, so both read at
      // once on a node that is both new and selected (e.g. Day 1's
      // meal_preparation, Day 4's cleaning_break).
      if (s.id === selectedState) {
        const inset = 5;
        g.appendChild(el('rect', {
          x: p.x + inset, y: p.y + inset,
          width: NODE_W - inset * 2, height: NODE_H - inset * 2,
          rx: 5, class: 'fsm-node-selected-ring',
        }));
      }

      g.addEventListener('click', () => onSelect(s.id));
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(s.id); }
      });
      svg.appendChild(g);

      if (animateThisRender && s.isNew) {
        animateNodeEnter(g, nodeEnterDelay);
      } else if (animateThisRender && isChangedState) {
        animateNodePulse(g);
      }
    }

    if (panning) {
      trackAnim(animateViewBoxPan(svg, prevBox, target, DUR.viewBoxPan));
    }
  }

  function drawRules(container, day, stateId, animate) {
    const state = day.states.find((s) => s.id === stateId);
    const rules = day.rules[stateId] || [];
    container.replaceChildren();
    const animateThisRender = shouldAnimate(animate);

    const head = document.createElement('div');
    head.className = 'fsm-rules__head';
    const heading = document.createElement('h3');
    heading.textContent = stateId;
    const desc = document.createElement('p');
    desc.textContent = state ? state.desc : '';
    head.appendChild(heading);
    head.appendChild(desc);
    container.appendChild(head);

    if (rules.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'fsm-rules__empty';
      empty.textContent = 'No assistance rules in this state — the robot stays out of the way.';
      container.appendChild(empty);
      return;
    }

    let newCardIndex = 0;
    for (const rule of rules) {
      const card = document.createElement('div');
      card.className = 'fsm-rule'
        + (rule.isNew ? ' is-new' : '')
        + (rule.isRevised ? ' is-revised' : '');

      const trig = document.createElement('p');
      trig.className = 'fsm-rule__triggers';
      trig.appendChild(document.createTextNode('when '));
      const newTriggerSpans = [];
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
        if (t.isNew) newTriggerSpans.push(span);
      });
      card.appendChild(trig);

      const act = document.createElement('p');
      act.className = 'fsm-rule__action';
      act.textContent = rule.action;
      card.appendChild(act);

      let was = null;
      if (rule.isRevised && rule.wasAction) {
        was = document.createElement('p');
        was.className = 'fsm-rule__was';
        was.textContent = `revised — previously: ${rule.wasAction}`;
        card.appendChild(was);
      }

      container.appendChild(card);

      if (animateThisRender) {
        if (rule.isRevised && was) {
          // The strongest moment on the page: the rewrite, not an append.
          animateRevisedCard(card, act, was, rule.wasAction);
        } else if (rule.isNew) {
          animateCardEnter(card, newCardIndex * DUR.cardStagger);
          newCardIndex += 1;
        } else if (newTriggerSpans.length) {
          // An existing, unrevised rule that only broadened a trigger this
          // day (Day 5's defining case: no new states, no new rules, only
          // new or-clauses on otherwise-unchanged rules).
          newTriggerSpans.forEach((span) => animateTriggerPulse(span));
        }
      }
    }
  }

  // The state selected when a day loads: always meal_preparation, on every
  // one of the six days. The left graph now carries "what changed today" in
  // its own color channel (a new state gets a filled/blue node, a state
  // whose rules merely changed gets a blue outline via is-changed), so
  // selection no longer needs to double as that signal — it used to jump to
  // whichever state the reflector actually touched (a revised rule, else a
  // new state, else a new rule, else a broadened trigger), which meant the
  // right pane could land on a different state every day and nothing was
  // directly comparable day over day. Pinning it to meal_preparation instead
  // gives the visitor a fixed reference point across the whole sequence.
  // meal_preparation exists on all six days in the real data, so the
  // fallback below is defensive only, not a real case: if it's ever absent,
  // fall back to the day's first state (or undefined for a genuinely empty
  // day, which render() already handles).
  function defaultState(day) {
    if (day.states.some((s) => s.id === 'meal_preparation')) return 'meal_preparation';
    if (!day.states.length) {
      console.warn(`Memory Evolution: day "${day.id}" has no states.`);
      return undefined;
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
      // The fallback figure is already on screen. Also quiet the intro copy
      // so the page doesn't reference an interactive view that never
      // appeared — "step through the days" / the legend swatch explanation
      // only make sense once #fsm is showing.
      const introInteractive = document.getElementById('fsm-intro-interactive');
      if (introInteractive) introInteractive.hidden = true;
      return;
    }

    const svg = document.getElementById('fsm-svg');
    const rules = document.getElementById('fsm-rules');
    const caption = document.getElementById('fsm-caption');
    const tabs = document.getElementById('fsm-days');
    const panel = document.getElementById('fsm-panel');

    let dayIndex = 0;
    let stateId = defaultState(data.days[0]);

    // The two panes animate independently: animateGraph is true only when
    // this render is the direct result of a day switch (activate()) — a
    // node click always renders with animateGraph=false, so clicking a node
    // never replays that day's arrival animation on the left (edges
    // redrawing, nodes re-pulsing/re-entering). animateRules, by contrast,
    // is true both on a day switch AND on a node click: the visitor clicked
    // a state specifically to see what changed there, so the right pane's
    // arrival animation (new cards rising, new/revised triggers, the
    // revised-rule rewrite) replays every time the selected state changes,
    // not just on a day switch. Both still collapse to "no animation" under
    // prefers-reduced-motion via shouldAnimate() inside drawGraph/drawRules.
    function render(animateGraph, animateRules) {
      cancelActiveAnimations();

      const day = data.days[dayIndex];
      // A day with zero states can never satisfy `.some(...)` below no
      // matter what stateId already holds, so a naive "is stateId still
      // valid" check would call defaultState(day) again on every render of
      // an empty day — double-warning for the same day (the warning is
      // logged once, from inside defaultState, at the call site that
      // actually resolves it: the initial `let stateId = defaultState(...)`
      // above, or activate() on a day switch). Treat "already undefined" as
      // already-resolved for an empty day so this check doesn't re-invoke
      // defaultState and warn a second time for no new information.
      const stateIsValid = day.states.length === 0
        ? stateId === undefined
        : day.states.some((s) => s.id === stateId);
      if (!stateIsValid) stateId = defaultState(day);

      caption.textContent = day.caption;
      drawGraph(svg, day, stateId, (id) => { stateId = id; render(false, true); }, animateGraph);
      drawRules(rules, day, stateId, animateRules);

      [...tabs.children].forEach((btn, i) => {
        const active = i === dayIndex;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', String(active));
        // Roving tabindex: only the active tab is Tab-reachable; arrow keys
        // move focus among the rest (handled below).
        btn.tabIndex = active ? 0 : -1;
      });
      if (panel && tabs.children[dayIndex]) {
        panel.setAttribute('aria-labelledby', tabs.children[dayIndex].id);
      }
    }

    function activate(index) {
      dayIndex = index;
      stateId = defaultState(data.days[index]);
      render(true, true);
    }

    data.days.forEach((day, i) => {
      const btn = document.createElement('button');
      btn.id = `fsm-tab-${i}`;
      btn.className = 'fsm__day';
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-controls', 'fsm-panel');
      btn.textContent = day.label;
      btn.addEventListener('click', () => activate(i));
      tabs.appendChild(btn);
    });

    // Left/right arrow keys move focus (and activate) between tabs, per the
    // standard tablist keyboard pattern.
    tabs.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const n = data.days.length;
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      const next = (dayIndex + delta + n) % n;
      activate(next);
      tabs.children[next].focus();
    });

    fallback.hidden = true;
    root.hidden = false;
    render(false, false);
  }

  document.addEventListener('DOMContentLoaded', setupMemoryEvolution);
}());
