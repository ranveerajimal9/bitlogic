import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Terminal, LogOut, Trophy, LayoutDashboard, ShieldCheck } from "lucide-react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const links = [];
  if (user && user.role === "student") {
    links.push({ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard });
  }
  if (user && user.role === "admin") {
    links.push({ to: "/admin", label: "Admin", icon: ShieldCheck });
  }
  links.push({ to: "/leaderboard", label: "Leaderboard", icon: Trophy });

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group" data-testid="nav-logo">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center glow-cyan group-hover:scale-105 transition-transform">
            <Terminal className="w-5 h-5 text-black" />
          </div>
          <span className="font-display font-extrabold text-lg tracking-tight">
            BIT<span className="text-primary">LOGIC</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {links.map((l) => {
            const Icon = l.icon;
            const active = pathname === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                data-testid={`nav-${l.label.toLowerCase()}`}
                className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                  active ? "text-primary bg-white/5" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{l.label}</span>
              </Link>
            );
          })}
          {user ? (
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              data-testid="nav-logout"
              className="text-muted-foreground hover:text-secondary ml-1"
            >
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          ) : (
            <Button
              onClick={() => navigate("/login")}
              size="sm"
              data-testid="nav-login"
              className="ml-1 rounded-full bg-primary text-black hover:bg-primary/90 font-semibold"
            >
              Login
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
