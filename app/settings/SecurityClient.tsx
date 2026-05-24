"use client";

import { useState } from "react";

type TwoFactorStatus = {
  enabled: boolean;
};

export default function SecurityClient({ initialStatus }: { initialStatus: TwoFactorStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [step, setStep] = useState<"idle" | "setup" | "enable" | "disable">("idle");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleStartSetup() {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/2fa/setup");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep("setup");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start setup");
    } finally {
      setLoading(false);
    }
  }

  async function handleEnable() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/2fa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatus({ enabled: true });
      setStep("idle");
      setCode("");
      setQrCode(null);
      setSecret(null);
      setSuccess("Two-factor authentication has been enabled.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to enable 2FA");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatus({ enabled: false });
      setStep("idle");
      setCode("");
      setSuccess("Two-factor authentication has been disabled.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disable 2FA");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Security Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage your account security</p>
      </div>

      {success && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 text-sm text-green-700 dark:text-green-400">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* 2FA Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Two-Factor Authentication</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Add an extra layer of security using an authenticator app.
            </p>
          </div>
          {status.enabled ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
              2FA Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
              Not enabled
            </span>
          )}
        </div>

        <div className="mt-4">
          {/* Not enabled — show setup flow */}
          {!status.enabled && step === "idle" && (
            <button
              onClick={handleStartSetup}
              disabled={loading}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {loading ? "Loading..." : "Enable 2FA"}
            </button>
          )}

          {/* Setup step — show QR */}
          {step === "setup" && qrCode && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="2FA QR Code" className="w-40 h-40 rounded-lg border border-gray-200 dark:border-gray-600" />
              {secret && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Or enter this key manually:</p>
                  <code className="block px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs font-mono text-gray-800 dark:text-gray-200 break-all">
                    {secret}
                  </code>
                </div>
              )}
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Enter 6-digit code to confirm
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <button
                  onClick={handleEnable}
                  disabled={loading || code.length !== 6}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {loading ? "Confirming..." : "Confirm"}
                </button>
                <button
                  onClick={() => { setStep("idle"); setCode(""); setQrCode(null); setSecret(null); }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Enabled — show disable option */}
          {status.enabled && step === "idle" && (
            <button
              onClick={() => { setStep("disable"); setError(""); }}
              className="px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Disable 2FA
            </button>
          )}

          {/* Disable step — require code */}
          {status.enabled && step === "disable" && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Enter your authenticator code to disable 2FA:
              </p>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <button
                  onClick={handleDisable}
                  disabled={loading || code.length !== 6}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {loading ? "Disabling..." : "Disable"}
                </button>
                <button
                  onClick={() => { setStep("idle"); setCode(""); }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
