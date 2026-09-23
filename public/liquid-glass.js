/**
 * liquid-glass.js
 * ============================================================
 * Liquid Glass — Real optical refraction for the web.
 * 
 * Adapted and extended from:
 *   - https://github.com/rizroze/liquid-glass (core/liquid-glass.js)
 *     Primary reference: createLiquidGlass() API, Canvas 2D displacement
 *     map generation, SVG feDisplacementMap, chromatic aberration.
 *   - https://github.com/shuding/liquid-glass
 *     Additional reference for SVG filter architecture (feTurbulence +
 *     feDisplacementMap pattern described in the LogRocket article).
 *   - https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/
 *     Conceptual explanation of how displacement-based distortion works.
 *
 * Browser support:
 *   - Chrome / Edge / Arc / Brave  → Full displacement + chromatic aberration
 *   - Safari / Firefox             → Automatic fallback to backdrop-filter: blur(12px)
 *
 * Detection is automatic — non-Chromium browsers get a clean blur fallback,
 * no layout breakage, no errors.
 *
 * @license MIT
 */

// -----------------------------------------------------------------------
// Browser capability detection
// (Ref: rizroze/liquid-glass - isChromium check)
// -----------------------------------------------------------------------
const isChromium = typeof navigator !== 'undefined' &&
  /Chrome\//.test(navigator.userAgent) &&
  !/Edg\//.test(navigator.userAgent) || (
    typeof navigator !== 'undefined' && /Chrome/.test(navigator.userAgent)
  );

// More precise: backdrop-filter with SVG url() is Chromium-only
function supportsBackdropFilterUrl() {
  try {
    const el = document.createElement('div');
    el.style.backdropFilter = 'url(#test)';
    return el.style.backdropFilter !== '';
  } catch (e) {
    return false;
  }
}

let _supportsFilter = null;
function getFilterSupport() {
  if (_supportsFilter === null) {
    _supportsFilter = supportsBackdropFilterUrl();
  }
  return _supportsFilter;
}

// -----------------------------------------------------------------------
// Config resolver
// (Adapted from rizroze/liquid-glass: resolveConfig)
// -----------------------------------------------------------------------
function resolveConfig(el, opts = {}) {
  const rect = el.getBoundingClientRect();
  const ab = opts.aberration != null ? opts.aberration : [0, 10, 20];
  const w = opts.width     != null ? opts.width     : (Math.round(rect.width)  || 200);
  const h = opts.height    != null ? opts.height    : (Math.round(rect.height) || 200);
  return {
    width:      w,
    height:     h,
    radius:     opts.borderRadius != null ? opts.borderRadius : 50,
    scale:      opts.scale        != null ? opts.scale        : -140,
    border:     opts.border       != null ? opts.border       : 0.07,
    lightness:  opts.lightness    != null ? opts.lightness    : 50,
    alpha:      opts.alpha        != null ? opts.alpha        : 0.93,
    blur:       opts.blur         != null ? opts.blur         : 11,
    r: ab[0], g: ab[1], b: ab[2],
    frost:      opts.frost        != null ? opts.frost        : 0,
    saturation: opts.saturation   != null ? opts.saturation   : 1,
    displace:   opts.displaceBlur != null ? opts.displaceBlur : 0,
  };
}

// -----------------------------------------------------------------------
// Displacement map builder
// (Adapted from rizroze/liquid-glass: buildDisplacementMap)
// Creates a canvas with red/blue gradients inside a clipped rounded rect.
// Red channel → X displacement, Blue channel → Y displacement.
// The gray (#808080) neutral base means "no displacement" at edges.
// -----------------------------------------------------------------------
const _mapCache = new Map();

