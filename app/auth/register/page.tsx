"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Registration failed. Please try again.");
      setLoading(false);
      return;
    }

    // Auto sign-in after successful registration
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      // Account created but auto-sign-in failed — send to login
      router.push("/auth/login");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-white flex flex-col">
      {/* Top bar */}
      <header className="px-6 py-5">
        <Link href="/" className="text-xl font-bold text-brand-700">
          LeadIQ
        </Link>
      </header>

      {/* Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-10">
            {/* Heading */}
            <div className="mb-8">
              <span className="inline-block mb-3 text-xs font-semibold tracking-widest text-brand-600 uppercase bg-brand-100 px-3 py-1 rounded-full">
                Free account
              </span>
              <h1 className="text-2xl font-bold text-gray-900">
                Create your account
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Start exploring enriched lead intelligence in seconds.
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div className="mb-6 flex items-start gap-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm">
                <svg
                  className="w-4 h-4 shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Full name{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Work email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Password{" "}
                  <span className="text-gray-400 font-normal">
                    (min. 8 characters)
                  </span>
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-colors shadow-sm shadow-brand-100 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4l3-3-3-3V4a10 10 0 100 20v-4l-3 3 3 3v-4a8 8 0 01-8-8z"
                      />
                    </svg>
                    Creating account…
                  </>
                ) : (
                  "Create account"
                )}
              </button>

              <p className="text-center text-xs text-gray-400 leading-relaxed">
                By creating an account you agree to our{" "}
                <Link href="#" className="underline hover:text-gray-600">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="#" className="underline hover:text-gray-600">
                  Privacy Policy
                </Link>
                .
              </p>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="text-brand-600 font-semibold hover:text-brand-700 transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
