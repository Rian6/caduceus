const electron = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const assert = require('node:assert/strict');

electron.app.setPath('userData', path.join(__dirname, '../.runtime-check'));
electron.app.whenReady().then(async () => {
  const filename = path.resolve(__dirname, '../dist-electron/main.js');
  const localRequire = createRequire(filename);
  const channels = new Set();
  const windows = [];
  const mockedElectron = {
    ...electron,
    app: {
      isPackaged: false,
      getPath: name => electron.app.getPath(name),
      whenReady: () => ({ then: () => ({ catch() {} }) }),
      on() {}
    },
    ipcMain: { handle(channel) { assert(!channels.has(channel), `Duplicate IPC: ${channel}`); channels.add(channel); } },
    BrowserWindow: class {
      constructor(options) {
        const window = new electron.BrowserWindow({ ...options, show: false });
        window.show = () => {};
        windows.push(window);
        return window;
      }
    }
  };
  const context = {
    require: name => name === 'electron' ? mockedElectron : localRequire(name),
    exports: {}, module: { exports: {} }, __dirname: path.dirname(filename),
    process, console, Buffer, setTimeout, clearTimeout, setInterval, clearInterval
  };
  try {
    vm.runInNewContext(fs.readFileSync(filename, 'utf8') + '\nmodule.exports = { createSplash };', context, { filename });
    const splash = await context.module.exports.createSplash();
    const dimensions = await splash.webContents.executeJavaScript(`(async () => {
      const img = document.querySelector('img');
      await img.decode();
      return { width: img.naturalWidth, height: img.naturalHeight, embedded: img.src.startsWith('data:image/webp;base64,') };
    })()`);
    assert(dimensions.embedded);
    assert(dimensions.width > 0 && dimensions.height > 0);
    console.log('PASS: splash image decoded in Electron:', dimensions);
  } finally {
    for (const window of windows) window.destroy();
  }
  electron.app.exit(0);
}).catch(error => { console.error(error); electron.app.exit(1); });
