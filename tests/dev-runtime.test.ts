import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { spawn } from "node:child_process";
import { connect } from "node:net";
import { supervise } from "../scripts/process-supervisor.mjs";
function fixture() {
  const signals = new EventEmitter(),
    killed: any[] = [],
    exits: number[] = [],
    logs: string[] = [];
  const services = ["API", "Worker", "Web UI"].map((name) => ({
    name,
    child: new EventEmitter(),
  }));
  supervise(services, {
    signals,
    terminate: (child: any, signal: string) => killed.push([child, signal]),
    exit: (code: number) => exits.push(code),
    log: (s: string) => logs.push(s),
    graceMs: 100,
  });
  return { signals, killed, exits, logs, services };
}
test("a backend failure stops the web and worker and preserves a failing exit code", () => {
  const f = fixture();
  f.services[0].child.emit("exit", 23, null);
  assert.equal(f.killed.length, 3);
  assert.ok(f.killed.every((x) => x[1] === "SIGTERM"));
  f.services[1].child.emit("exit", null, "SIGTERM");
  f.services[2].child.emit("exit", null, "SIGTERM");
  assert.deepEqual(f.exits, [23]);
  assert.match(f.logs[0], /API stopped/);
});
test("interrupt shuts down all services once and removes signal handlers", () => {
  const f = fixture();
  f.signals.emit("SIGINT");
  f.signals.emit("SIGTERM");
  assert.equal(f.killed.length, 3);
  for (const s of f.services) s.child.emit("exit", null, "SIGTERM");
  assert.deepEqual(f.exits, [0]);
  assert.equal(f.signals.listenerCount("SIGINT"), 0);
});
test("a failed spawn cannot leave the other application services running", () => {
  const f = fixture();
  f.services[0].child.emit("error", new Error("SYNTHETIC executable missing"));
  assert.equal(f.killed.length, 2);
  f.services[1].child.emit("exit", 0, null);
  f.services[2].child.emit("exit", 0, null);
  assert.deepEqual(f.exits, [1]);
  assert.match(f.logs[0], /could not start/);
});

test("a single service spawn failure exits only once", () => {
  const child = new EventEmitter(),
    exits: number[] = [];
  supervise([{ name: "API", child }], {
    signals: new EventEmitter(),
    terminate: () => {},
    exit: (code: number) => exits.push(code),
    log: () => {},
  });
  child.emit("error", new Error("SYNTHETIC missing executable"));
  assert.deepEqual(exits, [1]);
});

test(
  "POSIX supervision cleans up a crashed parent and its listening grandchild",
  { skip: process.platform === "win32" },
  async () => {
    const grandchild = `const net=require("node:net");const s=net.createServer();s.listen(0,"127.0.0.1",()=>process.send({port:s.address().port}));`;
    const parentCode = `const {spawn}=require("node:child_process");const c=spawn(process.execPath,["-e",${JSON.stringify(grandchild)}],{stdio:["ignore","ignore","ignore","ipc"]});c.on("message",m=>{process.send(m);setTimeout(()=>process.exit(23),200)});setInterval(()=>{},1000);`;
    const web = spawn(process.execPath, ["-e", parentCode], {
      detached: true,
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    });
    let failing;
    try {
      const [{ port }] = await once(web, "message");
      failing = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
        detached: true,
        stdio: "ignore",
      });
      const code = await new Promise<number>((resolve) =>
        supervise(
          [
            { name: "Web", child: web },
            { name: "API", child: failing },
          ],
          { signals: new EventEmitter(), exit: resolve, log: () => {} },
        ),
      );
      assert.equal(code, 23);
      const listening = () =>
        new Promise<boolean>((resolve) => {
          const socket = connect({ host: "127.0.0.1", port });
          socket.once("connect", () => {
            socket.destroy();
            resolve(true);
          });
          socket.once("error", () => resolve(false));
        });
      let open = true;
      for (let i = 0; i < 40; i++) {
        open = await listening();
        if (!open) break;
        await new Promise((r) => setTimeout(r, 25));
      }
      assert.equal(open, false, "a grandchild server was left running");
    } finally {
      for (const child of [web, failing])
        if (child?.pid)
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch {}
    }
  },
);
