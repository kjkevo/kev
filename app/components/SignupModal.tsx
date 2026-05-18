"use client";

import { useState } from "react";

export default function SignupModal() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  function closeModal() {
    setOpen(false);
    setSubmitted(false);
    setForm({ name: "", email: "", password: "" });
  }

  return (
    <>
      {/* Hero button */}
      <button
        onClick={() => setOpen(true)}
        className="px-8 py-4 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors shadow-lg shadow-brand-100"
      >
        Start free trial
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl leading-none"
              aria-label="Close"
            >
              ×
            </button>

            {submitted ? (
              <div className="text-center py-6">
                <div className="text-5xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re in!</h2>
                <p className="text-gray-500">
                  Check your inbox — we sent a confirmation to{" "}
                  <span className="font-medium text-gray-700">{form.email}</span>.
                </p>
                <button
                  onClick={closeModal}
                  className="mt-6 px-6 py-3 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h2>
                <p className="text-gray-500 text-sm mb-6">Free for 14 days. No credit card required.</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                    <input
                      type="text"
                      required
                      placeholder="Jane Smith"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Work email</label>
                    <input
                      type="email"
                      required
                      placeholder="jane@company.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      placeholder="Min. 8 characters"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors mt-2"
                  >
                    Create account
                  </button>
                </form>

                <p className="text-center text-xs text-gray-400 mt-4">
                  By signing up you agree to our{" "}
                  <a href="#" className="underline hover:text-gray-600">Terms</a>{" "}
                  and{" "}
                  <a href="#" className="underline hover:text-gray-600">Privacy Policy</a>.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
