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
  const extractError = (data: any, fallback: string): string => {
    let msg = data?.detail || fallback;
    if (Array.isArray(msg)) {
      msg = msg.map((err: any) => err.msg || JSON.stringify(err)).join(", ");
    } else if (typeof msg === "object") {
      msg = JSON.stringify(msg);
    }
    return msg;
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
    <div className="flex min-h-screen bg-background">
      {/* Brand side — same as login */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-[#070914] p-12 lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,#111827_0%,#070914_60%)]" />
        <div className="absolute inset-0 bg-grid opacity-[0.12]" />
        <div className="absolute -left-20 top-1/3 h-96 w-96 rounded-full bg-white/10 blur-[120px]" />
        <div className="absolute bottom-10 right-0 h-80 w-80 rounded-full bg-cyan-500/10 blur-[110px]" />

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2.5">
            <ParsegridLogo className="h-10 w-10 text-white" textClassName="text-white" />
          </Link>

          <div className="mt-28 max-w-lg space-y-6">
            <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-white md:text-5xl">
              Secure password{" "}
              <span className="bg-gradient-to-r from-slate-200 to-slate-400 bg-clip-text text-transparent">
                recovery.
              </span>
            </h1>
            <p className="text-lg leading-relaxed text-white/60">
              We use enterprise-grade security to protect your account. Your OTP
              is encrypted, time-limited, and locked after 3 failed attempts.
            </p>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-6 text-white/50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <span className="text-sm font-medium">Encrypted OTP</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-slate-400" />
            <span className="text-sm font-medium">Brute-force protection</span>
          </div>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-cyan-400" />
            <span className="text-sm font-medium">Session invalidation</span>
          </div>
        </div>
      </div>

      {/* Form side */}
      <div className="relative flex flex-1 items-center justify-center bg-white p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
            <ParsegridLogo className="h-9 w-9" />
          </div>

          <div className="rounded-2xl border border-border bg-card p-8 shadow-2xl shadow-black/5">
            {/* Step progress bar */}
            {step !== "success" && (
              <div className="mb-8">
                <div className="flex items-center justify-between">
                  {steps.map((s, i) => (
                    <div key={s.key} className="flex items-center">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                          i <= currentStepIndex
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-400"
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
                            i < currentStepIndex ? "bg-slate-900" : "bg-slate-200"
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
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
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <Mail className="h-6 w-6 text-slate-900" />
                  </div>
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    Forgot password?
                  </h2>
                  <p className="mt-1.5 text-muted-foreground">
                    Enter your email and we&apos;ll send you a verification code.
                  </p>
                </div>

                <form onSubmit={handleForgotPassword} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-medium text-foreground">
                      Email address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="name@company.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 pl-10"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-11 w-full bg-slate-900 text-base font-medium text-white hover:bg-slate-800"
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
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <ShieldCheck className="h-6 w-6 text-slate-900" />
                  </div>
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    Enter verification code
                  </h2>
                  <p className="mt-1.5 text-muted-foreground">
                    We sent a 6-digit code to{" "}
                    <span className="font-medium text-foreground">{email}</span>.
                    It expires in 10 minutes.
                  </p>
                </div>

                <form onSubmit={handleVerifyOTP} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="otp" className="font-medium text-foreground">
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
                      className="h-11 text-center text-2xl font-mono tracking-[0.5em]"
                    />
                  </div>

                  {error && (
                    <div className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading || otp.length !== 6}
                    className="h-11 w-full bg-slate-900 text-base font-medium text-white hover:bg-slate-800"
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
                  className="mt-4 flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
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
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <Lock className="h-6 w-6 text-slate-900" />
                  </div>
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    Set new password
                  </h2>
                  <p className="mt-1.5 text-muted-foreground">
                    Must be at least 8 characters with 1 number and 1 special
                    character.
                  </p>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="font-medium text-foreground">
                      New password
                    </Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="new-password"
                        type="password"
                        placeholder="••••••••"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="h-11 pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="confirm-password"
                      className="font-medium text-foreground"
                    >
                      Confirm password
                    </Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="••••••••"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-11 pl-10"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-11 w-full bg-slate-900 text-base font-medium text-white hover:bg-slate-800"
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
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground">
                  Password reset!
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Your password has been successfully changed. All previous
                  sessions have been invalidated for security.
                </p>
                <Button
                  onClick={() => router.push("/login")}
                  className="mt-6 h-11 w-full bg-slate-900 text-base font-medium text-white hover:bg-slate-800"
                >
                  Back to sign in
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            )}

            {/* Back to sign in link (non-success steps only) */}
            {step !== "success" && (
              <div className="mt-6 border-t border-border pt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Remember your password?{" "}
                  <Link
                    href="/login"
                    className="font-semibold text-slate-900 hover:underline"
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              ← Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
