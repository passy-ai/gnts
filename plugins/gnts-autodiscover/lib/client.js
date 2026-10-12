window.__ModuleLoader__.load({
	// gnts: register under OUR package name.
	id: "gnts-autodiscover",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		// gnts: settingsScope is gone in 0.2.0 — the settings mirror changed shape
		// (a namespaces list, not an object with .namespace(id)). It only fed a
		// revision counter for re-render detection, so a local counter replaces it.
		// gnts: settings are read through ConfigForms in 0.2.0 — the describe mirror is
		// built inside ui-settings and handed to ConfigForms, not exposed as a service.
		var inject = ["slots", "locale", "configForms", "remote", "remote.llm", "remote.settings", "remote.credentials"];

		// Open this section from the intro card. There is no service for it, so it drives the
		// two controls a person would: the Settings trigger, then this section's entry.
		function openAutodiscover() {
			try {
				var pick = function (host, text) {
					return [].slice.call(host.querySelectorAll("button,[role=button]"))
						.filter(function (b) { return (b.textContent || "").trim() === text; })[0];
				};
				var trigger = pick(document, "Settings");
				if (!trigger) return;
				trigger.click();
				setTimeout(function () {
					var nodes = [].slice.call(document.querySelectorAll("*"))
						.filter(function (e) { return (e.textContent || "").trim() === "Autodiscover"; });
					var t = nodes[nodes.length - 1];
					var n = t;
					for (var i = 0; i < 5 && n && n.tagName !== "BUTTON"; i++) n = n.parentElement;
					if (n || t) (n || t).click();
				}, 500);
			} catch (e) { console.warn("[autodiscover] could not open the section", e); }
		}

		// The first thing anyone sees: a small card offering the two ways in. Not a wizard and
		// not a gate — dismissing it leaves the app perfectly usable.
		// Set to true to bring the welcome card back. Off while the plugin pages are being
		// worked on, so screenshots are of the thing under test.
		var GNTS_WELCOME = false;

		function StartCard() {
			const React = require("react");
			const cE = React.createElement;
			const st = React.useState(true);
			const show = st[0], setShow = st[1];
			if (!show || !GNTS_WELCOME) return null;
			return cE("div", { className: "gnts-ad-start" }, [
				cE("div", { className: "gnts-ad-startcard", key: "c" }, [
					cE("h3", { key: "t" }, "How do you want to run models?"),
					cE("p", { key: "d" }, "Passy gives you a free key and every Passy model. No account, nothing to install. Or bring a provider of your own."),
					cE("div", { className: "gnts-ad-startrow", key: "r" }, [
						cE("a", {
							key: "p", className: "gnts-ad-btn gnts-ad-btn-primary",
							href: "https://passy.ai/models", target: "_blank", rel: "noreferrer noopener",
						}, "Use Passy"),
						cE("button", {
							key: "a", className: "gnts-ad-btn", type: "button",
							onClick: function () { setShow(false); openAutodiscover(); },
						}, "Add models"),
					]),
					cE("p", { className: "gnts-ad-startnote", key: "n" }, "Create a test key at passy.ai/models, or paste any provider's key in Autodiscover."),
				]),
			]);
		}

		function apply(ctx) {
			try {
				ctx.slots.inject("shell.overlay", function () {
					return ctx.slots.register({ name: "shell.overlay", id: "gnts-ad-start", locale: "common" }, StartCard);
				});
			} catch (e) {}
			try {
				var React = require("react");
				var cE = React.createElement;
				var useEffect = React.useEffect;
				var useState = React.useState;

				// Line icons for the Passy links: a key, a document and a grid. Drawn rather than
				// borrowed so they inherit the surrounding colour and stay crisp at 14px.
				var PASSY_ICONS = {
					key: ["M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"],
					doc: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M8 13h8", "M8 17h5"],
					grid: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z"],
				};
				function passyIcon(name) {
					var paths = PASSY_ICONS[name] || [];
					return cE("svg", { className: "gnts-ad-ico", width: 14, height: 14, viewBox: "0 0 24 24", fill: "none",
						stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
						paths.map(function (d, i) { return cE("path", { key: i, d: d }); }));
				}

				ctx.effect && ctx.effect(function () {
					// gnts: a second registration of the same namespace throws, and the outer
					// catch swallowed it — which skipped everything after it in apply. Guard it.
					if (ctx.locale && ctx.locale.get && ctx.locale.get("settings.models.autodiscover")) return;
					ctx.locale && ctx.locale.register("settings.models.autodiscover", {
						en: {
							nav: "Autodiscover",
							title: "Autodiscover",
							intro: "Pick a provider, paste an API key (or use the configured one) and discover its models live. The format is detected automatically from /v1/chat/completions, /v1/messages or /v1/responses.",
							addTitle: "Add a provider",
							addIntro: "Name it and give it a base URL. The format is detected automatically.",
							providersEmpty: "No configured providers yet. Use the card below to add one.",
							baseUrl: "Base URL",
							apiKey: "API key (optional, used for discovery only)",
							apiKeyPlaceholder: "Paste key to discover models…",
							path: "Completion path (optional)",
							pathHint: "Only when the standard paths don't answer, e.g. /v1/anthropic/messages",
							pathPlaceholder: "/v1/anthropic/messages",
							discover: "Discover",
							discovering: "Discovering…",
							discoverFailed: "No models found on this endpoint",
							search: "Search models…",
							modelsMeta: "models discovered · on",
							on: "on",
							off: "off",
							selectAll: "Select all",
							deselectAll: "Deselect all",
							empty: "Discovered models appear here.",
							addProvider: "Add provider",
							adding: "Adding…",
							saving: "Saving…",
							name: "Provider name",
							namePlaceholder: "e.g. my-gateway",
							detected: "detected",
							routeHint: "Lowercase letters, digits and dashes."
						}
					});
				}, "autodiscover: dictionaries");

				var NS = "llm-pi-ai";

		// gnts: models that reason need `reasoningEfforts` declared, or the selector shows
		// no effort step at all — it renders that pane only for models carrying reasoning.
		// The map is level -> wire value; these are the OpenAI-compatible spellings.
		var REASONING = /(o[134](-|$)|gpt-5|gpt-6|claude|gemini|deepseek|glm-|qwen3|qwq|kimi|k2|grok-[2-9]|magistral|thinking|reason|-r1)/i;
		function reasoningFor(model) {
			if (model === null || typeof model !== "object") return {};
			var hay = String(model.id || "") + " " + String(model.name || "");
			if (!REASONING.test(hay)) return {};
			return { reasoningEfforts: { low: "low", medium: "medium", high: "high" } };
		}
				// provider list cached across section mounts so switching tabs never
				// reloads or flashes (null = never loaded yet)
				var providerCache = { list: null };

				// This page's own phone layout: model rows become flex+wrap (switch, id,
				// chevron on one line; display name on its own line; capacity hidden) and
				// the provider name/dot/tag cluster stays tight.
				var cssMobile = "@media (max-width:768px){" +
					".zGbnIq_modelRow{display:flex!important;flex-wrap:wrap!important;align-items:center;gap:6px 10px;}" +
					".zGbnIq_rowIdentity{gap:4px!important;}" +
					".zGbnIq_modelRow>:nth-child(1){order:1;width:34px!important;height:20px!important;flex:0 0 auto!important;}" +
					".zGbnIq_modelRow>button[role=\"switch\"]{width:34px!important;min-width:34px!important;max-width:34px!important;" +
						"height:20px!important;min-height:20px!important;max-height:20px!important;flex:0 0 34px!important;}" +
					".zGbnIq_modelRow>:nth-child(2){order:2;flex:1 1 120px;min-width:0;}" +
					".zGbnIq_modelRow>:nth-child(3){order:4;flex-basis:100%;min-width:0;width:100%;}" +
					".zGbnIq_modelRow>:nth-child(4){display:none!important;}" +
					".zGbnIq_modelRow>:nth-child(5){order:3;width:28px!important;flex:none;}" +
					// the catalog toolbar (title + Select all / Deselect all / Reset models)
					// cannot fit beside a 300px section: stack it and keep labels on one line
					".zGbnIq_modelListHead{flex-direction:column!important;align-items:stretch!important;gap:8px!important;}" +
					".zGbnIq_modelListHead>div:last-child{flex-wrap:wrap;justify-content:flex-start;gap:2px;}" +
					".zGbnIq_modelCatalogHeading,.zGbnIq_modelCatalogTitle,.zGbnIq_modelCatalogMeta{white-space:nowrap;}" +
					".zGbnIq_linkButton,.zGbnIq_primaryButton,.zGbnIq_secondaryButton,.zGbnIq_dangerButton,.zGbnIq_addModelButton{white-space:nowrap;}" +
				"}";
				var tagMobile = "dsh-settings-models-autodiscover/mobile.css";
				if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagMobile) + "]") === null) {
					var tagM = document.createElement("style");
					tagM.setAttribute("data-plugin-css", tagMobile);
					tagM.textContent = cssMobile;
					document.head.appendChild(tagM);
				}

				// The settings nav icon for this section: use the same refresh glyph as
				// the Discover button (the host's icon map has no entry for us).
				function fixNavIcon() {
					try {
						var cells = document.querySelectorAll(".VOzbGW_navCell");
						for (var i = 0; i < cells.length; i++) {
							if ((cells[i].innerText || "").trim().toLowerCase() !== "autodiscover") continue;
							if (cells[i].querySelector("[data-dshmob-refresh]")) continue;
							var icon = cells[i].querySelector(".VOzbGW_navIcon");
							if (!icon) continue;
							// the host icon is an <svg>: replace the element itself with a real
							// HTML span (innerHTML on an svg makes a non-rendering SVG node)
							var span = document.createElement("span");
							span.setAttribute("data-dshmob-refresh", "1");
							span.setAttribute("aria-hidden", "true");
							span.style.cssText = "display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;font-size:15px;line-height:1;";
							span.textContent = "\u21bb";
							icon.replaceWith(span);
						}
					} catch (e) {}
				}
				if (typeof document !== "undefined") {
					if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fixNavIcon, { once: true });
					else fixNavIcon();
					// gnts: no repeating rewrite — it made the nav icon flash and change.
				}

				// The host stylesheet forces a full-width button on this row, overriding
				// even inline width/max-width. Inline !important is the highest
				// precedence, so the switch keeps its real 34x20 size.
				function enforceSwitchSize() {
					try {
						var sws = document.querySelectorAll('.zGbnIq_modelRow > button[role="switch"]');
						for (var i = 0; i < sws.length; i++) {
							var s = sws[i].style;
							if (s.getPropertyValue("width") === "34px" && s.getPropertyPriority("width") === "important") continue;
							s.setProperty("width", "34px", "important");
							s.setProperty("min-width", "34px", "important");
							s.setProperty("max-width", "34px", "important");
							s.setProperty("height", "20px", "important");
							s.setProperty("max-height", "20px", "important");
							s.setProperty("flex", "0 0 34px", "important");
							s.setProperty("position", "relative", "important");
							s.setProperty("top", "auto", "important");
							s.setProperty("left", "auto", "important");
						}
					} catch (e) {}
				}
				if (typeof document !== "undefined") {
					if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", enforceSwitchSize, { once: true });
					else enforceSwitchSize();
					setInterval(enforceSwitchSize, 1200);
				}
				// Shared settings mirror: warmed by ui-settings at boot and refreshed on
				// document updates; we read from it + subscribe so the tab is instant.
				// gnts: the real namespace revision, from the form. Returning a constant fenced
				// every write at revision 0, the host rejected it as a conflict, and the plugin's
				// conflict branch silently refreshed — which is why the buttons appeared to do
				// nothing at all.
// gnts: the revision to fence a write with. The host answers every accepted write
				// with the new revision, and the stock providers page stores exactly that
				// (setExpectedRevision(written.view.revision)). Falling back to the form snapshot
				// covers the first write, before any answer exists.
				var lastRev;
				function writeSettings(ops) {
					return ctx.remote.settings.mutate(NS, ops, revNow()).then(function (r) {
						var view = r && r.value;
						if (r && r.ok && view && typeof view.revision === "number") lastRev = view.revision;
						return r;
					});
				}
				function revNow() {
					if (typeof lastRev === "number") return lastRev;
					try {
						var form = ctx.configForms.get(NS);
						var snap = form && form.getSnapshot();
						return snap ? snap.revision : undefined;
					} catch (e) { return undefined; }
				}

				var passyCss = ".gnts-ad-passy{display:inline-flex;align-items:center;gap:10px;cursor:pointer;user-select:none;padding:2px 0}.gnts-ad-passy-input{position:absolute;opacity:0;width:0;height:0;pointer-events:none}.gnts-ad-passy-box{width:16px;height:16px;flex:0 0 16px;border-radius:5px;border:1px solid var(--dsw-alias-border-l3);display:inline-flex;align-items:center;justify-content:center;transition:background .14s ease,border-color .14s ease}.gnts-ad-passy:hover .gnts-ad-passy-box{border-color:#4e75df}.gnts-ad-passy-input:checked+.gnts-ad-passy-box{background:#4e75df;border-color:#4e75df}.gnts-ad-passy-input:focus-visible+.gnts-ad-passy-box{outline:2px solid #4e75df;outline-offset:2px}.gnts-ad-passy-tick{color:#fff;font-size:11px;line-height:1;font-weight:600}.gnts-ad-passy-text{font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary)}.gnts-ad-passy-links{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:7px}.gnts-ad-passy-links li{display:flex;align-items:center;gap:7px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}.gnts-ad-ico{flex:0 0 14px;color:var(--dsw-alias-label-tertiary)}.gnts-ad-arrow{color:var(--dsw-alias-label-tertiary);font-size:12px}.gnts-ad-passy-links li{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}";
				if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=\"gnts-autodiscover/passy.css\"]") === null) {
					var passyTag = document.createElement("style");
					passyTag.setAttribute("data-plugin-css", "gnts-autodiscover/passy.css");
					passyTag.textContent = passyCss;
					document.head.appendChild(passyTag);
				}

				// The original Models page stylesheet, reused verbatim so this page
				// shares its exact design (tokens via var(--dsw-alias-*)).
				const css = ".gnts-ad-start{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-mask-1)}.gnts-ad-startcard{box-sizing:border-box;width:min(420px,calc(100vw - 48px));display:flex;flex-direction:column;gap:12px;padding:20px;border-radius:var(--dsw-radius-panel);background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-elevation-prominent)}.gnts-ad-startcard h3{margin:0;font-size:16px;font-weight:500;line-height:24px}.gnts-ad-startcard p{margin:0;font-size:14px;line-height:22px;color:var(--dsw-alias-label-tertiary)}.gnts-ad-startrow{display:flex;gap:8px;flex-wrap:wrap}.gnts-ad-btn{box-sizing:border-box;height:36px;padding:0 16px;border-radius:18px;border:.5px solid var(--dsw-alias-border-l3);cursor:pointer;font:inherit;font-size:14px;line-height:22px;display:inline-flex;align-items:center;background:0 0;color:var(--dsw-alias-label-primary);text-decoration:none}.gnts-ad-btn-primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border-color:transparent}.gnts-ad-startnote{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}.gnts-ad-link{color:#4e75df;text-decoration:underline;text-underline-offset:2px}" + ".zGbnIq_section{max-width:720px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:12px;display:flex}.zGbnIq_title{color:var(--dsw-alias-label-primary);margin:0;font-size:16px;font-weight:500;line-height:24px}.zGbnIq_intro{color:var(--dsw-alias-label-tertiary);margin:0;font-size:14px;line-height:22px}.zGbnIq_notice{color:var(--dsw-alias-state-warn-label);margin:0;font-size:12px;line-height:18px}.zGbnIq_savedNotice{color:var(--dsw-alias-state-success-primary);margin:0;font-size:12px;line-height:18px}.zGbnIq_rows{flex-direction:column;gap:8px;margin:12px 0 0;padding:0;list-style:none;display:flex}.zGbnIq_rowCard{border:.5px solid var(--dsw-alias-border-l4);border-radius:16px;flex-direction:column;gap:12px;padding:12px 14px;display:flex}.zGbnIq_rowHead{align-items:center;gap:10px;display:flex}.zGbnIq_rowIdentity{align-items:center;gap:6px;min-width:0;display:inline-flex}.zGbnIq_rowName{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px}.zGbnIq_rowTag{border:.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary);border-radius:4px;flex:none;padding:1px 6px;font-size:11px;line-height:16px}.zGbnIq_rowWallet{display:inline-flex;align-items:center;gap:4px;border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}.zGbnIq_credentialDot{box-sizing:border-box;corner-shape:round;border-radius:50%;flex:none;width:8px;height:8px;display:inline-block}.zGbnIq_credentialDotConfigured{background:var(--dsw-alias-state-success-primary)}.zGbnIq_credentialDotMissing{background:var(--dsw-alias-state-error-primary)}.zGbnIq_rowActions{align-items:center;gap:4px;margin-left:auto;display:inline-flex}.zGbnIq_primaryButton,.zGbnIq_secondaryButton,.zGbnIq_addButton{box-sizing:border-box;height:36px;font:inherit;cursor:pointer;border:none;border-radius:18px;justify-content:center;align-items:center;gap:4px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}.zGbnIq_primaryButton{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}.zGbnIq_primaryButton:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}.zGbnIq_secondaryButton,.zGbnIq_addButton{border:.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary);background:0 0}.zGbnIq_secondaryButton:hover:not(:disabled),.zGbnIq_addButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.zGbnIq_secondaryButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}.zGbnIq_dangerButton{box-sizing:border-box;height:36px;color:var(--dsw-alias-state-error-primary);font:inherit;cursor:pointer;background:0 0;border:none;border-radius:18px;justify-content:center;align-items:center;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}.zGbnIq_dangerButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}.zGbnIq_rowActions .zGbnIq_secondaryButton,.zGbnIq_rowActions .zGbnIq_dangerButton{border-radius:14px;height:28px;padding:0 10px;font-size:12px;line-height:18px}.zGbnIq_primaryButton:disabled,.zGbnIq_secondaryButton:disabled,.zGbnIq_dangerButton:disabled,.zGbnIq_addButton:disabled,.zGbnIq_linkButton:disabled,.zGbnIq_addModelButton:disabled{opacity:.4;cursor:default}.zGbnIq_primaryButton:focus-visible,.zGbnIq_secondaryButton:focus-visible,.zGbnIq_dangerButton:focus-visible,.zGbnIq_addButton:focus-visible,.zGbnIq_linkButton:focus-visible,.zGbnIq_addModelButton:focus-visible,.zGbnIq_iconButton:focus-visible,.zGbnIq_customizedSummary:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-border-l3);outline:none}.zGbnIq_editor{background:var(--dsw-alias-bg-module-platform);border-radius:12px;flex-direction:column;gap:14px;padding:14px 16px;display:flex}.zGbnIq_editorHeader{align-items:baseline;gap:8px;display:flex}.zGbnIq_editorTitle{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px}.zGbnIq_editorRoute{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.zGbnIq_field{flex-direction:column;gap:6px;display:flex}.zGbnIq_fieldLabel{color:var(--dsw-alias-label-secondary);align-items:center;gap:10px;font-size:12px;font-weight:500;line-height:18px;display:inline-flex}.zGbnIq_linkButton{box-sizing:border-box;height:28px;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:none;border-radius:14px;align-items:center;padding:0 10px;font-size:12px;line-height:18px;display:inline-flex}.zGbnIq_linkButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.zGbnIq_advancedHint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}.zGbnIq_editorActions{justify-content:flex-end;gap:8px;display:flex}.zGbnIq_addBlock{flex-direction:column;gap:12px;display:flex}.zGbnIq_addActions{flex-wrap:wrap;gap:10px;display:flex}.zGbnIq_addButton{border:1px dashed var(--dsw-alias-border-l3);border-radius:16px;flex:1 1 0;gap:6px;min-width:180px;height:44px}.zGbnIq_addCard,.zGbnIq_setupCard{background:var(--dsw-alias-bg-module-platform);border-radius:12px;flex-direction:column;gap:14px;padding:14px 16px;list-style:none;display:flex}.zGbnIq_addCard .zGbnIq_editor,.zGbnIq_setupCard .zGbnIq_editor{background:0 0;padding:0}.zGbnIq_customized{border-top:.5px solid var(--dsw-alias-border-l2);padding-top:10px}.zGbnIq_customizedSummary{cursor:pointer;width:fit-content;color:var(--dsw-alias-label-secondary);border-radius:6px;align-items:center;gap:6px;margin-left:-4px;padding:2px 4px;font-size:12px;font-weight:500;line-height:18px;list-style:none;display:flex}.zGbnIq_customizedSummary::-webkit-details-marker{display:none}.zGbnIq_customizedSummary:before{content:\"\";border-bottom:1.5px solid;border-right:1.5px solid;width:5px;height:5px;transition:transform .12s;transform:rotate(-45deg)translate(-1px,-1px)}.zGbnIq_customized[open]>.zGbnIq_customizedSummary:before{transform:rotate(45deg)translate(-1px,-1px)}.zGbnIq_customizedSummary:hover{color:var(--dsw-alias-label-primary)}.zGbnIq_customizedBody{flex-direction:column;gap:12px;padding-top:12px;display:flex}.zGbnIq_modelCatalog{border-top:.5px solid var(--dsw-alias-border-l2);flex-direction:column;gap:10px;padding-top:12px;display:flex}.zGbnIq_modelCatalogHeading{flex-direction:column;gap:2px;display:flex}.zGbnIq_modelCatalogTitle{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;line-height:18px}.zGbnIq_modelCatalogMeta,.zGbnIq_modelEmpty{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}.zGbnIq_modelList{flex-direction:column;gap:8px;display:flex}.zGbnIq_modelListHead{justify-content:space-between;align-items:flex-start;gap:12px;display:flex}.zGbnIq_modelEntry{border:.5px solid var(--dsw-alias-border-l4);border-radius:10px;padding:6px}.zGbnIq_modelRow{grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) auto auto;align-items:center;gap:6px;display:grid}.zGbnIq_iconButton{box-sizing:border-box;width:28px;height:28px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:6px;justify-content:center;align-items:center;display:inline-flex}.zGbnIq_iconButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.zGbnIq_iconButton:disabled{cursor:default;opacity:.4}.zGbnIq_iconButtonDanger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary)}.zGbnIq_modelAdvanced{grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;padding:8px 4px 2px;display:grid}.zGbnIq_modelField{flex-direction:column;gap:4px;display:flex}.zGbnIq_modelFieldLabel{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.zGbnIq_modelEmpty{border:1px dashed var(--dsw-alias-border-l3);text-align:center;border-radius:8px;padding:12px}.zGbnIq_addModelButton{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l3);height:28px;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;background:0 0;border-radius:14px;align-self:flex-start;align-items:center;gap:4px;padding:0 10px;font-size:12px;line-height:18px;display:inline-flex}.zGbnIq_addModelButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.zGbnIq_input{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);width:100%;height:32px;font:inherit;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 10px;font-size:14px;line-height:22px}select.zGbnIq_input{cursor:pointer;max-width:240px}.zGbnIq_input:focus{border-color:var(--dsw-alias-brand-primary);outline:none}.zGbnIq_input::placeholder{color:var(--dsw-alias-label-dimmed)}.zGbnIq_input:disabled{opacity:.6;cursor:default}.zGbnIq_selectInput{appearance:none;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2381858C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\");background-position:right 12px center;background-repeat:no-repeat;background-size:12px 12px;padding-right:32px}.zGbnIq_error{color:var(--dsw-alias-state-error-primary);margin:0;font-size:12px;line-height:18px}.zGbnIq_deleteDialog{width:min(480px,100%)}.zGbnIq_deleteConfirm:not(:disabled){border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}.zGbnIq_deleteConfirm:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}.zGbnIq_hiddenLabel{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}@media (prefers-reduced-motion:reduce){.zGbnIq_customizedSummary:before,.zGbnIq_switchThumb{transition:none}}.zGbnIq_fetchDialog{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);max-width:520px}.zGbnIq_candidateToolbar{align-items:center;gap:8px;margin-bottom:6px;display:flex}.zGbnIq_candidateSearch{flex:240px;min-width:0}.zGbnIq_candidateList{flex-direction:column;gap:2px;max-height:320px;margin:0;padding:0;list-style:none;display:flex;overflow-y:auto}.zGbnIq_candidate{border-radius:6px}.zGbnIq_candidateLabel{cursor:pointer;align-items:center;gap:8px;padding:6px 8px;display:flex}.zGbnIq_candidateId{font-family:var(--ds-font-family-code);overflow-wrap:anywhere;flex:auto;font-size:13px}.zGbnIq_candidateEmpty{color:var(--dsw-alias-label-secondary);text-align:center;margin:24px 0;font-size:13px;line-height:20px}";
				var tagId = "dsh-settings-models-autodiscover/ModelsSection.module.css";
				if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
					// Switch and model rows must shrink: their grids had hard minimums (minmax(160px,1fr)),
