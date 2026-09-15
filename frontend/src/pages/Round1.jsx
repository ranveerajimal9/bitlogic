import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Blocks, Save, ArrowLeft, ExternalLink, Loader2 } from "lucide-react";

export default function Round1() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: comp }, { data: subs }] = await Promise.all([
          api.get("/competition"),
          api.get("/me/submissions"),
        ]);
        if (!comp.started || comp.current_round < 1 || (user && user.qualified_round < 1) || comp.finalized_rounds?.includes(1)) {
          setAllowed(false);
        }
        if (subs["1"]?.content) setUrl(subs["1"].content);
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
      await api.post("/rounds/1/submit", { round: 1, content: url });
      toast.success("Project link submitted!");
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
        <h1 className="font-display font-bold text-3xl">Round 1 isn't available</h1>
        <p className="text-muted-foreground mt-3">This round may be locked, closed, or you may not be qualified.</p>
        <Button onClick={() => navigate("/dashboard")} className="mt-6 rounded-full bg-primary text-black">Back to Dashboard</Button>
      </div>
    </div>
  );

  return (
    <div className="grain min-h-screen flex flex-col">
      <Navbar />
      <div className="border-b border-white/10 bg-black/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} data-testid="back-btn"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
            <div className="flex items-center gap-2">
              <Blocks className="w-5 h-5 text-primary" />
              <span className="font-display font-bold text-lg">Round 1 — CodeCraft</span>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a href="https://scratch.mit.edu/projects/editor/" target="_blank" rel="noreferrer" data-testid="open-scratch-btn" className="shrink-0">
              <Button variant="outline" className="rounded-full border-primary/40 text-primary hover:bg-primary/10 h-10">
                <ExternalLink className="w-4 h-4 mr-2" /> Open in new tab
              </Button>
            </a>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste your Scratch project link" data-testid="round1-url" className="bg-black/40 border-white/10 h-10 sm:w-72" />
            <Button onClick={save} disabled={saving} data-testid="round1-submit" className="rounded-full bg-accent text-black hover:bg-accent/90 font-semibold shrink-0">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Submit</>}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-black relative">
        <iframe
          title="Scratch Editor"
          src="https://scratch.mit.edu/projects/editor/?tutorial=getStarted"
          className="w-full relative z-10"
          style={{ height: "calc(100vh - 64px - 65px - 40px)", border: "0" }}
          allow="camera; microphone; autoplay; clipboard-write"
          allowFullScreen
          data-testid="scratch-iframe"
        />
        <div className="absolute inset-0 z-0 flex items-center justify-center p-6">
          <div className="glass rounded-2xl p-8 max-w-md text-center">
            <Blocks className="w-10 h-10 text-primary mx-auto mb-4" />
            <h2 className="font-display font-bold text-2xl">Build your Scratch project</h2>
            <p className="text-muted-foreground mt-3 text-sm">
              If the editor doesn't load above (Scratch blocks embedding in some browsers), open it in a new tab, build your story or game, then paste your share link here and submit.
            </p>
            <a href="https://scratch.mit.edu/projects/editor/" target="_blank" rel="noreferrer">
              <Button className="mt-6 rounded-full bg-primary text-black font-semibold" data-testid="open-scratch-fallback">
                <ExternalLink className="w-4 h-4 mr-2" /> Launch Scratch Editor
              </Button>
            </a>
          </div>
        </div>
      </div>
      <div className="bg-black/60 border-t border-white/10 px-4 py-2 text-xs text-muted-foreground flex items-center gap-2">
        <ExternalLink className="w-3.5 h-3.5" />
        Build your story or game above. Save it in Scratch, then paste the share link and click Submit for the judges.
      </div>
    </div>
  );
}
