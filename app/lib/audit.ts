import { supabase } from "@/app/lib/supabase";

export function logAudit(entry: {
  userId?: number;
  userEmail?: string;
  action: string;
  entityType?: string;
  entityId?: number;
  meta?: Record<string, unknown>;
}) {
  // Fire-and-forget — don't await to avoid slowing responses
  supabase
    .from("AuditLog")
    .insert({
      userId: entry.userId ?? null,
      userEmail: entry.userEmail ?? null,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      meta: entry.meta ?? null,
      createdAt: new Date().toISOString(),
    })
    .then(({ error }) => {
      if (error) {
        console.error("[audit] Failed to log:", error.message);
      }
    });
}
