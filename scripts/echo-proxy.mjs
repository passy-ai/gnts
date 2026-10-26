// A logging proxy: sits between the harness and a model gateway and prints exactly
// what the harness sends and what comes back.
//
// When a model call fails, the question is always the same — what request was made,
// and what did the other end say. This answers it without guessing.
//
//   node scripts/echo-proxy.mjs [--port 3009] [--to http://localhost:3000]
//
// Then point the provider's baseURL at http://localhost:<port>/v1 and make a call.

import http from "node:http";

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i === -1 ? d : argv[i + 1]; };
const PORT = Number(flag("--port", 3009));
const TO = flag("--to", "http://localhost:3000");
const verbose = !argv.includes("--quiet");

const redact = (h) => {
	const out = { ...h };
	for (const k of Object.keys(out)) if (/authorization|cookie|api-key/i.test(k)) {
		const v = String(out[k]);
		out[k] = v.length > 28 ? v.slice(0, 20) + `…(${v.length} chars)` : v;
	}
	return out;
};

const server = http.createServer((req, res) => {
	let body = "";
	req.on("data", (c) => (body += c));
	req.on("end", () => {
		if (verbose) {
			console.log(`\n→ ${req.method} ${req.url}`);
			console.log(`  headers: ${JSON.stringify(redact(req.headers))}`);
			if (body) {
				let shown = body;
				try {
					const j = JSON.parse(body);
					const ms = j.messages || [];
					const last = ms[ms.length - 1] && ms[ms.length - 1].content;
					const text = typeof last === "string" ? last : JSON.stringify(last);
					shown = JSON.stringify({ model: j.model, stream: j.stream, msgs: ms.length, max_tokens: j.max_tokens }) +
						"\n  prompt: " + String(text).replace(/\s+/g, " ").slice(0, 220);
				} catch { shown = body.slice(0, 300); }
				console.log(`  body: ${shown}`);
			}
		}
		const target = new URL(req.url, TO);
		const proxied = http.request(
			{ hostname: target.hostname, port: target.port, path: target.pathname + target.search, method: req.method, headers: { ...req.headers, host: target.host } },
			(up) => {
				let upBody = "";
				up.on("data", (c) => (upBody += c));
				up.on("end", () => {
					if (verbose) {
						const mark = up.statusCode >= 400 ? "✗" : "✓";
						console.log(`  ${mark} ${up.statusCode} ${upBody.slice(0, 400) || "(empty)"}`);
					}
					res.writeHead(up.statusCode, up.headers);
					res.end(upBody);
				});
			},
		);
		proxied.on("error", (e) => {
			console.log(`  ✗ proxy error: ${e.message}`);
			res.writeHead(502, { "content-type": "text/plain" });
			res.end("proxy error: " + e.message);
		});
		if (body) proxied.write(body);
		proxied.end();
	});
});

server.listen(PORT, "127.0.0.1", () => {
	console.log(`  echo-proxy on http://127.0.0.1:${PORT} → ${TO}`);
	console.log(`  point the provider's baseURL at http://127.0.0.1:${PORT}/v1`);
});
