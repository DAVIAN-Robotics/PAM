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

// Give every section heading a "#" permalink. Subheadings have no id of their
// own, so slugify their text to make one.
function setupHeadingAnchors() {
  const slug = (text) => text.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');

  document.querySelectorAll('section[id]').forEach((section) => {
    section.querySelectorAll('h2, h3').forEach((heading, i) => {
      const id = i === 0 && heading.tagName === 'H2'
        ? section.id
        : `${section.id}-${slug(heading.textContent)}`;
      if (heading !== section.querySelector('h2')) heading.id = id;

      const anchor = document.createElement('a');
      anchor.className = 'heading-anchor';
      anchor.href = `#${id}`;
      anchor.textContent = '#';
      anchor.setAttribute('aria-label', `Permalink to "${heading.textContent.trim()}"`);
      heading.prepend(anchor);
    });
  });
}

// Keep the last two words of a block on one line, so no paragraph, caption, or
// heading ends with a single dangling word. CSS text-wrap: pretty does not do
// this in every browser, so swap the last word gap for a no-break space.
function glueLastWords(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  let seenWord = false;
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const text = nodes[i].nodeValue;
    for (let j = text.length - 1; j >= 0; j -= 1) {
      const isSpace = /\s/.test(text[j]) && text[j] !== '\u00a0';
      if (!isSpace) {
        seenWord = true;
      } else if (seenWord) {
        let start = j;
        while (start > 0 && /\s/.test(text[start - 1])) start -= 1;
        nodes[i].nodeValue = `${text.slice(0, start)}\u00a0${text.slice(j + 1)}`;
        return;
      }
    }
  }
}
window.glueLastWords = glueLastWords;

function setupNoDanglingWords() {
  document.querySelectorAll(
    '.content p, .content li, .figure-caption, .task-card__label, .task-card__caption, p.has-text-centered, h1, h2, h3',
  ).forEach(glueLastWords);
}

document.addEventListener('DOMContentLoaded', () => {
  setupVideoSlots();
  setupBibtexCopy();
  setupHeadingAnchors();
  setupNoDanglingWords();
});
