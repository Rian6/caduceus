# xeRAbora incorporado

Versão fixa: **v0.1.0-alpha.12**.

- Projeto e código-fonte: https://github.com/hacan359/xerabora/tree/v0.1.0-alpha.12
- Binários originais: https://github.com/hacan359/xerabora/releases/tag/v0.1.0-alpha.12
- Fork OPL: https://github.com/hacan359/Open-PS2-Loader/tree/ra
- rcheevos: https://github.com/RetroAchievements/rcheevos

`xerabora.exe` e `OPL-RA.ELF` são referências originais verificadas contra o SHA256SUMS upstream. O aplicativo distribui e executa **xerabora-caduceus.exe**, compilado do código upstream com as adaptações em `caduceus.patch`: navegador automático desativado, bind inicial em loopback e token salvo com Windows DPAPI. As licenças e os avisos originais permanecem aplicáveis.

O Caduceus mantém o OPLServer independente e lê o SSE local `/events` na porta TCP 18195. Telemetria do console usa UDP 18194. Um formulário nativo envia a senha, sem salvá-la, ao endpoint local `/login`; somente o token é persistido, criptografado. O perfil do componente fica em `achievement-engine/xerabora` dentro da pasta de dados do Caduceus. A Web API Key continua no cache protegido do Caduceus. `/logout` remove o token ao desconectar.

Limitação upstream: conquistas com jogos carregados via SMB podem interromper o carregamento; esta integração não corrige o controlador de rede do PS2. Testes reais devem começar por USB/disco. Apenas softcore.

Ao pausar ou fechar o Caduceus, somente o processo iniciado por ele é encerrado. Use **Desconectar** na tela de conquistas para remover o login completo. O perfil da instalação independente do xeRAbora não é alterado.

## Compilação do adaptador

`scripts/build-xerabora.py` documenta a transformação e gera o patch. Requer o código da tag acima em `.release-tools/xera-source`, o submódulo rcheevos no commit `f1417fbf2236936e8334533628b2948dfa4a46d0` e Zig 0.13.0 Windows x64 em `.release-tools/zig`. Execute o script a partir da raiz do projeto. Ele obtém os três arquivos upstream modificados para que execuções repetidas não acumulem alterações. Após recompilar, atualize o hash validado em `electron/xerabora.ts` e os testes. O ELF do console não foi modificado por esta adaptação.

O som do Caduceus é sintetizado localmente e não utiliza áudio da Sony.
