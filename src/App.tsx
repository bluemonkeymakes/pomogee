import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimerView } from "@/components/timer-view";
import { CalendarView } from "@/components/calendar-view";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SettingsDialog } from "@/components/settings-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useWindowSize } from "@/lib/use-measure";
import { cn } from "@/lib/utils";

function App() {
  const { width: winW, height: winH } = useWindowSize();
  const aspect = winH > 0 ? winW / winH : 1;
  // Three responsive timer layouts, by available height + aspect:
  //   • bar       — very short + wide: mandala + clock scaled into one row.
  //   • landscape — medium-short + wide: mandala left, clock + controls right,
  //                 timeline across the bottom.
  //   • column    — everything else: tall vertical stack.
  const bar = winH > 0 && winH < 480 && aspect > 1.4;
  const landscape = !bar && winH >= 480 && winH < 700 && aspect > 1.1;
  const layout = bar ? "bar" : landscape ? "landscape" : "column";
  // Tight chrome whenever vertical space is at a premium (bar or landscape).
  const compact = bar || landscape;

  return (
    <ThemeProvider>
      <TooltipProvider>
        <div className="flex h-full flex-col overflow-hidden">
          <header
            className={cn(
              "flex shrink-0 items-center justify-between border-b",
              compact ? "px-3 py-1" : "px-4 py-2.5",
            )}
          >
            <div className="flex items-baseline gap-2">
              <span className={cn("font-serif tracking-wide", compact ? "text-base" : "text-xl")}>
                Pom
                <svg viewBox="-50 -50 100 100" width={compact ? 16 : 20} height={compact ? 16 : 20} className="inline-block align-middle mx-0.5 -translate-y-px" aria-hidden>
                  <path d="M 0 -38 L 22.336 -30.743 L 36.14 -11.743 L 36.14 11.743 L 22.336 30.743 L 0 38 L -22.336 30.743 L -36.14 11.743 L -36.14 -11.743 L -22.336 -30.743 Z"
                    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" strokeOpacity="0.28"/>
                  <path d="M 0 -38 L 36.14 -11.743 L 22.336 30.743 L -22.336 30.743 L -36.14 -11.743 Z"
                    fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" strokeOpacity="0.55"/>
                  <path d="M 0 -38 L 32.909 19 L -32.909 19 Z"
                    fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" strokeOpacity="0.88"/>
                </svg>
                gee
              </span>
            </div>
            <div className="flex items-center gap-1">
              <SettingsDialog />
              <ThemeToggle />
            </div>
          </header>
          <main className={cn("flex min-h-0 flex-1 flex-col", compact ? "px-2 py-1.5" : "px-4 py-3")}>
            <Tabs defaultValue="timer" className="mx-auto flex min-h-0 w-full min-w-0 max-w-4xl flex-1 flex-col">
              <TabsList className={cn("mx-auto shrink-0", compact && "h-8")}>
                <TabsTrigger value="timer" className={cn(compact && "px-2.5 py-1 text-xs")}>Timer</TabsTrigger>
                <TabsTrigger value="calendar" className={cn(compact && "px-2.5 py-1 text-xs")}>Calendar</TabsTrigger>
              </TabsList>
              <TabsContent value="timer" className={cn("min-h-0 flex-1", compact ? "mt-1.5" : "mt-4")}>
                <TimerView layout={layout} />
              </TabsContent>
              <TabsContent value="calendar" className={cn("min-h-0 flex-1 overflow-auto", compact ? "mt-1.5" : "mt-4")}>
                <CalendarView />
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
