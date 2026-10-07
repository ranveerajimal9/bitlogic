import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Puzzle, ArrowLeft, Loader2, Send, CheckCircle2 } from "lucide-react";

export default function Round2() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [puzzles, setPuzzles] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allowed, setAllowed] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: comp } = await api.get("/competition");
        if (!comp.started || comp.current_round < 2 || (user && user.qualified_round < 2) || comp.finalized_rounds?.includes(2)) {
          setAllowed(false);
          setLoading(false);
          return;
        }
        const [{ data: pz }, { data: subs }] = await Promise.all([
          api.get("/puzzles"),
          api.get("/me/submissions"),
        ]);
        setPuzzles(pz);
        if (subs["2"]?.answers) {
          setAnswers(subs["2"].answers);
          setSubmitted(true);
        }
      } catch (e) {
        setAllowed(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const choose = (pid, idx) => setAnswers((a) => ({ ...a, [pid]: idx }));

  const submit = async () => {
    setSaving(true);
    try {
      const { data } = await api.post("/rounds/2/answers", { answers });
      toast.success(`Submitted! You got ${data.correct}/${data.total} correct.`);
      setSubmitted(true);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="grain min-h-screen"><Navbar /><div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></div>;

  if (!allowed) return (
    <div className="grain min-h-screen"><Navbar />
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <h1 className="font-display font-bold text-3xl">Round 2 isn't available</h1>
        <p className="text-muted-foreground mt-3">This round may be locked, closed, or you may not be qualified.</p>
        <Button onClick={() => navigate("/dashboard")} className="mt-6 rounded-full bg-primary text-black">Back to Dashboard</Button>
      </div>
    </div>
  );

  return (
    <div className="grain min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} data-testid="back-btn"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
          {submitted && <span className="text-sm text-accent flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Answers submitted</span>}
        </div>
        <div className="flex items-center gap-3 mb-2">
          <Puzzle className="w-7 h-7 text-secondary" />
          <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight">Round 2 — LogicQuest</h1>
        </div>
        <p className="text-muted-foreground mb-5">Solve the word & number puzzles. Choose the best answer for each. You can re-submit until the round closes.</p>

        <div className="glass rounded-2xl p-5 mb-8 grid sm:grid-cols-3 gap-4 text-sm" data-testid="round2-briefing">
          <div><p className="text-xs uppercase tracking-widest text-muted-foreground">Focus</p><p className="mt-1">Logical reasoning, mathematics & language logic</p></div>
          <div><p className="text-xs uppercase tracking-widest text-muted-foreground">Time</p><p className="mt-1 text-secondary font-medium">60 minutes (recommended)</p></div>
          <div><p className="text-xs uppercase tracking-widest text-muted-foreground">Selection</p><p className="mt-1">Top 5 qualify for Round 3</p></div>
        </div>

        {puzzles.length === 0 && (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground" data-testid="no-puzzles">
            No puzzles have been published yet. Check back shortly.
          </div>
        )}

        <div className="space-y-5">
          {puzzles.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="glass rounded-2xl p-6" data-testid={`puzzle-${i}`}>
              <div className="flex gap-3">
                <span className="font-mono font-bold text-secondary shrink-0">Q{i + 1}.</span>
                <p className="font-medium">{p.question}</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                {p.options.map((opt, idx) => {
                  const selected = answers[p.id] === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => choose(p.id, idx)}
                      data-testid={`puzzle-${i}-option-${idx}`}
                      className={`text-left px-4 py-3 rounded-xl border transition-colors ${
                        selected ? "border-secondary bg-secondary/15 text-foreground" : "border-white/10 hover:border-white/25 text-muted-foreground"
                      }`}
                    >
                      <span className="font-mono text-xs mr-2 opacity-60">{String.fromCharCode(65 + idx)}</span>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>

        {puzzles.length > 0 && (
          <div className="sticky bottom-4 mt-8">
            <Button onClick={submit} disabled={saving} data-testid="round2-submit" className="w-full h-12 rounded-full bg-secondary text-white hover:bg-secondary/90 font-semibold glow-pink">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Submit Answers</>}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
