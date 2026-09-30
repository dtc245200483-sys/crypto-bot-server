/**
 * Local Orchestrator - SQLite Database Module
 * Tương thích cao với cả better-sqlite3 và built-in node:sqlite trong Node.js v24
 * Lưu trữ lịch sử setups, alert webhook từ TradingView và danh sách symbol OKX.
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const DB_PATH = path.resolve(__dirname, process.env.DB_PATH || './data/orchestrator.db');
const DB_DIR = path.dirname(DB_PATH);

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Khởi tạo kết nối SQLite
let db;
try {
  // Thử nạp better-sqlite3 trước nếu có
  const BetterSqlite3 = require('better-sqlite3');
  db = new BetterSqlite3(DB_PATH);
  logger.info(`[Database] Đã kết nối SQLite qua better-sqlite3 (${DB_PATH})`);
} catch (e) {
  // Fallback sang node:sqlite tích hợp sẵn trong Node.js v22/v24 (cực kỳ ổn định trên Windows)
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(DB_PATH);
  logger.info(`[Database] Đã kết nối SQLite qua native node:sqlite DatabaseSync (${DB_PATH})`);
}

// Tối ưu hiệu năng SQLite (WAL mode, foreign keys)
try {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
} catch (e) {}

/**
 * Khởi tạo cấu trúc các bảng trong cơ sở dữ liệu
 */
function initializeTables() {
  db.exec(`
    -- Bảng lưu trữ toàn bộ các setup hợp lệ được gửi từ TradingView Extension
    CREATE TABLE IF NOT EXISTS setups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      base_timeframe TEXT NOT NULL,
      signal TEXT NOT NULL,
      entry REAL NOT NULL,
      tp1 REAL,
      tp2 REAL,
      tp3 REAL,
      sl REAL,
      win_rate REAL NOT NULL,
      profit_factor REAL NOT NULL,
      total_pnl REAL NOT NULL,
      confirmed_by TEXT,
      scanned_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      status TEXT DEFAULT 'active'
    );

    CREATE INDEX IF NOT EXISTS idx_setups_symbol ON setups(symbol);
    CREATE INDEX IF NOT EXISTS idx_setups_scanned_at ON setups(scanned_at DESC);
    CREATE INDEX IF NOT EXISTS idx_setups_status ON setups(status);

    -- Bảng lưu trữ các tin nhắn webhook alert nhận được từ TradingView (Phương án A)
    CREATE TABLE IF NOT EXISTS tv_webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT,
      timeframe TEXT,
      signal TEXT,
      entry REAL,
      win_rate REAL,
      profit_factor REAL,
      total_pnl REAL,
      raw_payload TEXT NOT NULL,
      received_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tv_webhooks_lookup ON tv_webhooks(symbol, timeframe, received_at DESC);

    -- Bảng lưu trữ danh sách hợp đồng OKX (dự phòng khi cần tách rời direct message)
    CREATE TABLE IF NOT EXISTS okx_symbols (
      inst_id TEXT PRIMARY KEY,
      tv_symbol TEXT NOT NULL,
      contract_type TEXT,
      last_price REAL,
      vol_ccy_24h REAL,
      lever TEXT,
      min_sz TEXT,
      updated_at INTEGER NOT NULL
    );

    -- Bảng lưu trữ nến OKX 3 khung (30m, 1H, 4H) liên kết với setup_id
    CREATE TABLE IF NOT EXISTS candles (
      setup_id INTEGER NOT NULL,
      timeframe TEXT NOT NULL,
      time INTEGER NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume REAL NOT NULL,
      PRIMARY KEY (setup_id, timeframe, time),
      FOREIGN KEY (setup_id) REFERENCES setups(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_candles_setup ON candles(setup_id, timeframe, time ASC);

    CREATE TABLE IF NOT EXISTS system_meta (
      key TEXT PRIMARY KEY,
      val TEXT
    );

    -- Bảng lưu trữ người dùng đăng nhập hệ thống (Google OAuth & Local)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      avatar TEXT,
      role TEXT DEFAULT 'PRO VIP',
      created_at INTEGER NOT NULL,
      last_login_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
  `);

  // Tự động migration thêm các cột nếu chưa có
  try { db.exec('ALTER TABLE setups ADD COLUMN avg_profit REAL;'); } catch (e) {}
  try { db.exec('ALTER TABLE setups ADD COLUMN total_profit REAL;'); } catch (e) {}
  try { db.exec("ALTER TABLE setups ADD COLUMN indicator TEXT DEFAULT 'luxalgo';"); } catch (e) {}

  logger.info('[Database] Khởi tạo cấu trúc bảng SQLite thành công.');
}

