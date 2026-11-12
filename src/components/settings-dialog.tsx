import { Settings as SettingsIcon, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { BELL_TONE_IDS, BELL_TONES, type BellTone, playBell } from "@/lib/bell";
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
        <Toggle
          label="Bell on completion"
          description="Ring a bell when a focus session or break finishes."
          checked={settings.bellOnComplete}
          onChange={(v) => update({ bellOnComplete: v })}
        />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Completion bell</Label>
            <TonePicker
              value={settings.bellTone}
              volume={settings.bellVolume}
              onChange={(bellTone) => update({ bellTone })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bell-volume">Bell volume</Label>
            <VolumeSlider
              id="bell-volume"
              value={settings.bellVolume}
              onChange={(bellVolume) => update({ bellVolume })}
              onCommit={(v) => playBell(settings.bellTone, v)}
            />
          </div>
        </div>
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

/** Segmented tone choice. Picking a tone plays it, so the choice is by ear. */
export function TonePicker({
  value,
  volume,
  onChange,
}: {
  value: BellTone;
  volume: number;
  onChange: (tone: BellTone) => void;
}) {
  return (
    <div role="radiogroup" className="flex h-9 rounded-md border border-input p-0.5">
      {BELL_TONE_IDS.map((id) => (
        // biome-ignore lint/a11y/useSemanticElements: segmented control, styled buttons in a radiogroup
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => {
            onChange(id);
            playBell(id, volume);
          }}
          className={cn(
            "flex-1 rounded-sm px-2 text-sm transition-colors",
            value === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/50",
          )}
        >
          {BELL_TONES[id].label}
        </button>
      ))}
    </div>
  );
}

/** Volume 0..1. `onCommit` fires on release, for an audible preview. */
export function VolumeSlider({
  id,
  value,
  onChange,
  onCommit,
}: {
  id?: string;
  value: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
}) {
  return (
    <div className="flex h-9 items-center">
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(value * 100)}
        aria-valuetext={`${Math.round(value * 100)}%`}
        onChange={(e) => onChange(Number(e.currentTarget.value) / 100)}
        onPointerUp={(e) => onCommit?.(Number(e.currentTarget.value) / 100)}
        onKeyUp={(e) => onCommit?.(Number(e.currentTarget.value) / 100)}
        className="w-full accent-[hsl(var(--primary))]"
      />
    </div>
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
