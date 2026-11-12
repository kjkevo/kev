"use client";

/* eslint-disable @next/next/no-img-element -- small static character art */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import type { TutorialGame } from "@/lib/tutorial";

/**
 * A video-game style walkthrough: the game is paused on a practice screen,
 * one thing at a time is circled with an arrow pointing at it, and the
 * player taps it (or Next) to go on. A progress bar shows how much is left,
 * and "Exit tutorial" leaves any time. Written for a 5th grader.
 */

type Step = {
  id: string;
  /** data-tut name of the thing to circle; none = a card in the middle. */
  target?: string;
  say: string;
  sub?: string;
  /** The player must tap the circled thing to go on. */
  tap?: boolean;
  button?: string;
  round?: boolean;
};

const CHAR_IMG = "/avatars/jungle-scout-icon.png";

type GameInfo = {
  title: string;
  power: { name: string; how: string };
  perk: { name: string; how: string };
  steps: Step[];
  Demo: (p: { done: Set<string> }) => React.ReactElement;
};

function intro(title: string, power: GameInfo["power"], perk: GameInfo["perk"]): Step[] {
  return [
    { id: "welcome", say: `Welcome to ${title}!`, sub: "Let's learn how to play. It's quick!", button: "Start" },
    { id: "char", target: "char", tap: true, say: "This is you!", sub: "Tap your character." },
    { id: "charInfo", target: "char", say: "You can pick a new character.", sub: "Each one has its own power." },
    { id: "power", target: "power", say: "This is your power!", sub: `${power.name}: ${power.how}` },
    { id: "powerInfo", target: "power", say: "Use it 1 time each game.", sub: "Save it for a big moment!" },
    { id: "perk", target: "perk", say: "This is a perk!", sub: `${perk.name}: ${perk.how}` },
    { id: "perkInfo", target: "perk", say: "Level up to get more perks.", sub: "You pick 1 perk each game." },
    { id: "xp", target: "xp", tap: true, say: "This is your XP bar.", sub: "Tap it!" },
    { id: "xpInfo", target: "xp", say: "Play games to earn XP.", sub: "Fill the bar to level up. Wins earn more!" },
  ];
}

const outro: Step = { id: "ready", say: "You're ready!", sub: "Play Solo, or play with friends.", button: "Let's play!" };

// ---------------------------------------------------------------- Shared demo frame

