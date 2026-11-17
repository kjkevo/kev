"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

/** Tells the "Reconnecting…" banner (in the layout) whether this phone lost the game. */
function announce(reconnecting: boolean) {
  window.dispatchEvent(new CustomEvent("slimpse:connection", { detail: { reconnecting } }));
}

/**
 * Keep a game table's state fresh without asking the server every second.
 * The server sends a tiny "changed" message on the table's channel
 * ("dl:<room id>", "wm:<room id>", "sb:<room id>", migration 0125) whenever
 * anything at the table changes; this fetches the state then. A safety
 * check still runs: every 15 seconds once messages are arriving, every 3
 * seconds until the first one does. If a fetch fails (bad Wi-Fi), the phone
 * shows "Reconnecting…" and retries every 2 seconds until it's back.
 */
export function useLiveTable(topic: string | null, load: () => Promise<boolean | void> | void) {
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!topic) return;
    let live = false;
    let gotMessage = false;
    let failed = false;
    let lastLoad = 0;
    let soon: ReturnType<typeof setTimeout> | undefined;
    const setFailed = (f: boolean) => {
      if (f !== failed) {
        failed = f;
        announce(f);
      }
    };
    const run = () => {
      lastLoad = Date.now();
      Promise.resolve(loadRef.current())
        .then((ok) => setFailed(ok === false))
        .catch(() => setFailed(true));
    };
    run();

    const channel = supabase
      .channel(topic)
      .on("broadcast", { event: "changed" }, () => {
        gotMessage = true;
        // Several changes from one move arrive close together: fetch once.
        clearTimeout(soon);
        soon = setTimeout(run, 120);
      })
      .subscribe((status) => {
        live = status === "SUBSCRIBED";
        if (live) run(); // catch anything that changed while connecting
      });

    const offline = () => setFailed(true);
    const online = () => run();
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);

    const check = setInterval(() => {
      const every = failed ? 2000 : live && gotMessage ? 15000 : 3000;
      if (Date.now() - lastLoad >= every) run();
    }, 1000);

    return () => {
      clearTimeout(soon);
      clearInterval(check);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      supabase.removeChannel(channel);
      announce(false);
    };
  }, [topic]);
}
