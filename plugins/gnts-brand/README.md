# dsh-brand

Rebrands the UI: no vendor whale/wordmark, a configurable brand tag (default 'gnts.dev', Geist font, black/white sharp chip that inverts in dark mode), 'Loading workspace' in the boot loader, and the new-session hero badge/whale removed.

## Install

```bash
# 1. place the package where the profile resolves plugins
ln -s /path/to/dsh-brand ~/.dsh/profiles/<profile>/node_modules/dsh-brand
```

```yaml
# 2. enable it in the profile's cordis.patch.yml
- insert:
    - id: dsh-brand
      name: dsh-brand
```

Client services it injects: @deepseek-ai/dsh-client-ui-slots, @deepseek-ai/dsh-client-ui-sidebar

Platform: web. Desktop behaviour is unchanged unless stated otherwise.
