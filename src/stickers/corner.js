import ghostSvg from './ghost.svg?raw';
import doorSvg from './door.svg?raw';
import artStyles from './art.css?inline';
import { numbers, createMoods, cubicPath, wave } from './poses.js';
import { playDoorEntrance } from './entrance.js';

const icons = {
  idle: '<path d="M5 20V10a7 7 0 0 1 14 0v10l-3-2-4 2-4-2-3 2Z"/><path d="M9 10v1m6-1v1m-5 3q2 2 4 0"/>',
  hi: '<path d="M9 13V6a1.5 1.5 0 0 1 3 0v6-8a1.5 1.5 0 0 1 3 0v8-6a1.5 1.5 0 0 1 3 0v7-3a1.5 1.5 0 0 1 3 0v5a7 7 0 0 1-12 5l-5-5a1.5 1.5 0 0 1 2-2l3 2M3 5l2 2M4 2l3 1"/>',
  happy: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z"/>',
  love: '<path d="M12 20S3 14 3 8a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 12-9 12Z"/>',
  angry: '<path d="M9 3v3a3 3 0 0 1-3 3H3m12-6v3a3 3 0 0 0 3 3h3M3 15h3a3 3 0 0 1 3 3v3m12-6h-3a3 3 0 0 0-3 3v3"/>',
  morning: '<path d="M4 9h12v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9Zm12 1h2a3 3 0 0 1 0 6h-2M7 3v2m4-3v3m4-2v2M2 22h18"/>',
  gn: '<path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12ZM17 3v4m-2-2h4"/>',
  door: '<path d="M5 21V3h14v18M5 3l10 3v15H5m-2 0h18M11 12v1"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;

function createCorner(host) {
  const root = host.attachShadow({ mode: 'open' });
  // These strings are bundled, trusted local artwork; no user text is parsed as HTML.
  root.innerHTML = `<style>${artStyles}</style>
    <div class="corner-shell is-dormant" id="corner-shell">
      <div class="corner-app" id="corner-app" data-mood="idle">
        <section class="stage" aria-label="deyam’s animated ghost">
          <div class="stage-glow" aria-hidden="true"></div>
          <p class="speech-bubble" id="speech" aria-hidden="true"></p>
          <button class="character-button" id="boop" type="button" aria-label="Boop deyam’s ghost for a little reaction">${ghostSvg}</button>
          <div class="ground-shadow" aria-hidden="true"></div>
          <p class="boop-hint">psst… tap the ghost for a little surprise</p>
          <div class="playback-controls" role="group" aria-label="Animation playback">
            <button id="replay" type="button"><span aria-hidden="true">↻</span> Replay</button>
            <button id="pause" type="button" aria-pressed="false"><span id="pause-icon" aria-hidden="true">Ⅱ</span><span id="pause-label">Pause motion</span></button>
          </div>
        </section>
        <section class="mood-panel" aria-labelledby="mood-heading">
          <div class="panel-heading"><h3 id="mood-heading">EVERY LITTLE FEELING</h3><span class="mood-count">made for deyam</span></div>
          <div class="mood-buttons" id="mood-buttons" role="group" aria-label="Choose a ghost animation"></div>
          <p class="mood-description" id="mood-status" role="status" aria-live="polite" aria-atomic="true"></p>
        </section>
      </div>
      <section class="entrance" id="entrance" aria-label="A little doorway hello for deyam" hidden>
        <div class="entrance-backdrop"></div>${doorSvg}
        <div class="entrance-prompt" id="door-prompt"><button class="entrance-open" id="open-door" type="button" aria-describedby="door-invitation">Open the door <span aria-hidden="true">↗</span></button><p id="door-invitation">Someone’s been waiting to say hi, deyam.</p></div>
        <p class="entrance-caption" aria-hidden="true">oh. there you are, deyam.</p>
        <button class="entrance-skip" id="skip-entrance" type="button">Skip hello <span aria-hidden="true">↗</span></button>
      </section>
    </div>`;

  const $ = (selector) => root.querySelector(selector);
  const app = $('#corner-app');
  const shell = $('#corner-shell');
  const character = $('#character');
  const bodyPath = $('#body-shape');
  const leftEye = $('#eye-left');
  const rightEye = $('#eye-right');
  const mouthPath = $('#mouth');
  const face = $('.face-follow');
  const reaction = $('#reaction');
  const speech = $('#speech');
  const status = $('#mood-status');
  const pauseButton = $('#pause');
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const restingBody = numbers(bodyPath.getAttribute('d'));
  const moods = createMoods(restingBody, numbers(leftEye.getAttribute('d')), numbers(mouthPath.getAttribute('d')));
  const buttons = $('#mood-buttons');
  for (const [name, mood] of Object.entries(moods)) {
    const button = document.createElement('button');
    button.className = 'mood-button';
    button.type = 'button';
    button.dataset.mood = name;
    button.setAttribute('aria-pressed', String(name === 'idle'));
    button.innerHTML = `${icon(name)}<span>${mood.label}</span>`;
    buttons.append(button);
  }
  const doorwayButton = document.createElement('button');
  doorwayButton.id = 'doorway';
  doorwayButton.className = 'doorway-button';
  doorwayButton.type = 'button';
  doorwayButton.setAttribute('aria-controls', 'entrance');
  doorwayButton.innerHTML = `${icon('door')}<span>Doorway hello</span>`;
  buttons.append(doorwayButton);
  const moodButtons = [...root.querySelectorAll('.mood-button')];
  const clonePose = (pose) => ({ body: [...pose.body], eye: [...pose.eye], mouth: [...pose.mouth] });
  let currentMood = 'idle';
  let currentPose = clonePose(moods.idle);
  let transition = null;
  let frame = null;
  let lastTime = null;
  let moodTime = 0;
  let paused = false;
  let active = false;
  let reactionAnimation = null;
  let finishEntrance = null;

  function draw(pose) {
    bodyPath.setAttribute('d', cubicPath(pose.body));
    leftEye.setAttribute('d', cubicPath(pose.eye));
    rightEye.setAttribute('d', cubicPath(pose.eye, true, 101));
    mouthPath.setAttribute('d', cubicPath(pose.mouth, false));
  }
  const canAnimate = () => active && !document.hidden && !paused && !preference.matches && !finishEntrance;
  function stopFrame() { cancelAnimationFrame(frame); frame = null; lastTime = null; }
  function animate(time) {
    frame = null;
    if (!canAnimate()) return;
    const delta = lastTime === null ? 0 : time - lastTime;
    lastTime = time;
    moodTime += delta;
    if (transition) {
      transition.elapsed += delta;
      const progress = Math.min(transition.elapsed / 700, 1);
      const eased = 1 - (1 - progress) ** 3;
      for (const part of ['body', 'eye', 'mouth']) {
        currentPose[part] = transition.from[part].map((value, index) => value + (moods[currentMood][part][index] - value) * eased);
      }
      if (progress === 1) transition = null;
      draw(currentPose);
    }
    if (currentMood === 'hi') draw({ ...currentPose, body: wave(currentPose.body, moodTime, Math.min(moodTime / 700, 1)) });
    if (transition || currentMood === 'hi') frame = requestAnimationFrame(animate);
  }
  function startAnimation() {
    if (frame === null && canAnimate() && (transition || currentMood === 'hi')) {
      lastTime = null;
      frame = requestAnimationFrame(animate);
    }
  }
  function clearLook() { face.style.setProperty('--look-x', '0px'); face.style.setProperty('--look-y', '0px'); }
  function setMood(name, { booped = false } = {}) {
    if (!Object.hasOwn(moods, name)) return;
    const visiblePose = { ...clonePose(currentPose), body: numbers(bodyPath.getAttribute('d')) };
    currentMood = name;
    moodTime = 0;
    app.dataset.mood = name;
    clearLook();
    speech.textContent = booped ? name === 'morning' ? 'Oh! Morning already, deyam?' : 'Hehe. That tickles, deyam!' : moods[name].speech;
    status.textContent = `${speech.textContent} ${moods[name].description}`;
    $('#ghost-description').textContent = `deyam’s lavender-and-white ghost. ${moods[name].description}`;
    moodButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mood === name)));
    reactionAnimation?.cancel();
    for (const animation of character.getAnimations({ subtree: true })) {
      if (animation instanceof CSSAnimation) animation.currentTime = 0;
    }
    if (paused || preference.matches || !active) {
      transition = null;
      currentPose = clonePose(moods[name]);
      draw(currentPose);
    } else {
      transition = { from: visiblePose, elapsed: 0 };
      reactionAnimation = reaction.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(.955, 1.025)', offset: .32 }, { transform: 'scale(1)' }],
        { duration: 650, easing: 'cubic-bezier(.22, 1, .36, 1)' },
      );
      startAnimation();
    }
  }
  function syncActivity() {
    shell.classList.toggle('is-dormant', !active || document.hidden);
    app.classList.toggle('is-paused', paused);
    if (canAnimate()) {
      if (reactionAnimation?.playState === 'paused') reactionAnimation.play();
      startAnimation();
    } else {
      stopFrame();
      reactionAnimation?.pause();
    }
  }
  function updatePauseLabel() {
    pauseButton.disabled = preference.matches;
    pauseButton.setAttribute('aria-pressed', String(paused));
    $('#pause-label').textContent = preference.matches ? 'Reduced motion' : paused ? 'Resume motion' : 'Pause motion';
    $('#pause-icon').textContent = paused ? '▷' : 'Ⅱ';
    doorwayButton.disabled = preference.matches;
    doorwayButton.title = preference.matches ? 'Doorway motion follows your reduced-motion setting' : 'A little doorway hello';
  }
  function syncPreference() {
    if (preference.matches) {
      finishEntrance?.();
      stopFrame();
      transition = null;
      reactionAnimation?.cancel();
      currentPose = clonePose(moods[currentMood]);
      draw(currentPose);
      clearLook();
    }
    updatePauseLabel();
    syncActivity();
  }
  function setupEntrance() {
    if (!active || finishEntrance || preference.matches) return;
    setMood('idle');
    reactionAnimation?.cancel();
    transition = null;
    stopFrame();
    currentPose = clonePose(moods.idle);
    draw(currentPose);
    finishEntrance = playDoorEntrance({
      root, app, shell, character,
      onPose: (time, strength) => draw({ ...moods.idle, body: wave(restingBody, time, strength) }),
      onFinish: () => { finishEntrance = null; draw(currentPose); clearLook(); syncActivity(); },
    });
  }

  moodButtons.forEach((button) => button.addEventListener('click', () => setMood(button.dataset.mood)));
  $('#replay').addEventListener('click', () => setMood(currentMood));
  doorwayButton.addEventListener('click', setupEntrance);
  pauseButton.addEventListener('click', () => { paused = !paused; updatePauseLabel(); syncActivity(); });
  $('#boop').addEventListener('click', () => {
    const next = currentMood === 'gn' ? 'morning' : currentMood === 'morning' ? 'hi' : currentMood === 'happy' ? 'love' : 'happy';
    setMood(next, { booped: true });
  });
  $('.stage').addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' || !canAnimate() || currentMood === 'gn') return;
    const bounds = character.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2)));
    const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top - bounds.height / 2) / (bounds.height / 2)));
    face.style.setProperty('--look-x', `${(x * 5).toFixed(2)}px`);
    face.style.setProperty('--look-y', `${(y * 3).toFixed(2)}px`);
  });
  $('.stage').addEventListener('pointerleave', () => { if (!paused) clearLook(); });
  document.addEventListener('visibilitychange', syncActivity);
  preference.addEventListener('change', syncPreference);
  setMood('idle');
  syncPreference();
  return {
    setActive(value) {
      active = value;
      if (!active) finishEntrance?.({ restoreFocus: false });
      syncActivity();
    },
  };
}

