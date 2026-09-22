import { useState } from "react";
import { Settings as SettingsIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTimer } from "@/lib/store";
import { cn } from "@/lib/utils";

export function SettingsDialog() {
  const settings = useTimer((s) => s.settings);
  const update = useTimer((s) => s.updateSettings);
  const reset = useTimer((s) => s.reset);
  const [confirming, setConfirming] = useState(false);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Settings">
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Session settings</DialogTitle>
          <DialogDescription>Tune durations and streak rules.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Focus minutes"
            value={settings.workMinutes}
            min={1}
            max={120}
            onChange={(v) => update({ workMinutes: v })}
          />
          <Field
            label="Short break"
            value={settings.shortBreakMinutes}
            min={1}
            max={60}
            onChange={(v) => update({ shortBreakMinutes: v })}
          />
          <Field
            label="Long break"
            value={settings.longBreakMinutes}
            min={1}
            max={120}
            onChange={(v) => update({ longBreakMinutes: v })}
          />
          <Field
            label="Long break every N"
            value={settings.longBreakEvery}
            min={2}
            max={12}
            onChange={(v) => update({ longBreakEvery: v })}
          />
        </div>
        <Toggle
          label="Jump to front on completion"
          description="Raise and focus the window when a focus session or break finishes."
          checked={settings.focusOnComplete}
          onChange={(v) => update({ focusOnComplete: v })}
        />
        <DialogFooter className="mt-2 flex-row items-center justify-between sm:justify-between">
          {confirming ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Wipe sessions and restore defaults?</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  reset();
                  setConfirming(false);
                }}
              >
                Confirm
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
              <Trash2 className="h-4 w-4" /> Reset all
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-md border border-input p-3 text-left transition-colors hover:bg-accent/50"
    >
      <span className="space-y-0.5">
        <span className="block text-sm font-medium leading-none">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
      <span
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-primary" : "bg-input",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-background transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

function Field({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  // Raw text while the user is typing. Clamping on every keystroke would snap
  // an emptied field to `min` (so backspacing "25" then typing "5" gave "15");
  // instead, commit in-range values live and clamp only on blur.
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (raw: string) => {
    const v = Number(raw);
    if (raw.trim() !== "" && Number.isFinite(v)) onChange(Math.max(min, Math.min(max, Math.round(v))));
    setDraft(null);
  };

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        value={draft ?? value}
        onChange={(e) => {
          const raw = e.currentTarget.value;
          setDraft(raw);
          const v = Number(raw);
          if (raw.trim() !== "" && Number.isInteger(v) && v >= min && v <= max) onChange(v);
        }}
        onBlur={(e) => commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </div>
  );
}
