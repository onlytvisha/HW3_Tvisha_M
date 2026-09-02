"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/artists", label: "Archive" },
  { href: "/charts", label: "Charts" },
  { href: "/about", label: "About the data" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="border-sw-line/60 bg-sw-base/80 sticky top-0 z-50 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-heading sw-glow-pink text-sw-pink text-lg font-bold tracking-[0.2em] uppercase">
            Neon
          </span>
          <span className="font-heading sw-glow-cyan text-sw-cyan text-lg font-bold tracking-[0.2em] uppercase">
            Archive
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors",
                isActive(pathname, item.href)
                  ? "text-sw-cyan bg-sw-surface-2/70"
                  : "text-sw-text-dim hover:text-sw-text hover:bg-sw-surface-2/50",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="ml-auto md:hidden">
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-sw-base border-sw-line w-64">
            <SheetHeader>
              <SheetTitle className="font-heading tracking-[0.2em] uppercase">
                Neon Archive
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-4">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-md px-3 py-2.5 text-sm transition-colors",
                    isActive(pathname, item.href)
                      ? "text-sw-cyan bg-sw-surface-2/70"
                      : "text-sw-text-dim hover:text-sw-text hover:bg-sw-surface-2/50",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
