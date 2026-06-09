'use client';

import { TEAMS } from '@/data/teams';
import { getPlayerPhoto } from '@/data/playerPhotos';
import type { LineupSlot, Position } from '@/lib/types';
import TeamLogo from './TeamLogo';

interface SlotPickerProps {
  slotIdx: number;
  lineup: LineupSlot[];
  teamUsage: Record<number, number>;
  benchMode?: boolean;
  onPick: (tid: number, name: string, pos: Position) => void;
  onRemove: (idx: number) => void;
  onClose: () => void;
}

export default function SlotPicker({
  slotIdx,
  lineup,
  teamUsage,
  benchMode = false,
  onPick,
  onRemove,
  onClose,
}: SlotPickerProps) {
  const slot = benchMode ? null : lineup[slotIdx];

  const usedKeys = new Set<string>();
  lineup.forEach((s, i) => {
    if (i !== slotIdx && s.player) {
      usedKeys.add(`${s.player.n}_${s.player.tid}`);
    }
  });

  const title = benchMode ? 'Escalar Reserva' : `Escalar ${slot?.pos ?? ''}`;

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
                  const isCur = !benchMode &&
                    slot?.player?.n === p.n && slot?.player?.tid === team.id;
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
                      <div className="relative h-7 w-7 flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center">
                        <span className={`pl-pbadge pos-${p.p} text-[9px] font-bold`}>
                          {p.p}
                        </span>
                        {getPlayerPhoto(p.n) && (
                          <img
                            src={getPlayerPhoto(p.n)}
                            alt={p.n}
                            className="absolute inset-0 h-full w-full object-cover object-top"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
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
