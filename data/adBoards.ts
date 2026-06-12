// ─── Placas de publicidade do campinho ao vivo ───────────────────────────────
//
// Edite a lista abaixo para mudar o que aparece nas placas em volta do campo
// durante a partida (velocidade Normal). As placas se repetem em ciclo até
// preencher todos os espaços do perímetro.
//
// - text:  o que vai escrito na placa (recomendado até ~16 caracteres)
// - bg:    cor de fundo da placa (opcional — padrão verde-escuro)
// - color: cor do texto (opcional — padrão branco)

export interface AdBoard {
  text: string;
  bg?: string;
  color?: string;
}

export const AD_BOARDS: AdBoard[] = [
  { text: 'BRA26', bg: '#1fc45e', color: '#06140a' },
  { text: 'SEU ANÚNCIO AQUI', bg: '#ffca28', color: '#1a1a1a' },
  { text: 'ANUNCIE AQUI' },
  { text: 'SEU ANÚNCIO AQUI', bg: '#ffca28', color: '#1a1a1a' },
  { text: 'JOGUE GRÁTIS' },
];
