const net=require('node:net');
const assert=require('node:assert/strict');
const {assertPortAvailable,localAddresses}=require('../dist-electron/network.js');
const {validatePort}=require('../dist-electron/storage.js');
(async()=>{
  for(const valid of [1,1024,65535]) validatePort(valid);
  for(const invalid of [0,-1,65536,10.1,NaN,Infinity,'1234',undefined]) assert.throws(()=>validatePort(invalid));
  const server=net.createServer();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'0.0.0.0',resolve)});
  const port=server.address().port;
  try {await assert.rejects(()=>assertPortAvailable(port),/ocupada/)} finally {await new Promise(resolve=>server.close(resolve))}
  await assertPortAvailable(port);
  assert(localAddresses().every(ip=>net.isIPv4(ip)&&!ip.startsWith('127.')));
  console.log('PASS: valid port range, occupied TCP port, free TCP port, LAN IPv4 addresses.');
})().catch(error=>{console.error(error);process.exitCode=1});
