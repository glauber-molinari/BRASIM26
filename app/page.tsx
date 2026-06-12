'use client';

import { useCallback, useRef, useState } from 'react';
import { MY_TEAM_ID } from '@/data/teams';
import { applyTactic, rollRandomLineup, buildLineupFromTactic } from '@/lib/lineup';
import {
  genSchedule,
  initStandings,
  simMatch,
  simMatchSegment,
  buildMatchResult,
  updateStandings,
  getTeamDisplay,
  setMyTeam,
} from '@/lib/simulator';
import { sleep } from '@/lib/helpers';
import type {
  GameStyle,
  LineupSlot,
  LivePhase,
  MatchEvent,
  MatchHistoryEntry,
  MatchResult,
  MatchSegment,
  Screen,
  SelectedPlayer,
  ShieldConfig,
  SimSpeed,
  Standing,
  StoredMatch,
  TacticKey,
} from '@/lib/types';
import { DEFAULT_SHIELD } from '@/lib/types';
import ScreenSetup from '@/components/ScreenSetup';
import ScreenBuild from '@/components/ScreenBuild';
import ScreenSim from '@/components/ScreenSim';
import ScreenResult from '@/components/ScreenResult';
import LiveOverlay from '@/components/LiveOverlay';

const STEPS: { id: Screen; label: string }[] = [
  { id: 'setup', label: 'Seu time' },
  { id: 'build', label: 'Escalação' },
  { id: 'sim', label: 'Simulação' },
  { id: 'result', label: 'Resultado' },
];

