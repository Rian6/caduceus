const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EventEmitter}=require('node:events');
const {DiscordPresence,RPCDecoder,rpcFrame}=require('../dist-electron/discord-presence');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'caduceus-discord-'));
let time=100000;const sockets=[];
class Socket extends EventEmitter{
 frames=[];
 write(buffer){this.frames.push(...new RPCDecoder().push(buffer));return true}
 end(buffer){if(buffer)this.write(buffer);this.emit('close')}
 destroy(){this.emit('close')}
}
const presence=new DiscordPresence(()=>path.join(dir,'settings.json'),()=>{},pipe=>{assert(pipe.startsWith('\\\\?\\pipe\\discord-ipc-'));const socket=new Socket();sockets.push(socket);return socket},()=>time);
try{
 const decoder=new RPCDecoder(),frame=rpcFrame(1,{evt:'READY'});
 assert.deepEqual(decoder.push(frame.subarray(0,5)),[]);assert.equal(decoder.push(frame.subarray(5))[0].data.evt,'READY');
 assert.equal(new RPCDecoder().push(Buffer.concat([frame,frame])).length,2);
 const bad=Buffer.alloc(8);bad.writeUInt32LE(2000000,4);assert.throws(()=>new RPCDecoder().push(bad));
 assert.throws(()=>presence.configure({enabled:true,clientId:'bad'}));
 presence.configure({enabled:true,clientId:'123456789012345678'});
 const socket=sockets[0];socket.emit('connect');assert.equal(socket.frames[0].op,0);
 socket.emit('data',frame);
 function ack(){const last=socket.frames.at(-1).data;socket.emit('data',rpcFrame(1,{cmd:'SET_ACTIVITY',nonce:last.nonce}))}
 assert.equal(socket.frames.at(-1).data.args.activity,null);ack();
 presence.updateConsole({connected:true,game:'GTA San Andreas',icon:'https://example.com/gta.jpg'});
 assert.equal(socket.frames.at(-1).data.args.activity.name,'GTA San Andreas','first game must publish immediately after idle clear');
 assert.equal(socket.frames.at(-1).data.args.activity.state,'Caduceus · PlayStation 2');ack();
 assert.equal(presence.activity().assets.large_image,'https://example.com/gta.jpg');
 assert.equal(presence.activity().status_display_type,0);
 assert.equal(presence.activity().name,'GTA San Andreas');
 time+=15000;presence.unlock({game:'GTA San Andreas',title:'First steps',points:5});
 assert(socket.frames.at(-1).data.args.activity.details.includes('First steps'));ack();
 assert.notEqual(presence.activity().details,presence.activity().name);
 time+=31000;presence.updateConsole({connected:true,game:'GTA San Andreas'});
 assert.equal(socket.frames.at(-1).data.args.activity.state,'Caduceus · PlayStation 2');ack();
 assert(presence.activity().details.includes('First steps'),'latest trophy persists beyond thirty seconds');
 presence.updateConsole({connected:false,game:'GTA San Andreas'});
 assert.equal(socket.frames.at(-1).data.args.activity,null);ack();
 presence.unlock({game:'GTA San Andreas',title:'Old trophy',points:5});assert.equal(presence.activity(),null);
 time+=15000;presence.updateSMB('Another game');assert.equal(presence.activity().name,'Another game');ack();
 assert.equal(presence.status().achievement,'','new game clears previous trophy');
 assert.equal(presence.activity().assets,undefined,'previous game cover must not leak');
 presence.updateSMB('Another game','file:///private/cover.jpg');assert.equal(presence.activity().assets,undefined);
 presence.updateSMB('Another game','https://example.com/another.jpg');assert.equal(presence.activity().assets.large_image,'https://example.com/another.jpg');
 socket.emit('close');assert.equal(presence.status().connected,false);
 time+=16000;presence.updateSMB('Another game');
 const reconnected=sockets.at(-1);assert.notEqual(reconnected,socket);
 reconnected.emit('connect');reconnected.emit('data',frame);
 assert.equal(reconnected.frames.at(-1).data.args.activity.name,'Another game','reconnect must restore current game');
 presence.configure({enabled:false,clientId:'123456789012345678'});
 assert.equal(reconnected.frames.at(-1).data.args.activity,null);assert.equal(presence.status().connected,false);
 presence.requireAccount=true;
 const before=sockets.length;
 presence.configure({enabled:true,clientId:'123456789012345678'});
 assert.equal(sockets.length,before,'no local publication before OAuth authorization');
 presence.setAccount('111111111111111111');
 const wrong=sockets.at(-1);wrong.emit('connect');wrong.emit('data',rpcFrame(1,{evt:'READY',data:{user:{id:'222222222222222222'}}}));
 assert.equal(presence.status().connected,false);
 assert(!wrong.frames.some(f=>f.data.cmd==='SET_ACTIVITY'),'wrong desktop account must never receive activity');
 presence.setAccount('111111111111111111');const correct=sockets.at(-1);correct.emit('connect');correct.emit('data',rpcFrame(1,{evt:'READY',data:{user:{id:'111111111111111111'}}}));
 assert(presence.status().connected);
 console.log('PASS: RPC framing, handshake, native console status, persistent latest trophy, disconnect, historical unlock rejection and disable.');
}finally{presence.stop();fs.rmSync(dir,{recursive:true,force:true})}
