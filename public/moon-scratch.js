/**
 * moon-scratch.js — BOT CRYPTO
 * ============================================================
 * Yêu cầu 1: Video mặt trăng thật (moon-video.mp4), không viền, không nền chữ nhật,
 *            che watermark góc trên-trái và dưới-phải bằng 2 khối div đen.
 * Yêu cầu 2: Hiệu ứng đèn pin lộ ảnh hoa (beautiful-flower.jpg) theo con trỏ chuột
 *            trong vùng mặt trăng (CSS radial-gradient mask-image trực tiếp).
 * Yêu cầu 3: Video galaxy nền toàn bộ hero (bg-video.mp4).
 * Yêu cầu 4: mix-blend-mode: screen + filter tương phản để hoà trộn mượt mà.
 * Yêu cầu bổ sung: Đồng bộ 2 video chạy đều nhau, vòng lặp 7.0s liền mạch không giật.
 * ============================================================
 */
'use strict';

(function() {
  function initMoonInteractive() {
    var moonWrap = document.getElementById('moonWrap');
    var moonLayer = document.getElementById('moonLayer');
    var flowerLayer = document.getElementById('flowerLayer');
    var heroBgVideo = document.getElementById('heroBgVideo');

    if (!moonWrap || !moonLayer) return;

    // ── 1. ĐẢM BẢO AUTOPLAY & ĐỒNG BỘ 2 VIDEO (7.0s LOOP) ───────
    function ensurePlay(video) {
      if (!video) return;
      video.muted = true; // Bắt buộc muted theo chính sách trình duyệt
      if (video.paused) {
        var p = video.play();
        if (p && typeof p.catch === 'function') {
          p.catch(function() {});
        }
      }
    }

    ensurePlay(moonLayer);
    ensurePlay(heroBgVideo);

    if (moonLayer) {
      moonLayer.addEventListener('canplay', function() { ensurePlay(moonLayer); });
    }
    if (heroBgVideo) {
      heroBgVideo.addEventListener('canplay', function() { ensurePlay(heroBgVideo); });
    }

    // Kích hoạt khi click bất kỳ đâu nếu trình duyệt yêu cầu tương tác
    document.addEventListener('click', function() {
      ensurePlay(moonLayer);
      ensurePlay(heroBgVideo);
    }, { once: true });

    // Đồng bộ thời gian giữa 2 video để chạy đều nhau, không bị lệch pha
    function syncVideos() {
      if (!moonLayer || !heroBgVideo) return;
      if (moonLayer.readyState >= 2 && heroBgVideo.readyState >= 2) {
        var diff = Math.abs(moonLayer.currentTime - heroBgVideo.currentTime);
        if (diff > 0.12) {
          moonLayer.currentTime = heroBgVideo.currentTime;
        }
      }
    }

    if (heroBgVideo) {
      heroBgVideo.addEventListener('timeupdate', syncVideos);
      heroBgVideo.addEventListener('seeked', syncVideos);
      heroBgVideo.addEventListener('play', function() { ensurePlay(moonLayer); });
    }

    // ── 2. HIỆU ỨNG ĐÈN PIN LỘ ẢNH HOA THEO CON TRỎ CHUỘT ──────
    var rafId = null;

    // Bán kính đèn pin bao phủ tầm 1 nửa hình tròn mặt trăng (~135px đến 145px trên desktop)
    function getSpotlightRadius(width) {
      return Math.round(Math.min(150, Math.max(95, width * 0.25)));
    }

    function applySpotlight(clientX, clientY) {
      var rect = moonWrap.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      var x = clientX - rect.left;
      var y = clientY - rect.top;

      var radius = getSpotlightRadius(rect.width);
      var xPct = ((x / rect.width) * 100).toFixed(2);
      var yPct = ((y / rect.height) * 100).toFixed(2);

      // Cập nhật TRỰC TIẾP webkitMaskImage và maskImage để GPU compositor của Chrome/Edge
      // bắt buộc render lại frame mặt nạ ngay lập tức (tránh bug đơ khi chỉ đổi biến CSS trên video)
      var maskVal = 'radial-gradient(circle ' + radius + 'px at ' + xPct + '% ' + yPct + '%, transparent 0%, transparent 68%, black 100%)';
      moonLayer.style.webkitMaskImage = maskVal;
      moonLayer.style.maskImage = maskVal;

      moonLayer.style.setProperty('--mx', xPct + '%');
      moonLayer.style.setProperty('--my', yPct + '%');
    }

    function resetSpotlight() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      // Gỡ bỏ mask hoàn toàn khi chuột rời khỏi -> mặt trăng lành lại 100% nguyên vẹn
      moonLayer.style.webkitMaskImage = 'none';
      moonLayer.style.maskImage = 'none';
      moonLayer.style.setProperty('--mx', '-100%');
      moonLayer.style.setProperty('--my', '-100%');
    }

    function onPointerMove(clientX, clientY) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(function() {
        applySpotlight(clientX, clientY);
      });
    }

    // Sự kiện chuột máy tính
    moonWrap.addEventListener('mousemove', function(e) {
      onPointerMove(e.clientX, e.clientY);
    });

    moonWrap.addEventListener('mouseenter', function(e) {
      onPointerMove(e.clientX, e.clientY);
    });

    moonWrap.addEventListener('mouseleave', resetSpotlight);

    // Hỗ trợ cảm ứng trên thiết bị di động / màn hình cảm ứng
    moonWrap.addEventListener('touchstart', function(e) {
      if (e.touches && e.touches[0]) {
        onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    moonWrap.addEventListener('touchmove', function(e) {
      if (e.touches && e.touches[0]) {
        onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    moonWrap.addEventListener('touchend', resetSpotlight);
    moonWrap.addEventListener('touchcancel', resetSpotlight);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMoonInteractive);
  } else {
    initMoonInteractive();
  }
})();
