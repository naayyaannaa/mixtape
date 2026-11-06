"use client";

import { useEffect, useRef, useState } from "react";

type RGB = [number, number, number]; // 0–255
/**
 * `colors` dark → light. `baseIndex`/`baseHue`: which of them is the cover's most
 * prominent colour, and its hue (0–1): the one the colour slider changes.
 */
export type Palette = {
  colors: [RGB, RGB, RGB, RGB];
  text: string;
  baseHue: number;
  baseIndex: number;
};

// Shown before a cover loads (and if one can't be read): soft greys.
const DEFAULT: Palette = {
  colors: [
    [96, 96, 96],
    [128, 128, 128],
    [156, 156, 156],
    [184, 184, 184],
  ],
  text: "#ffffff",
  baseHue: 0,
  baseIndex: 0,
};

/* ------------------------------------------------------------------ */
/* Colour sampling                                                     */
/* ------------------------------------------------------------------ */

const SIZE = 32; // a 32×32 thumbnail is plenty for colour, and very cheap

export function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

export function hslToRgb([h, s, l]: [number, number, number]): RGB {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255];
}

const lum = ([r, g, b]: RGB) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

const BINS = 36; // 10° hue buckets
const MIN_GAP_BINS = 3; // picked hues are at least 30° apart: clearly different colours
const hueDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % 1;
  return Math.min(d, 1 - d);
};

/**
 * 4 different hues, all taken from the cover, as rich colours, ordered dark → light.
 *
 * Only pixels that are actually colourful vote (greys, near-black and near-white
 * have no real hue and would otherwise turn into random colours once saturated).
 * Votes go into a 36-bucket hue histogram; up to 4 hues at least 30° apart win,
 * as long as each is a real part of the cover (≥3% of its colour), so stray
 * pixels don't count. Each gets the average saturation/lightness of the cover
 * pixels with that hue, then a saturation boost.
 * Black and white compete for slots too when they're a big part of the cover.
 * A cover with fewer than 4 colours never gets invented hues: the spare slots
 * are darker and lighter shades of its own hues.
 */
