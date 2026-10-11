window.__ModuleLoader__.load({
	// gnts: register under OUR package name.
	id: "gnts-model-search",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		// The model menu (composer model selector) gets a search field at its top,
		// auto-focused on open, filtering the model options as you type.
		var inject = [];
		var MENU = "._7KE1Ra_menu";
		var CELL = "._7KE1Ra_cell";
		var GROUPS = "._7KE1Ra_groups";
		var OPTION = "._7KE1Ra_option";
		var GROUP = "._7KE1Ra_group";

		function apply(ctx) {
			try {
				// While we swap the two-level menu for its list, keep the intermediate
				// "Model  <current>  ›" row invisible: hiding it (rather than clicking a
				// frame later) is what removes the flash. Visibility keeps its layout, so
				// the list lands in the same place.
				var css = "._7KE1Ra_menu[data-dsh-drilling=\"1\"]{visibility:hidden!important}" +
					// Optimistic: the seat was clicked and its model has no reasoning-effort
					// row, so the menu that is about to mount is the drill-down row — hide it
					// before it can paint (a menu with options/groups, i.e. the real list, is
					// never matched). `:has()` is WebKit 15.4+/Chromium 105+; without it the
					// synchronous drill below still applies, one frame later.
					"html.dsh-drilling ._7KE1Ra_menu:has(._7KE1Ra_cell):not(:has(._7KE1Ra_option)):not(:has(._7KE1Ra_groups)){visibility:hidden!important}";
				var tagId = "dsh-model-search/peak.css";
				if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
					var tag = document.createElement("style");
					tag.setAttribute("data-plugin-css", tagId);
					tag.textContent = css;
					document.head.appendChild(tag);
				}
				function filter(menu, raw) {
					var q = String(raw || "").trim().toLowerCase();
					var opts = menu.querySelectorAll(OPTION);
					for (var i = 0; i < opts.length; i++) {
						var t = (opts[i].innerText || "").toLowerCase();
						opts[i].style.display = (!q || t.indexOf(q) !== -1) ? "" : "none";
					}
					var groups = menu.querySelectorAll(GROUP);
					for (var g = 0; g < groups.length; g++) {
						var any = Array.prototype.some.call(groups[g].querySelectorAll(OPTION), function (o) {
							return o.style.display !== "none";
						});
						groups[g].style.display = any ? "" : "none";
					}
				}
				// gnts: decorate the selector's OWN search field rather than adding a second one.
				// The harness already renders a search row for catalogs above four entries, so
				// the only thing missing was the magnifier.
				function inject(menu) {
					if (!menu.querySelector(OPTION + ", " + GROUPS)) return;
					if (menu.querySelector("[data-gnts-model-search-icon]")) return;
					var inp = menu.querySelector('input[type="text"]') || menu.querySelector("input");
					if (!inp) return;
					var host = inp.parentElement;
					if (!host) return;
					if (getComputedStyle(host).position === "static") host.style.position = "relative";
					var icon = document.createElement("span");
					icon.setAttribute("data-gnts-model-search-icon", "1");
					icon.setAttribute("aria-hidden", "true");
					icon.style.cssText = "position:absolute;left:10px;top:50%;transform:translateY(-50%);display:inline-flex;pointer-events:none;color:var(--dsw-alias-label-tertiary);";
					icon.innerHTML = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.25 12.5a5.25 5.25 0 1 0 0-10.5 5.25 5.25 0 0 0 0 10.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M11.2 11.2 14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
					host.appendChild(icon);
					// leave room for the glyph, once
					if (parseFloat(getComputedStyle(inp).paddingLeft) < 30) inp.style.paddingLeft = "32px";
				}
				// The field follows the app's own session search: transparent fill, hairline
				// border, 10px radius, muted glyph and tertiary placeholder — in light AND
				// dark (the tokens flip with the theme).
				var css = "[data-gnts-model-search-icon] svg{color:var(--dsw-alias-label-tertiary);}";
				var tagId = "dsh-model-search/search.css";
				if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
					var tag = document.createElement("style");
					tag.setAttribute("data-plugin-css", tagId);
					tag.textContent = css;
					document.head.appendChild(tag);
				}

				/**
				 * The seat opens a two-level menu: one "Model  <current>  ›" row, and the
				 * real list one click deeper. Skip that first open — when the root menu
				 * offers nothing but the Model row, go straight to the list (and its
				 * search field). A menu that also carries an Effort row is left alone:
				 * that is a genuine second choice.
				 */
				function drill(menu) {
					if (menu.querySelector(OPTION + ", " + GROUPS)) {
						// React reuses this menu node for the list: it is no longer a
						// drill-down, so drop the markers (otherwise the hide rule would
						// outlive the swap and stick to the list).
						if (menu.hasAttribute("data-dsh-drilling")) menu.removeAttribute("data-dsh-drilling");
						if (menu.hasAttribute("data-dsh-drilled")) menu.removeAttribute("data-dsh-drilled");
						document.documentElement.classList.remove("dsh-drilling");
						return;
					}
					if (menu.getAttribute("data-dsh-drilled") === "1") return;
					var cells = menu.querySelectorAll(CELL);
					if (cells.length === 0) return;
					var model = null, effort = null;
					for (var i = 0; i < cells.length; i++) {
						// textContent, NOT innerText: the menu is hidden (visibility) while we
						// decide, and innerText returns "" for a hidden element — which used to
						// make this function bail, un-hide the row, and only drill on the next
						// pass. That one-frame bail is exactly the flash that kept coming back.
						var text = (cells[i].textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
						if (text.indexOf("model") === 0) model = cells[i];
						else if (text.indexOf("effort") === 0) effort = cells[i];
					}
					if (!model || effort) {
						// A real two-choice menu: show it again (the optimistic hide was
						// only for the lone-row case).
						document.documentElement.classList.remove("dsh-drilling");
						return;
					}
					menu.setAttribute("data-dsh-drilled", "1");
					menu.setAttribute("data-dsh-drilling", "1");
					model.click();
					// If the click did not take (a different menu shape), never leave the
					// menu invisible: it has been `data-dsh-drilled`, so this runs once.
					setTimeout(function () {
						if (menu.isConnected && !menu.querySelector(OPTION + ", " + GROUPS)) {
							menu.removeAttribute("data-dsh-drilling");
						}
					}, 700);
				}
				function scan() {
					var menus = document.querySelectorAll(MENU);
					for (var i = 0; i < menus.length; i++) { drill(menus[i]); inject(menus[i]); }
				}
				if (typeof document !== "undefined") {
					var drillTimer = null;
				document.addEventListener("click", function (event) {
					// A click on the model seat: if the current model has no reasoning-effort
					// levels the menu is going to be the lone "Model <current>" row, so hide
					// it before React commits it.
					var node = event.target;
					while (node && node !== document) {
						if (node.nodeType === 1 && node.getAttribute && /^Select model/.test(node.getAttribute("aria-label") || "")) {
							if ((node.getAttribute("aria-label") || "").indexOf("reasoning effort") === -1) {
								document.documentElement.classList.add("dsh-drilling");
								clearTimeout(drillTimer);
								drillTimer = setTimeout(function () { document.documentElement.classList.remove("dsh-drilling"); }, 900);
							}
							break;
						}
						node = node.parentNode;
					}
					setTimeout(scan, 10); setTimeout(scan, 30); setTimeout(scan, 120); setTimeout(scan, 260);
				}, true);
					// The menu mounts on a React commit; observing the tree lets us drill
					// inside the same frame the menu appears in, instead of after a poll.
					var scheduled = false;
					function scheduleScan() {
						// Synchronous on purpose: MutationObserver callbacks run before the next
						// paint, so drilling here swaps the menu inside the same frame it
						// appeared in. Deferring to rAF costs one visible frame of the
						// drill-down row.
						if (scheduled) return;
						scheduled = true;
						try { scan(); } finally { scheduled = false; }
					}
					try {
						new MutationObserver(scheduleScan).observe(document.documentElement, { childList: true, subtree: true });
					} catch (e) {
						setInterval(scan, 300);
					}
					setInterval(scan, 1000);
				}
			} catch (e) {
				console.warn("[dsh-model-search] apply error:", e);
			}
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
