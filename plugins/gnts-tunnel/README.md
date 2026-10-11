# dsh-settings-tunnel

A **Settings → Tunnel** page for DeepSeek Harness: set up and manage the
Cloudflare (cloudflared) connector that publishes this harness on a public HTTPS
hostname — no terminal on the host needed.

<p align="center"><em>Design: the original Models page stylesheet (cards, tags,
status rows, rounded buttons) with the globe glyph as the nav icon.</em></p>

## What the page shows

Three cards, all open, all in the Autodiscover "Add a provider" shape (card head
with a name and a state tag, then the fields and actions in the editor panel):

| Card | Contents |
|---|---|
| **Quick tunnel** | one click, no account: a random `*.trycloudflare.com` hostname. `Start quick tunnel` / `Restart` / `Stop`, with a slim progress bar while Cloudflare publishes the hostname (it can take ~40 s to answer) |
| **Custom tunnel** | your own domain: a connector-token field, `Save and start` / `Stop`. The state sits in the field label, in line and never echoing the token: *Token set and active · paste a new one to replace* (green + muted) once configured, plain *Connector token* before that |
| **Connector** | `cloudflared` version, who manages it (launchd on macOS, the gateway process in a container), the transport (`auto`/`http2`/`quic`) and `Restart` / `Stop` |

When a tunnel is live a **Public URL** card appears above them with the hostname,
a **QR**, Copy/Open and the connection summary. There is no log panel: the
connector's log stays in `cloudflared.log` on the host.

## How it works

The page is a thin client over the gateway's `/tunnel` endpoints (paired session
required, `?format=json`):

```
GET  /tunnel?format=json
→ { ok, url, protocol, token:{configured,tunnelId}, cloudflared:{installed,version},
    service:{label,loaded,state,pid,plistInstalled}, connections:[{index,location,protocol,time}],
    lastError:{time,message,detail} }

POST /tunnel/token?format=json      body: token=<connector token>
POST /tunnel/protocol?format=json   body: protocol=auto|http2|quic
POST /tunnel/restart?format=json
→ { ok, message, status }        (the fresh status comes back in one round trip)
```

Saving a token writes `cloudflared.token` (mode `0600`), (re)installs the
`com.dsh-remote.tunnel` launchd job **generated for this install's paths**, and
starts it. Changing the transport writes `cloudflared.yml` and restarts the
connector. Every action is audited (`tunnel-token-set`, `tunnel-protocol-set`,
`tunnel-restart`).

## Install

```yaml
# <profile>/cordis.patch.yml
- insert:
    - id: dsh-settings-tunnel
      name: dsh-settings-tunnel
```

```bash
ln -s /path/to/dsh-settings-tunnel <profile>/node_modules/dsh-settings-tunnel
```

Requires the `dsh-remote` gateway (the page 404s when the app is opened straight
on the harness port).

## Notes

* The nav glyph replaces the settings shell's fallback gear with
  `IconGlobeOutline14` (`fill:currentColor`).
* Transport: QUIC is faster but drops on some LTE/CGNAT links; **HTTP/2** is the
  safer default, and the page says so.
* The connector token is never displayed back — only "configured" plus the
  tunnel id (the non-secret `t` field of the token).

MIT.
