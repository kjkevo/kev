/**
 * Validates required server-side environment variables at module load time.
 * Importing this module anywhere on the server path causes an immediate,
 * descriptive error if a variable is missing — rather than a cryptic crash
 * deep inside Prisma or NextAuth.
 *
 * Do NOT import this in client components or middleware (Edge runtime).
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `\n\nMissing required environment variable: ${name}\n` +
        `Add it to your .env file and restart the dev server.\n` +
        `See .env.example for the full list of required variables.\n`
    );
  }
  return value;
}

export const env = {
  databaseUrl: requireEnv("DATABASE_URL"),
  nextAuthSecret: requireEnv("NEXTAUTH_SECRET"),
  // NEXTAUTH_URL is required in production; falls back gracefully in local dev.
  nextAuthUrl: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
} as const;
