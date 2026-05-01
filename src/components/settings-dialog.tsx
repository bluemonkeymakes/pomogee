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
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = Number(e.currentTarget.value);
          if (!Number.isFinite(v)) return;
          onChange(Math.max(min, Math.min(max, Math.round(v))));
        }}
      />
    </div>
  );
}
