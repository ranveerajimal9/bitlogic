import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Terminal, Loader2 } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = await login(email, password);
      navigate(u.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grain min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-1/4 -left-24 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-24 w-72 h-72 bg-secondary/10 rounded-full blur-3xl" />
      <div className="relative w-full max-w-md glass rounded-3xl p-8 sm:p-10">
        <Link to="/" className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center glow-cyan">
            <Terminal className="w-5 h-5 text-black" />
          </div>
          <span className="font-display font-extrabold text-lg tracking-tight">BIT<span className="text-primary">LOGIC</span></span>
        </Link>
        <h1 className="font-display font-bold text-3xl tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground mt-2 text-sm">Log in as a student or admin to continue.</p>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <div>
            <Label htmlFor="email" className="text-xs uppercase tracking-widest text-muted-foreground">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="login-email" className="mt-2 bg-black/40 border-white/10 h-11" placeholder="you@example.com" />
          </div>
          <div>
            <Label htmlFor="password" className="text-xs uppercase tracking-widest text-muted-foreground">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="login-password" className="mt-2 bg-black/40 border-white/10 h-11" placeholder="••••••••" />
          </div>
          {error && <p className="text-sm text-secondary" data-testid="login-error">{error}</p>}
          <Button type="submit" disabled={loading} data-testid="login-submit" className="w-full h-11 rounded-full bg-primary text-black hover:bg-primary/90 font-semibold">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Log In"}
          </Button>
        </form>
        <p className="mt-6 text-sm text-muted-foreground text-center">
          New here?{" "}
          <Link to="/register" className="text-primary hover:underline" data-testid="login-to-register">Create a student account</Link>
        </p>
      </div>
    </div>
  );
}
