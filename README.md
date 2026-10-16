# Terrabot Viewer

## Histórico e resultados por execução

Esta interface também aceita o contrato opcional `terrabot-run-v1`: estados de
treinamento/avaliação/gravação/publicação, contagens completas, configuração,
critério e identidade pública do modelo. Zero vitórias é um resultado válido;
uma execução falha pode aparecer sem GIF. Entradas anteriores continuam
inalteradas e são identificadas como históricas, sem preencher dados ausentes
retroativamente.

O botão **Atualizar catálogo** permite tentar novamente após falha de conexão.
**Link desta execução** preserva experimento, gravação, visão e comparação na
URL. **Comparar resultados** avisa quando configurações ou critérios são
diferentes/desconhecidos: números isolados não demonstram ganho de aprendizado.

Nas gravações com duas visões, ambas correspondem ao mesmo episódio/decisões.
Trocar a visão reinicia o GIF; não há cursor sincronizado ou transmissão ao vivo.
Uma tentativa selecionada não substitui a taxa da avaliação completa.

Resultados novos podem incluir `receipts/<ID>.json`, uma prova pública mínima
gerada após verificar Pages e arquivos. A interface só mostra **Verificada**
quando a prova é válida; caso contrário informa confirmação pendente. Nenhuma
credencial ou log privado é necessário para abrir o site.

Os workflows/testes desta PR não publicam experiências sintéticas. O catálogo
`manifest.json` e `media/**` existentes não foram alterados.

Testes locais: `python -m pip install playwright==1.62.0`, instalar Chromium via
`python -m playwright install chromium` e executar
`python -m unittest discover -s tests -v`. Oito testes de navegador cobrem
compatibilidade, duas visões/chunks, 0%, falhas, links, atualização, comparação,
provas inválidas e largura de celular/desktop. Os catálogos sintéticos são
interceptados localmente pelo teste, sem escrever no catálogo real.

**Assistir pelo navegador:** https://marlonzim2022-gif.github.io/Terrabot-Viewer/

Visualizador público de animações reais de execução de políticas treinadas
em simuladores do Terrabot. A rede neural, seus checkpoints e o código de
treinamento permanecem em repositórios privados.

## Experimentos disponíveis

- **Training World — Nível 1:** replay da CNN Double DQN congelada
  percorrendo o cenário simples. Avaliação separada em **24 mundos**:
  modelo 24/24 e regra simples sempre-direita 24/24.
- **Training World — Nível 2:** três gravações de políticas congeladas,
  incluindo uma tentativa malsucedida. Avaliação independente de **32 mundos**:
  modelo original do Nível 1 22/32 (**68,75%**) e adaptação conservadora
  21/32 (**65,625%**). Isso não prova ganho com o fine-tuning.
- **PixelWorld V5–V9:** replays e métricas dos experimentos anteriores,
  mantidos como histórico e exibidos em opções próprias.

As animações mostram **avaliações após o treinamento**, não a sequência
de cada atualização de pesos. Um único GIF é exemplo de comportamento,
não substitui a taxa de sucesso obtida em vários mundos.

**Importante:** nem os replays do PixelWorld nem os do novo Training World
são vídeos do Terraria Mobile. Nenhuma integração ao Terraria real é
demonstrada aqui.

## Escolher entre tela do jogo e visão da IA

Nos replays de **Training World — Nível 1** e **Training World — Nível 2**,
o seletor **Visualização** aparece logo abaixo do seletor de gravação:

- **Visão do jogo (padrão):** viewport horizontal, desenhada pelo mesmo
  `GameRenderer` usado na tela do simulador, com mundo, personagem,
  parallax, iluminação e HUD do canvas. A imagem é reduzida para facilitar
  reprodução no celular.
- **Visão da IA:** mostra a imagem RGB de 84×84 pixels usada pelo DQN
  para tomar a decisão, com legenda da ação e da semente.

Os GIFs são sincronizados por **mesma semente, mesma política congelada e
mesmo episódio**, sem treinamento durante a captura. A visão do jogo
exibe o canvas principal; os botões virtuais sobrepostos pelo React no
Google AI Studio não fazem parte do canvas exportado.

As versões V5–V9 não foram modificadas e mantêm apenas sua animação original.

## Como os novos GIFs chegam à página

Os quatro pares de GIFs do Training World foram gravados em 16/10/2026 UTC a partir
de checkpoints já produzidos e auditados por GitHub Actions no repositório
privado `Terrabot-Training-World-Studio`. Após validação, somente os GIFs
aprovados (codificados como arquivos texto `*.gif.b64`) e **métricas
agregadas** foram copiados para `media/` e `manifest.json`.
O JavaScript do viewer decodifica os GIFs localmente no navegador.

O conteúdo foi publicado **antes** da atualização do manifesto; as entradas
V5–V9 foram preservadas. Nenhuma credencial, peso de rede, log privado ou
código do motor de treinamento é distribuído pelo site.

A geração está automatizada em um workflow separado da branch experimental
`feat/new-world-replays`; a transferência ao repositório público foi feita
de forma controlada nesta publicação. Para futuras publicações automáticas,
será necessária uma credencial **restrita exclusivamente ao Viewer**,
configurada como Secret do Studio. Não colar tokens em arquivos públicos
ou na conversa.

## Custos

Hospedagem GitHub Pages em repositório público; a execução do GitHub Actions
depende das cotas gratuitas do GitHub.
