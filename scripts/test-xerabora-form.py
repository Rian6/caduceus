"""Compile and exercise the actual native form parser without real credentials."""
import pathlib, subprocess, os
root=pathlib.Path(__file__).resolve().parent.parent
source=(root/'.release-tools/xera-source/client/src/webui.c').read_text()
parser=source[source.index('static void urldecode('):source.index('static void respond(sock_t c,',source.index('static void urldecode('))]
test=r'''
#include <assert.h>
#include <ctype.h>
#include <stdlib.h>
#include <string.h>
'''+parser+r'''
int main(void) {
    char body[2048]="password=", output[256], expected[256];
    int i;
    for(i=0;i<200;i++) { strcat(body,"%26"); expected[i]='&'; }
    expected[200]=0;
    assert(form_field(body,"password",output,sizeof(output))==1);
    assert(strcmp(output,expected)==0);
    assert(form_field("user=Test&password=a%2Bb%26c%3Dd%25%C3%A7", "password",output,sizeof(output))==1);
    assert(strcmp(output,"a+b&c=d%\xc3\xa7")==0);
    assert(form_field(body,"password",output,10)==-1);
    assert(output[0]==0);
    return 0;
}
'''
file=root/'.release-tools/test-xerabora-form.c'
exe=root/'.release-tools/test-xerabora-form.exe'
file.write_text(test)
subprocess.run([str(root/'.release-tools/zig/zig.exe'),'cc',str(file),'-o',str(exe)],env=dict(os.environ,ZIG_GLOBAL_CACHE_DIR=str(root/'.release-tools/zig-cache')),check=True)
subprocess.run([str(exe)],check=True)
print('PASS: native parser preserves long percent-encoded passwords and rejects overflow.')
