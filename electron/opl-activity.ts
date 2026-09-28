import { spawn, ChildProcess } from 'child_process';
import path from 'path';

// A file must stay open across two samples to exclude brief directory/catalog probes.
export class ActivitySamples {
  private previous = new Map<string, string>();
  private active: string[] = [];
  private sampledAt = 0;

  update(files: string[], now = Date.now()) {
    const current = new Map(files.map(file => [path.win32.normalize(file).toLowerCase(), file]));
    const previous = now - this.sampledAt < 6000 ? this.previous : new Map<string, string>();
    this.active = [...current].filter(([key]) => previous.has(key)).map(([, file]) => file);
    this.previous = current;
    this.sampledAt = now;
  }

  read(now = Date.now()) {
    return now - this.sampledAt < 6000 ? this.active : [];
  }
}

export class OplActivityMonitor {
  private child: ChildProcess | null = null;
  private samples = new ActivitySamples();
  private lastOutput = 0;
  private lastError = '';

  constructor(private script: string, private port: number | (()=>number)) {}

  read(): string[] {
    if (process.platform !== 'win32') return [];
    if (this.child && Date.now() - this.lastOutput > 10000) this.stop();
    if (!this.child) this.start();
    return this.samples.read();
  }

  private start() {
    const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const child = spawn(powershell, ['-NoProfile', '-NonInteractive', '-File', this.script, '-Port', String(typeof this.port === 'function' ? this.port() : this.port), '-ParentPid', String(process.pid)], {
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
    });
    this.child = child;
    this.lastOutput = Date.now();
    let pending = '';
    child.stdout!.setEncoding('utf8');
    child.stdout!.on('data', (chunk: string) => {
      if (this.child !== child) return;
      pending += chunk;
      if (pending.length > 1024 * 1024) { this.warn('Invalid activity output size'); this.stop(); return; }
      let end: number;
      while ((end = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, end).trim();
        pending = pending.slice(end + 1);
        if (!line) continue;
        try {
          const sample = JSON.parse(line);
          if (!Array.isArray(sample.files) || !sample.files.every((file: unknown) => typeof file === 'string')) throw new Error('Invalid activity sample');
          this.lastOutput = Date.now();
          this.samples.update(sample.error ? [] : sample.files);
          if (sample.error) this.warn(String(sample.error));
          else this.lastError = '';
        } catch (error) {
          this.samples.update([]);
          this.warn(String(error));
        }
      }
    });
    child.stderr!.on('data', chunk => this.warn(String(chunk).trim()));
    const clear = () => {
      if (this.child === child) { this.child = null; this.samples = new ActivitySamples(); }
    };
    child.once('error', error => { this.warn(error.message); clear(); });
    child.once('exit', clear);
  }

  private warn(message: string) {
    if (message !== this.lastError) console.warn('[now-playing]', message);
    this.lastError = message;
  }

  stop() {
    const child = this.child;
    this.child = null;
    this.samples = new ActivitySamples();
    child?.kill();
  }
}
