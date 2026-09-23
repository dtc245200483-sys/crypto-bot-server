/**
 * Local Orchestrator - Express Server
 * Máy chủ trung tâm chạy trên http://127.0.0.1:8787
 * 1. Nhận webhook alert từ TradingView (POST /api/tv-webhook)
 * 2. Cung cấp dữ liệu indicator cho Extension 2 (GET /api/indicator-data)
 * 3. Nhận, validate lại ngưỡng lọc và lưu setups từ Extension 2 (POST /api/setups)
 * 4. Cung cấp API truy vấn setups (GET /api/setups)
 * 5. Phục vụ Web Dashboard xem trực quan kết quả kèo đẹp
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const logger = require('./logger');
const db = require('./db');
const config = require('./config.json');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 8787;
const HOST = process.env.HOST || '0.0.0.0';

// Tin tưởng proxy ngược (Reverse Proxy: Render, Cloudflare, Nginx, Docker)
app.set('trust proxy', 1);

// Vô hiệu hóa header X-Powered-By tránh lộ thông tin công nghệ
app.disable('x-powered-by');

// Cấu hình Google OAuth 2.0 Client & JWT
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '767037038958-6on9qqvnpcifsigfchaj2veipgtjh0hc.apps.googleusercontent.com';
const googleOAuthClient = new OAuth2Client(GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'bot_crypto_pro_jwt_secret_key_2026_super_safe';

// =============================================================================
// BẢO MẬT & MÃ HÓA HTTP HEADERS (HELMET)
// =============================================================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://unpkg.com", "https://accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https://*.googleusercontent.com", "https://www.okx.com", "https://lh3.googleusercontent.com"],
      connectSrc: ["'self'", "https://www.okx.com", "https://accounts.google.com", "https://www.googleapis.com", "http://localhost:*", "http://127.0.0.1:*"],
      frameSrc: ["'self'", "https://accounts.google.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// =============================================================================
// RATE LIMITING - BẢO VỆ CHỐNG TẤN CÔNG DDOS & BRUTE FORCE
// =============================================================================
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 phút
  max: 400, // Tối đa 400 requests / phút
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Phát hiện tần suất truy vấn bất thường. Vui lòng thử lại sau 1 phút.' }
});
app.use('/api/', apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 30, // Tối đa 30 lần đăng nhập / 15 phút
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Đăng nhập quá số lần cho phép. Vui lòng đợi 15 phút.' }
});
app.use('/api/auth/', authLimiter);

// Cấu hình Middleware
app.use(cors({ origin: '*' })); // Cho phép Extension & Client gọi API
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Ghi nhật ký mọi request vào file logs/app.log
app.use(logger.requestLogger);

// Phục vụ giao diện Web Dashboard tĩnh (Không lưu cache để cập nhật tức thì)
app.use(express.static(path.join(__dirname, 'public'), { etag: false, maxAge: 0 }));

// =============================================================================
// API ROUTES
// =============================================================================

/**
 * 1. Healthcheck Endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: Date.now(),
    port: PORT,
    database: 'SQLite Connected'
  });
});

/**
 * 1b. Google OAuth 2.0 Login / Verify Token
 * Endpoint: POST /api/auth/google
 */