function Frame({ done, children, powerLabel, perkLabel, powerUsed, perkUsed }: {
  done: Set<string>;
  children: React.ReactNode;
  powerLabel: string;
  perkLabel: string;
  powerUsed?: boolean;
  perkUsed?: boolean;
}) {
  const leveled = done.has("xp");
  return (
    <div className="absolute inset-0 flex flex-col items-center px-3 pt-24 pb-4 gap-3 bg-gradient-to-b from-indigo-950 via-purple-950 to-black text-white">
      <div className="w-full max-w-md flex items-center gap-2">
        <div data-tut="char" className={`flex items-center gap-2 rounded-2xl border px-2 py-1.5 ${done.has("char") ? "bg-amber-400/20 border-amber-400" : "bg-white/5 border-white/10"}`}>
          <img src={CHAR_IMG} alt="" className={`w-10 h-10 rounded-full bg-black/30 ${done.has("char") ? "animate-bounce" : ""}`} />
          <span className="text-base font-black">You</span>
        </div>
        <div data-tut="xp" className="flex-1 rounded-2xl bg-white/5 border border-white/10 px-2 py-1.5">
          <div className="flex items-center justify-between text-sm font-black">
            <span className="text-amber-300">Level {leveled ? 2 : 1}</span>
            {leveled && <span className="text-emerald-300 animate-pulse">Level up!</span>}
          </div>
          <div className="mt-1 h-3 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-amber-400 transition-all duration-1000" style={{ width: leveled ? "100%" : "55%" }} />
          </div>
        </div>
      </div>
      <div className="w-full max-w-md flex-1 flex flex-col items-center justify-center gap-3">{children}</div>
      <div className="w-full max-w-md grid grid-cols-2 gap-2">
        <div data-tut="power" className={`rounded-2xl border px-3 py-2.5 text-lg font-bold flex items-center justify-center gap-1.5 ${powerUsed ? "bg-white/5 border-white/5 text-slate-400" : "bg-violet-500/20 border-violet-400/60"}`}>
          <Icon name="bolt" size={18} /> {powerUsed ? "Power used" : powerLabel}
        </div>
        <div data-tut="perk" className={`rounded-2xl border px-3 py-2.5 text-lg font-bold flex items-center justify-center gap-1.5 ${perkUsed ? "bg-white/5 border-white/5 text-slate-400" : "bg-emerald-500/20 border-emerald-400/60"}`}>
          <Icon name="star" size={18} /> {perkUsed ? "Perk used" : perkLabel}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Trivia

const TRIVIA: GameInfo = {
  title: "Trivia",
  power: { name: "Trailblaze", how: "Removes 2 wrong answers" },
  perk: { name: "Time Freeze", how: "+10 seconds" },
  steps: [],
  Demo: ({ done }) => {
    const answers = ["Mars", "Venus", "Jupiter", "Pluto"];
    const removed = done.has("tUsePower") ? ["Venus", "Pluto"] : [];
    const right = done.has("tAnswer");
    return (
      <Frame done={done} powerLabel="Trailblaze" perkLabel="Time Freeze" powerUsed={done.has("tUsePower")} perkUsed={done.has("tPerk")}>
        <div className="w-full flex items-center justify-between">
          <div data-tut="score" className="rounded-full bg-white/10 px-3 py-1 text-lg font-black">{right ? 1100 : 1000} points</div>
          <div data-tut="timer" className="w-14 h-14 rounded-full border-4 border-amber-400 flex items-center justify-center text-2xl font-black">
            {done.has("tPerk") ? 22 : 12}
          </div>
        </div>
        <div data-tut="question" className="w-full rounded-2xl bg-white/10 px-4 py-4 text-2xl font-black text-center">Which planet is the biggest?</div>
        <div className="w-full grid grid-cols-2 gap-2">
          {answers.map((a) => (
            <div
              key={a}
              data-tut={a === "Jupiter" ? "answer" : undefined}
              className={`rounded-2xl px-3 py-4 text-xl font-black text-center transition ${
                removed.includes(a) ? "opacity-20 line-through bg-white/5" : right && a === "Jupiter" ? "bg-emerald-400 text-black" : "bg-indigo-500/40 border border-indigo-300/40"
              }`}
            >
              {a}
            </div>
          ))}
        </div>
        {right && <p className="text-2xl font-black text-emerald-300">Correct! +100</p>}
      </Frame>
    );
  },
};
TRIVIA.steps = [
  ...intro("Trivia", TRIVIA.power, TRIVIA.perk),
  { id: "tQuestion", target: "question", say: "Read the question.", sub: "Then pick an answer." },
  { id: "tTimer", target: "timer", say: "Watch the clock!", sub: "Fast answers get more points.", round: true },
  { id: "tUsePower", target: "power", tap: true, say: "Not sure? Use your power!", sub: "Tap Trailblaze." },
  { id: "tAnswer", target: "answer", tap: true, say: "2 wrong answers are gone!", sub: "Now tap the right one." },
  { id: "tScore", target: "score", say: "Your points went up!", sub: "Most points at the end wins." },
  { id: "tPerk", target: "perk", tap: true, say: "Need more time?", sub: "Tap your perk." },
  { id: "tPerkDone", target: "timer", say: "+10 seconds!", sub: "Perks help when you need it.", round: true },
  outro,
];

// ---------------------------------------------------------------- Bingo

const CARD = [7, 22, 40, 55, 70, 3, 18, 39, 53, 64, 12, 25, 0, 51, 68, 9, 16, 42, 60, 74, 11, 23, 44, 54, 71];
const BINGO: GameInfo = {
  title: "Bingo",
  power: { name: "Trailblaze", how: "Marks 3 numbers for you" },
  perk: { name: "Sneak Peek", how: "See the next number" },
  steps: [],
  Demo: ({ done }) => {
    const marked = new Set<number>([12]);
    if (done.has("bMark")) marked.add(10);
    if (done.has("bPower")) [11, 13].forEach((i) => marked.add(i));
    if (done.has("bLast")) marked.add(14);
    const ball = done.has("bPeek") ? 68 : 12;
    const won = done.has("bBingo");
    return (
      <Frame done={done} powerLabel="Trailblaze" perkLabel="Sneak Peek" powerUsed={done.has("bPower")} perkUsed={done.has("bPeek")}>
        <div className="flex items-center gap-3">
          <div data-tut="ball" className="w-16 h-16 rounded-full bg-amber-400 text-black flex flex-col items-center justify-center">
            <span className="text-lg font-black leading-none">{ball > 60 ? "O" : "B"}</span>
            <span className="text-3xl font-black leading-none">{ball}</span>
          </div>
          {done.has("bPeek") && !done.has("bLast") && <p className="rounded-full bg-sky-500/20 border border-sky-400/50 px-3 py-1 text-lg font-bold">Next: O 68</p>}
        </div>
        <div className="w-full max-w-[15.5rem] grid grid-cols-5 gap-1">
          {CARD.map((n, i) => (
            <div
              key={i}
              data-tut={i === 10 ? "sq12" : i === 14 ? "sq68" : undefined}
              className={`aspect-square rounded-lg flex items-center justify-center text-lg font-black ${
                marked.has(i) ? "bg-amber-400 text-black" : "bg-white/[0.08]"
              } ${i >= 10 && i <= 14 && done.has("bPower") ? "ring-2 ring-emerald-300" : ""}`}
            >
              {i === 12 ? <span className="text-xs">FREE</span> : n}
            </div>
          ))}
        </div>
        <div data-tut="bingo" className={`w-full rounded-2xl py-3 text-2xl font-black text-center ${done.has("bLast") ? "bg-emerald-400 text-black animate-pulse" : "bg-white/10 text-white/40"}`}>
          {won ? "You win!" : "BINGO!"}
        </div>
      </Frame>
    );
  },
};
BINGO.steps = [
  ...intro("Bingo", BINGO.power, BINGO.perk),
  { id: "bBall", target: "ball", say: "Numbers get called here.", sub: "A new one every few seconds.", round: true },
  { id: "bMark", target: "sq12", tap: true, say: "12 was called!", sub: "Find it on your card. Tap it!" },
  { id: "bPower", target: "power", tap: true, say: "Use your power!", sub: "It marks numbers for you." },
  { id: "bRow", target: "sq68", say: "Get 5 in a row to win!", sub: "You need just 1 more: 68." },
  { id: "bPeek", target: "perk", tap: true, say: "Tap your perk to see what's next.", sub: "Sneak Peek!" },
  { id: "bLast", target: "sq68", tap: true, say: "68 was called!", sub: "Tap it!" },
  { id: "bBingo", target: "bingo", tap: true, say: "5 in a row!", sub: "Tap BINGO! fast!" },
  { id: "bWon", target: "bingo", say: "You win!", sub: "First to call BINGO! wins." },
  outro,
];

// ---------------------------------------------------------------- Wild Match

const WM_COLOR: Record<string, string> = { red: "bg-rose-500", blue: "bg-sky-500", green: "bg-emerald-500", yellow: "bg-amber-400" };
const WILD: GameInfo = {
  title: "Wild Match",
  power: { name: "Trailblaze", how: "Play any card next" },
  perk: { name: "Color Call", how: "Pick the color" },
  steps: [],
  Demo: ({ done }) => {
    let top = { c: "blue", n: "5" };
    if (done.has("wPlay")) top = { c: "blue", n: "2" };
    if (done.has("wAny")) top = { c: "red", n: "9" };
    const color = done.has("wPerk") ? "green" : top.c;
    const hand = [
      { k: "b2", c: "blue", n: "2", gone: done.has("wPlay") },
      { k: "r9", c: "red", n: "9", gone: done.has("wAny") },
      { k: "y7", c: "yellow", n: "7", gone: false },
      { k: "g4", c: "green", n: "4", gone: false },
    ];
    if (done.has("wDraw")) hand.push({ k: "g1", c: "green", n: "1", gone: false });
    return (
      <Frame done={done} powerLabel="Trailblaze" perkLabel="Color Call" powerUsed={done.has("wPower")} perkUsed={done.has("wPerk")}>
        <div className="flex items-center gap-5">
          <div data-tut="pile" className="flex flex-col items-center gap-1">
            <div className={`w-20 h-28 rounded-2xl border-4 border-white/90 ${WM_COLOR[top.c]} flex items-center justify-center text-4xl font-black`}>{top.n}</div>
            <span className={`rounded-full px-3 py-0.5 text-base font-black text-black capitalize ${WM_COLOR[color]}`}>{color}</span>
          </div>
          <div data-tut="draw" className="w-20 h-28 rounded-2xl border-4 border-white/70 bg-slate-800 flex flex-col items-center justify-center gap-1">
            <Icon name="cards" size={28} />
            <span className="text-xl font-black">Draw</span>
          </div>
        </div>
        <div data-tut="hand" className="flex flex-wrap justify-center gap-2 px-1">
          {hand
            .filter((h) => !h.gone)
            .map((h) => (
              <div key={h.k} data-tut={`card-${h.k}`} className={`w-14 h-20 rounded-2xl border-4 border-white/90 ${WM_COLOR[h.c]} flex items-center justify-center text-2xl font-black`}>
                {h.n}
              </div>
            ))}
        </div>
      </Frame>
    );
  },
};
WILD.steps = [
  ...intro("Wild Match", WILD.power, WILD.perk),
  { id: "wPile", target: "pile", say: "This is the pile.", sub: "Match its color or number." },
  { id: "wPlay", target: "card-b2", tap: true, say: "Blue matches blue!", sub: "Tap the blue card." },
  { id: "wDraw", target: "draw", tap: true, say: "No match? Draw a card.", sub: "Tap Draw." },
  { id: "wPower", target: "power", tap: true, say: "Use your power!", sub: "Then you can play any card." },
  { id: "wAny", target: "card-r9", tap: true, say: "Red on blue? Yes!", sub: "Tap the red card." },
  { id: "wPerk", target: "perk", tap: true, say: "Tap your perk!", sub: "You pick the next color." },
  { id: "wWin", target: "hand", say: "Play all your cards first to win!", sub: "Fewest cards is winning." },
  outro,
];

// ---------------------------------------------------------------- Drop Line

const DROP: GameInfo = {
  title: "Drop Line",
  power: { name: "Trailblaze", how: "Knock off a top piece" },
  perk: { name: "Extra Time", how: "+15 seconds" },
  steps: [],
  Demo: ({ done }) => {
    // board[row][col], row 0 = bottom. 1 gold (you), 2 blue (them).
    const b: number[][] = Array.from({ length: 6 }, () => Array(7).fill(0));
    b[0][0] = 1; b[0][1] = 1; b[0][4] = 2; b[1][4] = 2; b[0][5] = 2; b[0][3] = 2;
    if (done.has("dDrop")) b[0][2] = 1;
    if (done.has("dPower")) b[0][3] = 0;
    if (done.has("dWin")) b[0][3] = 1;
    const won = done.has("dWin");
    return (
      <Frame done={done} powerLabel="Trailblaze" perkLabel="Extra Time" powerUsed={done.has("dPower")} perkUsed={done.has("dPerk")}>
        <div className="flex items-center gap-3">
          <div data-tut="turn" className="rounded-full bg-amber-400 text-black px-5 py-1.5 text-xl font-black">
            {won ? "You win!" : `Your turn! ${done.has("dPerk") ? 30 : 15}`}
          </div>
        </div>
        <div data-tut="board" className="w-full max-w-[19rem] rounded-3xl bg-indigo-700 border-4 border-indigo-400/60 p-1.5">
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, c) => (
              <div key={c} data-tut={`col${c}`} className="flex flex-col gap-1 rounded-xl p-0.5">
                {Array.from({ length: 6 }, (_, i) => {
                  const v = b[5 - i][c];
                  return (
                    <span
                      key={i}
                      className={`aspect-square w-full rounded-full ${v === 1 ? "bg-amber-400" : v === 2 ? "bg-sky-400" : "bg-indigo-950/80"} ${
                        won && 5 - i === 0 && c <= 3 ? "ring-2 ring-white" : ""
                      }`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </Frame>
    );
  },
};
DROP.steps = [
  ...intro("Drop Line", DROP.power, DROP.perk),
  { id: "dBoard", target: "board", say: "This is the board.", sub: "You are gold. They are blue." },
  { id: "dDrop", target: "col2", tap: true, say: "Tap a column to drop a piece.", sub: "Tap here!" },
  { id: "dGoal", target: "board", say: "Get 4 in a row to win!", sub: "Across, up, or slanted." },
  { id: "dPower", target: "power", tap: true, say: "A blue piece is in your way!", sub: "Tap your power to knock it off." },
  { id: "dPerk", target: "perk", tap: true, say: "Need more time?", sub: "Tap your perk." },
  { id: "dWin", target: "col3", tap: true, say: "Now drop here!", sub: "Make 4 in a row." },
  { id: "dWon", target: "turn", say: "4 in a row. You win!", sub: "Block them so they can't win first." },
  outro,
];

const GAMES: Record<TutorialGame, GameInfo> = { trivia: TRIVIA, bingo: BINGO, "wild-match": WILD, "drop-line": DROP };

// ---------------------------------------------------------------- The walkthrough

export function GameTutorial({ game, onClose }: { game: TutorialGame; onClose: () => void }) {
  const info = GAMES[game];
  const steps = info.steps;
  const [i, setI] = useState(0);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [rect, setRect] = useState<DOMRect | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const step = steps[i];
  const Demo = info.Demo;

  const measure = useCallback(() => {
    if (!step.target || !box.current) {
      setRect(null);
      return;
    }
    const el = box.current.querySelector(`[data-tut="${step.target}"]`);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step.target]);

  useLayoutEffect(() => {
    measure();
    const t = setTimeout(measure, 350);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [measure, i, done]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const next = useCallback(() => {
    setDone((d) => new Set(d).add(step.id));
    if (i + 1 >= steps.length) onClose();
    else setI(i + 1);
  }, [i, step.id, steps.length, onClose]);

  const pad = 8;
  const hole = rect
    ? { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : null;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const bubbleAtBottom = hole ? hole.top + hole.height / 2 < vh * 0.5 : false;
  const arrowAbove = hole ? hole.top > 140 : true;
  const progress = Math.round(((i + 1) / steps.length) * 100);

  const bubble = useMemo(
    () => (
      <div className="w-full max-w-md rounded-3xl bg-white text-slate-900 px-5 py-4 shadow-2xl text-center tut-pop">
        <p className="text-2xl font-black leading-tight">{step.say}</p>
        {step.sub && <p className="mt-1 text-lg font-bold text-slate-600">{step.sub}</p>}
        {step.tap ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-1.5 text-lg font-black text-amber-700">
            <Icon name="hand" size={20} /> Tap the circle
          </p>
        ) : (
          <button onClick={next} className="mt-3 w-full rounded-2xl bg-amber-400 py-3 text-2xl font-black text-black active:scale-95 transition">
            {step.button ?? "Next"}
          </button>
        )}
      </div>
    ),
    [step, next]
  );

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-label={`${info.title} tutorial`}>
      {/* The paused practice screen. */}
      <div ref={box} className="absolute inset-0">
        <Demo done={done} />
      </div>

      {/* Blocks taps everywhere except the circle. */}
      <div className="absolute inset-0" />

      {/* Darkens the screen, with a hole around the thing to look at. */}
      {hole ? (
        <div
          className={`absolute pointer-events-none ${step.round ? "rounded-full" : "rounded-3xl"} transition-all duration-300`}
          style={{ ...hole, boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.8)" }}
        >
          <span className={`absolute -inset-1 ${step.round ? "rounded-full" : "rounded-3xl"} border-4 border-amber-300 animate-pulse shadow-[0_0_24px_rgba(252,211,77,0.8)]`} />
        </div>
      ) : (
        <div className="absolute inset-0 bg-slate-950/85" />
      )}

      {/* Arrow pointing at it. */}
      {hole && (
        <div
          className="absolute pointer-events-none text-amber-300 animate-bounce drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]"
          style={{
            left: hole.left + hole.width / 2 - 24,
            top: arrowAbove ? hole.top - 56 : hole.top + hole.height + 8,
          }}
        >
          <Icon name="down" size={48} strokeWidth={3} className={arrowAbove ? "" : "rotate-180"} />
        </div>
      )}

      {/* Tap the circle to go on. */}
      {hole && step.tap && (
        <button aria-label="Tap here" onClick={next} className="absolute rounded-3xl" style={hole} />
      )}

      {/* What to do. */}
      {hole ? (
        <div className={`absolute left-0 right-0 px-4 flex justify-center pointer-events-auto ${bubbleAtBottom ? "bottom-5" : "top-20"}`}>{bubble}</div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4">
          <img src={CHAR_IMG} alt="" className="w-32 h-32 rounded-full bg-black/30 border-4 border-amber-300 animate-bounce" />
          {bubble}
        </div>
      )}

      {/* Progress and the way out. */}
      <div className="absolute top-0 left-0 right-0 px-4 pt-3 flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between text-sm font-black text-white">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 text-black px-2 py-0.5">
              <Icon name="clock" size={14} /> Paused
            </span>
            <span>
              {i + 1} of {steps.length}
            </span>
          </div>
          <div className="mt-1.5 h-3 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full rounded-full bg-amber-400 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <button onClick={onClose} className="shrink-0 rounded-full bg-white/15 border border-white/30 px-3 py-2 text-base font-black text-white">
          Exit tutorial
        </button>
      </div>
    </div>
  );
}
