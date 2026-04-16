const fs = require('fs');
const path = require('path');

let logFilePath = null;

function ensureLogDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function formatMeta(meta) {
  if (!meta) return '';

  if (meta instanceof Error) {
    return `${meta.message}\n${meta.stack || ''}`.trim();
  }

  if (typeof meta === 'string') {
    return meta;
  }

  try {
    return JSON.stringify(meta);
  } catch {
    return String(meta);
  }
}

function writeLine(level, scope, message, meta) {
  const timestamp = new Date().toISOString();
  const suffix = formatMeta(meta);
  const line = `${timestamp} [${level}] [${scope}] ${message}${suffix ? ` | ${suffix}` : ''}\n`;

  try {
    if (logFilePath) {
      fs.appendFileSync(logFilePath, line, 'utf8');
    }
  } catch (err) {
    console.error('[logger] 寫入日誌失敗:', err);
  }

  if (level === 'ERROR') {
    console.error(line.trim());
  } else if (level === 'WARN') {
    console.warn(line.trim());
  } else {
    console.log(line.trim());
  }
}

function initLogger(app) {
  try {
    const logDir = path.join(app.getPath('userData'), 'logs');
    ensureLogDir(logDir);
    logFilePath = path.join(logDir, 'app.log');
    writeLine('INFO', 'logger', '日誌初始化完成', { logFilePath });
  } catch (err) {
    console.error('[logger] 初始化失敗:', err);
  }
}

function getLogFilePath() {
  return logFilePath;
}

function info(scope, message, meta) {
  writeLine('INFO', scope, message, meta);
}

function warn(scope, message, meta) {
  writeLine('WARN', scope, message, meta);
}

function error(scope, message, meta) {
  writeLine('ERROR', scope, message, meta);
}

module.exports = {
  initLogger,
  getLogFilePath,
  info,
  warn,
  error,
};
