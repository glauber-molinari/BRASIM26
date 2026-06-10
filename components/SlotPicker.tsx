'use client';

import { TEAMS } from '@/data/teams';
import { getPlayerPhoto } from '@/data/playerPhotos';
import type { LineupSlot, Position, SelectedPlayer } from '@/lib/types';
import TeamLogo from './TeamLogo';

interface SlotPickerProps {
  slotIdx: number;
  lineup: LineupSlot[];
  teamUsage: Record<number, number>;
  benchMode?: boolean;
  swapMode?: boolean;
  bench?: (SelectedPlayer | null)[];
  onPick: (tid: number, name: string, pos: Position) => void;
  onRemove: (idx: number) => void;
  onClose: () => void;
}

export default function SlotPicker({
  slotIdx,
  lineup,
  teamUsage,
  benchMode = false,
  swapMode = false,
  bench = [],
  onPick,
  onRemove,
  onClose,
}: SlotPickerProps) {
  const slot = benchMode || swapMode ? null : lineup[slotIdx];

  const usedKeys = new Set<string>();
  lineup.forEach((s, i) => {
    if (i !== slotIdx && s.player) {
      usedKeys.add(`${s.player.n}_${s.player.tid}`);
    }
  });

  const title = swapMode
    ? 'Trocar Jogador'
    : benchMode
      ? 'Escalar Reserva'
      : `Escalar ${slot?.pos ?? ''}`;

  // ── SWAP MODE: mostra apenas os 11 titulares + reservas já escalados ──
  if (swapMode) {
    const currentPlayer = lineup[slotIdx]?.player;
    const starters = lineup.filter((s) => s.player).map((s) => s.player!);
    const reserves = bench.filter((p): p is SelectedPlayer => p !== null);

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="flex max-h-[80vh] w-full max-w-[420px] flex-col rounded-2xl border-2 border-[var(--border2)] bg-[var(--bg2)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <div>
              <span className="font-condensed text-lg font-extrabold uppercase text-[var(--text)]">
                {title}
              </span>
              {currentPlayer && (
                <div className="mt-0.5 text-[11px] text-[var(--text3)]">
                  Posição atual:{' '}
                  <span className="font-semibold text-[var(--text2)]">{currentPlayer.n}</span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="border-none bg-transparent text-lg leading-none text-[var(--text2)]"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-2.5">
            {/* Titulares */}
            {starters.length > 0 && (
              <>
                <div className="py-1.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--text3)]">
                  Titulares
                </div>
                {starters.map((p) => {
                  const isCur =
                    currentPlayer?.n === p.n && currentPlayer?.tid === p.tid;
                  return (
                    <button
                      key={`starter_${p.n}_${p.tid}`}
                      type="button"
                      disabled={isCur}
                      onClick={() => onPick(p.tid, p.n, p.p)}
                      className={`mb-0.5 flex w-full items-center gap-1.5 rounded-md border-none px-2 py-1.5 text-left transition-colors ${
                        isCur
                          ? 'cursor-default bg-[rgba(20,163,82,0.14)]'
                          : 'cursor-pointer bg-transparent hover:bg-white/5'
                      }`}
                    >
                      <div className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--bg3)]">
                        <span className={`pl-pbadge pos-${p.p} text-[9px] font-bold`}>
                          {p.p}
                        </span>
                        {(p.photo ?? getPlayerPhoto(p.n)) && (
                          <img
                            src={p.photo ?? getPlayerPhoto(p.n)}
                            alt={p.n}
                            className="absolute inset-0 h-full w-full object-cover object-top"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                      </div>
                      <span className="flex-1 text-xs text-[var(--text)]">{p.n}</span>
                      {isCur && (
                        <span className="text-[10px] font-semibold text-[var(--green-light)]">
                          atual
                        </span>
                      )}
                      <span className="text-[10px] text-[var(--text3)]">{p.ts}</span>
                    </button>
                  );
                })}
              </>
            )}

            {/* Reservas */}
            {reserves.length > 0 && (
              <>
                <div className="mt-2 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--text3)]">
                  Reservas
                </div>
                {reserves.map((p) => (
                  <button
                    key={`bench_${p.n}_${p.tid}`}
                    type="button"
                    onClick={() => onPick(p.tid, p.n, p.p)}
                    className="mb-0.5 flex w-full cursor-pointer items-center gap-1.5 rounded-md border-none bg-transparent px-2 py-1.5 text-left transition-colors hover:bg-white/5"
                  >
                    <div className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--bg3)]">
                      <span className={`pl-pbadge pos-${p.p} text-[9px] font-bold`}>
                        {p.p}
                      </span>
                      {(p.photo ?? getPlayerPhoto(p.n)) && (
                        <img
                          src={p.photo ?? getPlayerPhoto(p.n)}
                          alt={p.n}
                          className="absolute inset-0 h-full w-full object-cover object-top"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                    </div>
                    <span className="flex-1 text-xs text-[var(--text)]">{p.n}</span>
                    <span className="rounded-full bg-[var(--bg3)] px-1.5 py-0.5 text-[9px] text-[var(--text3)]">
                      reserva
                    </span>
                    <span className="text-[10px] text-[var(--text3)]">{p.ts}</span>
                  </button>
                ))}
              </>
            )}

            {starters.length === 0 && reserves.length === 0 && (
              <div className="py-6 text-center text-sm text-[var(--text2)]">
                Nenhum jogador escalado
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── MODO NORMAL (escalar / banco de reservas) ──
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[80vh] w-full max-w-[420px] flex-col rounded-2xl border-2 border-[var(--border2)] bg-[var(--bg2)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <span className="font-condensed text-lg font-extrabold uppercase text-[var(--text)]">
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="border-none bg-transparent text-lg leading-none text-[var(--text2)]"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2.5">
          {(slot?.player || benchMode) && (
            <button
              type="button"
              onClick={() => onRemove(slotIdx)}
              className="mb-1.5 flex w-full items-center gap-2 rounded-md border-none bg-[rgba(229,57,53,0.08)] px-2 py-1.5 text-xs text-[var(--red)] hover:bg-[rgba(229,57,53,0.15)]"
            >
              ✕ Remover jogador
            </button>
          )}

          {TEAMS.map((team) => {
            const canAdd = (teamUsage[team.id] || 0) < 3;
            const players = benchMode
              ? team.squad
              : team.squad.filter((p) => p.p === slot!.pos);
            if (!players.length) return null;

            return (
              <div key={team.id}>
                <div className="flex items-center gap-1 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--text3)]">
                  <TeamLogo logo={team.logo} fallback={team.c} size={14} />
                  {team.name}
                  {!canAdd && ' (máx 3)'}
                </div>
                {players.map((p) => {
                  const key = `${p.n}_${team.id}`;
                  const isCur =
                    !benchMode &&
                    slot?.player?.n === p.n &&
                    slot?.player?.tid === team.id;
                  const isUsed = usedKeys.has(key);
                  const isBlocked = !isCur && !canAdd;
                  const disabled = isUsed || isBlocked;

                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={disabled}
                      onClick={() => onPick(team.id, p.n, p.p)}
                      className={`mb-0.5 flex w-full items-center gap-1.5 rounded-md border-none px-2 py-1.5 text-left ${
                        disabled
                          ? 'pointer-events-none cursor-default opacity-30'
                          : 'cursor-pointer hover:bg-white/5'
                      } ${isCur ? 'bg-[rgba(20,163,82,0.14)]' : 'bg-transparent'}`}
                    >
                      <div className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--bg3)]">
                        <span className={`pl-pbadge pos-${p.p} text-[9px] font-bold`}>
                          {p.p}
                        </span>
                        {(p.photo ?? getPlayerPhoto(p.n)) && (
                          <img
                            src={p.photo ?? getPlayerPhoto(p.n)}
                            alt={p.n}
                            className="absolute inset-0 h-full w-full object-cover object-top"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                      </div>
                      <span className="flex-1 text-xs text-[var(--text)]">{p.n}</span>
                      <span className="text-[10px] text-[var(--text3)]">{team.short}</span>
                      <TeamLogo logo={team.logo} fallback={team.c} size={16} />
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
