# dsh-settings-models-autodiscover

Settings > Autodiscover: a simple models page. Lists configured providers, discovers their models live (with wire-format auto-detection), per-model on/off switches, search, add/remove provider, and a refresh nav icon. Replaces the native Models page.

## Install

```bash
# 1. place the package where the profile resolves plugins
ln -s /path/to/dsh-settings-models-autodiscover ~/.dsh/profiles/<profile>/node_modules/dsh-settings-models-autodiscover
```

```yaml
# 2. enable it in the profile's cordis.patch.yml
- insert:
    - id: dsh-settings-models-autodiscover
      name: dsh-settings-models-autodiscover
```

Client services it injects: @deepseek-ai/dsh-client-locale, @deepseek-ai/dsh-client-ui-settings, @deepseek-ai/dsh-api-remotes

Platform: web. Desktop behaviour is unchanged unless stated otherwise.
