#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const chokidar = require('chokidar');
const electronPath = require('electron');
const { devPidPath } = require('../src/utils/paths');
const {
  killProcessTree,
  terminateExistingDevInstance,
  registerCurrentDevInstance,
  cleanupCurrentDevInstance,
  classifyChangedFile
} = require('../src/utils/dev_instance');

const projectRoot = path.resolve(__dirname, '..');
const DEBOUNCE_MS = 300;
const GRACEFUL_EXIT_TIMEOUT_MS = 1800;

let electronChild = null;
let watcher = null;
let isRestarting = false;
let isShuttingDown = false;
let debounceTimer = null;
let pendingAction = null; // 'renderer' | 'main'
let pendingFile = '';

function log(msg) {
  const now = new Date();
  const time = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join(':');
  console.log(`[Wiki Dev ${time}] ${msg}`);
}

function stopElectronChild() {
  return new Promise((resolve) => {
    const child = electronChild;
    if (!child || child.exitCode !== null || child.killed) {
      electronChild = null;
      resolve();
      return;
    }

    const pid = child.pid;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(forceTimer);
      if (electronChild === child) {
        electronChild = null;
      }
      resolve();
    };

    child.once('exit', finish);

    // 先禮貌通知 Electron 主行程乾淨退出（釋放全域快捷鍵等）
    if (child.connected) {
      try {
        child.send({ type: 'dev-graceful-quit' });
      } catch (_err) {
        // IPC 通道已關閉則交由超時強制結束
      }
    }

    const forceTimer = setTimeout(() => {
      if (!settled) {
        killProcessTree(pid);
        finish();
      }
    }, GRACEFUL_EXIT_TIMEOUT_MS);
  });
}

function startElectronChild() {
  if (isShuttingDown) return;

  const child = spawn(electronPath, ['.'], {
    cwd: projectRoot,
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    env: {
      ...process.env,
      WIKI_DEV_RUNNER: '1',
      WIKI_DEV_RUNNER_PID: String(process.pid)
    }
  });

  electronChild = child;
  registerCurrentDevInstance({
    pidFilePath: devPidPath,
    pid: child.pid,
    runnerPid: process.pid,
    workspace: projectRoot
  });

  log(`🚀 已啟動 Wiki Wiki (PID: ${child.pid}) — 輸入 rs + Enter 可手動重啟`);

  child.on('exit', (code, signal) => {
    if (electronChild === child) {
      electronChild = null;
    }

    if (isRestarting || isShuttingDown) {
      return;
    }

    // 使用者主動從視窗/選單關閉應用程式時，連帶結束 dev runner
    log(`👋 Wiki Wiki 已結束 (code=${code ?? 'null'}, signal=${signal ?? 'none'})，結束開發監看。`);
    shutdown(code || 0);
  });

  child.on('error', (err) => {
    log(`❌ 啟動 Electron 失敗：${err.message}`);
  });
}

async function restartElectron(reason) {
  if (isShuttingDown) return;
  if (isRestarting) return;

  isRestarting = true;
  log(`🔁 偵測到主行程變更 (${reason})，正在重新啟動唯一實例...`);

  try {
    await stopElectronChild();
    // 稍微等待 Windows 釋放視窗與檔案句柄
    await new Promise((r) => setTimeout(r, 150));
    isRestarting = false;
    startElectronChild();
  } catch (err) {
    isRestarting = false;
    log(`❌ 重啟過程發生錯誤：${err.message}`);
  }
}

function reloadRenderer(reason) {
  if (!electronChild || !electronChild.connected) {
    restartElectron(reason);
    return;
  }

  try {
    electronChild.send({ type: 'dev-reload-renderer', file: reason });
    log(`⚡ 前端熱重載 (${reason}) — 已即時刷新視窗`);
  } catch (_err) {
    restartElectron(reason);
  }
}

function scheduleFileChange(filePath) {
  if (isShuttingDown) return;
  const relPath = path.relative(projectRoot, filePath);
  const action = classifyChangedFile(relPath);
  if (action === 'ignore') return;

  // 若短時間內同時改了前端與主行程檔案，以主行程完整重啟為優先
  if (!pendingAction || action === 'main') {
    pendingAction = action;
    pendingFile = relPath.replace(/\\/g, '/');
  }

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const actionToRun = pendingAction;
    const fileToReport = pendingFile;
    pendingAction = null;
    pendingFile = '';

    if (actionToRun === 'main') {
      restartElectron(fileToReport);
    } else if (actionToRun === 'renderer') {
      reloadRenderer(fileToReport);
    }
  }, DEBOUNCE_MS);
}

function startWatcher() {
  const watchTargets = ['src', 'assets', 'package.json']
    .map((p) => path.join(projectRoot, p))
    .filter((p) => fs.existsSync(p));

  const envPath = path.join(projectRoot, '.env');
  if (fs.existsSync(envPath)) {
    watchTargets.push(envPath);
  }

  watcher = chokidar.watch(watchTargets, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 120,
      pollInterval: 50
    },
    ignored: (targetPath) => {
      const rel = path.relative(projectRoot, targetPath);
      if (!rel || rel.startsWith('..')) return false;
      const normalized = rel.replace(/\\/g, '/');
      if (normalized === '.env') return false;
      if (/(^|\/)\.[^/]+/.test(normalized)) return true;
      return normalized.startsWith('node_modules/') || normalized.startsWith('dist/');
    }
  });

  watcher.on('change', scheduleFileChange);
  watcher.on('add', scheduleFileChange);
  watcher.on('unlink', scheduleFileChange);
  watcher.on('error', (err) => {
    log(`⚠️ 檔案監看警告：${err.message}`);
  });
}

async function shutdown(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  clearTimeout(debounceTimer);

  if (watcher) {
    try {
      await watcher.close();
    } catch (_err) {
      // 忽略關閉錯誤
    }
    watcher = null;
  }

  await stopElectronChild();
  cleanupCurrentDevInstance({
    pidFilePath: devPidPath,
    pid: process.pid,
    matchField: 'runnerPid'
  });
  process.exit(exitCode);
}

// 1. 啟動前先清理既有的開發版實例，確保永遠只有一隻奇異鳥
const cleanupResult = terminateExistingDevInstance({
  pidFilePath: devPidPath,
  currentPid: process.pid,
  workspace: projectRoot
});
if (cleanupResult.terminated) {
  log(`🧹 已自動結束先前的開發實例 (PID: ${cleanupResult.terminatedPids.join(', ')})`);
}

// 2. 啟動檔案監看與唯一 Electron 實例
startWatcher();
startElectronChild();

// 3. 支援在終端機輸入 rs 手動觸發重啟
if (process.stdin && process.stdin.isTTY) {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    if (String(chunk).trim().toLowerCase() === 'rs') {
      restartElectron('手動指令 rs');
    }
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
