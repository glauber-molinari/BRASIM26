'use client';

import { useCallback, useRef, useState } from 'react';
import { MY_TEAM_ID } from '@/data/teams';
import { applyTactic, rollRandomLineup, buildLineupFromTactic } from '@/lib/lineup';
import {
  genSchedule,
  initStandings,
  simMatch,
  updateStandings,
  getTeamDisplay,
  setMyTeam,
} from '@/lib/simulator';
import { sleep } from '@/lib/helpers';
import type {
  GameStyle,
  LineupSlot,
  LivePhase,
  MatchHistoryEntry,
  MatchResult,
  Screen,
  SelectedPlayer,
  SimSpeed,
  Standing,
  StoredMatch,
  TacticKey,
} from '@/lib/types';
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
  const [speed, setSpeed] = useState<SimSpeed>(250);
  const [running, setRunning] = useState(false);
  const [resumeRound, setResumeRound] = useState(0);

  const [liveVisible, setLiveVisible] = useState(false);
  const [pendingLive, setPendingLive] = useState(false);
  const [livePhase, setLivePhase] = useState<LivePhase>('pre');
  const [liveRound, setLiveRound] = useState(1);
  const [liveHome, setLiveHome] = useState(0);
  const [liveAway, setLiveAway] = useState(0);
  const [liveResult, setLiveResult] = useState<MatchResult | null>(null);
  const [liveStandings, setLiveStandings] = useState<Standing[]>([]);
  const [liveRoundMatches, setLiveRoundMatches] = useState<StoredMatch[]>([]);

  const continueResolveRef = useRef<(() => void) | null>(null);
  const abortSimRef = useRef(false);
  const resumeRoundRef = useRef(0);

  const stepIndex = screen === 'setup' ? 1 : screen === 'build' ? 2 : screen === 'sim' ? 3 : 4;

  const handleSetupConfirm = (name: string, short: string) => {
    setMyTeam(name, short);
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
    (hId: number, aId: number, round: number, result: MatchResult) =>
      new Promise<void>((resolve) => {
        setLiveHome(hId);
        setLiveAway(aId);
        setLiveRound(round);
        setLiveResult(result);
        setLivePhase('pre');
        setLiveVisible(true);
        setPendingLive(true);
        continueResolveRef.current = resolve;
      }),
    []
  );

  const handleLivePlay = () => {
    setLivePhase('live');
  };

  const handleLiveComplete = useCallback(() => {
    setLivePhase('post');
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

        const res = simMatch(hId, aId, lineup, gameStyle);
        const standingsAfterMatch = updateStandings(currentStandings, hId, aId, res.hG, res.aG);
        setLiveStandings(standingsAfterMatch);
        setLiveRoundMatches(roundOtherMatches);
        await waitForMatch(hId, aId, r + 1, res);

        if (abortSimRef.current) {
          setRunning(false);
          return;
        }

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
    <>
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

      <main className="mx-auto max-w-[1100px] px-3 py-4 sm:px-6 sm:py-5">
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
            onRestart={handleRestart}
          />
        )}
      </main>

      <LiveOverlay
        visible={liveVisible}
        phase={livePhase}
        round={liveRound}
        homeId={liveHome}
        awayId={liveAway}
        result={liveResult}
        speed={speed}
        lineup={lineup}
        onPlay={handleLivePlay}
        onLiveComplete={handleLiveComplete}
        onContinue={handleLiveContinue}
        onReset={handleLiveReset}
        onEditLineup={handleLiveEditLineup}
        onDismiss={handleLiveDismiss}
        standings={liveStandings}
        roundMatches={liveRoundMatches}
      />
    </>
  );
}
