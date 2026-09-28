const assert = require('node:assert/strict');
const path = require('node:path');
const { ActivitySamples, OplActivityMonitor } = require('../dist-electron/opl-activity.js');

async function main() {
  const samples = new ActivitySamples();
  const game = 'C:\\PS2\\DVD\\game.iso';
  samples.update([game], 10000);
  assert.deepEqual(samples.read(10000), [], 'one brief open is not gameplay');
  samples.update([game], 11500);
  assert.deepEqual(samples.read(11500), [game], 'stable open file is active');
  samples.update([], 13000);
  assert.deepEqual(samples.read(13000), [], 'close or disconnect clears immediately');
  samples.update([game], 14500);
  samples.update([game], 16000);
  assert.deepEqual(samples.read(22000), [], 'stalled helper cannot retain old game');
  samples.update([game], 24000);
  assert.deepEqual(samples.read(24000), [], 'stale observation cannot confirm new activity');
  samples.update([game.toLowerCase()], 25500);
  assert.equal(samples.read(25500).length, 1, 'Windows paths are case insensitive');

  const monitor = new OplActivityMonitor(path.join(__dirname, '../electron/native/opl-activity.ps1'), 1024);
  try {
    monitor.read();
    await new Promise(resolve => setTimeout(resolve, 4500));
    assert(monitor.samples.sampledAt > 0, 'native helper must send valid samples');
    assert.equal(monitor.lastError, '', 'native helper must run without errors');
  } finally {
    monitor.stop();
  }
  console.log('PASS: activity lifecycle, stale telemetry, and native helper integration.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
