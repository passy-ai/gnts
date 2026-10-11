# dsh-settings-pairing

A **Settings → Pairing** page for DeepSeek Harness: mint a one-time device
pairing code for the [`dsh-remote`](../../.dsh-remote) gateway without opening a
terminal on the host.

<p align="center"><em>Design: the original Models page stylesheet (card, hint,
input + button on one row, dashed/rounded buttons) with the link glyph as the
nav icon.</em></p>

## How it works

The page is a thin client over the gateway's existing admin endpoints:

```
GET  /devices?format=json             (gateway session cookie required)
→ { ok, current, devices:[{ id, label, created, lastSeen, lastSeenAgoMs, current }] }

POST /devices/newcode?format=json
body: label=<device name>
→ { ok, code, grouped, label, link, expiresInMinutes }

POST /devices/revoke?format=json
body: id=<device id>
→ { ok, revoked, label, current }
```

`dsh-remote`'s gateway already served all three for its own `/devices` admin
page (minting codes as `codes/<sha256(code)>.code`, 10-minute single-use); the
`?format=json` responses (or `Accept: application/json`) are the
machine-readable form of the same actions, so no host half is needed — the
plugin ships a no-op `apply()`.

What the page shows:

* **Paired devices** — collapsed by default (chevron points down when closed,
  up when open), showing **one row per device name**: every re-pairing of the same phone
  or laptop adds another session id, so the rows are grouped and the freshest
  session supplies the *last login* (with a `· N sessions` note when a device
  has more than one). **Remove** revokes *all* sessions of that device; the
  device you are using right now is tagged *this device* and has no Remove
  button, so the page cannot lock you out. Pairing codes are never listed (they
  are single-use hashes on the host and are deleted when consumed).
* **New device** — device-name field → **Generate code**; the result lands in
  the same card panel (no separate block below it): the **QR** of the invite
  link beside the code, then the full invite link with its **Copy** button under
  the code, then the validity note.
  * The code (`XXXX-XXXX`) is selectable text (`user-select: all`, so one click
    takes the whole code) with a **copy icon** beside it that flips to a check
    for a moment — the app's own `IconCopyOutline16` / `IconCheckOutline16`.
  * The QR arrives as a PNG **data URI with a transparent background**
    (`qrencode -t PNG32 -s 10 -m 3 --background=FFFFFF00`, 390×390, ~2.2 kB), so
    it sits on the panel with rounded corners instead of a white square; in the
    dark theme it gets a white rounded backing so it stays scannable. Without
    `qrencode` on the host the `qr` field is null and only code + link show.
  * On phones the QR wraps above the code and the link becomes full width.

Errors are explicit: a `403` means this browser's gateway session is gone, a
`404` means the app is not being served through the gateway (opened directly on
the harness port, or the plugin is running without `dsh-remote`).

## Install

```yaml
# <profile>/cordis.patch.yml
- insert:
    - id: dsh-settings-pairing
      name: dsh-settings-pairing
```

```bash
ln -s /path/to/dsh-settings-pairing <profile>/node_modules/dsh-settings-pairing
```

## Notes

* The nav glyph replaces the settings shell's fallback gear with
  `IconLinkOutline16` (`fill:currentColor`, 16×16), so the entry reads as
  "connect a device".
* Codes are minted and devices revoked in the gateway process, both audited
  there (`code-issued` / `device-revoked` with the acting device and label).
* Pairing a device is the same code path as `dsh-remote pair`; revoke devices
  with `dsh-remote devices revoke <id|name|all>`.

MIT.
