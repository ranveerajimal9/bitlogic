import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Marquee from "react-fast-marquee";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Countdown from "@/components/Countdown";
import { Button } from "@/components/ui/button";
import { Blocks, Puzzle, Code2, ArrowRight, Sparkles, Clock } from "lucide-react";

const HERO = "https://images.unsplash.com/photo-1561233835-f937539b95b9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHw0fHxjeWJlciUyMHRlY2hub2xvZ3klMjBhY2tncm91bmR8ZW58MHx8fHwxNzg5NDc1NTgyfDA&ixlib=rb-4.1.0&q=85";
const ABOUT = "https://images.unsplash.com/photo-1631350397792-8e0c2de5b637?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxOTB8MHwxfHNlYXJjaHwyfHxzdHVkZW50cyUyMGNvZGluZyUyMGhhY2thdGhvbnxlbnwwfHx8fDE3ODk0NzU1ODF8MA&ixlib=rb-4.1.0&q=85";

const rounds = [
  { n: 1, title: "CodeCraft", tag: "Scratch story / game making", icon: Blocks, color: "text-primary", focus: "Creativity, Innovation & Computational Thinking", desc: "Build a Scratch-based story or game. 10 students qualify for Round 2 and 1 round winner is declared." },
  { n: 2, title: "LogicQuest", tag: "The Puzzle Round", icon: Puzzle, color: "text-secondary", focus: "Logical Reasoning & Problem Solving", desc: "Solve word and number puzzles testing patterns and analytical thinking. 5 students qualify for Round 3." },
  { n: 3, title: "CodeMasters", tag: "The Programming Round", icon: Code2, color: "text-accent", focus: "Programming & Computational Thinking", desc: "Finalists write Java solutions to programming problems and explain their logic. 1 Overall Winner is crowned." },
];

export default function Home() {
  const { user } = useAuth();
  const [comp, setComp] = useState(null);

  useEffect(() => {
    api.get("/competition").then(({ data }) => setComp(data)).catch(() => {});
  }, []);

  const started = comp?.started;
  const hasDate = !!comp?.start_datetime;

  return (
    <div className="grain min-h-screen">
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO} alt="" className="w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary border border-primary/30 rounded-full px-4 py-1.5 mb-6">
              <Sparkles className="w-3.5 h-3.5" /> Computer-Based Competition
            </span>
            <img
              src="/bitlogic-logo.png"
              alt="BITLOGIC"
              data-testid="hero-logo"
              className="w-52 sm:w-64 lg:w-72 h-auto -ml-2 animate-float drop-shadow-[0_0_40px_rgba(0,224,255,0.35)]"
            />
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-xl">
              Think. Create. Solve. Code. A three-round battle of creativity, logic and programming for the sharpest young minds.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              {user ? (
                <Link to={user.role === "admin" ? "/admin" : "/dashboard"}>
                  <Button size="lg" data-testid="hero-enter-btn" className="rounded-full bg-primary text-black hover:bg-primary/90 font-semibold hover:-translate-y-1 transition-transform">
                    Enter Arena <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/register">
                    <Button size="lg" data-testid="hero-register-btn" className="rounded-full bg-primary text-black hover:bg-primary/90 font-semibold hover:-translate-y-1 transition-transform">
                      Register Now <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button size="lg" variant="outline" data-testid="hero-login-btn" className="rounded-full border-white/20 hover:border-primary hover:text-primary hover:-translate-y-1 transition-all">
                      Login
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="border-y border-white/10 bg-black/40 py-4">
        <Marquee speed={55} gradient={false} className="font-display font-bold text-2xl sm:text-3xl">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="mx-8 text-foreground/80">
              THINK. <span className="text-primary">CREATE.</span> SOLVE. <span className="text-secondary">CODE.</span>
            </span>
          ))}
        </Marquee>
      </div>

      {/* COUNTDOWN */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24" id="countdown">
        <div className="glass rounded-3xl p-8 sm:p-12 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Clock className="w-4 h-4" /> {started ? "Competition is Live" : "Competition Begins In"}
            </span>
            {!hasDate && (
              <p className="mt-6 font-display text-2xl sm:text-3xl text-muted-foreground">
                Start date to be announced soon. Stay tuned!
              </p>
            )}
            {hasDate && started && (
              <p className="mt-6 font-display text-3xl sm:text-4xl text-accent" data-testid="competition-live">
                The arena is open — log in and play your round.
              </p>
            )}
            {hasDate && !started && <Countdown target={comp.start_datetime} className="mt-6" />}
          </div>
        </div>
      </section>

      {/* ROUNDS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mb-3">Competition Format</h2>
        <p className="text-muted-foreground mb-10 max-w-2xl">Progress from creative thinking to logical reasoning to programming application across three graded rounds.</p>
        <div className="grid md:grid-cols-3 gap-5">
          {rounds.map((r, i) => {
            const Icon = r.icon;
            return (
              <motion.div
                key={r.n}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass rounded-2xl p-6 hover:-translate-y-1 transition-transform"
                data-testid={`round-card-${r.n}`}
              >
                <div className="flex items-center justify-between mb-5">
                  <Icon className={`w-9 h-9 ${r.color}`} />
                  <span className="font-mono text-5xl font-bold text-white/10">0{r.n}</span>
                </div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Round {r.n}</div>
                <h3 className="font-display font-bold text-2xl mt-1">{r.title}</h3>
                <p className={`text-sm font-medium mt-1 ${r.color}`}>{r.tag}</p>
                <p className="text-sm text-muted-foreground mt-4">{r.desc}</p>
                <div className="mt-4 pt-4 border-t border-white/10 text-xs text-muted-foreground">
                  <span className="text-foreground/70">Focus:</span> {r.focus}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ABOUT */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-24">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <div className="rounded-3xl overflow-hidden border border-white/10">
            <img src={ABOUT} alt="Students coding" className="w-full h-full object-cover" />
          </div>
          <div>
            <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight">About Bitlogic</h2>
            <p className="mt-5 text-muted-foreground">
              Bitlogic nurtures creativity, logical reasoning, problem-solving, computational thinking and programming skills among students. The competition progressively challenges participants through Scratch, puzzles, and programming.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "All rounds are conducted individually within a stipulated time.",
                "Every round is graded separately, scored out of 10 by the judges.",
                "No pre-prepared projects — copying leads to disqualification.",
                "The decision of the judges is final and binding.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span className="text-muted-foreground">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-sm text-muted-foreground">
        <span className="font-display font-bold">BIT<span className="text-primary">LOGIC</span></span> — Think. Create. Solve. Code.
      </footer>
    </div>
  );
}
