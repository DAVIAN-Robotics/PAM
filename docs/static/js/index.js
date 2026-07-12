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

document.addEventListener('DOMContentLoaded', () => {
  setupVideoSlots();
  setupBibtexCopy();
  setupHeadingAnchors();
});
