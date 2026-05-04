import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimerView } from "@/components/timer-view";
import { CalendarView } from "@/components/calendar-view";
import { ShowcaseView } from "@/components/showcase-view";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SettingsDialog } from "@/components/settings-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";

const isDev = import.meta.env.DEV;

function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <div className="flex min-h-full flex-col">
          <header className="flex items-center justify-between border-b px-6 py-3">
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-xl tracking-wide">Pomoge</span>
              <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">sacred focus</span>
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
                {isDev && <TabsTrigger value="shapes">Shapes</TabsTrigger>}
              </TabsList>
              <TabsContent value="timer" className="mt-6 flex justify-center">
                <TimerView />
              </TabsContent>
              <TabsContent value="calendar" className="mt-6">
                <CalendarView />
              </TabsContent>
              {isDev && (
                <TabsContent value="shapes" className="mt-6">
                  <ShowcaseView />
                </TabsContent>
              )}
            </Tabs>
          </main>
        </div>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
