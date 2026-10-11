// gnts: the stock host half imports @deepseek-ai/schemastery for its Config schema.
// A linked plugin resolves that from the plugin's own path, not the harness tree,
// and lands on a copy without `.volatile` — so the entry fails to import and the
// whole client goes down with it. The schema is only a config declaration we do
// not use, so it is dropped and the behaviour is kept.
/** The browser consumes the configuration form projection. */
export function apply(ctx) {
	ctx.inject(["settings"], (child) => {
		child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
	});
}
