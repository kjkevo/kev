"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { BINGO_FREE, BINGO_LINES, BINGO_PROMPTS, bingoLine, randomBingoCard, squaresToBingo } from "@/lib/bingoPrompts";

/**
 * Social Bingo, played out at a pretend bar night: nine regulars (one per
 * character) work their cards, the TV board shows who did what, and you
 * play your own card alongside them. Nothing here touches a real game;
 * it all runs in the browser.
 */

const BAR = "The Copper Lantern";
const ROUND_SECONDS = 300;
const SIM_STEP_MS = 1500;
const WIN_SHOW_MS = 7000;

type Player = { id: string; name: string; avatar: string; card: string[]; marked: boolean[]; target: number[]; wins: number };
type FeedItem = { key: number; playerId: string; text: string };

const CAST: { id: string; name: string; avatar: string }[] = [
  { id: "maya", name: "Maya", avatar: "jungle-scout" },
  { id: "jordan", name: "Jordan", avatar: "crystal-titan" },
  { id: "priya", name: "Priya", avatar: "sylvan-entity" },
  { id: "sam", name: "Sam", avatar: "stone-golem" },
  { id: "luis", name: "Luis", avatar: "model-z" },
  { id: "tash", name: "Tash", avatar: "forest-guardian" },
  { id: "ben", name: "Ben", avatar: "alien-buddy" },
  { id: "kenji", name: "Kenji", avatar: "void-walker" },
  { id: "ava", name: "Ava", avatar: "geo-sphinx" },
];
const ME = { id: "me", name: "You", avatar: "jungle-scout" };
const img = (avatar: string) => `/avatars/${avatar}-256.png`;

function freshPlayer(base: { id: string; name: string; avatar: string }, wins = 0): Player {
  const card = randomBingoCard();
  const marked = card.map((t) => t === BINGO_FREE);
  // Each pretend player quietly works toward one line, like real people do.
  const target = BINGO_LINES[Math.floor(Math.random() * BINGO_LINES.length)];
  return { ...base, card, marked, target, wins };
}

function freshTable(prev?: Player[]): Player[] {
  return [ME, ...CAST].map((b) => freshPlayer(b, prev?.find((p) => p.id === b.id)?.wins ?? 0));
}

