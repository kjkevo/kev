"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { AvatarPicker } from "@/components/AvatarPicker";
import { BuySheet } from "@/components/BuySheet";
import { useAvatars, useEquippedAvatar, type AvatarOption } from "@/hooks/useAvatars";
import { usePlayerVenue } from "@/lib/venue";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { RANK_STYLE, nextRankLabel, rankGameFor, useMyRank } from "@/lib/ranks";

/**
 * "My character": equip any character this phone owns, or unlock a new one.
 * The choice is remembered on this phone for every game. onEquip lets a
 * lobby also switch the character of a player who has already joined.
 */
export function CharacterLocker({ onClose, onEquip }: { onClose: () => void; onEquip?: (id: string) => void }) {
  const venue = usePlayerVenue();
  const { avatars, byId, refresh } = useAvatars();
  const { avatarId, equip } = useEquippedAvatar(avatars);
  const [buying, setBuying] = useState<AvatarOption | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const current = avatarId ? byId[avatarId] : undefined;

  function pick(id: string) {
    equip(id);
    onEquip?.(id);
    setNote(`${byId[id]?.name ?? "Character"} equipped.`);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-white/10 p-5 text-white text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-lg font-black">My character</p>
          <button type="button" onClick={onClose} className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold">
            Done
          </button>
        </div>
        <div className="flex flex-col items-center gap-1 mb-4">
          {current ? (
            <>
              <Avatar emoji={current.emoji} imageUrl={current.imageUrl} size={140} variant="full" />
              <p className="font-bold">{current.name}</p>
              <p className="text-xs text-slate-400">Used in every game</p>
            </>
          ) : (
            <p className="text-sm text-slate-300">Pick one to play.</p>
          )}
        </div>
        {note && <p className="text-xs text-amber-300 mb-2">{note}</p>}
        <div className="flex justify-center">
          <AvatarPicker avatars={avatars} selectedId={avatarId} onSelect={pick} onBuy={(a) => { setNote(null); setBuying(a); }} />
        </div>
      </div>
      {buying && (
        <BuySheet
          item={{ itemType: "avatar", itemId: buying.id, name: buying.name, priceCents: buying.priceCents, emoji: buying.emoji, imageUrl: buying.imageUrl }}
          context={{ venue: venue ?? "main" }}
          onClose={() => setBuying(null)}
          onPaid={() => {
            const id = buying.id;
            setBuying(null);
            refresh();
            pick(id);
            setNote(`${buying.name} unlocked!`);
          }}
        />
      )}
    </div>
  );
}

/** A button showing the equipped character that opens the locker. */
export function MyCharacterButton({ onEquip, compact = false }: { onEquip?: (id: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const { avatars, byId } = useAvatars();
  const { avatarId, equip } = useEquippedAvatar(avatars);
  const current = avatarId ? byId[avatarId] : undefined;
  // On a game's start page, your rank in that game shows with your character.
  const path = usePathname();
  const onGameMenu = !compact && ["/trivia", "/bingo", "/wild-match", "/drop-line"].includes(path ?? "");
  const rank = useMyRank(onGameMenu ? rankGameFor(path) : null);
  const next = rank ? nextRankLabel(rank.rp) : null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 hover:border-amber-400/60 text-left transition active:scale-95 ${
          compact ? "px-2 py-1.5" : "px-3 py-2 w-full max-w-sm"
        }`}
      >
        <Avatar emoji={current?.emoji} imageUrl={current?.imageUrl} size={compact ? 32 : 44} />
        <span className="flex-1 min-w-0">
          <span className={`block font-bold truncate ${compact ? "text-xs" : "text-sm"}`}>{current ? current.name : "Pick a character"}</span>
          {rank && (
            <span className="mt-1 flex flex-col gap-1">
              <span className={`self-start inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-base font-black ${RANK_STYLE[rank.tier]}`}>
                <Icon name="star" size={14} />
                {rank.supernova ? `Supernova #${rank.supernova}` : rank.label}
              </span>
              {next && !rank.supernova && (
                <span className="flex items-center gap-2">
                  <span className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                    <span className="block h-full rounded-full bg-amber-400" style={{ width: `${rank.stepRp}%` }} />
                  </span>
                  <span className="text-xs font-bold text-slate-300 whitespace-nowrap">{100 - rank.stepRp} to {next}</span>
                </span>
              )}
            </span>
          )}
        </span>
        <span className="text-amber-300 text-sm font-bold">{current ? "Change ›" : "›"}</span>
      </button>
      {open && (
        <CharacterLocker
          onClose={() => setOpen(false)}
          onEquip={(id) => {
            equip(id);
            onEquip?.(id);
          }}
        />
      )}
    </>
  );
}
