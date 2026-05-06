import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimerView } from "@/components/timer-view";
import { CalendarView } from "@/components/calendar-view";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SettingsDialog } from "@/components/settings-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";

function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <div className="flex min-h-full flex-col">
          <header className="flex items-center justify-between border-b px-6 py-3">
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-xl tracking-wide">
                Pom
                <svg viewBox="-50 -50 100 100" width="20" height="20" className="inline-block align-middle mx-0.5 -translate-y-px" aria-hidden>
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
          <main className="flex flex-1 items-start justify-center px-6 py-8">
            <Tabs defaultValue="timer" className="w-full max-w-4xl">
              <TabsList className="mx-auto">
                <TabsTrigger value="timer">Timer</TabsTrigger>
                <TabsTrigger value="calendar">Calendar</TabsTrigger>
              </TabsList>
              <TabsContent value="timer" className="mt-6 flex justify-center">
                <TimerView />
              </TabsContent>
              <TabsContent value="calendar" className="mt-6">
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
