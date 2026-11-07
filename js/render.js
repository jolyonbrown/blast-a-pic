// Drawing helpers: beads, turrets, pads. Everything is drawn procedurally.

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// amt -1..1: negative darkens toward black, positive lightens toward white.
export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const f = (c) => Math.round(c + (t - c) * p);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------- beads

const beadCache = new Map();

// A fuse bead seen from above: a fat ring with a hole in the middle.
export function beadSprite(hex, size) {
  const px = Math.max(4, Math.round(size));
  const key = hex + px;
  if (beadCache.has(key)) return beadCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');
  const m = px / 2;
  const R = px * 0.47;
  const light = luminance(hex) > 0.8;

  // soft drop shadow
  g.fillStyle = 'rgba(60,40,20,0.18)';
  g.beginPath();
  g.arc(m + px * 0.03, m + px * 0.05, R, 0, Math.PI * 2);
  g.fill();

  const grad = g.createRadialGradient(m - R * 0.35, m - R * 0.4, R * 0.1, m, m, R);
  grad.addColorStop(0, shade(hex, 0.35));
  grad.addColorStop(0.55, hex);
  grad.addColorStop(1, shade(hex, light ? -0.18 : -0.22));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(m, m, R, 0, Math.PI * 2);
  g.fill();

  g.lineWidth = Math.max(1, px * 0.04);
  g.strokeStyle = shade(hex, light ? -0.25 : -0.3);
  g.stroke();

  // the hole
  const h = R * 0.34;
  const hg = g.createRadialGradient(m + h * 0.3, m + h * 0.3, 0, m, m, h);
  hg.addColorStop(0, shade(hex, -0.15));
  hg.addColorStop(1, shade(hex, -0.45));
  g.fillStyle = hg;
  g.beginPath();
  g.arc(m, m, h, 0, Math.PI * 2);
  g.fill();

  // glint
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = Math.max(1, px * 0.06);
  g.lineCap = 'round';
  g.beginPath();
  g.arc(m, m, R * 0.7, Math.PI * 1.1, Math.PI * 1.45);
  g.stroke();

  beadCache.set(key, c);
  return c;
}

export function clearSpriteCache() {
  beadCache.clear();
}

// ---------------------------------------------------------------- turrets

// Draws a turret centred on (x, y) inside a box of size u.
// opts: aim (radians, -PI/2 = up), recoil 0..1, blink 0..1, count
export function drawTurret(ctx, x, y, u, hex, opts = {}) {
  const aim = opts.aim ?? -Math.PI / 2;
  const recoil = opts.recoil ?? 0;
  const by = y - u * 0.08; // body centre
  const bodyR = u * 0.3;

  ctx.save();

  // shadow
  ctx.fillStyle = 'rgba(70,45,20,0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y + u * 0.34, u * 0.4, u * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  // barrel (behind the body)
  ctx.save();
  ctx.translate(x, by);
  ctx.rotate(aim + Math.PI / 2);
  const bl = u * 0.44 * (1 - recoil * 0.22);
  const bw = u * 0.17;
  ctx.fillStyle = shade(hex, -0.25);
  roundRect(ctx, -bw / 2, -bl, bw, bl, bw * 0.3);
  ctx.fill();
  ctx.fillStyle = shade(hex, -0.42);
  roundRect(ctx, -bw * 0.62, -bl - u * 0.02, bw * 1.24, u * 0.1, u * 0.04);
  ctx.fill();
  ctx.restore();

  // base plate with ammo count
  const pw = u * 0.82, ph = u * 0.3, py = y + u * 0.08;
  ctx.fillStyle = '#5a5068';
  roundRect(ctx, x - pw / 2, py, pw, ph, ph * 0.4);
  ctx.fill();
  ctx.fillStyle = '#6d6280';
  roundRect(ctx, x - pw / 2, py, pw, ph * 0.55, ph * 0.4);
  ctx.fill();

  // body
  const grad = ctx.createRadialGradient(x - bodyR * 0.35, by - bodyR * 0.45, bodyR * 0.1, x, by, bodyR);
  grad.addColorStop(0, shade(hex, 0.4));
  grad.addColorStop(0.6, hex);
  grad.addColorStop(1, shade(hex, -0.2));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, by, bodyR, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(1, u * 0.025);
  ctx.strokeStyle = shade(hex, -0.35);
  ctx.stroke();

  // face
  const look = [Math.cos(aim), Math.sin(aim)];
  const ex = bodyR * 0.36, ey = by - bodyR * 0.05;
  const er = bodyR * 0.24;
  const blink = opts.blink ?? 0;
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(x + s * ex, ey, er, er * (1.1 - blink * 0.95), 0, 0, Math.PI * 2);
    ctx.fill();
    if (blink < 0.6) {
      ctx.fillStyle = '#2b2733';
      ctx.beginPath();
      ctx.arc(x + s * ex + look[0] * er * 0.38, ey + look[1] * er * 0.38, er * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x + s * ex + look[0] * er * 0.38 - er * 0.18, ey + look[1] * er * 0.38 - er * 0.2, er * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // cheeks
  ctx.fillStyle = 'rgba(255,120,150,0.45)';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + s * bodyR * 0.62, by + bodyR * 0.35, bodyR * 0.15, bodyR * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (opts.count != null) {
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${Math.round(u * 0.22)}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(opts.count), x, py + ph * 0.54);
  }

  ctx.restore();
}

// A "?" turret: you'll find out what it is when it reaches the front.
export function drawMystery(ctx, x, y, u) {
  ctx.save();
  ctx.fillStyle = 'rgba(70,45,20,0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y + u * 0.34, u * 0.4, u * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  const s = u * 0.74;
  ctx.fillStyle = '#7b5cc4';
  roundRect(ctx, x - s / 2, y - s / 2, s, s, s * 0.22);
  ctx.fill();
  ctx.fillStyle = '#9677dd';
  roundRect(ctx, x - s / 2, y - s / 2, s, s * 0.8, s * 0.22);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `900 ${Math.round(u * 0.42)}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', x, y - s * 0.06);
  ctx.restore();
}

export function drawPad(ctx, x, y, u, style) {
  const s = u * 0.94;
  ctx.save();
  if (style === 'dock') {
    ctx.fillStyle = 'rgba(120,80,40,0.16)';
    roundRect(ctx, x - s / 2, y - s / 2 + u * 0.04, s, s, s * 0.2);
    ctx.fill();
    ctx.fillStyle = '#fffaf2';
    roundRect(ctx, x - s / 2, y - s / 2, s, s, s * 0.2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,120,80,0.25)';
    ctx.lineWidth = Math.max(1, u * 0.02);
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    roundRect(ctx, x - s / 2, y - s / 2, s, s, s * 0.2);
    ctx.fill();
  }
  ctx.restore();
}
