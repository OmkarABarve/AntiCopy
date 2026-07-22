import { ShieldHalf } from "lucide-react";

export function AppHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="mb-6 flex items-center gap-3">
      <div className="glass flex size-11 items-center justify-center rounded-xl">
        <ShieldHalf className="size-6 text-primary" />
      </div>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          <span className="text-gradient">AntiCopy</span>{" "}
          <span className="text-muted-foreground">· Interview Integrity Monitor</span>
        </h1>
        <p className="text-xs text-muted-foreground">
          {subtitle ??
            "Passive, explainable AI-assistance risk estimation. The interviewer always decides."}
        </p>
      </div>
    </header>
  );
}
