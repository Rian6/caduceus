const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {createRequire} = require('node:module');
const filename = path.resolve(__dirname,'../dist-electron/main.js');
const localRequire = createRequire(filename);
const handlers = new Map();
const calls = [];
let confirmation = 0;
let portUnavailable = false;
const source = path.resolve(__dirname,'../oplserver');
const destination = path.resolve(__dirname,'../test-destination/oplserver');
const storage = {
  root:source,
  port:1024,
  setPort(port){this.port=port;calls.push('port:'+port)},
  describe:async()=>({directory:source,exists:true}),
  validateTarget:target=>target,
  change:async(target,mode,activate)=>{calls.push('change:'+mode);await activate();return {directory:target}}
};
const electron = {
  app:{isPackaged:false,whenReady:()=>({then:()=>({catch(){}})}),on(){},getPath:()=>source},
  ipcMain:{handle:(channel,listener)=>{assert(!handlers.has(channel));handlers.set(channel,listener)}},
  BrowserWindow:{getAllWindows:()=>[]},
  dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[path.dirname(destination)]}),showMessageBox:async options=>{calls.push('confirm');assert(options.detail.includes(source));assert(options.detail.includes(destination));assert.equal(options.defaultId,0);return {response:confirmation}}}
};
const context = {require:name=>name==='electron'?electron:name==='./network'?{localAddresses:()=>['192.168.1.10'],assertPortAvailable:async()=>{calls.push('available');if(portUnavailable)throw new Error('occupied')}}:name==='./opl-activity'?{OplActivityMonitor:class{read(){return []}stop(){}}}:localRequire(name),
  exports:{},module:{exports:{}},__dirname:path.dirname(filename),process,console,Buffer,setTimeout,clearTimeout,setInterval,clearInterval,fakeStorage:storage,calls};
vm.runInNewContext(fs.readFileSync(filename,'utf8')+`
storage=()=>fakeStorage;
stopManagedOpl=async()=>{calls.push('stop')};
startOpl=async()=>{calls.push('start');if(globalThis.failStart){globalThis.failStart=false;throw new Error('start failed')}};
oplStatus=async()=>({online:true,ip:'192.168.1.10',port:fakeStorage.port,shareName:'PS2'});
portOnline=async()=>true;
publishOpl=async()=>{};
database=()=>({exec:()=>calls.push('database')});
module.exports={setBusy:(value)=>{trackedRequests=value},setPlaying:(value)=>{nowPlayingState=value}};
`,context,{filename});

(async()=>{
  const change = input=>handlers.get('storage:change')({},input);
  await assert.rejects(()=>change({directory:destination,mode:'move'}),/Selecione/);
  await handlers.get('storage:select')();
  context.module.exports.setBusy(1);
  await assert.rejects(()=>change({directory:destination,mode:'move'}),/Aguarde/);
  context.module.exports.setBusy(0);
  context.module.exports.setPlaying({title:'Game'});
  await assert.rejects(()=>change({directory:destination,mode:'move'}),/Encerre/);
  context.module.exports.setPlaying(null);
  const cancelled = await change({directory:destination,mode:'fresh'});
  assert(cancelled.cancelled);
  assert.deepEqual(calls,['confirm'],'cancel must not stop server or change files');
  calls.length=0;
  confirmation=1;
  await change({directory:destination,mode:'fresh'});
  assert.deepEqual(calls,['confirm','stop','change:fresh','start','database']);
  calls.length=0;
  await handlers.get('storage:select')();
  await change({directory:destination,mode:'move'});
  assert.deepEqual(calls,['stop','change:move','start']);
  const setPort = port=>handlers.get('network:set-port')({},port);
  calls.length=0;
  for(const invalid of [0,65536,-1,1.5,'1024',null]) await assert.rejects(()=>setPort(invalid),/porta inteira/);
  assert.deepEqual(calls,[]);
  portUnavailable=true;
  await assert.rejects(()=>setPort(18024),/occupied/);
  assert.equal(storage.port,1024);
  assert.deepEqual(calls,['available']);
  portUnavailable=false;calls.length=0;
  const result=await setPort(18024);
  assert.equal(result.port,18024);
  assert.deepEqual(calls,['available','stop','port:18024','start']);
  calls.length=0;context.failStart=true;
  await assert.rejects(()=>setPort(19024),/start failed/);
  assert.equal(storage.port,18024,'failed restart restores previous port');
  assert.deepEqual(calls,['available','stop','port:19024','start','stop','port:18024','start']);
  console.log('PASS: selected destination required, busy/game guards, destructive cancellation, explicit confirmation, managed server restart.');
  console.log('PASS: port validation, occupied port, port application and rollback after restart failure.');
})().catch(error=>{console.error(error);process.exitCode=1});
