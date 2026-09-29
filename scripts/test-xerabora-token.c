/* Native smoke test for the DPAPI credential adapter; uses a temporary profile. */
#include <stdio.h>
#include <string.h>
#include <assert.h>
#include "config.h"
static const char *test_directory;
int platform_config_dir(char *out, size_t size) {
    snprintf(out,size,"%s",test_directory); return 0;
}
int main(int argc,char **argv) {
    char user[128],token[256],filename[1024],bytes[4096];
    FILE *f;size_t count;
    assert(argc==2);test_directory=argv[1];
    assert(config_save_credentials("FixtureUser","fake-private-token-for-test")==0);
    assert(config_load_credentials(user,sizeof(user),token,sizeof(token))==1);
    assert(strcmp(user,"FixtureUser")==0);
    assert(strcmp(token,"fake-private-token-for-test")==0);
    snprintf(filename,sizeof(filename),"%s/credentials",test_directory);
    f=fopen(filename,"rb");assert(f);count=fread(bytes,1,sizeof(bytes)-1,f);fclose(f);bytes[count]=0;
    assert(count>4&&memcmp(bytes,"CDP1",4)==0);
    for(size_t i=0;i+26<=count;i++)assert(memcmp(bytes+i,"fake-private-token-for-test",26)!=0);
    config_forget_credentials();
    assert(config_load_credentials(user,sizeof(user),token,sizeof(token))==0);
    puts("PASS: native Windows token encryption, restoration and logout.");
    return 0;
}
