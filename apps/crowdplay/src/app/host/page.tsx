"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { hostKey } from "@/lib/types";
import type { QuestionPack } from "@/lib/types";

export default function HostSetupPage() {
  const router = useRouter();
  const [packs, setPacks] = useState<QuestionPack[]>([]);
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("question_packs")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data }) => setPacks(data ?? []));
  }, []);

  async function startRoom(packId: string) {
    setCreating(packId);
    setError(null);
    const { data, error } = await supabase.rpc("create_room", { p_pack_id: packId });
    if (error || !data?.[0]) {
      setError("Couldn't create the room. Check your connection and try again.");
      setCreating(null);
      return;
    }
    const { room_id, code, host_secret } = data[0];
    localStorage.setItem(hostKey(code), JSON.stringify({ roomId: room_id, hostSecret: host_secret }));
    router.push(`/host/${code}`);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-16 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-2">Pick a question pack</h1>
      <p className="text-slate-400 mb-10">You&apos;ll get a room code and QR code on the next screen.</p>

      {error && <p className="text-red-400 mb-6">{error}</p>}

      <div className="grid gap-4 w-full max-w-md">
        {packs.map((pack) => (
          <button
            key={pack.id}
            onClick={() => startRoom(pack.id)}
            disabled={creating !== null}
            className="text-left rounded-xl bg-white/5 border border-white/10 hover:border-amber-400/60 px-5 py-4 transition disabled:opacity-50"
          >
            <div className="font-semibold text-lg">{pack.name}</div>
            {pack.category && <div className="text-sm text-slate-400">{pack.category}</div>}
            {creating === pack.id && <div className="text-amber-400 text-sm mt-1">Creating room…</div>}
          </button>
        ))}
        {packs.length === 0 && (
          <p className="text-slate-500 text-center">No question packs yet — seed one in Supabase.</p>
        )}
      </div>
    </main>
  );
}
