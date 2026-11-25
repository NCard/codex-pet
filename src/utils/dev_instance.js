const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { devPidPath: defaultDevPidPath } = require('./paths');

/**
 * 判斷指定 PID 是否仍在系統中執行
 */
function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err && err.code === 'EPERM';
  }
}

/**
 * 終止指定 PID 及其子行程樹（Windows 使用 taskkill /T /F 避免殘留 GPU/Renderer 子程序）
 */
function killProcessTree(pid, options = {}) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  const platform = options.platform || process.platform;
  const execFileSyncFn = options.execFileSyncFn || execFileSync;
  const killFn = options.killFn || process.kill.bind(process);

  if (platform === 'win32') {
    try {
      execFileSyncFn('taskkill', ['/pid', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
        timeout: 5000
      });
      return true;
    } catch {
      // Fallback: 行程可能剛結束或無 taskkill 權限
      try {
        killFn(pid, 'SIGTERM');
        return true;
      } catch {
        return false;
      }
    }
  }

  try {
    killFn(pid, 'SIGTERM');
    return true;
  } catch {
    return false;
  }
}

/**
 * 讀取目前的開發模式 PID 紀錄檔
 */
function readDevPidRecord(pidFilePath = defaultDevPidPath) {
  try {
    if (!fs.existsSync(pidFilePath)) return null;
    const raw = fs.readFileSync(pidFilePath, 'utf8').trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'number' && Number.isInteger(parsed)) {
      return { pid: parsed, runnerPid: null, workspace: '' };
    }
    if (parsed && typeof parsed === 'object') {
      return {
        pid: Number.isInteger(parsed.pid) ? parsed.pid : null,
        runnerPid: Number.isInteger(parsed.runnerPid) ? parsed.runnerPid : null,
        startedAt: parsed.startedAt || 0,
        workspace: typeof parsed.workspace === 'string' ? parsed.workspace : ''
      };
    }
  } catch {
    // 檔案毀損或格式錯誤時忽略
  }
  return null;
}

/**
 * 若本專案已有執行中的開發版實例，先行乾淨結束，避免重複長出第二隻
 */
function terminateExistingDevInstance(options = {}) {
  const pidFilePath = options.pidFilePath || defaultDevPidPath;
  const currentPid = options.currentPid !== undefined ? options.currentPid : process.pid;
  const workspace = options.workspace ? path.resolve(options.workspace) : null;
  const ignoreSet = new Set([currentPid, ...(options.ignorePids || [])].filter(Boolean));
  const isAliveFn = options.isAliveFn || isProcessAlive;
  const killTreeFn = options.killTreeFn || killProcessTree;

  const record = readDevPidRecord(pidFilePath);
  if (!record) {
    return { terminated: false, terminatedPids: [] };
  }

  // 若 PID 檔屬於其他資料夾的工作複本，不誤殺
  if (workspace && record.workspace) {
    const normalizedRecorded = path.resolve(record.workspace).toLowerCase();
    const normalizedCurrent = workspace.toLowerCase();
    if (normalizedRecorded !== normalizedCurrent) {
      return { terminated: false, terminatedPids: [] };
    }
  }

  // 若先前是由 dev runner 啟動，先終止 runner 再終止 Electron，避免 runner 自動拉起新實例
  const candidatePids = [];
  if (record.runnerPid && !ignoreSet.has(record.runnerPid)) {
    candidatePids.push(record.runnerPid);
  }
  if (record.pid && !ignoreSet.has(record.pid) && !candidatePids.includes(record.pid)) {
    candidatePids.push(record.pid);
  }

  const terminatedPids = [];
  for (const targetPid of candidatePids) {
    if (isAliveFn(targetPid)) {
      killTreeFn(targetPid);
      terminatedPids.push(targetPid);
    }
  }

  return {
    terminated: terminatedPids.length > 0,
    terminatedPids
  };
}

/**
 * 登記目前執行中的開發模式 PID（含選擇性的 dev runner PID）
 */
function registerCurrentDevInstance(options = {}) {
  const pidFilePath = options.pidFilePath || defaultDevPidPath;
  const pid = options.pid !== undefined ? options.pid : process.pid;
  const runnerPid = Number.isInteger(options.runnerPid) ? options.runnerPid : null;
  const workspace = options.workspace ? path.resolve(options.workspace) : '';

  try {
    const dir = path.dirname(pidFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const payload = {
      pid,
      runnerPid,
      startedAt: Date.now(),
      workspace
    };
    fs.writeFileSync(pidFilePath, JSON.stringify(payload, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

/**
 * 退出時清理 PID 檔：僅當紀錄仍屬於目前行程才刪除，避免舊實例誤刪新實例的紀錄
 */
function cleanupCurrentDevInstance(options = {}) {
  const pidFilePath = options.pidFilePath || defaultDevPidPath;
  const pid = options.pid !== undefined ? options.pid : process.pid;
  const matchField = options.matchField || 'pid';

  const record = readDevPidRecord(pidFilePath);
  if (!record || record[matchField] !== pid) {
    return false;
  }

  try {
    fs.unlinkSync(pidFilePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 依據相對路徑判斷檔案變更應觸發的熱重載策略：
 * - 'renderer': 僅刷新視窗畫面（不重啟主行程）
 * - 'main': 完整重啟 Electron 主行程
 * - 'ignore': 忽略（文件、測試、日誌、快取等）
 */
function classifyChangedFile(relPath) {
  if (!relPath || typeof relPath !== 'string') return 'ignore';
  const normalized = relPath
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .trim();

  if (!normalized) return 'ignore';
  const lower = normalized.toLowerCase();

  // .env 變更需重啟主行程重新載入環境變數
  if (lower === '.env') return 'main';

  // 忽略隱藏檔/目錄 (.git, .system_generated, .vscode 等)
  if (/(^|\/)\.[^/]+/.test(normalized)) return 'ignore';

  // 忽略非執行期目錄
  const ignoredPrefixes = [
    'node_modules/',
    'tests/',
    'docs/',
    'dist/',
    'logs/',
    'data/',
    'coverage/',
    'scripts/'
  ];
  if (ignoredPrefixes.some(prefix => lower.startsWith(prefix))) {
    return 'ignore';
  }

  // 忽略文件、測試、日誌、暫存與 sourcemap 檔
  if (
    lower.endsWith('.md') ||
    lower.endsWith('.log') ||
    lower.endsWith('.test.js') ||
    lower.endsWith('.spec.js') ||
    lower.endsWith('.map') ||
    lower.endsWith('.tmp') ||
    lower.endsWith('.bak')
  ) {
    return 'ignore';
  }

  // 前端介面與靜態資源：僅做視窗熱刷新
  if (lower.startsWith('src/views/') || lower.startsWith('assets/')) {
    return 'renderer';
  }

  // 主行程、工具、AI 服務、MCP 與套件設定：完整重啟
  if (
    lower.startsWith('src/main/') ||
    lower.startsWith('src/utils/') ||
    lower.startsWith('src/services/') ||
    lower.startsWith('src/mcp/') ||
    lower === 'package.json'
  ) {
    return 'main';
  }

  return 'ignore';
}

module.exports = {
  isProcessAlive,
  killProcessTree,
  readDevPidRecord,
  terminateExistingDevInstance,
  registerCurrentDevInstance,
  cleanupCurrentDevInstance,
  classifyChangedFile
};
