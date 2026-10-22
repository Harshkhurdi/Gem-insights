import { kill } from "node:process";
// Treat the UI, API and worker as one local application. Leaving siblings alive
// after a failure produces a dashboard that appears up but cannot serve data.
export function supervise(
  services,
  {
    signals = process,
    exit = (code) => process.exit(code),
    terminate = (child, signal) => {
      if (!child.pid) return;
      try {
        if (process.platform === "win32") child.kill(signal);
        else kill(-child.pid, signal);
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    },
    log = console.error,
    graceMs = 5000,
  } = {},
) {
  const active = new Set(services.map(({ child }) => child));
  let stopping = false,
    finished = false,
    code = 0,
    timer;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    signals.removeListener("SIGINT", interrupt);
    signals.removeListener("SIGTERM", interrupt);
    exit(code);
  };
  const stop = (status = 0) => {
    if (stopping) return;
    stopping = true;
    code = status;
    for (const child of active) terminate(child, "SIGTERM");
    if (!active.size) return finish();
    timer = setTimeout(() => {
      for (const child of active) terminate(child, "SIGKILL");
      finish();
    }, graceMs);
  };
  const interrupt = () => stop(0);
  signals.once("SIGINT", interrupt);
  signals.once("SIGTERM", interrupt);
  for (const { name, child } of services) {
    child.once("error", (error) => {
      log(`${name} could not start: ${error.message}`);
      active.delete(child);
      stop(1);
      if (stopping && !active.size) finish();
    });
    child.once("exit", (status, signal) => {
      // npm/Next can exit while a descendant still holds the HTTP port.
      if (!stopping) terminate(child, "SIGTERM");
      active.delete(child);
      if (!stopping) {
        log(
          `${name} stopped (${signal || "exit " + status}); stopping the local app.`,
        );
        stop(status || 1);
      } else if (!active.size) finish();
    });
  }
  return stop;
}
