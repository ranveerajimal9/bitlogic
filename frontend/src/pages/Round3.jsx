import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Code2, ArrowLeft, Loader2, Save, FileCode2, Terminal } from "lucide-react";

const STARTER = `public class Main {
    public static void main(String[] args) {
        // Write your solution here
        System.out.println("Hello, Bitlogic!");
    }
}
`;

export default function Round3() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState(STARTER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allowed, setAllowed] = useState(true);
  const taRef = useRef(null);
  const lineRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: comp } = await api.get("/competition");
        if (!comp.started || comp.current_round < 3 || (user && user.qualified_round < 3) || comp.finalized_rounds?.includes(3)) {
          setAllowed(false);
          setLoading(false);
          return;
        }
        const { data: subs } = await api.get("/me/submissions");
        if (subs["3"]?.content) setCode(subs["3"].content);
      } catch (e) {
        setAllowed(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/rounds/3/submit", { round: 3, content: code });
      toast.success("Code submitted to the judges!");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.target;
      const start = el.selectionStart, end = el.selectionEnd;
      const next = code.substring(0, start) + "    " + code.substring(end);
      setCode(next);
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 4; });
    }
  };

  const syncScroll = () => {
    if (lineRef.current && taRef.current) lineRef.current.scrollTop = taRef.current.scrollTop;
  };

  const lines = code.split("\n");

  if (loading) return <div className="grain min-h-screen"><Navbar /><div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></div>;

  if (!allowed) return (
    <div className="grain min-h-screen"><Navbar />
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <h1 className="font-display font-bold text-3xl">Round 3 isn't available</h1>
        <p className="text-muted-foreground mt-3">This round may be locked, closed, or you may not be qualified.</p>
        <Button onClick={() => navigate("/dashboard")} className="mt-6 rounded-full bg-primary text-black">Back to Dashboard</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#08080b]">
      <Navbar />
      <div className="border-b border-white/10 bg-black/40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} data-testid="back-btn"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
            <div className="flex items-center gap-2"><Code2 className="w-5 h-5 text-accent" /><span className="font-display font-bold text-lg">Round 3 — CodeMasters</span></div>
          </div>
          <Button onClick={save} disabled={saving} data-testid="round3-submit" className="rounded-full bg-accent text-black hover:bg-accent/90 font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Submit Code</>}
          </Button>
        </div>
      </div>

      <div className="flex-1 grid lg:grid-cols-[300px_1fr] max-w-[1600px] w-full mx-auto">
        {/* Problem panel */}
        <aside className="border-r border-white/10 bg-black/30 p-5 hidden lg:block overflow-y-auto" style={{ maxHeight: "calc(100vh - 64px - 57px)" }}>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3"><FileCode2 className="w-4 h-4" /> Problem</div>
          <h2 className="font-display font-bold text-lg">Solve the challenge</h2>
          <p className="text-sm text-muted-foreground mt-3">
            Write a Java program that solves the problem assigned by the judges. Your solution is graded on correctness, logic, efficiency and your explanation.
          </p>
          <div className="mt-5 space-y-2 text-xs text-muted-foreground">
            <p className="text-foreground/70 font-medium">Tips</p>
            <p>• Use a <span className="font-mono text-accent">Main</span> class with a <span className="font-mono text-accent">main</span> method.</p>
            <p>• Press Tab to indent.</p>
            <p>• Submit early and often — your latest code is what judges see.</p>
          </div>
        </aside>

        {/* Editor */}
        <div className="flex flex-col bg-[#0b0b10]" style={{ height: "calc(100vh - 64px - 57px)" }}>
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-black/40 text-xs text-muted-foreground">
            <span className="font-mono">Main.java</span>
          </div>
          <div className="flex-1 flex overflow-hidden scanlines">
            <div ref={lineRef} className="code-area text-right text-white/25 py-4 px-3 select-none overflow-hidden bg-black/20" style={{ minWidth: 52 }}>
              {lines.map((_, i) => <div key={i}>{i + 1}</div>)}
            </div>
            <textarea
              ref={taRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={onKeyDown}
              onScroll={syncScroll}
              spellCheck={false}
              data-testid="java-editor"
              className="code-area flex-1 bg-transparent text-accent/90 outline-none resize-none py-4 px-4 caret-accent"
            />
          </div>
          <div className="border-t border-white/10 bg-black/40 px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Terminal className="w-3.5 h-3.5" /> {lines.length} lines · Reviewed manually by the judges
          </div>
        </div>
      </div>
    </div>
  );
}
