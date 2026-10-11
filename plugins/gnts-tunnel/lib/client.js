window.__ModuleLoader__.load({
	// gnts: register under OUR package name.
	id: "gnts-tunnel",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		var inject = ["slots", "locale"];

		function apply(ctx) {
			try {
				var React = require("react");
				var cE = React.createElement;
				var useEffect = React.useEffect;
				var useState = React.useState;

				// The original Models page stylesheet, reused so this page shares the
				// exact same design (tokens via var(--dsw-alias-*)).
				var css = ".zGbnIq_section{max-width:720px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:12px;display:flex}" +
					".zGbnIq_title{color:var(--dsw-alias-label-primary);margin:0;font-size:16px;font-weight:500;line-height:24px}" +
					".zGbnIq_intro{color:var(--dsw-alias-label-tertiary);margin:0;font-size:14px;line-height:22px}" +
					".zGbnIq_notice{color:var(--dsw-alias-state-warn-label);margin:0;font-size:12px;line-height:18px}" +
					".zGbnIq_savedNotice{color:var(--dsw-alias-state-success-primary);margin:0;font-size:12px;line-height:18px}" +
					".zGbnIq_error{color:var(--dsw-alias-state-error-primary);margin:0;font-size:12px;line-height:18px}" +
					
					
					
					
					
					
					".zGbnIq_qr{background:#fff;border-radius:14px;display:block;width:180px;height:180px;margin:4px 0}" +
					".zGbnIq_foldSummary{cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;line-height:18px}" +
					// provisioning bar: slim, dark, left-to-right
					".zGbnIq_progress{background:var(--dsw-alias-bg-module-platform);border-radius:999px;height:4px;overflow:hidden;position:relative;width:100%}" +
					".zGbnIq_progressFill{background:var(--dsw-alias-label-primary);border-radius:999px;height:100%;width:38%;position:absolute;left:-38%;animation:dsh-tunnel-slide 1.15s cubic-bezier(.45,.05,.55,.95) infinite}" +
					"@keyframes dsh-tunnel-slide{0%{left:-38%}55%{left:62%}100%{left:100%}}" +
					"@media (prefers-reduced-motion:reduce){.zGbnIq_progressFill{animation-duration:2.4s}}" +
					".zGbnIq_rows{flex-direction:column;gap:8px;margin:12px 0 0;padding:0;list-style:none;display:flex}" +
					".zGbnIq_rowCard{border:.5px solid var(--dsw-alias-border-l4);border-radius:16px;flex-direction:column;gap:12px;padding:12px 14px;display:flex}" +
					// an "add" panel is ONE grey block (Autodiscover's Add-a-provider): no outer
					// border and no second box inside, so nothing is nested or outlined twice
					".zGbnIq_addCard{background:var(--dsw-alias-bg-module-platform);border-radius:12px;flex-direction:column;gap:14px;padding:14px 16px;list-style:none;display:flex}" +
					".zGbnIq_addCard .zGbnIq_editor{background:0 0;padding:0}" +
					".zGbnIq_addActions{flex-wrap:wrap;gap:10px;display:flex}" +
					".zGbnIq_rowHead{align-items:center;gap:10px;display:flex}" +
					".zGbnIq_rowIdentity{align-items:center;gap:6px;min-width:0;display:inline-flex}" +
					".zGbnIq_rowName{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px}" +
					".zGbnIq_rowTag{border:.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary);border-radius:4px;flex:none;padding:1px 6px;font-size:11px;line-height:16px}" +
					".zGbnIq_rowActions{align-items:center;gap:6px;margin-left:auto;display:inline-flex}" +
					".zGbnIq_primaryButton,.zGbnIq_secondaryButton{box-sizing:border-box;height:36px;font:inherit;cursor:pointer;border:none;border-radius:18px;justify-content:center;align-items:center;gap:4px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}" +
					".zGbnIq_primaryButton{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}" +
					".zGbnIq_primaryButton:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}" +
					".zGbnIq_secondaryButton{border:.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary);background:0 0}" +
					".zGbnIq_secondaryButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}" +
					".zGbnIq_rowActions .zGbnIq_secondaryButton{border-radius:14px;height:28px;padding:0 10px;font-size:12px;line-height:18px}" +
					".zGbnIq_primaryButton:disabled,.zGbnIq_secondaryButton:disabled{opacity:.4;cursor:default}" +
					".zGbnIq_editor{background:var(--dsw-alias-bg-module-platform);border-radius:12px;flex-direction:column;gap:14px;padding:14px 16px;display:flex}" +
					".zGbnIq_field{flex-direction:column;gap:6px;display:flex}" +
					".zGbnIq_fieldLabel{color:var(--dsw-alias-label-secondary);align-items:center;gap:10px;font-size:12px;font-weight:500;line-height:18px;display:inline-flex}" +
					".zGbnIq_advancedHint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}" +
					".zGbnIq_steps{color:var(--dsw-alias-label-tertiary);flex-direction:column;gap:6px;margin:0;padding-left:18px;font-size:12px;line-height:18px;display:flex}" +
					".zGbnIq_input{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);width:100%;height:32px;font:inherit;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 10px;font-size:14px;line-height:22px}" +
					".zGbnIq_input:focus{border-color:var(--dsw-alias-brand-primary);outline:none}" +
					".zGbnIq_input::placeholder{color:var(--dsw-alias-label-dimmed)}" +
					".zGbnIq_input:disabled{opacity:.6;cursor:default}" +
					"select.zGbnIq_input{cursor:pointer;max-width:200px}" +
					".zGbnIq_actionRow{align-items:center;flex-wrap:wrap;gap:8px;display:flex}" +
					".zGbnIq_actionRow>.zGbnIq_input{width:auto;flex:1 1 200px;min-width:0}" +
					".zGbnIq_actionRow>.zGbnIq_primaryButton,.zGbnIq_actionRow>.zGbnIq_secondaryButton{flex:none}" +
					".zGbnIq_statRow{align-items:baseline;gap:10px;display:flex}" +
					".zGbnIq_statLabel{color:var(--dsw-alias-label-tertiary);flex:none;width:84px;font-size:12px;line-height:18px}" +
					".zGbnIq_statValue{color:var(--dsw-alias-label-primary);flex:1;min-width:0;font-size:13px;line-height:20px;overflow-wrap:anywhere}" +
					".zGbnIq_mono{font-family:var(--ds-font-family-code,\"SF Mono\",Menlo,Consolas,monospace);font-size:12px;line-height:18px}" +
					".zGbnIq_ok{color:var(--dsw-alias-state-success-primary)}" +
					".zGbnIq_warn{color:var(--dsw-alias-state-warn-label)}";

				// Guard the one thing a bad edit can silently break: a dropped "+" turns the
				// rest of the stylesheet into a dead expression statement, so the page still
				// renders — just unstyled.
				(function () {
					var required = [".zGbnIq_addCard", ".zGbnIq_addActions", ".zGbnIq_rowCard", ".zGbnIq_mono"];
					var missing = required.filter(function (rule) { return css.indexOf(rule) === -1; });
					if (missing.length > 0) console.warn("[tunnel] stylesheet is missing " + missing.join(", ") + " \u2014 check the css string concatenation");
				})();

				var tagId = "dsh-settings-tunnel/tunnel.css";
				if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
					var tag = document.createElement("style");
					tag.setAttribute("data-plugin-css", tagId);
					tag.textContent = css;
					document.head.appendChild(tag);
				}

				// The settings shell renders its fallback gear for section ids it does not
				// know. Swap in the globe glyph (IconGlobeOutline14 from
				// @deepseek-ai/dsh-client-ui-primitives) — this harness, on the internet.
				var GLOBE_GLYPH = "M7.00018 0.353516C10.6708 0.353535 13.6468 3.32958 13.6469 7.00018C13.6468 10.6708 10.6708 13.6468 7.00018 13.6469C3.32957 13.6468 0.353535 10.6708 0.353516 7.00018C0.353535 3.32957 3.32957 0.353531 7.00018 0.353516ZM5.44643 7.59661C5.49463 8.97506 5.70762 10.191 6.02136 11.0793C6.20141 11.5891 6.40328 11.9585 6.59898 12.1889C6.79501 12.4196 6.93213 12.454 7.00018 12.454C7.06822 12.454 7.20533 12.4197 7.40138 12.1889C7.59708 11.9585 7.79895 11.589 7.979 11.0793C8.29274 10.191 8.50574 8.97506 8.55394 7.59661H5.44643ZM1.57861 7.59661C1.80785 9.70467 3.2386 11.4509 5.1715 12.1388C5.07135 11.9317 4.97972 11.7098 4.89746 11.477C4.53084 10.4391 4.30224 9.0828 4.25357 7.59661H1.57861ZM9.74679 7.59661C9.69813 9.0828 9.46952 10.4391 9.1029 11.477C9.0206 11.7099 8.92818 11.9316 8.82797 12.1388C10.7613 11.4511 12.1925 9.70496 12.4218 7.59661H9.74679ZM5.1706 1.8616C3.23814 2.54963 1.80876 4.29604 1.5795 6.40376H4.25357C4.30224 4.91756 4.53083 3.56129 4.89746 2.5234C4.97968 2.29066 5.07051 2.0686 5.1706 1.8616ZM7.00018 1.54637C6.93213 1.54638 6.79503 1.5807 6.59898 1.81145C6.40332 2.04177 6.20139 2.41058 6.02136 2.92012C5.70754 3.80851 5.49461 5.02499 5.44643 6.40376H8.55394C8.50575 5.025 8.29282 3.80851 7.979 2.92012C7.79898 2.41059 7.59705 2.04177 7.40138 1.81145C7.20531 1.58067 7.06823 1.54637 7.00018 1.54637ZM8.82887 1.8616C8.92902 2.0687 9.02064 2.29053 9.1029 2.5234C9.46953 3.56129 9.69812 4.91756 9.74679 6.40376H12.4209C12.1916 4.29575 10.7618 2.54943 8.82887 1.8616Z";
				var SVG_NS = "http://www.w3.org/2000/svg";
				function fixNavIcon() {
					try {
						var cells = document.querySelectorAll(".VOzbGW_navCell");
						for (var i = 0; i < cells.length; i++) {
							if ((cells[i].innerText || "").trim().toLowerCase() !== "tunnel") continue;
							if (cells[i].querySelector("[data-dshtunnel-icon]")) continue;
							var icon = cells[i].querySelector(".VOzbGW_navIcon");
							if (!icon) continue;
							var svg = document.createElementNS(SVG_NS, "svg");
							svg.setAttribute("data-dshtunnel-icon", "1");
							svg.setAttribute("width", "16");
							svg.setAttribute("height", "16");
							svg.setAttribute("viewBox", "0 0 14 14");
							svg.setAttribute("fill", "none");
							svg.setAttribute("class", "VOzbGW_navIcon");
							var glyph = document.createElementNS(SVG_NS, "path");
							glyph.setAttribute("d", GLOBE_GLYPH);
							glyph.setAttribute("fill", "currentColor");
							svg.appendChild(glyph);
							icon.replaceWith(svg);
						}
					} catch (e) {}
				}
				if (typeof document !== "undefined") {
					if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fixNavIcon, { once: true });
					else fixNavIcon();
					// gnts: no repeating rewrite — it made the nav icon flash and change.
				}

				/** Gateway JSON call with the failures mapped to operator-facing text. */
				function gatewayJson(path, init) {
					var options = init || {};
					options.credentials = "same-origin";
					options.headers = { accept: "application/json" };
					if (options.method === "POST") options.headers["content-type"] = "application/x-www-form-urlencoded";
					return fetch(path, options).then(function (res) {
						return res.text().then(function (text) {
							var data = null;
							try { data = JSON.parse(text); } catch (e) {}
							if (res.ok && data && data.ok) return data;
							if (res.status === 403) throw new Error("This browser is not paired to the gateway any more \u2014 pair it again first.");
							if (res.status === 404 && !data) throw new Error("No dsh-remote gateway answered here. Open the app through your remote URL (or run dsh-remote on the host).");
							throw new Error((data && data.error) || "Request failed (" + res.status + ")");
						});
					});
				}

				function copyText(text, done) {
					if (!text) return;
					try {
						if (navigator.clipboard && navigator.clipboard.writeText) {
							navigator.clipboard.writeText(text).then(done, function () {});
							return;
						}
					} catch (e) {}
					try {
						var field = document.querySelector("[data-dshtunnel-url]");
						if (field) { field.select(); document.execCommand("copy"); done(); }
					} catch (e) {}
				}

				/** "running · pid 1234" / "not loaded" for the connector row. */
				function serviceText(service) {
					if (!service) return "unknown";
					// A gateway-managed connector is just running or stopped: "not installed"
					// is about cloudflared itself, which the Version row reports.
					if (service.managedBy === "gateway") {
						var pid = service.pid ? " \u00b7 pid " + service.pid : "";
						return service.running || service.state === "running" ? "running" + pid : "stopped";
					}
					if (!service.loaded) return service.plistInstalled ? "installed, not running" : "not installed";
					return service.state + (service.pid ? " \u00b7 pid " + service.pid : "");
				}
				function connectionText(status) {
					var list = status.connections || [];
					if (list.length === 0) return "no live connections";
					var places = [];
					list.forEach(function (c) { if (places.indexOf(c.location) === -1) places.push(c.location); });
					return list.length + (list.length === 1 ? " connection" : " connections")
						+ (list[0].protocol ? " \u00b7 " + list[0].protocol : "")
						+ " \u00b7 " + places.join(", ");
				}

				function TunnelSection() {
					var statusState = useState(null);
					var status = statusState[0], setStatus = statusState[1];
					var errState = useState(null);
					var err = errState[0], setErr = errState[1];
					var noteState = useState(null);
					var note = noteState[0], setNote = noteState[1];
					var busyState = useState(null);
					var busy = busyState[0], setBusy = busyState[1];
					var tokenState = useState("");
					var token = tokenState[0], setToken = tokenState[1];
					var qrState = useState(null);
					var qrSrc = qrState[0], setQrSrc = qrState[1];
					var copiedState = useState(false);
					var copied = copiedState[0], setCopied = copiedState[1];

					var lastUrl = null;
					function load(withQr) {
						return gatewayJson("/tunnel?format=json" + (withQr ? "&qr=1" : "")).then(function (data) {
							var previous = lastUrl; lastUrl = (data && data.url) || lastUrl;
							if (previous !== lastUrl) setQrSrc(null);
							setStatus(data);
							setErr(null);
							return data;
						}).catch(function (e) {
							setStatus(null);
							setErr(String((e && e.message) || e));
							return null;
						});
					}

					useEffect(function () { load(); }, []);

					// While the hostname is being provisioned, look for it every 2s (the
					// steady-state interval is 15s) so the bar resolves on its own.
					var startingState = useState(false);
					var starting = startingState[0], setStarting = startingState[1];
					useEffect(function () {
						if (!starting) return undefined;
						var ticks = 0;
						var timer = setInterval(function () {
							if (++ticks > 45) { clearInterval(timer); return; }
							load();
						}, 2000);
						return function () { clearInterval(timer); };
					}, [starting]);

					/** Run one management action; the response carries the fresh status. */
					function act(kind, path, body) {
						setBusy(kind);
						setErr(null);
						setNote(null);
						gatewayJson(path, body === undefined ? { method: "POST" } : { method: "POST", body: body })
							.then(function (data) {
								setBusy(null);
								if (data.status) setStatus(data.status);
								setNote(data.message || "done");
								// A quick tunnel's hostname only exists a few seconds after the
								// connector starts: poll briefly so the URL appears by itself.
								var polls = 0;
								var wait = setInterval(function () {
									if (++polls > 12) { clearInterval(wait); return; }
									load().then(function (fresh) {
										if (fresh && fresh.url && /trycloudflare\.com/.test(fresh.url)) clearInterval(wait);
									});
								}, 2500);
							})
							.catch(function (e) {
								setBusy(null);
								setErr(String((e && e.message) || e));
								load();
							});
					}

					var tokenInfo = (status && status.token) || { configured: false };
					// With a token already stored, the button starts THAT token: requiring a
					// fresh paste is what made a stopped tunnel impossible to re-enable.
					var typed = function () { return token.trim().length > 0; };
					var saved = function () { return tokenInfo.configured === true; };
					function startOrSave() {
						if (typed()) {
							act("token", "/tunnel/token?format=json", "token=" + encodeURIComponent(token.trim()));
							setToken("");
						} else {
							// Start the stored token (named) rather than whatever ran before.
							act("start", "/tunnel/restart?format=json", "mode=named");
						}
					}
					var service = status && status.service;
					var cf = (status && status.cloudflared) || {};
					var url = status && status.url;
					var protocol = (status && status.protocol) || "auto";


					var mode = (status && status.mode) || "none";
					var installed = !!(cf.installed);
					var service = (status && status.service) || {};
					// Liveness comes from the connector, not from the mode: a configured
					// named tunnel with nothing running used to read "running".
					var connections = (status && status.connections) || [];
					var live = mode !== "none" && (service.running === true || service.state === "running" || connections.length > 0);

					// "Starting": the connector is up but Cloudflare has not published the
					// hostname yet (a quick tunnel gets a fresh one every start).
					var provisioning = mode === "quick" && !status.url;
					if (provisioning !== starting) setStarting(provisioning);

					return cE("div", { className: "zGbnIq_section" },
						cE("h3", { className: "zGbnIq_title" }, "Tunnel"),
						cE("p", { className: "zGbnIq_intro" }, "Reach this box from anywhere. A quick tunnel needs no account and gives a temporary hostname; a named tunnel keeps one stable hostname on your own domain. The connector forwards your hostname to the local gateway on port 8080."),
						err ? cE("p", { className: "zGbnIq_error" }, err) : null,

						!status && !err ? cE("p", { className: "zGbnIq_advancedHint" }, "Loading\u2026") : null,

						// A fresh quick tunnel is not routable for ~20-40s (Cloudflare has to
						// publish the new hostname). Say so instead of looking broken.
						status && mode === "quick" && status.since && (Date.now() - status.since) < 90000
							? cE("p", { className: "zGbnIq_notice" }, "Fresh quick tunnel \u2014 Cloudflare can take up to ~40 seconds before this hostname answers. The URL appears below as soon as it is published.")
							: null,

						status && !installed
							? cE("p", { className: "zGbnIq_notice" }, "cloudflared is not installed on this host, so no tunnel can run. Install it with:")
							: null,
						status && !installed
							? cE("div", { className: "zGbnIq_actionRow" },
								cE("input", { className: "zGbnIq_linkInput", readOnly: true, value: cf.installHint || "brew install cloudflared", onFocus: function (e) { e.target.select(); } }),
								cE("button", { className: "zGbnIq_secondaryButton", onClick: function () { copyText(cf.installHint || "", function () { setNote("install command copied"); }); } }, "Copy")
							)
							: null,

						// ---- provisioning bar ------------------------------------------
						status && (provisioning || busy === "quick")
							? cE("div", { className: "zGbnIq_field" },
								cE("div", { className: "zGbnIq_progress", role: "progressbar", "aria-label": "Provisioning the tunnel hostname" },
									cE("div", { className: "zGbnIq_progressFill" })
								),
								cE("p", { className: "zGbnIq_advancedHint" }, "Provisioning the tunnel hostname\u2026")
							)
							: null,

						// ---- public URL ------------------------------------------------
						// Only when a tunnel actually exists: with none running, url.txt is the
						// box's own local address and calling that a "Public URL" is a lie.
						status && mode !== "none"
							? cE("ul", { className: "zGbnIq_rows", style: { listStyle: "none" } },
								cE("li", { className: "zGbnIq_rowCard" },
									cE("div", { className: "zGbnIq_rowHead" },
										cE("div", { className: "zGbnIq_rowIdentity" },
											cE("span", { className: "zGbnIq_rowName" }, "Public URL"),
											cE("span", { className: "zGbnIq_rowTag" }, live ? "running" : (mode === "none" ? "not running" : "stopped"))
										),
										status.url
											? cE("div", { className: "zGbnIq_rowActions" },
												cE("button", { className: "zGbnIq_secondaryButton", disabled: busy !== null, onClick: function () {
													setBusy("qr");
													load(true).then(function (data) {
														setBusy(null);
														setQrSrc(data && data.qr ? data.qr : null);
														if (!data || !data.qr) setErr("this host has no qrencode, so no QR is available");
													});
												} }, busy === "qr" ? "\u2026" : "QR"),
												cE("button", { className: "zGbnIq_secondaryButton", onClick: function () { copyText(status.url, function () { setNote("URL copied"); }); } }, "Copy"),
												cE("a", { className: "zGbnIq_secondaryButton", href: status.url, target: "_blank", rel: "noreferrer", style: { textDecoration: "none" } }, "Open")
											)
											: null
									),
									status.url
										? cE("div", { className: "zGbnIq_field" },
											cE("span", { className: "zGbnIq_mono", "data-dshtunnel-url": "1" }, status.url),
											cE("p", { className: "zGbnIq_advancedHint" }, connectionText(status)),
											qrSrc ? cE("img", { className: "zGbnIq_qr", src: qrSrc, alt: "Public URL QR code", width: 180, height: 180 }) : null
										)
										: cE("p", { className: "zGbnIq_advancedHint" }, mode === "none"
											? "No tunnel running. Pick a mode below."
											// while the bar is up, say nothing twice
											: (provisioning ? null : "Waiting for the hostname to appear \u2014 the connector prints it a few seconds after it starts."))
								)
							)
							: null,

						// ---- quick + custom tunnel ----------------------------------------
						// One grey panel each, exactly like Autodiscover's "Add a provider".
						status
							? cE("ul", { className: "zGbnIq_rows", style: { listStyle: "none" } },
								cE("li", { className: "zGbnIq_addCard" },
									cE("div", { className: "zGbnIq_rowHead" },
										cE("div", { className: "zGbnIq_rowIdentity" },
											cE("span", { className: "zGbnIq_rowName" }, "Quick tunnel"),
											cE("span", { className: "zGbnIq_rowTag" }, mode === "quick" ? "running" : "no account")
										)
									),
									cE("div", { className: "zGbnIq_editor" },
										cE("p", { className: "zGbnIq_advancedHint" }, "A random *.trycloudflare.com hostname, no account and nothing to configure. The hostname changes every time the connector restarts."),
										cE("div", { className: "zGbnIq_addActions" },
											cE("button", {
												className: "zGbnIq_primaryButton",
												disabled: busy !== null || !installed,
												onClick: function () { act("quick", "/tunnel/quick?format=json"); }
											}, busy === "quick" ? "Starting\u2026" : (mode === "quick" ? "Restart quick tunnel" : "Start quick tunnel")),
											mode === "quick"
												? cE("button", { className: "zGbnIq_secondaryButton", disabled: busy !== null, onClick: function () { act("stop", "/tunnel/stop?format=json"); } }, busy === "stop" ? "Stopping\u2026" : "Stop")
												: null
										)
									)
								),
								cE("li", { className: "zGbnIq_addCard" },
									cE("div", { className: "zGbnIq_rowHead" },
										cE("div", { className: "zGbnIq_rowIdentity" },
											cE("span", { className: "zGbnIq_rowName" }, "Custom tunnel"),
											cE("span", { className: "zGbnIq_rowTag" }, mode === "named" ? "running" : "your domain")
										)
									),
									cE("div", { className: "zGbnIq_editor" },
										cE("p", { className: "zGbnIq_advancedHint" }, "A hostname you own, so bookmarks and installed apps keep working. Create the tunnel in Cloudflare, point its public hostname at http://localhost:8080, then paste the connector token here."),
										cE("div", { className: "zGbnIq_field" },
											cE("label", { className: "zGbnIq_fieldLabel" }, "Connector token"),
											cE("input", {
												className: "zGbnIq_input",
												type: "password",
												value: token,
												// The field's prefix says what is set, in the ordinary placeholder
												// colour: no status line above it, and never a key-shaped hint.
												placeholder: tokenInfo.configured
													? "Token set and active \u2014 paste a new one to replace it"
													: "Paste the connector token from Cloudflare",
												autoComplete: "off",
												spellCheck: false,
												disabled: busy !== null || !installed,
												onChange: function (e) { setToken(e.target.value); setErr(null); setNote(null); },
												onKeyDown: function (e) { if (e.key === "Enter" && busy === null && (typed() || saved())) startOrSave(); }
											})
										),
										cE("div", { className: "zGbnIq_addActions" },
											cE("button", {
												className: "zGbnIq_primaryButton",
												disabled: busy !== null || !installed || (!typed() && !saved()),
												onClick: startOrSave
											}, busy === "token" ? "Saving\u2026" : busy === "start" ? "Starting\u2026" : (typed() ? "Save and start" : live ? "Restart" : "Start")),
											// Only offer Stop while it is actually running: a configured but
											// stopped named tunnel is exactly the state where the primary
											// button above reads "Start".
											live
												? cE("button", { className: "zGbnIq_secondaryButton", disabled: busy !== null, onClick: function () { act("stop", "/tunnel/stop?format=json"); } }, busy === "stop" ? "Stopping\u2026" : "Stop")
												: null
										),
									)
								)
							)
							: null,


					);
				}

				ctx.slots.inject("settings.section", function () {
					return ctx.slots.register({
						name: "settings.section",
						id: "tunnel",
						order: 14,
						label: function () { return "Tunnel"; },
						inject: function () { return {}; },
						children: {}
					}, TunnelSection);
				});
			} catch (e) {
				console.warn("[tunnel] apply error:", e);
			}
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
