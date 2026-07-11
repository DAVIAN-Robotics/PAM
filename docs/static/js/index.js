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
