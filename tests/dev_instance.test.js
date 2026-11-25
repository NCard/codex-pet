const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  classifyChangedFile,
  readDevPidRecord,
  registerCurrentDevInstance,
  terminateExistingDevInstance,
  cleanupCurrentDevInstance,
  killProcessTree
} = require('../src/utils/dev_instance');

describe('Dev Instance & Hot Reload Utils Unit Tests', () => {
  test('classifyChangedFile should separate renderer, main, and ignored paths accurately', () => {
    // Renderer files
    assert.strictEqual(classifyChangedFile('src/views/settings/settings.html'), 'renderer');
    assert.strictEqual(classifyChangedFile('src\\views\\settings\\settings.css'), 'renderer');
    assert.strictEqual(classifyChangedFile('src/views/main/renderer.js'), 'renderer');
    assert.strictEqual(classifyChangedFile('assets/images/kiwi.png'), 'renderer');

    // Main / backend / shared modules
    assert.strictEqual(classifyChangedFile('src/main/main.js'), 'main');
    assert.strictEqual(classifyChangedFile('src\\utils\\chat_sizing.js'), 'main');
    assert.strictEqual(classifyChangedFile('src/services/ai_provider.js'), 'main');
    assert.strictEqual(classifyChangedFile('src/mcp/mcp-server.js'), 'main');
    assert.strictEqual(classifyChangedFile('package.json'), 'main');
    assert.strictEqual(classifyChangedFile('.env'), 'main');

    // Ignored files (docs, tests, logs, dotfiles, node_modules, etc.)
    assert.strictEqual(classifyChangedFile('README.md'), 'ignore');
    assert.strictEqual(classifyChangedFile('docs/guide.md'), 'ignore');
    assert.strictEqual(classifyChangedFile('tests/chat_sizing.test.js'), 'ignore');
    assert.strictEqual(classifyChangedFile('src/views/main/foo.test.js'), 'ignore');
    assert.strictEqual(classifyChangedFile('logs/app.log'), 'ignore');
    assert.strictEqual(classifyChangedFile('data/pet_state.json'), 'ignore');
    assert.strictEqual(classifyChangedFile('.git/HEAD'), 'ignore');
    assert.strictEqual(classifyChangedFile('node_modules/chokidar/index.js'), 'ignore');
    assert.strictEqual(classifyChangedFile('dist/win-unpacked/app.exe'), 'ignore');
    assert.strictEqual(classifyChangedFile('scripts/dev.js'), 'ignore');
  });

  test('register, terminate, and safe cleanup should prevent duplicate dev instances without race deletion', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-dev-pid-'));
    const pidFile = path.join(tmpDir, 'dev-electron.pid');
    const workspaceA = path.join(tmpDir, 'workspace-a');
    const workspaceB = path.join(tmpDir, 'workspace-b');

    try {
      // 1. Register an existing dev session with runnerPid + electron pid
      const ok = registerCurrentDevInstance({
        pidFilePath: pidFile,
        pid: 41002,
        runnerPid: 41001,
        workspace: workspaceA
      });
      assert.strictEqual(ok, true);

      const rec = readDevPidRecord(pidFile);
      assert.strictEqual(rec.pid, 41002);
      assert.strictEqual(rec.runnerPid, 41001);

      // 2. Different workspace must NOT kill workspaceA's process
      const killedOther = [];
      const resOther = terminateExistingDevInstance({
        pidFilePath: pidFile,
        currentPid: 99999,
        workspace: workspaceB,
        isAliveFn: () => true,
        killTreeFn: (pid) => killedOther.push(pid)
      });
      assert.strictEqual(resOther.terminated, false);
      assert.deepStrictEqual(killedOther, []);

      // 3. Same workspace should kill runnerPid first, then electron pid
      const killedSame = [];
      const resSame = terminateExistingDevInstance({
        pidFilePath: pidFile,
        currentPid: 42000,
        workspace: workspaceA,
        isAliveFn: (pid) => pid === 41001 || pid === 41002,
        killTreeFn: (pid) => killedSame.push(pid)
      });
      assert.strictEqual(resSame.terminated, true);
      assert.deepStrictEqual(killedSame, [41001, 41002]);

      // 4. Register new instance PID; old instance cleanup must NOT delete the new PID file
      registerCurrentDevInstance({
        pidFilePath: pidFile,
        pid: 42000,
        runnerPid: null,
        workspace: workspaceA
      });
      const oldCleaned = cleanupCurrentDevInstance({ pidFilePath: pidFile, pid: 41002 });
      assert.strictEqual(oldCleaned, false);
      assert.strictEqual(fs.existsSync(pidFile), true);

      // 5. Current instance cleanup removes the PID file
      const newCleaned = cleanupCurrentDevInstance({ pidFilePath: pidFile, pid: 42000 });
      assert.strictEqual(newCleaned, true);
      assert.strictEqual(fs.existsSync(pidFile), false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('killProcessTree should invoke taskkill /T /F on win32 and SIGTERM on POSIX', () => {
    const calls = [];
    const winOk = killProcessTree(12345, {
      platform: 'win32',
      execFileSyncFn: (cmd, args) => {
        calls.push({ cmd, args });
      }
    });
    assert.strictEqual(winOk, true);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].cmd, 'taskkill');
    assert.deepStrictEqual(calls[0].args, ['/pid', '12345', '/T', '/F']);

    const posixCalls = [];
    const posixOk = killProcessTree(54321, {
      platform: 'linux',
      killFn: (pid, signal) => posixCalls.push({ pid, signal })
    });
    assert.strictEqual(posixOk, true);
    assert.deepStrictEqual(posixCalls, [{ pid: 54321, signal: 'SIGTERM' }]);
  });
});
