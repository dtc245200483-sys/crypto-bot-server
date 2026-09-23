/**
 * landing.js — BOT CRYPTO
 * ============================================================
 * 1. Color variant switcher: White / Gray
 * 2. Moon & Galaxy Video Autoplay Guarantee
 * 3. Interactive Cursor Spotlight on Moon (Reveals beautiful-flower.jpg)
 * 4. Orbit decoration parallax
 * 5. Explore CTA smooth scroll
 * ============================================================
 */
'use strict';

// ============================================================
// 1. COLOR VARIANT SWITCHER
// ============================================================
const COLOR_KEY = 'landing-color-variant';

function applyVariant(variant, save) {
  if (save === undefined) save = true;

  if (variant === 'gray') {
    document.body.classList.add('variant-gray');
  } else {
    document.body.classList.remove('variant-gray');
  }

  document.querySelectorAll('.color-dot').forEach(function(dot) {
    dot.classList.toggle('active', dot.dataset.variant === variant);
  });

  if (save) {
    try { localStorage.setItem(COLOR_KEY, variant); } catch(e) {}
  }
}

function initColorSwitcher() {
  var saved = null;
  try { saved = localStorage.getItem(COLOR_KEY); } catch(e) {}
  applyVariant(saved || 'white', false);

  document.querySelectorAll('.color-dot').forEach(function(dot) {
    dot.addEventListener('click', function() {
      applyVariant(dot.dataset.variant, true);
    });
  });
}

// ============================================================
// 2. ORBIT DECORATION PARALLAX
// ============================================================
function initParallax() {
  var orbit = document.getElementById('orbitDecoration');
  if (!orbit) return;

  document.addEventListener('mousemove', function(e) {
    var nx = (e.clientX / window.innerWidth  - 0.5) * 2;
    var ny = (e.clientY / window.innerHeight - 0.5) * 2;

    requestAnimationFrame(function() {
      orbit.style.transform = 'translate(' + (nx * 7) + 'px, ' + (ny * 5) + 'px)';
    });
  });
}

// ============================================================
// 3. EXPLORE BUTTON — smooth scroll
// ============================================================
function initExploreBtn() {
  var btn = document.getElementById('exploreBtn');
  if (!btn) return;
  btn.addEventListener('click', function() {
    var features = document.getElementById('features');
    if (features) {
      features.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  initColorSwitcher();
  initParallax();
  initExploreBtn();
});
