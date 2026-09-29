const {app, BrowserWindow} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
app.disableHardwareAcceleration();
app.setPath('userData', path.join(root, '.ui-check'));
const output = path.join(root, 'artifacts');
fs.mkdirSync(output, {recursive:true});

function fixtureAPI(games) {
  const events = {};
  const subscribe = name => callback => { (events[name] ||= new Set()).add(callback); return () => events[name].delete(callback); };
  window.__emit = (name, data) => { for (const callback of events[name] || []) callback(data); };
  window.__calls = [];
  window.__games = games;
  window.__errors = [];
  window.addEventListener('error', event => window.__errors.push(event.message));
  window.addEventListener('unhandledrejection', event => window.__errors.push(String(event.reason)));
  const states = [];
  let networkPort = 1024;
  const networkStatus = () => ({online:true, ip:'192.168.1.10', port:networkPort, folder:'C:\\Caduceus\\PS2', shareName:'PS2', addresses:['192.168.1.10','192.168.2.10']});
  let storage = {directory:'C:\\Caduceus\\oplserver', isoDirectory:'C:\\Caduceus\\oplserver\\PS2\\DVD',exists:true,bytes:4200000000,isoCount:2,busy:false};
  window.games = {
    discordStatus:async()=>({enabled:false,user:null,configured:true,connected:false,message:'Conecte sua conta Discord',game:'',achievement:''}),
    discordConnect:async()=>{window.__calls.push('discord:connect');return {enabled:true,user:{id:'123456789012345678',name:'Tester'},configured:true,connected:true,message:'Conectado',game:'',achievement:''}},
    discordDisconnect:async()=>({enabled:false,user:null,configured:true,connected:false,message:'Desativado',game:'',achievement:''}),
    discordConfigure:async enabled=>{window.__calls.push('discord:'+enabled);return {enabled,user:{id:'123456789012345678',name:'Tester'},configured:true,connected:true,message:enabled?'Conectando':'Desativado',game:'',achievement:''}},
    onDiscordStatus:subscribe('discord'),
    xeraStatus:async()=>({running:false,connected:false,user:'',game:'',error:''}),
    onXeraStatus:subscribe('xeraStatus'),onXeraUnlock:subscribe('xeraUnlock'),
    xeraStart:async()=>{window.__emit('xeraStatus',{running:true,connected:true,user:'Tester',game:'Demo',error:''})},
    xeraStop:async()=>{window.__emit('xeraStatus',{running:false,connected:false,user:'',game:'',error:''})},
    xeraOpen:async()=>{},xeraElf:async()=>true,
    raStatus:async()=>({user:null}),
    raCompatibilitySync:async()=>true,
    raConnect:async(user,key,password)=>{if(!password)throw new Error('Missing password');window.__emit('xeraStatus',{running:true,connected:true,user:'Tester',game:'Demo',error:''});return {user:'Tester'}},
    raDisconnect:async()=>({user:null}),
    raGames:async()=>({total:1,games:[{id:1,title:'Achievement Test',console:'PlayStation 2',image:null,total:2,earned:1,hardcore:1}]}),
    raGame:async()=>({title:'Achievement Test',achievements:[{id:1,title:'First trophy',description:'Complete the first stage.',points:5,image:null,earned:true,hardcore:true,date:'2026-01-01'},{id:2,title:'Second trophy',description:'Complete the second stage.',points:10,image:null,earned:false,hardcore:false,date:''}]}),
    networkSettings:async()=>networkStatus(),
    setOplPort:async port=>{networkPort=port;window.__calls.push('port:'+port);window.__emit('opl',networkStatus());return networkStatus()},
    storageSettings:async()=>storage,
    selectStorageDirectory:async()=>'D:\\Jogos PS2\\oplserver',
    changeStorageDirectory:async input=>{
      window.__calls.push('storage:'+input.mode);
      window.__emit('storage',{phase:'copying',received:50,total:100});
      storage={...storage,directory:input.directory,isoDirectory:input.directory+'\\PS2\\DVD'};
      return {cancelled:false,directory:input.directory};
    },
    onStorageProgress:subscribe('storage'),
    list: async ({search, page, limit,raCompatible}) => {
      const filtered = games.filter(game => game.title.toLowerCase().includes(search.toLowerCase())&&(!raCompatible||game.ra?.status==='compatible'));
      return {games:filtered.slice(page*limit, (page+1)*limit), total:filtered.length, page, pages:Math.ceil(filtered.length/limit)};
    },
    installed: async () => games.filter(game => game.downloaded),
    stats: async () => ({total:games.length, downloaded:games.filter(game => game.downloaded).length}),
    downloads: async () => states,
    oplStatus: async () => networkStatus(),
    nowPlaying: async () => null,
    create: async data => { const game = {...data, _id:String(games.length+1), console:'PS2'}; games.push(game); window.__calls.push('create'); return game; },
    update: async data => {window.__calls.push('update'); Object.assign(games.find(game => game._id === data._id), data); return data;},
    delete: async game => {window.__calls.push('delete'); const index=games.findIndex(item => item._id === game._id);if(index>=0)games.splice(index,1);},
    download: async game => {
      window.__calls.push('download');
      const state = {gameKey:game._id, fileName:game.title+'.iso', icon:game.icon, state:'progressing', percent:42, received:420000000, total:1000000000};
      states.push(state); window.__emit('progress', state); return state;
    },
    repairCovers: async () => ({repaired:2, missingId:0, missingCover:0}),
    selectIso: async () => ({path:'C:\\test.iso', fileName:'test.iso', size:1024, suggestedTitle:'Imported game'}),
    importIso: async () => ({success:true}),
    onDownloadProgress:subscribe('progress'), onDownloadCompleted:subscribe('completed'), onDownloadError:subscribe('error'),
    onOplStatus:subscribe('opl'), onNowPlaying:subscribe('playing'), onIsoProgress:subscribe('iso'), onIsoCompleted:subscribe('isoDone')
  };
}

