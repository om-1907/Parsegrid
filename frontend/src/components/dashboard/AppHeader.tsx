"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut, User as UserIcon, LifeBuoy } from "lucide-react";
import { ParsegridLogo } from "@/components/ParsegridLogo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch, apiUrl } from "@/lib/api";

interface Me {
  email?: string;
}

export function AppHeader() {
  const [email, setEmail] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    apiFetch<Me>("/api/v1/auth/me")
      .then((me) => setEmail(me?.email ?? ""))
      .catch(() => setEmail(""));
  }, []);

  const handleLogout = async () => {
    try {
      await fetch(apiUrl("/api/v1/auth/logout"), { method: "POST", credentials: "include" });
    } catch {
      /* best-effort */
    }
    toast.success("Signed out");
    router.push("/login");
  };

  const initials = email ? email.slice(0, 2).toUpperCase() : "PG";

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <ParsegridLogo textClassName="text-white" />
          <span className="ml-1 hidden rounded-md bg-white/10 px-2 py-0.5 text-xs font-medium text-white/70 sm:inline">
            Workspace
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pl-1 pr-3 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 text-xs font-bold text-white">
                  {initials}
                </span>
                <span className="hidden max-w-[9rem] truncate text-sm font-medium text-white sm:block">
                  {email || "Account"}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex items-center gap-2 font-normal">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                <span className="truncate text-sm">{email || "Signed in"}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <LifeBuoy className="text-muted-foreground" />
                Help & docs
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
