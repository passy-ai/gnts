window.__ModuleLoader__.load({
	// gnts: register under OUR package name.
	id: "gnts-brand",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		// Brand the product as "harness":
		//  - the vendor brand plugin (whale mark + DeepSeek wordmark) is disabled in
		//    the profile; here we occupy the same brand slots with a "harness" tag
		//    (and an empty mark, so no whale),
		//  - the boot loader hint becomes "Loading workspace" and its wordmark uses
		//    the same tag,
		//  - the new-session hero drops the vendor preview badge and whale, and its
		//    headline becomes the same tag badge the sidebar shows,
		//  - the document title and any stray "DeepSeek Harness" text become "harness".
		var inject = ["slots"];

		var TAG = "gnts.";

		function apply(ctx) {
			try {
				var React = require("react");
				var cE = React.createElement;

				var TAG_STYLE = {
					display: "inline-flex", alignItems: "center", padding: "2px 8px",
					background: "0 0", color: "inherit", borderRadius: 0,
					fontSize: 16, lineHeight: "22px", fontWeight: 600, letterSpacing: ".06em"
				};

				var css = ".gnts-boot{position:fixed;inset:0;z-index:2000;height:100%;display:grid;place-items:center;background-color:var(--dsw-alias-bg-base,#151517);transition:opacity .3s var(--ds-ease-in-out)}.gnts-boot-out{display:none!important;opacity:0;pointer-events:none}.gnts-boot-card{display:flex;flex-direction:column;align-items:center;gap:16px}.gnts-boot-wordmark{font-family:'Geist','Geist Sans',-apple-system,BlinkMacSystemFont,sans-serif;font-size:16px;line-height:24px;font-weight:600;letter-spacing:.08em;color:var(--dsw-alias-label-primary)}.gnts-boot-hint{font-family:'Geist','Geist Sans',-apple-system,BlinkMacSystemFont,sans-serif;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}.gnts-boot-spinner{position:relative;width:20px;height:20px;border-radius:50%;border:2px solid var(--dsw-alias-border-l2);animation:gnts-boot-spin .8s linear infinite}.gnts-boot-spinner:after{content:'';position:absolute;inset:-2px;border-radius:inherit;background:conic-gradient(var(--dsw-alias-label-primary) 72deg,transparent 0);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 0);mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 0)}@keyframes gnts-boot-spin{to{transform:rotate(360deg)}}" +
					".pXSMma_previewBadge{display:none!important;}" +   // hero "Preview"
					".pXSMma_fishHitbox{display:none!important;}" +           // hero whale
					// Phone widths: the background-jobs chip lives in the session header's action area
					// (dsh-client-ui-jobs, `QsffPG_root`) and never shrinks, so on a narrow window it
					// takes the room the chat title needs. Hidden there; the desktop keeps it.
					"@media (max-width:768px){.QsffPG_root{display:none!important;}}" +
					// The session header breadcrumb caps every segment at 220px
					// (`.wSkVaW_crumb{max-width:220px}`), and the chat's own title is one of those
					// segments, so it ellipsised long before the row ran out of room. Ancestors keep
					// the cap; the current title may use whatever the row has left, and the chips
					// beside it are flex:none so they are never squeezed by it.
					".wSkVaW_crumbs{flex:1 1 auto;min-width:0;}" +
					".wSkVaW_crumbCurrent{max-width:none!important;}" +
					// the tag: black, sharp corners, white text, Geist, loader metrics
					"@font-face{font-family:'Geist';font-style:normal;font-weight:400;font-display:swap;" +
						"src:url('https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-sans/Geist-Regular.woff2') format('woff2');}" +
					"@font-face{font-family:'Geist';font-style:normal;font-weight:600;font-display:swap;" +
						"src:url('https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-sans/Geist-SemiBold.woff2') format('woff2');}" +
					".dsh-harness-tag{display:inline-flex;align-items:center;padding:0;" +
						"background:0 0;color:inherit;border-radius:0;" +
						"font-family:'Geist','Geist Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" +
						"font-size:16px;line-height:22px;font-weight:600;letter-spacing:.06em;}" +
					// reversed in dark mode
					// colour inherits, so it is dark on light and light on dark — same as the sidebar.
					".dsh-harness-mark{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;background:#000;color:#fff;border-radius:0;font-family:'Geist','Geist Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:600;line-height:1;}" +"html.dark .dsh-harness-mark,[data-ds-dark-theme] .dsh-harness-mark{background:#fff;color:#000;}";

				// The cover ships in index.html, so it paints before any module loads — a plugin
				// cannot, which is why the vendor's boot page used to show through ours. This only
				// lifts it, once the composer or the model seat exists.
				(function () {
					var splashId = "gnts-boot";
					if (document.getElementById(splashId) === null) return;
					var started = Date.now();
					var drop = function () {
						var c = document.getElementById(splashId);
						if (c === null) return;
						c.style.transition = "opacity .3s ease";
						c.style.opacity = "0";
						setTimeout(function () { try { c.remove(); } catch (e) {} }, 320);
					};
					// fail-safe: never longer than 30 seconds, whatever happens
					setTimeout(drop, 30000);
					// Lift only when the app has been up for a moment, not the first time it
					// appears: the profile's disable/mount churn tears the composer down and rebuilds
					// it, and lifting on first sight exposed exactly that gap.
					var steadySince = null;
					var settle = setInterval(function () {
						// The seat existing is not enough: dsh-model-default writes its label a beat
						// later, so lifting on existence showed an empty seat for a second. Wait for
						// text in it, which means that plugin has run.
						var seat = document.querySelector("[data-dsh-model-seat]");
						var up = seat !== null && (seat.innerText || "").trim() !== "" &&
							document.querySelector("[contenteditable=true]") !== null;
						if (!up) { steadySince = null; }
						else if (steadySince === null) { steadySince = Date.now(); }
						if (steadySince !== null && Date.now() - steadySince > 1500) {
							clearInterval(settle);
							drop();
							return;
						}
						if (Date.now() - started > 20000 && up) { clearInterval(settle); drop(); }
					}, 120);
				})();

				var tagId = "dsh-brand/brand.css";
				if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
					var tag = document.createElement("style");
					tag.setAttribute("data-plugin-css", tagId);
					tag.textContent = css;
					document.head.appendChild(tag);
				}

				// brand slots: no whale, "harness" tag as the name
				function BrandName() { return null; }   // gnts: hidden — the wordmark lives in the sidebar top strip now, TAG); }
				function BrandMark() { return null; }   // gnts: no glyph in front of the wordmark
				// priority -1 shadows the vendor brand plugin's own registrations
				// (the slot is 'single' and lowest priority renders)
				ctx.slots.inject("sidebar.brand.mark", function () {
					return ctx.slots.register({ name: "sidebar.brand.mark", id: "dsh-brand-mark", priority: -1 }, BrandMark);
				});
				ctx.slots.inject("sidebar.brand.name", function () {
					return ctx.slots.register({ name: "sidebar.brand.name", id: "dsh-brand-name", priority: -1 }, BrandName);
				});

				function fixTitle() {
					try {
						if (document.title && document.title.indexOf("DeepSeek Harness") !== -1) {
							document.title = document.title.split("DeepSeek Harness").join(TAG);
						}
					} catch (e) {}
				}
				function fixTexts() {
					var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
					var node;
					while ((node = walker.nextNode())) {
						var t = node.textContent;
						if (!t) continue;
						if (t.indexOf("Into the Unknown") !== -1) node.textContent = t.split("Into the Unknown").join(TAG);
						else if (t.indexOf("DeepSeek Harness") !== -1) node.textContent = t.split("DeepSeek Harness").join(TAG);
						else if (t.indexOf("Loading plugins") !== -1) node.textContent = t.split("Loading plugins").join("Loading workspace");
					}
				}
				// The new-session hero renders its title as a plain headline ("Into the
				// Unknown" at 26px in the vendor build). Give it the same badge the
				// sidebar and the boot loader use, so the brand reads as one lockup.
				function fixHero() {
					var groups = document.querySelectorAll(".pXSMma_headline .pXSMma_titleGroup");
					for (var i = 0; i < groups.length; i++) {
						var title = groups[i].firstElementChild;
						if (!title) continue;
						// only our own brand text — never a session title the user typed
						if ((title.textContent || "").trim().indexOf(TAG) === -1) continue;
						if (title.classList.contains("dsh-harness-tag")) continue;
						title.textContent = TAG;
						title.classList.add("dsh-harness-tag");
						title.removeAttribute("style");
					}
				}
				function fixBoot() {
					var boot = document.querySelector("[data-dsh-boot]");
					if (!boot) return;
					var card = boot.firstElementChild;
					if (!card) return;
					var first = card.firstElementChild;   // wordmark
					if (first && !first.classList.contains("dsh-harness-tag")) {
						first.textContent = TAG;
						first.classList.add("dsh-harness-tag");
						first.removeAttribute("style");
					}
				}
				function sync() { fixTitle(); fixTexts(); fixHero(); fixBoot(); }

				if (typeof document !== "undefined") {
					if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, { once: true });
					else sync();
					var tries = 0;
					var boot = setInterval(function () { sync(); if (++tries > 40) clearInterval(boot); }, 250);
					// gnts: no repeating rewrite — it made the title and marks flash.
				}
			} catch (e) {
				console.warn("[dsh-brand] apply error:", e);
			}
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
