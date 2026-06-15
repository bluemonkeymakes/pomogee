/** Bring the desktop window to the front so a finished focus/break session is
 * noticed even when the app is buried behind other windows.
 *
 * No-op on the web build (the Tauri APIs aren't present there). The Tauri API
 * is imported dynamically so the web bundle never pulls it in and a missing
 * runtime can't throw at module load. */
export async function bringWindowToFront(): Promise<void> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
  try {
    const { getCurrentWindow, UserAttentionType } = await import("@tauri-apps/api/window");
    const w = getCurrentWindow();
    await w.show();
    await w.unminimize();
    await w.setFocus();
    // Flash the taskbar/dock entry in case the OS withheld focus-stealing.
    await w.requestUserAttention(UserAttentionType.Critical);
  } catch (err) {
    // Window control isn't essential — never let it interrupt the timer.
    console.warn("bringWindowToFront failed", err);
  }
}