// which is what scrolled sideways on a narrow screen instead of fitting.
const fitCss = "" +
	// the switch is back, and the row shrinks: every flexible column is minmax(0,…) so a
	// long model name ellipsises instead of pushing the row wider than its container
	".zGbnIq_modelRow{grid-template-columns:auto minmax(0,1.4fr) minmax(0,1fr) auto auto!important;min-width:0!important;overflow-x:visible!important;}" +
	".zGbnIq_modelAdvanced{grid-template-columns:repeat(auto-fit,minmax(0,1fr))!important;}" +
	".zGbnIq_rowCard,.zGbnIq_rows,.zGbnIq_rowHead,.zGbnIq_field,.zGbnIq_editor{min-width:0!important;max-width:100%!important;}" +
	".zGbnIq_input{min-width:0!important;}" +
	// no switches on mobile (they are glitchy there); the desktop keeps them. Its column
	// collapses to 0 because it is sized `auto`.
	"@media (max-width:768px){.zGbnIq_modelRow [role=switch]{display:none!important;}}";
const fitTag = document.createElement("style");
fitTag.setAttribute("data-plugin-css", "dsh-settings-models-autodiscover/fit.css");
fitTag.textContent = fitCss;
document.head.appendChild(fitTag);
var tag = document.createElement("style");
					tag.setAttribute("data-plugin-css", tagId);
					tag.textContent = css;
					document.head.appendChild(tag);
				}

				// --- helpers -----------------------------------------------------------

				/** Credential ref a typed key is stored under: PROVIDER_ROUTE_API_KEY. */
				function deriveKeyRef(provider) {
					return provider.toUpperCase().replace(/[^A-Z0-9]+/g, "_") + "_API_KEY";
				}
				/** Route id usable as a settings key AND a credential name stem. */
				var ROUTE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
				function isHttpUrl(value) {
					try {
						var protocol = new URL(value).protocol;
						return protocol === "http:" || protocol === "https:";
					} catch (e) { return false; }
				}
				function apiFromPath(path) {
					var p = (path || "").toLowerCase();
					if (p.indexOf("/messages") !== -1) return "anthropic-messages";
					if (p.indexOf("/responses") !== -1) return "openai-responses";
					return "openai-completions";
				}
				var PLAIN_APIS = ["openai-completions", "anthropic-messages", "openai-responses"];

				/** Walk a settings-path from the namespace value. */
				function pick(value, path) {
					var cur = value;
					for (var i = 0; cur && path && i < path.length; i++) cur = cur[path[i]];
					return cur;
				}
				function countK(v) {
					if (!v) return "";
					return Math.round(v / 1000) + "K";
				}
				var CAPACITY_PATTERN = /^(\d+(?:\.\d+)?)([km])?$/i;
				function parseCapacity(text) {
					var trimmed = (text || "").trim();
					if (trimmed.length === 0) return undefined;
					var match = CAPACITY_PATTERN.exec(trimmed);
					if (match === null) return NaN;
					var scale = (match[2] || "").toLowerCase() === "k" ? 1000 : (match[2] || "").toLowerCase() === "m" ? 1000000 : 1;
					var scaled = Number(match[1]) * scale;
					return Math.round(scaled);
				}
				function formatCapacity(value) {
					if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) return value === undefined ? "" : String(value);
					if (value % 1000000 === 0) return String(value / 1000000) + "M";
					if (value % 1000 === 0) return String(value / 1000) + "K";
					return String(value);
				}

				/**
				 * Probe the endpoint across the supported wire formats until one
				 * answers with a model listing; that format is then stored with the
				 * provider. A custom completion path (e.g. /v1/anthropic/messages)
				 * narrows the probe to a single format inferred from its tail.
				 */
				// gnts: a base URL is normalised before it is used or saved. A bare host gets
				// https, and a public host typed over plain http is upgraded — the service
				// refuses http, which reads as "discovery does not work". Loopback keeps http,
				// where that is the normal thing to type.
				function normaliseBase(raw) {
					var v = (raw || "").trim();
					if (v === "") return v;
					// Only supply a scheme when there is none. An explicit http is left
					// alone — forcing https here overrode what was typed, which is not
					// this function's job.
					if (!/^https?:\/\//i.test(v)) v = "https://" + v;
					return v;
				}
				function probe(baseURL, customPath, key, onlyApi) {
					var base = normaliseBase(baseURL);
					if (!base) return Promise.resolve({ ok: false, message: "Set a base URL first." });
					var apis;
					if (customPath && customPath.trim().length > 0) {
						apis = [apiFromPath(customPath)];
					} else if (onlyApi && PLAIN_APIS.indexOf(onlyApi) !== -1) {
						// stored format first, then the rest as fallback
						apis = [onlyApi].concat(PLAIN_APIS.filter(function (a) { return a !== onlyApi; }));
					} else {
						apis = PLAIN_APIS.slice();
					}
					var lastErr = "";
					function tryOne(api) {
						var req = { baseURL: base, api: api };
						var k = key && key.trim();
						if (k) req.apiKey = k;
						return ctx.remote.llm.discoverModels(NS, req).then(function (r) {
							if (r && r.ok && Array.isArray(r.value) && r.value.length > 0) {
								return { ok: true, api: api, models: r.value };
							}
							lastErr = (r && r.error && r.error.message) ? r.error.message : "the endpoint did not answer";
							return null;
						}).catch(function (e) {
							lastErr = String(e && e.message || e);
							return null;
						});
					}
					function step(i) {
						if (i >= apis.length) return { ok: false, message: lastErr };
						return tryOne(apis[i]).then(function (res) { return res || step(i + 1); });
					}
					return Promise.resolve(step(0)).then(function (res) {
						if (res && res.ok) return res;
						return { ok: false, message: (res && res.message) || lastErr || "no models found" };
					});
				}

				// Pixel width of the provider name in its own font, so the input box
				// hugs the text exactly (a `size` in characters always leaves slack).
				function nameWidth(text) {
					try {
						var cv = nameWidth._c || (nameWidth._c = document.createElement("canvas"));
						var ctx = cv.getContext("2d");
						ctx.font = "500 14px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
						return Math.max(24, Math.ceil(ctx.measureText(String(text || "")).width) + 9);
					} catch (e) { return 80; }
				}

				/** One model row: switch + id + context window. */
				function ModelRow(props) {
					var m = props.model, on = props.on, disabled = props.disabled,
						editable = props.editable,          // model lives in the stored list -> fields editable
						onToggle = props.onToggle,
						onPatch = props.onPatch;            // (model, patch) -> save to profile
					// Apple-style switch: width 34 x height 20, 16px knob, 2px gutter.
					var track = {
						flex: "none", width: 34, height: 20, maxWidth: 34, maxHeight: 20,
						borderRadius: 10, border: "none", margin: 0, padding: 0,
						cursor: "pointer", position: "relative", display: "block",
						boxSizing: "border-box", alignSelf: "start", justifySelf: "start",
						background: on ? "var(--dsw-alias-state-success-primary)" : "var(--dsw-alias-border-l4)",
						transition: "background .15s ease"
					};
					var knob = {
						position: "absolute", top: 2, left: on ? 16 : 2, width: 16, height: 16,
						borderRadius: 8, background: "#fff", pointerEvents: "none",
						boxShadow: "0 1px 3px rgba(0,0,0,.35)", transition: "left .15s ease"
					};
					var openState = useState(false);
					var open = openState[0], setOpen = openState[1];
					// capacity drafts with the original's K/M shorthand, committed on blur
					var ctxState = useState("");
					var ctxDraft = ctxState[0], setCtxDraft = ctxState[1];
					var maxState = useState("");
					var maxDraft = maxState[0], setMaxDraft = maxState[1];
					useEffect(function () { setCtxDraft(m.contextWindow ? formatCapacity(m.contextWindow) : ""); }, [m.contextWindow]);
					useEffect(function () { setMaxDraft(m.maxTokens ? formatCapacity(m.maxTokens) : ""); }, [m.maxTokens]);
					var lock = disabled || !editable;
					function patch(field, raw) {
						if (!editable || !onPatch) return;
						var partial = {};
						if (raw === "") {
							partial[field] = undefined;
							onPatch(m, partial);
							return;
						}
						var parsed = parseCapacity(raw);
						if (parsed !== undefined && !isNaN(parsed)) {
							partial[field] = parsed;
							onPatch(m, partial);
						}
					}
					var chev = {
						width: 8, height: 8, boxSizing: "border-box",
						borderRight: "1.5px solid var(--dsw-alias-label-tertiary)", borderBottom: "1.5px solid var(--dsw-alias-label-tertiary)",
						transform: open ? "rotate(45deg)" : "rotate(-45deg)", transition: "transform .15s ease"
					};
					return cE("li", { className: "zGbnIq_modelEntry", style: { listStyle: "none" } },
						cE("div", { className: "zGbnIq_modelRow", style: { gridTemplateColumns: "auto minmax(0,1.4fr) minmax(0,1fr) auto auto", gap: 8, alignItems: "center" } },
							cE("button", {
								role: "switch", "aria-checked": on, disabled: disabled, tabIndex: 0,
								onClick: function (e) { e.stopPropagation(); onToggle(!on); },
								style: track
							}, cE("span", { style: knob })),
							cE("input", { className: "zGbnIq_input", type: "text", value: typeof m.id === "string" ? m.id : "", placeholder: "model id",
								disabled: lock,
								onChange: function (e) { if (editable && onPatch) onPatch(m, { id: e.target.value }); } }),
							cE("input", { className: "zGbnIq_input", type: "text", value: typeof m.name === "string" ? m.name : "", placeholder: "display name",
								disabled: lock,
								onChange: function (e) { if (editable && onPatch) onPatch(m, { name: e.target.value === "" ? undefined : e.target.value }); } }),
							cE("span", { style: { flex: "none", color: "var(--dsw-alias-label-tertiary)", fontSize: 12, textAlign: "right" } }, countK(m.contextWindow)),
							cE("button", { className: "zGbnIq_iconButton", title: open ? "Collapse" : "Expand", "aria-expanded": open,
								onClick: function (e) { e.stopPropagation(); setOpen(!open); } },
								cE("span", { style: chev }))
						),
						open ? cE("div", { className: "zGbnIq_modelAdvanced" },
							cE("label", { className: "zGbnIq_modelField" },
								cE("span", { className: "zGbnIq_modelFieldLabel" }, "Context window"),
								cE("input", { className: "zGbnIq_input", type: "text", inputMode: "numeric", value: ctxDraft, placeholder: "256K",
									disabled: lock,
									onChange: function (e) { setCtxDraft(e.target.value); },
									onBlur: function () { patch("contextWindow", ctxDraft); } })),
							cE("label", { className: "zGbnIq_modelField" },
								cE("span", { className: "zGbnIq_modelFieldLabel" }, "Max output"),
								cE("input", { className: "zGbnIq_input", type: "text", inputMode: "numeric", value: maxDraft, placeholder: "32K",
									disabled: lock,
									onChange: function (e) { setMaxDraft(e.target.value); },
									onBlur: function () { patch("maxTokens", maxDraft); } }))
						) : null
					);
				}

				// --- one configured provider ---------------------------------------------

				function ProviderCard(props) {
					var prov = props.prov;
					var entry = props.entry;
					var loading = props.loading === true;            // stored profile under settingsPath
					var scope = props.scope;
					var onChanged = props.onChanged;    // bump section after writes
					var t = props.t;

					var displayName = (entry && entry.displayName) || prov.displayName || prov.provider;
					var apiTag = (entry && entry.api) || "";
					var baseURLInit = (entry && entry.baseURL) || "";

					var keyState = useState("");
					var keyVal = keyState[0], setKey = keyState[1];
					var urlState = useState(baseURLInit);
					var urlVal = urlState[0], setUrl = urlState[1];
					var pathState = useState("");
					var pathVal = pathState[0], setPath = pathState[1];
					var apiState = useState(apiTag);
					var apiSel = apiState[0], setApiSel = apiState[1];
					var discState = useState(null);
					var disc = discState[0], setDisc = discState[1];
					var busyState = useState(false);
					var busy = busyState[0], setBusy = busyState[1];
					var errState = useState(null);
					var err = errState[0], setErr = errState[1];
					var savingState = useState(false);
					var saving = savingState[0], setSaving = savingState[1];
					var queryState = useState("");
					var query = queryState[0], setQuery = queryState[1];
					var showPathState = useState(false);
					var showPath = showPathState[0], setShowPath = showPathState[1];
					var dotState = useState(null);      // null unknown, true ok, false missing
					var dot = dotState[0], setDot = dotState[1];
					var nameDraftState = useState(displayName);
					var nameDraft = nameDraftState[0], setNameDraft = nameDraftState[1];
					var focusedState = useState(false);
					var focused = focusedState[0], setFocused = focusedState[1];
					var openState = useState(false);
					var open = openState[0], setOpen = openState[1];

					function saveName() {
						var v = nameDraft.trim();
						if (v && v !== displayName) persist({ displayName: v });
					}

					// Credential dot: apiKeyEnv ref, else the derived provider ref.
					//
					// It used to show red on every reload for a provider that works. While the stored
					// profile is still loading, `entry` is absent, so the derived ref is the wrong one
					// and the lookup answers "not configured". Unknown now stays unknown, and a failed
					// lookup is not evidence that a key is missing.
					useEffect(function () {
						if (loading) { setDot(null); return undefined; }
						var ref = (entry && entry.apiKeyEnv) || deriveKeyRef(prov.provider);
						var cancelled = false;
						ctx.remote.credentials.describe([ref]).then(function (r) {
							if (cancelled) return;
							var v = r && r.ok && r.value && r.value[ref];
							setDot(v && typeof v.configured === "boolean" ? v.configured === true : null);
						}).catch(function () { if (!cancelled) setDot(null); });
						return function () { cancelled = true; };
					}, [prov.provider, entry && entry.apiKeyEnv, loading]);



					function persist(partial) {
						// merge into the stored profile (api/baseURL surface changes only)
						var merged = {};
						if (entry) for (var k in entry) merged[k] = entry[k];
						for (var k2 in partial) {
							// `undefined` means "remove this key": the merge below cannot
							// otherwise drop a value the user turned off.
							if (partial[k2] === undefined) delete merged[k2];
							else merged[k2] = partial[k2];
						}
						var ops = [{ op: "set", path: (prov.settingsPath || []).slice(), value: merged }];
						return writeSettings(ops).then(function (r) {
							if (r && r.ok) onChanged();
							else if (r && r.error && r.error.code === "settings/conflict") onChanged();
							return r;
						}).catch(function () { return null; });
					}
					function saveModels(models) {
						setSaving(true);
						var ops = [{ op: "set", path: (prov.settingsPath || []).concat(["models"]), value: models }];
						writeSettings(ops).then(function (r) {
							setSaving(false);
							if (r && r.ok) onChanged();
							else if (r && r.error && r.error.code === "settings/conflict") onChanged();
							else setErr((r && r.error && r.error.message) || "save failed");
						}).catch(function (e) { setSaving(false); setErr(String(e && e.message || e)); });
					}
					// A conservative read of a model list: names that only ever ship with
					// image input. Everything else stays text-only unless the owner says
					// otherwise, so a wrong guess cannot silently claim vision support.
					var MULTIMODAL = /(vision|claude|gpt-4|gpt-5|o[34]-|gemini|grok-[2-9]|qwen.*vl|llava|pixtral|omni|glm-4v|internvl|cogvlm)/i;

					function looksMultimodal(model) {
						return model !== null && typeof model === "object" && MULTIMODAL.test(String(model.id || "") + " " + String(model.name || ""));
					}
					function discover(url, key, path, onlyApi) {
						setBusy(true); setErr(null);
						probe(url, path, key, onlyApi || apiSel).then(function (res) {
							if (res && res.ok) {
								setDisc(res.models);
								setShowPath(false);
								// remember the wire format (user choice wins over detection) + baseURL
								var next = { api: apiSel || res.api, ...(url ? { baseURL: normaliseBase(url) } : {}) };
								// The harness defaults a model's input to text only, so without
								// this every model in the app claims it cannot take an image.
								// Providers that clearly ship vision models get the modality
								// declared; anything else is left for the owner to set.
								var declared = entry && entry.defaultInput;
								// A single "text" is the schema default written out, not a choice:
								// treat it as unset so a vision provider stops claiming text-only.
								var unset = declared === undefined || (Array.isArray(declared) && declared.length === 1 && declared[0] === "text");
								if (unset && (res.models || []).some(looksMultimodal)) {
									next.defaultInput = ["text", "image"];
								}
								persist(next);
								return;
							}
							setErr("No models found on this endpoint" + ": " + (res && res.message || "?"));
							setShowPath(true);
						}).catch(function (e) {
							setErr(String(e && e.message || e));
							setShowPath(true);
						}).then(function () { setBusy(false); });
					}
					function toggleModel(model, on) {
						var next = (entry && entry.models ? entry.models : []).filter(function (m) { return m.id !== model.id; });
						if (on) {
							var prev = (entry && entry.models ? entry.models : []).filter(function (m) { return m.id === model.id; })[0];
							next.push(prev || { id: model.id, ...(model.name ? { name: model.name } : {}), ...(model.contextWindow ? { contextWindow: model.contextWindow } : {}), ...reasoningFor(model) });
						}
						saveModels(next);
					}
					function toggleAll(on) {
						var base = (entry && entry.models ? entry.models : []).slice();
						if (on && disc) {
							disc.forEach(function (m) {
								if (!base.some(function (x) { return x.id === m.id; })) base.push({ id: m.id });
							});
						} else {
							base = base.filter(function (x) { return !disc || !disc.some(function (m) { return m.id === x.id; }); });
						}
						saveModels(base);
					}
					function patchModel(model, patch) {
						var arr = (entry && Array.isArray(entry.models) ? entry.models : []).slice();
						var at = -1;
						for (var i = 0; i < arr.length; i++) if (arr[i].id === model.id) { at = i; break; }
						if (at === -1) arr.push(Object.assign({}, { id: model.id }, patch));
						else arr[at] = Object.assign({}, arr[at], patch);
						saveModels(arr);
					}
					function removeModel(model) {
						saveModels((entry && Array.isArray(entry.models) ? entry.models : []).filter(function (m2) { return m2.id !== model.id; }));
					}
					function addModel() {
						saveModels((entry && Array.isArray(entry.models) ? entry.models : []).concat([{ id: "" }]));
					}
					function removeProvider() {
						setSaving(true);
						writeSettings([{ op: "unset", path: (prov.settingsPath || []).slice() }]).then(function (r) {
							setSaving(false);
							if (r && r.ok) onChanged();
							else if (r && r.error && r.error.code === "settings/conflict") onChanged();
							else setErr((r && r.error && r.error.message) || "remove failed");
						}).catch(function (e) { setSaving(false); setErr(String(e && e.message || e)); });
					}
					function resetModels() {
						// keep the models listed (toggled off) instead of blanking the list
						var prev = (entry && Array.isArray(entry.models) ? entry.models : []).slice();
						setDisc(disc !== null ? disc : prev);
						saveModels([]);
					}

					var currentModels = entry && Array.isArray(entry.models) ? entry.models : [];
					var currentIds = {};
					currentModels.forEach(function (m) { currentIds[m.id] = true; });
					var list = (disc !== null ? disc : currentModels) || [];
					if (query) {
						var q = query.toLowerCase();
						list = list.filter(function (m) {
							return m.id.toLowerCase().indexOf(q) !== -1 || (m.name && m.name.toLowerCase().indexOf(q) !== -1);
						});
					}
					var allOn = list.length > 0 && list.every(function (m) { return currentIds[m.id]; });
					var someOn = list.some(function (m) { return currentIds[m.id]; });
					var disabled = busy || saving;

					return cE("li", { className: "zGbnIq_rowCard", "data-provider": prov.provider },
						cE("div", { className: "zGbnIq_rowHead", style: { cursor: "pointer", flexWrap: "wrap" },
							onClick: function () { setOpen(!open); } },
							cE("div", { className: "zGbnIq_rowIdentity", style: { flex: 1, minWidth: 0 } },
								cE("span", { className: "zGbnIq_credentialDot" + (dot === null ? "" : dot ? " zGbnIq_credentialDotConfigured" : " zGbnIq_credentialDotMissing"), title: dot === null ? "" : (dot === true ? "key configured" : "no key configured") }),
								cE("input", { className: "zGbnIq_rowName", type: "text", value: nameDraft, spellCheck: false,
									style: { background: "transparent", borderRadius: 6, padding: "1px 0 1px 4px", margin: "-1px 0 -1px -4px", font: "inherit",
										width: nameWidth(nameDraft) + "px", maxWidth: "100%", flex: "0 1 auto", minWidth: 0,
										border: focused ? "1px solid var(--dsw-alias-border-l3)" : "1px solid transparent" },
									onClick: function (e) { e.stopPropagation(); },
									onFocus: function () { setFocused(true); },
									onBlur: function () { setFocused(false); saveName(); },
									onChange: function (e) { setNameDraft(e.target.value); },
									onKeyDown: function (e) { if (e.key === "Enter") e.target.blur(); } }),
								apiTag ? cE("span", { className: "zGbnIq_rowTag" }, apiTag) : null
							),
							cE("div", { className: "zGbnIq_rowActions" },
								cE("button", { className: "zGbnIq_secondaryButton", disabled: disabled,
									onClick: function (e) { e.stopPropagation(); discover(urlVal, keyVal, pathVal, ""); } },
									busy ? "Discovering\u2026" : (disc ? "\u21bb " + "Discover" : "Discover"))
							),
							cE("span", { "aria-hidden": true, style: {
								flex: "none", width: 8, height: 8, boxSizing: "border-box", marginLeft: 4,
								borderRight: "1.5px solid var(--dsw-alias-label-tertiary)", borderBottom: "1.5px solid var(--dsw-alias-label-tertiary)",
								transform: open ? "rotate(45deg)" : "rotate(-45deg)", transition: "transform .15s ease"
							} })
						),
						cE("p", { className: "zGbnIq_intro", style: { margin: 0, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
							baseURLInit ? baseURLInit : "No base URL yet. Set one below and Discover."),
						open ? cE("div", { className: "zGbnIq_customizedBody" },
							cE("div", { className: "zGbnIq_editor" },
								cE("div", { className: "zGbnIq_field" },
									cE("label", { className: "zGbnIq_fieldLabel" }, "Base URL"),
									cE("input", { className: "zGbnIq_input", type: "text", value: urlVal, placeholder: "https://api.example.com/v1", onChange: function (e) { setUrl(e.target.value); } })
								),
								cE("div", { className: "zGbnIq_field" },
									cE("label", { className: "zGbnIq_fieldLabel" }, "API key (optional)"),
									cE("input", { className: "zGbnIq_input", type: "password", value: keyVal, placeholder: dot === true ? "Key saved. Paste only to override" : "Paste key to discover models\u2026",
										onChange: function (e) { setKey(e.target.value); },
										onKeyDown: function (e) { if (e.key === "Enter") discover(urlVal, keyVal, pathVal, ""); } })
								),
								cE("div", { className: "zGbnIq_field" },
									cE("label", { className: "zGbnIq_fieldLabel" }, "Wire format"),
									cE("select", { className: "zGbnIq_input zGbnIq_selectInput", value: apiSel,
										onChange: function (e) { setApiSel(e.target.value); if (e.target.value) persist({ api: e.target.value }); } },
										cE("option", { value: "" }, "Auto (detect)"),
										cE("option", { value: "openai-completions" }, "OpenAI completions"),
										cE("option", { value: "anthropic-messages" }, "Anthropic messages"),
										cE("option", { value: "openai-responses" }, "OpenAI responses"))
								),
								showPath || pathVal ? cE("div", { className: "zGbnIq_field" },
									cE("label", { className: "zGbnIq_fieldLabel" }, "Completion path (optional)"),
									cE("input", { className: "zGbnIq_input", type: "text", value: pathVal, placeholder: "/v1/anthropic/messages", onChange: function (e) { setPath(e.target.value); } }),
									cE("p", { className: "zGbnIq_advancedHint" }, "Only when the standard /v1/chat/completions, /v1/messages or /v1/responses paths don\u2019t answer.")
								) : null,
								err ? cE("p", { className: "zGbnIq_error" }, err) : null,
								cE("div", { className: "zGbnIq_modelCatalog" },
									cE("div", { style: { display: "flex", marginBottom: 2 } },
										cE("button", { className: "zGbnIq_addButton",
											style: { flex: "1 1 auto", borderStyle: "dashed", color: "var(--dsw-alias-state-error-primary)" },
											disabled: disabled, onClick: removeProvider }, "Remove provider")
									),
									cE("div", { className: "zGbnIq_modelListHead" },
										cE("div", { className: "zGbnIq_modelCatalogHeading", style: { flexDirection: "row", alignItems: "baseline", gap: 6 } },
											cE("span", { className: "zGbnIq_modelCatalogTitle" }, "Models"),
											cE("span", { className: "zGbnIq_modelCatalogMeta", style: { margin: 0 } },
												"\u00b7 " + currentModels.length + " on" + (disc ? " \u00b7 " + disc.length + " discovered" : ""))
										),
										cE("div", { style: { display: "inline-flex", gap: 4, alignItems: "center" } },
											cE("button", { className: "zGbnIq_linkButton", disabled: !disc || disc.length === 0 || disabled,
												onClick: function () { toggleAll(true); } }, "Select all"),
											cE("button", { className: "zGbnIq_linkButton", disabled: !disc || disc.length === 0 || disabled,
												onClick: function () { toggleAll(false); } }, "Deselect all"),
											cE("button", { className: "zGbnIq_linkButton", disabled: disabled || currentModels.length === 0,
												onClick: function () { resetModels(); } }, "Reset models")
										)
									),
									disc && disc.length > 0 ? cE("div", { className: "zGbnIq_candidateToolbar" },
										cE("input", { className: "zGbnIq_input zGbnIq_candidateSearch", type: "text", value: query, placeholder: "Search models\u2026", onChange: function (e) { setQuery(e.target.value); } })
									) : null,
									cE("ul", { className: "zGbnIq_modelList", style: { listStyle: "none", margin: 0, padding: 0 } },
										list.map(function (m) {
											return cE(ModelRow, {
												key: m.id, model: m, on: !!currentIds[m.id], disabled: disabled,
												editable: !!currentIds[m.id],
												onToggle: function (on) { toggleModel(m, on); },
												onPatch: function (model, patch) { patchModel(model, patch); },
												onRemove: function (model) { removeModel(model); }
											});
										}),
										(disc === null ? currentModels.length === 0 : disc.length === 0) && !busy
											? cE("li", { className: "zGbnIq_modelEmpty", style: { listStyle: "none" } },
												loading && disc === null && currentModels.length === 0 ? "Loading models\u2026" : "Discovered models appear here.")
											: null,
										disc && disc.length > 0 && list.length === 0
												? cE("li", { className: "zGbnIq_modelEmpty", style: { listStyle: "none" } }, "No models match \u201c" + query + "\u201d.")
												: null
									),
									cE("button", { className: "zGbnIq_addModelButton", disabled: disabled,
										onClick: addModel }, "+ Add model")
								)
							)
						) : null
					);
				}

				// --- add-a-provider card --------------------------------------------------

				function AddCard(props) {
					var taken = props.taken;
					var scope = props.scope;
					var onAdded = props.onAdded;
					var t = props.t;

					var nameState = useState("");
					var name = nameState[0], setName = nameState[1];
					var urlState = useState("");
					var url = urlState[0], setUrl = urlState[1];
					var passyState = useState(false);
					var passy = passyState[0], setPassy = passyState[1];
					var pathState = useState("");
					var path = pathState[0], setPath = pathState[1];
					var keyState = useState("");
					var key = keyState[0], setKey = keyState[1];
					var discState = useState(null);
					var disc = discState[0], setDisc = discState[1];
					var apiState = useState("");
					var api = apiState[0], setApi = apiState[1];
					var errState = useState(null);
					var err = errState[0], setErr = errState[1];
					var busyState = useState(false);
					var busy = busyState[0], setBusy = busyState[1];
					var addingState = useState(false);
					var adding = addingState[0], setAdding = addingState[1];
					var showPathState = useState(false);
					var showPath = showPathState[0], setShowPath = showPathState[1];

					var route = name.trim().toLowerCase().replace(/\s+/g, "-");
					var routeInvalid = route.length > 0 && !ROUTE_PATTERN.test(route);
					var routeTaken = route.length > 0 && (taken || []).some(function (x) { return String(x).toLowerCase() === route; });
					var baseInvalid = url.length > 0 && !isHttpUrl(url.trim());
					var chosen = {};   // model id -> {..} from disc, only toggled-on ones
					var chosenState = useState(null);
					var chosenMap = chosenState[0], setChosenMap = chosenState[1];
					var base = (url || "").trim();

					function discoverIt() {
						setBusy(true); setErr(null);
						probe(base, path, key).then(function (res) {
							if (res && res.ok) {
								setDisc(res.models);
								setApi(res.api);
								setShowPath(false);
								var map = {};
								res.models.forEach(function (m) { map[m.id] = true; });
								setChosenMap(map);
								return;
							}
							setErr("No models found on this endpoint" + ": " + (res && res.message || "?"));
							setShowPath(true);
						}).catch(function (e) { setErr(String(e && e.message || e)); setShowPath(true); })
						.then(function () { setBusy(false); });
					}
					function toggleModel(model, on) {
						var next = {};
						if (chosenMap) for (var k in chosenMap) next[k] = chosenMap[k];
						if (on) next[model.id] = true; else delete next[model.id];
						setChosenMap(next);
					}
					function toggleAll(on) {
						var next = {};
						if (disc) disc.forEach(function (m) { if (on) next[m.id] = true; });
						setChosenMap(next);
					}
					function addProvider() {
						if (!disc || disc.length === 0 || busy) return;
						setAdding(true);
						var chosenModels = disc.filter(function (m) { return chosenMap && chosenMap[m.id]; })
							.map(function (m) { return { id: m.id, ...(m.name ? { name: m.name } : {}), ...(m.contextWindow ? { contextWindow: m.contextWindow } : {}), ...reasoningFor(m) }; });
						var keyRef = deriveKeyRef(route);
						var profile = {};
						if (name.trim() && name.trim() !== route) profile.displayName = name.trim();
						if (key.trim()) profile.apiKeyEnv = keyRef;
						profile.api = api;
						profile.baseURL = base || normaliseBase(url);
						profile.models = chosenModels;
						if (chosenModels.length === 0) { setErr("Select at least one model."); setAdding(false); return; }
						var addedRoute = route;
						function done() {
							onAdded();
							setAdding(false);
							setName(""); setUrl(""); setPath(""); setKey("");
							setDisc(null); setApi(""); setErr(null); setChosenMap(null); setShowPath(false);
							setTimeout(function () {
								try {
									var el = document.querySelector('[data-provider="' + addedRoute + '"]');
									if (!el) return;
									el.scrollIntoView({ block: "center", behavior: "smooth" });
									el.style.outline = "2px solid var(--dsw-alias-state-success-primary)";
									setTimeout(function () { el.style.outline = ""; }, 2000);
								} catch (e) {}
							}, 700);
						}
						writeSettings([{ op: "set", path: ["providers", route], value: profile }]).then(function (r) {
							if (r && r.ok) {
								if (key.trim()) {
									return ctx.remote.credentials.set(keyRef, key.trim()).then(done).catch(done);
								}
								done();
								return;
							}
							setErr((r && r.error && r.error.message) || "add failed");
							setAdding(false);
						}).catch(function (e) { setErr(String(e && e.message || e)); setAdding(false); });
					}

					var selectedCount = disc ? disc.filter(function (m) { return chosenMap && chosenMap[m.id]; }).length : 0;
					var ready = route.length > 0 && !routeInvalid && !routeTaken && base.length > 0 && !baseInvalid && disc && disc.length > 0 && selectedCount > 0;
					var addDisabled = busy || adding;
					return cE("li", { className: "zGbnIq_setupCard", style: { listStyle: "none" } },
						cE("div", { className: "zGbnIq_editorHeader" },
							cE("span", { className: "zGbnIq_editorTitle" }, "Add a provider"),
							cE("span", { className: "zGbnIq_editorRoute" }, "Name it and give it a base URL. The format is detected automatically.")
						),
						cE("div", { className: "zGbnIq_field" },
							cE("label", { className: "zGbnIq_fieldLabel" }, "Provider name"),
							cE("input", { className: "zGbnIq_input", type: "text", value: name, placeholder: "e.g. my-gateway", onChange: function (e) { setName(e.target.value); setErr(null); } }),
							route.length > 0 && (routeInvalid || routeTaken) ? cE("p", { className: "zGbnIq_error" },
								routeInvalid ? "Provider \u201c" + route + "\u201d is not a valid name. Use lowercase letters, digits and dashes." : "Provider \u201c" + route + "\u201d already exists. Please change the name.") : null
						),
							// Passy is offered, never enforced: ticking it fills the gateway in, and either field
							// can be overridden afterwards.
							cE("div", { className: "zGbnIq_field" },
								cE("label", { className: "gnts-ad-passy" },
									cE("input", { type: "checkbox", className: "gnts-ad-passy-input", checked: passy,
										onChange: function (e) {
											var on = e.target.checked;
											setPassy(on);
											setErr(null);
											if (on) {
												if (url.trim().length === 0) setUrl("https://api.passy.ai/v1");
												if (name.trim().length === 0) setName("passy");
											} else {
												// undo only what this checkbox filled in
												if (url.trim() === "https://api.passy.ai/v1") setUrl("");
												if (name.trim() === "passy") setName("");
											}
										} }),
									cE("span", { className: "gnts-ad-passy-box" }, passy ? cE("span", { className: "gnts-ad-passy-tick" }, "\u2713") : null),
									cE("span", { className: "gnts-ad-passy-text" }, "Use Passy")
								),
								passy ? cE("ul", { className: "gnts-ad-passy-links" },
								cE("li", null, passyIcon("key"), "Get your keys at ", cE("span", { className: "gnts-ad-arrow" }, "\u2192"), " ",
									cE("a", { className: "gnts-ad-link", href: "https://dash.passy.ai", target: "_blank", rel: "noreferrer noopener" }, "Dashboard")),
								cE("li", null, passyIcon("doc"), "Read more at ", cE("span", { className: "gnts-ad-arrow" }, "\u2192"), " ",
									cE("a", { className: "gnts-ad-link", href: "https://passy.ai/docs", target: "_blank", rel: "noreferrer noopener" }, "Docs")),
								cE("li", null, passyIcon("grid"), "See all available ", cE("span", { className: "gnts-ad-arrow" }, "\u2192"), " ",
									cE("a", { className: "gnts-ad-link", href: "https://passy.ai/models", target: "_blank", rel: "noreferrer noopener" }, "Models"))
							) : null
							),
						cE("div", { className: "zGbnIq_field" },
							cE("label", { className: "zGbnIq_fieldLabel" }, "Base URL"),
							cE("input", { className: "zGbnIq_input", type: "text", value: url, placeholder: "https://api.example.com/v1", onChange: function (e) { setUrl(e.target.value); setErr(null); } }),
							baseInvalid ? cE("p", { className: "zGbnIq_error" }, "Enter a valid http(s) URL.") : null
						),
						cE("div", { className: "zGbnIq_field" },
							cE("label", { className: "zGbnIq_fieldLabel" }, "API key (optional)"),
							cE("input", { className: "zGbnIq_input", type: "password", value: key, placeholder: "Paste key to discover models\u2026", onChange: function (e) { setKey(e.target.value); } })
						),
						cE("div", { className: "zGbnIq_field" },
							cE("label", { className: "zGbnIq_fieldLabel" }, "Wire format"),
							cE("select", { className: "zGbnIq_input zGbnIq_selectInput", value: api,
								onChange: function (e) { setApi(e.target.value); } },
								cE("option", { value: "" }, "Auto (detect)"),
								cE("option", { value: "openai-completions" }, "OpenAI completions"),
								cE("option", { value: "anthropic-messages" }, "Anthropic messages"),
								cE("option", { value: "openai-responses" }, "OpenAI responses"))
						),
						showPath || path ? cE("div", { className: "zGbnIq_field" },
							cE("label", { className: "zGbnIq_fieldLabel" }, "Completion path (optional)"),
							cE("input", { className: "zGbnIq_input", type: "text", value: path, placeholder: "/v1/anthropic/messages", onChange: function (e) { setPath(e.target.value); } }),
							cE("p", { className: "zGbnIq_advancedHint" }, "Only when the standard /v1/chat/completions, /v1/messages or /v1/responses paths don\u2019t answer.")
						) : null,
						cE("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
							cE("button", { className: "zGbnIq_secondaryButton", disabled: busy || base.length === 0, onClick: discoverIt }, busy ? "Discovering\u2026" : "\u21bb " + "Discover"),
							cE("button", { className: "zGbnIq_primaryButton", disabled: !ready || addDisabled, onClick: addProvider }, adding ? "Adding\u2026" : "+ " + "Add provider")
						),
						err ? cE("p", { className: "zGbnIq_error" }, err) : null,
						disc && disc.length > 0 ? cE("div", { className: "zGbnIq_modelCatalog" },
							cE("div", { className: "zGbnIq_modelListHead" },
								cE("div", { className: "zGbnIq_modelCatalogHeading", style: { flexDirection: "row", alignItems: "baseline", gap: 6 } },
									cE("span", { className: "zGbnIq_modelCatalogTitle" }, "Models"),
									cE("span", { className: "zGbnIq_modelCatalogMeta", style: { margin: 0 } }, "\u00b7 " + disc.length + " models" + (api ? " \u00b7 " + api : ""))
								),
								cE("div", { style: { display: "inline-flex", gap: 4, alignItems: "center" } },
									cE("button", { className: "zGbnIq_linkButton", disabled: busy, onClick: function () { toggleAll(true); } }, "Select all"),
									cE("button", { className: "zGbnIq_linkButton", disabled: busy, onClick: function () { toggleAll(false); } }, "Deselect all")
								)
							),
							cE("ul", { className: "zGbnIq_modelList", style: { listStyle: "none", margin: 0, padding: 0, maxHeight: 320, overflowY: "auto" } },
								disc.map(function (m) {
									return cE(ModelRow, {
										key: m.id, model: m, on: !!(chosenMap && chosenMap[m.id]), disabled: busy,
										editable: false, onPatch: null, onRemove: null,
										onToggle: function (on) { toggleModel(m, on); }
									});
								})
							)
						) : null
					);
				}

				// --- section --------------------------------------------------------------

				function AutodiscoverSection(props) {
					var t = props.t || function (k) { return k; };
					// Straight from the shared settings mirror: warmed once when the app's
					// plugins boot, refreshed on every document change - so opening this tab
					// is instant and always reflects the latest saved state locally.
					// gnts: the 0.1.5 settings mirror is gone (0.2.0 answers a namespaces list,
					// not an object with .namespace(id)). The provider data below comes from
					// remote.llm.listConfigurableProviders, so the mirror read is dropped rather
					// than faked; this section shows live state instead of a cached document.
					// gnts: read the SAVED value from the form snapshot. Its field is `value` —
					// reading the snapshot object itself left this undefined, so a saved provider
					// never appeared here even though the write had landed.
					var value; var loading = true;
					try {
						var snap = ctx.configForms.get(NS).getSnapshot();
						value = snap ? snap.value : undefined;
						loading = !snap || snap.status === "loading";
					} catch (e) { value = undefined; loading = false; }

					var provState = useState(providerCache.list || []);
					var providers = provState[0], setProviders = provState[1];
					var nonceState = useState(0);
					var nonce = nonceState[0], setNonce = nonceState[1];

					function loadProviders() {
						var val;
						try { var snap2 = ctx.configForms.get(NS).getSnapshot(); val = snap2 ? snap2.value : undefined; } catch (e) { val = undefined; }
						ctx.remote.llm.listConfigurableProviders().then(function (r) {
							var list = r && r.ok ? (r.value || []) : [];
							// configured only: a stored profile entry exists under settingsPath
							list = list.filter(function (p) {
								// the deployment's zero-model placeholder is not a user provider
								if (p.provider === "box") return false;
								if (p.settingsNs === "llm-deepseek" || p.provider === "deepseek-official" || p.provider === "deepseek") return false;
								return pick(val, p.settingsPath) !== undefined;
							});
							// de-dup by settingsPath
							var seen = {};
							list = list.filter(function (p) {
								var k = (p.settingsPath || []).join("/") + "/" + p.settingsNs;
								if (seen[k]) return false;
								seen[k] = true;
								return true;
							});
							list.sort(function (a, b) {
								return ((a.displayName || a.provider) || "").localeCompare((b.displayName || b.provider) || "");
							});
							setProviders(list);
							providerCache.list = list;
						}).catch(function () { /* keep whatever we have */ });
					}
					// Re-join providers whenever the mirror moves (boot read, our writes,
					// host pushes). Functional update so bursts of changes don't collapse.
					useEffect(function () {
						var off = null;
						try { off = ctx.configForms.get(NS).subscribe(function () { setNonce(function (n) { return n + 1; }); }); } catch (e) {}
						loadProviders();
						return function () { if (off) { try { off(); } catch (e) {} } };
					}, []);
					useEffect(function () { loadProviders(); }, [nonce]);

					var taken = providers.map(function (p) { return p.provider; });
					// after writes, force the mirror to refetch so the tab shows the commit
					var refresh = function () { try { mirror.load(); } catch (e) {} };

					return cE("div", { className: "zGbnIq_section" },
						cE("h3", { className: "zGbnIq_title" }, "Autodiscover"),
						cE("p", { className: "zGbnIq_intro" }, "Add your own keys and automatically keep the models up to date."),
						providers.length === 0 && providerCache.list !== null && !loading
							? cE("p", { className: "zGbnIq_notice", style: { color: "#b7c7f1" } }, "Add your first provider to send messages.")
							: null,
						cE("ul", { className: "zGbnIq_rows", style: { listStyle: "none" } },
							providers.map(function (p) {
								return cE(ProviderCard, {
									key: p.provider,
									prov: p,
									entry: pick(value, p.settingsPath),
									loading: loading,
									t: t,
									onChanged: refresh
								});
							}),
							cE(AddCard, {
								key: "__add__",
								taken: taken,
								t: t,
								onAdded: refresh
							})
						)
					);
				}

				ctx.slots.inject("settings.section", function () {
					return ctx.slots.register({
						name: "settings.section",
						id: "autodiscover",
						order: 11,
						label: function () { return "Autodiscover"; },
						inject: function () { return {}; },
						children: {}
					}, AutodiscoverSection);
				});
			} catch (e) {
				console.warn("[autodiscover] apply error:", e);
			}
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});