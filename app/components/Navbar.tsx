import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import Link from "next/link";
import SignOutButton from "./SignOutButton";

export default async function Navbar() {
  const session = await getServerSession(authOptions);

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-brand-700">
          LeadIQ
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
          <Link href="#features" className="hover:text-brand-600 transition-colors">
            Features
          </Link>
          <Link href="#pricing" className="hover:text-brand-600 transition-colors">
            Pricing
          </Link>
          <Link href="/dashboard" className="hover:text-brand-600 transition-colors">
            Dashboard
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {session?.user ? (
            <>
              <span className="hidden sm:block text-sm text-gray-500 max-w-[160px] truncate">
                {session.user.name ?? session.user.email}
              </span>
              <Link
                href="/dashboard"
                className="text-sm font-medium bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors"
              >
                Dashboard
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/auth/register"
                className="text-sm font-medium bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
