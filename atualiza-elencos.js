// ============================================================
// BRASIM26 — Atualizador de Elencos com Fotos
// Usa API-Football (api-sports.io) — plano gratuito
//
// COMO USAR:
//   node atualiza-elencos.js
//
// PRÉ-REQUISITO: Node.js instalado
// TEMPO: ~3 minutos (aguarda rate limit do plano free)
// ============================================================

const https = require('https');
const fs    = require('fs');

const API_KEY = '7e8ced08a4eb1f2d1a7585ed524c46b5';

// IDs CORRETOS dos 20 times na API-Football (verificados manualmente)
const TEAMS = [
  { apiId: 121,  name: 'Palmeiras',            short: 'PAL', c: '🟢', att: 84, def: 82 },
  { apiId: 127,  name: 'Flamengo',             short: 'FLA', c: '🔴', att: 83, def: 79 },
  { apiId: 124,  name: 'Fluminense',           short: 'FLU', c: '🔴', att: 72, def: 69 },
  { apiId: 134,  name: 'Athletico-PR',         short: 'CAP', c: '🔴', att: 70, def: 71 },
  { apiId: 794,  name: 'Red Bull Bragantino',  short: 'RBB', c: '⚫', att: 73, def: 66 },
  { apiId: 118,  name: 'Bahia',               short: 'BAH', c: '🔵', att: 67, def: 64 },
  { apiId: 147,  name: 'Coritiba',            short: 'CFC', c: '🟢', att: 63, def: 62 },
  { apiId: 126,  name: 'São Paulo',           short: 'SPF', c: '⚪', att: 66, def: 65 },
  { apiId: 1062, name: 'Atlético Mineiro',    short: 'CAM', c: '⚫', att: 67, def: 62 },
  { apiId: 131,  name: 'Corinthians',         short: 'COR', c: '⚫', att: 65, def: 62 },
  { apiId: 135,  name: 'Cruzeiro',            short: 'CRU', c: '🔵', att: 64, def: 63 },
  { apiId: 120,  name: 'Botafogo',            short: 'BOT', c: '⚫', att: 69, def: 64 },
  { apiId: 136,  name: 'Vitória',             short: 'VIT', c: '🔴', att: 58, def: 57 },
  { apiId: 119,  name: 'Internacional',       short: 'INT', c: '🔴', att: 63, def: 61 },
  { apiId: 128,  name: 'Santos',              short: 'SAN', c: '⚪', att: 62, def: 59 },
  { apiId: 130,  name: 'Grêmio',             short: 'GRE', c: '🔵', att: 61, def: 60 },
  { apiId: 133,  name: 'Vasco da Gama',      short: 'VAS', c: '⚫', att: 58, def: 56 },
  { apiId: 1198, name: 'Remo',               short: 'REM', c: '🔵', att: 50, def: 48 },
  { apiId: 7848, name: 'Mirassol',           short: 'MIR', c: '🟡', att: 49, def: 47 },
  { apiId: 132,  name: 'Chapecoense',        short: 'CHA', c: '🟢', att: 42, def: 40 },
];

function mapPos(p) {
  if (!p) return 'MF';
  switch (p.toLowerCase()) {
    case 'goalkeeper': return 'GK';
    case 'defender':   return 'DF';
    case 'midfielder': return 'MF';
    case 'attacker':
    case 'forward':    return 'FW';
    default:           return 'MF';
  }
}

function apiGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'v3.football.api-sports.io',
      path,
      method: 'GET',
      headers: { 'x-apisports-key': API_KEY }
    }, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch(e) { reject(new Error('JSON invalido: ' + raw.substring(0, 200))); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function parsePlayers(response) {
  if (!response || response.length === 0) return [];
  return (response[0].players || []).map(p => ({
    n:      p.name,
    p:      mapPos(p.position),
    photo:  p.photo  || null,
    number: p.number || null,
    age:    p.age    || null,
  }));
}

async function fetchSquad(apiId, name, attempt) {
  if (!attempt) attempt = 1;
  try {
    const data = await apiGet('/players/squads?team=' + apiId);

    // Rate limit: aguarda 20s e tenta de novo (max 3 tentativas)
    if (data.errors && JSON.stringify(data.errors).indexOf('rateLimit') >= 0) {
      if (attempt <= 3) {
        process.stdout.write(' [rate limit, aguardando 20s...]');
        await sleep(20000);
        return fetchSquad(apiId, name, attempt + 1);
      }
      console.log(' FALHOU apos 3 tentativas');
      return [];
    }

    if (data.errors && Object.keys(data.errors).length > 0) {
      console.log(' Erro: ' + JSON.stringify(data.errors));
      return [];
    }

    const players = parsePlayers(data.response);
    console.log(' ' + players.length + ' jogadores');
    return players;

  } catch(e) {
    console.log(' Excecao: ' + e.message);
    return [];
  }
}

async function main() {
  console.log('');
  console.log('BRASIM26 - Atualizador de Elencos');
  console.log('===================================');
  console.log('Verificando API key...');

  const status = await apiGet('/status');
  if (status.errors && status.errors.token) {
    console.error('ERRO: API Key invalida - ' + status.errors.token);
    process.exit(1);
  }

  const req   = status.response && status.response.requests;
  const used  = req ? req.current   : '?';
  const limit = req ? req.limit_day : 100;
  const plan  = status.response && status.response.subscription
              ? status.response.subscription.plan.name : 'Free';

  console.log('Plano: ' + plan);
  console.log('Requests hoje: ' + used + '/' + limit + ' (' + (limit - used) + ' restantes)');
  console.log('');

  if ((limit - used) < TEAMS.length + 2) {
    console.error('ERRO: Requests insuficientes. Tente amanhã (reseta meia-noite UTC).');
    process.exit(1);
  }

  console.log('Buscando elencos de ' + TEAMS.length + ' times...');
  console.log('(7s entre requests para respeitar limite de 10/min)');
  console.log('');

  const result = [];

  for (let i = 0; i < TEAMS.length; i++) {
    const t = TEAMS[i];
    process.stdout.write('  [' + (i+1) + '/20] ' + t.name + '...');

    const squad = await fetchSquad(t.apiId, t.name);

    result.push({
      id:    i,
      apiId: t.apiId,
      name:  t.name,
      short: t.short,
      c:     t.c,
      att:   t.att,
      def:   t.def,
      squad: squad,
    });

    // 7s entre requests = max ~8 req/min (abaixo do limite de 10/min)
    if (i < TEAMS.length - 1) {
      await sleep(7000);
    }
  }

  fs.writeFileSync('players.json', JSON.stringify(result, null, 2), 'utf8');

  const total = result.reduce(function(a, t) { return a + t.squad.length; }, 0);
  const withPhoto = result.reduce(function(a, t) {
    return a + t.squad.filter(function(p) { return p.photo; }).length;
  }, 0);

  console.log('');
  console.log('===================================');
  console.log('players.json gerado!');
  console.log(result.length + ' times');
  console.log(total + ' jogadores');
  console.log(withPhoto + ' com foto');
  console.log('');
  console.log('PROXIMOS PASSOS:');
  console.log('  git add players.json');
  console.log('  git commit -m "feat: elencos atualizados"');
  console.log('  git push');
}

main().catch(function(err) {
  console.error('ERRO FATAL: ' + err.message);
  process.exit(1);
});