async function samplePalette(url: string): Promise<Palette> {
  const img = new Image();
  img.crossOrigin = "anonymous"; // Spotify's image CDN allows this
  img.src = url;
  await img.decode();

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

  const hsl: [number, number, number][] = [];
  for (let i = 0; i < data.length; i += 4) hsl.push(rgbToHsl([data[i], data[i + 1], data[i + 2]]));

  // Hue histogram, weighted by how colourful each pixel is.
  const votes = new Float64Array(BINS);
  for (const [h, s, l] of hsl) {
    if (s < 0.15 || l < 0.1 || l > 0.92) continue;
    votes[Math.floor(h * BINS) % BINS] += s * (1 - Math.abs(2 * l - 1) * 0.6);
  }
  // Smooth across neighbouring buckets so one hue split over two buckets still wins.
  const smooth = votes.map(
    (v, i) => (votes[(i + BINS - 1) % BINS] + 2 * v + votes[(i + 1) % BINS]) / 4,
  );
  const total = votes.reduce((a, b) => a + b, 0);

  // Strongest hues first, each at least 30° from the ones already taken.
  const picked: number[] = [];
  const order = [...smooth.keys()].sort((a, b) => smooth[b] - smooth[a]);
  for (const bin of order) {
    if (picked.length === 4) break;
    if (smooth[bin] < Math.max(total * 0.03, 0.5)) break; // not really on the cover
    const gap = (b: number) => Math.min(Math.abs(b - bin), BINS - Math.abs(b - bin));
    if (picked.every((b) => gap(b) >= MIN_GAP_BINS)) picked.push(bin);
  }

  // The cover's own look for each picked hue: average of its pixels within ±15°.
  const colourOf = (bin: number): [number, number, number] => {
    const centre = (bin + 0.5) / BINS;
    let w = 0, x = 0, y = 0, s = 0, l = 0;
    for (const [ph, ps, pl] of hsl) {
      if (ps < 0.15 || pl < 0.1 || pl > 0.92 || hueDist(ph, centre) > 1.5 / BINS) continue;
      w += ps; s += ps * ps; l += pl * ps;
      x += Math.cos(ph * 2 * Math.PI) * ps; y += Math.sin(ph * 2 * Math.PI) * ps;
    }
    if (!w) return [centre, 0.8, 0.5];
    return [(Math.atan2(y, x) / (2 * Math.PI) + 1) % 1, s / w, l / w];
  };
  const chosen = picked.map(colourOf);

  // Black and white count too, when they're a real part of the cover (≥12% of
  // it): kept as the cover's own near-black / off-white, slight tint and all.
  const neutral = (dark: boolean) => {
    let n = 0, r = 0, g = 0, b = 0;
    hsl.forEach(([, ps, pl], i) => {
      const hit = dark ? pl < 0.16 || (pl < 0.26 && ps < 0.15) : pl > 0.93 || (pl > 0.84 && ps < 0.3);
      if (!hit) return;
      n++; r += data[i * 4]; g += data[i * 4 + 1]; b += data[i * 4 + 2];
    });
    if (!n) return null;
    const [h, ps, pl] = rgbToHsl([r / n, g / n, b / n]);
    const l = dark ? Math.min(pl, 0.1) : Math.max(pl, 0.9);
    return { color: hslToRgb([h, Math.min(ps, 0.35), l]), share: n / hsl.length };
  };
  const neutrals = [neutral(true), neutral(false)].filter(
    (x): x is { color: RGB; share: number } => !!x && x.share >= 0.12,
  );

  if (!chosen.length) {
    // Black-and-white cover: its black / white plus greys between (use the
    // colour slider to tint it).
    const greys = [0.1, 0.38, 0.62, 0.9].map((l) => hslToRgb([0, 0, l]));
    const dark = neutrals.find((x) => lum(x.color) < 0.5)?.color;
    const light = neutrals.find((x) => lum(x.color) >= 0.5)?.color;
    const colors = [dark ?? greys[0], greys[1], greys[2], light ?? greys[3]] as Palette["colors"];
    return { colors, text: textFor(colors), baseHue: 0, baseIndex: 1 };
  }
  // Rich versions of the cover's hues. Olive / khaki (yellow-greens) look muddy
  // once boosted, so they lean to gold; clear greens stay green.
  const rich = chosen.map(([h, s, l]): [number, number, number] => [
    h > 50 / 360 && h < 95 / 360 ? 45 / 360 : h,
    Math.min(1, Math.max(0.75, s * 1.6)),
    Math.min(0.62, Math.max(0.36, l)),
  ]);
  // How much of the cover each hue covers, to rank it against black / white.
  const hueShare = chosen.map(([h]) => {
    let n = 0;
    for (const [ph, ps, pl] of hsl) {
      if (ps >= 0.15 && pl >= 0.1 && pl <= 0.92 && hueDist(ph, h) <= 1.5 / BINS) n++;
    }
    return n / hsl.length;
  });

  // The strongest hue always; then the rest of the hues and black / white by
  // how much of the cover they take up.
  const base = hslToRgb(rich[0]);
  const ranked = [
    ...rich.slice(1).map((c, i) => ({ color: hslToRgb(c), share: hueShare[i + 1] })),
    ...neutrals,
  ].sort((a, b) => b.share - a.share);
  const picks = [base, ...ranked.slice(0, 3).map((x) => x.color)];

  // Fewer than 4: deep and light shades of the cover's own hues (strongest
  // first), never a hue that isn't there.
  const shades = [
    ...rich.map(([h, s, l]): [number, number, number] => [h, s, Math.max(0.2, l - 0.2)]),
    ...rich.map(([h, s, l]): [number, number, number] => [h, s * 0.85, Math.min(0.8, l + 0.2)]),
    ...rich.map(([h, s, l]): [number, number, number] => [h, s, Math.max(0.14, l - 0.34)]),
  ].map((c) => hslToRgb(c));
  const four = [...picks, ...shades].slice(0, 4);

  const colors = [...four].sort((a, b) => lum(a) - lum(b)) as Palette["colors"];
  return { colors, text: textFor(colors), baseHue: chosen[0][0], baseIndex: colors.indexOf(base) };
}

const textFor = (colors: RGB[]) =>
  colors.reduce((s, c) => s + lum(c), 0) / colors.length > 0.55 ? "#161616" : "#ffffff";

/** The colour slider's range: ±180° of hues, plus a black end and a white end beyond them. */
export const HUE_RANGE = 180;
export const TONE_RANGE = 30;

/**
 * Colour slider: the cover's main colour stays put; the other three turn around
 * the colour wheel by `shiftDeg` (keeping their distances from each other).
 * The further they turn, the more washed-out ones pick up saturation, so even
 * grey-ish accents visibly take on the new colours.
 * Past -180° the accents fade into black, past +180° into white (deep and pale
 * tones, so the three still differ a little).
 */
