"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Bot, ArrowRight, ShieldCheck, Mail, KeyRound, Loader2, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { apiUrl } from "@/lib/api";

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
          const msg = data.detail || "Invalid email or password";
          setError(msg);
          toast.error(msg);
        }
      } else {
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
          const msg = data.detail || "Failed to register";
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
    <div className="flex min-h-screen bg-background">
      {/* Brand side */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-[#070914] p-12 lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,#1e1b4b_0%,#070914_60%)]" />
        <div className="absolute inset-0 bg-grid opacity-[0.12]" />
        <div className="absolute -left-20 top-1/3 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-10 right-0 h-80 w-80 rounded-full bg-cyan-500/10 blur-[110px]" />

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg shadow-indigo-500/30">
              <span className="text-2xl font-bold leading-none tracking-tighter text-white">P</span>
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">Parsegrid</span>
          </Link>

          <div className="mt-28 max-w-lg space-y-6">
            <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-white md:text-5xl">
              Contract intelligence,{" "}
              <span className="bg-gradient-to-r from-indigo-300 to-cyan-300 bg-clip-text text-transparent">
                accelerated.
              </span>
            </h1>
            <p className="text-lg leading-relaxed text-white/60">
              Sign in to manage your extraction workflows. Automate review, minimize risk, and get
              actionable insights from every agreement.
            </p>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-6 text-white/50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <span className="text-sm font-medium">Enterprise security</span>
          </div>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-indigo-400" />
            <span className="text-sm font-medium">Agentic AI</span>
          </div>
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-cyan-400" />
            <span className="text-sm font-medium">Confidence scoring</span>
          </div>
        </div>
      </div>

      {/* Form side */}
      <div className="relative flex flex-1 items-center justify-center p-6 sm:p-12">
        <div className="absolute right-6 top-6">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400">
              <span className="text-xl font-bold leading-none tracking-tighter text-white">P</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">Parsegrid</span>
          </div>

          <div className="rounded-2xl border border-border bg-card p-8 shadow-2xl shadow-black/5">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <KeyRound className="h-6 w-6 text-primary" />
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground">
                {isLogin ? "Welcome back" : "Create your account"}
              </h2>
              <p className="mt-1.5 text-muted-foreground">
                {isLogin
                  ? "Enter your credentials to access your workspace"
                  : "Sign up to start automating your contracts"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="font-medium text-foreground">
                    Password
                  </Label>
                  {isLogin && (
                    <span className="cursor-pointer text-sm font-medium text-primary hover:underline">
                      Forgot password?
                    </span>
                  )}
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pl-10"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading} className="h-11 w-full text-base font-medium">
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

            <div className="mt-6 border-t border-border pt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError("");
                  }}
                  className="ml-1.5 font-semibold text-primary hover:underline"
                >
                  {isLogin ? "Sign up" : "Sign in"}
                </button>
              </p>
            </div>
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
