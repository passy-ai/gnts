// Drive the running app over the Chrome DevTools Protocol.
//
// The app is an Electron window showing http://127.0.0.1:8080. With
// --remote-debugging-port it exposes a CDP endpoint, which lets us read the DOM,
// run expressions, collect console errors and take screenshots — so a failure can
// be diagnosed here instead of being relayed by hand.
//
//   node scripts/probe.mjs                      # report errors + document state
//   node scripts/probe.mjs --eval '<js>'        # evaluate an expression
//   node scripts/probe.mjs --click '<selector>' # click, then report
//   node scripts/probe.mjs --shot /tmp/x.png    # screenshot
//   node scripts/probe.mjs --wait 3000          # settle before acting
//
// Exits non-zero if the page logged an error or an uncaught exception.

import { WebSocket } from "ws";
import { writeFileSync } from "node:fs";

const PORT = Number(process.env.GNTS_DEBUG_PORT || 9222);
const argv = process.argv.slice(2);
const flag = (name, dflt = null) => {
	const i = argv.indexOf(name);
	return i === -1 ? dflt : argv[i + 1];
};
const has = (name) => argv.includes(name);

async function targets() {
	const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
	return (await r.json()).filter((t) => t.type === "page");
}

class Cdp {
	constructor(ws) {
		this.ws = ws;
		this.id = 0;
		this.pending = new Map();
		this.console = [];
		this.errors = [];
		ws.on("message", (raw) => {
			const m = JSON.parse(raw.toString());
			if (m.id && this.pending.has(m.id)) {
				const { resolve, reject } = this.pending.get(m.id);
				this.pending.delete(m.id);
				m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
				return;
			}
			if (m.method === "Runtime.consoleAPICalled") {
				const text = (m.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(" ");
				this.console.push({ level: m.params.type, text });
			}
			if (m.method === "Runtime.exceptionThrown") {
				const d = m.params.exceptionDetails || {};
				this.errors.push({ kind: "exception", text: d.exception?.description || d.text || "?" });
			}
			if (m.method === "Log.entryAdded") {
				const e = m.params.entry || {};
				if (e.level === "error") this.errors.push({ kind: "log", text: `${e.text || ""} ${e.url || ""}`.trim() });
			}
		});
	}
	send(method, params = {}) {
		const id = ++this.id;
		return new Promise((resolve, reject) => {
			this.pending.set(id, { resolve, reject });
			this.ws.send(JSON.stringify({ id, method, params }));
			setTimeout(() => {
				if (this.pending.has(id)) {
					this.pending.delete(id);
					reject(new Error(`timeout ${method}`));
				}
			}, 30000);
		});
	}
	async eval(expression, awaitPromise = true) {
		const r = await this.send("Runtime.evaluate", { expression, awaitPromise, returnByValue: true, userGesture: true });
		if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
		return r.result?.value;
	}
}

// A summary of what the page is showing, in the terms this project cares about.
const STATE = `(() => {
	const q = (s) => document.querySelector(s);
	const txt = (s) => { const e = q(s); return e ? e.textContent.trim().replace(/\\s+/g, " ").slice(0, 120) : null; };
	return {
		url: location.href,
		title: document.title,
		desktop: document.documentElement.classList.contains("gn-desktop-window"),
		dark: document.documentElement.classList.contains("dark") || document.documentElement.hasAttribute("data-ds-dark-theme"),
		onboarding: q(".gnts-w-start") ? (q(".gnts-w-startcard h3")?.textContent.trim() ?? "present") : null,
		sidebarWordmark: txt(".gn-wordmark") || txt("[data-gnts-wordmark]"),
		modelLabel: txt("[data-gnts-model]") || txt("[class*=model]"),
		styleTags: document.querySelectorAll("style[data-plugin-css]").length,
	};
})()`;

async function main() {
	const pages = await targets();
	if (!pages.length) {
		console.error(`  no page target on :${PORT} — launch the app with --remote-debugging-port=${PORT}`);
		process.exit(2);
	}
	const page = pages.find((p) => p.url.includes("8080")) || pages[0];
	console.log(`  target: ${page.url}`);

	const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 256 * 1024 * 1024 });
	await new Promise((res, rej) => { ws.once("open", res); ws.once("error", rej); });
	const cdp = new Cdp(ws);
	await cdp.send("Runtime.enable");
	await cdp.send("Log.enable");
	await cdp.send("Page.enable");

	const wait = Number(flag("--wait", 1500));
	await new Promise((r) => setTimeout(r, wait));

	if (has("--click")) {
		const sel = flag("--click");
		const clicked = await cdp.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.click(); return true; })()`);
		console.log(`  click ${sel}: ${clicked ? "ok" : "NOT FOUND"}`);
		await new Promise((r) => setTimeout(r, Number(flag("--after", 1200))));
	}

	if (has("--eval")) {
		const out = await cdp.eval(flag("--eval"));
		console.log("  eval → " + JSON.stringify(out, null, 2).split("\n").join("\n  "));
	} else {
		const state = await cdp.eval(STATE);
		console.log("  state:");
		for (const [k, v] of Object.entries(state)) console.log(`    ${k}: ${JSON.stringify(v)}`);
	}

	if (has("--shot")) {
		const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
		writeFileSync(flag("--shot"), Buffer.from(data, "base64"));
		console.log(`  screenshot → ${flag("--shot")}`);
	}

	const errs = cdp.errors;
	const warn = cdp.console.filter((c) => c.level === "error" || c.level === "warning");
	console.log(`  console errors/warnings: ${warn.length}`);
	for (const w of warn.slice(0, 8)) console.log(`    [${w.level}] ${w.text.slice(0, 180)}`);
	console.log(`  uncaught: ${errs.length}`);
	for (const e of errs.slice(0, 8)) console.log(`    [${e.kind}] ${e.text.split("\n")[0].slice(0, 180)}`);
	ws.close();
	process.exit(errs.length ? 1 : 0);
}

main().catch((e) => { console.error("  probe failed:", e.message); process.exit(3); });
