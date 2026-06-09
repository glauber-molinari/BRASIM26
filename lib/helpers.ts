export function ini(name: string): string {
  const parts = name.split(' ');
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

export function shn(name: string): string {
  const parts = name.split(' ');
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

export function rnd(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getZone(pos: number): { cls: string; label: string } {
  if (pos <= 6) return { cls: 'zl', label: 'Copa Libertadores' };
  if (pos <= 12) return { cls: 'zs', label: 'Copa Sul-Americana' };
  if (pos >= 17) return { cls: 'zr', label: 'Rebaixado ⬇' };
  return { cls: '', label: 'Meio de tabela' };
}

export function getZoneBorder(pos: number): string {
  if (pos <= 6) return 'zbl';
  if (pos <= 12) return 'zsl';
  if (pos >= 17) return 'zrl';
  return '';
}
