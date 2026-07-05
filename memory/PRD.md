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
  - Física: gravidade, atrito, sub-step integration, colisão segmento/círculo/triângulo/retângulo
  - 3 bumpers grandes (100-150 pts) e 2 bumpers pequenos (50 pts)
  - 2 slingshots triangulares (25 pts)
  - **4 corredores (rollover lanes) no topo** — passar acende luz, 4 completos = +1500 bônus
  - **5 alvos derrubáveis (drop targets)** — cada um 250 pts, todos derrubados = +2000 bônus
  - **Spinner giratório** no centro (10 pts por passagem)
  - Guias/paredes internas no topo para direcionar a bolinha
  - Chute do lançador totalmente fechado com defletor superior
  - Plunger com power meter visual (força carregável)
  - Sistema de combo com timer
  - Partículas de impacto e flash visual nos alvos
  - **Sons sintetizados via Web Audio API**:
    - Bumper hit, drop target, slingshot, wall bump (sub-som), flipper, launch (sweep), drain (sweep down), lane rollover, bonus fanfare
    - Toggle mute com tecla M ou botão SOM ON/OFF
  - HUD lateral com Score, High Score, Combo, Bolas, Corredores acesos, Alvos remanescentes
  - Localstorage para high score
  - Controles touch para mobile
- `/app/frontend/src/App.js` — roteamento simplificado
- `/app/frontend/src/App.css` — estilo arcade neon com sonoro toggle, lane lights indicators

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
