"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { formatPrice } from "@/components/AvatarPicker";
import { squareMode } from "@/lib/payments";
import { deviceKey } from "@/lib/device";

type SquareToken = { status: string; token?: string; errors?: { message: string }[] };
type WalletMethod = { attach?: (selector: string) => Promise<void>; tokenize: () => Promise<SquareToken>; destroy?: () => Promise<void> };
type SquarePayments = {
  paymentRequest: (r: object) => object;
  applePay: (req: object) => Promise<WalletMethod>;
  googlePay: (req: object) => Promise<WalletMethod>;
};
declare global {
  interface Window {
    Square?: { payments: (appId: string, locationId: string) => SquarePayments };
  }
}

export type BuyItem = {
  itemType: "avatar" | "shoutout";
  itemId: string;
  name: string;
  priceCents: number;
  emoji?: string | null;
  imageUrl?: string | null;
};

export type BuyContext = {
  venue: string;
  nickname?: string;
  roomId?: string;
  playerId?: string;
  clientToken?: string;
};

const PAY_ERRORS: Record<string, string> = {
  ALREADY_OWNED: "You already own this one.",
  PAYMENT_DECLINED: "The payment didn't go through. Nothing was charged.",
  PAYMENTS_NOT_SET_UP: "Payments aren't switched on yet.",
};

function loadSquareScript(mode: "sandbox" | "production") {
  const src = mode === "production" ? "https://web.squarecdn.com/v1/square.js" : "https://sandbox.web.squarecdn.com/v1/square.js";
  return new Promise<void>((resolve, reject) => {
    if (window.Square) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    const s = existing ?? document.createElement("script");
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () => reject(new Error("Couldn't load Square")));
    if (!existing) {
      s.src = src;
      document.head.appendChild(s);
    }
  });
}

/**
 * The pay screen: Apple Pay / Google Pay through Square, or a practice
 * version (recorded as TEST) until Square keys are set. Calls onPaid once
 * the server has confirmed and recorded the purchase.
 */
export function BuySheet({
  item,
  context,
  onClose,
  onPaid,
}: {
  item: BuyItem;
  context: BuyContext;
  onClose: () => void;
  onPaid: () => void;
}) {
  const mode = squareMode();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wallets, setWallets] = useState<{ apple?: WalletMethod; google?: WalletMethod }>({});
  const [loadingWallets, setLoadingWallets] = useState(mode !== "practice");
  const googleRef = useRef<HTMLDivElement>(null);

  async function charge(sourceId?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType: item.itemType, itemId: item.itemId, deviceKey: deviceKey(), sourceId, ...context }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(PAY_ERRORS[json.error] ?? "Something went wrong. You weren't charged.");
        return;
      }
      onPaid();
    } catch {
      setError("Couldn't reach the server. You weren't charged.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (mode === "practice") return;
    let cancelled = false;
    const found: { apple?: WalletMethod; google?: WalletMethod } = {};
    (async () => {
      try {
        await loadSquareScript(mode);
        const payments = window.Square!.payments(
          process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID!,
          process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!
        );
        const request = payments.paymentRequest({
          countryCode: "US",
          currencyCode: "USD",
          total: { amount: (item.priceCents / 100).toFixed(2), label: `CrowdPlay: ${item.name}` },
        });
        try {
          found.apple = await payments.applePay(request);
        } catch {
          // Apple Pay isn't available on this device/browser
        }
        try {
          const g = await payments.googlePay(request);
          if (googleRef.current) await g.attach!("#crowdplay-google-pay");
          found.google = g;
        } catch {
          // Google Pay isn't available on this device/browser
        }
      } catch {
        if (!cancelled) setError("Couldn't load the payment options. Try again in a moment.");
      } finally {
        if (!cancelled) {
          setWallets(found);
          setLoadingWallets(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      found.apple?.destroy?.();
      found.google?.destroy?.();
    };
  }, [mode, item.priceCents, item.name]);

  async function payWith(method?: WalletMethod) {
    if (!method) return;
    const result = await method.tokenize();
    if (result.status === "OK" && result.token) await charge(result.token);
    else if (result.status !== "Cancel") setError(result.errors?.[0]?.message ?? "The payment was cancelled.");
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-white/10 p-5 text-center flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2">
          <Avatar emoji={item.emoji} imageUrl={item.imageUrl} size={72} />
          <p className="text-lg font-bold">{item.name}</p>
          <p className="text-3xl font-black text-amber-400">{formatPrice(item.priceCents)}</p>
          <p className="text-xs text-slate-400">
            {item.itemType === "avatar" ? "Yours to use on this phone in every game." : "One premium shoutout."}
          </p>
        </div>

        {mode === "practice" ? (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-sky-300">Test mode · no real money</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => charge()}
              className="rounded-xl bg-white text-black font-semibold py-3 active:scale-95 disabled:opacity-40"
            >
              Apple Pay (test)
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => charge()}
              className="rounded-xl bg-black border border-white/30 text-white font-semibold py-3 active:scale-95 disabled:opacity-40"
            >
              Google Pay (test)
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {mode === "sandbox" && (
              <p className="text-[11px] font-bold uppercase tracking-widest text-sky-300">Square sandbox · test cards only</p>
            )}
            {wallets.apple && (
              <button
                type="button"
                disabled={busy}
                onClick={() => payWith(wallets.apple)}
                className="rounded-xl bg-white text-black font-semibold py-3 active:scale-95 disabled:opacity-40"
              >
                Apple Pay
              </button>
            )}
            <div
              id="crowdplay-google-pay"
              ref={googleRef}
              onClick={() => !busy && payWith(wallets.google)}
              className={wallets.google ? "" : "hidden"}
            />
            {loadingWallets && <p className="text-sm text-slate-400">Loading payment options…</p>}
            {!loadingWallets && !wallets.apple && !wallets.google && (
              <p className="text-sm text-slate-400">
                Apple Pay or Google Pay isn&apos;t set up on this phone&apos;s browser. Try Safari on iPhone or Chrome on Android.
              </p>
            )}
          </div>
        )}

        {busy && <p className="text-sm text-slate-300">Processing…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="button" onClick={onClose} className="text-sm text-slate-400">
          Not now
        </button>
      </div>
    </div>
  );
}
