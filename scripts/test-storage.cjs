const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {OplStorage} = require('../dist-electron/storage.js');
const workspace = path.resolve(__dirname,'..');
const root = fs.mkdtempSync(path.join(workspace,'.storage-test-'));

function fixture(name) {
  const directory = path.join(root,name);
  const resources = path.join(directory,'app','oplserver');
  const source = path.join(directory,'old','oplserver');
  const settings = path.join(directory,'config','settings.json');
  const destination = path.join(directory,'new','oplserver');
  fs.mkdirSync(resources,{recursive:true});
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  for(const file of ['OPLServer.exe','SMBLibrary.dll','SMBLibrary.Win32.dll','Utilities.dll']) fs.writeFileSync(path.join(resources,file),'fixture-'+file);
  fs.writeFileSync(path.join(resources,'OPLServer.config'),'<configuration><appSettings><add key="ServerPort" value="1024" /></appSettings></configuration>');
  const storage = new OplStorage(source,resources,settings,[path.join(directory,'app'),path.join(directory,'config')]);
  storage.ensure();
  fs.writeFileSync(path.join(source,'PS2','DVD','game.iso'),Buffer.alloc(256*1024,42));
  fs.writeFileSync(path.join(source,'PS2','VMC','save.bin'),'saved-game');
  fs.writeFileSync(path.join(source,'PS2','ART','cover.jpg'),'cover');
  return {storage,source,destination,resources,settings,directory};
}

(async()=>{
  const move = fixture('move');
  // Exercise compatibility against the actual bundled executable.
  const bundledExe = fs.readFileSync(path.join(workspace,'oplserver','OPLServer.exe'));
  fs.writeFileSync(path.join(move.source,'OPLServer.exe'),bundledExe);
  move.storage.setPort(18024);
  const patchedExe = fs.readFileSync(path.join(move.source,'OPLServer.exe'));
  assert.equal(patchedExe.indexOf(Buffer.from('061631280620010400002f20','hex')),-1);
  assert(patchedExe.includes(Buffer.from('061631280620000001002f20','hex')));
  move.storage.ensure();
  assert.deepEqual(fs.readFileSync(path.join(move.source,'OPLServer.exe')),patchedExe,'compatibility patch is idempotent');
  assert.deepEqual(fs.readFileSync(path.join(workspace,'oplserver','OPLServer.exe')),bundledExe,'distributed executable stays intact');
  assert.match(fs.readFileSync(path.join(move.source,'OPLServer.exe.config'),'utf8'),/key="ServerPort" value="18024"/);
  assert.match(fs.readFileSync(path.join(move.source,'OPLServer.config'),'utf8'),/key="ServerPort" value="18024"/);
  const events=[];
  await move.storage.change(move.destination,'move',async()=>{
    assert(fs.existsSync(move.source),'source must survive until activation');
    assert.equal(move.storage.root,move.destination);
    assert.equal(fs.readFileSync(path.join(move.destination,'PS2','VMC','save.bin'),'utf8'),'saved-game');
    assert(fs.readFileSync(path.join(move.destination,'OPLServer.config'),'utf8').includes(move.destination));
  }, event=>events.push(event));
  assert(!fs.existsSync(move.source));
  assert.deepEqual(fs.readFileSync(path.join(move.destination,'PS2','DVD','game.iso')),Buffer.alloc(256*1024,42));
  assert(events.some(event=>event.phase==='verifying'));
  assert.equal(new OplStorage(move.source,move.resources,move.settings,[]).root,move.destination,'settings persist across restart');
  assert.equal(new OplStorage(move.source,move.resources,move.settings,[]).port,18024,'port survives migration and restart');

  const fresh = fixture('fresh');
  await fresh.storage.change(fresh.destination,'fresh',async()=>{},()=>{});
  assert(!fs.existsSync(fresh.source));
  assert.deepEqual(fs.readdirSync(path.join(fresh.destination,'PS2','DVD')),[]);
  assert.deepEqual(fs.readdirSync(path.join(fresh.destination,'PS2','VMC')),[]);
  assert(fs.existsSync(path.join(fresh.destination,'OPLServer.exe')));

  const failure = fixture('failed-start');
  await assert.rejects(()=>failure.storage.change(failure.destination,'move',async()=>{throw new Error('startup failed')},()=>{}),/startup failed/);
  assert(fs.existsSync(path.join(failure.source,'PS2','DVD','game.iso')));
  assert.equal(failure.storage.root,failure.source);
  assert.equal(JSON.parse(fs.readFileSync(failure.settings,'utf8')).oplDirectory,failure.source);

  const protectedFiles = fixture('validation');
  assert.throws(()=>protectedFiles.storage.validateTarget(protectedFiles.source),/atual/);
  assert.throws(()=>protectedFiles.storage.validateTarget(path.join(protectedFiles.source,'PS2','oplserver')),/subpasta/);
  fs.mkdirSync(protectedFiles.destination);
  fs.writeFileSync(path.join(protectedFiles.destination,'existing.iso'),'untouched');
  assert.throws(()=>protectedFiles.storage.validateTarget(protectedFiles.destination),/existe/);
  assert.equal(fs.readFileSync(path.join(protectedFiles.destination,'existing.iso'),'utf8'),'untouched');
  const external = path.join(protectedFiles.directory,'external');
  fs.mkdirSync(external);
  fs.writeFileSync(path.join(external,'important.txt'),'untouched');
  fs.symlinkSync(external,path.join(protectedFiles.source,'linked'),'junction');
  const other = path.join(protectedFiles.directory,'other','oplserver');
  fs.mkdirSync(path.dirname(other));
  await assert.rejects(()=>protectedFiles.storage.change(other,'fresh',async()=>{},()=>{}),/links/);
  assert.equal(fs.readFileSync(path.join(external,'important.txt'),'utf8'),'untouched');

  const concurrent = fixture('concurrent');
  const result = await concurrent.storage.change(concurrent.destination,'move',async()=>{
    fs.writeFileSync(path.join(concurrent.source,'new-file.txt'),'arrived during copy');
  },()=>{});
  assert(result.warning);
  assert(fs.existsSync(path.join(concurrent.source,'new-file.txt')));
  console.log('PASS: complete migration, fresh installation, persistent settings, startup rollback, existing/nested destinations, junction protection, concurrent changes.');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>{
  const resolved = fs.realpathSync(root);
  if(path.dirname(resolved)!==fs.realpathSync(workspace)||!path.basename(resolved).startsWith('.storage-test-')) throw new Error('Unexpected cleanup target');
  fs.rmSync(resolved,{recursive:true,force:true});
});