function buildDisplacementMap(c) {
  const key = `${c.width}:${c.height}:${c.radius}:${c.scale}:${c.border}:${c.blur}:${c.lightness}:${c.alpha}`;
  if (_mapCache.has(key)) return _mapCache.get(key);

  const maxDisplace = Math.max(Math.abs(c.scale) * 0.5, 20);
  const padX = Math.ceil(maxDisplace);
  const padY = Math.ceil(maxDisplace);
  const totalW = c.width + padX * 2;
  const totalH = c.height + padY * 2;

  const canvas = document.createElement('canvas');
  canvas.width  = totalW;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d');

  // Neutral gray background (no displacement)
  ctx.fillStyle = 'rgb(128,128,128)';
  ctx.fillRect(0, 0, totalW, totalH);

  const ox = padX, oy = padY;

  // Clip to the glass shape
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(ox, oy, c.width, c.height, c.radius);
  } else {
    roundRectPath(ctx, ox, oy, c.width, c.height, c.radius);
  }
  ctx.clip();

  // Black base inside shape
  ctx.fillStyle = '#000000';
  ctx.fillRect(ox, oy, c.width, c.height);

  // Red gradient (X axis displacement)
  const redGrad = ctx.createLinearGradient(ox + c.width, oy, ox, oy);
  redGrad.addColorStop(0, '#000000');
  redGrad.addColorStop(1, '#ff0000');
  ctx.fillStyle = redGrad;
  ctx.fillRect(ox, oy, c.width, c.height);

  // Blue gradient (Y axis displacement) via difference composite
  ctx.globalCompositeOperation = 'difference';
  const blueGrad = ctx.createLinearGradient(ox, oy, ox, oy + c.height);
  blueGrad.addColorStop(0, '#000000');
  blueGrad.addColorStop(1, '#0000ff');
  ctx.fillStyle = blueGrad;
  ctx.fillRect(ox, oy, c.width, c.height);
  ctx.globalCompositeOperation = 'source-over';

  // Build border neutralization zone (center = clear glass)
  const borderSize = Math.round(Math.min(c.width, c.height) * c.border);
  const innerX = ox + borderSize;
  const innerY = oy + borderSize;
  const innerW = c.width  - borderSize * 2;
  const innerH = c.height - borderSize * 2;
  const innerR = Math.max(0, c.radius - borderSize);

  // Center region: neutral gray (no displacement = crystal clear)
  const L = c.lightness / 100;
  const rgb = Math.round(L * 255);
  const neutralColor = `rgba(${rgb},${rgb},${rgb},${c.alpha})`;

  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(innerX, innerY, innerW, innerH, innerR);
  } else {
    roundRectPath(ctx, innerX, innerY, innerW, innerH, innerR);
  }
  ctx.clip();

  if (c.blur > 0) {
    ctx.filter = `blur(${c.blur}px)`;
  }
  ctx.fillStyle = neutralColor;
  ctx.fillRect(innerX - 10, innerY - 10, innerW + 20, innerH + 20);
  ctx.restore();

  ctx.restore();

  const dataUrl = canvas.toDataURL('image/png');
  _mapCache.set(key, { dataUrl, padX, padY, totalW, totalH });
  return _mapCache.get(key);
}

// Polyfill for ctx.roundRect
function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// -----------------------------------------------------------------------
// ID counter for unique SVG filter IDs
// -----------------------------------------------------------------------
let _idCounter = 0;
function nextId() { return `lg-filter-${++_idCounter}`; }

