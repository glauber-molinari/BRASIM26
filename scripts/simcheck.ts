/**
 * Calibração do motor de partida: roda N jogos entre times reais e imprime
 * médias por jogo, para comparar com o Brasileirão real.
 * Uso: npx -y tsx scripts/simcheck.ts
 */
import { TEAMS } from '../data/teams';
import { simMatch } from '../lib/simulator';

const N = 2000;

let goals = 0, hWins = 0, aWins = 0, draws = 0;
let shots = 0, sot = 0, corners = 0, yellows = 0, reds = 0;
let pens = 0, varCancels = 0, saves = 0, posts = 0, misses = 0, assists = 0;
let hGoals = 0, aGoals = 0;
const scoreDist: Record<string, number> = {};
const goalsByBucket = [0, 0, 0, 0, 0, 0, 0]; // 0-15,16-30,31-45,46-60,61-75,76-90,90+

for (let i = 0; i < N; i++) {
  const h = TEAMS[Math.floor(Math.random() * 19)];
  let a = TEAMS[Math.floor(Math.random() * 19)];
  while (a.id === h.id) a = TEAMS[Math.floor(Math.random() * 19)];

  const r = simMatch(h.id, a.id, []);
  goals += r.hG + r.aG;
  hGoals += r.hG;
  aGoals += r.aG;
  if (r.hG > r.aG) hWins++;
  else if (r.hG < r.aG) aWins++;
  else draws++;
  shots += r.hShots + r.aShots;
  sot += (r.hSot ?? 0) + (r.aSot ?? 0);
  corners += (r.hCorners ?? 0) + (r.aCorners ?? 0);
  const key = `${Math.min(r.hG, 5)}x${Math.min(r.aG, 5)}`;
  scoreDist[key] = (scoreDist[key] ?? 0) + 1;

  for (const ev of r.evs) {
    if (ev.type === 'yellow') yellows++;
    if (ev.type === 'red') reds++;
    if (ev.type === 'save') saves++;
    if (ev.type === 'post') posts++;
    if (ev.type === 'miss') misses++;
    if (ev.type === 'var') varCancels++;
    if (ev.pen) pens++;
    if (ev.type === 'goal') {
      if (ev.assist) assists++;
      const b = ev.min >= 90 ? 6 : Math.min(5, Math.floor((ev.min - 1) / 15));
      goalsByBucket[b]++;
    }
  }
}

const f = (v: number) => (v / N).toFixed(2);
console.log(`--- ${N} jogos ---`);
console.log(`Gols/jogo:        ${f(goals)}   (real BR: ~2.4-2.6)`);
console.log(`  mandante ${f(hGoals)} x ${f(aGoals)} visitante`);
console.log(`V/E/D mandante:   ${(100 * hWins / N).toFixed(0)}% / ${(100 * draws / N).toFixed(0)}% / ${(100 * aWins / N).toFixed(0)}%  (real: ~50/27/23)`);
console.log(`Chutes/jogo:      ${f(shots)}  (real: ~24-26)`);
console.log(`No gol/jogo:      ${f(sot)}   (real: ~8-9)`);
console.log(`Escanteios/jogo:  ${f(corners)}  (real: ~10)`);
console.log(`Amarelos/jogo:    ${f(yellows)}  | Vermelhos: ${f(reds)}`);
console.log(`Pênaltis/jogo:    ${f(pens)}  | VAR anulou: ${f(varCancels)}`);
console.log(`Eventos feed:     defesas ${f(saves)} · traves ${f(posts)} · chances perdidas ${f(misses)}`);
console.log(`Gols c/ assist:   ${(100 * assists / Math.max(1, goals - 0)).toFixed(0)}%`);
const totalBucketGoals = goalsByBucket.reduce((x, y) => x + y, 0);
console.log('Distribuição dos gols por período:');
const labels = ['1-15', '16-30', '31-45', '46-60', '61-75', '76-90', '90+'];
goalsByBucket.forEach((g, i) =>
  console.log(`  ${labels[i].padEnd(6)} ${(100 * g / totalBucketGoals).toFixed(1)}%`)
);
const feedEvents = (saves + posts + misses + yellows + reds + varCancels) / N + goals / N;
console.log(`Eventos de feed/jogo (sem subs/escanteios): ${feedEvents.toFixed(1)}`);