let window, server;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  const covers = fs.readdirSync(path.join(root, 'oplserver/PS2/ART')).filter(name => /_COV.jpg$/i.test(name));
  const {DatabaseSync} = require('node:sqlite');
  const database = new DatabaseSync(path.join(root, 'database/catalog.sqlite3'), {readOnly:true});
  const fixtures = covers.map((cover, index) => {
    const gameId = cover.replace('_COV.jpg', '');
    const row = database.prepare('SELECT title FROM games WHERE game_id=? LIMIT 1').get(gameId);
    const titles = {'SCES_504.92':'Final Fantasy X-2', 'SLES_505.05':'Grand Theft Auto: San Andreas', 'SLES_525.85':'Burnout 3: Takedown', 'SLES_529.27':'Grand Theft Auto: San Andreas', 'SLES_820.52':'Metal Gear Solid 3: Snake Eater'};
    return {_id:String(index+1), title:row?.title || titles[gameId] || gameId, console:'PS2', gameId,
      icon:'data:image/jpeg;base64,'+fs.readFileSync(path.join(root,'oplserver/PS2/ART',cover)).toString('base64'),
      downloaded:index<2, coverInstalled:index<2, downloadUrl:'https://example.invalid/game.iso'};
  });
  database.close();
  fixtures[0].ra={status:'compatible',count:12,id:2772,title:'RA fixture',hash:'fe8b1b6c64c24e7eaaef6de8af1aeb9e',checkedAt:Date.now()};
  assert(fixtures.length >= 3, 'Need local cover fixtures');
  fixtures.push({_id:'6', title:'Um clássico sem capa', console:'PS2', icon:'data:image/png;base64,broken', downloads:[]});
  const index = fs.readFileSync(path.join(root,'dist/index.html'),'utf8').replace('<head>', `<head><script>(${fixtureAPI.toString()})(${JSON.stringify(fixtures)})</script>`);
  server = http.createServer((request, response) => {
    if (request.url === '/') {response.setHeader('Content-Type','text/html; charset=utf-8'); response.end(index); return;}
    const file = path.resolve(root,'dist','.'+decodeURIComponent(request.url));
    if (!file.startsWith(path.join(root,'dist')+path.sep) || !fs.existsSync(file)) {response.writeHead(404); response.end(); return;}
    response.setHeader('Content-Type',file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream');
    response.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  window = new BrowserWindow({width:1500,height:1080,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,offscreen:true}});
  const js = source => window.webContents.executeJavaScript(source, true);
  const click = selector => js(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const screenshot = async name => {await js('window.scrollTo(0,0)'); window.webContents.invalidate(); await delay(450); fs.writeFileSync(path.join(output,name+'.png'),(await window.webContents.capturePage()).toPNG());};
  const setInput = async (selector, value) => {await js(`{const el=document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));}`); await delay(400);};
  await window.loadURL(`http://127.0.0.1:${server.address().port}/`);
  await delay(900);
  await js('localStorage.removeItem("ps2-library-tutorial-v1")');
  await window.loadURL(`http://127.0.0.1:${server.address().port}/`); await delay(900);
  assert(await js('!!document.querySelector(".tutorialModal")'));
  await screenshot('interface-tutorial');
  for(let step=0;step<5;step++){await click('.tutorialFooter .primary');await delay(50)}
  assert(await js('document.querySelector(".tutorialCard h2").textContent.includes("lista de jogos")'));
  await click('.tutorialFooter .primary');await delay(50);
  assert.equal(await js('localStorage.getItem("ps2-library-tutorial-v1")'),'done');
  await window.loadURL(`http://127.0.0.1:${server.address().port}/`);await delay(900);
  assert.equal(await js('!!document.querySelector(".tutorialModal")'),false);
  await js('window.dispatchEvent(new Event("open-tutorial"))');await delay(50);
  assert(await js('!!document.querySelector(".tutorialModal")'));
  await click('.tutorialFooter .textButton');await delay(50);
  assert.equal(await js('document.querySelectorAll(".gameCard").length'), fixtures.length);
  assert(await js('document.body.textContent.includes("Consulte e gerencie seus jogos de PlayStation 2.")'), 'Portuguese accents must survive the build');
  assert(await js('!!document.querySelector(".coverFallback")'), 'broken cover gets a fallback');
  await screenshot('interface-library');
  await click('.collectionFilters button');await delay(200);
  assert.equal(await js('document.querySelectorAll(".gameCard").length'),1);
  assert(await js('document.querySelector(".gameCard .raCompatibilityBadge").textContent.includes("12")'));
  await click('.gameCoverButton');await delay(80);
  assert(await js('!!document.querySelector(".raCompatibilityDetail.verified")'));
  await js('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))');await delay(80);
  await screenshot('interface-ra-compatible');
  await click('.collectionFilters button');await delay(200);
  await js(`window.__emit('playing', {...window.__games[0], id:1, fileName:'game.iso', active:true})`);
  await delay(100);
  assert(await js('!!document.querySelector(".feature.isPlaying .featuredCase img")'));
  assert(await js('!!document.querySelector(".playingCard")'));
  await screenshot('interface-playing');
  await click('.featureLink'); await delay(100);
  assert(await js('!!document.querySelector(".gameDetails")'));
  await js(`document.querySelector('[role="dialog"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  await delay(100);
  assert.equal(await js('document.querySelectorAll("[role=dialog]").length'),0);
  await click('.cardActions .iconButton'); await delay(100);
  assert(await js('!!document.querySelector(".editModal")'));
  await screenshot('interface-edit');
  await click('.editActions .primary'); await delay(200);
  assert(await js('window.__calls.includes("update")'));
  await js(`window.__emit('playing', null)`); await delay(100);
  assert.equal(await js('document.querySelectorAll(".isPlaying,.miniPlaying").length'),0);
  await js(`document.querySelector('.cardDownload:not(:disabled)').click()`); await delay(100);
  await click('.sidebar nav button:nth-child(3)'); await delay(100);
  assert.equal(await js('document.querySelectorAll(".downloadItem").length'),1);
  await screenshot('interface-downloads');
  await click('.addGameNav'); await delay(100);
  await setInput('.formFields input','Novo jogo de teste');
  await screenshot('interface-create');
  await js(`document.querySelector('.formPanel').requestSubmit()`); await delay(200);
  assert(await js('window.__calls.includes("create")'));
  await click('.addGameNav:last-of-type'); await delay(150);
  assert(await js('!!document.querySelector(".settingsPanel")'));
  await click('.discordAccountCard button');await delay(100);
  assert(await js('window.__calls.includes("discord:connect")'));
  assert(await js('document.querySelector(".discordAccountInfo").textContent.includes("Tester")'));
  await click('.discordToggle input');await delay(100);
  assert(await js('window.__calls.includes("discord:false")'));
  assert(await js('!!document.querySelector(".discordLogo")'));
  assert.equal(await js('document.querySelectorAll(".librarySettingRow").length'),2);
  await js('document.querySelectorAll(".librarySettingRow button")[0].click()');await delay(150);
  assert(await js('document.querySelector(".librarySettings").textContent.includes("capas reparadas")'));
  await js('document.querySelectorAll(".librarySettingRow button")[1].click()');await delay(150);
  assert(await js('document.querySelector(".librarySettings").textContent.includes("Compatibilidade atualizada")'));
  assert(await js('document.querySelector(".oplConnectionDetails").textContent.includes("192.168.1.10")'));
  await setInput('.portForm input','65536');
  assert(await js('document.querySelector(".portForm button").disabled'));
  await setInput('.portForm input','18024');
  await click('.portForm button'); await delay(150);
  assert(await js('window.__calls.includes("port:18024")'));
  assert(await js('document.querySelector(".oplConnectionDetails").textContent.includes("18024")'));
  assert(await js('document.querySelector(".sidebarAddress").textContent.includes("18024")'));
  await screenshot('interface-network');
  await click('.themeChoices button:first-child'); await delay(100);
  assert.equal(await js('document.documentElement.dataset.theme'),'light');
  assert.equal(await js('localStorage.getItem("ps2-library-theme")'),'light');
  assert.equal(await js('getComputedStyle(document.documentElement).colorScheme'),'light');
  await js('document.querySelector(".catalogPanel").scrollIntoView({block:"center"})');
  await screenshot('interface-settings-light');
  await click('.themeChoices button:last-child'); await delay(100);
  assert.equal(await js('document.documentElement.dataset.theme'),'dark');
  await click('.storageDestination button'); await delay(100);
  assert(await js('document.querySelector(".storageTarget").textContent.includes("oplserver")'));
  await screenshot('interface-settings');
  await click('.settingsPanel .formActions .primary'); await delay(200);
  assert(await js('window.__calls.includes("storage:move")'));
  await click('.storageDestination button'); await delay(100);
  await click('input[value="fresh"]'); await delay(100);
  assert(await js('document.querySelector(".storageDeleteButton").disabled'));
  await click('.storageWarning input'); await delay(100);
  assert.equal(await js('document.querySelector(".storageDeleteButton").disabled'),false);
  await screenshot('interface-settings-fresh');
  await click('.storageDeleteButton'); await delay(200);
  assert(await js('window.__calls.includes("storage:fresh")'));
  await click('.sidebar nav button:first-child'); await delay(100);
  await setInput('.searchBox input','nothing-matches');
  assert(await js('!!document.querySelector(".emptyState")'));
  await click('.clearSearch'); await delay(450);
  for (const width of [1050,800,650]) {
    window.setSize(width,900); await delay(200);
    assert(await js('document.documentElement.scrollWidth <= innerWidth'), `horizontal overflow at ${width}`);
  }
  await screenshot('interface-compact');
  await js('localStorage.removeItem("caduceus-achievements-guide-v1")');
  await click('.sidebar nav button:last-child');await delay(150);
  assert(await js('!!document.querySelector(".achievementGuide")'));
  await click('.achievementGuide .primary');await delay(50);
  await click('.achievementGuide .primary');await delay(50);
  assert(await js('document.querySelector(".achievementGuide").textContent.includes("SMB")'));
  await click('.achievementGuide .primary');await delay(50);
  assert.equal(await js('localStorage.getItem("caduceus-achievements-guide-v1")'),'seen');
  await click('.sidebar nav button:first-child');await delay(50);
  await click('.sidebar nav button:last-child');await delay(100);
  assert.equal(await js('!!document.querySelector(".achievementGuide")'),false);
  await click('.achievementGuideAction button');await delay(50);
  assert(await js('!!document.querySelector(".achievementGuide")'));
  await click('.achievementGuide .textButton');await delay(50);
  await setInput('.raConnect input[autocomplete="username"]','Tester');
  await setInput('.raConnect input[name="raPassword"]','test-password');
  await setInput('.raConnect input[name="raKey"]','test-key');
  await click('.raConnect button');await delay(150);
  assert(await js('!!document.querySelector(".raGame")'));
  await click('.raGame');await delay(150);
  assert.equal(await js('document.querySelectorAll(".raBadge").length'),2);
  await js('document.querySelector(".raToolbar select").value="locked";document.querySelector(".raToolbar select").dispatchEvent(new Event("change",{bubbles:true}))');await delay(100);
  assert.equal(await js('document.querySelectorAll(".raBadge").length'),1);
  await screenshot('interface-achievements');
  await js('document.querySelector(".achievementOptions").open=true');await delay(100);
  assert(await js('document.querySelector(".achievementSession").textContent.includes("Recebendo telemetria")'));
  await js('localStorage.setItem("achievement-sound","off");window.__emit("xeraUnlock",{id:7,title:"Integration trophy",points:5,game:"Demo"})');await delay(150);
  assert(await js('document.querySelector(".achievementToast").textContent.includes("Integration trophy")'));
  await click('.achievementOptions .buttonRow button:first-child');await delay(100);
  assert(await js('document.querySelector(".achievementSession").textContent.includes("Pausada")'));
  assert.deepEqual(await js('window.__errors'), []);
  console.log('PASS: library, cover fallback, playing/idle transitions, details, edit/save, download, create, storage selection/move/fresh confirmation, search, compact layouts; no renderer errors.');
  window.destroy(); server.close(); app.exit(0);
}).catch(error => {console.error(error); window?.destroy(); server?.close(); app.exit(1);});
