import fs from 'node:fs';
import path from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';

const runtimeFiles = ['OPLServer.exe','OPLServer.config','SMBLibrary.dll','SMBLibrary.Win32.dll','Utilities.dll'];
const folders = ['DVD','CD','ART','CFG','CHT','VMC','APPS','LNG','THM'];
const marker = '.ps2-library-runtime';
export type StorageMode = 'move' | 'fresh';
export type StorageProgress = {phase:string; received:number; total:number; file?:string};
export function validatePort(port:unknown):asserts port is number {
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Informe uma porta inteira entre 1 e 65535.');
}

function canonical(input:string):string {
  const full = path.resolve(input);
  if (fs.existsSync(full)) return fs.realpathSync.native(full);
  const parent = path.dirname(full);
  if (parent === full) return full;
  return path.join(canonical(parent), path.basename(full));
}
function inside(parent:string, child:string) {
  const relative = path.relative(parent.toLowerCase(), child.toLowerCase());
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}
async function inventory(root:string, relative = ''):Promise<{name:string; size:number; directory:boolean; modified:number}[]> {
  const result:{name:string; size:number; directory:boolean; modified:number}[] = [];
  for (const entry of await fs.promises.readdir(path.join(root, relative), {withFileTypes:true})) {
    const name = path.join(relative, entry.name);
    const info = await fs.promises.lstat(path.join(root, name));
    if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile())) throw new Error('A pasta contém links ou arquivos especiais. Remova-os antes de alterar o local.');
    result.push({name, size:info.isFile() ? info.size : 0, directory:info.isDirectory(), modified:info.mtimeMs});
    if (info.isDirectory()) result.push(...await inventory(root, name));
  }
  return result;
}
async function digest(file:string) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export class OplStorage {
  root:string;
  port:number;
  constructor(readonly defaultRoot:string, readonly resources:string, readonly settingsFile:string, readonly protectedPaths:string[]) {
    const settings = fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile, 'utf8')) : {};
    this.root = settings.oplDirectory || defaultRoot;
    this.port = settings.oplPort ?? 1024;
    validatePort(this.port);
    if (!path.isAbsolute(this.root) || path.basename(this.root).toLowerCase() !== 'oplserver') throw new Error('Pasta do OPL Server inválida nas configurações.');
  }

  ensure(root = this.root) {
    fs.mkdirSync(root, {recursive:true});
    for (const file of runtimeFiles) {
      const target = path.join(root, file);
      if (!fs.existsSync(target)) fs.copyFileSync(path.join(this.resources, file), target);
    }
    // The bundled legacy build rejects ports >=1025 in tstbPort_Leave.
    // Widen that exact IL comparison to 65536; keep the distributed binary intact.
    const executable = path.join(root, 'OPLServer.exe');
    const binary = fs.readFileSync(executable);
    const legacyPortLimit = Buffer.from('061631280620010400002f20', 'hex');
    const offset = binary.indexOf(legacyPortLimit);
    if (offset >= 0 && binary.indexOf(legacyPortLimit, offset + 1) === -1) {
      binary.writeInt32LE(65536, offset + 6);
      fs.writeFileSync(executable, binary);
    }
    for (const folder of folders) fs.mkdirSync(path.join(root, 'PS2', folder), {recursive:true});
    const config = path.join(root, 'OPLServer.config');
    const original = fs.readFileSync(config, 'utf8');
    const share = path.join(root, 'PS2').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const entry = `<add key="SharePath" value="${share}" />`;
    let next = /<add\s+key="SharePath"[^>]*\/>/i.test(original)
      ? original.replace(/<add\s+key="SharePath"[^>]*\/>/i, () => entry)
      : original.replace('</appSettings>', `${entry}\n    </appSettings>`);
    const portEntry = `<add key="ServerPort" value="${this.port}" />`;
    next = /<add\s+key="ServerPort"[^>]*\/>/i.test(next)
      ? next.replace(/<add\s+key="ServerPort"[^>]*\/>/i, () => portEntry)
      : next.replace('</appSettings>', `${portEntry}\n    </appSettings>`);
    if (next !== original) fs.writeFileSync(config, next);
    // ConfigurationManager reads the executable-specific file, not the template.
    const executableConfig = path.join(root, 'OPLServer.exe.config');
    if (!fs.existsSync(executableConfig) || fs.readFileSync(executableConfig, 'utf8') !== next) fs.writeFileSync(executableConfig, next);
    if (!fs.existsSync(path.join(root, marker))) fs.writeFileSync(path.join(root, marker), 'Caduceus runtime\n');
  }

  private save(root:string) {
    fs.mkdirSync(path.dirname(this.settingsFile), {recursive:true});
    const settings = fs.existsSync(this.settingsFile) ? JSON.parse(fs.readFileSync(this.settingsFile,'utf8')) : {};
    const temp = this.settingsFile + '.tmp-' + randomUUID();
    fs.writeFileSync(temp, JSON.stringify({...settings, oplDirectory:root, oplPort:this.port}, null, 2));
    fs.renameSync(temp, this.settingsFile);
    this.root = root;
  }

  setPort(port:number) {
    validatePort(port);
    const previous = this.port;
    this.port = port;
    try {this.ensure();this.save(this.root)} catch(error) {this.port=previous;this.ensure();throw error}
  }

  async describe() {
    const exists = fs.existsSync(this.root);
    const entries = exists ? await inventory(this.root) : [];
    return {directory:this.root, isoDirectory:path.join(this.root,'PS2','DVD'), exists,
      bytes:entries.reduce((total, entry) => total + entry.size, 0),
      isoCount:entries.filter(entry => path.basename(entry.name).toLowerCase() !== 'games.bin' && /\.(iso|zso|bin)$/i.test(entry.name) && /^(PS2)[\\/](DVD|CD)[\\/]/i.test(entry.name)).length};
  }

  validateTarget(target:string) {
    if (!path.isAbsolute(target) || path.basename(target).toLowerCase() !== 'oplserver') throw new Error('Escolha uma pasta de destino pelo seletor.');
    const source = canonical(this.root), destination = canonical(target);
    if (inside(source, destination) || inside(destination, source)) throw new Error('A nova pasta não pode ser a atual, uma subpasta dela ou uma pasta que a contenha.');
    if (fs.existsSync(destination)) throw new Error('Já existe uma pasta oplserver nesse destino. Escolha outra pasta para não sobrescrever arquivos.');
    for (const protectedPath of [...this.protectedPaths, this.resources]) {
      const resolved = canonical(protectedPath);
      if (inside(destination, resolved) || inside(resolved, destination)) throw new Error('Escolha uma pasta fora dos arquivos do aplicativo.');
    }
    if (!fs.statSync(path.dirname(destination)).isDirectory()) throw new Error('A pasta de destino não existe.');
    return destination;
  }

  private validateRemoval(source:string) {
    const resolved = canonical(source);
    if (resolved !== source || path.basename(resolved).toLowerCase() !== 'oplserver') throw new Error('A pasta antiga mudou ou é um link. Ela não será excluída.');
    for (const protectedPath of [...this.protectedPaths, this.resources, this.settingsFile]) {
      if (inside(resolved, canonical(protectedPath))) throw new Error('A pasta antiga contém arquivos do aplicativo e não pode ser excluída.');
    }
    if (!fs.existsSync(path.join(source, marker)) || !fs.existsSync(path.join(source,'OPLServer.exe'))) throw new Error('Não foi possível confirmar a pasta antiga do OPL Server.');
  }

  async change(target:string, mode:StorageMode, activate:()=>Promise<void>, progress:(value:StorageProgress)=>void) {
    if (mode !== 'move' && mode !== 'fresh') throw new Error('Opção de transferência inválida.');
    const destination = this.validateTarget(target);
    if (fs.existsSync(this.root) && fs.lstatSync(this.root).isSymbolicLink()) throw new Error('A pasta atual é um link. Ela não pode ser migrada ou excluída pelo aplicativo.');
    const source = canonical(this.root);
    const exists = fs.existsSync(source);
    if (exists) this.validateRemoval(source);
    const entries = exists ? await inventory(source) : [];
    const total = mode === 'move' ? entries.reduce((sum, entry) => sum + entry.size, 0) : 0;
    const space = await fs.promises.statfs(path.dirname(destination));
    const required = total + 32 * 1024 * 1024;
    if (space.bavail * space.bsize < required) throw new Error('Espaço insuficiente no destino. A pasta antiga foi mantida.');
    const staging = destination + '.transfer-' + randomUUID();
    await fs.promises.mkdir(staging);
    let switched = false, received = 0;
    try {
      if (mode === 'move') {
        for (const entry of entries) {
          const from = path.join(source, entry.name), to = path.join(staging, entry.name);
          if (entry.directory) {await fs.promises.mkdir(to, {recursive:true}); continue;}
          const hash = createHash('sha256');
          await pipeline(fs.createReadStream(from), new Transform({transform(chunk, _encoding, callback) {
            hash.update(chunk); received += chunk.length;
            progress({phase:'copying',received,total,file:entry.name}); callback(null, chunk);
          }}), fs.createWriteStream(to, {flags:'wx'}));
          progress({phase:'verifying',received,total,file:entry.name});
          if (hash.digest('hex') !== await digest(to)) throw new Error(`Falha ao verificar ${entry.name}. A pasta antiga foi mantida.`);
        }
      }
      this.ensure(staging);
      // Never merge with a destination that appeared while files were copied.
      this.validateTarget(destination);
      await fs.promises.rename(staging, destination);
      this.ensure(destination); // Rewrite SharePath after leaving the staging path.
      this.save(destination);
      switched = true;
      progress({phase:'starting',received:total,total});
      await activate();
    } catch (error) {
      if (switched) this.save(source);
      // Preserve partial data for recovery; never delete the original on failure.
      throw new Error(`${error instanceof Error ? error.message : String(error)} A pasta original foi preservada. Verifique o destino antes de tentar novamente.`);
    }
    let warning:string | undefined;
    if (exists) {
      progress({phase:'removing',received:total,total});
      try {
        this.validateRemoval(source);
        const current = await inventory(source);
        if (JSON.stringify(current) !== JSON.stringify(entries)) throw new Error('O conteúdo da pasta antiga mudou durante a transferência. Ela foi mantida para evitar perda de arquivos.');
        await fs.promises.rm(source, {recursive:true});
      } catch (error) {warning = `O novo local está ativo, mas não foi possível remover toda a pasta antiga: ${error instanceof Error ? error.message : String(error)}`;}
    }
    return {directory:this.root, warning};
  }
}
