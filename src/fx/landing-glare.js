// The override's plain fade (spec 10; the shader is the signature's, src/fx/exhaust-signature.js): a warm glow over the page, up over
// the first half and down over the second. Still a canvas so #landing-glare holds for the suite; no context is ever created on it.
// Other options (the arrival still passes reducedMotion) are ignored: the fade is the same for everyone.
export function startLandingGlare(root, { seconds = 1.2 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.id = 'landing-glare'; canvas.className = 'fade'; canvas.setAttribute('aria-hidden', 'true');
  root.append(canvas);
  let t = 0, done = false;
  return {
    tick(dt) {
      if (done) return;
      t += dt;
      const u = Math.min(1, t / seconds);
      canvas.style.opacity = String(u < 0.5 ? u * 2 : 2 - u * 2);
      if (u >= 1) this.dispose();
    },
    get done() { return done; },
    dispose() {
      done = true;
      canvas.remove();
    },
  };
}
