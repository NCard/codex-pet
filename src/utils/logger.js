const fs = require('fs');
const path = require('path');

const { logDir } = require('./paths');
const logFilePath = path.join(logDir, 'app.log');

// Format timestamp
function getTimestamp() {
  return new Date().toISOString();
}

// Format error and object arguments
function formatArg(arg) {
  if (arg instanceof Error) {
    return `${arg.message}\n${arg.stack}`;
  }
  if (typeof arg === 'object') {
    try {
      return JSON.stringify(arg, null, 2);
    } catch (e) {
      return String(arg);
    }
  }
  return String(arg);
}

function writeLog(level, args) {
  try {
    const message = args.map(formatArg).join(' ');
    const logLine = `[${getTimestamp()}] [${level}] ${message}\n`;
    fs.appendFileSync(logFilePath, logLine, 'utf8');
  } catch (err) {
    // Ignore logging errors to prevent infinite loops or app crashes
  }
}

const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug
};

console.log = function(...args) {
  writeLog('INFO', args);
  originalConsole.log.apply(console, args);
};

console.info = function(...args) {
  writeLog('INFO', args);
  originalConsole.info.apply(console, args);
};

console.warn = function(...args) {
  writeLog('WARN', args);
  originalConsole.warn.apply(console, args);
};

console.error = function(...args) {
  writeLog('ERROR', args);
  originalConsole.error.apply(console, args);
};

console.debug = function(...args) {
  writeLog('DEBUG', args);
  originalConsole.debug.apply(console, args);
};

module.exports = { logFilePath };
