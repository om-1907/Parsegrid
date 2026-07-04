"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ParsegridLogo } from "@/components/ParsegridLogo";
import { FixedVideoBg } from "@/components/landing/FixedVideoBg";
import { apiUrl } from "@/lib/api";

type Step = "email" | "otp" | "reset" | "success";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Helper to safely extract error messages from API responses
  const extractError = (data: unknown, fallback: string): string => {
    const detail = (data as { detail?: unknown } | null)?.detail;
    if (!detail) return fallback;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((err) =>
          typeof err === "object" && err && "msg" in err
            ? String((err as { msg: unknown }).msg)
            : JSON.stringify(err)
        )
        .join(", ");
    }
    return JSON.stringify(detail);
  };

  // ── Step 1: Request OTP ────────────────────────────────────────────────
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(apiUrl("/api/v1/auth/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        toast.success("If that email exists, an OTP has been sent.");
        setStep("otp");
      } else {
        const msg = extractError(data, "Something went wrong.");
        setError(msg);
        toast.error(msg);
      }
    } catch {
      const msg = "Network error. Is the backend running?";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ─────────────────────────────────────────────────
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(apiUrl("/api/v1/auth/verify-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setResetToken(data.password_reset_token);
        toast.success("OTP verified! Set your new password.");
        setStep("reset");
      } else {
        const msg = extractError(data, "Invalid OTP.");
        setError(msg);
        toast.error(msg);
      }
    } catch {
      const msg = "Network error. Is the backend running?";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Reset Password ─────────────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(apiUrl("/api/v1/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password_reset_token: resetToken,
          new_password: newPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        toast.success("Password reset successfully!");
        setStep("success");
      } else {
        const msg = extractError(data, "Failed to reset password.");
        setError(msg);
        toast.error(msg);
      }
    } catch {
      const msg = "Network error. Is the backend running?";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Step indicator ─────────────────────────────────────────────────────
  const steps = [
    { key: "email", label: "Email" },
    { key: "otp", label: "Verify" },
    { key: "reset", label: "Reset" },
  ];
  const currentStepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10 text-white">
      {/* Full-page fixed video background (same as the landing page). */}
      <FixedVideoBg />

      {/* Brand logo, top-left, links home. */}
      <Link
        href="/"
        className="absolute left-6 top-6 z-10 flex items-center gap-2.5 sm:left-8 sm:top-8"
      >
        <ParsegridLogo className="h-9 w-9 text-white" textClassName="text-white" />
      </Link>

      {/* ---- Frosted glass card ---- */}
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-3xl border border-white/15 bg-white/[0.07] p-8 shadow-2xl shadow-black/50 backdrop-blur-2xl sm:p-10">
          {/* Step progress bar */}
          {step !== "success" && (
            <div className="mb-8">
              <div className="flex items-center justify-between">
                {steps.map((s, i) => (
                  <div key={s.key} className="flex items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                        i <= currentStepIndex
                          ? "bg-white text-slate-900"
                          : "border border-white/20 bg-white/10 text-white/50"
                      }`}
                    >
                      {i < currentStepIndex ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    {i < steps.length - 1 && (
                      <div
                        className={`mx-2 h-0.5 w-12 sm:w-16 transition-all ${
                          i < currentStepIndex ? "bg-white" : "bg-white/20"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-xs text-white/60">
                {steps.map((s) => (
                  <span key={s.key}>{s.label}</span>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 1: Enter Email ─────────────────────────────────── */}
          {step === "email" && (
            <>
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur">
                  <Mail className="h-6 w-6 text-white" />
                </div>
                <h2 className="font-display text-2xl font-bold text-white">
                  Forgot password?
                </h2>
                <p className="mt-1.5 text-sm text-white/70">
                  Enter your email and we&apos;ll send you a verification code.
                </p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-medium text-white/90">
                    Email address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-white/50" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@company.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 border-white/15 bg-white/10 pl-10 text-white placeholder:text-white/40 backdrop-blur focus-visible:border-white/40 focus-visible:ring-white/30"
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-400/30 bg-red-500/15 p-3 text-sm font-medium text-red-200 backdrop-blur">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full bg-white text-base font-semibold text-slate-900 shadow-xl shadow-black/30 hover:bg-white/90"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      Send verification code
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>
            </>
          )}

          {/* ── Step 2: Enter OTP ───────────────────────────────────── */}
          {step === "otp" && (
            <>
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur">
                  <ShieldCheck className="h-6 w-6 text-white" />
                </div>
                <h2 className="font-display text-2xl font-bold text-white">
                  Enter verification code
                </h2>
                <p className="mt-1.5 text-sm text-white/70">
                  We sent a 6-digit code to{" "}
                  <span className="font-medium text-white">{email}</span>.
                  It expires in 10 minutes.
                </p>
              </div>

              <form onSubmit={handleVerifyOTP} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="otp" className="font-medium text-white/90">
                    Verification code
                  </Label>
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="000000"
                    required
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    className="h-11 border-white/15 bg-white/10 text-center text-2xl font-mono tracking-[0.5em] text-white placeholder:text-white/30 backdrop-blur focus-visible:border-white/40 focus-visible:ring-white/30"
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-red-400/30 bg-red-500/15 p-3 text-sm font-medium text-red-200 backdrop-blur">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="h-11 w-full bg-white text-base font-semibold text-slate-900 shadow-xl shadow-black/30 hover:bg-white/90"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      Verify code
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setError("");
                  setOtp("");
                }}
                className="mt-4 flex w-full items-center justify-center gap-1.5 text-sm text-white/60 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Use a different email
              </button>
            </>
          )}

          {/* ── Step 3: Set New Password ────────────────────────────── */}
          {step === "reset" && (
            <>
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur">
                  <Lock className="h-6 w-6 text-white" />
                </div>
                <h2 className="font-display text-2xl font-bold text-white">
                  Set new password
                </h2>
                <p className="mt-1.5 text-sm text-white/70">
                  Must be at least 8 characters with 1 number and 1 special
                  character.
                </p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="font-medium text-white/90">
                    New password
                  </Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3 h-5 w-5 text-white/50" />
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="••••••••"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-11 border-white/15 bg-white/10 pl-10 text-white placeholder:text-white/40 backdrop-blur focus-visible:border-white/40 focus-visible:ring-white/30"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="confirm-password"
                    className="font-medium text-white/90"
                  >
                    Confirm password
                  </Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3 h-5 w-5 text-white/50" />
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="••••••••"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-11 border-white/15 bg-white/10 pl-10 text-white placeholder:text-white/40 backdrop-blur focus-visible:border-white/40 focus-visible:ring-white/30"
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-400/30 bg-red-500/15 p-3 text-sm font-medium text-red-200 backdrop-blur">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full bg-white text-base font-semibold text-slate-900 shadow-xl shadow-black/30 hover:bg-white/90"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      Reset password
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>
            </>
          )}

          {/* ── Success State ────────────────────────────────────────── */}
          {step === "success" && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-400/15 backdrop-blur">
                <CheckCircle2 className="h-8 w-8 text-emerald-300" />
              </div>
              <h2 className="font-display text-2xl font-bold text-white">
                Password reset!
              </h2>
              <p className="mt-2 text-sm text-white/70">
                Your password has been successfully changed. All previous
                sessions have been invalidated for security.
              </p>
              <Button
                onClick={() => router.push("/login")}
                className="mt-6 h-11 w-full bg-white text-base font-semibold text-slate-900 shadow-xl shadow-black/30 hover:bg-white/90"
              >
                Back to sign in
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          )}

          {/* Back to sign in link (non-success steps only) */}
          {step !== "success" && (
            <div className="mt-6 border-t border-white/10 pt-6 text-center">
              <p className="text-sm text-white/70">
                Remember your password?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-white hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-white/70">
          <Link href="/" className="transition-colors hover:text-white">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
