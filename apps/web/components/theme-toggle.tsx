"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Theme = "light" | "dark" | "system";

// Must match the key read by the inline no-flash script in app/layout.tsx.
const STORAGE_KEY = "theme";

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function resolveDark(theme: Theme): boolean {
  return (
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", resolveDark(theme));
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  // Read the stored preference after mount; the inline layout script has
  // already applied it to <html>, so this only syncs the toggle state.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setTheme(isTheme(stored) ? stored : "system");
  }, []);

  // While on "system", follow OS changes live.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  function select(next: Theme) {
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  return (
    <ToggleGroup
      type="single"
      value={theme}
      onValueChange={(value) => {
        if (isTheme(value)) select(value);
      }}
      variant="outline"
      size="sm"
      spacing={0}
      aria-label="Theme"
    >
      <ToggleGroupItem value="light" aria-label="Light theme" title="Light theme">
        <Sun />
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" aria-label="Dark theme" title="Dark theme">
        <Moon />
      </ToggleGroupItem>
      <ToggleGroupItem value="system" aria-label="System theme" title="System theme">
        <Monitor />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
