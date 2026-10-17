# Terrabot Viewer — regras permanentes para IAs e colaboradores

**LEIA ANTES DE ALTERAR ESTE REPOSITÓRIO.** Esta interface é o destino de gravações de experimentos reais do Terrabot.

## Regra do proprietário (17/10/2026)

**Toda nova arquitetura de rede neural do Terrabot deve ser integrada ao gravador existente ANTES de começar treinamento e avaliações com gameplay.** Os próximos treinamentos e testes devem ser publicados automaticamente aqui, como nas versões V5–V8, com **visão do jogo + visão da IA do mesmo episódio**.

- Fonte central das instruções de desenvolvimento: [AGENTS.md do Terrabot Training World Studio](https://github.com/marlonzim2022-gif/Terrabot-Training-World-Studio/blob/main/AGENTS.md).
- Gravador existente: `python/record_evaluation.py` (`DualViewRecorder`) no repositório Studio. Reutilizar esse gravador, adaptando a arquitetura, em vez de criar vídeos artificiais ou duas execuções diferentes.
- Padrão de quatro vídeos representativos por treino: durante aprendizado, teste no mapa conhecido e duas avaliações em mapas inéditos, cada um com as duas visões. Se não houver todas as avaliações, nunca inventar resultados.
- O Viewer **não treina a IA**, não precisa acessar checkpoints, e não deve receber pesos privados, tokens ou logs brutos. O pacote público validado deve incluir `public_catalog.json` e GIFs reais, com recibo de publicação `verified`.
- Um teste com falha também merece replay com o rótulo correto. Sucesso de CI não é vitória no jogo. Contato real com a bandeira importa.
- Se o GitHub falhar durante publicação, reenviar o pacote de vídeo aprovado **sem repetir treinamento**. Manter todo o histórico.
- Auditorias sem gameplay podem aparecer no histórico sem GIF. Não fabricar imagens para preencher lacunas.

**Antes de editar o Viewer, confirme que a proposta preserva esse contrato e o histórico dos vídeos já publicados.**
