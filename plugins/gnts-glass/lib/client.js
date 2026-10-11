// gnts.dev — glass chat.
//
// One switch in General. When it is on, the conversation column stops painting and shows
// the window's material through it — the sidebar keeps its own surface, so this changes
// the chat and nothing else.
//
// Dark appearance only, and that is enforced rather than suggested: the material behind
// the window is dark in dark mode, which is what makes the chat read as smoked glass. In
// light mode the same transparency shows a pale material and looks washed out, so the
// switch is disabled there and glass turns itself off if the theme changes under it.
//
// There is nothing to configure. The look is fixed.
window.__ModuleLoader__.load({
	id: "gnts-glass",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		var inject = ["slots", "locale"];

		var KEY = "gnts_glass";

		// On by default: a fresh install opens in glass, which is the look this app is.
		// Storing "0" is how you turn it off, so a deliberate choice always wins.
		function read() {
			try {
				var v = localStorage.getItem(KEY);
				return v === null ? true : v === "1";
			} catch (e) { return true; }
		}
		function isDesktop() {
			try { return document.documentElement.classList.contains("gn-desktop-window"); } catch (e) { return false; }
		}
		// The app sets its theme as CSS `color-scheme` on the root and paints with a text
		// colour to match; the system's own preference can differ, so read what the app
		// actually looks like rather than what the OS says.
		function isDark() {
			try {
				var root = document.documentElement;
				if (root.hasAttribute("data-ds-dark-theme") || root.classList.contains("dark")) return true;
				if (/dark/.test(getComputedStyle(root).colorScheme || "")) return true;
				var col = getComputedStyle(document.body).color || "";
				var m = col.match(/(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)/);
				if (m) return (0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3]) > 140;
				return false;
			} catch (e) { return false; }
		}
		function allowed() { return isDark(); }

		function paint() {
			try { document.documentElement.classList.toggle("gn-glass", read() && allowed()); } catch (e) {}
		}

		var watchers = [];
		function notify() { watchers.forEach(function (f) { try { f(read()); } catch (e) {} }); }

		function set(on) {
			var want = !!on && allowed();
			try { want ? localStorage.setItem(KEY, "1") : localStorage.removeItem(KEY); } catch (e) {}
			paint();
			notify();
		}

		// The page has to be clear for the column to show anything, and the column's own
		// chain paints in several places. The composer's card is deliberately absent: the
		// input keeps the background it has in dark mode. So is the sidebar, which is the
		// point — this is the chat only.
		var css =
			"html.gn-glass," +
			"html.gn-glass body," +
			"html.gn-glass #root," +
			"html.gn-glass #root>div," +
			"html.gn-glass [class*=_centerCol]," +
			"html.gn-glass [class*=_centerCol] [class*=_frame]," +
			"html.gn-glass [class*=_centerCol] [class*=_root]," +
			"html.gn-glass [class*=_centerCol] [class*=_body]," +
			"html.gn-glass [class*=_centerCol] [class*=_scrollBody]," +
			"html.gn-glass [class*=_centerCol] [class*=_scroller]," +
			"html.gn-glass [class*=_centerCol] [class*=_page]," +
			"html.gn-glass [class*=_centerCol] [class*=_composerSeat]," +
			"html.gn-glass [class*=_centerCol] [class*=_dock]," +
			"html.gn-glass [class*=_centerCol] [class*=_dockSeat]" +
			"{background:transparent!important;background-color:transparent!important;" +
			"background-image:none!important;border-color:transparent!important}";

		function stylize() {
			try {
				var id = "gnts-glass/glass.css";
				if (document.querySelector("style[data-plugin-css=" + JSON.stringify(id) + "]") !== null) return;
				var tag = document.createElement("style");
				tag.setAttribute("data-plugin-css", id);
				tag.textContent = css;
				document.head.appendChild(tag);
			} catch (e) {}
		}

		// The row: a switch, in the same shape as the rows around it. No controls.
		function GlassRow() {
			var React = require("react");
			var cE = React.createElement;
			var s = React.useState(read());
			var on = s[0], setOn = s[1];
			React.useEffect(function () { return window.__gntsGlass.subscribe(setOn); }, []);
			// The row's own view of the theme. It only re-rendered on the glass flag, so after
			// switching light -> dark the switch stayed disabled until a reload — the theme had
			// changed but nothing told this component.
			var t = React.useState(0);
			var bump = t[1];
			React.useEffect(function () {
				try {
					var obs = new MutationObserver(function () { bump(function (n) { return n + 1; }); });
					obs.observe(document.documentElement, {
						attributes: true,
						attributeFilter: ["data-ds-dark-theme", "class", "style"],
					});
					return function () { obs.disconnect(); };
				} catch (e) { return undefined; }
			}, []);
			var live = on && allowed();
			var sw;
			try {
				var prim = require("@deepseek-ai/dsh-client-ui-primitives");
				sw = cE(prim.Switch, {
					checked: live,
					disabled: !allowed(),
					label: "Glass chat",
					onChange: function (v) { window.__gntsGlass.set(v); },
				});
			} catch (e) {
				sw = cE("button", {
					role: "switch",
					"aria-checked": live ? "true" : "false",
					"aria-label": "Glass chat",
					disabled: !allowed(),
					onClick: function () { window.__gntsGlass.set(!on); },
					style: {
						boxSizing: "border-box", width: 34, height: 20, flex: "none", padding: 0, border: "none",
						borderRadius: 10, cursor: allowed() ? "pointer" : "default", position: "relative",
						background: live ? "var(--dsw-alias-button-primary-fill)" : "var(--dsw-alias-border-l3)",
						opacity: allowed() ? 1 : 0.4,
					},
				}, cE("span", { style: {
					position: "absolute", top: 2, left: live ? 16 : 2, width: 16, height: 16, borderRadius: "50%",
					background: "var(--dsw-alias-label-primary-foreground)", transition: "left .12s var(--ds-ease-in-out)",
				} }));
			}
			return cE("div", { className: "Pt1bsG_row" }, [
				cE("div", { key: "t" }, [
					cE("div", { key: "a", className: "Pt1bsG_title" }, "Glass chat"),
					cE("div", { key: "b", className: "Pt1bsG_description" },
						allowed()
							? "Show the window behind the conversation. Desktop app only."
							: "Dark mode only. Switch to dark to use this."),
				]),
				sw,
			]);
		}

		function apply(ctx) {
			try {
				stylize();
				paint();
				ctx.slots.inject("settings.general.item", function () {
					return ctx.slots.register({
						name: "settings.general.item",
						id: "gnts-glass",
						order: 16,
						locale: "common",
					}, GlassRow);
				});
				// the look depends on the theme, so re-evaluate when it changes — and give it
				// up rather than sit in a mode it is not allowed in
				try {
					new MutationObserver(function () {
						if (!allowed() && read()) set(false);
						paint();
					}).observe(document.documentElement, {
						attributes: true, attributeFilter: ["data-ds-dark-theme", "class", "style"],
					});
				} catch (e) {}
				window.__gntsGlass = {
					supported: isDesktop(),
					enabled: read,
					set: set,
					subscribe: function (f) {
						watchers.push(f);
						return function () { watchers = watchers.filter(function (x) { return x !== f; }); };
					},
				};
			} catch (e) {
				console.warn("[glass] apply failed:", e && e.message);
			}
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
