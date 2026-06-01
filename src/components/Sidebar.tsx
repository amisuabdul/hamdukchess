import { Link, useNavigate } from "@tanstack/react-router";
import {
  Home,
  Puzzle,
  BarChart3,
  Trophy,
  Rss,
  MessageSquare,
  Swords,
  Sparkles,
  LogOut,
} from "lucide-react";
import { useAuth, signOut } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";

// Desktop sidebar (md+). Mobile uses BottomNav.
export function Sidebar() {
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();

  const topItems = [
    { to: "/", label: "Home", Icon: Home },
    { to: "/puzzles", label: "Puzzles", Icon: Puzzle },
    { to: "/analysis", label: "Analysis", Icon: BarChart3 },
    { to: "/leaderboard", label: "Leaderboard", Icon: Trophy },
    ...(user
      ? [
          { to: "/feed", label: "Feed", Icon: Rss },
          { to: "/messages", label: "Messages", Icon: MessageSquare },
        ]
      : []),
  ] as const;

  return (
    <aside
      aria-label="Primary"
      className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-background/95 backdrop-blur md:flex"
    >
      <Link
        to="/"
        className="px-5 py-4 font-serif text-xl font-bold tracking-tight text-foreground"
      >
        Hamduk <span className="text-primary">Chess</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {topItems.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            activeProps={{ className: "bg-accent text-primary" }}
            activeOptions={{ exact: to === "/" }}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}

        <div className="mt-auto flex flex-col gap-2 pb-3 pt-4">
          <Link
            to="/lobby"
            className="mx-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            activeProps={{ className: "ring-2 ring-primary/40" }}
          >
            <Swords className="h-4 w-4" />
            Play Online
          </Link>

          <div className="flex items-center justify-between gap-2 px-2">
            <ThemeToggle />
            {user ? (
              <button
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1.5 text-xs text-secondary-foreground hover:bg-secondary/80"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            ) : (
              <Link
                to="/login"
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Sign in
              </Link>
            )}
          </div>
          {user && isGuest && (
            <span className="mx-2 rounded-full bg-accent/20 px-2 py-0.5 text-center text-[10px] font-semibold text-accent">
              Guest account
            </span>
          )}
        </div>
      </nav>
    </aside>
  );
}