export function setupStickerCorner() {
  const dialog = document.getElementById('stickers-dialog');
  const opener = document.getElementById('open-stickers');
  const host = document.getElementById('sticker-root');
  let corner;
  opener.addEventListener('click', () => {
    corner ??= createCorner(host);
    dialog.showModal();
    document.body.classList.add('stickers-open');
    opener.setAttribute('aria-expanded', 'true');
    corner.setActive(true);
    document.getElementById('close-stickers').focus({ preventScroll: true });
  });
  document.getElementById('close-stickers').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    corner?.setActive(false);
    document.body.classList.remove('stickers-open');
    opener.setAttribute('aria-expanded', 'false');
    opener.focus({ preventScroll: true });
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  // Include the shadow-root controls in an explicit wrap so Shift+Tab cannot
  // jump to browser chrome when the close button is the first focused control.
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button'), ...(host.shadowRoot?.querySelectorAll('button') ?? [])]
      .filter((button) => !button.disabled && !button.closest('[inert]') && button.getClientRects().length);
    const focused = host.shadowRoot?.activeElement ?? document.activeElement;
    if (event.shiftKey && (focused === controls[0] || !controls.includes(focused))) {
      event.preventDefault();
      controls.at(-1)?.focus();
    } else if (!event.shiftKey && (focused === controls.at(-1) || !controls.includes(focused))) {
      event.preventDefault();
      controls[0]?.focus();
    }
  });
}