export function shiftPalette(p: Palette, shiftDeg: number): Palette {
  if (!shiftDeg) return p;
  const turn = Math.max(-HUE_RANGE, Math.min(HUE_RANGE, shiftDeg));
  const tone = Math.min(1, Math.max(0, (Math.abs(shiftDeg) - HUE_RANGE) / TONE_RANGE));
  const amount = Math.min(1, Math.abs(turn) / 30);
  let n = 0;
  const colors = p.colors.map((c, i) => {
    if (i === p.baseIndex) return c;
    const [h, s, l] = rgbToHsl(c);
    let out = c;
    if (l >= 0.15 && l <= 0.85) {
      // (the cover's own black / white aren't turned)
      out = hslToRgb([(h + turn / 360 + 1) % 1, s + (Math.max(s, 0.8) - s) * amount, l]);
    }
    if (tone > 0) {
      const target = shiftDeg < 0 ? [0.04, 0.1, 0.17][n] : [0.97, 0.9, 0.83][n];
      const [th, ts, tl] = rgbToHsl(out);
      out = hslToRgb([th, ts * (1 - tone * 0.85), tl + (target - tl) * tone]);
    }
    n++;
    return out;
  }) as Palette["colors"];
  return { ...p, colors, text: textFor(colors) };
}

/** Hue (0–1) of the cover's first accent colour (not the main one): the colour slider's centre. */
export function accentHue(p: Palette): number {
  const i = p.colors.findIndex((_, j) => j !== p.baseIndex);
  return rgbToHsl(p.colors[i])[0];
}

export function useCoverPalette(cover?: string): Palette {
  const [palette, setPalette] = useState<Palette>(DEFAULT);

  useEffect(() => {
    if (!cover) return;
    let stale = false;
    samplePalette(cover)
      .then((p) => !stale && setPalette(p))
      // Keep the previous colours if the image can't be read.
      .catch((e) => console.info("[mixtape player] couldn't sample cover colours:", e));
    return () => {
      stale = true;
    };
  }, [cover]);

  return palette;
}

/* ------------------------------------------------------------------ */
/* Animated background (WebGL)                                         */
/* ------------------------------------------------------------------ */

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

// Big soft round blobs of the 4 cover colours drifting around, blended so each
// area takes the colour of its nearest blob, with a low-frequency warp so the
// edges ripple like liquid. uNoise: 0 = very soft blend, 0.6 = soft blobs,
// 1 = the colours woven into
// interleaved, dragged marble streaks. A fine grain keeps it matte.
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uNoise;
uniform float uBrightness; // -1 = saturated/vivid … 0 = as is … 1 = whiter/pastel
uniform float uAllowGreen; // 1 when the palette really has green in it
uniform float uSat;        // the palette's average saturation
uniform vec3 uC0, uC1, uC2, uC3;

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

// Keep blends clean. Mixing two different colours in RGB dulls the in-between
// (blue + yellow → grey-green). So: give blends back the palette's saturation,
// and unless the palette has green, rush hues between yellow and sky blue past
// green so it only shows as a thin, bright transition.
vec3 clean(vec3 c) {
  vec3 h = rgb2hsv(c);
  // (only for pixels that are already colourful: black, white and their soft
  // blends stay neutral instead of picking up a tint)
  h.y = mix(h.y, max(h.y, uSat * 0.85), smoothstep(0.08, 0.3, h.y));
  if (uAllowGreen < 0.5 && h.x > 0.12 && h.x < 0.55) {
    float x = (h.x - 0.12) / 0.43;
    x = smoothstep(0.0, 1.0, smoothstep(0.0, 1.0, smoothstep(0.0, 1.0, x)));
    h.x = 0.12 + x * 0.43;
  }
  return hsv2rgb(h);
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0); // quintic: extra smooth
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

// Fractal noise, used by the marble flow field.
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}

// Smoother fractal noise (3 octaves) for the marble: flowing shapes with some
// curls, but not the busy fine detail of the full fbm.
float fbm2(vec2 p) {
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  vec2 p2 = m * p;
  return 0.57 * noise(p) + 0.29 * noise(p2) + 0.14 * noise(m * p2);
}


// The 4 colours as a repeating cycle (interleaved so neighbours contrast), with
// seamless transitions between them.
// w = how wide each melt between neighbours is (0.5 = all blend, small = crisp).
vec3 cycle(float v, float w) {
  float x = fract(v) * 4.0;
  float i = floor(x);
  float f = smoothstep(0.5 - w, 0.5 + w, fract(x)); // hold each colour, then melt
  vec3 a = i < 1.0 ? uC0 : i < 2.0 ? uC2 : i < 3.0 ? uC1 : uC3;
  vec3 b = i < 1.0 ? uC2 : i < 2.0 ? uC1 : i < 3.0 ? uC3 : uC0;
  return mix(a, b, f);
}