/**
 * Hàm nạp dữ liệu mẫu - ĐÃ TẮT để không sinh dữ liệu ảo
 */
function seedSampleDataIfEmpty() {
  // Đã tắt hoàn toàn theo yêu cầu người dùng
}

/**
 * Lưu một setup mới vào bảng setups (không ghi đè, lưu lịch sử)
 * @param {Object} s - Setup object
 * @returns {number} ID của dòng vừa chèn
 */
function insertSetup(s) {
  const stmt = db.prepare(`
    INSERT INTO setups (
      symbol, base_timeframe, signal, entry, tp1, tp2, tp3, sl,
      win_rate, profit_factor, total_pnl, confirmed_by, scanned_at, created_at, status,
      avg_profit, total_profit, indicator
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const confirmedByStr = Array.isArray(s.confirmedBy) ? JSON.stringify(s.confirmedBy) : (s.confirmedBy || '["45m","30m"]');
  const scannedAt = s.scannedAt || Date.now();
  const createdAt = Date.now();
  const status = s.status || 'active';
  const avgProfit = (s.avgProfit !== undefined && s.avgProfit !== null) ? Number(s.avgProfit) : (Number(s.avg_profit) || 0);
  const totalProfit = (s.totalProfit !== undefined && s.totalProfit !== null) ? Number(s.totalProfit) : (Number(s.total_profit) || 0);
  const indicator = s.indicator || 'luxalgo';

  const result = stmt.run(
    s.symbol,
    s.baseTimeframe,
    s.signal.toLowerCase(),
    Number(s.entry) || 0,
    Number(s.tp1) || 0,
    Number(s.tp2) || 0,
    Number(s.tp3) || 0,
    Number(s.sl) || 0,
    Number(s.winRate) || 0,
    Number(s.profitFactor) || 0,
    Number(s.totalPnL) || 0,
    confirmedByStr,
    scannedAt,
    createdAt,
    status,
    avgProfit,
    totalProfit,
    indicator
  );

  return result.lastInsertRowid;
}

/**
 * Truy vấn danh sách setup theo bộ lọc
 * @param {Object} filters
 * @returns {Array<Object>}
 */
function getSetups(filters = {}) {
  let query = `
    SELECT s.*, 
      EXISTS(SELECT 1 FROM candles c WHERE c.setup_id = s.id LIMIT 1) AS has_candles
    FROM setups s 
    WHERE 1=1
  `;
  const params = [];

  if (filters.status && filters.status !== 'all') {
    query += ' AND s.status = ?';
    params.push(filters.status);
  }

  if (filters.symbol) {
    query += ' AND s.symbol LIKE ?';
    params.push(`%${filters.symbol.trim()}%`);
  }

  if (filters.signal && filters.signal !== 'all') {
    query += ' AND s.signal = ?';
    params.push(filters.signal.toLowerCase());
  }

  if (filters.baseTimeframe && filters.baseTimeframe !== 'all') {
    query += ' AND s.base_timeframe = ?';
    params.push(filters.baseTimeframe);
  }

  if (filters.indicator && filters.indicator !== 'all') {
    query += ' AND s.indicator = ?';
    params.push(filters.indicator.toLowerCase());
  }

  query += ' ORDER BY s.scanned_at DESC';

  const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 500, 1), 1000);
  query += ` LIMIT ${limit}`;

  const rows = db.prepare(query).all(...params);

  // Parse confirmed_by từ JSON string thành Array
  return rows.map(r => {
    let confirmedBy = [];
    try {
      confirmedBy = JSON.parse(r.confirmed_by || '[]');
    } catch (e) {
      confirmedBy = ['45m', '30m'];
    }
    return {
      id: r.id,
      symbol: r.symbol,
      baseTimeframe: r.base_timeframe,
      signal: r.signal,
      entry: r.entry,
      tp1: r.tp1,
      tp2: r.tp2,
      tp3: r.tp3,
      sl: r.sl,
      winRate: r.win_rate,
      profitFactor: r.profit_factor,
      totalPnL: r.total_pnl,
      avgProfit: (r.avg_profit !== undefined && r.avg_profit !== null) ? r.avg_profit : null,
      totalProfit: (r.total_profit !== undefined && r.total_profit !== null) ? r.total_profit : null,
      indicator: r.indicator || 'luxalgo',
      confirmedBy,
      scannedAt: r.scanned_at,
      createdAt: r.created_at,
      status: r.status,
      hasCandles: Boolean(r.has_candles)
    };
  });
}

/**
 * Lưu tin nhắn webhook từ TradingView
 * @param {Object} rawBody
 * @returns {number}
 */
function insertTvWebhook(rawBody) {
  const stmt = db.prepare(`
    INSERT INTO tv_webhooks (
      symbol, timeframe, signal, entry, win_rate, profit_factor, total_pnl, raw_payload, received_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const symbol = rawBody.symbol || rawBody.ticker || null;
  const timeframe = rawBody.timeframe || rawBody.interval || null;
  const signal = (rawBody.signal || rawBody.action || 'none').toLowerCase();
  const entry = Number(rawBody.entry || rawBody.close || rawBody.price) || 0;
  const winRate = Number(rawBody.winRate || rawBody.win_rate) || 0;
  const profitFactor = Number(rawBody.profitFactor || rawBody.profit_factor) || 0;
  const totalPnL = Number(rawBody.totalPnL || rawBody.total_pnl) || 0;
  const rawPayload = JSON.stringify(rawBody);
  const receivedAt = Date.now();

  const result = stmt.run(
    symbol,
    timeframe,
    signal,
    entry,
    winRate,
    profitFactor,
    totalPnL,
    rawPayload,
    receivedAt
  );

  return result.lastInsertRowid;
}

/**
 * Lấy bản ghi webhook mới nhất theo symbol và timeframe
 * @param {string} symbol
 * @param {string} timeframe
 * @returns {Object|null}
 */
function getLatestTvWebhook(symbol, timeframe) {
  const row = db.prepare(`
    SELECT * FROM tv_webhooks
    WHERE symbol = ? AND timeframe = ?
    ORDER BY received_at DESC
    LIMIT 1
  `).get(symbol, timeframe);

  if (!row) return null;

  try {
    const parsed = JSON.parse(row.raw_payload);
    return {
      symbol: row.symbol,
      timeframe: row.timeframe,
      signal: row.signal,
      entry: row.entry,
      winRate: row.win_rate,
      profitFactor: row.profit_factor,
      totalPnL: row.total_pnl,
      receivedAt: row.received_at,
      ...parsed
    };
  } catch (e) {
    return row;
  }
}

/**
 * Cập nhật danh sách symbol OKX vào database
 * @param {Array<Object>} symbols
 */
function upsertOkxSymbols(symbols) {
  const stmt = db.prepare(`
    INSERT INTO okx_symbols (
      inst_id, tv_symbol, contract_type, last_price, vol_ccy_24h, lever, min_sz, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(inst_id) DO UPDATE SET
      tv_symbol = excluded.tv_symbol,
      contract_type = excluded.contract_type,
      last_price = excluded.last_price,
      vol_ccy_24h = excluded.vol_ccy_24h,
      lever = excluded.lever,
      min_sz = excluded.min_sz,
      updated_at = excluded.updated_at
  `);

  const now = Date.now();
  for (const s of symbols) {
    stmt.run(
      s.instId,
      s.tvSymbol,
      s.contractType || 'perp',
      Number(s.lastPrice) || 0,
      Number(s.volCcy24h) || 0,
      String(s.lever || '1'),
      String(s.minSz || '0.01'),
      now
    );
  }
}

/**
 * Lấy danh sách symbol OKX đã lưu
 * @returns {Array<Object>}
 */
function getOkxSymbols() {
  return db.prepare('SELECT * FROM okx_symbols ORDER BY vol_ccy_24h DESC').all();
}

/**
 * Lưu danh sách nến vào bảng candles
 * @param {number} setupId
 * @param {string} timeframe (30m, 1H, 4H)
 * @param {Array<Object>} candlesArray
 * @returns {number} số lượng nến đã lưu
 */
function saveCandles(setupId, timeframe, candlesArray) {
  if (!setupId || !Array.isArray(candlesArray) || candlesArray.length === 0) return 0;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO candles (
      setup_id, timeframe, time, open, high, low, close, volume
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  for (const c of candlesArray) {
    stmt.run(
      Number(setupId),
      String(timeframe),
      Number(c.time),
      Number(c.open) || 0,
      Number(c.high) || 0,
      Number(c.low) || 0,
      Number(c.close) || 0,
      Number(c.volume) || 0
    );
    inserted++;
  }
  return inserted;
}

/**
 * Lấy nến 3 khung 30m, 1H, 4H cho 1 setup cụ thể (sắp xếp tăng dần theo thời gian)
 * @param {number} setupId
 * @returns {Object} { "30m": [...], "1H": [...], "4H": [...] }
 */
function getCandles(setupId) {
  const rows = db.prepare(`
    SELECT timeframe, time, open, high, low, close, volume
    FROM candles
    WHERE setup_id = ?
    ORDER BY time ASC
  `).all(Number(setupId));

  const result = {
    '30m': [],
    '1H': [],
    '4H': []
  };

  for (const r of rows) {
    const tf = r.timeframe;
    if (!result[tf]) result[tf] = [];
    result[tf].push({
      time: r.time,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume
    });
  }

  return result;
}

/**
 * Kiểm tra xem setup đã có nến lưu trữ hay chưa
 * @param {number} setupId
 * @returns {boolean}
 */
function hasCandlesForSetup(setupId) {
  const row = db.prepare('SELECT 1 FROM candles WHERE setup_id = ? LIMIT 1').get(Number(setupId));
  return Boolean(row);
}

/**
 * Xóa toàn bộ dữ liệu trong bảng setups và candles
 */
function clearSetups() {
  db.exec('DELETE FROM candles;');
  db.exec('DELETE FROM setups;');
  logger.info('[Database] Đã xóa toàn bộ dữ liệu trong bảng setups và candles.');
}

/**
 * Tìm người dùng theo địa chỉ email
 */
function findUserByEmail(email) {
  try {
    return db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1').get(String(email).trim());
  } catch (e) {
    logger.warn(`[Database] findUserByEmail error: ${e.message}`);
    return null;
  }
}

/**
 * Tìm người dùng theo ID
 */
function findUserById(id) {
  try {
    return db.prepare('SELECT * FROM users WHERE id = ? LIMIT 1').get(id);
  } catch (e) {
    logger.warn(`[Database] findUserById error: ${e.message}`);
    return null;
  }
}

/**
 * Tạo mới hoặc cập nhật thông tin người dùng Google
 */
function createOrUpdateGoogleUser({ googleId, email, name, avatar }) {
  const now = Date.now();
  let user = findUserByEmail(email);

  if (user) {
    db.prepare(`
      UPDATE users 
      SET google_id = COALESCE(?, google_id),
          name = COALESCE(?, name),
          avatar = COALESCE(?, avatar),
          last_login_at = ?
      WHERE id = ?
    `).run(googleId || null, name || null, avatar || null, now, user.id);
    return findUserById(user.id);
  } else {
    const id = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    db.prepare(`
      INSERT INTO users (id, google_id, email, name, avatar, role, created_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, 'PRO VIP', ?, ?)
    `).run(id, googleId || null, email, name || email.split('@')[0], avatar || null, now, now);
    logger.info(`[Database] Đã tạo người dùng mới từ Google: ${email} (${id})`);
    return findUserById(id);
  }
}

// Khởi chạy tạo bảng ngay khi nạp module
initializeTables();

module.exports = {
  db,
  insertSetup,
  getSetups,
  clearSetups,
  insertTvWebhook,
  getLatestTvWebhook,
  upsertOkxSymbols,
  getOkxSymbols,
  saveCandles,
  getCandles,
  hasCandlesForSetup,
  findUserByEmail,
  findUserById,
  createOrUpdateGoogleUser
};
