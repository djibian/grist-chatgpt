import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Readable, Writable } from "node:stream";

const COMMAND_TIMEOUT_MS = 10_000;
const NAVIGATION_TIMEOUT_MS = 15_000;
const MAX_PROTOCOL_MESSAGE_BYTES = 2 * 1024 * 1024;

interface CdpReply {
  id?: number;
  result?: Record<string, unknown>;
  error?: { message?: string };
}

interface PendingCommand {
  resolve(value: Record<string, unknown>): void;
  reject(error: Error): void;
  timer: NodeJS.Timeout;
}

function boundedExecutable(value: string): string {
  if (!value || value.length > 1024 || /[\r\n\0]/.test(value)) {
    throw new Error("J2 Chromium executable path is invalid.");
  }
  return value;
}

/**
 * Minimal private Chromium DevTools Protocol transport over --remote-debugging-pipe.
 *
 * It deliberately exposes only the primitives needed by the bounded J2 browser
 * adapter. Secret Grist URLs travel inside the private pipe after launch and are
 * never placed in Chromium's argv, stdout or returned evidence.
 */
export class J2ChromiumCdpPage {
  private nextId = 1;
  private readonly pending = new Map<number, PendingCommand>();
  private readonly input: Writable;
  private readonly output: Readable;
  private buffer = Buffer.alloc(0);
  private sessionId: string | undefined;
  private targetId: string | undefined;
  private closed = false;

  private constructor(
    private readonly child: ChildProcess,
    private readonly profileDir: string,
    input: Writable,
    output: Readable
  ) {
    this.input = input;
    this.output = output;
    this.output.on("data", (chunk: Buffer) => this.onData(chunk));
    this.output.on("error", () => this.failPending());
    this.child.once("exit", () => this.failPending());
  }

  static async launch(executable: string): Promise<J2ChromiumCdpPage> {
    const profileDir = await mkdtemp(join(tmpdir(), "grist-chatgpt-j2-browser-"));
    let child: ChildProcess | undefined;
    try {
      child = spawn(boundedExecutable(executable), [
        "--headless=new",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-features=Translate,OptimizationHints",
        "--disable-sync",
        "--metrics-recording-only",
        "--no-default-browser-check",
        "--no-first-run",
        "--remote-debugging-pipe",
        `--user-data-dir=${profileDir}`,
        "about:blank"
      ], {
        stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"]
      });

      const input = child.stdio[3] as Writable | null;
      const output = child.stdio[4] as Readable | null;
      if (!input || !output) {
        throw new Error("J2 Chromium remote debugging pipe is unavailable.");
      }

      const page = new J2ChromiumCdpPage(child, profileDir, input, output);
      await page.initialize();
      return page;
    } catch (error) {
      child?.kill("SIGKILL");
      await rm(profileDir, { recursive: true, force: true });
      throw error;
    }
  }

  private async initialize(): Promise<void> {
    const created = await this.command("Target.createTarget", { url: "about:blank" });
    const targetId = created.targetId;
    if (typeof targetId !== "string" || !targetId) {
      throw new Error("J2 Chromium did not create a bounded page target.");
    }
    this.targetId = targetId;

    const attached = await this.command("Target.attachToTarget", { targetId, flatten: true });
    const sessionId = attached.sessionId;
    if (typeof sessionId !== "string" || !sessionId) {
      throw new Error("J2 Chromium did not attach to the bounded page target.");
    }
    this.sessionId = sessionId;
    await this.command("Page.enable", {}, sessionId);
    await this.command("Runtime.enable", {}, sessionId);
  }

  async navigate(secretUrl: string): Promise<void> {
    this.ensureOpen();
    if (secretUrl.length > 4096 || /[\r\n\0]/.test(secretUrl)) {
      throw new Error("J2 browser navigation target is invalid.");
    }
    const sessionId = this.requireSession();
    const response = await this.command("Page.navigate", { url: secretUrl }, sessionId);
    if (response.errorText) {
      throw new Error("J2 browser navigation was rejected.");
    }
    const deadline = Date.now() + NAVIGATION_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const ready = await this.evaluate<string>("document.readyState");
      if (ready === "complete" || ready === "interactive") return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("J2 browser navigation did not reach a stable document state.");
  }

