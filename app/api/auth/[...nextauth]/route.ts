import NextAuth from "next-auth";
import { authOptions } from "@/app/lib/auth";

// bcrypt password comparison is intentionally slow; give it room on serverless.
export const maxDuration = 30;

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
