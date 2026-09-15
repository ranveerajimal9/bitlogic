import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Countdown from "@/components/Countdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Blocks, Puzzle, Code2, Lock, Clock, Trophy, CheckCircle2, XCircle, ArrowRight } from "lucide-react";

const ROUND_META = {
  1: { title: "CodeCraft", tag: "Scratch story / game", icon: Blocks, color: "text-primary", path: "/round/1" },
  2: { title: "LogicQuest", tag: "Puzzle round", icon: Puzzle, color: "text-secondary", path: "/round/2" },
  3: { title: "CodeMasters", tag: "Java programming", icon: Code2, color: "text-accent", path: "/round/3" },
};

export default function Dashboard() {
  const { user, refresh } = useAuth();
  const [comp, setComp] = useState(null);

  const load = useCallback(async () => {
    const { data } = await api.get("/competition");
    setComp(data);
    await refresh();
  }, [refresh]);

  useEffect(() => { load(); }, [load]);

  if (!comp || !user) return null;

  const started = comp.started;
  const hasDate = !!comp.start_datetime;
  const scores = user.scores || {};
  const total = Object.values(scores).reduce((a, v) => a + (typeof v === "number" ? v : 0), 0);

  const roundState = (n) => {
    if (comp.finalized_rounds?.includes(n)) return "finalized";
    if (comp.current_round < n) return "locked";
    if (user.qualified_round < n) return "not-qualified";
    return "open";
  };

  return (
    <div className="grain min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Student Dashboard</p>
              <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-1">
                Hey, {user.name.split(" ")[0]}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {user.overall_winner && <Badge className="bg-accent text-black font-semibold"><Trophy className="w-3.5 h-3.5 mr-1" /> Overall Winner</Badge>}
              {user.round_wins?.map((r) => (
                <Badge key={r} className="bg-secondary text-white"><Trophy className="w-3.5 h-3.5 mr-1" /> Round {r} Winner</Badge>
              ))}
              {user.eliminated && !user.overall_winner && (
                <Badge variant="outline" className="border-white/20 text-muted-foreground" data-testid="eliminated-badge">Eliminated</Badge>
              )}
            </div>
          </div>
        </motion.div>

        {/* GATE */}
        {!started && (
          <div className="mt-8 glass rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden" data-testid="dashboard-gate">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
            <div className="relative">
              <Clock className="w-10 h-10 text-primary mx-auto" />
              <h2 className="font-display font-bold text-2xl sm:text-3xl mt-4">
                {hasDate ? "The competition hasn't started yet" : "Start date to be announced"}
              </h2>
              <p className="text-muted-foreground mt-2">Rounds unlock the moment the countdown hits zero.</p>
              {hasDate && <div className="flex justify-center mt-8"><Countdown target={comp.start_datetime} /></div>}
            </div>
          </div>
        )}

        {started && (
          <>
            {/* SCORE STRIP */}
            <div className="mt-8 grid sm:grid-cols-4 gap-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="glass rounded-2xl p-5" data-testid={`score-round-${n}`}>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Round {n}</p>
                  <p className="font-mono font-bold text-3xl mt-2">
                    {typeof scores[n] === "number" ? scores[n] : "—"}
                    <span className="text-base text-muted-foreground">/10</span>
                  </p>
                </div>
              ))}
              <div className="glass rounded-2xl p-5 border-primary/30" data-testid="score-total">
                <p className="text-xs uppercase tracking-[0.2em] text-primary">Total</p>
                <p className="font-mono font-bold text-3xl mt-2 text-primary text-glow-cyan">{total}<span className="text-base text-muted-foreground">/30</span></p>
              </div>
            </div>

            {/* ROUND CARDS */}
            <div className="mt-6 grid md:grid-cols-3 gap-5">
              {[1, 2, 3].map((n) => {
                const meta = ROUND_META[n];
                const Icon = meta.icon;
                const state = roundState(n);
                return (
                  <div key={n} className="glass rounded-2xl p-6 flex flex-col" data-testid={`dashboard-round-${n}`}>
                    <div className="flex items-center justify-between mb-4">
                      <Icon className={`w-8 h-8 ${meta.color}`} />
                      <span className="font-mono text-4xl font-bold text-white/10">0{n}</span>
                    </div>
                    <h3 className="font-display font-bold text-xl">{meta.title}</h3>
                    <p className={`text-sm ${meta.color}`}>{meta.tag}</p>

                    <div className="mt-auto pt-5">
                      {state === "open" && (
                        <Link to={meta.path}>
                          <Button className="w-full rounded-full bg-primary text-black hover:bg-primary/90 font-semibold" data-testid={`enter-round-${n}`}>
                            Enter Round <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </Link>
                      )}
                      {state === "locked" && (
                        <Button disabled className="w-full rounded-full" variant="outline"><Lock className="w-4 h-4 mr-2" /> Locked</Button>
                      )}
                      {state === "not-qualified" && (
                        <Button disabled className="w-full rounded-full" variant="outline"><XCircle className="w-4 h-4 mr-2" /> Not Qualified</Button>
                      )}
                      {state === "finalized" && (
                        <Button disabled className="w-full rounded-full" variant="outline"><CheckCircle2 className="w-4 h-4 mr-2" /> Round Closed</Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