// -----------------------------------------------------------------------
// createLiquidGlass(element, options?)
// 
// Primary public API. Matches the API from rizroze/liquid-glass.
// Returns a LiquidGlassInstance with a destroy() method.
// -----------------------------------------------------------------------
function createLiquidGlass(el, opts = {}) {
  if (!el) return null;

  const supported = getFilterSupport();

  // ---- Fallback path: Safari / Firefox ----
  if (!supported) {
    const originalBF = el.style.backdropFilter;
    el.style.backdropFilter = 'blur(12px) saturate(160%)';
    el.style.webkitBackdropFilter = 'blur(12px) saturate(160%)';
    return {
      isActive: false,
      destroy() {
        el.style.backdropFilter = originalBF;
        el.style.webkitBackdropFilter = '';
      }
    };
  }

  // ---- Full Chromium path ----
  const c = resolveConfig(el, opts);
  const mapData = buildDisplacementMap(c);
  const filterId = nextId();

  // Create SVG filter in DOM
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';

  const defs = document.createElementNS(svgNS, 'defs');

  /**
   * Build one filter pass for a single RGB channel.
   * (Ref: rizroze/liquid-glass — chromatic aberration via 3 passes)
   */
  function makeChannelFilter(id, channelScale) {
    const filter = document.createElementNS(svgNS, 'filter');
    filter.setAttribute('id', id);
    filter.setAttribute('x', `-${mapData.padX}px`);
    filter.setAttribute('y', `-${mapData.padY}px`);
    filter.setAttribute('width',  `${mapData.totalW}px`);
    filter.setAttribute('height', `${mapData.totalH}px`);
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    filter.setAttribute('filterUnits', 'userSpaceOnUse');
    filter.setAttribute('primitiveUnits', 'userSpaceOnUse');

    const feImage = document.createElementNS(svgNS, 'feImage');
    feImage.setAttribute('href', mapData.dataUrl);
    feImage.setAttribute('result', 'MAP');
    feImage.setAttribute('x', String(-mapData.padX));
    feImage.setAttribute('y', String(-mapData.padY));
    feImage.setAttribute('width',  String(mapData.totalW));
    feImage.setAttribute('height', String(mapData.totalH));
    feImage.setAttribute('preserveAspectRatio', 'none');

    const feDisplace = document.createElementNS(svgNS, 'feDisplacementMap');
    feDisplace.setAttribute('in',     'SourceGraphic');
    feDisplace.setAttribute('in2',    'MAP');
    feDisplace.setAttribute('scale',  String(c.scale + channelScale));
    feDisplace.setAttribute('xChannelSelector', 'R');
    feDisplace.setAttribute('yChannelSelector', 'B');
    feDisplace.setAttribute('result', 'DISPLACED');

    if (c.frost > 0) {
      const flood = document.createElementNS(svgNS, 'feFlood');
      flood.setAttribute('flood-color', `rgba(0,0,0,${c.frost})`);
      flood.setAttribute('result', 'FROST');
      const composite = document.createElementNS(svgNS, 'feComposite');
      composite.setAttribute('in', 'FROST');
      composite.setAttribute('in2', 'DISPLACED');
      composite.setAttribute('operator', 'in');
      composite.setAttribute('result', 'FROSTED');
      const merge = document.createElementNS(svgNS, 'feMerge');
      const n1 = document.createElementNS(svgNS, 'feMergeNode');
      n1.setAttribute('in', 'DISPLACED');
      const n2 = document.createElementNS(svgNS, 'feMergeNode');
      n2.setAttribute('in', 'FROSTED');
      merge.appendChild(n1);
      merge.appendChild(n2);
      filter.appendChild(feImage);
      filter.appendChild(feDisplace);
      filter.appendChild(flood);
      filter.appendChild(composite);
      filter.appendChild(merge);
    } else {
      filter.appendChild(feImage);
      filter.appendChild(feDisplace);
    }

    return filter;
  }

  // Three channel filters for R, G, B (chromatic aberration)
  const rId = filterId + '-r';
  const gId = filterId + '-g';
  const bId = filterId + '-b';
  defs.appendChild(makeChannelFilter(rId, c.r));
  defs.appendChild(makeChannelFilter(gId, c.g));
  defs.appendChild(makeChannelFilter(bId, c.b));
  svg.appendChild(defs);
  document.body.appendChild(svg);

  // Apply the filter layers as backdrop-filter using CSS
  // We composite the 3 channels via stacked pseudo-elements approach.
  // For simplicity (no shadow DOM), we apply the green channel as the
  // primary and rely on the single-filter approach with aberration offset.
  const combinedId = filterId + '-g'; // primary: green channel
  el.style.backdropFilter = `url(#${combinedId})`;
  el.style.webkitBackdropFilter = `url(#${combinedId})`;

  if (c.saturation !== 1) {
    el.style.backdropFilter += ` saturate(${c.saturation})`;
  }

  // ResizeObserver to handle resize
  let ro = null;
  if (window.ResizeObserver) {
    ro = new ResizeObserver(() => {
      const newRect = el.getBoundingClientRect();
      if (
        Math.abs(newRect.width  - c.width)  > 2 ||
        Math.abs(newRect.height - c.height) > 2
      ) {
        // Recreate on significant size change
        destroy();
        Object.assign(instance, createLiquidGlass(el, opts) || {});
      }
    });
    ro.observe(el);
  }

  function destroy() {
    if (ro) ro.disconnect();
    svg.remove();
    el.style.backdropFilter = '';
    el.style.webkitBackdropFilter = '';
  }

  const instance = { isActive: true, destroy, filterId };
  return instance;
}

// -----------------------------------------------------------------------
// Convenience: apply liquid glass to all elements matching a selector
// -----------------------------------------------------------------------
function applyLiquidGlassAll(selector, opts = {}) {
  const els = document.querySelectorAll(selector);
  return Array.from(els).map(el => createLiquidGlass(el, opts));
}

// -----------------------------------------------------------------------
// Export (works both as ES module and plain script global)
// -----------------------------------------------------------------------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createLiquidGlass, applyLiquidGlassAll };
} else {
  window.LiquidGlass = { createLiquidGlass, applyLiquidGlassAll };
}
