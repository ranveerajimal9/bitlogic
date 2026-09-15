import { useEffect, useState } from "react";

function pad(n) {
  return String(n).padStart(2, "0");
}

export function useCountdown(target) {
  const [remaining, setRemaining] = useState(() => diff(target));
  useEffect(() => {
    const id = setInterval(() => setRemaining(diff(target)), 1000);
    return () => clearInterval(id);
  }, [target]);
  return remaining;
}

function diff(target) {
  if (!target) return null;
  const t = new Date(target).getTime() - Date.now();
  if (isNaN(t)) return null;
  const clamped = Math.max(0, t);
  return {
    total: t,
    done: t <= 0,
    days: Math.floor(clamped / 86400000),
    hours: Math.floor((clamped % 86400000) / 3600000),
    minutes: Math.floor((clamped % 3600000) / 60000),
    seconds: Math.floor((clamped % 60000) / 1000),
  };
}

export default function Countdown({ target, className = "" }) {
  const r = useCountdown(target);
  if (!r) return null;
  const items = [
    { label: "Days", value: r.days },
    { label: "Hours", value: r.hours },
    { label: "Minutes", value: r.minutes },
    { label: "Seconds", value: r.seconds },
  ];
  return (
    <div className={`flex flex-wrap gap-3 sm:gap-5 ${className}`} data-testid="countdown-timer">
      {items.map((it) => (
        <div
          key={it.label}
          className="glass rounded-2xl px-5 py-4 sm:px-8 sm:py-6 min-w-[78px] sm:min-w-[110px] text-center"
        >
          <div
            className="font-mono font-bold text-3xl sm:text-5xl lg:text-6xl text-primary text-glow-cyan tabular-nums"
            data-testid={`countdown-${it.label.toLowerCase()}`}
          >
            {pad(it.value)}
          </div>
          <div className="mt-2 text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {it.label}
          </div>
        </div>
      ))}
    </div>
  );
}
