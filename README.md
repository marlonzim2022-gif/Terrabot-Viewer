# Terrabot Viewer

**Assistir pelo navegador:** https://marlonzim2022-gif.github.io/Terrabot-Viewer/

Visualizador público dos replays do Terrabot. O projeto principal, modelos e treinamento permanecem no repositório privado.

## Estado atual

- ✅ GitHub Pages ativo no repositório público.
- ✅ V5 disponível com quatro animações.
- ✅ Catálogo de estatísticas agregado para cenários originais e inéditos.
- 🟡 Script para publicação automática preparado no Terrabot privado.
- ⏳ Publicação automática **ainda aguarda autorização de escrita restrita a este repositório**.

A V5 obteve **0/50** no cenário original e **11/50 (22%)** em posições inéditas. Os GIFs são exemplos individuais, não demonstram uma vitória necessariamente.

**Aviso:** os GIFs mostram o simulador visual PixelWorld, não o jogo Terraria Mobile.

## Publicação futura

Após o treino bem-sucedido no repositório privado, `scripts/publish_replays.py` foi preparado para validar os resultados e publicar somente GIFs permitidos e duas estatísticas resumidas. Nenhum modelo (`.pt`), código privado ou log é transferido.

O token padrão do GitHub Actions **não** permite escrever em outro repositório. Para ativar a publicação automática, é necessária uma autorização adicional (por exemplo, credencial restrita a `Terrabot-Viewer`) guardada como secret no repositório privado. **Não coloque segredos neste repositório público**.

Os arquivos `media/trained*.gif` presentes vieram da publicação manual da V5 e continuam funcionando. A integração futura criará nomes versionados sem removê-los.

## Custos

Hospedagem no GitHub Pages de repositório público, sem assinatura; execução de Actions sujeita às cotas gratuitas do GitHub.
