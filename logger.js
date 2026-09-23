/**
 * Local Orchestrator - Logger Module
 * Ghi log ra màn hình console và đồng thời ghi tuần tự vào file logs/app.log (hỗ trợ debug qua đêm)
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.resolve(__dirname, process.env.LOG_DIR || './logs');
const LOG_FILE = path.resolve(__dirname, process.env.LOG_FILE || './logs/app.log');

// Đảm bảo thư mục logs luôn tồn tại
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Lấy chuỗi thời gian hiện tại định dạng ISO địa phương
 * @returns {string} YYYY-MM-DD HH:mm:ss.SSS
 */
function getTimestamp() {
  const now = new Date();
  const pad = (n, s = 2) => String(n).padStart(s, '0');
  const d = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const t = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
  return `${d} ${t}`;
}

/**
 * Ghi dòng log vào file logs/app.log
 * @param {string} level - INFO, WARN, ERROR, DEBUG
 * @param {string} message - Nội dung log
 * @param {Object} [meta=null] - Dữ liệu bổ sung
 */
function writeLog(level, message, meta = null) {
  const time = getTimestamp();
  let metaStr = '';
  if (meta !== null && meta !== undefined) {
    if (meta instanceof Error) {
      metaStr = ` | Error: ${meta.message}\n${meta.stack}`;
    } else if (typeof meta === 'object') {
      try {
        metaStr = ` | ${JSON.stringify(meta)}`;
      } catch (e) {
        metaStr = ` | [Circular Object]`;
      }
    } else {
      metaStr = ` | ${meta}`;
    }
  }

  const logLine = `[${time}] [${level.toUpperCase().padEnd(5)}] ${message}${metaStr}\n`;

  // 1. In ra console với màu sắc
  if (level === 'ERROR') {
    console.error(`\x1b[31m${logLine.trimEnd()}\x1b[0m`);
  } else if (level === 'WARN') {
    console.warn(`\x1b[33m${logLine.trimEnd()}\x1b[0m`);
  } else {
    console.log(logLine.trimEnd());
  }

  // 2. Ghi append vào file logs/app.log
  try {
    fs.appendFileSync(LOG_FILE, logLine, 'utf8');

    // Đồng thời ghi vào log theo ngày dạng app-YYYY-MM-DD.log để lưu trữ dài hạn
    const today = time.split(' ')[0];
    const dailyFile = path.join(LOG_DIR, `app-${today}.log`);
    fs.appendFileSync(dailyFile, logLine, 'utf8');
  } catch (err) {
    console.error('Không thể ghi file log:', err.message);
  }
}

const logger = {
  info: (msg, meta) => writeLog('INFO', msg, meta),
  warn: (msg, meta) => writeLog('WARN', msg, meta),
  error: (msg, meta) => writeLog('ERROR', msg, meta),
  debug: (msg, meta) => writeLog('DEBUG', msg, meta),

  /**
   * Express Middleware tự động ghi nhật ký mọi request vào / ra
   */
  requestLogger: (req, res, next) => {
    const start = Date.now();
    const { method, originalUrl, ip } = req;

    res.on('finish', () => {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;
      const level = statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO';
      logger[level.toLowerCase()](
        `${method} ${originalUrl} -> HTTP ${statusCode} (${duration}ms) [IP: ${ip}]`
      );
    });

    next();
  }
};

module.exports = logger;
