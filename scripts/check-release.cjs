// Audit the actual packaged files, including the contents of app.asar.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const asar=require('@electron/asar');
const root=process.argv[2] ? path.resolve(process.argv[2],'win-unpacked/resources') : path.resolve(__dirname,'../release/win-unpacked/resources');
const forbidden=/(^|\/)(cache|database|achievement-engine|\.env(?:\..*)?|credentials|discord-presence\.json|settings\.json)(\/|$)|\.(iso|zso|sqlite3?|db|enc)(?:-[^/]*)?$/i;
const files=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else files.push(path.relative(root,full).replaceAll('\\','/'))}}
walk(root);
const archive=path.join(root,'app.asar');
files.push(...asar.listPackage(archive).map(name=>'app.asar/'+name.replaceAll('\\','/').replace(/^\//,'')));
assert.deepEqual(files.filter(name=>forbidden.test(name)),[],'release must not contain personal data or ISOs');
const packaged=JSON.parse(asar.extractFile(archive,'package.json').toString());
assert.equal(packaged.version,require('../package.json').version);
for(const file of ['oplserver/OPLServer.exe','xerabora/xerabora-caduceus.exe','xerabora/OPL-RA.ELF','xerabora/LICENSE-xerabora.txt','xerabora/LICENSE-OPL.txt','xerabora/LICENSE-rcheevos.txt'])assert(files.includes(file),file+' missing');
console.log(`PASS: packaged version ${packaged.version}, ${files.length} paths checked; no personal databases, credentials, caches or ISOs.`);
