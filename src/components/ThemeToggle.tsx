import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { getStoredTheme, setTheme, type Theme } from "@/lib/theme";

const ORDER: Theme[] = ["light", "dark", "system"];

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setLocal] = useState<Theme>("system");

  useEffect(() => {
    setLocal(getStoredTheme());
  }, []);

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setLocal(next);
    setTheme(next);
  };

  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const label = theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System";

  return (
    <button
      onClick={cycle}
      title={`Theme: ${label} (click to cycle)`}
      aria-label={`Toggle theme, currently ${label}`}
      className={
        "inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium " +
        "bg-panel text-foreground ring-1 ring-border hover:bg-accent/10 transition-colors cursor-pointer " +
        className
      }
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
