/**
 * Importa elencos e fotos do Transfermarkt (Brasileirão 2026).
 * Uso: node scripts/import-transfermarkt.mjs
 * Gera: data/playerPhotos.ts + public/players/*.jpg
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
const REPORT = path.join(ROOT, 'scripts/import-report.json');

const BASE = 'https://www.transfermarkt.com.br';
const SEASON = 2025;
const DELAY_MS = 2500;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Nome no jogo → candidatos no Transfermarkt */
const NAME_ALIASES = {
  Piquerez: ['Joaquín Piquerez', 'Joaquin Piquerez'],
  Gabigol: ['Gabriel Barbosa'],
  Arias: ['Jhon Arias'],
  'Éverton': ['Everton Ribeiro', 'Éverton Ribeiro'],
  Everton: ['Everton Ribeiro', 'Everton Ceballos', 'Everton'],
  Muralha: ['Alex Muralha'],
  PK: ['PK'],
  Sassá: ['Sassá', 'Sassa'],
  'Luciano Juba': ['Luciano Juba'],
  Welington: ['Welington'],
  'Diego Costa': ['Diego Costa'],
  'João Marcelo': ['João Marcelo'],
  'Victor Hugo': ['Victor Hugo'],
  'Vitor Hugo': ['Vitor Hugo'],
  'Gabriel Vasconcelos': ['Gabriel Vasconcelos'],
  'Guilherme Queiroz': ['Guilherme Queiroz'],
  'José Martínez': ['José Martínez', 'Jose Martinez'],
  'Héctor Hernández': ['Héctor Hernández', 'Hector Hernandez'],
  'Kaio César': ['Kaio César', 'Kaio Cesar'],
  'Lautaro Díaz': ['Lautaro Díaz', 'Lautaro Diaz'],
  'Santiago Rodríguez': ['Santiago Rodríguez'],
  'Puma Rodríguez': ['Puma Rodríguez'],
  'Maxime Dominguez': ['Maxime Dominguez'],
  'Isidro Pitta': ['Isidro Pitta'],
  'Fabrício Daniel': ['Fabrício Daniel', 'Fabricio Daniel'],
  'Vinicius Kiss': ['Vinicius Kiss'],
  'Luís Otávio': ['Luís Otávio', 'Luis Otavio'],
  'Danilo Avelar': ['Danilo Avelar'],
  'Neto Moura': ['Neto Moura'],
  'Maycon Douglas': ['Maycon Douglas'],
  'Vini Locatelli': ['Vini Locatelli'],
  'Anselmo Ramon': ['Anselmo Ramon'],
  'Marcelo Ortiz': ['Marcelo Ortiz'],
  'Kevin Serna': ['Kevin Serna'],
  'Kauã Elias': ['Kauã Elias', 'Kaua Elias'],
  'Luciano Acosta': ['Luciano Acosta', 'Andrés Gómez'],
  'Giorgian de Arrascaeta': ['Giorgian de Arrascaeta'],
  'Agustín Canobbio': ['Agustín Canobbio', 'Agustin Canobbio'],
  'Jefferson Savarino': ['Jefferson Savarino'],
  'Guzmán Rodríguez': ['Guzmán Rodríguez', 'Guzman Rodriguez'],
  'Andrés Hurtado': ['José Andrés Hurtado', 'Andres Hurtado'],
  'Santiago Arias': ['Santiago Arias'],
  'Rafael Ratão': ['Rafael Ratão', 'Rafael Ratao'],
  'Igor Vinícius': ['Igor Vinícius', 'Igor Vinicius'],
  'Marcos Antonio': ['Marcos Antonio'],
  'Renzo Saravia': ['Renzo Saravia'],
  'Mateo Cassierra': ['Mateo Cassierra'],
  'Joaquín Correa': ['Joaquín Correa', 'Joaquin Correa'],
  'Matheus Martins': ['Matheus Martins'],
  'Chris Ramos': ['Chris Ramos'],
  'Arthur Cabral': ['Arthur Cabral'],
  'Álvaro Montoro': ['Álvaro Montoro', 'Alvaro Montoro'],
  'Alex Telles': ['Alex Telles'],
  'Mateo Ponte': ['Mateo Ponte'],
  'Wagner Leonardo': ['Wagner Leonardo'],
  'Willean Lepo': ['Willean Lepo'],
  'Léo Naldi': ['Léo Naldi', 'Leo Naldi'],
  'Léo Ceará': ['Léo Ceará', 'Leo Ceara'],
  'Raúl Cáceres': ['Raúl Cáceres', 'Raul Caceres'],
  'Clayton Sampaio': ['Clayton Sampaio'],
  'Enner Valencia': ['Enner Valencia'],
  'Ricardo Mathias': ['Ricardo Mathias'],
  'Tomás Rincón': ['Tomás Rincón', 'Tomas Rincon'],
  'Diego Pituca': ['Diego Pituca'],
  'Marcos Leonardo': ['Marcos Leonardo'],
  'Wendel Silva': ['Wendel Silva'],
  'Tiago Volpi': ['Tiago Volpi'],
  'Lucas Piton': ['Lucas Piton'],
  'Matheus Barbosa': ['Matheus Barbosa'],
  'Zé Gabriel': ['Zé Gabriel', 'Ze Gabriel'],
  'Felipe Gedoz': ['Felipe Gedoz'],
  'Rodrigo Pimpão': ['Rodrigo Pimpão', 'Rodrigo Pimpao'],
  'Anderson Uchôa': ['Anderson Uchôa', 'Anderson Uchoa'],
  'Jean Patrick': ['Jean Patrick'],
  'Everton Sena': ['Everton Sena'],
  'Igor Fernandes': ['Igor Fernandes'],
  'Thiago Coelho': ['Thiago Coelho'],
  'Rafael Jansen': ['Rafael Jansen'],
  Gerson: ['Gerson'],
  'Renan Lodi': ['Renan Lodi'],
  Nino: ['Nino'],
  Manoel: ['Manoel'],
  André: ['André', 'Andre'],
  'Thiago Heleno': ['Thiago Heleno'],
  'Kaique Rocha': ['Kaique Rocha'],
  Abner: ['Abner'],
  Erick: ['Erick'],
  Christian: ['Christian'],
  'Léo Linck': ['Léo Linck', 'Leo Linck'],
  'Di Yorio': ['Di Yorio'],
  Cuello: ['Cuello'],
  'Luan Candido': ['Luan Candido', 'Luan Cândido'],
  'Eduardo Santos': ['Eduardo Santos'],
  'Léo Realpe': ['Léo Realpe', 'Leo Realpe'],
  'Nathan Mendes': ['Nathan Mendes'],
  'Jhon Jhon': ['Jhon Jhon'],
  Jadsom: ['Jadsom'],
  Laquintana: ['Laquintana'],
  Helinho: ['Helinho'],
  Calleri: ['Jonathan Calleri', 'Calleri'],
  Rafael: ['Rafael'],
  Beraldo: ['Beraldo'],
  Sabino: ['Sabino'],
  Arboleda: ['Arboleda'],
  'Pablo Maia': ['Pablo Maia'],
  Luciano: ['Luciano'],
  Ferreirinha: ['Ferreirinha'],
  'Hugo Souza': ['Hugo Souza'],
  'Matheus Donelli': ['Matheus Donelli'],
  'André Ramalho': ['André Ramalho', 'Andre Ramalho'],
  Cacá: ['Cacá', 'Caca'],
  Matheuzinho: ['Matheuzinho'],
  Hugo: ['Hugo'],
  Bidu: ['Bidu'],
  'Breno Bidon': ['Breno Bidon'],
  'Matheus Pereira': ['Matheus Pereira'],
  Raniele: ['Raniele'],
  'Memphis Depay': ['Memphis Depay'],
  Cássio: ['Cássio', 'Cassio'],
  'Fabrício Bruno': ['Fabrício Bruno', 'Fabricio Bruno'],
  William: ['William'],
  Villalba: ['Villalba'],
  'Kaiki Bruno': ['Kaiki Bruno'],
  Marlon: ['Marlon'],
  Fagner: ['Fagner'],
  'Matheus Henrique': ['Matheus Henrique'],
  Ramiro: ['Ramiro'],
  'Kaio Jorge': ['Kaio Jorge'],
  'Gabriel Veron': ['Gabriel Veron'],
  'Rafa Silva': ['Rafa Silva'],
  Geromel: ['Geromel'],
  Reinaldo: ['Reinaldo'],
  Mayk: ['Mayk'],
  Pepê: ['Pepê', 'Pepe'],
  Cristaldo: ['Franco Cristaldo', 'Cristaldo'],
  Soteldo: ['Soteldo'],
  Aravena: ['Alexander Aravena', 'Aravena'],
  'Léo Jardim': ['Léo Jardim', 'Leo Jardim'],
  Guto: ['Guto'],
  'João Victor': ['João Victor', 'Joao Victor'],
  Maicon: ['Maicon'],
  Lyncon: ['Lyncon'],
  Jair: ['Jair'],
  Payet: ['Dimitri Payet', 'Payet'],
  Vegetti: ['Vegetti'],
  Neymar: ['Neymar'],
  Giuliano: ['Giuliano'],
  'João Schmidt': ['João Schmidt', 'Joao Schmidt'],
  'Zé Ivaldo': ['Zé Ivaldo', 'Ze Ivaldo'],
  Kevyson: ['Kevyson'],
  'Lucas Pires': ['Lucas Pires'],
  'Diego Pituca': ['Diego Pituca'],
  Ângelo: ['Ângelo', 'Angelo'],
  'Wendel Silva': ['Wendel Silva'],
  'João Paulo': ['João Paulo', 'Joao Paulo'],
  'Gabriel Brazão': ['Gabriel Brazão', 'Gabriel Brazao'],
  Messias: ['Messias'],
  'Luan Peres': ['Luan Peres'],
  Keiller: ['Keiller'],
  Saulo: ['Saulo'],
  'Victor Ferraz': ['Victor Ferraz'],
  Dirceu: ['Dirceu'],
  Jefinho: ['Jefinho'],
  Galdezani: ['Galdezani'],
  Moisés: ['Moisés', 'Moises'],
  Alan: ['Alan'],
  Perotti: ['Perotti'],
  Warley: ['Warley'],
  'Mateus Costa': ['Mateus Costa'],
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function norm(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseTeamsTs() {
  const src = fs.readFileSync(TEAMS_TS, 'utf8');
  const blocks = [...src.matchAll(/short: '(\w+)'[\s\S]*?squad: \[([\s\S]*?)\],/g)];
  const byShort = {};
  for (const [, short, squadBlock] of blocks) {
    const players = [...squadBlock.matchAll(/\{ n: '([^']+)'/g)].map((m) => m[1]);
    byShort[short] = players;
  }
  return byShort;
}

function parseSquadHtml(html) {
  const players = [];
  const re =
    /data-src="(https:\/\/img\.a\.transfermarkt\.technology\/portrait\/medium\/(\d+)[^"]*)"[^>]*title="([^"]+)"[\s\S]*?href="([^"]+\/profil\/spieler\/\2)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[3] === 'default' || m[1].includes('default.jpg')) continue;
    players.push({
      id: m[2],
      name: m[3],
      photoUrl: m[1],
      profilePath: m[4],
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

function matchPlayer(gameName, tmPlayers) {
  const candidates = [gameName, ...(NAME_ALIASES[gameName] ?? [])];

  for (const c of candidates) {
    const hit = tmPlayers.find((p) => p.name === c || norm(p.name) === norm(c));
    if (hit) return hit;
  }

  const ng = norm(gameName);
  const parts = gameName.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    const byFull = tmPlayers.filter((p) => norm(p.name) === ng);
    if (byFull.length === 1) return byFull[0];

    const byLast = tmPlayers.filter((p) => {
      const tp = p.name.split(/\s+/);
      return norm(tp[tp.length - 1]) === ng;
    });
    if (byLast.length === 1) return byLast[0];

    const byFirst = tmPlayers.filter((p) => norm(p.name.split(/\s+/)[0]) === ng);
    if (byFirst.length === 1) return byFirst[0];

    return null;
  }

  const gameWords = parts.map(norm);
  const byAllWords = tmPlayers.filter((p) => {
    const np = norm(p.name);
    return gameWords.every((w) => np.includes(w));
  });
  if (byAllWords.length === 1) return byAllWords[0];

  const byFirstLast = tmPlayers.filter((p) => {
    const tp = p.name.split(/\s+/);
    return (
      norm(tp[0]) === norm(parts[0]) &&
      norm(tp[tp.length - 1]) === norm(parts[parts.length - 1])
    );
  });
  if (byFirstLast.length === 1) return byFirstLast[0];

  return null;
}

function extFromUrl(url) {
  const m = url.match(/\.(jpe?g|png|webp)/i);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
}

async function downloadPhoto(url, destBase) {
  const ext = extFromUrl(url);
  const dest = `${destBase}.${ext}`;
  if (fs.existsSync(dest)) return path.basename(dest);

  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
      await sleep(400);
      return path.basename(dest);
    }
    if (res.status >= 500 && attempt < 3) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    throw new Error(`Photo HTTP ${res.status}`);
  }
  throw new Error('Photo download failed');
}

