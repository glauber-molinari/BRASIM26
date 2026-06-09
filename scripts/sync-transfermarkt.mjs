/**
 * Sincroniza elencos (data/teams.ts) e fotos (data/playerPhotos.ts) com o Transfermarkt.
 * Uso: node scripts/sync-transfermarkt.mjs [--fresh]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TEAMS_FILE = path.join(ROOT, 'scripts/transfermarkt-teams.json');
const TEAMS_TS = path.join(ROOT, 'data/teams.ts');
const OUT_TS = path.join(ROOT, 'data/playerPhotos.ts');
const OUT_DIR = path.join(ROOT, 'public/players');
const REPORT = path.join(ROOT, 'scripts/sync-report.json');

const BASE = 'https://www.transfermarkt.com.br';
const SEASON = 2025;
const DELAY_MS = 2500;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const POS_MAP = {
  Goleiro: 'GK',
  Zagueiro: 'DF',
  'Lateral Esq.': 'DF',
  'Lateral Dir.': 'DF',
  'Defesa Central': 'DF',
  Defensor: 'DF',
  Volante: 'MF',
  'Meia Central': 'MF',
  'Meia Defensivo': 'MF',
  'Meia Ofensivo': 'MF',
  Ala: 'MF',
  'Ponta Esquerda': 'FW',
  'Ponta Direita': 'FW',
  Centroavante: 'FW',
  'Seg. Atacante': 'FW',
  Atacante: 'FW',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function mapPosition(tmPos) {
  const p = tmPos.trim();
  return POS_MAP[p] ?? 'MF';
}

function escName(name) {
  return name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function parseSquadHtml(html) {
  const players = [];
  const re =
    /<table class="inline-table">[\s\S]*?data-src="(https:\/\/img\.a\.transfermarkt\.technology\/portrait\/medium\/(\d+)[^"]*)"[^>]*title="([^"]+)"[\s\S]*?href="[^"]+\/profil\/spieler\/\2"[\s\S]*?<td>\s*([^<]+?)\s*<\/td>/g;

  let m;
  while ((m = re.exec(html)) !== null) {
    const name = m[3].trim().replace(/\s+/g, ' ');
    const tmPos = m[4].trim();
    if (!name || name === 'default') continue;
    players.push({
      id: m[2],
      name,
      tmPos,
      pos: mapPosition(tmPos),
      photoUrl: m[1].includes('default.jpg') ? null : m[1],
    });
  }
  return players;
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.text();
}

function extFromUrl(url) {
  const match = url.match(/\.(jpe?g|png|webp)/i);
  return match ? match[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
}

async function downloadPhoto(url, destBase) {
  const ext = extFromUrl(url);
  const dest = `${destBase}.${ext}`;
  if (fs.existsSync(dest)) return path.basename(dest);

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) {
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      return path.basename(dest);
    }
    if (res.status >= 500 && attempt === 0) {
      await sleep(800);
      continue;
    }
    throw new Error(`Photo HTTP ${res.status}`);
  }
  throw new Error('Photo download failed');
}

function updateTeamsTs(squadsByShort) {
  let src = fs.readFileSync(TEAMS_TS, 'utf8');
  for (const [short, players] of Object.entries(squadsByShort)) {
    const lines = players.map((p) => `      { n: '${escName(p.name)}', p: '${p.pos}' },`);
    const squadBlock = `squad: [\n${lines.join('\n')}\n    ],`;
    const re = new RegExp(`(short: '${short}'[\\s\\S]*?)squad: \\[[\\s\\S]*?\\],`);
    if (!re.test(src)) {
      console.warn(`  ! short ${short} não encontrado em teams.ts`);
      continue;
    }
    src = src.replace(re, `$1${squadBlock}`);
  }
  fs.writeFileSync(TEAMS_TS, src, 'utf8');
}

function generatePhotosTs(photos) {
  const lines = Object.entries(photos)
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([name, file]) => `  ${JSON.stringify(name)}: '/players/${file}',`);

  return `/** Gerado por scripts/sync-transfermarkt.mjs — não editar manualmente */
export const PLAYER_PHOTOS: Record<string, string> = {
${lines.join('\n')}
};

