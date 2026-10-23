/**
 * Wraps a loader so bursts of calls (a realtime event per vote, many votes at
 * once) turn into at most one request in flight plus one follow-up, spaced
 * at least `gapMs` apart. Keeps phones responsive when lots of answers land
 * together near the end of a question.
 */
export function coalesce(load: () => Promise<unknown>, gapMs = 500) {
  let running = false;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const run = () => {
    if (stopped) return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    again = false;
    load().finally(() => {
      timer = setTimeout(() => {
        running = false;
        if (again) run();
      }, gapMs);
    });
  };

  run.stop = () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
  return run as (() => void) & { stop: () => void };
}
