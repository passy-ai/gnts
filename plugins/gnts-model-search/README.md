# dsh-model-search

Adds an auto-focused search field at the top of the model selection menu and filters the models as you type.

## Install

```bash
# 1. place the package where the profile resolves plugins
ln -s /path/to/dsh-model-search ~/.dsh/profiles/<profile>/node_modules/dsh-model-search
```

```yaml
# 2. enable it in the profile's cordis.patch.yml
- insert:
    - id: dsh-model-search
      name: dsh-model-search
```

Client services it injects: (none)

Platform: web. Desktop behaviour is unchanged unless stated otherwise.
