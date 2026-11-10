"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { linkThisPhone } from "@/lib/progress";

const KEY = "slimpse_linked_user";

/**
 * If the player opened the sign-in link from their email (instead of typing
 * the code), save this phone's progress to that account once they land here.
 */
export function AccountSync() {
  useEffect(() => {
    const sync = (userId: string | undefined) => {
      if (!userId) return;
      try {
        if (localStorage.getItem(KEY) === userId) return;
      } catch {
        // storage blocked: linking again is harmless
      }
      linkThisPhone()
        .then(() => {
          try {
            localStorage.setItem(KEY, userId);
          } catch {
            // ignore
          }
        })
        .catch(() => {});
    };
    supabase.auth.getSession().then(({ data }) => sync(data.session?.user.id));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") sync(session?.user.id);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return null;
}
