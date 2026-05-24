import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    twoFactorEnabled?: boolean;
  }
  interface Session {
    user: {
      id: string;
      twoFactorEnabled?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    tfPending?: boolean;
  }
}