export default function Home() {
  const [screen, setScreen] = useState<Screen>('setup');
  const [shieldConfig, setShieldConfig] = useState<ShieldConfig>(DEFAULT_SHIELD);
  const [tactic, setTactic] = useState<TacticKey>('4-3-3');
  const [lineup, setLineup] = useState<LineupSlot[]>(() => buildLineupFromTactic('4-3-3'));
  const [teamUsage, setTeamUsage] = useState<Record<number, number>>({});
  const [diceSpinning, setDiceSpinning] = useState(false);
  const [activeTeamTab, setActiveTeamTab] = useState(0);
  const [gameStyle, setGameStyle] = useState<GameStyle>('normal');
  const [bench, setBench] = useState<(SelectedPlayer | null)[]>(() => Array(5).fill(null));

  const [schedule, setSchedule] = useState<[number, number][][]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [allMatches, setAllMatches] = useState<StoredMatch[]>([]);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([]);
  const [playerGoals, setPlayerGoals] = useState<Record<string, number>>({});
  const [viewRound, setViewRound] = useState(0);
  const [speed, setSpeed] = useState<SimSpeed>(700);
  const [running, setRunning] = useState(false);
  const [resumeRound, setResumeRound] = useState(0);

  const [liveVisible, setLiveVisible] = useState(false);
  const [pendingLive, setPendingLive] = useState(false);
  const [livePhase, setLivePhase] = useState<LivePhase>('pre');
  const [liveRound, setLiveRound] = useState(1);
  const [liveHome, setLiveHome] = useState(0);
  const [liveAway, setLiveAway] = useState(0);
  const [liveSeg1, setLiveSeg1] = useState<MatchSegment | null>(null);
  const [liveSeg2, setLiveSeg2] = useState<MatchSegment | null>(null);
  const [liveResult, setLiveResult] = useState<MatchResult | null>(null);
  const [liveStandings, setLiveStandings] = useState<Standing[]>([]);
  const [liveRoundMatches, setLiveRoundMatches] = useState<StoredMatch[]>([]);

  const continueResolveRef = useRef<(() => void) | null>(null);
  const abortSimRef = useRef(false);
  const resumeRoundRef = useRef(0);
  const liveResultRef = useRef<MatchResult | null>(null);
  const standingsBeforeLiveRef = useRef<Standing[]>([]);
  const seg1Ref = useRef<MatchSegment | null>(null);
  const seg2Ref = useRef<MatchSegment | null>(null);
  const userSubEventsRef = useRef<MatchEvent[]>([]);

  const stepIndex = screen === 'setup' ? 1 : screen === 'build' ? 2 : screen === 'sim' ? 3 : 4;

  const handleSetupConfirm = (name: string, short: string, shield: ShieldConfig) => {
    setMyTeam(name, short);
    setShieldConfig(shield);
    setScreen('build');
  };

  const handleTacticChange = (t: TacticKey) => {
    setTactic(t);
    const { lineup: newLU, teamUsage: usage } = applyTactic(t, lineup);
    setLineup(newLU);
    setTeamUsage(usage);
  };

  const handleLineupChange = (newLineup: LineupSlot[], usage: Record<number, number>) => {
    setLineup(newLineup);
    setTeamUsage(usage);
  };

  const handleRollRandom = () => {
    setDiceSpinning(true);
    setTimeout(() => {
      const rolled = rollRandomLineup();
      setTactic(rolled.tactic);
      setLineup(rolled.lineup);
      setTeamUsage(rolled.teamUsage);
      setActiveTeamTab(rolled.firstTeamTab);
      setBench(rolled.bench);
      setDiceSpinning(false);
    }, 600);
  };

  const handleStart = () => {
    if (lineup.filter((s) => s.player).length < 11) return;
    if (bench.filter(Boolean).length < 5) return;
    const sched = genSchedule();
    setSchedule(sched);
    setStandings(initStandings(sched));
    setAllMatches([]);
    setMatchHistory([]);
    setPlayerGoals({});
    setViewRound(0);
    setResumeRound(0);
    resumeRoundRef.current = 0;
    setScreen('sim');
    setRunning(false);
  };

  const waitForMatch = useCallback(
    (hId: number, aId: number, round: number) =>
      new Promise<void>((resolve) => {
        seg1Ref.current = null;
        seg2Ref.current = null;
        liveResultRef.current = null;
        userSubEventsRef.current = [];
        setLiveHome(hId);
        setLiveAway(aId);
        setLiveRound(round);
        setLiveSeg1(null);
        setLiveSeg2(null);
        setLiveResult(null);
        setLivePhase('pre');
        setLiveVisible(true);
        setPendingLive(true);
        continueResolveRef.current = resolve;
      }),
    []
  );

  // Usuário clica "Jogar Partida" — gera apenas o 1º tempo
  const handleLivePlay = useCallback(() => {
    const seg1 = simMatchSegment(liveHome, liveAway, lineup, gameStyle, 0, 45);
    seg1Ref.current = seg1;
    setLiveSeg1(seg1);
    setLivePhase('live1');
  }, [liveHome, liveAway, lineup, gameStyle]);

  // Animação do 1º tempo terminou → abre painel de intervalo
  const handleHalftimeReady = useCallback(() => {
    setLivePhase('halftime');
  }, []);

  // Usuário clica "Iniciar 2º Tempo" → gera 2º tempo com lineup/estilo atual
  const handleSecondHalfStart = useCallback(() => {
    const seg2 = simMatchSegment(liveHome, liveAway, lineup, gameStyle, 46, 94);
    seg2Ref.current = seg2;
    setLiveSeg2(seg2);
    setLivePhase('live2');
  }, [liveHome, liveAway, lineup, gameStyle]);

  // Animação do 2º tempo terminou → constrói resultado final e atualiza tabela
  const handleLiveComplete = useCallback(() => {
    const s1 = seg1Ref.current;
    const s2 = seg2Ref.current;
    if (s1 && s2) {
      const result = buildMatchResult(s1, s2);
      if (userSubEventsRef.current.length) {
        result.evs = [...result.evs, ...userSubEventsRef.current].sort((a, b) => a.min - b.min);
      }
      liveResultRef.current = result;
      setLiveResult(result);
      if (standingsBeforeLiveRef.current.length > 0) {
        setLiveStandings(
          updateStandings(standingsBeforeLiveRef.current, liveHome, liveAway, result.hG, result.aG)
        );
      }
    }
    setLivePhase('post');
  }, [liveHome, liveAway]);

  // Substituição durante live/intervalo
  const handleLiveSubstitute = useCallback(
    (slotIdx: number, newPlayer: SelectedPlayer, outPlayer: SelectedPlayer, minute: number) => {
      setLineup((prev) => prev.map((s, i) => (i === slotIdx ? { ...s, player: newPlayer } : s)));
      const isMyHome = liveHome === MY_TEAM_ID;
      userSubEventsRef.current = [
        ...userSubEventsRef.current,
        {
          min: minute,
          type: 'sub',
          team: isMyHome ? 'home' : 'away',
          player: outPlayer.n,
          playerIn: newPlayer.n,
          tshort: outPlayer.ts,
          isMy: true,
        },
      ];
    },
    [liveHome],
  );

  // Mudança de formação durante live/intervalo
  const handleLiveChangeTactic = useCallback((t: string) => {
    setTactic(t as TacticKey);
  }, []);

  // Mudança de estilo durante live/intervalo
  const handleLiveChangeStyle = useCallback((style: GameStyle) => {
    setGameStyle(style);
  }, []);

  const handleLiveContinue = () => {
    setLiveVisible(false);
    setLivePhase('pre');
    setPendingLive(false);
    continueResolveRef.current?.();
    continueResolveRef.current = null;
  };

  const handleLiveDismiss = () => {
    setLiveVisible(false);
  };

  const handleLiveResume = () => {
    setLiveVisible(true);
  };

  const handleLiveReset = () => {
    abortSimRef.current = true;
    setLiveVisible(false);
    setLivePhase('pre');
    setPendingLive(false);
    continueResolveRef.current?.();
    continueResolveRef.current = null;
    setRunning(false);
    setAllMatches([]);
    setStandings(schedule.length ? initStandings(schedule) : []);
    setMatchHistory([]);
    setPlayerGoals({});
    setViewRound(0);
    setResumeRound(0);
    resumeRoundRef.current = 0;
    setScreen('build');
  };

  const handleLiveEditLineup = () => {
    if (!liveResult) return;

    const myMatch: StoredMatch = {
      round: liveRound - 1,
      home: liveHome,
      away: liveAway,
      hG: liveResult.hG,
      aG: liveResult.aG,
      evs: liveResult.evs,
    };
    setAllMatches((prev) => [...prev, ...liveRoundMatches, myMatch]);
    setStandings(liveStandings);

    const hT = getTeamDisplay(liveHome);
    const aT = getTeamDisplay(liveAway);
    const myG = liveHome === MY_TEAM_ID ? liveResult.hG : liveResult.aG;
    const oppG = liveHome === MY_TEAM_ID ? liveResult.aG : liveResult.hG;
    const histEntry: MatchHistoryEntry = {
      round: liveRound,
      home: hT.short,
      away: aT.short,
      hG: liveResult.hG,
      aG: liveResult.aG,
      result: myG > oppG ? 'W' : myG < oppG ? 'L' : 'D',
    };
    setMatchHistory((prev) => [...prev, histEntry]);

    setPlayerGoals((prev) => {
      const updated = { ...prev };
      liveResult.evs
        .filter((e) => e.type === 'goal' && e.isMy)
        .forEach((e) => {
          updated[e.player] = (updated[e.player] ?? 0) + 1;
        });
      return updated;
    });

    abortSimRef.current = true;
    continueResolveRef.current?.();
    continueResolveRef.current = null;

    resumeRoundRef.current = liveRound;
    setResumeRound(liveRound);

    setLiveVisible(false);
    setLivePhase('pre');
    setPendingLive(false);
    setRunning(false);
    setScreen('build');
  };

  const handleContinueSim = () => {
    setScreen('sim');
    setTimeout(runSim, 0);
  };

  const runSim = async () => {
    if (running) return;

    const startRound = resumeRoundRef.current;
    const isResuming = startRound > 0;
    resumeRoundRef.current = 0;
    setResumeRound(0);

    abortSimRef.current = false;
    setRunning(true);

    const goals: Record<string, number> = {};
    lineup.filter((s) => s.player).forEach((s) => {
      goals[s.player!.n] = isResuming ? (playerGoals[s.player!.n] ?? 0) : 0;
    });
    if (!isResuming) setPlayerGoals(goals);

    let currentStandings = [...standings];
    let currentMatches = [...allMatches];
    let currentHistory = [...matchHistory];
    const sched = schedule.length ? schedule : genSchedule();

    for (let r = startRound; r < 38; r++) {
      setViewRound(r);
      const pairs = sched[r];

      // 1. Simulate all other matches first
      const roundOtherMatches: StoredMatch[] = [];
      for (const [hId, aId] of pairs) {
        if (hId === MY_TEAM_ID || aId === MY_TEAM_ID) continue;
        const res = simMatch(hId, aId, lineup, gameStyle);
        const sm: StoredMatch = { round: r, home: hId, away: aId, hG: res.hG, aG: res.aG, evs: [] };
        roundOtherMatches.push(sm);
        currentMatches = [...currentMatches, sm];
        currentStandings = updateStandings(currentStandings, hId, aId, res.hG, res.aG);
      }

      // 2. Now process My Team's match for this round
      for (const [hId, aId] of pairs) {
        if (hId !== MY_TEAM_ID && aId !== MY_TEAM_ID) continue;

        standingsBeforeLiveRef.current = currentStandings;
        setLiveRoundMatches(roundOtherMatches);
        await waitForMatch(hId, aId, r + 1);

        if (abortSimRef.current) {
          setRunning(false);
          return;
        }

        const res = liveResultRef.current;
        if (!res) { setRunning(false); return; }

        const standingsAfterMatch = updateStandings(currentStandings, hId, aId, res.hG, res.aG);

        currentMatches = [
          ...currentMatches,
          { round: r, home: hId, away: aId, hG: res.hG, aG: res.aG, evs: res.evs },
        ];
        currentStandings = standingsAfterMatch;

        res.evs
          .filter((e) => e.type === 'goal' && e.isMy)
          .forEach((e) => {
            if (goals[e.player] !== undefined) goals[e.player]++;
          });

        const hT = getTeamDisplay(hId);
        const aT = getTeamDisplay(aId);
        const myG = hId === MY_TEAM_ID ? res.hG : res.aG;
        const oppG = hId === MY_TEAM_ID ? res.aG : res.hG;
        currentHistory = [
          ...currentHistory,
          {
            round: r + 1,
            home: hT.short,
            away: aT.short,
            hG: res.hG,
            aG: res.aG,
            result: myG > oppG ? 'W' : myG < oppG ? 'L' : 'D',
          },
        ];
      }

      setAllMatches(currentMatches);
      setStandings(currentStandings);
      setMatchHistory(currentHistory);
      setPlayerGoals({ ...goals });
      await sleep(20);
    }

    setRunning(false);
    setScreen('result');
  };

  const handleRestart = () => {
    const empty = buildLineupFromTactic(tactic);
    setLineup(empty);
    setTeamUsage({});
    setBench(Array(5).fill(null));
    setSchedule([]);
    setStandings([]);
    setAllMatches([]);
    setMatchHistory([]);
    setPlayerGoals({});
    setViewRound(0);
    setRunning(false);
    setResumeRound(0);
    resumeRoundRef.current = 0;
    setScreen('build');
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="flex flex-col border-b border-[var(--border2)]"
        style={{ background: 'linear-gradient(135deg, var(--green-dark), var(--bg) 60%)' }}
      >
        <div className="flex items-center justify-center gap-1.5 border-b border-[var(--border2)]/40 px-5 py-1.5 text-center text-sm text-[var(--text2)]">
          <span>⚽ Jogue Grátis</span>
          <span className="text-[var(--border2)]">·</span>
          <span>
            Se quiser, apoie o criador via Pix:{' '}
            <button
              onClick={() => {
                navigator.clipboard.writeText('glaubermolinarids@gmail.com');
              }}
              className="font-semibold text-[var(--green-light)] transition-opacity hover:opacity-80 active:opacity-60"
              title="Clique para copiar a chave Pix"
            >
              glaubermolinarids@gmail.com
            </button>
            <span className="ml-1 text-[var(--text3)]">(clique para copiar)</span>
          </span>
        </div>

        <div className="flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-6 sm:py-4">
          <span className="text-xl sm:text-2xl">⚽</span>
          <h1 className="font-condensed text-xl font-black uppercase tracking-wide text-white sm:text-3xl">
            BRA<span className="text-[var(--green-light)]">26</span>
          </h1>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
            {STEPS.map((s, i) => (
              <span key={s.id} className="flex items-center gap-1 sm:gap-2">
                {i > 0 && <span className="text-[var(--border2)]">›</span>}
                <span
                  className={`flex items-center gap-1 transition-colors sm:gap-1.5 ${
                    i + 1 < stepIndex
                      ? 'text-[var(--text3)]'
                      : i + 1 === stepIndex
                        ? 'text-[var(--green-light)]'
                        : 'text-[var(--text3)]'
                  }`}
                >
                  <span
                    className={`h-[7px] w-[7px] shrink-0 rounded-full border ${
                      i + 1 < stepIndex
                        ? 'border-[var(--green)] bg-[var(--green-dark)]'
                        : i + 1 === stepIndex
                          ? 'border-[var(--green-light)] bg-[var(--green-light)]'
                          : 'border-[var(--border2)] bg-[var(--bg3)]'
                    }`}
                  />
                  <span className="hidden text-xs sm:inline sm:text-sm">{s.label}</span>
                </span>
              </span>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1100px] flex-1 items-center px-3 py-4 sm:px-6 sm:py-5">
        <div className="w-full">
        {screen === 'setup' && (
          <ScreenSetup onConfirm={handleSetupConfirm} />
        )}

        {screen === 'build' && (
          <ScreenBuild
            lineup={lineup}
            tactic={tactic}
            teamUsage={teamUsage}
            onTacticChange={handleTacticChange}
            onLineupChange={handleLineupChange}
            onStart={handleStart}
            onRollRandom={handleRollRandom}
            diceSpinning={diceSpinning}
            activeTeamTab={activeTeamTab}
            bench={bench}
            onBenchChange={setBench}
            gameStyle={gameStyle}
            onGameStyleChange={setGameStyle}
            isContinuing={resumeRound > 0}
            currentRound={resumeRound}
            onContinueSim={handleContinueSim}
            speed={speed}
            onSpeedChange={setSpeed}
          />
        )}

        {screen === 'sim' && (
          <ScreenSim
            schedule={schedule}
            allMatches={allMatches}
            standings={standings}
            lineup={lineup}
            playerGoals={playerGoals}
            viewRound={viewRound}
            speed={speed}
            running={running}
            pendingLive={pendingLive}
            shieldConfig={shieldConfig}
            onSpeedChange={setSpeed}
            onStart={runSim}
            onBack={() => setScreen('build')}
            onRoundChange={(dir) =>
              setViewRound((v) => Math.max(0, Math.min(37, v + dir)))
            }
            onResumeLive={handleLiveResume}
          />
        )}

        {screen === 'result' && (
          <ScreenResult
            standings={standings}
            lineup={lineup}
            playerGoals={playerGoals}
            matchHistory={matchHistory}
            shieldConfig={shieldConfig}
            onRestart={handleRestart}
          />
        )}
        </div>
      </main>

      <LiveOverlay
        visible={liveVisible}
        phase={livePhase}
        round={liveRound}
        homeId={liveHome}
        awayId={liveAway}
        seg1={liveSeg1}
        seg2={liveSeg2}
        result={liveResult}
        speed={speed}
        lineup={lineup}
        bench={bench}
        currentTactic={tactic}
        currentStyle={gameStyle}
        onPlay={handleLivePlay}
        onHalftimeReady={handleHalftimeReady}
        onSecondHalfStart={handleSecondHalfStart}
        onLiveComplete={handleLiveComplete}
        onContinue={handleLiveContinue}
        onReset={handleLiveReset}
        onEditLineup={handleLiveEditLineup}
        onDismiss={handleLiveDismiss}
        onSubstitute={handleLiveSubstitute}
        onChangeTactic={handleLiveChangeTactic}
        onChangeStyle={handleLiveChangeStyle}
        standings={liveStandings}
        roundMatches={liveRoundMatches}
        shieldConfig={shieldConfig}
      />
    </div>
  );
}