export default function BingoDemoClient() {
  // Cards are dealt in the browser (random cards would differ from the server render).
  const [players, setPlayers] = useState<Player[]>([]);
  useEffect(() => setPlayers(freshTable()), []);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [round, setRound] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [winner, setWinner] = useState<{ player: Player; line: number[] } | null>(null);
  const [paused, setPaused] = useState(false);
  const feedKey = useRef(0);

  const playersRef = useRef(players);
  playersRef.current = players;
  const winnerRef = useRef(winner);
  winnerRef.current = winner;

  function mark(playerId: string, index: number) {
    if (winnerRef.current) return;
    const p = playersRef.current.find((x) => x.id === playerId);
    if (!p || p.marked[index]) return;
    const marked = p.marked.map((m, i) => (i === index ? true : m));
    const updated = { ...p, marked };
    setPlayers((all) => all.map((x) => (x.id === playerId ? updated : x)));
    setFeed((f) => [...f.slice(-30), { key: ++feedKey.current, playerId, text: p.card[index] }]);
    const line = bingoLine(marked);
    if (line) {
      const won = { ...updated, wins: updated.wins + 1 };
      setPlayers((all) => all.map((x) => (x.id === playerId ? won : x)));
      setWinner({ player: won, line });
    }
  }

  // The bar: every moment or so, someone finishes a square.
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      if (winnerRef.current || playersRef.current.length === 0) return;
      const sims = playersRef.current.filter((p) => p.id !== "me");
      const p = sims[Math.floor(Math.random() * sims.length)];
      const open = p.marked.map((m, i) => (m ? -1 : i)).filter((i) => i >= 0);
      const onTarget = p.target.filter((i) => !p.marked[i]);
      const pick = onTarget.length && Math.random() < 0.55 ? onTarget : open;
      if (pick.length) mark(p.id, pick[Math.floor(Math.random() * pick.length)]);
    }, SIM_STEP_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mark reads refs
  }, [paused]);

  // The round clock.
  useEffect(() => {
    if (paused || winner) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [paused, winner]);

  // After a Bingo (or when time runs out): new cards, next round.
  useEffect(() => {
    if (!winner && secondsLeft > 0) return;
    const t = setTimeout(() => {
      setPlayers((all) => freshTable(all));
      setFeed([]);
      setWinner(null);
      setSecondsLeft(ROUND_SECONDS);
      setRound((r) => r + 1);
    }, winner ? WIN_SHOW_MS : 3000);
    return () => clearTimeout(t);
  }, [winner, secondsLeft]);

  const me = players.find((p) => p.id === "me");
  if (!me) return <main className="min-h-screen bg-black" />;
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const board = [...players]
    .map((p) => ({ p, done: p.marked.filter(Boolean).length - 1, away: squaresToBingo(p.marked) }))
    .sort((a, b) => a.away - b.away || b.done - a.done);
  const clock = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const myAway = squaresToBingo(me.marked);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#1a0f08] via-[#120a06] to-black text-white px-4 py-4">
      <div className="max-w-6xl mx-auto flex flex-col gap-4">
        <header className="flex flex-wrap items-center gap-3">
          <Link href="/" className="text-sm text-slate-400 hover:text-white">‹ Slimpse</Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black">
              Social <span className="text-amber-400">Bingo</span>
              <span className="ml-2 align-middle rounded-full bg-amber-400 text-black text-[11px] font-black px-2 py-0.5">DEMO</span>
            </h1>
            <p className="text-sm text-amber-100/70">
              A pretend night at {BAR} · the other players are simulated
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="rounded-full bg-white/10 border border-white/20 px-4 py-1.5 text-sm font-bold"
          >
            {paused ? "Resume" : "Pause"}
          </button>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          {/* The TV over the bar. */}
          <section className="order-2 lg:order-1 rounded-3xl bg-black/50 border border-amber-900/60 p-4 sm:p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <p className="uppercase tracking-widest text-amber-300/80 text-xs font-bold">On the TV at {BAR}</p>
              <p className="text-sm text-slate-300">
                Round {round} · <span className="font-black tabular-nums text-amber-400 text-lg">{clock}</span>
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">Closest to Bingo</p>
                <div className="flex flex-col gap-1.5">
                  {board.slice(0, 6).map(({ p, done, away }) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 ${
                        p.id === "me" ? "bg-amber-400/15 border border-amber-400/40" : "bg-white/5"
                      }`}
                    >
                      <Avatar imageUrl={img(p.avatar)} size={30} />
                      <span className="flex-1 font-bold truncate">{p.name}</span>
                      <span className="text-xs text-slate-400 tabular-nums">{done} done</span>
                      {away === 1 ? (
                        <span className="rounded-full bg-rose-500 text-white text-[11px] font-black px-2 py-0.5 animate-pulse">1 away!</span>
                      ) : (
                        <span className="text-xs text-slate-500 tabular-nums w-14 text-right">{away} to go</span>
                      )}
                      {p.wins > 0 && <span className="text-[11px] font-bold text-amber-300">{p.wins} {p.wins === 1 ? "win" : "wins"}</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">Just happened</p>
                <div className="flex flex-col gap-1.5">
                  {feed.length === 0 && <p className="text-sm text-slate-500">New cards are out. Go meet someone!</p>}
                  {feed
                    .slice(-6)
                    .reverse()
                    .map((f) => {
                      const p = byId[f.playerId];
                      return (
                        <div key={f.key} className="flex items-center gap-2.5 rounded-xl bg-white/5 px-2.5 py-1.5 animate-pop-in">
                          <Avatar imageUrl={img(p.avatar)} size={30} />
                          <p className="text-sm leading-tight">
                            <span className="font-bold">{p.name}</span> <span className="text-emerald-300">✓</span>{" "}
                            <span className="text-slate-200">{f.text}</span>
                          </p>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Every card is different: 24 of {BINGO_PROMPTS.length} friendly squares, picked at random. First to finish a row, column or
              diagonal wins the round.
            </p>
          </section>

          {/* Your phone. */}
          <section className="order-1 lg:order-2 mx-auto w-full max-w-[380px] rounded-[2rem] border-4 border-slate-700 bg-slate-950 p-3 shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Avatar imageUrl={img(ME.avatar)} size={34} />
              <div className="flex-1">
                <p className="font-black leading-tight">Your card</p>
                <p className="text-xs text-slate-400">Tap a square once you&apos;ve done it</p>
              </div>
              <span className={`text-xs font-bold ${myAway === 1 ? "text-rose-300" : "text-amber-300"}`}>
                {myAway === 1 ? "1 away!" : `${myAway} to go`}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {me.card.map((text, i) => {
                const free = text === BINGO_FREE;
                const won = winner?.player.id === "me" && winner.line.includes(i);
                return (
                  <button
                    key={`${round}-${i}`}
                    type="button"
                    onClick={() => mark("me", i)}
                    disabled={free || me.marked[i] || !!winner}
                    className={`aspect-square rounded-md p-1 text-[9px] sm:text-[10px] leading-tight font-semibold flex items-center justify-center text-center transition active:scale-95 ${
                      won
                        ? "bg-emerald-400 text-black"
                        : me.marked[i]
                          ? "bg-amber-400 text-black"
                          : "bg-white/10 text-slate-200 hover:bg-white/15"
                    }`}
                  >
                    {free ? "FREE" : text}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {winner && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="w-full max-w-md rounded-3xl bg-gradient-to-b from-amber-400 to-amber-600 text-black p-6 text-center shadow-2xl animate-pop-in">
            <p className="text-6xl font-black tracking-tight">BINGO!</p>
            <div className="flex justify-center my-3">
              <Avatar imageUrl={img(winner.player.avatar)} size={120} variant="full" />
            </div>
            <p className="text-2xl font-black">{winner.player.id === "me" ? "You got it!" : `${winner.player.name} got a line!`}</p>
            <ul className="mt-3 text-left text-sm font-semibold bg-black/10 rounded-2xl p-3 flex flex-col gap-1">
              {winner.line
                .map((i) => winner.player.card[i])
                .filter((t) => t !== BINGO_FREE)
                .map((t) => (
                  <li key={t}>✓ {t}</li>
                ))}
            </ul>
            <p className="mt-3 text-sm font-bold text-black/70">New cards in a few seconds…</p>
          </div>
        </div>
      )}
    </main>
  );
}
