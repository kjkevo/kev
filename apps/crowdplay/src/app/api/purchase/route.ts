import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { squareMode } from "@/lib/payments";

/**
 * Buys one item (a premium avatar today). The price always comes from the
 * database. With Square keys set, the card/wallet token from the phone is
 * charged through Square; without them this runs in practice mode and the
 * purchase is recorded as TEST. Either way the purchase is confirmed in the
 * database with PURCHASE_SECRET, which only this server knows.
 *
 * Env: PURCHASE_SECRET (required); SQUARE_ACCESS_TOKEN,
 * NEXT_PUBLIC_SQUARE_APPLICATION_ID, NEXT_PUBLIC_SQUARE_LOCATION_ID and
 * NEXT_PUBLIC_SQUARE_ENV ("sandbox" | "production") for real payments.
 */

type Body = {
  itemType?: string;
  itemId?: string;
  deviceKey?: string;
  venue?: string;
  nickname?: string;
  roomId?: string;
  playerId?: string;
  clientToken?: string;
  sourceId?: string; // Square payment token; absent in practice mode
};

const SQUARE_VERSION = "2024-12-18";

export async function POST(req: Request) {
  const secret = process.env.PURCHASE_SECRET;
  if (!secret) return NextResponse.json({ error: "PAYMENTS_NOT_SET_UP" }, { status: 503 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }
  if (!body.itemType || !body.itemId || !body.deviceKey) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  const { data: started, error: startError } = await supabase.rpc("start_purchase", {
    p_item_type: body.itemType,
    p_item_id: body.itemId,
    p_device_key: body.deviceKey,
    p_venue: body.venue ?? "main",
    p_nickname: body.nickname ?? undefined,
    p_room_id: body.roomId ?? undefined,
    p_player_id: body.playerId ?? undefined,
    p_client_token: body.clientToken ?? undefined,
  });
  const purchase = started?.[0];
  if (startError || !purchase) {
    const code = startError?.message.match(/[A-Z_]{6,}/)?.[0] ?? "PURCHASE_FAILED";
    return NextResponse.json({ error: code }, { status: 400 });
  }

  const mode = squareMode();
  let ok = true;
  let paymentId: string | null = null;
  let failure: string | null = null;

  if (mode !== "practice") {
    if (!body.sourceId) {
      ok = false;
      failure = "No payment token from the phone";
    } else {
      const host = mode === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
      try {
        const res = await fetch(`${host}/v2/payments`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
            "Square-Version": SQUARE_VERSION,
          },
          body: JSON.stringify({
            source_id: body.sourceId,
            idempotency_key: purchase.o_purchase_id,
            amount_money: { amount: purchase.o_amount_cents, currency: "USD" },
            location_id: process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID,
            note: `CrowdPlay: ${purchase.o_item_name}`,
            reference_id: purchase.o_purchase_id,
          }),
        });
        const json = await res.json();
        if (res.ok && json.payment?.status === "COMPLETED") {
          paymentId = json.payment.id;
        } else {
          ok = false;
          failure = json.errors?.[0]?.detail ?? json.errors?.[0]?.code ?? `Square answered ${res.status}`;
        }
      } catch (e) {
        ok = false;
        failure = e instanceof Error ? e.message : "Couldn't reach Square";
      }
    }
  }

  const { error: doneError } = await supabase.rpc("complete_purchase", {
    p_purchase_id: purchase.o_purchase_id,
    p_secret: secret,
    p_ok: ok,
    p_provider: mode === "practice" ? "practice" : "square",
    p_payment_id: paymentId ?? undefined,
    p_is_test: mode !== "production",
    p_error: failure ?? undefined,
  });
  if (doneError) return NextResponse.json({ error: "RECORD_FAILED" }, { status: 500 });
  if (!ok) return NextResponse.json({ error: "PAYMENT_DECLINED", detail: failure }, { status: 402 });

  return NextResponse.json({ ok: true, test: mode !== "production", purchaseId: purchase.o_purchase_id });
}