export function getPlayerPhoto(name: string): string | undefined {
  return PLAYER_PHOTOS[name];
}
`;
}

async function main() {
  const fresh = process.argv.includes('--fresh');
  const squadsOnly = process.argv.includes('--squads-only');
  const tmTeams = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8'));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  if (fresh) {
    for (const f of fs.readdirSync(OUT_DIR)) {
      fs.unlinkSync(path.join(OUT_DIR, f));
    }
  }

  const squadsByShort = {};
  const allPlayers = [];
  const photos = {};
  const report = { teams: [], photoErrors: [] };

  // Fase 1 — elencos (rápido)
  const skipSquads = process.argv.includes('--photos-only');
  if (!skipSquads) {
  for (const team of tmTeams) {
    const url = `${BASE}/${team.slug}/kader/verein/${team.verein}/saison_id/${SEASON}`;
    process.stdout.write(`\n[${team.short}] elenco… `);

    try {
      const html = await fetchPage(url);
      const players = parseSquadHtml(html);
      squadsByShort[team.short] = players.map((p) => ({ name: p.name, pos: p.pos }));
      allPlayers.push(...players.map((p) => ({ ...p, team: team.short })));
      console.log(`${players.length} jogadores`);
      report.teams.push({ short: team.short, count: players.length, names: players.map((p) => p.name) });
    } catch (err) {
      report.teams.push({ short: team.short, error: String(err) });
      console.log(`ERRO: ${err.message}`);
    }

    await sleep(DELAY_MS);
  }

  updateTeamsTs(squadsByShort);
  console.log(`\n✓ Elencos gravados em ${TEAMS_TS}`);
  } else {
    // Reutiliza elenco atual para baixar só fotos
    const src = fs.readFileSync(TEAMS_TS, 'utf8');
    for (const team of tmTeams) {
      const url = `${BASE}/${team.slug}/kader/verein/${team.verein}/saison_id/${SEASON}`;
      try {
        const html = await fetchPage(url);
        parseSquadHtml(html).forEach((p) => allPlayers.push({ ...p, team: team.short }));
      } catch { /* ignore */ }
      await sleep(800);
    }
  }

  if (squadsOnly) {
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2), 'utf8');
    return;
  }

  // Fase 2 — fotos (deduplica por ID)
  const byId = new Map();
  for (const p of allPlayers) {
    if (p.photoUrl && !byId.has(p.id)) byId.set(p.id, p);
  }

  console.log(`\nBaixando ${byId.size} fotos…`);
  let done = 0;
  for (const p of byId.values()) {
    try {
      const file = await downloadPhoto(p.photoUrl, path.join(OUT_DIR, p.id));
      photos[p.name] = file;
    } catch (err) {
      report.photoErrors.push({ team: p.team, name: p.name, error: String(err) });
    }
    done++;
    if (done % 25 === 0) console.log(`  ${done}/${byId.size}`);
    await sleep(120);
  }

  // Mapeia todos os jogadores com foto pelo ID
  const idToFile = {};
  for (const p of allPlayers) {
    const f = path.join(OUT_DIR, `${p.id}.jpg`);
    const png = path.join(OUT_DIR, `${p.id}.png`);
    const jpeg = path.join(OUT_DIR, `${p.id}.jpeg`);
    if (fs.existsSync(f)) idToFile[p.id] = `${p.id}.jpg`;
    else if (fs.existsSync(png)) idToFile[p.id] = `${p.id}.png`;
    else if (fs.existsSync(jpeg)) idToFile[p.id] = `${p.id}.jpeg`;
    else if (photos[p.name]) photos[p.name] = photos[p.name];
  }
  for (const p of allPlayers) {
    if (idToFile[p.id]) photos[p.name] = idToFile[p.id];
  }

  fs.writeFileSync(OUT_TS, generatePhotosTs(photos), 'utf8');
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2), 'utf8');

  const totalPlayers = Object.values(squadsByShort).reduce((a, s) => a + s.length, 0);
  console.log('\n── Resumo ──');
  console.log(`Jogadores nos elencos: ${totalPlayers}`);
  console.log(`Fotos: ${Object.keys(photos).length}`);
  console.log(`Erros de foto: ${report.photoErrors.length}`);
  console.log(`→ ${OUT_TS}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
