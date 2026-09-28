import net from 'node:net';
import {networkInterfaces} from 'node:os';

export function localAddresses() {
  return [...new Set(Object.values(networkInterfaces()).flatMap(entries =>
    (entries || []).filter(entry => entry.family === 'IPv4' && !entry.internal).map(entry => entry.address)))];
}

export async function assertPortAvailable(port:number) {
  await new Promise<void>((resolve,reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`A porta ${port} está ocupada ou indisponível. Escolha outra porta.`)));
    server.listen({host:'0.0.0.0',port,exclusive:true}, () => server.close(error => error ? reject(error) : resolve()));
  });
}
