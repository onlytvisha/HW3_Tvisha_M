"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  applyTheme,
  DEFAULT_THEME,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/theme";

/**
 * The store here is the document element itself rather than a React state
 * atom, because the inline script in layout.tsx has already written the
 * theme there before React runs. Reading the DOM keeps one source of truth;
 * holding a separate copy in state would mean the two could disagree for the
 * first frame after hydration.
 */
function subscribe(onStoreChange: () => void): () => void {
  // Another tab switched. `storage` does not fire in the tab that wrote the
  // value, so this branch only ever runs for changes made elsewhere - apply
  // them here so every open tab stays on the same theme.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    applyTheme(event.newValue === "paper" ? "paper" : "neon");
    onStoreChange();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
  };
}

function getSnapshot(): Theme {
  return document.documentElement.dataset.theme === "paper" ? "paper" : "neon";
}

function getServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

/**
 * Switches between the synthwave default and the calm paper palette.
 *
 * Shows the theme it will switch *to*, which is the convention every OS
 * dark-mode toggle uses and the one people already read correctly.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const next: Theme = theme === "paper" ? "neon" : "paper";

  const label =
    next === "paper" ? "Switch to the calm theme" : "Switch to the neon theme";

  function toggle() {
    applyTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private windows and blocked site data throw here. The switch still
      // works for this page; it just will not be remembered.
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={label}
          className={className}
        >
          {next === "paper" ? (
            <Sun className="size-5" />
          ) : (
            <Moon className="size-5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
