// Renders one day of the PAM FSM: a fixed-layout SVG graph plus the rules of
// the selected state. Everything is driven by static/data/pam-fsm.json.

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
const EDGE_ROUTES = {
  // Vertical spine edges: label sits centered in the gap between the two
  // nodes it connects, well clear of both borders.
  'meal_preparation->eating': {
    d: `M 125 ${20 + NODE_H} L 125 140`,
    label: { x: 137, y: 112, anchor: 'start' },
  },
  'eating->working': {
    d: `M 125 ${140 + NODE_H} L 125 260`,
    label: { x: 137, y: 232, anchor: 'start' },
  },
  'working->leaving': {
    // The working-leaving gap is tall (it also has to clear the loop's
    // back-edge label below), so its label sits low in the gap.
    d: `M 125 ${260 + NODE_H} L 125 460`,
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
