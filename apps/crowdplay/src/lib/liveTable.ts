"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Keep a game table's state fresh without asking the server every second.
 * The server sends a tiny "changed" message on the table's channel
 * ("dl:<room id>", "wm:<room id>", "sb:<room id>", migration 0125) whenever
 * anything at the table changes; this fetches the state then. A safety
 * check still runs: every 15 seconds once messages are arriving, every 3
 * seconds until the first one does (or if the channel drops).
 */
export function useLiveTable(topic: string | null, load: () => void) {
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!topic) return;
    let live = false;
    let gotMessage = false;
    let lastLoad = 0;
    let soon: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      lastLoad = Date.now();
      loadRef.current();
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

    const check = setInterval(() => {
      const every = live && gotMessage ? 15000 : 3000;
      if (Date.now() - lastLoad >= every) run();
    }, 1000);

    return () => {
      clearTimeout(soon);
      clearInterval(check);
      supabase.removeChannel(channel);
    };
  }, [topic]);
}
