import { PrismaClient } from "@prisma/client";
// Relative (not "@/app/lib/env") so this also resolves under ts-node, which
// the seed/report/cron scripts run under without the "@/*" path alias set up.
import "./env"; // validates DATABASE_URL + NEXTAUTH_SECRET at startup

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export const prisma = db;
