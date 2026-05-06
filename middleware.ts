import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
  pages: {
    signIn: "/auth/login",
  },
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
