import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useAuth, signOut } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Navbar() {
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  return (
    <nav className="flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
      <Link to="/" className="font-serif text-xl font-bold tracking-tight text-foreground">
        Hamduk <span className="text-primary">Chess</span>
      </Link>
      <div className="flex items-center gap-1 text-sm font-medium sm:gap-3">
        <Link to="/lobby" className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" activeProps={{ className: "text-primary" }}>Play Online</Link>
        <Link to="/puzzles" className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" activeProps={{ className: "text-primary" }}>Puzzles</Link>
        <Link to="/analysis" className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" activeProps={{ className: "text-primary" }}>Analysis</Link>
        <Link to="/leaderboard" className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" activeProps={{ className: "text-primary" }}>Leaderboard</Link>
        {user && (
          <>
            <Link to="/feed" className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" activeProps={{ className: "text-primary" }}>Feed</Link>
            <Link to="/messages" className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" activeProps={{ className: "text-primary" }}>Messages</Link>
          </>
        )}
        <ThemeToggle />
        {user ? (
          <>
            {isGuest && (
              <span className="hidden rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent sm:inline">Guest</span>
            )}
            <button
              onClick={async () => { await signOut(); navigate({ to: "/" }); }}
              className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-secondary-foreground hover:bg-secondary/80"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </>
        ) : (
          <Link to="/login" className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-foreground hover:bg-primary/90">Sign in</Link>
        )}
      </div>
    </nav>
  );
}
