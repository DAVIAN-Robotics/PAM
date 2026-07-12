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
  // Fallback only — used if a day somehow has no positioned states (not the
  // case for any day in the current data). The real, per-day viewBox is
  // computed by viewBoxForDay() below.
  const DEFAULT_VIEWBOX = '0 0 540 560';
  const VIEWBOX_PAD = 20;

  // The graph's fixed layout (POS/NODE_W/NODE_H, untouched by this function)
  // packs every state that can ever appear, including cleaning_break's extra
  // column, into one 540x560 box. On Days 1-3, cleaning_break does not exist
  // yet, so that box is mostly empty on the right — the four-state spine
  // only occupies its left ~250 units. Because the SVG scales to its
  // container at a fixed aspect ratio (width: 100%; height: auto in CSS),
  // rendering that mostly-empty box at a narrow mobile width shrinks the
  // *content* (which only fills part of the box) even further, down to
  // unreadably small node text. Fitting the viewBox to the bounding box of
  // just the nodes actually drawn this day — rather than the fixed box that
  // fits every day at once — makes the content fill the available width on
  // every day, narrow four-state days included. Node positions themselves
  // (POS) are never touched; only the window we view them through changes.
  function viewBoxForDay(day) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of day.states) {
      const p = POS[s.id];
      if (!p) continue; // same guard as drawGraph: an unknown state id is skipped, not fatal
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + NODE_W);
      maxY = Math.max(maxY, p.y + NODE_H);
    }
    if (!Number.isFinite(minX)) return DEFAULT_VIEWBOX; // no positioned states this day
    minX -= VIEWBOX_PAD;
    minY -= VIEWBOX_PAD;
    maxX += VIEWBOX_PAD;
    maxY += VIEWBOX_PAD;
    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
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
    nodeEnter: 240,
    nodePulse: 480,
    edgeDraw: 260,
    edgeStagger: 80,
    edgeAfterNewNode: 120,
    arrowFade: 100,
    cardRise: 220,
    cardStagger: 90,
    triggerPulse: 420,
    revisedWas: 340,
    revisedAction: 260,
    revisedActionDelay: 160,
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

  function el(name, attrs = {}, text = null) {
    const node = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== null) node.textContent = text;
    return node;
  }

  // New state node: scales up from center and fades in.
  function animateNodeEnter(g) {
    trackAnim(g.animate(
      [
        { opacity: 0, transform: 'scale(0.85)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: DUR.nodeEnter, easing: 'ease-out' },
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

  // The revised rule (Routine Change only): the old action visibly gives way
  // to the new one. wasEl briefly reads like the old primary action — struck
  // through, slightly enlarged — then settles into its normal small
  // "revised — previously: …" caption size exactly as it always renders.
  // actionEl fades/slides into the primary slot a beat later, so the new
  // action visibly *replaces* the old rather than the two just co-appearing.
  function animateRevisedCard(actionEl, wasEl) {
    trackAnim(wasEl.animate(
      [
        { textDecorationLine: 'line-through', transform: 'scale(1.05)' },
        { textDecorationLine: 'line-through', transform: 'scale(1.05)', offset: 0.55 },
        { textDecorationLine: 'none', transform: 'scale(1)' },
      ],
      { duration: DUR.revisedWas, easing: 'ease-out' },
    ));
    trackAnim(actionEl.animate(
      [
        { opacity: 0, transform: 'translateY(6px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      {
        duration: DUR.revisedAction,
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
    svg.replaceChildren();
    svg.setAttribute('viewBox', viewBoxForDay(day));
    const present = new Set(day.states.map((s) => s.id));
    const animateThisRender = shouldAnimate(animate);
    const nodeIsArriving = animateThisRender && day.states.some((s) => s.isNew);
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
        const baseDelay = (nodeIsArriving ? DUR.edgeAfterNewNode : 0)
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
        animateNodeEnter(g);
      } else if (animateThisRender && isChangedState) {
        animateNodePulse(g);
      }
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
          animateRevisedCard(act, was);
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

  // The state a day is "about": the one the reflector touched. Prefer a
  // revised rule, then a new state, then a new rule, then a rule with at
  // least one new trigger clause; fall back to the first state.
  //
  // Day 5 has no revised rule, no new state, and no rule-level isNew flag —
  // it only carries new *trigger clauses* inside otherwise-existing rules.
  // Without the fourth pass below, Day 5 falls all the way through to
  // day.states[0].id, which happens to be meal_preparation — which happens
  // to also be the state with new trigger clauses. That's correct by
  // coincidence, not by design (eating and cleaning_break have new trigger
  // clauses too; meal_preparation only wins because it's first). The pass
  // below makes the same result explicit and correct, and does not change
  // the answer on any of the other five days, which all resolve earlier.
  function defaultState(day) {
    for (const [stateId, rules] of Object.entries(day.rules)) {
      if (rules.some((r) => r.isRevised)) return stateId;
    }
    const newState = day.states.find((s) => s.isNew);
    if (newState) return newState.id;
    for (const [stateId, rules] of Object.entries(day.rules)) {
      if (rules.some((r) => r.isNew)) return stateId;
    }
    for (const [stateId, rules] of Object.entries(day.rules)) {
      if (rules.some((r) => r.triggers.some((t) => t.isNew))) return stateId;
    }
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
