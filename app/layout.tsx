import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import './globals.css';

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-barlow',
});

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-barlow-condensed',
});

export const metadata: Metadata = {
  title: 'BRA26 Simulador',
  description:
    'Monte seu time dos sonhos com jogadores reais do BRA26 e simule o campeonato completo partida por partida.',
  openGraph: {
    title: 'BRA26 Simulador',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0f0a',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${barlow.variable} ${barlowCondensed.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
