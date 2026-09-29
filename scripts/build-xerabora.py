"""Build the Caduceus adapter from the pinned upstream sources in .release-tools.
Source: xerabora v0.1.0-alpha.12, rcheevos f1417fbf2236936e8334533628b2948dfa4a46d0.
Compiler: Zig 0.13.0 (zig cc targeting x86_64-windows-gnu).
"""
import pathlib, re, subprocess, os, difflib, hashlib, urllib.request
root=pathlib.Path(__file__).resolve().parent.parent
source=root/'.release-tools/xera-source'
vendor=root/'vendor/xerabora'
patches=[]
def patch(name,transform):
    file=source/name
    original=urllib.request.urlopen('https://raw.githubusercontent.com/hacan359/xerabora/v0.1.0-alpha.12/'+name,timeout=30).read().decode()
    modified=transform(original)
    patches.extend(difflib.unified_diff(original.splitlines(True),modified.splitlines(True),fromfile='a/'+name,tofile='b/'+name))
    file.write_text(modified)

def webui(s):
    s=s.replace('void webui_open_browser(int port)\n{','void webui_open_browser(int port)\n{\n    (void)port; return; /* Caduceus owns the interface. */')
    # Decode before checking the field limit: percent encoding can triple size.
    old='''            if (len >= size)
                len = size - 1;
            memcpy(out, v, len);
            out[len] = '\\0';
            urldecode(out);
            return 1;'''
    new='''            char decoded[2048];
            if (len >= sizeof(decoded)) return -1;
            memcpy(decoded, v, len);
            decoded[len] = '\\0';
            urldecode(decoded);
            len = strlen(decoded);
            if (len >= size) {
                memset(decoded, 0, sizeof(decoded));
                return -1;
            }
            memcpy(out, decoded, len + 1);
            memset(decoded, 0, sizeof(decoded));
            return 1;'''
    assert old in s
    s=s.replace(old,new)
    old='} else if (rc == RC_INVALID_CREDENTIALS || rc == RC_EXPIRED_TOKEN || rc == RC_ACCESS_DENIED) {'
    new='''} else if (rc == RC_ACCESS_DENIED) {
                n = snprintf(out, sizeof(out), "{\\"ok\\":false,\\"error\\":\\"access denied\\"}");
            } else if (rc == RC_EXPIRED_TOKEN) {
                n = snprintf(out, sizeof(out), "{\\"ok\\":false,\\"error\\":\\"expired token\\"}");
            } else if (rc == RC_INVALID_CREDENTIALS) {'''
    assert old in s
    return s.replace(old,new)
patch('client/src/webui.c',webui)
# Keep the control API on loopback even if an upstream preference enabled LAN.
patch('client/src/main.c',lambda s:s.replace('webui_set_lan(config_load_lan());','webui_set_lan(0);'))
load=r'''int config_load_credentials(char *user, size_t user_size, char *token, size_t token_size)
{
    char path[600]; unsigned char buffer[4096]; FILE *f; size_t n;
    DATA_BLOB input, output = {0}; char *separator;
    user[0] = token[0] = '\0';
    if (config_credentials_path(path, sizeof(path)) != 0) return 0;
    f = fopen(path, "rb"); if (!f) return 0;
    n = fread(buffer, 1, sizeof(buffer), f); fclose(f);
    if (n < 5 || memcmp(buffer, "CDP1", 4)) return 0;
    input.pbData = buffer + 4; input.cbData = (DWORD)(n - 4);
    if (!CryptUnprotectData(&input, NULL, NULL, NULL, NULL, CRYPTPROTECT_UI_FORBIDDEN, &output)) return 0;
    if (!output.cbData || output.pbData[output.cbData-1] != 0) { LocalFree(output.pbData); return 0; }
    separator = strchr((char*)output.pbData, '\n');
    if (separator) { *separator = 0; snprintf(user, user_size, "%s", (char*)output.pbData); snprintf(token, token_size, "%s", separator+1); }
    SecureZeroMemory(output.pbData, output.cbData); LocalFree(output.pbData);
    return user[0] != 0 && token[0] != 0;
}

int config_save_credentials(const char *user, const char *token)
{
    char path[600], plain[1024]; FILE *f; DATA_BLOB input, output = {0}; int ok;
    if (config_credentials_path(path, sizeof(path)) != 0) return -1;
    snprintf(plain, sizeof(plain), "%s\n%s", user, token);
    input.pbData = (BYTE*)plain; input.cbData = (DWORD)strlen(plain)+1;
    ok = CryptProtectData(&input, L"Caduceus RetroAchievements", NULL, NULL, NULL, CRYPTPROTECT_UI_FORBIDDEN, &output);
    SecureZeroMemory(plain, sizeof(plain)); if (!ok) return -1;
    f = fopen(path, "wb"); if (!f) { LocalFree(output.pbData); return -1; }
    ok = fwrite("CDP1", 1, 4, f) == 4 && fwrite(output.pbData, 1, output.cbData, f) == output.cbData;
    if (fclose(f)) ok=0;
    LocalFree(output.pbData); return ok ? 0 : -1;
}

'''
def config(s):
    start=s.index('int config_load_credentials(')
    end=s.index('static int config_apikey_path(',start)
    return '#include <windows.h>\n#include <wincrypt.h>\n'+s[:start]+load+s[end:]
patch('client/src/config.c',config)
(vendor/'caduceus.patch').write_text(''.join(patches))
make=(source/'client/Makefile').read_text()
def sources(var):
    text=re.search(r'^'+var+r' := (.*?)(?=\n\n)',make,re.M|re.S).group(1)
    return [s.replace('$(RC)','../third_party/rcheevos') for s in text.replace('\\','').split() if s.endswith('.c')]
compiler=root/'.release-tools/zig/zig.exe'
args=[str(compiler),'cc','-target','x86_64-windows-gnu','-O2','-s','-std=gnu99','-Wl,--subsystem,windows','-I../third_party/rcheevos/include','-I../third_party/rcheevos/src','-I../third_party/rcheevos/src/rcheevos','-I../third_party/rcheevos/src/rapi','-I../protocol',*sources('SRC'),'src/http_winhttp.c',*sources('RC_SRC'),'-o',str(vendor/'xerabora-caduceus.exe'),'-lws2_32','-lwinhttp','-lwinmm','-lshell32','-lcrypt32']
subprocess.run(args,cwd=source/'client',env=dict(os.environ,ZIG_GLOBAL_CACHE_DIR=str(root/'.release-tools/zig-cache')),check=True)
print('Adapter SHA256:',hashlib.sha256((vendor/'xerabora-caduceus.exe').read_bytes()).hexdigest())
