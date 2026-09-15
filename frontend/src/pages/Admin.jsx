import { useEffect, useState, useCallback } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Settings2, Users, Puzzle, Trash2, Save, Trophy, Eye, RotateCcw, Plus, Flag, Loader2 } from "lucide-react";

export default function Admin() {
  const [comp, setComp] = useState(null);
  const [students, setStudents] = useState([]);
  const [puzzles, setPuzzles] = useState([]);
  const [dateInput, setDateInput] = useState("");

  const load = useCallback(async () => {
    const [{ data: c }, { data: s }, { data: p }] = await Promise.all([
      api.get("/competition"),
      api.get("/students"),
      api.get("/puzzles"),
    ]);
    setComp(c);
    setStudents(s);
    setPuzzles(p);
    if (c.start_datetime) {
      const d = new Date(c.start_datetime);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setDateInput(local);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!comp) return <div className="grain min-h-screen"><Navbar /><div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></div>;

  return (
    <div className="grain min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center gap-3 mb-6">
          <Settings2 className="w-7 h-7 text-primary" />
          <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight">Admin & Judge Panel</h1>
        </div>

        <Tabs defaultValue="control">
          <TabsList className="bg-black/40 border border-white/10">
            <TabsTrigger value="control" data-testid="tab-control"><Settings2 className="w-4 h-4 mr-2" /> Control</TabsTrigger>
            <TabsTrigger value="students" data-testid="tab-students"><Users className="w-4 h-4 mr-2" /> Students</TabsTrigger>
            <TabsTrigger value="puzzles" data-testid="tab-puzzles"><Puzzle className="w-4 h-4 mr-2" /> Puzzles</TabsTrigger>
          </TabsList>

          <TabsContent value="control"><ControlTab comp={comp} dateInput={dateInput} setDateInput={setDateInput} reload={load} /></TabsContent>
          <TabsContent value="students"><StudentsTab comp={comp} students={students} reload={load} /></TabsContent>
          <TabsContent value="puzzles"><PuzzlesTab puzzles={puzzles} reload={load} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function ControlTab({ comp, dateInput, setDateInput, reload }) {
  const [saving, setSaving] = useState(false);

  const saveDate = async () => {
    setSaving(true);
    try {
      const iso = dateInput ? new Date(dateInput).toISOString() : null;
      await api.put("/competition", { start_datetime: iso });
      toast.success("Start date updated");
      reload();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const setRound = async (r) => {
    try {
      await api.put("/competition", { current_round: r });
      toast.success(r === 0 ? "Competition set to Not Started" : `Round ${r} is now active`);
      reload();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const finalize = async (r) => {
    if (!window.confirm(`Finalize Round ${r}? This selects qualifiers${r < 3 ? "" : " and the overall winner"} and closes the round.`)) return;
    try {
      await api.post(`/rounds/${r}/finalize`);
      toast.success(`Round ${r} finalized`);
      reload();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const reset = async () => {
    if (!window.confirm("Reset the entire competition? All scores, qualifications and submissions will be cleared.")) return;
    try { await api.post("/rounds/reset"); toast.success("Competition reset"); reload(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  return (
    <div className="mt-6 grid lg:grid-cols-2 gap-5">
      <div className="glass rounded-2xl p-6">
        <h3 className="font-display font-bold text-xl mb-1">Start Date & Time</h3>
        <p className="text-sm text-muted-foreground mb-4">Until this moment, students only see a countdown.</p>
        <div className="flex gap-2">
          <Input type="datetime-local" value={dateInput} onChange={(e) => setDateInput(e.target.value)} data-testid="start-datetime" className="bg-black/40 border-white/10 h-11" />
          <Button onClick={saveDate} disabled={saving} data-testid="save-datetime" className="rounded-full bg-primary text-black font-semibold shrink-0">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Status: {comp.started ? <span className="text-accent">Live</span> : <span className="text-secondary">Not started</span>}
        </p>
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="font-display font-bold text-xl mb-1">Active Round</h3>
        <p className="text-sm text-muted-foreground mb-4">Open a round so qualified students can play it.</p>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((r) => (
            <Button key={r} onClick={() => setRound(r)} data-testid={`set-round-${r}`}
              variant={comp.current_round === r ? "default" : "outline"}
              className={`rounded-full ${comp.current_round === r ? "bg-primary text-black" : "border-white/15"}`}>
              {r === 0 ? "Not Started" : `Round ${r}`}
            </Button>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl p-6 lg:col-span-2">
        <h3 className="font-display font-bold text-xl mb-1">Finalize Rounds</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Finalizing Round 1 keeps the top <b>10</b> students and marks the round winner. Round 2 keeps the top <b>5</b>. Round 3 declares the <b>overall winner</b> (highest points). Finalizing closes the round.
        </p>
        <div className="flex flex-wrap gap-3">
          {[1, 2, 3].map((r) => {
            const done = comp.finalized_rounds?.includes(r);
            return (
              <Button key={r} onClick={() => finalize(r)} disabled={done} data-testid={`finalize-round-${r}`}
                className={`rounded-full font-semibold ${done ? "" : "bg-secondary text-white hover:bg-secondary/90"}`}
                variant={done ? "outline" : "default"}>
                <Flag className="w-4 h-4 mr-2" /> {done ? `Round ${r} Finalized` : `Finalize Round ${r}`}
              </Button>
            );
          })}
          <Button onClick={reset} variant="outline" data-testid="reset-competition" className="rounded-full border-destructive/40 text-destructive hover:bg-destructive/10 ml-auto">
            <RotateCcw className="w-4 h-4 mr-2" /> Reset Competition
          </Button>
        </div>
      </div>
    </div>
  );
}

function StudentsTab({ comp, students, reload }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const addStudent = async () => {
    if (!name || !email || !password) { toast.error("All fields required"); return; }
    try {
      await api.post("/students", { name, email, password });
      toast.success("Student added");
      setName(""); setEmail(""); setPassword("");
      reload();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this student?")) return;
    await api.delete(`/students/${id}`);
    toast.success("Deleted");
    reload();
  };

  return (
    <div className="mt-6 space-y-5">
      <div className="glass rounded-2xl p-6">
        <h3 className="font-display font-bold text-xl mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-primary" /> Add Student</h3>
        <div className="grid sm:grid-cols-4 gap-3">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} data-testid="new-student-name" className="bg-black/40 border-white/10 h-11" />
          <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="new-student-email" className="bg-black/40 border-white/10 h-11" />
          <Input placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="new-student-password" className="bg-black/40 border-white/10 h-11" />
          <Button onClick={addStudent} data-testid="add-student-btn" className="rounded-full bg-primary text-black font-semibold h-11">Add</Button>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-xs uppercase tracking-[0.15em] text-muted-foreground border-b border-white/10">
              <th className="text-left px-5 py-3">Student</th>
              <th className="px-3 py-3">Qualified</th>
              <th className="px-3 py-3">R1</th><th className="px-3 py-3">R2</th><th className="px-3 py-3">R3</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">No students yet.</td></tr>}
            {students.map((s) => <StudentRow key={s.id} s={s} reload={reload} onDelete={del} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StudentRow({ s, reload, onDelete }) {
  const [vals, setVals] = useState({ 1: s.scores["1"] ?? "", 2: s.scores["2"] ?? "", 3: s.scores["3"] ?? "" });
  const [subs, setSubs] = useState(null);

  const saveScore = async (round) => {
    const v = vals[round];
    if (v === "" || v === null) return;
    const num = Number(v);
    if (isNaN(num) || num < 0 || num > 10) { toast.error("Points must be 0–10"); return; }
    try {
      await api.put(`/students/${s.id}/score`, { round: Number(round), points: num });
      toast.success(`R${round} score saved for ${s.name}`);
      reload();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const loadSubs = async () => {
    const { data } = await api.get(`/students/${s.id}/submissions`);
    setSubs(data);
  };

  return (
    <tr className="border-b border-white/5" data-testid={`student-row-${s.id}`}>
      <td className="px-5 py-3">
        <div className="font-medium flex items-center gap-2">
          {s.name}
          {s.overall_winner && <Trophy className="w-4 h-4 text-accent" />}
        </div>
        <div className="text-xs text-muted-foreground">{s.email}</div>
      </td>
      <td className="px-3 py-3 text-center">
        {s.eliminated ? <Badge variant="outline" className="border-white/10 text-muted-foreground">Out</Badge>
          : <Badge className="bg-accent/15 text-accent border-0">R{s.qualified_round}+</Badge>}
      </td>
      {[1, 2, 3].map((r) => (
        <td key={r} className="px-2 py-3">
          <div className="flex items-center gap-1">
            <Input value={vals[r]} onChange={(e) => setVals((p) => ({ ...p, [r]: e.target.value }))}
              type="number" min={0} max={10} data-testid={`score-input-${s.id}-${r}`}
              className="w-16 h-9 bg-black/40 border-white/10 text-center" />
            <Button size="sm" variant="ghost" onClick={() => saveScore(r)} data-testid={`save-score-${s.id}-${r}`} className="h-9 px-2 text-primary hover:text-primary">
              <Save className="w-4 h-4" />
            </Button>
          </div>
        </td>
      ))}
      <td className="px-3 py-3">
        <div className="flex items-center gap-1">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" onClick={loadSubs} data-testid={`view-subs-${s.id}`} className="h-9"><Eye className="w-4 h-4" /></Button>
            </DialogTrigger>
            <DialogContent className="glass border-white/10 max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-display">{s.name}'s submissions</DialogTitle></DialogHeader>
              <SubmissionsView subs={subs} />
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="ghost" onClick={() => onDelete(s.id)} data-testid={`delete-student-${s.id}`} className="h-9 text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
        </div>
      </td>
    </tr>
  );
}

function SubmissionsView({ subs }) {
  if (!subs) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (Object.keys(subs).length === 0) return <p className="text-muted-foreground text-sm">No submissions yet.</p>;
  return (
    <div className="space-y-5">
      {subs["1"] && (
        <div>
          <p className="text-xs uppercase tracking-widest text-primary mb-1">Round 1 — Scratch</p>
          {subs["1"].content ? <a href={subs["1"].content} target="_blank" rel="noreferrer" className="text-accent underline break-all">{subs["1"].content}</a> : <p className="text-muted-foreground text-sm">No link submitted.</p>}
        </div>
      )}
      {subs["2"] && (
        <div>
          <p className="text-xs uppercase tracking-widest text-secondary mb-1">Round 2 — Puzzle</p>
          <p className="text-sm">Correct: <span className="font-mono text-accent">{subs["2"].correct_count}</span> / {subs["2"].total_questions}</p>
        </div>
      )}
      {subs["3"] && (
        <div>
          <p className="text-xs uppercase tracking-widest text-accent mb-1">Round 3 — Java Code</p>
          <pre className="code-area text-xs bg-black/50 rounded-xl p-4 overflow-x-auto text-accent/90 whitespace-pre-wrap">{subs["3"].content || "No code submitted."}</pre>
        </div>
      )}
    </div>
  );
}

function PuzzlesTab({ puzzles, reload }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);

  const add = async () => {
    const clean = options.map((o) => o.trim());
    if (!question.trim() || clean.some((o) => !o)) { toast.error("Fill the question and all 4 options"); return; }
    try {
      await api.post("/puzzles", { question: question.trim(), options: clean, correct_index: correct });
      toast.success("Puzzle added");
      setQuestion(""); setOptions(["", "", "", ""]); setCorrect(0);
      reload();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const del = async (id) => { await api.delete(`/puzzles/${id}`); toast.success("Deleted"); reload(); };

  return (
    <div className="mt-6 space-y-5">
      <div className="glass rounded-2xl p-6">
        <h3 className="font-display font-bold text-xl mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-secondary" /> Add Puzzle (MCQ)</h3>
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Question</Label>
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} data-testid="puzzle-question" className="mt-2 mb-4 bg-black/40 border-white/10 h-11" placeholder="e.g. What comes next: 2, 6, 12, 20, ...?" />
        <div className="grid sm:grid-cols-2 gap-3">
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <button onClick={() => setCorrect(i)} data-testid={`puzzle-correct-${i}`}
                className={`w-8 h-8 rounded-full shrink-0 font-mono text-sm border transition-colors ${correct === i ? "bg-accent text-black border-accent" : "border-white/15 text-muted-foreground"}`}>
                {String.fromCharCode(65 + i)}
              </button>
              <Input value={o} onChange={(e) => setOptions((p) => p.map((x, xi) => xi === i ? e.target.value : x))} data-testid={`puzzle-option-${i}`} className="bg-black/40 border-white/10 h-11" placeholder={`Option ${String.fromCharCode(65 + i)}`} />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">Click a letter to mark the correct answer (currently <b className="text-accent">{String.fromCharCode(65 + correct)}</b>).</p>
        <Button onClick={add} data-testid="add-puzzle-btn" className="mt-4 rounded-full bg-secondary text-white font-semibold">Add Puzzle</Button>
      </div>

      <div className="space-y-3">
        {puzzles.length === 0 && <div className="glass rounded-2xl p-8 text-center text-muted-foreground">No puzzles yet.</div>}
        {puzzles.map((p, i) => (
          <div key={p.id} className="glass rounded-2xl p-5" data-testid={`admin-puzzle-${i}`}>
            <div className="flex justify-between gap-3">
              <p className="font-medium"><span className="font-mono text-secondary mr-2">Q{i + 1}.</span>{p.question}</p>
              <Button size="sm" variant="ghost" onClick={() => del(p.id)} data-testid={`delete-puzzle-${p.id}`} className="text-destructive hover:text-destructive shrink-0"><Trash2 className="w-4 h-4" /></Button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 mt-3">
              {p.options.map((o, idx) => (
                <div key={idx} className={`text-sm px-3 py-2 rounded-lg border ${idx === p.correct_index ? "border-accent/40 bg-accent/10 text-accent" : "border-white/10 text-muted-foreground"}`}>
                  <span className="font-mono text-xs mr-2">{String.fromCharCode(65 + idx)}</span>{o}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