function generateTs(photos) {
  const lines = Object.entries(photos)
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([name, file]) => `  ${JSON.stringify(name)}: '/players/${file}',`);

  return `/** Gerado por scripts/import-transfermarkt.mjs — não editar manualmente */
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
  const tmTeams = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8'));
  const gameSquads = parseTeamsTs();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  if (fresh) {
    for (const f of fs.readdirSync(OUT_DIR)) {
      fs.unlinkSync(path.join(OUT_DIR, f));
    }
  }

  const photos = {};
  const report = { matched: [], unmatched: [], errors: [] };

  for (const team of tmTeams) {
    const url = `${BASE}/${team.slug}/kader/verein/${team.verein}/saison_id/${SEASON}`;
    process.stdout.write(`\n[${team.short}] ${url}\n`);

    try {
      const html = await fetchPage(url);
      const tmPlayers = parseSquadHtml(html);
      console.log(`  → ${tmPlayers.length} jogadores no TM`);

      const gamePlayers = gameSquads[team.short] ?? [];
      for (const gameName of gamePlayers) {
        if (photos[gameName]) continue;

        const hit = matchPlayer(gameName, tmPlayers);
        if (!hit) {
          report.unmatched.push({ team: team.short, name: gameName });
          console.log(`  ✗ ${gameName}`);
          continue;
        }

        try {
          const destBase = path.join(OUT_DIR, hit.id);
          const file = await downloadPhoto(hit.photoUrl, destBase);
          photos[gameName] = file;
          report.matched.push({
            team: team.short,
            gameName,
            tmName: hit.name,
            id: hit.id,
            file,
          });
          console.log(`  ✓ ${gameName} ← ${hit.name}`);
        } catch (err) {
          report.errors.push({ team: team.short, name: gameName, error: String(err) });
          console.log(`  ! ${gameName} — erro ao baixar foto: ${err.message}`);
        }
      }
    } catch (err) {
      report.errors.push({ team: team.short, error: String(err) });
      console.log(`  ERRO: ${err.message}`);
    }

    await sleep(DELAY_MS);
  }

  fs.writeFileSync(OUT_TS, generateTs(photos), 'utf8');
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n── Resumo ──');
  console.log(`Fotos: ${Object.keys(photos).length}`);
  console.log(`Sem match: ${report.unmatched.length}`);
  console.log(`Erros: ${report.errors.length}`);
  console.log(`→ ${OUT_TS}`);
  console.log(`→ ${REPORT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
