const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {EventEmitter}=require('node:events');
const {createRequire}=require('node:module');
const file=path.resolve('dist-electron/xerabora.js'),realRequire=createRequire(file);
const children=[],requests=[],events=[];
const mocks={
 'node:fs':{readFileSync:()=>Buffer.from('fixture')},
 'node:crypto':{createHash:()=>({update(){return this},digest:()=> '2ea6d93322966e619de4cfc11dcebc177b321eadd519bfb05d397a7b81d4730c'})},
 'node:net':{createServer:()=>{const s=new EventEmitter();s.listen=(_p,_h,cb)=>queueMicrotask(cb);s.close=cb=>cb();return s}},
 'node:dgram':{createSocket:()=>{const s=new EventEmitter();s.bind=(_p,cb)=>queueMicrotask(cb);s.close=()=>{};return s}},
 'node:child_process':{spawn:()=>{const c=new EventEmitter();c.kill=()=>{c.killed=true;c.emit('exit',0)};children.push(c);queueMicrotask(()=>c.emit('spawn'));return c}},
 'node:http':{get:(_url,callback)=>{const req=new EventEmitter(),res=new EventEmitter();req.setTimeout=()=>{};req.destroy=()=>{};res.statusCode=200;res.setEncoding=()=>{};res.resume=()=>{};requests.push({req,res});queueMicrotask(()=>callback(res));return req}}
};
const context={exports:{},require:name=>mocks[name]||realRequire(name),Buffer,process,setTimeout,clearTimeout,console};
vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
(async()=>{
 const x=new context.exports.Xerabora(()=>'.',(channel,data)=>events.push({channel,data}));
 await x.start();await Promise.resolve();assert(x.status().running);assert.equal(children.length,1);
 await x.start();assert.equal(children.length,1,'duplicate start must not launch another process');
 const frame=unlocks=>'data: '+JSON.stringify({login:{ok:true,user:'Test'},console:{connected:true},game:{title:'Demo'},unlocks})+'\n\n';
 requests[0].res.emit('data',frame([]));
 requests[0].res.emit('data',frame([{id:1,title:'First',ago:0,points:5}]));
 assert.equal(events.filter(e=>e.channel==='xera:unlock').length,1);
 requests[0].res.emit('data','data: '+JSON.stringify({login:{ok:true,user:'Test'},console:{connected:false},game:{title:'Last played'},unlocks:[]})+'\n\n');
 assert.equal(x.status().game,'','disconnected console must not retain last game');
 x.stop();assert(children[0].killed);assert(!x.status().running);
 await x.start();await Promise.resolve();assert.equal(children.length,2);
 requests[0].res.emit('data',frame([{id:2,title:'Stale connection',ago:0}]));
 assert.equal(events.filter(e=>e.channel==='xera:unlock').length,1,'old connection must not send events');
 x.stop();
 const pending=x.start();x.stop();await pending;
 assert.equal(children.length,2,'stop during startup must cancel the launch');
 console.log('PASS: start, stop, duplicate start, unlock events, stale stream and cancelled startup.');
})().catch(e=>{console.error(e);process.exitCode=1});
