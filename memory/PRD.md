# PRD — Neon Pimbol (Pinball Arcade)

## Problem Statement (original, em português)
"Criar um geme de pimbol vc conhece" — o usuário pediu um jogo de pinball (fliperama) com palhetas e bolinha.

## User Personas
- Jogador casual que quer se divertir rapidamente no navegador com um jogo clássico de pinball.

## Core Requirements
- Jogo de pinball jogável no navegador (single-player, sem backend)
- Física realista da bolinha: gravidade, atrito, colisões com paredes, palhetas e bumpers
- 2 palhetas controladas por teclado (setas ou A/D) e por toque no mobile
- Plunger (lançador) controlado por ESPAÇO — segurar para carregar, soltar para lançar
- Pontuação, recorde salvo em localStorage, sistema de vidas (3 bolas)
- Combo multiplicador ao acertar múltiplos bumpers em sequência
- Visual arcade retrô neon (fonte Press Start 2P + VT323, cores magenta/ciano/amarelo)

## What's been implemented (2026-02-05)
- `/app/frontend/src/components/Pinball.jsx` — jogo completo em HTML5 Canvas + React
  - Física: gravidade, atrito, sub-step integration, colisão segmento/círculo/triângulo
  - 5 bumpers com pontuações (75/100/150), 2 slingshots triangulares
  - 2 palhetas com física de rotação e boost de velocidade
  - Plunger com power meter visual, chute lateral com deflector
  - Sistema de combo, partículas de impacto, flashes visuais
  - Localstorage para high score
  - Controles touch para mobile
- `/app/frontend/src/App.js` — roteamento simplificado, renderiza `<Pinball />` na raiz
- `/app/frontend/src/App.css` — estilo arcade neon: gabinete de fliperama com marquee, painéis HUD, botões arcade, animação blink

## Prioritized Backlog
### P1
- [ ] Ranking online (leaderboard) com backend + MongoDB
- [ ] Sons/efeitos sonoros (bumper hit, launch, drain)
- [ ] Mesas/temas adicionais desbloqueáveis

### P2
- [ ] Multi-ball mode
- [ ] Tilt mechanic
- [ ] Achievements
- [ ] Compartilhamento de score em redes sociais

## Architecture
- Frontend-only (React + Canvas 2D). Backend não utilizado nesta fase.
- Zero dependências novas (usa apenas o que já vem no template).
