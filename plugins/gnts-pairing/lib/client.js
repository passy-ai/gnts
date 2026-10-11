window.__ModuleLoader__.load({
	// gnts: register under OUR package name.
	id: "gnts-pairing",
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
					".zGbnIq_rows{flex-direction:column;gap:8px;margin:12px 0 0;padding:0;list-style:none;display:flex}" +
					".zGbnIq_rowCard{border:.5px solid var(--dsw-alias-border-l4);border-radius:16px;flex-direction:column;gap:12px;padding:12px 14px;display:flex}" +
					// an "add" panel is ONE grey block (Autodiscover's Add-a-provider)
					".zGbnIq_addCard{background:var(--dsw-alias-bg-module-platform);border-radius:12px;flex-direction:column;gap:14px;padding:14px 16px;list-style:none;display:flex}" +
					".zGbnIq_addCard .zGbnIq_editor{background:0 0;padding:0}" +
					".zGbnIq_rowHead{align-items:center;gap:10px;display:flex}" +
					".zGbnIq_rowIdentity{align-items:center;gap:6px;min-width:0;display:inline-flex}" +
					".zGbnIq_rowName{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px}" +
					".zGbnIq_rowTag{border:.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary);border-radius:4px;flex:none;padding:1px 6px;font-size:11px;line-height:16px}" +
					".zGbnIq_rowActions{align-items:center;gap:4px;margin-left:auto;display:inline-flex}" +
					".zGbnIq_primaryButton,.zGbnIq_secondaryButton{box-sizing:border-box;height:36px;font:inherit;cursor:pointer;border:none;border-radius:18px;justify-content:center;align-items:center;gap:4px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}" +
					".zGbnIq_primaryButton{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}" +
					".zGbnIq_primaryButton:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}" +
					".zGbnIq_secondaryButton{border:.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary);background:0 0}" +
					".zGbnIq_secondaryButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}" +
					".zGbnIq_primaryButton:disabled,.zGbnIq_secondaryButton:disabled{opacity:.4;cursor:default}" +
					".zGbnIq_editor{background:var(--dsw-alias-bg-module-platform);border-radius:12px;flex-direction:column;gap:14px;padding:14px 16px;display:flex}" +
					".zGbnIq_field{flex-direction:column;gap:6px;display:flex}" +
					".zGbnIq_fieldLabel{color:var(--dsw-alias-label-secondary);align-items:center;gap:10px;font-size:12px;font-weight:500;line-height:18px;display:inline-flex}" +
					".zGbnIq_advancedHint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}" +
					".zGbnIq_input{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);width:100%;height:32px;font:inherit;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 10px;font-size:14px;line-height:22px}" +
					".zGbnIq_input:focus{border-color:var(--dsw-alias-brand-primary);outline:none}" +
					".zGbnIq_input::placeholder{color:var(--dsw-alias-label-dimmed)}" +
					".zGbnIq_input:disabled{opacity:.6;cursor:default}" +
					".zGbnIq_actionRow{align-items:center;gap:8px;display:flex}" +
					".zGbnIq_actionRow>.zGbnIq_input{width:auto;flex:1 1 0;min-width:0}" +
					".zGbnIq_actionRow>.zGbnIq_primaryButton,.zGbnIq_actionRow>.zGbnIq_secondaryButton{flex:none}" +
					".zGbnIq_result{border-top:.5px solid var(--dsw-alias-border-l2);flex-direction:column;gap:10px;padding-top:12px;display:flex}" +
					".zGbnIq_resultMain{align-items:center;flex-wrap:wrap;gap:16px;display:flex}" +
					".zGbnIq_resultBody{flex:1 1 240px;flex-direction:column;gap:10px;min-width:0;display:flex}" +
					".zGbnIq_code{font-family:var(--ds-font-family-code,\"SF Mono\",Menlo,Consolas,monospace);color:var(--dsw-alias-label-primary);letter-spacing:6px;font-size:24px;font-weight:600;line-height:32px;overflow-wrap:anywhere;user-select:all;-webkit-user-select:all}" +
					".zGbnIq_copied{color:var(--dsw-alias-state-success-primary);font-size:12px;line-height:18px}" +
					".zGbnIq_linkRow{align-items:center;gap:8px;display:flex}" +
					".zGbnIq_linkInput{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-tertiary);border-radius:8px;flex:1 1 0;min-width:0;height:32px;padding:0 10px;font-family:var(--ds-font-family-code,\"SF Mono\",Menlo,Consolas,monospace);font-size:12px}" +
					".zGbnIq_deviceList{flex-direction:column;display:flex}" +
					".zGbnIq_deviceRow{align-items:center;gap:10px;border-top:.5px solid var(--dsw-alias-border-l2);padding:10px 0;display:flex}" +
					".zGbnIq_deviceRow:first-child{border-top:0;padding-top:2px}" +
					".zGbnIq_deviceInfo{flex-direction:column;min-width:0;display:flex}" +
					".zGbnIq_deviceName{color:var(--dsw-alias-label-primary);white-space:nowrap;text-overflow:ellipsis;font-size:14px;font-weight:500;line-height:22px;overflow:hidden}" +
					".zGbnIq_deviceMeta{color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere;font-size:12px;line-height:18px}" +
					".zGbnIq_deviceActions{flex:none;align-items:center;gap:6px;margin-left:auto;display:inline-flex}" +
					".zGbnIq_dangerButton{box-sizing:border-box;height:28px;color:var(--dsw-alias-state-error-primary);font:inherit;cursor:pointer;background:0 0;border:none;border-radius:14px;align-items:center;padding:0 10px;font-size:12px;line-height:18px;display:inline-flex}" +
					".zGbnIq_dangerButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}" +
					".zGbnIq_dangerButton:disabled{opacity:.4;cursor:default}" +
					".zGbnIq_qr{background:0 0;border:0;border-radius:14px;flex:none;width:195px;height:195px;display:block}" +
					"body[data-ds-dark-theme] .zGbnIq_qr,html.dark .zGbnIq_qr{background:#fff;border-radius:14px}" +
					".zGbnIq_codeRow{align-items:center;gap:6px;display:flex}" +
					".zGbnIq_iconButton{box-sizing:border-box;width:28px;height:28px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:6px;flex:none;justify-content:center;align-items:center;display:inline-flex}" +
					".zGbnIq_iconButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}" +
					"@media (max-width:768px){.zGbnIq_resultMain{gap:12px}.zGbnIq_qr{width:150px;height:150px}.zGbnIq_code{letter-spacing:3px;font-size:19px;line-height:28px}}";
				// Guard the one thing a bad edit can silently break: a dropped "+" turns the
				// rest of the stylesheet into a dead expression statement, so the page still
				// renders — just unstyled. Say so loudly instead.
				(function () {
					var required = [".zGbnIq_deviceRow", ".zGbnIq_deviceInfo", ".zGbnIq_linkRow", ".zGbnIq_qr", "@media (max-width:768px)"];
					var missing = required.filter(function (rule) { return css.indexOf(rule) === -1; });
					if (missing.length > 0) console.warn("[pairing] stylesheet is missing " + missing.join(", ") + " \u2014 check the css string concatenation");
				})();

				var tagId = "dsh-settings-pairing/pairing.css";
				if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
					var tag = document.createElement("style");
					tag.setAttribute("data-plugin-css", tagId);
					tag.textContent = css;
					document.head.appendChild(tag);
				}

				// The settings shell renders its fallback gear for section ids it does not
				// know. Swap in the link glyph (IconLinkOutline16 from
				// @deepseek-ai/dsh-client-ui-primitives) — a connected pair of links.
				var LINK_GLYPHS = ["M9.94133 6.50173C11.3218 7.99603 11.3218 10.3011 9.94128 11.7954C9.88691 11.8542 9.82125 11.9196 9.72099 12.0198L7.75707 13.9838C7.65709 14.0838 7.592 14.1491 7.53334 14.2034C6.03906 15.5843 3.7327 15.5854 2.23827 14.2048C2.17933 14.1503 2.11374 14.0844 2.01315 13.9838C1.91318 13.8839 1.84922 13.8188 1.79495 13.7601C0.413857 12.2657 0.413909 9.95948 1.795 8.46503C1.84923 8.4064 1.91335 8.34115 2.01321 8.24129L3.79275 6.46313C3.71814 7.08101 3.75236 7.71445 3.90115 8.33518L3.00344 9.23151C2.89398 9.34097 2.8535 9.38307 2.82251 9.41658C1.93771 10.3744 1.93704 11.8514 2.82179 12.8092C2.85279 12.8427 2.89383 12.884 3.0034 12.9936C3.11272 13.1029 3.15429 13.1442 3.18777 13.1752C4.14561 14.0603 5.62381 14.0608 6.58178 13.1758C6.61532 13.1448 6.65722 13.1032 6.76685 12.9935L8.73077 11.0296C8.83999 10.9204 8.88142 10.8787 8.91238 10.8452C9.79744 9.88728 9.7969 8.40911 8.91173 7.45124C8.88074 7.41775 8.83944 7.3762 8.73011 7.26687C8.62082 7.15757 8.58061 7.11623 8.54712 7.08526C8.37347 6.92477 8.18243 6.79361 7.98088 6.69165L9.00289 5.66964C9.17506 5.78373 9.34035 5.91265 9.49663 6.05703C9.55538 6.11135 9.62026 6.17652 9.72036 6.27662C9.82094 6.3772 9.88686 6.4428 9.94133 6.50173Z", "M6.06816 9.49196C4.68626 7.99724 4.68667 5.68942 6.06885 4.19487C6.12268 4.13671 6.18789 4.07306 6.28706 3.9739L8.24541 2.01416C8.34478 1.91479 8.41018 1.85055 8.46845 1.79665C9.96301 0.414902 12.2689 0.414922 13.7635 1.79665C13.8217 1.85051 13.8866 1.91559 13.9858 2.01486C14.0849 2.11394 14.1502 2.17769 14.204 2.23583C15.5861 3.7304 15.5866 6.03823 14.2047 7.53291C14.1508 7.59125 14.0854 7.65638 13.9858 7.75595L12.1994 9.54098C12.2614 8.92982 12.2185 8.30587 12.0634 7.69657L12.9956 6.76573C13.1044 6.65692 13.1458 6.61529 13.1765 6.58205C14.0621 5.62404 14.0621 4.1454 13.1765 3.18738C13.1458 3.15419 13.104 3.1135 12.9956 3.00508C12.8877 2.89716 12.8471 2.85551 12.814 2.82485C11.8559 1.9389 10.376 1.93886 9.41794 2.82485C9.38479 2.85554 9.34381 2.89622 9.23564 3.00439L7.27728 4.96413C7.16875 5.07265 7.12708 5.11322 7.09636 5.14643C6.21074 6.10441 6.21153 7.58236 7.09705 8.5404C7.12775 8.57357 7.16826 8.61575 7.27659 8.72408C7.38456 8.83205 7.42647 8.87227 7.45958 8.90293C7.62849 9.0591 7.81309 9.1881 8.00856 9.28894L6.98795 10.3095C6.82111 10.1978 6.66052 10.0715 6.50872 9.93114C6.45057 9.87733 6.38547 9.81341 6.28637 9.71431C6.1871 9.61504 6.12202 9.55018 6.06816 9.49196Z"];
				var SVG_NS = "http://www.w3.org/2000/svg";
				function fixNavIcon() {
					try {
						var cells = document.querySelectorAll(".VOzbGW_navCell");
						for (var i = 0; i < cells.length; i++) {
							if ((cells[i].innerText || "").trim().toLowerCase() !== "pairing") continue;
							if (cells[i].querySelector("[data-dshpair-icon]")) continue;
							var icon = cells[i].querySelector(".VOzbGW_navIcon");
							if (!icon) continue;
							var svg = document.createElementNS(SVG_NS, "svg");
							svg.setAttribute("data-dshpair-icon", "1");
							svg.setAttribute("width", "16");
							svg.setAttribute("height", "16");
							svg.setAttribute("viewBox", "0 0 16 16");
							svg.setAttribute("fill", "none");
							svg.setAttribute("class", "VOzbGW_navIcon");
							for (var g = 0; g < LINK_GLYPHS.length; g++) {
								var path = document.createElementNS(SVG_NS, "path");
								path.setAttribute("d", LINK_GLYPHS[g]);
								path.setAttribute("fill", "currentColor");
								svg.appendChild(path);
							}
							icon.replaceWith(svg);
						}
					} catch (e) {}
				}
				if (typeof document !== "undefined") {
					if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fixNavIcon, { once: true });
					else fixNavIcon();
					// gnts: no repeating rewrite — it made the nav icon flash and change.
				}

				/** Read a gateway JSON response, mapping its failures to operator-facing text. */
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
							if (res.status === 404 && !data) throw new Error("No dsh-remote gateway answered here. Open the app through your remote URL (or run dsh-remote pair on the host).");
							throw new Error((data && data.error) || "Request failed (" + res.status + ")");
						});
					});
				}

				/**
				 * Collapse the pairing sessions into one row per device name: every
				 * re-pairing of the same phone/laptop adds another session id, and the list
				 * is about devices, not sessions. The freshest session wins; its ids are
				 * kept so removing the device can revoke all of them.
				 */
				function groupDevices(list) {
					var byLabel = {};
					var order = [];
					(list || []).forEach(function (device) {
						var key = (device.label || "").trim() || "Unnamed device";
						if (byLabel[key] === undefined) {
							byLabel[key] = { label: key, ids: [], sessions: 0, lastSeenAgoMs: null, current: false };
							order.push(key);
						}
						var group = byLabel[key];
						group.ids.push(device.id);
						group.sessions += 1;
						if (device.current) group.current = true;
						var ago = typeof device.lastSeenAgoMs === "number" ? device.lastSeenAgoMs : null;
						if (ago !== null && (group.lastSeenAgoMs === null || ago < group.lastSeenAgoMs)) group.lastSeenAgoMs = ago;
					});
					return order.map(function (key) { return byLabel[key]; });
				}

				/** Human relative time for a device's last activity. */
				function ago(ms) {
					if (typeof ms !== "number" || ms < 0) return "never";
					var mins = Math.floor(ms / 60000);
					if (mins < 1) return "just now";
					if (mins < 60) return mins + (mins === 1 ? " minute ago" : " minutes ago");
					var hours = Math.floor(mins / 60);
					if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");
					var days = Math.floor(hours / 24);
					return days + (days === 1 ? " day ago" : " days ago");
				}

				// The app's own copy / check glyphs (@deepseek-ai/dsh-client-ui-primitives).
				var COPY_GLYPH = "M6.14929 4.02032C7.11197 4.02032 7.87983 4.02016 8.49597 4.07598C9.12128 4.13269 9.65792 4.25188 10.1415 4.53106C10.7202 4.8653 11.2008 5.3459 11.535 5.92462C11.8142 6.40818 11.9334 6.94481 11.9901 7.57012C12.0459 8.18625 12.0458 8.95419 12.0458 9.9168C12.0458 10.8795 12.0459 11.6473 11.9901 12.2635C11.9334 12.8888 11.8142 13.4254 11.535 13.909C11.2008 14.4877 10.7202 14.9683 10.1415 15.3025C9.65792 15.5817 9.12128 15.7009 8.49597 15.7576C7.87984 15.8134 7.11196 15.8133 6.14929 15.8133C5.18667 15.8133 4.41874 15.8134 3.80261 15.7576C3.1773 15.7009 2.64067 15.5817 2.1571 15.3025C1.5784 14.9683 1.09778 14.4877 0.76355 13.909C0.484366 13.4254 0.365184 12.8888 0.308472 12.2635C0.252649 11.6473 0.252808 10.8795 0.252808 9.9168C0.252808 8.95418 0.252664 8.18625 0.308472 7.57012C0.365184 6.94481 0.484366 6.40818 0.76355 5.92462C1.09777 5.34589 1.57839 4.86529 2.1571 4.53106C2.64067 4.25188 3.1773 4.13269 3.80261 4.07598C4.41874 4.02017 5.18666 4.02032 6.14929 4.02032ZM6.14929 5.37774C5.16181 5.37774 4.46634 5.37761 3.92566 5.42657C3.39434 5.47472 3.07859 5.56574 2.83582 5.70587C2.4632 5.92106 2.15354 6.2307 1.93835 6.60333C1.79823 6.8461 1.70721 7.16185 1.65906 7.69317C1.6101 8.23385 1.61023 8.92933 1.61023 9.9168C1.61023 10.9043 1.61009 11.5998 1.65906 12.1404C1.70721 12.6717 1.79823 12.9875 1.93835 13.2303C2.15356 13.6029 2.46321 13.9126 2.83582 14.1277C3.07859 14.2679 3.39434 14.3589 3.92566 14.407C4.46634 14.456 5.16182 14.4559 6.14929 14.4559C7.13682 14.4559 7.83224 14.456 8.37292 14.407C8.90425 14.3589 9.21999 14.2679 9.46277 14.1277C9.83535 13.9126 10.145 13.6029 10.3602 13.2303C10.5004 12.9875 10.5914 12.6717 10.6395 12.1404C10.6885 11.5998 10.6884 10.9043 10.6884 9.9168C10.6884 8.92934 10.6885 8.23384 10.6395 7.69317C10.5914 7.16185 10.5004 6.8461 10.3602 6.60333C10.1451 6.23071 9.83536 5.92107 9.46277 5.70587C9.21999 5.56574 8.90424 5.47472 8.37292 5.42657C7.83224 5.3776 7.13682 5.37774 6.14929 5.37774ZM9.80164 0.367975C10.7638 0.367975 11.5314 0.36788 12.1473 0.423639C12.7726 0.480307 13.3093 0.598759 13.7928 0.877741C14.3717 1.21192 14.8521 1.69355 15.1864 2.27227C15.4655 2.75574 15.5857 3.29164 15.6425 3.9168C15.6983 4.53301 15.6971 5.3016 15.6971 6.26446V7.82989C15.6971 8.29264 15.6989 8.58993 15.6649 8.84844C15.4668 10.3525 14.401 11.5738 12.9833 11.9988V10.5467C13.6973 10.1903 14.2105 9.49662 14.3192 8.67169C14.3387 8.52347 14.3407 8.3358 14.3407 7.82989V6.26446C14.3407 5.27706 14.3398 4.58149 14.2909 4.04083C14.2428 3.50968 14.1526 3.19372 14.0126 2.95098C13.7974 2.57849 13.4876 2.26869 13.1151 2.05352C12.8724 1.91347 12.5564 1.82237 12.0253 1.77423C11.4847 1.72528 10.7888 1.7254 9.80164 1.7254H7.71472C6.7562 1.72558 5.92665 2.27697 5.52332 3.07891H4.07019C4.54221 1.51132 5.9932 0.368186 7.71472 0.367975H9.80164Z";
				var CHECK_GLYPH = "M15.0498 3.92579L8.49512 12.3818C8.25774 12.6881 8.04517 12.9645 7.84668 13.1689C7.63957 13.3823 7.38732 13.5841 7.04492 13.6719C6.86373 13.7183 6.6757 13.7346 6.48926 13.7197C6.13666 13.6915 5.8528 13.5355 5.6123 13.3604C5.38201 13.1926 5.12573 12.9567 4.83984 12.6953L1.03125 9.21289L1.96875 8.1875L5.77734 11.6699C6.08684 11.9529 6.27773 12.1249 6.43066 12.2363C6.50183 12.2882 6.54699 12.3135 6.57324 12.3252C6.58525 12.3305 6.59269 12.3322 6.5957 12.333C6.59802 12.3336 6.59961 12.334 6.59961 12.334C6.63317 12.3367 6.66758 12.3335 6.7002 12.3252C6.7002 12.3252 6.70211 12.3251 6.7041 12.3242C6.70698 12.3229 6.71348 12.319 6.72461 12.3115C6.74849 12.2956 6.78843 12.2642 6.84961 12.2012C6.98138 12.0654 7.13957 11.8628 7.39648 11.5313L13.9502 3.07422L15.0498 3.92579Z";
				function glyph(path) {
					return cE("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true" },
						cE("path", { d: path, fill: "currentColor" }));
				}

				/** Ask the dsh-remote gateway to mint a one-time code for a new device. */
				function requestCode(label) {
					return gatewayJson("/devices/newcode?format=json", { method: "POST", body: "label=" + encodeURIComponent(label) });
				}

				function PairingSection() {
					var labelState = useState("New device");
					var label = labelState[0], setLabel = labelState[1];
					var busyState = useState(false);
					var busy = busyState[0], setBusy = busyState[1];
					var errState = useState(null);
					var err = errState[0], setErr = errState[1];
					var codeState = useState(null);
					var result = codeState[0], setResult = codeState[1];
					var copiedState = useState(false);
					var copied = copiedState[0], setCopied = copiedState[1];
					var copiedCodeState = useState(false);
					var copiedCode = copiedCodeState[0], setCopiedCode = copiedCodeState[1];
					var devicesState = useState(null);
					var devices = devicesState[0], setDevices = devicesState[1];
					var devErrState = useState(null);
					var devErr = devErrState[0], setDevErr = devErrState[1];
					var devBusyState = useState(null);
					var devBusy = devBusyState[0], setDevBusy = devBusyState[1];
					var openState = useState(false);
					var open = openState[0], setOpen = openState[1];

					/** Load the paired devices (never their pairing codes — those are single-use hashes on the host). */
					function loadDevices() {
						gatewayJson("/devices?format=json").then(function (data) {
							setDevices(data.devices || []);
							setDevErr(null);
						}).catch(function (e) {
							setDevices([]);
							setDevErr(String((e && e.message) || e));
						});
					}

					/** Revoke every session of one device; it stops working immediately. */
					function removeDevice(group) {
						setDevBusy(group.label);
						setDevErr(null);
						Promise.all(group.ids.map(function (id) {
							return gatewayJson("/devices/revoke?format=json", { method: "POST", body: "id=" + encodeURIComponent(id) });
						})).then(function () {
							setDevBusy(null);
							loadDevices();
						}).catch(function (e) {
							setDevBusy(null);
							setDevErr(String((e && e.message) || e));
							loadDevices();
						});
					}

					useEffect(function () { loadDevices(); }, []);

					function generate() {
						setBusy(true);
						setErr(null);
						setCopied(false);
						setCopiedCode(false);
						requestCode(label.trim() || "New device").then(function (data) {
							setBusy(false);
							setResult(data);
						}).catch(function (e) {
							setBusy(false);
							setResult(null);
							setErr(String((e && e.message) || e));
						});
					}

					/** Clipboard with a select-and-execCommand fallback for older browsers. */
					function copyText(text, done) {
						if (!text) return;
						try {
							if (navigator.clipboard && navigator.clipboard.writeText) {
								navigator.clipboard.writeText(text).then(done, function () {});
								return;
							}
						} catch (e) {}
						try {
							var field = document.querySelector("[data-dshpair-link]");
							if (field) { field.select(); document.execCommand("copy"); done(); }
						} catch (e) {}
					}

					function copyLink() { copyText(result && result.link, function () { setCopied(true); }); }
					function copyCode() { copyText(result && (result.grouped || result.code), function () { setCopiedCode(true); }); }

					var groups = devices === null ? null : groupDevices(devices);
					var chevronStyle = {
						boxSizing: "border-box", width: 8, height: 8, flex: "none",
						borderRight: "1.5px solid var(--dsw-alias-label-tertiary)",
						borderBottom: "1.5px solid var(--dsw-alias-label-tertiary)",
						transform: open ? "rotate(-135deg)" : "rotate(45deg)",
						transition: "transform .15s ease"
					};

					return cE("div", { className: "zGbnIq_section" },
						cE("h3", { className: "zGbnIq_title" }, "Pairing"),
						cE("p", { className: "zGbnIq_intro" }, "Devices paired to this harness. Each device signs in with its own session \u2014 generating a code connects one more, and removing a device stops it immediately."),
						cE("ul", { className: "zGbnIq_rows", style: { listStyle: "none" } },
							cE("li", { className: "zGbnIq_rowCard" },
								cE("div", { className: "zGbnIq_rowHead", style: { cursor: "pointer" }, onClick: function () { setOpen(!open); } },
									cE("div", { className: "zGbnIq_rowIdentity" },
										cE("span", { className: "zGbnIq_rowName" }, "Paired devices"),
										cE("span", { className: "zGbnIq_rowTag" }, groups === null ? "loading" : String(groups.length))
									),
									cE("div", { className: "zGbnIq_rowActions" },
										cE("button", {
											className: "zGbnIq_secondaryButton",
											disabled: devBusy !== null,
											onClick: function (e) { e.stopPropagation(); loadDevices(); }
										}, "Refresh")
									),
									cE("span", { style: chevronStyle })
								),
								open ? cE("div", { className: "zGbnIq_deviceList" },
									devErr ? cE("p", { className: "zGbnIq_error" }, devErr) : null,
									groups !== null && groups.length === 0 && !devErr
										? cE("p", { className: "zGbnIq_advancedHint" }, "No paired devices yet.")
										: null,
									(groups || []).map(function (group) {
										return cE("div", { className: "zGbnIq_deviceRow", key: group.label, "data-device": group.ids[0] },
											cE("div", { className: "zGbnIq_deviceInfo" },
												cE("span", { className: "zGbnIq_deviceName" }, group.label),
												cE("span", { className: "zGbnIq_deviceMeta" },
													"last login " + ago(group.lastSeenAgoMs)
													+ (group.sessions > 1 ? " \u00b7 " + group.sessions + " sessions" : ""))
											),
											cE("div", { className: "zGbnIq_deviceActions" },
												group.current
													? cE("span", { className: "zGbnIq_rowTag" }, "this device")
													: cE("button", {
														className: "zGbnIq_dangerButton",
														disabled: devBusy !== null,
														onClick: function () { removeDevice(group); }
													}, devBusy === group.label ? "Removing\u2026" : "Remove")
											)
										);
									})
								) : null
							),
							cE("li", { className: "zGbnIq_addCard" },
								cE("div", { className: "zGbnIq_rowHead" },
									cE("div", { className: "zGbnIq_rowIdentity" },
										cE("span", { className: "zGbnIq_rowName" }, "New device")
									),
									result
										? cE("div", { className: "zGbnIq_rowActions" },
											cE("button", { className: "zGbnIq_secondaryButton", onClick: function () { setResult(null); setCopied(false); setCopiedCode(false); } }, "Clear"))
										: null
								),
								cE("div", { className: "zGbnIq_editor" },
									cE("div", { className: "zGbnIq_field" },
										cE("label", { className: "zGbnIq_fieldLabel" }, "Device name"),
										cE("p", { className: "zGbnIq_advancedHint" }, "Shown next to the device in the list, so a phone or a laptop is recognisable later.")
									),
									err ? cE("p", { className: "zGbnIq_error" }, err) : null,
									cE("div", { className: "zGbnIq_actionRow" },
										cE("input", {
											className: "zGbnIq_input",
											type: "text",
											value: label,
											placeholder: "New device",
											maxLength: 32,
											disabled: busy,
											onChange: function (e) { setLabel(e.target.value); setErr(null); },
											onKeyDown: function (e) { if (e.key === "Enter" && !busy) generate(); }
										}),
										cE("button", { className: "zGbnIq_primaryButton", disabled: busy, onClick: generate }, busy ? "Generating\u2026" : "Generate code")
									),
									result
										? cE("div", { className: "zGbnIq_result" },
																					cE("div", { className: "zGbnIq_resultMain" },
											result.qr
												? cE("img", { className: "zGbnIq_qr", src: result.qr, alt: "Pairing QR code", width: 195, height: 195 })
												: null,
											cE("div", { className: "zGbnIq_resultBody" },
												cE("div", { className: "zGbnIq_codeRow" },
													cE("span", { className: "zGbnIq_code" }, result.grouped || result.code),
													cE("button", {
														className: "zGbnIq_iconButton",
														type: "button",
														title: copiedCode ? "Copied" : "Copy pairing code",
														onClick: copyCode
													}, glyph(copiedCode ? CHECK_GLYPH : COPY_GLYPH))
												),
												cE("div", { className: "zGbnIq_linkRow" },
													cE("input", { className: "zGbnIq_linkInput", readOnly: true, value: result.link || "", "data-dshpair-link": "1", onFocus: function (e) { e.target.select(); } }),
													cE("button", { className: "zGbnIq_secondaryButton", onClick: copyLink }, copied ? "Copied" : "Copy")
												),
												cE("p", { className: "zGbnIq_advancedHint" }, "Open this on the new device to pair instantly, or type the code on its sign-in screen. Valid for " + String(result.expiresInMinutes || 10) + " minutes, single use.")
											)
										)
										)
										: null
								)
							)
						)
					);
				}

				ctx.slots.inject("settings.section", function () {
					return ctx.slots.register({
						name: "settings.section",
						id: "pairing",
						order: 13,
						label: function () { return "Pairing"; },
						inject: function () { return {}; },
						children: {}
					}, PairingSection);
				});
			} catch (e) {
				console.warn("[pairing] apply error:", e);
			}
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
