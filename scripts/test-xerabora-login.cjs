const assert=require('node:assert/strict');
const net=require('node:net');
const {Xerabora}=require('../dist-electron/xerabora');

(async()=>{
  let reply={ok:true};
  let received;
  const server=net.createServer(socket=>{
    let input=Buffer.alloc(0);
    socket.on('data',chunk=>{
      input=Buffer.concat([input,chunk]);
      const end=input.indexOf('\r\n\r\n');
      if(end<0)return;
      const headers=input.subarray(0,end).toString();
      // Match the native adapter's case-sensitive Content-Length parser.
      const length=Number(/Content-Length: (\d+)/.exec(headers)?.[1]);
      assert(Number.isFinite(length),'native parser must find Content-Length');
      if(input.length<end+4+length)return;
      received=new URLSearchParams(input.subarray(end+4,end+4+length).toString());
      const body=JSON.stringify(reply);
      socket.end(`HTTP/1.1 200 OK\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`);
    });
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(18195,'127.0.0.1',resolve)});
  const x=new Xerabora(()=>'.',()=>{});
  x.start=async()=>{};x.ready=async()=>{};
  try{
    const password='test + & = % senha \u00e7';
    await x.login(' TestUser ',password);
    assert.equal(received.get('user'),'TestUser');
    assert.equal(received.get('password'),password);
    reply={ok:false,error:'wrong name or password'};
    await assert.rejects(x.login('TestUser',password),/recusou o login/);
    reply={ok:false,error:'access denied'};
    await assert.rejects(x.login('TestUser',password),/não confirma senha incorreta/);
    reply={ok:false,error:'expired token'};
    await assert.rejects(x.login('TestUser',password),/expirou/);
    reply={ok:false,error:'the RetroAchievements server could not be reached'};
    await assert.rejects(x.login('TestUser',password),/acessar o RetroAchievements/);
    reply={ok:false,error:password};
    await assert.rejects(x.login('TestUser',password),error=>!error.message.includes(password));
    console.log('PASS: native-compatible login framing, special characters, errors and no secret reflection.');
  }finally{await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1});
