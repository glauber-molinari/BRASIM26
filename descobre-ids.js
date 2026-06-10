// ============================================================
// BRASIM26 — Descobridor de IDs corretos dos times
// Roda ANTES do atualiza-elencos.js para confirmar os IDs
//
// COMO USAR:
//   node descobre-ids.js
// ============================================================

const https = require('https');

const API_KEY = '7e8ced08a4eb1f2d1a7585ed524c46b5';

// Times que queremos buscar (busca por nome)
const BUSCAR = [
  'Palmeiras', 'Flamengo', 'Fluminense', 'Athletico', 
  'Bragantino', 'Bahia', 'Coritiba', 'Sao Paulo',
  'Atletico Mineiro', 'Corinthians', 'Cruzeiro', 'Botafogo',
  'Vitoria', 'Internacional', 'Santos', 'Gremio',
  'Vasco', 'Remo', 'Mirassol', 'Chapecoense'
];

function apiGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'v3.football.api-sports.io',
      path: path,
      method: 'GET',
      headers: { 'x-apisports-key': API_KEY }
    }, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch(e) { reject(new Error('JSON invalido')); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('BRASIM26 - Descobridor de IDs');
  console.log('==============================');
  console.log('Buscando times do Brasileirao 2026 (league=71)...\n');

  // Melhor abordagem: busca todos os times da liga de uma vez!
  const data = await apiGet('/teams?league=71&season=2026');

  if (data.errors && Object.keys(data.errors).length > 0) {
    console.log('Erro na busca por liga, tentando por nome...');

    // Fallback: busca um por um por nome
    for (let i = 0; i < BUSCAR.length; i++) {
      const nome = BUSCAR[i];
      const r = await apiGet('/teams?search=' + encodeURIComponent(nome));
      if (r.response && r.response.length > 0) {
        r.response.slice(0, 3).forEach(function(t) {
          console.log('ID: ' + t.team.id + ' | ' + t.team.name + ' | ' + t.team.country);
        });
      }
      if (i < BUSCAR.length - 1) await sleep(7000);
    }
    return;
  }

  if (!data.response || data.response.length === 0) {
    console.log('Nenhum time encontrado para league=71 season=2026');
    console.log('Tentando season=2025...');
    const data2 = await apiGet('/teams?league=71&season=2025');
    if (data2.response) {
      console.log('\nTimes encontrados (2025):');
      data2.response.forEach(function(t) {
        console.log('  apiId: ' + t.team.id + ',  // ' + t.team.name);
      });
    }
    return;
  }

  console.log('Times encontrados na liga 71 (Brasileirao):');
  console.log('--------------------------------------------');
  data.response.forEach(function(t) {
    console.log('  { apiId: ' + t.team.id + ', name: "' + t.team.name + '" },');
  });
  console.log('\nCopie esses IDs para o atualiza-elencos.js!');
}

main().catch(function(e) { console.error('ERRO: ' + e.message); });
