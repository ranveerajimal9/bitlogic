import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Crown, Loader2 } from "lucide-react";

export default function Leaderboard() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    api.get("/leaderboard").then(({ data }) => setRows(data)).catch(() => setRows([]));
  }, []);

  const medal = (i) => (i === 0 ? "text-accent" : i === 1 ? "text-primary" : i === 2 ? "text-secondary" : "text-muted-foreground");

  return (
    <div className="grain min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="w-7 h-7 text-accent" />
          <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight">Leaderboard</h1>
        </div>
        <p className="text-muted-foreground mb-8">Ranked by total points across all three rounds.</p>

        {rows === null && <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}
        {rows && rows.length === 0 && <div className="glass rounded-2xl p-10 text-center text-muted-foreground">No participants yet.</div>}

        {rows && rows.length > 0 && (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[48px_1fr_repeat(4,minmax(48px,72px))] gap-2 px-4 sm:px-6 py-3 text-xs uppercase tracking-[0.15em] text-muted-foreground border-b border-white/10">
              <span>#</span><span>Name</span>
              <span className="text-center">R1</span><span className="text-center">R2</span><span className="text-center">R3</span>
              <span className="text-center text-primary">Total</span>
            </div>
            {rows.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`grid grid-cols-[48px_1fr_repeat(4,minmax(48px,72px))] gap-2 px-4 sm:px-6 py-4 items-center border-b border-white/5 ${r.overall_winner ? "bg-accent/5" : ""}`}
                data-testid={`leaderboard-row-${i}`}
              >
                <span className={`font-mono font-bold ${medal(i)}`}>
                  {r.overall_winner ? <Crown className="w-5 h-5" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="font-medium truncate block">{r.name}</span>
                  <span className="flex gap-1 mt-1 flex-wrap">
                    {r.overall_winner && <Badge className="bg-accent text-black text-[10px] py-0">Winner</Badge>}
                    {r.round_wins?.map((w) => <Badge key={w} variant="outline" className="text-[10px] py-0 border-secondary/40 text-secondary">R{w} win</Badge>)}
                    {r.eliminated && !r.overall_winner && <Badge variant="outline" className="text-[10px] py-0 border-white/10 text-muted-foreground">Out</Badge>}
                  </span>
                </span>
                <span className="text-center font-mono">{r.scores["1"] ?? "—"}</span>
                <span className="text-center font-mono">{r.scores["2"] ?? "—"}</span>
                <span className="text-center font-mono">{r.scores["3"] ?? "—"}</span>
                <span className="text-center font-mono font-bold text-primary">{r.total}</span>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
