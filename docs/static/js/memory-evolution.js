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
  const VIEWBOX = '0 0 540 560';

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

  function el(name, attrs = {}, text = null) {
    const node = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== null) node.textContent = text;
    return node;
  }

  function drawGraph(svg, day, selectedState, onSelect) {
    svg.replaceChildren();
    svg.setAttribute('viewBox', VIEWBOX);
    const present = new Set(day.states.map((s) => s.id));

    const defs = el('defs');
    for (const [id, cls] of [['arrow', 'fsm-arrowhead'], ['arrow-new', 'fsm-arrowhead is-new']]) {
      const marker = el('marker', {
        id, viewBox: '0 0 10 10', refX: '8.5', refY: '5',
        markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse',
      });
      marker.appendChild(el('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: cls }));
      defs.appendChild(marker);
    }
    svg.appendChild(defs);

    // Edges first, so nodes paint over their endpoints.
    for (const t of day.transitions) {
      if (!present.has(t.from) || !present.has(t.to)) continue;
      const route = EDGE_ROUTES[`${t.from}->${t.to}`];
      if (!route) continue; // shouldn't happen with the current data, but stay safe

      const cls = ['fsm-edge']
        .concat(t.isNew ? ['is-new'] : [])
        .concat(route.isBack ? ['fsm-edge--back'] : [])
        .join(' ');
      const markerId = t.isNew ? 'arrow-new' : 'arrow';
      svg.appendChild(el('path', { d: route.d, class: cls, fill: 'none', 'marker-end': `url(#${markerId})` }));

      const labelCls = `fsm-edge-label${t.isNew ? ' is-new' : ''}`;
      svg.appendChild(el('text', {
        x: route.label.x, y: route.label.y, class: labelCls, 'text-anchor': route.label.anchor,
      }, t.label));
    }

    for (const s of day.states) {
      const p = POS[s.id];
      if (!p) {
        console.warn(`Memory Evolution: no layout position for state "${s.id}" — skipping.`);
        continue; // symmetric with the EDGE_ROUTES guard above: don't throw, don't blank the graph
      }
      const g = el('g', {
        class: `fsm-node${s.isNew ? ' is-new' : ''}${s.id === selectedState ? ' is-selected' : ''}`,
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
    }
  }

  function drawRules(container, day, stateId) {
    const state = day.states.find((s) => s.id === stateId);
    const rules = day.rules[stateId] || [];
    container.replaceChildren();

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

    function render() {
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
      drawGraph(svg, day, stateId, (id) => { stateId = id; render(); });
      drawRules(rules, day, stateId);

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
      render();
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
    render();
  }

  document.addEventListener('DOMContentLoaded', setupMemoryEvolution);
}());
