import { Link } from "@tanstack/react-router";
import { Swords, Puzzle, BarChart3, Rss, Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth";

// Mobile-only bottom navigation. Hidden on >= md.
export function BottomNav() {
  const { user } = useAuth();
  const items = [
    { to: "/lobby", label: "Play", Icon: Swords },
    { to: "/puzzles", label: "Puzzles", Icon: Puzzle },
    { to: "/analysis", label: "Analyze", Icon: BarChart3 },
    user
      ? { to: "/feed", label: "Feed", Icon: Rss }
      : { to: "/leaderboard", label: "Top", Icon: Trophy },
    { to: "/leaderboard", label: "Ranks", Icon: Trophy },
  ] as const;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-background/95 pb-safe backdrop-blur md:hidden"
    >
      {items.map(({ to, label, Icon }) => (
        <Link
          key={`${to}-${label}`}
          to={to}
          className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          activeProps={{ className: "text-primary" }}
        >
          <Icon className="h-5 w-5" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
