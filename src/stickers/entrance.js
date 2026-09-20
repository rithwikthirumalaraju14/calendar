// Adapted from stickeranimation idea/entrance.js. The original hinge, lighting,
// peek, and wave choreography now runs inside the optional sticker section.
export function playDoorEntrance({ root, app, shell, character, onPose, onFinish }) {
  const $ = (selector) => root.querySelector(selector);
  const entrance = $('#entrance');
  const world = $('#entrance-world');
  const reaction = $('#reaction');
  const home = reaction.parentNode;
  const nextSibling = reaction.nextSibling;
  const slot = $('#entrance-character-slot');
  const occlusion = $('#entrance-occlusion');
  const foreground = $('#entrance-foreground');
  const doorSet = $('#door-set');
  const leaf = $('#door-leaf');
  const thickness = $('#door-thickness');
  const spill = $('#door-light-spill');
  const castShadow = $('#door-cast-shadow');
  const shadow = $('#entrance-shadow');
  const handle = $('#door-handle');
  const plate = $('#door-handle-plate');
  const knob = $('#door-knob');
  const knobShadow = $('#door-knob-shadow');
  const face = reaction.querySelector('.face-follow');
  const eyes = [...reaction.querySelectorAll('.eye-socket')];
  const backdrop = $('.entrance-backdrop');
  const caption = $('.entrance-caption');
  const prompt = $('#door-prompt');
  const openDoor = $('#open-door');
  const skip = $('#skip-entrance');
  const previousFocus = root.activeElement;
  const surfaces = [...leaf.querySelectorAll('[data-door-path]')].map((node) => {
    node.dataset.doorPath ||= node.getAttribute('d');
    return { node, path: node.dataset.doorPath };
  });
  const duration = 7.35;
  const flightStart = 6.3;
  let elapsed = 0;
  let lastTime = null;
  let frame = null;
  let started = false;
  let finished = false;
  let inFront = false;

  const clamp = (value) => Math.max(0, Math.min(1, value));
  const smooth = (value) => { const p = clamp(value); return p * p * (3 - 2 * p); };
  const between = (time, start, end) => smooth((time - start) / (end - start));
  const mix = (from, to, progress) => from + (to - from) * progress;
  function sample(keys, time) {
    if (time <= keys[0][0]) return keys[0].slice(1);
    for (let index = 1; index < keys.length; index++) {
      if (time > keys[index][0]) continue;
      const from = keys[index - 1];
      const to = keys[index];
      const progress = between(time, from[0], to[0]);
      return from.slice(1).map((value, part) => mix(value, to[part + 1], progress));
    }
    return keys.at(-1).slice(1);
  }

  const doorBeats = [[0, 0], [1, 0], [1.55, 23], [2.1, 55], [3.2, 55], [3.45, 50], [4.05, 104], [4.85, 104], [5.7, 0], [duration, 0]];
  const ghostBeats = [
    [0, 445, 322, .43, .43, 0], [1.55, 445, 322, .43, .43, 0],
    [2.15, 444, 279, .44, .44, -9], [2.55, 448, 276, .44, .44, -7],
    [3.15, 440, 279, .44, .44, -3], [3.45, 435, 294, .46, .42, 2],
    [4.05, 399, 282, .49, .49, 0], [4.55, 400, 241, .79, .87, -3],
    [4.9, 400, 237, .88, .82, 1], [5.2, 400, 250, .84, .84, 0],
    [5.6, 400, 246, .84, .84, 3], [6, 400, 250, .84, .84, -2],
    [flightStart, 400, 250, .84, .84, 0],
  ];
  const lookBeats = [[0, 0, 0], [2.1, 0, 0], [2.35, -10, 2], [2.6, -10, 2], [2.87, 9, -2], [3.12, 0, 0], [5.15, 0, 0], [5.4, -8, 3], [5.72, 0, 0]];

  function renderDoor(angle) {
    const radians = angle * Math.PI / 180;
    const sine = Math.sin(radians);
    const cosine = Math.cos(radians);
    function project(x, y, depth = 0) {
      const z = x * sine + depth * cosine;
      const perspective = 760 / (760 - z);
      return [400 + (304 + x * cosine - depth * sine - 400) * perspective, 287 + (155 + y - 287) * perspective];
    }
    const point = (x, y, depth) => project(x, y, depth).map((value) => value.toFixed(2)).join(' ');
    for (const surface of surfaces) {
      surface.node.setAttribute('d', surface.path.replace(/(-?\d*\.?\d+)[ ,]+(-?\d*\.?\d+)/g, (_, x, y) => point(Number(x), Number(y))));
    }
    thickness.setAttribute('d', `M${point(188, 0)} L${point(188, 264)} L${point(188, 264, -6)} L${point(188, 0, -6)}Z`);
    const [handleX, handleY] = project(166, 132, 4);
    for (const node of [plate, knob, knobShadow]) {
      node.setAttribute('cx', handleX + (node === knobShadow ? 3 : 0));
      node.setAttribute('cy', handleY + (node === knobShadow ? 3 : 0));
    }
    plate.setAttribute('rx', 3 + Math.abs(cosine) * 3);
    plate.setAttribute('ry', 10);
    handle.style.opacity = 1 - smooth((angle - 80) / 12);
    const light = smooth(angle / 80);
    const gap = mix(490, 305, light);
    spill.setAttribute('d', `M${gap} 420 L492 420 L${675 + light * 35} 565 L${gap - light * 125} 565Z`);
    spill.style.opacity = light;
    const [edgeX] = project(188, 264);
    castShadow.setAttribute('d', `M304 424 L${edgeX} 424 L${edgeX - sine * 95} ${434 + sine * 80} L280 441Z`);
    castShadow.style.opacity = light * .42;
  }

  function render(time) {
    const flight = between(time, flightStart, duration);
    const [angle] = sample(doorBeats, time);
    renderDoor(angle);
    doorSet.style.opacity = 1 - between(time, 5.95, 6.85);
    backdrop.style.opacity = 1 - flight;
    app.style.setProperty('--page-reveal', flight);
    skip.style.opacity = 1 - flight;
    caption.style.opacity = between(time, 5.55, 5.95) * (1 - between(time, 6.25, 6.75));
    caption.style.transform = `translateY(${(1 - between(time, 5.55, 5.95)) * 6}px)`;
    if (time >= 4.05 && !inFront) { foreground.append(slot); inFront = true; }
    const [x, y, scaleX, scaleY, tilt] = sample(ghostBeats, time);
    let matrix = new DOMMatrix().translate(x, y).rotate(tilt).scale(scaleX, scaleY).translate(-260, -205);
    if (time > flightStart) {
      const destination = world.getScreenCTM().inverse().multiply(character.getScreenCTM());
      matrix = new DOMMatrix(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => mix(matrix[key], destination[key], flight)));
    }
    slot.setAttribute('transform', `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`);
    slot.style.opacity = between(time, 1.35, 1.7);
    const emergence = between(time, 4.05, 4.9);
    shadow.setAttribute('rx', mix(27, 85, emergence));
    shadow.setAttribute('ry', mix(4, 10, emergence));
    shadow.setAttribute('cy', mix(422, 465, emergence));
    shadow.style.opacity = emergence * .48 * (1 - flight);
    const [lookX, lookY] = sample(lookBeats, time);
    face.style.setProperty('--look-x', `${lookX}px`);
    face.style.setProperty('--look-y', `${lookY}px`);
    const blink = (between(time, 2.62, 2.69) - between(time, 2.72, 2.82)) * .94;
    eyes.forEach((eye) => { eye.style.transform = `scaleY(${1 - blink})`; });
    reaction.style.setProperty('--entrance-smile', between(time, 4.85, 5.2) * (1 - between(time, 6.05, 6.25)));
    reaction.style.setProperty('--arrival', between(time, 6.7, duration));
    onPose(Math.max(0, time - 5.55) * 1000, between(time, 5.55, 5.8) * (1 - between(time, 6.15, 6.5)));
  }

  function finish({ restoreFocus = true } = {}) {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    home.insertBefore(reaction, nextSibling);
    reaction.classList.remove('is-entering');
    reaction.style.removeProperty('--arrival');
    reaction.style.removeProperty('--entrance-smile');
    face.style.removeProperty('--look-x');
    face.style.removeProperty('--look-y');
    eyes.forEach((eye) => eye.style.removeProperty('transform'));
    occlusion.append(slot);
    entrance.hidden = true;
    app.inert = false;
    app.style.removeProperty('--page-reveal');
    shell.classList.remove('has-entrance');
    openDoor.removeEventListener('click', start);
    skip.removeEventListener('click', finish);
    document.removeEventListener('visibilitychange', onVisibility);
    onFinish();
    if (restoreFocus) (app.contains(previousFocus) ? previousFocus : $('#boop')).focus({ preventScroll: true });
  }
  function tick(now) {
    frame = null;
    if (!started || finished || document.hidden) return;
    // Use elapsed time so a low-frame-rate phone still gets a six-second hello.
    // Visibility changes reset lastTime, preserving a true pause in the background.
    if (lastTime !== null) elapsed += (now - lastTime) / 1000;
    lastTime = now;
    try {
      render(Math.min(elapsed, duration));
      if (elapsed >= duration) finish();
      else frame = requestAnimationFrame(tick);
    } catch (error) {
      finish();
      console.error('The little doorway could not finish:', error);
    }
  }
  function start() {
    if (started || finished) return;
    started = true;
    elapsed = 1;
    lastTime = null;
    prompt.hidden = true;
    skip.focus({ preventScroll: true });
    if (!document.hidden) frame = requestAnimationFrame(tick);
  }
  function onVisibility() {
    cancelAnimationFrame(frame);
    frame = null;
    lastTime = null;
    if (!document.hidden && started && !finished) frame = requestAnimationFrame(tick);
  }
  entrance.hidden = false;
  app.inert = true;
  shell.classList.add('has-entrance');
  reaction.classList.add('is-entering');
  occlusion.append(slot);
  slot.append(reaction);
  prompt.hidden = false;
  render(0);
  openDoor.focus({ preventScroll: true });
  openDoor.addEventListener('click', start);
  skip.addEventListener('click', finish);
  document.addEventListener('visibilitychange', onVisibility);
  return finish;
}