vec3 softBlobs() {
  // Centred, aspect-correct coordinates (height spans -0.5..0.5).
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime * 0.3;

  // Noise scale: 0 → 0.6 = extra-soft → soft blobs (blobs blend wider and
  // wider as it goes down); 0.6 → 1 = soft blobs → full marble streaks.
  float soft = clamp(uNoise / 0.6, 0.0, 1.0);
  float marble = clamp((uNoise - 0.6) / 0.4, 0.0, 1.0);

  // The whole field slowly swirls, so colours travel around the page.
  float a = t * 0.25;
  uv = mat2(cos(a), sin(a), -sin(a), cos(a)) * uv;

  // Slow liquid ripple.
  uv += 0.09 * (vec2(noise(uv * 1.6 + t * 0.7), noise(uv * 1.6 - t * 0.6 + 7.3)) - 0.5);

  // Marbled flow field: a two-step domain warp, squeezed along one direction so
  // it forms long, dragged streaks like paint pulled across a surface.
  vec2 r = vec2(0.5);
  float flow = 0.0;
  if (marble > 0.001) {
    // Smoothish, low-frequency noise and a moderate warp: a handful of large
    // sweeping swirls, not lots of little ones.
    vec2 p = mat2(0.8, -0.6, 0.6, 0.8) * uv * vec2(0.45, 1.3);
    vec2 q = vec2(fbm2(p + t * 0.10), fbm2(p + vec2(5.2, 1.3) - t * 0.08));
    r = vec2(fbm2(p + 2.6 * q + vec2(1.7, 9.2) + t * 0.12),
             fbm2(p + 2.6 * q + vec2(8.3, 2.8) - t * 0.10));
    // Smooth noise only: broad swirls without small curls inside them.
    flow = fbm2(p + 2.6 * r);
    uv += (r - 0.5) * 0.95 * marble;
  }

  // 8 soft blobs anchored on a 4×2 grid across the screen, each drifting around
  // its own spot, coloured so neighbours always differ: every part of the screen
  // keeps a mix of the colours (no colour can gather on one side).
  float e[8];
  vec3 cols[8];
  float m = -1e9;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float gx = mod(fi, 4.0), gy = floor(fi / 4.0);
    vec2 anchor = vec2((gx - 1.5) * 0.55, (gy - 0.5) * 0.44);
    float sp = 0.45 + 0.35 * fract(fi * 0.618);
    vec2 drift = vec2(0.2 * sin(t * sp + fi * 1.7), 0.14 * cos(t * sp * 1.3 + fi * 2.3));
    vec2 d = uv - (anchor + drift);
    e[i] = -mix(0.25, 0.9, soft) * dot(d, d) / (0.25 * 0.25);
    m = max(m, e[i]);
    float ci = mod(gx + 2.0 * gy, 4.0);
    cols[i] = ci < 0.5 ? uC0 : ci < 1.5 ? uC1 : ci < 2.5 ? uC2 : uC3;
  }
  vec3 acc = vec3(0.0);
  float sum = 0.0;
  for (int i = 0; i < 8; i++) {
    float w = exp(e[i] - m);
    acc += cols[i] * w;
    sum += w;
  }
  vec3 c = acc / sum;

  // Noise: the colours get woven into each other as interleaved marbled streaks
  // (every colour runs through every area), fading in from the soft blobs.
  if (marble > 0.001) {
    // Crisper bands as noise rises, so swirls read as distinct streaks, not a smear.
    vec3 streaks = cycle(flow * 1.1 + r.x * 0.3, mix(0.35, 0.23, marble));
    c = mix(c, streaks, smoothstep(0.0, 1.0, marble));
  }

  c = clean(c);

  // Brightness: up = whiter (lighter and less saturated, towards pastel);
  // down = more saturated, vivid colour (only slightly deeper, never just black).
  // Neutral pixels (the cover's black / white / greys) aren't tinted.
  if (abs(uBrightness) > 0.001) {
    vec3 h = rgb2hsv(c);
    if (uBrightness > 0.0) {
      h.z = mix(h.z, 1.0, uBrightness * 0.7);
      h.y *= 1.0 - uBrightness * 0.45;
    } else {
      float colourful = smoothstep(0.05, 0.2, h.y);
      h.y = mix(h.y, 1.0, -uBrightness * 0.9 * colourful);
      h.z *= 1.0 + uBrightness * 0.15;
    }
    c = hsv2rgb(h);
  }

  // A very fine grain: matte, like print, rather than a glossy screen gradient.
  c += (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * (0.002 + 0.003 * marble);
  return clamp(c, 0.0, 1.0);
}

