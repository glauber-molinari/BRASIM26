/**
 * Estatísticas reais — SofaScore Brasileirão Betano 2026 (prints em /stats).
 * Usadas para ponderar gols, cartões e força individual na simulação.
 */
export interface SofaPlayerStats {
  rating?: number;
  goals?: number;
  xg?: number;
  assists?: number;
  goalInv?: number;
  goalFreq?: number;
  yellowCards?: number;
  redCards?: number;
  shotsPg?: number;
  sotPg?: number;
  keyPassesPg?: number;
  bigChancesCreated?: number;
  penaltiesScored?: number;
}

/** Chave = nome como em teams.ts (ou alias resolvido) */
export const PLAYER_STATS: Record<string, SofaPlayerStats> = {
  // Média Sofascore
  Danilo: { rating: 7.36 },
  'Marlon Freitas': { rating: 7.27, keyPassesPg: 4.2 },

  // Artilharia & xG
  'Kevin Viveros': {
    goals: 11,
    xg: 10.12,
    goalInv: 12,
    shotsPg: 2.8,
    sotPg: 1.6,
    rating: 7.1,
  },
  Pedro: { goals: 10, xg: 7.1, goalInv: 14, rating: 7.2 },
  'John Kennedy': {
    goals: 9,
    xg: 6.58,
    goalInv: 10,
    goalFreq: 122,
    sotPg: 1.5,
  },
  Gabigol: { goalFreq: 117, goals: 8, xg: 7.5 },
  'José Manuel López': { goals: 7, xg: 6.2 },
  Cano: { goals: 7, goalInv: 9 },
  Hulk: { goals: 6, xg: 5.8, rating: 7.15 },
  'Yuri Alberto': { goals: 6 },

  // Assistências & criação
  'Andreas Pereira': { assists: 9, keyPassesPg: 2.2, rating: 7.15 },
  'Samuel Lino': { assists: 6, goalInv: 8, shotsPg: 2.4 },
  'Luciano Acosta': { assists: 5, bigChancesCreated: 7 },
  'Renan Lodi': { bigChancesCreated: 8, assists: 4 },
  'Matheus Pereira': {
    assists: 4,
    keyPassesPg: 3.3,
    yellowCards: 8,
    rating: 7.0,
  },
  'Alan Patrick': { keyPassesPg: 2.5, assists: 5 },
  Ganso: { keyPassesPg: 2.1, assists: 4 },
  'Giorgian de Arrascaeta': { assists: 6, goalInv: 11, rating: 7.25 },

  // Cartões (SofaScore — temporada)
  Jorginho: { yellowCards: 5, redCards: 1, penaltiesScored: 2 },
  'Jorge Carrascal': { redCards: 2, yellowCards: 4 },
  'Juninho Capixaba': { yellowCards: 9 },
  'José Aldo': { yellowCards: 7 },
  'André Luiz': { redCards: 2, yellowCards: 6 },

  // Defesa agressiva / faltas
  'Léo Pereira': { yellowCards: 6 },
  Mercado: { yellowCards: 5 },
  Fagner: { yellowCards: 5 },

  // Goleiros (menos gols sofridos = melhor)
  'Agustín Rossi': { rating: 7.05 },
  'Carlos Miguel': { rating: 7.1 },
  'Tiago Volpi': { rating: 6.9, penaltiesScored: 2 },
  Fábio: { rating: 6.95 },
  Rochet: { rating: 6.85 },
  Everson: { rating: 6.8 },

  // Outros destaques ofensivos
  'Kaio Jorge': { goals: 5, xg: 4.8, penaltiesScored: 3 },
  Vegetti: { goals: 6, goalFreq: 135 },
  Calleri: { goals: 5, xg: 4.5 },
  'Arthur Cabral': { goals: 5 },
  Everton: { goals: 4, assists: 3 },
  'Memphis Depay': { goals: 5, xg: 4.2 },
  'Enner Valencia': { goals: 5 },
  Neymar: { rating: 7.35, goals: 4, assists: 6, goalInv: 10 },
  'Marcos Leonardo': { goals: 4, xg: 3.8 },
  Rony: { goals: 4, assists: 2 },
  Paulinho: { goals: 5, xg: 4.1 },
  'Vitor Roque': { goals: 4, xg: 3.5 },
  'Lucas Paquetá': { rating: 7.2, assists: 3, goals: 3 },
  'Gustavo Gómez': { goals: 3, assists: 2, yellowCards: 4 },
};

/** Nomes alternativos do SofaScore → nome no elenco */
export const PLAYER_STAT_ALIASES: Record<string, string> = {
  'Gabriel Barbosa': 'Gabigol',
  'Danilo Santos': 'Danilo',
  'Giorgian de Arrascaeta': 'Giorgian de Arrascaeta',
  'Carlos Vinícius': 'Pedro',
  'Breno Lopes': 'Marlon Freitas',
  'Josué': 'Matheus Pereira',
  'Andrés Gómez': 'Luciano Acosta',
  'Everton Ribeiro': 'Éverton',
};
