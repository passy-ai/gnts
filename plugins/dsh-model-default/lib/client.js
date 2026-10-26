window.__ModuleLoader__.load({
	id: "dsh-model-default",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		// The composer's model seat, kept honest — and nothing else.
		//
		// The seat is the harness's own button, in its own slot with its own design;
		// this plugin only writes its LABEL, re-derived from the live catalog on
		// every check so it can never go stale:
		//
		//   no providers configured →  "Add Model"    (and clicking opens Autodiscover)
		//   providers but none chosen →  "Select Model" (clicking opens the model menu)
		//   a model chosen           →  left alone (the harness renders "Model · Effort")
		//   models, none selected →  "Select Model"
		//   a model selected      →  that model's name
		//
		// It does not add elements, hide anything, rewrite the composer, or choose a
		// model: the pick is the user's, and once made it is written to
		// `agent-default-model` so the next session starts on it.
		var inject = ["remote", "remote.session", "remote.settings", "configForms"];

		var NS = "agent-default-model";
		var SEAT_ATTR = "data-dsh-model-seat";
		// Set on the seat's label span while its text is the vendor's own fallback.
		var HOLD_ATTR = "data-gnts-seat-hold";

		// Safety net for the mobile composer: if a future build stops rendering the
		// label span (below), the button itself must still clip instead of wrapping
		// a long model name out of the card. Inert while the span exists, and
		// desktop-scoped off so the desktop layout is untouched.
		var CSS = ".gnts-seat-notice{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:1300;display:inline-flex;align-items:center;gap:10px;padding:10px 14px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-elevation-prominent);font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary)}" + ".gnts-seat-notice button{border:none;background:0 0;padding:0;cursor:pointer;color:#4e75df;text-decoration:underline;text-underline-offset:2px;font:inherit}" + "@media (max-width:768px){[" + SEAT_ATTR + "]{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}" + "[" + HOLD_ATTR + "]{visibility:hidden!important}";

		function apply(ctx) {
			try {
				var style = document.createElement("style");
				style.setAttribute("data-plugin-css", "dsh-model-default/seat.css");
				style.textContent = CSS;
				document.head.appendChild(style);
			} catch (e) {
				console.warn("[model-default] css error:", e);
			}
			try {
				// settingsScope was a service in an earlier build; this harness exposes
				// configForms, which answers the same questions: the namespace's value, and
				// its revision for a fenced write.
				var mirror = {
					namespace: function (ns) {
						try {
							var form = ctx.configForms && ctx.configForms.get(ns);
							return form ? form.getSnapshot() : null;
						} catch (e) { return null; }
					},
					subscribe: function () { return function () {}; },
					load: function () {},
				};

				/** The composer's model seat, whichever label we last painted on it. */
				function seat() {
					var buttons = document.querySelectorAll("button");
					for (var i = 0; i < buttons.length; i++) {
						var button = buttons[i];
						if (button.getAttribute(SEAT_ATTR) === "1") return button;
						var aria = button.getAttribute("aria-label") || "";
						var text = (button.innerText || "").trim();
						if (aria.indexOf("Select model") === 0 || aria === "Add Model" || text === "Select Model" || text === "Add Model") {
							button.setAttribute(SEAT_ATTR, "1");
							return button;
						}
					}
					return null;
				}

				/** The stored default selection, or null. */
				function storedDefault() {
					var ns = mirror.namespace(NS);
					var value = ns && ns.value;
					if (!value || typeof value.provider !== "string" || typeof value.model !== "string") return null;
					return { provider: value.provider, model: value.model };
				}

				/** Providers that can actually serve a request, with at least one model. */
				function routableGroups(catalog) {
					var routable = (catalog && catalog.routableProviders) || [];
					var groups = (catalog && catalog.groups) || [];
					return groups.filter(function (group) {
						if (routable.length > 0 && routable.indexOf(group.id) === -1) return false;
						return (group.models || []).length > 0;
					});
				}

				function findModel(groups, selection) {
					if (selection === null) return null;
					for (var i = 0; i < groups.length; i++) {
						if (groups[i].id !== selection.provider) continue;
						var models = groups[i].models || [];
						for (var j = 0; j < models.length; j++) {
							if (models[j].id === selection.model) return models[j];
						}
					}
					return null;
				}

				/** True when the stored default names a model the catalog can actually serve. */
				function storedIsReal(groups) {
					return findModel(groups, storedDefault()) !== null;
				}

				/**
				 * The catalog-free form of storedIsReal, for use before the async catalog resolves:
				 * is the stored default one of the provider's own configured models?
				 */
				function storedIsRealSync() {
					var stored = storedDefault();
					if (stored === null) return false;
					try {
						var snap = mirror.namespace("llm-pi-ai");
						var providers = snap && snap.value && snap.value.providers;
						var p = providers && providers[stored.provider];
						if (!p || !p.models) return false;
						for (var i = 0; i < p.models.length; i++) {
							if (p.models[i].id === stored.model) return true;
						}
					} catch (e) {}
					return false;
				}

				/** Which of the three labels the seat should carry right now. */
				function desiredLabel(groups, catalog) {
					if (groups.length === 0) return { text: "Add Model", adding: true, aria: "Add Model" };
					// A non-null default does NOT mean the user chose one: the config schema always
					// carries deepseek-official/deepseek-flash, so storedDefault() was never null on
					// any boot. That made this branch unreachable and the seat showed the harness's
					// raw "provider/model" instead of "Select Model". Only a default naming a model
					// the catalog can serve counts as a choice.
					if (storedIsReal(groups)) return null;
					return { text: "Select Model", adding: false, aria: "Select model" };
				}

				/**
				 * Whether at least one provider with models is configured, read straight from the
				 * llm-pi-ai namespace. The async catalog cannot answer this in time to stop a
				 * wrong label appearing on the first frames, and the two labels differ.
				 */
				function hasConfiguredProvider() {
					try {
						var snap = mirror.namespace("llm-pi-ai");
						var providers = snap && snap.value && snap.value.providers;
						if (!providers || typeof providers !== "object") return false;
						for (var name in providers) {
							if (!Object.prototype.hasOwnProperty.call(providers, name)) continue;
							var p = providers[name];
							if (p && p.models && p.models.length > 0) return true;
						}
					} catch (e) {}
					return false;
				}

				/**
				 * Where the label text belongs inside the trigger.
				 *
				 * The harness renders `<button><span class="…triggerLabel">Model</span>…</button>`
				 * and puts the clipping on that span (`white-space:nowrap; overflow:hidden;
				 * text-overflow:ellipsis`). Writing the label onto the button instead removed
				 * the span, so a long model name fell back to `white-space:normal` and wrapped
				 * out of the composer card on a phone. Always write into the span when it is
				 * there; the button stays the fallback.
				 */
				function seatLabel(button) {
					var label = button.querySelector('[class*="triggerLabel"]');
					return label === null ? button : label;
				}

				/** Model names the trigger may honestly carry: the catalog's, and the config's behind it. */
				var catalogNames = null;
				var holdText = null;
				var holdAt = 0;
				var HOLD_FOR = 4000;
				var watched = null;

				function vouched(text) {
					if (text === "" || text === "Select Model" || text === "Add Model") return true;
					if (catalogNames !== null && catalogNames.indexOf(text) !== -1) return true;
					try {
						var snap = mirror.namespace("llm-pi-ai");
						var providers = (snap && snap.value && snap.value.providers) || {};
						for (var name in providers) {
							if (!Object.prototype.hasOwnProperty.call(providers, name)) continue;
							var models = (providers[name] && providers[name].models) || [];
							for (var i = 0; i < models.length; i++) {
								if (models[i] && models[i].name === text) return true;
							}
						}
					} catch (e) {}
					return false;
				}

				/**
				 * Keep the vendor's own words out of sight until they are words we can vouch for: a
				 * model name from the catalog (or the config behind it), or our own placeholder.
				 *
				 * The trigger paints a raw `provider/model` whenever its catalog is between states,
				 * and "Loading models…" before that. React paints those, not us — no write of ours
				 * can pre-empt them, but a hidden label can, and `visibility` keeps the box (and so
				 * the trigger's width) intact. Each new text is held for at most HOLD_FOR, so a
				 * label that never turns honest is shown late rather than lost.
				 */
				function hold() {
					var button = seat();
					if (button === null) return;
					var label = seatLabel(button);
					// With no label span the text is the button's own: hiding that would take the
					// icon and chevron with it, so leave such a build alone.
					if (label === button) return;
					var text = (label.textContent || "").trim();
					if (text !== holdText) { holdText = text; holdAt = Date.now(); }
					if (!vouched(text) && Date.now() - holdAt < HOLD_FOR) label.setAttribute(HOLD_ATTR, "1");
					else if (label.hasAttribute(HOLD_ATTR)) label.removeAttribute(HOLD_ATTR);
				}

				/** Every model name the catalog last answered with. */
				function catalogModelNames(catalog) {
					var names = [];
					var groups = (catalog && catalog.groups) || [];
					for (var i = 0; i < groups.length; i++) {
						var models = groups[i].models || [];
						for (var j = 0; j < models.length; j++) {
							if (models[j] && typeof models[j].name === "string") names.push(models[j].name);
						}
					}
					return names;
				}

				/** Whether a node could be, or contain, the seat — cheap enough to run per insertion. */
				function looksLikeSeat(node) {
					if (node.nodeType !== 1 || !node.matches) return false;
					if (node.matches("button")) return node.querySelector('[class*="triggerLabel"]') !== null;
					return node.querySelector('button [class*="triggerLabel"]') !== null;
				}

				/** Hold the label, and keep watching it: the vendor rewrites its text on every reload. */
				function watchSeat() {
					var button = seat();
					if (button === null) return;
					hold();
					if (button === watched) return;
					watched = button;
					try {
						new MutationObserver(function () { hold(); }).observe(button, { childList: true, characterData: true, subtree: true });
					} catch (e) {}
				}

				/** The text the seat currently shows (label-span text, or the button's own). */

				function seatText(button) {
					var node = seatLabel(button);
					return (node === button ? button.innerText || "" : node.textContent || "").trim();
				}

				/** Write the label, but only when it differs (idempotent, React-safe). */
				var adding = false;
				// True while the seat shows a placeholder, i.e. no model is chosen yet. Both
				// placeholder states need it: sending with no model fails either way.
				var needsModel = false;
				function paint(label) {
					if (label === null) { adding = false; needsModel = false; return; }
					adding = label.adding;
					needsModel = true;
					var button = seat();
					if (button === null) return;
					if (seatText(button) !== label.text) write(seatLabel(button), label.text);
					button.setAttribute("aria-label", label.aria || (label.adding ? "Add Model" : "Select model, current " + label.text));
					if (button.getAttribute("title") !== label.text) button.setAttribute("title", label.text);
					hold();
				}

				/**
				 * Set text, keeping React's text node when there is exactly one: replacing the
				 * node detaches React's reference and makes it write into a node nobody sees,
				 * which stays harmless (we repaint) but is avoidable noise.
				 */
				function write(node, text) {
					var child = node.firstChild;
					if (child !== null && child.nodeType === 3 && child.nextSibling === null) child.nodeValue = text;
					else node.textContent = text;
				}

				/** Persist the user's own pick as the default for future sessions. */
				function rememberPicked(groups) {
					var button = seat();
					if (button === null || adding) return;
					var label = seatText(button);
					if (label === "" || label === "Select Model") return;
					var picked = null;
					for (var i = 0; i < groups.length && picked === null; i++) {
						var models = groups[i].models || [];
						for (var j = 0; j < models.length; j++) {
							if (models[j].name === label) { picked = { provider: groups[i].id, model: models[j].id }; break; }
						}
					}
					if (picked === null) return;
					var stored = storedDefault();
					if (stored !== null && stored.provider === picked.provider && stored.model === picked.model) return;
					var ns = mirror.namespace(NS);
					ctx.remote.settings.mutate(NS, [
						{ op: "set", path: ["provider"], value: picked.provider },
						{ op: "set", path: ["model"], value: picked.model },
					], ns ? ns.revision : undefined).then(function () {
						try { mirror.load(); } catch (e) {}
					}).catch(function () { /* a rejected write must not break the page */ });
				}

				/** Re-derive everything from the live catalog. */
				function check() {
					return ctx.remote.session.modelCatalog().then(function (response) {
						if (!response || !response.ok) return;
						var catalog = response.value || {};
						var groups = routableGroups(catalog);
						catalogNames = catalogModelNames(catalog);
						paint(desiredLabel(groups, catalog));
						if (groups.length > 0) rememberPicked(groups);
						watchSeat();
					}).catch(function () { /* offline / not paired yet */ });
				}

				// With nothing to choose from, the empty model menu is a dead end: send
				// the click to Autodiscover instead (only in that state).
				document.addEventListener("click", function (event) {
					if (!adding) return;
					var node = event.target;
					while (node && node !== document) {
						if (node.nodeType === 1 && node.getAttribute && node.getAttribute(SEAT_ATTR) === "1") {
							event.preventDefault();
							event.stopPropagation();
							openSettings("Autodiscover");
							return;
						}
						node = node.parentNode;
					}
				}, true);

				/**
				 * With no model added there is nothing to send to. Blocking the control is
				 * the honest thing: the alternative is a turn that fails with a provider
				 * error nobody can act on.
				 */
				var notice = null;
				function showNotice() {
					if (notice !== null) return;
					notice = document.createElement("div");
					notice.className = "gnts-seat-notice";
					var text = document.createElement("span");
					// An arrow rather than a full stop: it points at the link that follows.
					text.textContent = adding ? "No model added yet \u2192" : "No model selected yet \u2192";
					var link = document.createElement("button");
					link.type = "button";
					link.textContent = "Go to settings";
					link.addEventListener("click", function (e) {
						e.preventDefault();
						e.stopPropagation();
						hideNotice();
						openSettings("Autodiscover");
					});
					notice.appendChild(text);
					notice.appendChild(link);
					document.body.appendChild(notice);
					setTimeout(hideNotice, 6000);
				}
				function hideNotice() {
					if (notice === null) return;
					try { notice.remove(); } catch (e) {}
					notice = null;
				}
				function sendControl(node) {
					while (node && node !== document) {
						if (node.nodeType === 1 && node.getAttribute) {
							var aria = node.getAttribute("aria-label") || "";
							var cls = String(node.className || "");
							if (/send/i.test(aria) || /send/i.test(cls)) return node;
						}
						node = node.parentNode;
					}
					return null;
				}
				// the button
				document.addEventListener("click", function (event) {
					if (!needsModel) return;
					if (sendControl(event.target) === null) return;
					event.preventDefault();
					event.stopPropagation();
					showNotice();
				}, true);
				// and Enter in the composer, which would otherwise send too
				document.addEventListener("keydown", function (event) {
					if (!needsModel) return;
					if (event.key !== "Enter" || event.shiftKey) return;
					var el = event.target;
					if (el && (el.isContentEditable || el.tagName === "TEXTAREA")) {
						event.preventDefault();
						event.stopPropagation();
						showNotice();
					}
				}, true);

				/** Open the settings panel on one section. */
				function openSettings(name) {
					var attempt = 0;
					var step = function () {
						attempt++;
						var panel = document.querySelector(".VOzbGW_panel");
						if (panel !== null) {
							var cells = panel.querySelectorAll(".VOzbGW_navCell");
							for (var i = 0; i < cells.length; i++) {
								if ((cells[i].innerText || "").indexOf(name) !== -1) { cells[i].click(); return; }
							}
						}
						if (attempt === 1) {
							var burger = document.querySelector("[data-dshmob-hamburger]");
							if (burger !== null) burger.click();
							var buttons = document.querySelectorAll("button");
							for (var j = 0; j < buttons.length; j++) {
								if ((buttons[j].innerText || "").trim() === "Settings") { buttons[j].click(); break; }
							}
						}
						if (attempt < 16) setTimeout(step, 250);
					};
					step();
				}

				// Paint before the catalog resolves. The seat starts out carrying whatever the
				// harness last knew — its bundled DeepSeek route on a fresh install — and the
				// async catalog check is far too late to stop that appearing. If nothing is
				// stored there is nothing to show, so say "Add Model" at once.
				function earlyPaint() {
					try {
						watchSeat();
						// A real selection means the harness's own label is correct, so painting over
						// it here would leave our text in place (paint(null) stops painting, it does
						// not undo a paint) and the effort suffix would never come back.
						if (storedIsRealSync()) return;
						paint(hasConfiguredProvider()
							? { text: "Select Model", adding: false, aria: "Select model" }
							: { text: "Add Model", adding: true, aria: "Add Model" });
					} catch (e) {}
				}
				earlyPaint();
				var early = 0;
				var earlyTimer = setInterval(function () {
					earlyPaint();
					if (++early > 40) clearInterval(earlyTimer);
				}, 50);
				// The seat is re-created with the composer — a session switch re-mounts it — and the
				// vendor rewrites its label whenever its catalog reloads, so watch for both.
				try {
					new MutationObserver(function (records) {
						for (var i = 0; i < records.length; i++) {
							var added = records[i].addedNodes;
							for (var j = 0; j < added.length; j++) {
								if (looksLikeSeat(added[j])) { watchSeat(); return; }
							}
						}
					}).observe(document.documentElement, { childList: true, subtree: true });
				} catch (e) {}

				check();
				try { mirror.subscribe(function () { check(); }); } catch (e) {}
				ctx.remote.$on && ctx.remote.$on("llm/adapters-updated", function () { check(); });
				document.addEventListener("click", function () { setTimeout(check, 600); }, true);
				var tries = 0;
				var boot = setInterval(function () { check(); if (++tries > 12) clearInterval(boot); }, 2500);
				setInterval(check, 15000);
			} catch (e) {
				console.warn("[model-default] apply error:", e);
			}
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
