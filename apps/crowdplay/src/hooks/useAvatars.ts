"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { deviceKey } from "@/lib/device";

export type AvatarOption = {
  id: string;
  name: string;
  emoji: string | null;
  imageUrl: string | null;
  priceCents: number;
  owned: boolean;
};

/** Every avatar on offer, marked with whether this phone can use it. */
export function useAvatars() {
  const [avatars, setAvatars] = useState<AvatarOption[]>([]);

  const refresh = useCallback(() => {
    supabase.rpc("list_avatars", { p_device_key: deviceKey() }).then(({ data }) => {
      if (data)
        setAvatars(
          data.map((a) => ({
            id: a.o_id,
            name: a.o_name,
            emoji: a.o_emoji,
            imageUrl: a.o_image_url,
            priceCents: a.o_price_cents,
            owned: a.o_owned,
          }))
        );
    });
  }, []);

  useEffect(refresh, [refresh]);

  const byId = useMemo(() => Object.fromEntries(avatars.map((a) => [a.id, a])), [avatars]);
  return { avatars, byId, refresh };
}