  async evaluate<T>(expression: string): Promise<T> {
    this.ensureOpen();
    if (!expression || expression.length > 32_000) {
      throw new Error("J2 browser fixed expression exceeded its internal bound.");
    }
    const response = await this.command(
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true },
      this.requireSession()
    );
    const exceptionDetails = response.exceptionDetails;
    if (exceptionDetails) {
      throw new Error("J2 browser fixed expression failed.");
    }
    const remote = response.result;
    if (!remote || typeof remote !== "object") {
      throw new Error("J2 browser expression returned an unsupported result.");
    }
    return (remote as Record<string, unknown>).value as T;
  }

  async sendKey(key: "ENTER" | "ESCAPE" | "DELETE"): Promise<void> {
    const keyMap = {
      ENTER: { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 },
      ESCAPE: { key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 },
      DELETE: { key: "Delete", code: "Delete", windowsVirtualKeyCode: 46 }
    } as const;
    const keyInfo = keyMap[key];
    const sessionId = this.requireSession();
    await this.command("Input.dispatchKeyEvent", { type: "keyDown", ...keyInfo }, sessionId);
    await this.command("Input.dispatchKeyEvent", { type: "keyUp", ...keyInfo }, sessionId);
  }

  async insertText(value: string): Promise<void> {
    if (value.length > 512 || /\0/.test(value)) {
      throw new Error("J2 browser mutation value exceeded its internal bound.");
    }
    await this.command("Input.insertText", { text: value }, this.requireSession());
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      if (this.targetId) {
        await this.command("Target.closeTarget", { targetId: this.targetId }).catch(() => undefined);
      }
    } finally {
      this.child.kill("SIGKILL");
      this.failPending();
      await rm(this.profileDir, { recursive: true, force: true });
    }
  }

  private requireSession(): string {
    if (!this.sessionId) throw new Error("J2 browser session is not initialized.");
    return this.sessionId;
  }

  private ensureOpen(): void {
    if (this.closed || this.child.exitCode !== null) {
      throw new Error("J2 browser session is closed.");
    }
  }

  private command(
    method: string,
    params: Record<string, unknown>,
    sessionId?: string
  ): Promise<Record<string, unknown>> {
    if (this.closed) return Promise.reject(new Error("J2 browser session is closed."));
    const id = this.nextId++;
    const message = JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) });
    if (Buffer.byteLength(message) > MAX_PROTOCOL_MESSAGE_BYTES) {
      return Promise.reject(new Error("J2 browser protocol command exceeded its internal bound."));
    }

    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("J2 browser protocol command timed out."));
      }, COMMAND_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.input.write(`${message}\0`, (error) => {
        if (!error) return;
        const pending = this.pending.get(id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(id);
        pending.reject(new Error("J2 browser protocol pipe write failed."));
      });
    });
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (this.buffer.length > MAX_PROTOCOL_MESSAGE_BYTES * 2) {
      this.buffer = Buffer.alloc(0);
      this.failPending();
      return;
    }

    while (true) {
      const end = this.buffer.indexOf(0);
      if (end < 0) return;
      const raw = this.buffer.subarray(0, end);
      this.buffer = this.buffer.subarray(end + 1);
      if (!raw.length || raw.length > MAX_PROTOCOL_MESSAGE_BYTES) continue;

      let reply: CdpReply;
      try {
        reply = JSON.parse(raw.toString("utf8")) as CdpReply;
      } catch {
        continue;
      }
      if (!reply.id) continue;
      const pending = this.pending.get(reply.id);
      if (!pending) continue;
      clearTimeout(pending.timer);
      this.pending.delete(reply.id);
      if (reply.error) {
        pending.reject(new Error("J2 browser protocol command failed."));
      } else {
        pending.resolve(reply.result ?? {});
      }
    }
  }

  private failPending(): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error("J2 browser process ended before command completion."));
      this.pending.delete(id);
    }
  }
}
