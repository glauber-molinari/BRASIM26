# ⚽ BRA26 — Simulador do Brasileirão 2026

Monte seu time dos sonhos com jogadores reais dos 20 clubes da Série A e simule o campeonato completo, rodada por rodada, com transmissão ao vivo de cada partida do seu time.

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)

## ✨ Funcionalidades

- **Crie seu clube** — dê nome e sigla ao seu time personalizado
- **Escalação interativa** — monte o time no campo com jogadores reais de todos os 20 clubes
- **Táticas variadas** — 4-4-2, 4-3-3, 4-5-1, 3-5-2 e 5-3-2
- **Sorteio aleatório** — gere uma escalação surpresa com um clique
- **Simulação completa** — 38 rodadas do turno e returno com tabela de classificação em tempo real
- **Transmissão ao vivo** — acompanhe gols, cartões e eventos da partida do seu time
- **Estatísticas** — artilharia dos seus jogadores, histórico de resultados e classificação final
- **Dados reais** — elencos, força dos times e fotos dos jogadores baseados em dados do futebol brasileiro

## 🎮 Como jogar

1. **Seu time** — escolha o nome e a sigla do seu clube
2. **Escalação** — selecione a tática, escolha 11 jogadores de qualquer time da Série A e inicie o campeonato
3. **Simulação** — acompanhe rodada a rodada; quando for a vez do seu time, assista à partida ao vivo
4. **Resultado** — veja a classificação final, seus artilheiros e o histórico de jogos

## 🚀 Instalação

```bash
# Clone o repositório
git clone https://github.com/glauber-molinari/BRASIM26.git
cd BRASIM26

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev

Abra http://localhost:3000 no navegador.

📦 Scripts disponíveis:
Comando - Descrição
npm run dev - Servidor de desenvolvimento
npm run build - Build de produção
npm run start - Inicia o servidor de produção
npm run lint - Verifica o código com ESLint
npm run sync:transfermarkt - Sincroniza elencos via Transfermarkt
npm run sync:transfermarkt:fresh - Sincronização completa (do zero)
npm run sync:squads - Atualiza apenas os elencos

🛠️ Tecnologias
Next.js 14 — App Router
React 18 — interface interativa
TypeScript — tipagem estática
Tailwind CSS — estilização

📁 Estrutura do projeto
├── app/              # Páginas e layout (Next.js App Router)
├── components/       # Telas e componentes da interface
├── data/             # Times, jogadores, táticas e estatísticas
├── lib/              # Motor de simulação e lógica de jogo
└── scripts/          # Scripts de importação de dados

⚠️ Aviso
Este é um projeto de entretenimento e simulação. Não possui vínculo oficial com a CBF, clubes ou jogadores. Os dados dos elencos são aproximados e podem não refletir a realidade atual.

📄 Licença
Projeto pessoal — uso livre para fins educacionais e de entretenimento.

Desenvolvido com ⚽ por glauber-molinari