void main() {
  gl_FragColor = vec4(softBlobs(), 1.0);
}
`;

function createGL(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
  if (!gl) return null;
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "");
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  // One triangle covering the whole screen.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (n: string) => gl.getUniformLocation(prog, n);
  return { gl, uRes: u("uRes"), uTime: u("uTime"), uNoise: u("uNoise"), uBrightness: u("uBrightness"), uAllowGreen: u("uAllowGreen"), uSat: u("uSat"), uC: [u("uC0"), u("uC1"), u("uC2"), u("uC3")] };
}

// Resolution (canvas pixels per CSS pixel). Soft settings render at half size
// (looks identical, keeps the GPU cool); towards full marble, where there's fine
// detail, it rises to the screen's real sharpness (Retina included, capped at 2×).
function renderScale(noise: number, dpr: number) {
  const marble = Math.min(1, Math.max(0, (noise - 0.6) / 0.4));
  return 0.5 + (Math.min(dpr, 2) - 0.5) * marble;
}

/** Full-screen flowing heatmap of the cover's colours. */
export default function MeshBackground({
  colors,
  noise = 0.6,
  brightness = 0,
  className = "fixed inset-0",
}: {
  colors: Palette["colors"];
  /** 0 = very soft blend, 0.6 = soft round blobs, 1 = colours woven into marbled streaks. */
  noise?: number;
  /** -1 = saturated / vivid, 0 = as is, 1 = whiter / pastel. */
  brightness?: number;
  /** Placement: full screen by default; e.g. "absolute inset-0" to fill a box. */
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const target = useRef(colors);
  const noiseRef = useRef(noise);
  const brightnessRef = useRef(brightness);

  useEffect(() => {
    target.current = colors;
    noiseRef.current = noise;
    brightnessRef.current = brightness;
  }, [colors, noise, brightness]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    // Use the canvas's own window: in the picture-in-picture window this keeps
    // animating even while the main tab is hidden.
    const win = canvas.ownerDocument.defaultView ?? window;
    let ctx: ReturnType<typeof createGL> = null;
    try {
      ctx = createGL(canvas);
    } catch (e) {
      console.info("[mixtape player] shader failed:", e);
    }
    if (!ctx) return; // no WebGL: the CSS gradient underneath stays visible
    const { gl, uRes, uTime, uNoise, uBrightness, uAllowGreen, uSat, uC } = ctx;

    const still = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const current = target.current.map((c) => [...c]);
    const start = win.performance.now();
    let raf = 0;

    const frame = (now: number) => {
      // Stepped, so dragging the slider doesn't resize the canvas every frame.
      const scale = Math.round(renderScale(noiseRef.current, win.devicePixelRatio || 1) * 8) / 8;
      const w = Math.max(1, Math.round(canvas.clientWidth * scale));
      const h = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      // Ease towards the new song's colours instead of snapping.
      current.forEach((c, i) => {
        for (let k = 0; k < 3; k++) c[k] += (target.current[i][k] - c[k]) * 0.03;
        gl.uniform3f(uC[i], c[0] / 255, c[1] / 255, c[2] / 255);
      });
      // Green is only allowed through blends when one of the colours is clearly
      // green (e.g. a green cover, or the colour slider moved to green).
      const hsl = current.map((c) => rgbToHsl(c as RGB));
      const green = hsl.some(([h, s]) => s > 0.25 && h > 85 / 360 && h < 170 / 360);
      gl.uniform1f(uAllowGreen, green ? 1 : 0);
      const vivid = hsl.filter(([, s, l]) => s > 0.2 && l > 0.12 && l < 0.88);
      gl.uniform1f(uSat, vivid.length ? vivid.reduce((sum, [, s]) => sum + s, 0) / vivid.length : 0);
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uNoise, noiseRef.current);
      gl.uniform1f(uBrightness, brightnessRef.current);
      gl.uniform1f(uTime, still ? 0 : (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = win.requestAnimationFrame(frame);
    };
    raf = win.requestAnimationFrame(frame);
    return () => win.cancelAnimationFrame(raf);
  }, []);

  const css = (c: RGB | undefined) => `rgb(${(c ?? colors[0]).map(Math.round).join(" ")})`;
  return (
    <div aria-hidden className={`pointer-events-none -z-10 ${className}`}>
      {/* Static fallback, covered by the shader canvas when WebGL works. */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(at 20% 20%, ${css(colors[3])}, transparent 60%),
            radial-gradient(at 80% 30%, ${css(colors[2])}, transparent 60%),
            radial-gradient(at 30% 80%, ${css(colors[1])}, transparent 60%),
            ${css(colors[0])}`,
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
    </div>
  );
}