app.post('/api/auth/google', async (req, res) => {
  try {
    const { idToken, accessToken, userInfo } = req.body;
    let googleId, email, name, picture;

    if (idToken) {
      try {
        const ticket = await googleOAuthClient.verifyIdToken({
          idToken,
          audience: GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        googleId = payload.sub;
        email = payload.email;
        name = payload.name || email.split('@')[0];
        picture = payload.picture || null;
      } catch (verifyErr) {
        logger.warn(`[Auth] Lỗi xác thực Google ID Token: ${verifyErr.message}`);
        return res.status(401).json({ success: false, message: 'Google Token không hợp lệ hoặc đã hết hạn.' });
      }
    } else if (accessToken) {
      // Xác thực token qua Google UserInfo endpoint chính thức
      try {
        const verifyRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!verifyRes.ok) {
          return res.status(401).json({ success: false, message: 'Google Access Token không hợp lệ.' });
        }
        const data = await verifyRes.json();
        googleId = data.sub;
        email = data.email;
        name = data.name || email.split('@')[0];
        picture = data.picture || null;
      } catch (fetchErr) {
        logger.warn(`[Auth] Lỗi xác thực Access Token: ${fetchErr.message}`);
        return res.status(401).json({ success: false, message: 'Không thể xác thực với máy chủ Google.' });
      }
    } else if (userInfo && userInfo.email) {
      googleId = userInfo.sub || userInfo.id || 'usr_oauth';
      email = userInfo.email;
      name = userInfo.name || email.split('@')[0];
      picture = userInfo.picture || null;
    } else {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin xác thực Google.' });
    }

    // Lưu hoặc cập nhật người dùng trong DB SQLite
    const user = db.createOrUpdateGoogleUser({ googleId, email, name, avatar: picture });

    // Tạo App JWT Token
    const appToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'PRO VIP'
      },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    logger.info(`[Auth] Người dùng đăng nhập Google thành công: ${email} (${name})`);
    return res.json({
      success: true,
      message: 'Đăng nhập Google thành công!',
      token: appToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.name,
        avatar: user.avatar,
        role: user.role || 'PRO VIP',
        provider: 'Google'
      }
    });
  } catch (err) {
    logger.error(`[Auth] Lỗi server khi xác thực Google: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xử lý đăng nhập Google.' });
  }
});

/**
 * 1c. Kiểm tra phiên đăng nhập qua App JWT
 * Endpoint: GET /api/auth/me
 */
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.findUserById(decoded.userId) || db.findUserByEmail(decoded.email);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
    }
    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.name,
        avatar: user.avatar,
        role: user.role || 'PRO VIP'
      }
    });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token hết hạn hoặc không hợp lệ.' });
  }
});



/**
 * 2. Cung cấp cấu hình ngưỡng lọc hiện tại
 */
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    config
  });
});

/**
 * 2b. Cập nhật cấu hình hệ thống từ giao diện Web
 * Endpoint: POST /api/config
 */
app.post('/api/config', (req, res) => {
  try {
    const newConfig = req.body;
    if (!newConfig || typeof newConfig !== 'object') {
      return res.status(400).json({ success: false, error: 'Dữ liệu cấu hình không hợp lệ.' });
    }

    if (newConfig.thresholds) {
      config.thresholds = {
        minWinRate: Math.max(0, Number(newConfig.thresholds.minWinRate) || 0),
        minProfitFactor: Math.max(0, Number(newConfig.thresholds.minProfitFactor) || 0),
        minTotalPnL: Number(newConfig.thresholds.minTotalPnL) || 0
      };
    }

    if (Array.isArray(newConfig.allowedBaseTimeframes)) {
      const validTfs = ['30m', '1h', '4h']; // 15m chỉ để xem và xác nhận, không làm khung vào lệnh
      config.allowedBaseTimeframes = newConfig.allowedBaseTimeframes
        .map(tf => String(tf).toLowerCase().trim())
        .filter(tf => validTfs.includes(tf));
    }

    if (typeof newConfig.soundAlert === 'boolean') {
      config.soundAlert = newConfig.soundAlert;
    }

    if (typeof newConfig.refreshIntervalSec === 'number') {
      config.refreshIntervalSec = Math.max(5, Math.min(300, newConfig.refreshIntervalSec));
    }

    // Ghi lưu trữ cấu hình vào file config.json
    const configPath = path.resolve(__dirname, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

    logger.info('[Config] Đã cập nhật và lưu cấu hình thành công:', config);

    res.json({
      success: true,
      message: 'Đã lưu cấu hình thành công.',
      config
    });
  } catch (err) {
    logger.error('[Config] Lỗi khi lưu cấu hình:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 3. Webhook nhận Alert từ TradingView (Phương án A)
 * Endpoint: POST /api/tv-webhook
 */
app.post('/api/tv-webhook', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || Object.keys(payload).length === 0) {
      logger.warn('[Webhook] Nhận payload rỗng.');
      return res.status(400).json({ success: false, error: 'Payload body không được để trống.' });
    }

    logger.info(`[Webhook] Nhận alert từ TradingView: ${payload.symbol || payload.ticker || 'N/A'} [${payload.timeframe || payload.interval || 'N/A'}]`);
    const insertId = db.insertTvWebhook(payload);

    res.status(200).json({
      success: true,
      id: insertId,
      message: 'Đã lưu trữ thành công Alert Webhook từ TradingView.'
    });
  } catch (err) {
    logger.error('[Webhook] Lỗi xử lý webhook:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 4. Tra cứu dữ liệu indicator webhook mới nhất cho Extension 2
 * Endpoint: GET /api/indicator-data?symbol=...&timeframe=...
 */
app.get('/api/indicator-data', (req, res) => {
  const { symbol, timeframe } = req.query;
  if (!symbol || !timeframe) {
    return res.status(400).json({ success: false, error: 'Thiếu query param: symbol và timeframe.' });
  }

  const latest = db.getLatestTvWebhook(symbol, timeframe);
  if (!latest) {
    return res.status(404).json({
      success: false,
      message: `Chưa có dữ liệu alert webhook cho ${symbol} [${timeframe}].`
    });
  }

  res.json(latest);
});

// =============================================================================
// OKX CANDLES ENGINE (Public API v5, No Key, Direct Node Fetch)
// =============================================================================

/**
 * Chuyển đổi mã symbol (từ TradingView hoặc thông dụng) sang mã instId chuẩn của OKX SWAP
 * Ví dụ: 'OKX:BTCUSDT.P' -> 'BTC-USDT-SWAP', 'BTCUSDT' -> 'BTC-USDT-SWAP'
 */
function symbolToOkxInstId(symbol) {
  if (!symbol) return '';
  let s = String(symbol).trim().toUpperCase();
  s = s.replace(/^OKX:/i, '');
  if (s.endsWith('-SWAP')) return s;
  if (s.endsWith('USDT.P')) {
    const base = s.slice(0, -6);
    return `${base}-USDT-SWAP`;
  }
  if (s.endsWith('.P')) {
    const base = s.slice(0, -2);
    return base.endsWith('-USDT') ? `${base}-SWAP` : `${base}-USDT-SWAP`;
  }
  if (s.endsWith('-USDT')) {
    return `${s}-SWAP`;
  }
  if (s.endsWith('USDT')) {
    const base = s.slice(0, -4);
    return `${base}-USDT-SWAP`;
  }
  return `${s}-USDT-SWAP`;
}

/**
 * Gọi API nến công khai của OKX (không cần API key, gọi trực tiếp từ Node để tránh CORS)
 * Endpoint: GET https://www.okx.com/api/v5/market/candles?instId=<instId>&bar=<BAR>&limit=100
 * @param {string} instId Ví dụ: 'BTC-USDT-SWAP'
 * @param {string} bar '30m', '1H', '4H'
 * @param {number} limit Mặc định 100
 * @returns {Promise<Array<Object>>} [{ time, open, high, low, close, volume }] sắp xếp thời gian tăng dần
 */
async function fetchOkxCandles(instId, bar, limit = 100) {
  const url = `https://www.okx.com/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=${bar}&limit=${limit}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`OKX Candles HTTP ${response.status} (${response.statusText})`);
  }

  const json = await response.json();
  if (json.code !== '0' || !Array.isArray(json.data)) {
    throw new Error(`OKX Candles trả lỗi: ${json.msg || json.code}`);
  }

  // Response OKX trả mảng [ts, open, high, low, close, vol, volCcy, volCcyQuote, confirm] (mới nhất trước)
  // Parse lại thành { time, open, high, low, close, volume } (đổi ts sang giây)
  const parsed = json.data.map(item => ({
    time: Math.floor(Number(item[0]) / 1000), // đổi ms sang giây
    open: Number(item[1]),
    high: Number(item[2]),
    low: Number(item[3]),
    close: Number(item[4]),
    volume: Number(item[5]) || 0
  }));

  // Sắp xếp thời gian tăng dần (cũ -> mới) cho thư viện lightweight-charts
  parsed.sort((a, b) => a.time - b.time);
  return parsed;
}

/**
 * Lấy nến 3 khung 30m, 1H, 4H từ OKX và lưu vào DB cho 1 setup
 * Bất đồng bộ, không làm gián đoạn luồng chính nếu gặp sự cố mạng
 */
async function syncSetupCandles(setupId, symbol) {
  const instId = symbolToOkxInstId(symbol);
  const bars = ['30m', '1H', '4H'];
  const summary = {};

  for (const bar of bars) {
    try {
      const candles = await fetchOkxCandles(instId, bar, 100);
      db.saveCandles(setupId, bar, candles);
      summary[bar] = candles.length;
    } catch (err) {
      logger.warn(`[OKX Candles] Không thể tải nến ${bar} cho ${instId} (setup #${setupId}): ${err.message}`);
      summary[bar] = 0;
    }
  }

  return { instId, summary };
}

/**
 * 5. Nhận danh sách setup từ TradingView Scanner Extension
 * Endpoint: POST /api/setups
 * BẮT BUỘC: Validate lại các ngưỡng theo config.json trước khi lưu (Chống dữ liệu rác)
 * Tự động gọi OKX Candles API lấy nến 3 khung 30m, 1H, 4H ngay sau khi lưu thành công
 */
app.post('/api/setups', (req, res) => {
  try {
    const body = req.body;
    let rawSetups = [];

    if (Array.isArray(body)) {
      rawSetups = body;
    } else if (body && Array.isArray(body.setups)) {
      rawSetups = body.setups;
    } else if (body && typeof body === 'object' && body.symbol) {
      rawSetups = [body];
    } else {
      return res.status(400).json({ success: false, error: 'Dữ liệu setup không hợp lệ. Cần truyền Array hoặc Object chứa mảng setups.' });
    }

    const thresholds = config.thresholds || { minWinRate: 42, minProfitFactor: 0.8, minTotalPnL: 0 };
    const savedSetups = [];
    const rejectedSetups = [];

    for (const s of rawSetups) {
      // 5.1. Kiểm tra cấu trúc cơ bản
      if (!s.symbol || !s.baseTimeframe || !s.signal || typeof s.entry !== 'number') {
        rejectedSetups.push({
          symbol: s.symbol || 'N/A',
          reason: 'Thiếu các trường bắt buộc (symbol, baseTimeframe, signal, entry).'
        });
        continue;
      }

      // 5.2. Khung 15p chỉ dùng để xem và xác nhận, tuyệt đối không được vào lệnh khung 15p
      const baseTf = String(s.baseTimeframe).toLowerCase();
      if (baseTf === '15m') {
        rejectedSetups.push({
          symbol: s.symbol,
          reason: 'Khung 15p chỉ dùng để xem và xác nhận, không được phép vào lệnh. Chỉ được vào lệnh khi khung 30p, 1h hoặc 4h xác nhận.'
        });
        continue;
      }

      const signal = String(s.signal).toLowerCase();
      if (signal !== 'long' && signal !== 'short') {
        rejectedSetups.push({
          symbol: s.symbol,
          reason: `Vị thế (${s.signal}) không hợp lệ. Chỉ chấp nhận 'long' hoặc 'short'.`
        });
        continue;
      }

      // 5.3. Kiểm tra ngưỡng kỹ thuật tập trung theo config.json
      const winRate = Number(s.winRate) || 0;
      const profitFactor = Number(s.profitFactor) || 0;
      const totalPnL = Number(s.totalPnL) || 0;

      if (winRate < thresholds.minWinRate || winRate > 100) {
        rejectedSetups.push({
          symbol: s.symbol,
          reason: `Win Rate (${winRate}%) không hợp lệ (phải trong khoảng ${thresholds.minWinRate}% - 100%).`
        });
        continue;
      }

      if (profitFactor < thresholds.minProfitFactor || profitFactor > 50) {
        rejectedSetups.push({
          symbol: s.symbol,
          reason: `Profit Factor (${profitFactor}) không hợp lệ (phải trong khoảng ${thresholds.minProfitFactor} - 50).`
        });
        continue;
      }

      if (totalPnL < thresholds.minTotalPnL) {
        rejectedSetups.push({
          symbol: s.symbol,
          reason: `Total PnL ($${totalPnL}) không đạt ngưỡng tối thiểu ($${thresholds.minTotalPnL}).`
        });
        continue;
      }

      // Đạt toàn bộ kiểm tra hợp lệ -> Lưu vào Database SQLite
      const id = db.insertSetup(s);
      savedSetups.push({ id, symbol: s.symbol, baseTimeframe: s.baseTimeframe, signal: s.signal, winRate: s.winRate, profitFactor: s.profitFactor, totalPnL: s.totalPnL });

      // Tự động gọi OKX Candles API lấy nến 3 khung 30m, 1H, 4H bất đồng bộ (không chặn response)
      syncSetupCandles(id, s.symbol).then(result => {
        logger.info(`[OKX Candles] Đã tải nến tự động cho setup #${id} (${result.instId}):`, result.summary);
      }).catch(err => {
        logger.warn(`[OKX Candles] Lỗi tải nến nền cho setup #${id}:`, err.message);
      });
    }

    logger.info(`[Setups] Đã nhận ${rawSetups.length} setup | Đã lưu: ${savedSetups.length} | Từ chối: ${rejectedSetups.length}`);

    if (rejectedSetups.length > 0) {
      logger.warn('[Setups] Chi tiết các setup bị từ chối do không đạt ngưỡng:', rejectedSetups);
    }

    res.status(201).json({
      success: true,
      totalReceived: rawSetups.length,
      savedCount: savedSetups.length,
      rejectedCount: rejectedSetups.length,
      saved: savedSetups,
      rejected: rejectedSetups
    });
  } catch (err) {
    logger.error('[Setups] Lỗi khi xử lý lưu setups:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 5b. Lấy nến 3 khung 30m, 1H, 4H cho 1 setup cụ thể
 * Endpoint: GET /api/setups/:id/candles
 * Trả về: { "30m": [...], "1H": [...], "4H": [...] }, mỗi mảng sắp theo thời gian tăng dần
 */
app.get('/api/setups/:id/candles', (req, res) => {
  try {
    const setupId = parseInt(req.params.id, 10);
    if (!setupId) {
      return res.status(400).json({ success: false, error: 'setupId không hợp lệ.' });
    }

    const candles = db.getCandles(setupId);
    const hasData = (candles['30m']?.length > 0) || (candles['1H']?.length > 0) || (candles['4H']?.length > 0);

    res.json({
      success: true,
      setupId,
      hasCandles: hasData,
      candles
    });
  } catch (err) {
    logger.error(`[Candles] Lỗi khi lấy nến setup #${req.params.id}:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 5c. Tải lại hoặc đồng bộ nến thủ công cho 1 setup (khi hasCandles === false)
 * Endpoint: POST /api/setups/:id/candles/sync
 */
app.post('/api/setups/:id/candles/sync', async (req, res) => {
  try {
    const setupId = parseInt(req.params.id, 10);
    if (!setupId) {
      return res.status(400).json({ success: false, error: 'setupId không hợp lệ.' });
    }

    // Tra cứu setup để lấy symbol
    const all = db.getSetups({ limit: 1000 });
    const targetSetup = all.find(s => s.id === setupId);
    if (!targetSetup) {
      return res.status(404).json({ success: false, error: `Không tìm thấy setup #${setupId}.` });
    }

    logger.info(`[Candles Sync] Bắt đầu đồng bộ nến thủ công cho setup #${setupId} (${targetSetup.symbol})...`);
    const syncRes = await syncSetupCandles(setupId, targetSetup.symbol);
    const updatedCandles = db.getCandles(setupId);
    const hasData = (updatedCandles['30m']?.length > 0) || (updatedCandles['1H']?.length > 0) || (updatedCandles['4H']?.length > 0);

    res.json({
      success: true,
      setupId,
      hasCandles: hasData,
      summary: syncRes.summary,
      candles: updatedCandles
    });
  } catch (err) {
    logger.error(`[Candles Sync] Lỗi khi đồng bộ nến setup #${req.params.id}:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 6. Truy vấn danh sách setup
 * Endpoint: GET /api/setups?status=active&limit=50&symbol=...&signal=...
 */
app.get('/api/setups', (req, res) => {
  try {
    const { status, limit, symbol, signal, baseTimeframe } = req.query;
    const setups = db.getSetups({ status, limit, symbol, signal, baseTimeframe });

    res.json({
      success: true,
      count: setups.length,
      setups
    });
  } catch (err) {
    logger.error('[Setups] Lỗi truy vấn setups:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 6b. Xóa toàn bộ lịch sử setup (Dọn dẹp dữ liệu test / reset phiên)
 * Endpoint: DELETE /api/setups
 */
app.delete('/api/setups', (req, res) => {
  try {
    db.clearSetups();
    logger.info('[Setups] Người dùng đã xóa toàn bộ setups qua API.');
    res.json({ success: true, message: 'Đã xóa toàn bộ lịch sử setups.' });
  } catch (err) {
    logger.error('[Setups] Lỗi khi xóa setups:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 7. Endpoint dự phòng cung cấp danh sách symbol OKX
 * Endpoint: GET /api/okx-symbols & POST /api/okx-symbols
 */
app.get('/api/okx-symbols', (req, res) => {
  const symbols = db.getOkxSymbols();
  res.json({
    success: true,
    count: symbols.length,
    symbols
  });
});

app.post('/api/okx-symbols', (req, res) => {
  const symbols = req.body.symbols || req.body;
  if (!Array.isArray(symbols)) {
    return res.status(400).json({ success: false, error: 'Body phải chứa mảng symbols.' });
  }

  db.upsertOkxSymbols(symbols);
  logger.info(`[OKX Symbols] Đã cập nhật cache ${symbols.length} symbols.`);
  res.json({ success: true, count: symbols.length });
});

/**
 * 7b. Tra cứu nến thị trường trực tiếp cho coin bất kỳ trên sàn OKX
 * Endpoint: GET /api/market/candles?symbol=BTC
 * Tự động chuẩn hóa symbol sang định dạng OKX USDT Perpetual Swap (ví dụ: BTC -> BTC-USDT-SWAP)
 * Lấy nến 3 khung 30m, 1H, 4H trực tiếp từ OKX API
 */
app.get('/api/market/candles', async (req, res) => {
  try {
    const rawSymbol = String(req.query.symbol || '').trim();
    if (!rawSymbol) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập tên coin (ví dụ: BTC, ETH, SOL...)' });
    }

    const instId = symbolToOkxInstId(rawSymbol);
    const bars = ['30m', '1H', '4H'];
    const candles = {};

    await Promise.all(bars.map(async (bar) => {
      try {
        const data = await fetchOkxCandles(instId, bar, 100);
        candles[bar] = data;
      } catch (err) {
        logger.warn(`[Market Lookup] Không thể tải nến ${bar} cho ${instId}: ${err.message}`);
        candles[bar] = [];
      }
    }));

    const hasData = (candles['30m']?.length > 0) || (candles['1H']?.length > 0) || (candles['4H']?.length > 0);

    if (!hasData) {
      return res.status(404).json({
        success: false,
        instId,
        error: `Không tìm thấy cặp ${instId} trên sàn OKX. Vui lòng kiểm tra lại tên coin (phải là coin có giao dịch với USDT trên OKX).`
      });
    }

    // Lấy thêm ticker giá 24h hiện tại từ sàn OKX
    let ticker = null;
    try {
      const tickerRes = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${encodeURIComponent(instId)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      if (tickerRes.ok) {
        const tickerJson = await tickerRes.json();
        if (tickerJson.code === '0' && Array.isArray(tickerJson.data) && tickerJson.data[0]) {
          const t = tickerJson.data[0];
          ticker = {
            last: Number(t.last),
            open24h: Number(t.open24h),
            high24h: Number(t.high24h),
            low24h: Number(t.low24h),
            vol24h: Number(t.vol24h),
            volCcy24h: Number(t.volCcy24h),
            changePercent24h: (((Number(t.last) - Number(t.open24h)) / Number(t.open24h)) * 100).toFixed(2)
          };
        }
      }
    } catch (e) {
      // bỏ qua lỗi ticker nếu không khả dụng
    }

    const cleanSymbol = instId.split('-')[0];

    res.json({
      success: true,
      symbol: instId,
      cleanSymbol: cleanSymbol,
      instId,
      ticker,
      candles
    });
  } catch (err) {
    logger.error('[Market Lookup] Lỗi:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Danh sách bộ nhớ đệm tất cả hợp đồng OKX USDT SWAP để hỗ trợ Autocomplete nhanh
let okxUsdtSwapsCache = [
  'BTC', 'ETH', 'SOL', 'SUI', 'DOGE', 'PEPE', 'NEAR', 'XRP', 'BNB', 'LINK',
  'ADA', 'AVAX', 'DOT', 'SHIB', 'LTC', 'BCH', 'UNI', 'ATOM', 'FIL', 'APT',
  'ARB', 'OP', 'TIA', 'RENDER', 'INJ', 'ORDI', 'WIF', 'BONK', 'FLOKI', 'FLOCK',
  'FET', 'FLOW', 'FTM', 'FORM', 'FLY', 'FOGO', 'FWDI', 'FARTCOIN', 'FXS',
  'GALA', 'GRT', 'ICP', 'IMX', 'JASMY', 'JUP', 'KAS', 'LDO', 'MANA', 'MNT',
  'NOT', 'ONDO', 'PENDLE', 'PYTH', 'RUNE', 'SAND', 'SEI', 'STRK', 'STX', 'TON',
  'TRUMP', 'VET', 'WLD', 'XMR', 'AAVE', 'MKR', 'CRV', 'DYDX', 'BLUR', 'MEME'
].map(c => ({ coin: c, instId: `${c}-USDT-SWAP`, name: `${c} / USDT` }));

/**
 * Nạp đồng bộ danh mục hợp đồng SWAP từ OKX (định kỳ 1h/lần)
 */
async function loadOkxSwapInstruments() {
  try {
    const res = await fetch('https://www.okx.com/api/v5/public/instruments?instType=SWAP', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (res.ok) {
      const json = await res.json();
      if (json.code === '0' && Array.isArray(json.data)) {
        const usdtSwaps = json.data
          .filter(x => x.instId && x.instId.endsWith('-USDT-SWAP'))
          .map(x => {
            const coin = x.instId.split('-')[0];
            return {
              coin,
              instId: x.instId,
              name: `${coin} / USDT`
            };
          });
        usdtSwaps.sort((a, b) => a.coin.localeCompare(b.coin));
        if (usdtSwaps.length > 0) {
          okxUsdtSwapsCache = usdtSwaps;
          logger.info(`[Market Instruments] Đã đồng bộ ${okxUsdtSwapsCache.length} mã hợp đồng USDT Perpetual từ sàn OKX.`);
        }
      }
    }
  } catch (err) {
    logger.warn(`[Market Instruments] Không thể cập nhật danh mục OKX: ${err.message}`);
  }
}

/**
 * 7c. API Gợi ý tên coin OKX USDT SWAP (Autocomplete Search)
 * Endpoint: GET /api/market/symbols?q=F
 * Tìm kiếm ưu tiên các coin BẮT ĐẦU bằng query (VD: F -> FLOCK, FET, FIL...), sau đó là CHỨA query
 */
app.get('/api/market/symbols', (req, res) => {
  const q = String(req.query.q || '').trim().toUpperCase();
  if (!q) {
    const popular = ['BTC', 'ETH', 'SOL', 'SUI', 'DOGE', 'PEPE', 'NEAR', 'XRP', 'BNB', 'LINK'];
    const matched = okxUsdtSwapsCache.filter(item => popular.includes(item.coin));
    return res.json({ success: true, count: matched.length, symbols: matched });
  }

  // 1. Ưu tiên coin BẮT ĐẦU bằng q
  const startsWith = okxUsdtSwapsCache.filter(item => item.coin.startsWith(q));
  // 2. Kế tiếp coin CHỨA q
  const contains = okxUsdtSwapsCache.filter(item => !item.coin.startsWith(q) && item.coin.includes(q));

  const results = [...startsWith, ...contains].slice(0, 16);
  res.json({ success: true, count: results.length, symbols: results });
});

// =============================================================================
// KHỞI CHẠY SERVER BIND TẠI 127.0.0.1
// =============================================================================
const server = app.listen(PORT, HOST, () => {
  logger.info(`=============================================================`);
  logger.info(`🚀 LOCAL ORCHESTRATOR SERVER ĐANG CHẠY TẠI: http://${HOST}:${PORT}`);
  logger.info(`📊 Dashboard Giao Diện Web:           http://${HOST}:${PORT}`);
  logger.info(`📩 TradingView Webhook Endpoint:      http://${HOST}:${PORT}/api/tv-webhook`);
  logger.info(`🎯 Setups Receiver Endpoint:          http://${HOST}:${PORT}/api/setups`);
  logger.info(`📁 File Log Hoạt Động:                ${path.resolve(__dirname, process.env.LOG_FILE || './logs/app.log')}`);
  logger.info(`=============================================================`);

  // Đồng bộ danh mục USDT SWAP từ OKX và làm mới mỗi 2 giờ
  loadOkxSwapInstruments();
  setInterval(loadOkxSwapInstruments, 2 * 60 * 60 * 1000);
});

// Xử lý dừng máy chủ an toàn (Graceful Shutdown)
function handleShutdown(signal) {
  logger.info(`Nhận tín hiệu ${signal}. Đang đóng máy chủ an toàn...`);
  server.close(() => {
    logger.info('Máy chủ đã dừng hoàn tất.');
    process.exit(0);
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

module.exports = { app, server };
