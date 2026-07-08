"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Mail, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ParsegridLogo } from "@/components/ParsegridLogo";
import { FixedVideoBg } from "@/components/landing/FixedVideoBg";
import { apiUrl } from "@/lib/api";

/** Normalize a FastAPI `detail` (string | validation-array | object) into a message. */
function normalizeDetail(detail: unknown, fallback: string): string {
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
}

const PASSWORD_REQUIREMENT_MESSAGE =
  "Password must be at least 8 characters long, contain at least 1 digit, and contain at least 1 special character.";

function validatePasswordComplexity(value: string): string {
  const hasMinLength = value.length >= 8;
  const hasDigit = /\d/.test(value);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(value);

  return hasMinLength && hasDigit && hasSpecial ? "" : PASSWORD_REQUIREMENT_MESSAGE;
}

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isLogin) {
        const formData = new URLSearchParams();
        formData.append("username", email);
        formData.append("password", password);

        const res = await fetch(apiUrl("/api/v1/auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
          credentials: "include",
        });

        if (res.ok) {
          toast.success("Welcome back!");
          router.push("/dashboard");
        } else {
          const data = await res.json().catch(() => ({}));
          const msg = normalizeDetail(data?.detail, "Invalid email or password");
          setError(msg);
          toast.error(msg);
        }
      } else {
        const passwordError = validatePasswordComplexity(password);
        if (passwordError) {
          setError(passwordError);
          toast.error(passwordError);
          return;
        }

        const res = await fetch(apiUrl("/api/v1/auth/register"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (res.ok) {
          setIsLogin(true);
          setError("");
          toast.success("Account created — please sign in.");
        } else {
          const data = await res.json().catch(() => ({}));
          const msg = normalizeDetail(data?.detail, "Failed to register");
          setError(msg);
          toast.error(msg);
        }
      }
    } catch {
      const msg = "Network error. Is the backend running?";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

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

      {/* ---- Frosted glass sign-in card ---- */}
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-3xl border border-white/15 bg-white/[0.07] p-8 shadow-2xl shadow-black/50 backdrop-blur-2xl sm:p-10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur">
              <KeyRound className="h-6 w-6 text-white" />
            </div>
            <h2 className="font-display text-2xl font-bold text-white md:text-3xl">
              {isLogin ? "Welcome back" : "Create your account"}
            </h2>
            <p className="mt-1.5 text-sm text-white/70">
              {isLogin
                ? "Enter your credentials to access your workspace"
                : "Sign up to start automating your contracts"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="font-medium text-white/90">
                  Password
                </Label>
                {isLogin && (
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-white/80 hover:text-white hover:underline"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 h-5 w-5 text-white/50" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 border-white/15 bg-white/10 pl-10 text-white placeholder:text-white/40 backdrop-blur focus-visible:border-white/40 focus-visible:ring-white/30"
                />
              </div>
              {!isLogin && (
                <p className="text-xs leading-5 text-white/60">
                  Use at least 8 characters with 1 number and 1 special character.
                </p>
              )}
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
                  {isLogin ? "Sign in" : "Create account"}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 border-t border-white/10 pt-6 text-center">
            <p className="text-sm text-white/70">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                }}
                className="ml-1.5 font-semibold text-white hover:underline"
              >
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>



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
