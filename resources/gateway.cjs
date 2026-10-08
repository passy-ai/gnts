#!/usr/bin/env node
'use strict';
// =============================================================================
// dsh-gateway — security gateway for remote DSH access (Paseo-style QR pairing)
// + PWA + device management
//
// Listens on 127.0.0.1:8080:
//   1. Pairing: one-time code (8 chars / 10 min / rate limited) -> device ->
//      long-lived session cookie
//   2. Sessions: HMAC-SHA256 signed (256-bit key / 1 year), per-device and
//      global revocation
//   3. Device admin page: /devices (paired devices only): list, revoke one,
//      issue a new pairing code
//   4. Audit: audit.log records pairing / revocation / rate limiting / invalid
//      sessions (sanitized — no codes or cookie contents)
//   5. Reverse proxy: HTTP and WebSocket passthrough to 127.0.0.1:3080 (DSH)
//   6. PWA: manifest / icons / iOS metadata injected into the index page;
//      /__health returns JSON
//
// Zero third-party dependencies (Node built-ins only).
// Test overrides via env: DSH_REMOTE_DIR, DSH_REMOTE_UPSTREAM(host:port).
// =============================================================================
const http = require('http');
const crypto = require('crypto');
const net = require('net');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFileSync, spawn } = require('node:child_process');

const PORT = Number(process.env.DSH_REMOTE_PORT || 8080);
// Loopback by default. A container must bind 0.0.0.0 for a published port
// to reach it, and the LAN/direct-IP option needs it too; the first-run
// rule below decides what such a caller is allowed to do.
const HOST = process.env.DSH_REMOTE_HOST || '127.0.0.1';
const UPSTREAM = (() => {
  const raw = process.env.DSH_REMOTE_UPSTREAM || '127.0.0.1:3080';
  const i = raw.lastIndexOf(':');
  return { host: raw.slice(0, i), port: Number(raw.slice(i + 1)) };
})();
const DIR = process.env.DSH_REMOTE_DIR || '/opt/dsh-remote';
const KIT_VERSION = process.env.DSH_REMOTE_VERSION || '1.0.0';
const KEY_FILE = path.join(DIR, 'gateway-key');
const CODES_DIR = path.join(DIR, 'codes');
const EPOCH_FILE = path.join(DIR, 'session-epoch');
const DEVICES_FILE = path.join(DIR, 'devices.json');
const ROUTES_FILE = path.join(DIR, 'routes.json'); // optional slug→port sidecar
const AUDIT_FILE = path.join(DIR, 'audit.log');
const TESTMODE_FILE = path.join(DIR, 'testmode');
// Tunnel (cloudflared) state, managed from the in-app Tunnel settings page.
const TUNNEL_LABEL = 'com.dsh-remote.tunnel';
const TOKEN_FILE = path.join(DIR, 'cloudflared.token');
const CF_CONFIG = path.join(DIR, 'cloudflared.yml');
const CF_LOG = path.join(DIR, 'cloudflared.log');
const URL_FILE = path.join(DIR, 'url.txt');
const AGENTS_DIR = path.join(require('node:os').homedir(), 'Library', 'LaunchAgents');
try { fs.mkdirSync(DIR, { recursive: true, mode: 0o700 }); } catch { /* created later if it matters */ }
/** cloudflared needs its config to exist before it will start (even for a quick tunnel). */
function ensureCfConfig() {
  if (fs.existsSync(CF_CONFIG)) return;
  try { fs.writeFileSync(CF_CONFIG, 'protocol: http2\n', { mode: 0o600 }); } catch { /* reported by cloudflared */ }
}
ensureCfConfig();
const CLOUDFLARED_CANDIDATES = [process.env.DSH_REMOTE_CF_BIN, 'cloudflared', '/opt/homebrew/bin/cloudflared', '/usr/local/bin/cloudflared', '/usr/bin/cloudflared'].filter(Boolean);
const WEB_LOG = path.join(DIR, 'web.log');
const WEB_TOKEN_FILE = path.join(DIR, 'web-token');
const TESTMODE_DEVICE_ID = 'de5adbee00f0'; // 12 hex chars (session-cookie format)
function grantLocation(url) {
  const q = new URLSearchParams(url.searchParams);
  q.delete('password');
  return q.toString() ? '/?' + q.toString() : '/';
}
const MOBILE_REV = '105'; // plugin bundles changed (inline icon seat, single 3-dots) // bump to force remote browsers off a cached index (inline mobile layer)
const COOKIE_NAME = 'dsh_session';
const CODE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 365 * 24 * 3600 * 1000;
const MAX_FAILS = 5;
const FAIL_WINDOW_MS = 5 * 60 * 1000;
const LASTSEEN_MIN_MS = 60 * 1000; // persist lastSeen at most once per minute per device
const HOP_HEADERS = new Set(['connection', 'keep-alive', 'proxy-authenticate',
  'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade']);

// ------------------------------------------------------------- key & epoch --
if (!fs.existsSync(KEY_FILE)) {
  fs.writeFileSync(KEY_FILE, crypto.randomBytes(32), { mode: 0o600 });
}
const KEY = fs.readFileSync(KEY_FILE);
if (KEY.length !== 32) { console.error('gateway: gateway-key must be 32 bytes'); process.exit(1); }
if (!fs.existsSync(EPOCH_FILE)) fs.writeFileSync(EPOCH_FILE, '1\n');
function epoch() {
  try { return Number(fs.readFileSync(EPOCH_FILE, 'utf8').trim()) || 0; } catch { return 0; }
}
function hmacHex(s) { return crypto.createHmac('sha256', KEY).update(s).digest('hex'); }

// ------------------------------------------------------------------ devices --
let devicesCache = null; let devicesMtime = 0;
function readDevices() {
  try {
    const st = fs.statSync(DEVICES_FILE);
    if (devicesCache === null || st.mtimeMs !== devicesMtime) {
      devicesCache = JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf8'));
      devicesMtime = st.mtimeMs;
    }
    return devicesCache;
  } catch { return []; }
}
// Optional slug→port route table: {"<slug>": {"port": <port>}}. Read on demand;
// content changes (routes.json) are picked up without a gateway restart.
let routesCache = null, routesMtime = 0;
function readRoutes() {
  try {
    const st = fs.statSync(ROUTES_FILE);
    if (routesCache === null || st.mtimeMs !== routesMtime) {
      routesCache = JSON.parse(fs.readFileSync(ROUTES_FILE, 'utf8'));
      routesMtime = st.mtimeMs;
    }
    return routesCache;
  } catch { return {}; }
}
function writeDevices(list) {
  fs.writeFileSync(DEVICES_FILE, JSON.stringify(list, null, 2));
  devicesCache = list; devicesMtime = fs.statSync(DEVICES_FILE).mtimeMs;
}
function addDevice(label) {
  const list = readDevices();
  const dev = {
    id: crypto.randomBytes(6).toString('hex'),
    label: String(label || 'Device').slice(0, 32) || 'Device',
    created: Date.now(), lastSeen: Date.now(), active: true,
  };
  list.push(dev);
  writeDevices(list);
  return dev;
}
function touchDevice(id) {
  const list = readDevices();
  const dev = list.find((d) => d.id === id);
  if (!dev) return;
  if (Date.now() - dev.lastSeen < LASTSEEN_MIN_MS) return;
  dev.lastSeen = Date.now();
  writeDevices(list);
}
function deviceActive(id) {
  return readDevices().some((d) => d.id === id && d.active === true);
}

// ------------------------------------------------------------- test mode --
// When DIR/testmode exists (contents = the URL password), a ?password=... request
// grants a session for the synthetic 'testmode' device — pairing not required.
// Read on demand like devices.json, so toggling needs no gateway restart.
let testCache = null, testMtime = 0;
function readTestmode() {
  try {
    const st = fs.statSync(TESTMODE_FILE);
    if (testCache === null || st.mtimeMs !== testMtime) {
      const raw = fs.readFileSync(TESTMODE_FILE, 'utf8').trim();
      testCache = raw.length > 0 ? { password: raw } : null;
      testMtime = st.mtimeMs;
    }
    return testCache;
  } catch { testCache = null; return null; }
}
function testPasswordOk(req) {
  const tm = readTestmode();
  if (tm === null) return false;
  const pw = new URL(req.url, 'http://gateway.local').searchParams.get('password');
  if (typeof pw !== 'string' || pw.length === 0 || pw.length !== tm.password.length) return false;
  return crypto.timingSafeEqual(Buffer.from(pw), Buffer.from(tm.password));
}
function ensureTestmodeDevice() {
  const list = readDevices();
  const dev = list.find((d) => d.id === TESTMODE_DEVICE_ID);
  if (dev) { if (!dev.active) { dev.active = true; writeDevices(list); } return; }
  list.push({ id: TESTMODE_DEVICE_ID, label: 'Test mode (URL password)', created: Date.now(), lastSeen: Date.now(), active: true });
  writeDevices(list);
}

// ------------------------------------------------------------------- audit ---
function audit(event, extra) {
  try {
    fs.appendFileSync(AUDIT_FILE, JSON.stringify({ ts: Date.now(), event, ...extra }) + '\n');
  } catch { /* audit failure must never break the gate */ }
}

// ------------------------------------------------------------------ session --
function makeCookie(deviceId) {
  const exp = Date.now() + SESSION_TTL_MS;
  const rnd = crypto.randomBytes(12).toString('hex');
  const ep = epoch();
  const payload = `${exp}.${rnd}.${ep}.${deviceId}`;
  return `${payload}.${hmacHex(payload)}`;
}
function verifyCookie(raw) {
  let val = '';
  for (const part of String(raw || '').split(';')) {
    const t = part.trim();
    if (t.startsWith(COOKIE_NAME + '=')) { val = t.slice(COOKIE_NAME.length + 1); break; }
  }
  if (!val) return { ok: false };
  const m = /^(\d+)\.([0-9a-f]{24})\.(\d+)\.([0-9a-f]{12})\.([0-9a-f]{64})$/.exec(val);
  if (!m) return { ok: false };
  const [, exp, rnd, ep, deviceId, sig] = m;
  if (Date.now() > Number(exp)) return { ok: false };
  if (Number(ep) !== epoch()) return { ok: false };
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(hmacHex(`${exp}.${rnd}.${ep}.${deviceId}`), 'hex');
  if (!(a.length === b.length && crypto.timingSafeEqual(a, b))) return { ok: false };
  if (!deviceActive(deviceId)) return { ok: false, revoked: deviceId };
  touchDevice(deviceId);
  return { ok: true, deviceId };
}
function cookieHeader(deviceId, forwardedProto) {
  // Add Secure over the HTTPS tunnel (defense in depth: the browser will not send the cookie over plain HTTP)
  const secure = String(forwardedProto || '').toLowerCase().startsWith('https') ? '; Secure' : '';
  return `${COOKIE_NAME}=${makeCookie(deviceId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`;
}

// ------------------------------------------------------------- qr codes ------
// Optional: `qrencode` renders an invite link as a scannable PNG data URI for
// the in-app Pairing page (the CLI's --qr uses the same binary). Without it the
// page simply shows the code and the link instead of a QR.
let qrBinary;
function qrBinaryPath() {
  if (qrBinary !== undefined) return qrBinary;
  for (const candidate of ['qrencode', '/opt/homebrew/bin/qrencode', '/usr/local/bin/qrencode', '/usr/bin/qrencode']) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore' });
      qrBinary = candidate;
      return qrBinary;
    } catch { /* not here — try the next path */ }
  }
  qrBinary = null;
  return qrBinary;
}
function qrDataUri(text) {
  const bin = qrBinaryPath();
  if (bin === null) return null;
  try {
    // 10 px per module: 390x390 for a version-4 code, crisp at 2x on a phone.
    // PNG32 with a fully transparent background so the code can sit on the
    // page's own panel instead of a white square (the 3-module quiet zone is
    // transparent too, which keeps the rounded corners clear of the modules).
    const png = execFileSync(bin, ['-t', 'PNG32', '-s', '10', '-l', 'M', '-m', '3', '--background=FFFFFF00', '-o', '-', '--', text], { maxBuffer: 4 * 1024 * 1024 });
    return png.length > 0 ? 'data:image/png;base64,' + png.toString('base64') : null;
  } catch { return null; }
}

// ------------------------------------------------------------- tunnel --------
// The cloudflared connector is a launchd service (com.dsh-remote.tunnel) that
// forwards a Cloudflare hostname to this gateway. These helpers back the in-app
// Tunnel settings page: read the connector's state from launchctl + its log, and
// write the token/protocol it needs. Every caller is behind a paired session.
let cloudflaredBinary;
function cloudflaredBinaryPath() {
  if (cloudflaredBinary !== undefined) return cloudflaredBinary;
  for (const candidate of CLOUDFLARED_CANDIDATES) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore' });
      cloudflaredBinary = candidate;
      return cloudflaredBinary;
    } catch { /* not here — try the next path */ }
  }
  cloudflaredBinary = null;
  return cloudflaredBinary;
}
/** Run a command, capturing stdout+stderr; never throws. */
function capture(cmd, args) {
  try {
    return { ok: true, out: String(execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 }) || '') };
  } catch (error) {
    const out = error && (error.stdout || error.message);
    return { ok: false, out: String(out || '') };
  }
}
function readIfExists(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
}
function launchctlTarget() { return `gui/${process.getuid()}/${TUNNEL_LABEL}`; }
function launchctlService() {
  const printed = capture('/bin/launchctl', ['print', launchctlTarget()]);
  if (!printed.ok) return { loaded: false, state: 'not loaded', pid: null };
  const state = /state = ([^\n]+)/.exec(printed.out);
  const pid = /pid = (\d+)/.exec(printed.out);
  return { loaded: true, state: state ? state[1].trim() : 'unknown', pid: pid ? Number(pid[1]) : null };
}
/** The token is a base64 JSON blob; its `t` field names the tunnel (not a secret). */
function tunnelToken() {
  const raw = readIfExists(TOKEN_FILE);
  if (raw === null || raw.trim() === '') return { configured: false };
  const trimmed = raw.trim();
  let tunnelId = null;
  try {
    const decoded = JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'));
    if (decoded && typeof decoded.t === 'string') tunnelId = decoded.t;
  } catch { /* not the expected shape — still usable by cloudflared */ }
  return { configured: true, tunnelId };
}
function tunnelProtocol() {
  const config = readIfExists(CF_CONFIG);
  const match = config === null ? null : /protocol:\s*([a-z0-9]+)/i.exec(config);
  return match ? match[1].toLowerCase() : 'auto';
}
/** Latest registration per connector slot, plus the most recent error line. */
function tunnelLog() {
  const full = readIfExists(CF_LOG);
  if (full === null) return { connections: [], lastError: null };
  // Connections belong to a *running* connector: replaying an earlier run's log
  // made the page claim "4 connections" next to a connector that was stopped.
  const running = cfChildRunning();
  const log = running && cfLogOffset > 0 && cfLogOffset < full.length ? full.slice(cfLogOffset) : full;
  const slots = new Map();
  let lastError = null;
  for (const line of log.split('\n').slice(-600)) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (entry.message === 'Registered tunnel connection' && !running) {
      // keep lastError, ignore connections from a stopped connector
    } else if (entry.message === 'Registered tunnel connection') {
      slots.set(entry.connIndex, { index: entry.connIndex, location: entry.location, protocol: entry.protocol, time: entry.time });
    } else if (entry.message === 'Unregistered tunnel connection') {
      slots.delete(entry.connIndex);
    } else if (entry.level === 'error') {
      lastError = { time: entry.time, message: entry.message, detail: entry.error || null };
    }
  }
  return { connections: [...slots.values()].sort((a, b) => a.index - b.index), lastError };
}
function tunnelUrl() {
  const full = readIfExists(CF_LOG);
  const log = full === null ? null : (cfLogOffset > 0 && cfLogOffset < full.length ? full.slice(cfLogOffset) : full);
  const quickInLog = log === null ? null : (log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g) || []).pop() || null;
  // A running quick tunnel owns the answer: its hostname only exists in the log
  // (and changes every start). url.txt is the box's own record of how it is
  // reached, so it must not shadow a live quick tunnel.
  if (tunnelMode() === 'quick') {
    // A quick tunnel's hostname belongs to THIS run only. Until its banner shows
    // up in the log there is no URL — falling back to url.txt (written by an
    // earlier run) is what made the page show a dead hostname that 530'd.
    return quickInLog;
  }
  const stored = readIfExists(URL_FILE);
  const storedIsQuick = stored !== null && stored.indexOf('trycloudflare.com') !== -1;
  if (stored !== null && stored.trim() !== '' && !(storedIsQuick && tunnelMode() !== 'quick')) return stored.trim();
  if (quickInLog !== null && tunnelMode() === 'quick') return quickInLog;
  if (log === null) return null;
  const hostname = /hostname\\":\\"([^\\"]+)/.exec(log);
  return hostname ? `https://${hostname[1]}` : null;
}
/**
 * Who owns the connector on this host. macOS has the launchd job the kit
 * installs; everywhere else (a Linux box, a container) the gateway supervises
 * cloudflared itself, so the Tunnel page works without systemd/launchd.
 */
function tunnelManagedBy() {
  // An embedder (the desktop app) can own the connector itself even where a
  // launchd job exists — otherwise it would fight the CLI install's tunnel.
  const forced = process.env.DSH_REMOTE_TUNNEL_MANAGED;
  if (forced === 'gateway' || forced === 'launchd') return forced;
  if (process.platform === 'darwin' && fs.existsSync(path.join(AGENTS_DIR, `${TUNNEL_LABEL}.plist`))) return 'launchd';
  return 'gateway';
}
/** What kind of tunnel is in play: a named one (token), a quick one, or none. */
function tunnelMode() {
  if (cfChildRunning()) return cfMode || (tunnelToken().configured ? 'named' : 'quick');
  if (tunnelToken().configured) return 'named';
  return 'none';
}
/** The child cloudflared the gateway supervises (non-launchd hosts). */
let cfChild = null;
/** Byte offset of the connector log when the current child started: a quick
 *  tunnel's hostname must come from THIS run, never from a previous one. */
let cfLogOffset = 0;
/** Which mode the running child is in ('quick' or 'named'), null when none. */
let cfMode = null;
/** When the running child started — a fresh quick hostname is not routable yet. */
let cfStartedAt = 0;
const CF_PID_FILE = path.join(DIR, 'cloudflared.pid');
function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 1) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error !== null && error.code === 'EPERM'; }
}
function readCfPid() {
  const raw = readIfExists(CF_PID_FILE);
  const pid = raw === null ? NaN : Number(raw.trim());
  return Number.isInteger(pid) ? pid : null;
}
/**
 * Is a connector running? The in-memory child is the fast path, but it is not
 * the whole truth: a previous start's exit handler can fire late and clear the
 * reference (that made the page say "stopped" while cloudflared ran), and a
 * gateway restart loses the handle entirely. The pid file covers both — we adopt
 * whatever is still alive.
 */
function cfChildRunning() {
  if (cfChild !== null && cfChild.exitCode === null && cfChild.signalCode === null) return true;
  const pid = readCfPid();
  if (pid !== null && pidAlive(pid)) return true;
  if (pid !== null) { try { fs.unlinkSync(CF_PID_FILE); } catch { /* nothing to clean */ } }
  return false;
}
/** The pid of the connector actually running, from memory or the pid file. */
function cfRunningPid() {
  if (cfChild !== null && cfChild.exitCode === null && cfChild.signalCode === null) return cfChild.pid;
  const pid = readCfPid();
  return pid !== null && pidAlive(pid) ? pid : null;
}
function stopGatewayTunnel() {
  const pid = cfRunningPid();
  const had = pid !== null;
  if (cfChild !== null) { try { cfChild.kill('SIGTERM'); } catch { /* already gone */ } }
  if (pid !== null && pidAlive(pid)) { try { process.kill(pid, 'SIGTERM'); } catch { /* raced */ } }
  cfChild = null;
  cfMode = null;
  try { fs.unlinkSync(CF_PID_FILE); } catch { /* nothing to clean */ }
  return had;
}
/**
 * Start cloudflared as a gateway child. `quick` needs no account (`--url` only,
 * which yields a random *.trycloudflare.com hostname); otherwise the named
 * tunnel uses the stored token.
 */
function startGatewayTunnel(mode) {
  ensureCfConfig();
  const binary = cloudflaredAbsolutePath();
  if (binary === null) return { ok: false, error: 'cloudflared is not installed on this host' };
  stopGatewayTunnel();
  let fd;
  try { fd = fs.openSync(CF_LOG, 'a'); } catch { fd = 'ignore'; }
  // Everything already in the log belongs to an earlier run.
  try { cfLogOffset = fs.statSync(CF_LOG).size; } catch { cfLogOffset = 0; }
  const args = ['--config', CF_CONFIG, '--logfile', CF_LOG, 'tunnel', '--no-autoupdate'];
  if (mode === 'quick') {
    // Quick mode simply does not pass the token: the stored named-tunnel token is
    // left alone, so switching back is one click (deleting it here would break a
    // working named tunnel like svlm1.abslm.nl).
    args.push('--url', 'http://127.0.0.1:8080');
    // Drop a stale quick hostname so nothing (invite links included) can point at
    // the previous run's dead tunnel.
    const storedUrl = readIfExists(URL_FILE);
    if (storedUrl !== null && storedUrl.indexOf('trycloudflare.com') !== -1) {
      try { fs.unlinkSync(URL_FILE); } catch { /* non-fatal */ }
    }
  } else {
    args.push('run', '--token-file', TOKEN_FILE, '--url', 'http://127.0.0.1:8080');
  }
  try {
    cfChild = spawn(binary, args, { stdio: ['ignore', fd, fd], detached: false });
  } catch (error) {
    return { ok: false, error: String((error && error.message) || error) };
  }
  cfMode = mode;
  cfStartedAt = Date.now();
  const launched = cfChild;
  try { fs.writeFileSync(CF_PID_FILE, String(launched.pid)); } catch { /* pid file is an optimisation */ }
  launched.on('exit', () => {
    // Only the CURRENT child may clear the state: a previous start's handler used
    // to fire after a restart and report "stopped" over a running connector.
    if (cfChild === launched) { cfChild = null; cfMode = null; }
    try { if (readCfPid() === launched.pid) fs.unlinkSync(CF_PID_FILE); } catch { /* fine */ }
  });
  return { ok: true };
}
/** Last lines of the connector log, for the page's log panel. */
function tunnelLogTail(lines = 14) {
  const log = readIfExists(CF_LOG);
  if (log === null) return [];
  return log.split('\n').filter((line) => line.trim() !== '').slice(-lines).map((line) => {
    try {
      const entry = JSON.parse(line);
      return `${entry.time || ''} ${(entry.level || '').toUpperCase()} ${entry.message || ''}`.trim();
    } catch {
      return line;
    }
  });
}

/** The last `bytes` of a file, or "" — enough for log-tail regexes. */
function readLogTail(file, bytes) {
  try {
    const stat = fs.statSync(file);
    const start = Math.max(0, stat.size - bytes);
    const fd = fs.openSync(file, 'r');
    try {
      const buffer = Buffer.alloc(Math.min(bytes, stat.size));
      fs.readSync(fd, buffer, 0, buffer.length, start);
      return buffer.toString('utf8');
    } finally { fs.closeSync(fd); }
  } catch { return ''; }
}

/**
 * The public hostname a named (token) tunnel is serving.
 *
 * cloudflared logs its configuration once per run ("Updated to new
 * configuration"), so a small tail misses it as soon as the log grows — that is
 * why the page kept showing a loopback URL. Read a generous window, remember the
 * answer per token, and keep the last known one if the log rolls out from under us.
 */
let namedUrlCache = null;
let namedUrlToken = null;
function namedTunnelUrl() {
  const token = (tunnelToken().value || '').slice(-24);
  if (namedUrlCache !== null && namedUrlToken === token) return namedUrlCache;
  try {
    for (const window of [2 * 1024 * 1024, 16 * 1024 * 1024]) {
      const log = readLogTail(CF_LOG, window);
      const hits = log.match(/hostname\\":\\"([^\\"]+)/g);
      if (hits && hits.length) {
        const last = hits[hits.length - 1].match(/hostname\\":\\"([^\\"]+)/);
        if (last && last[1]) {
          namedUrlCache = 'https://' + last[1];
          namedUrlToken = token;
          return namedUrlCache;
        }
      }
      if (log.length < window) break;
    }
  } catch { /* no log yet */ }
  return namedUrlCache;
}

function tunnelStatus() {
  const binary = cloudflaredBinaryPath();
  const version = binary === null ? null : (capture(binary, ['--version']).out || '').trim().split('\n')[0];
  const { connections, lastError } = tunnelLog();
  const managedBy = tunnelMode() === 'quick' ? 'gateway' : tunnelManagedBy();
  const quickUrl = tunnelUrl();
  // A quick tunnel's hostname only exists in its log; a named one's lives in the
  // connector log. Persist whichever is live so invite links, the pairing QR and
  // the dashboard all point at the public URL instead of a loopback address.
  const namedUrl = tunnelMode() === 'named' ? namedTunnelUrl() : null;
  const publicUrl = quickUrl !== null ? quickUrl : namedUrl;
  if (publicUrl !== null && readIfExists(URL_FILE) !== publicUrl) {
    try { fs.writeFileSync(URL_FILE, publicUrl); } catch { /* non-fatal */ }
  }
  return {
    ok: true,
    url: publicUrl,
    mode: tunnelMode(),
    since: cfChildRunning() ? cfStartedAt : null,
    managedBy,
    protocol: tunnelProtocol(),
    token: tunnelToken(),
    cloudflared: {
      installed: binary !== null,
      version,
      installHint: process.platform === 'darwin'
        ? 'brew install cloudflared'
        : 'apt-get install -y cloudflared   # or: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/',
    },
    service: Object.assign({
      label: TUNNEL_LABEL,
      managedBy,
      plistInstalled: fs.existsSync(path.join(AGENTS_DIR, `${TUNNEL_LABEL}.plist`)),
      running: managedBy === 'gateway' ? cfChildRunning() : undefined,
    }, managedBy === 'launchd' ? launchctlService() : { loaded: cfChildRunning(), state: cfChildRunning() ? 'running' : 'stopped', pid: cfRunningPid() }),
    connections,
    lastError,
    log: tunnelLogTail(),
  };
}
/**
 * launchd spawns ProgramArguments[0] directly and never searches PATH, so a bare
 * `cloudflared` produces a job stuck in "spawn scheduled" — the path must be
 * absolute.
 */
function cloudflaredAbsolutePath() {
  for (const candidate of CLOUDFLARED_CANDIDATES) {
    if (candidate.startsWith('/') && fs.existsSync(candidate)) return candidate;
  }
  const resolved = cloudflaredBinaryPath();
  if (resolved !== null && resolved.startsWith('/')) return resolved;
  const which = capture('/usr/bin/which', ['cloudflared']).out.trim();
  return which.startsWith('/') ? which : '/opt/homebrew/bin/cloudflared';
}
/** Last non-empty line of a command's output, for a one-line error message. */
function lastLine(text) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter((l) => l !== '');
  return lines.length > 0 ? lines[lines.length - 1] : 'unknown error';
}
/** The connector's launchd job, written for THIS install's paths. */
function tunnelPlistXml() {
  const binary = cloudflaredAbsolutePath();
  const args = [
    binary,
    '--config', CF_CONFIG,
    '--logfile', CF_LOG,
    'tunnel', '--no-autoupdate', 'run',
    '--token-file', TOKEN_FILE,
    '--url', 'http://127.0.0.1:8080',
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${TUNNEL_LABEL}</string>
  <key>ProgramArguments</key><array>
${args.map((a) => `    <string>${a}</string>`).join('\n')}
  </array>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${path.join(DIR, 'tunnel.log')}</string>
  <key>StandardErrorPath</key><string>${path.join(DIR, 'tunnel.log')}</string>
</dict></plist>
`;
}
/** Install/refresh the connector job and (re)start it. Returns a status line. */
function applyTunnelService(preferMode) {
  if (!fs.existsSync(CF_CONFIG)) fs.writeFileSync(CF_CONFIG, 'protocol: http2\n', { mode: 0o600 });
  if (tunnelManagedBy() === 'gateway') {
    // No launchd (Linux box / container): the gateway runs the connector itself.
    // Restart must PRESERVE the mode that was running — forcing 'named' with no
    // token saved just started a connector that immediately exited. A caller can
    // also name the mode it wants (the page's "Start" asks for the stored token).
    const mode = (preferMode === 'named' || preferMode === 'quick') ? preferMode
      : cfMode || (fs.existsSync(TOKEN_FILE) ? 'named' : 'quick');
    const started = startGatewayTunnel(mode);
    return started.ok ? `connector started (${mode})` : started.error;
  }
  fs.mkdirSync(AGENTS_DIR, { recursive: true });
  const target = path.join(AGENTS_DIR, `${TUNNEL_LABEL}.plist`);
  const xml = tunnelPlistXml();
  // Compare ignoring whitespace between tags: a re-formatting is not a reason to
  // tear the running job down.
  const normalize = (text) => (text === null ? null : text.replace(/>\s+</g, '><').trim());
  const loaded = () => capture('/bin/launchctl', ['print', launchctlTarget()]).ok;
  if (normalize(readIfExists(target)) !== normalize(xml)) {
    fs.writeFileSync(target, xml);
    if (loaded()) {
      capture('/bin/launchctl', ['bootout', launchctlTarget()]);
      // Wait for the job to actually leave the domain: bootstrapping too early
      // fails with a bare "Input/output error".
      for (let i = 0; i < 12 && loaded(); i++) capture('/bin/sleep', ['0.5']);
    }
  }
  if (!loaded()) {
    let boot = capture('/bin/launchctl', ['bootstrap', `gui/${process.getuid()}`, target]);
    if (!boot.ok) {
      capture('/bin/sleep', ['1']);
      boot = capture('/bin/launchctl', ['bootstrap', `gui/${process.getuid()}`, target]);
    }
    if (!boot.ok) return `could not load the launchd job: ${lastLine(boot.out)}`;
    return 'connector installed and started';
  }
  const kick = capture('/bin/launchctl', ['kickstart', '-k', launchctlTarget()]);
  return kick.ok ? 'connector restarted' : `could not restart the connector: ${lastLine(kick.out)}`;
}
function writeTunnelToken(token) {
  fs.writeFileSync(TOKEN_FILE, `${token.trim()}\n`, { mode: 0o600 });
  try { fs.chmodSync(TOKEN_FILE, 0o600); } catch { /* best effort */ }
}
function writeTunnelProtocol(protocol) {
  fs.writeFileSync(CF_CONFIG, `protocol: ${protocol}\n`, { mode: 0o600 });
}

// ---------------------------------------------------------------- codes ------
function codeHash(code) {
  return crypto.createHash('sha256').update(String(code).toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex');
}
function consumeCode(code) {
  const file = path.join(CODES_DIR, codeHash(code) + '.code');
  try {
    const exp = Number(fs.readFileSync(file, 'utf8').trim());
    if (Date.now() > exp) { fs.unlinkSync(file); return false; }
    fs.unlinkSync(file);
    return true;
  } catch { return false; }
}

// ------------------------------------------------------------- rate limiting --
const fails = new Map();
const throttled = new Map(); // ip -> last audit ts (invalid-cookie audit throttling)
// Real client IP: the gateway binds loopback only, so the only thing that can connect is the local cloudflared; the Cloudflare
// edge writes the real IP into CF-Connecting-IP before forwarding to loopback, so the header is trustworthy (otherwise every remote
// request would appear as 127.0.0.1 and per-IP rate limiting and auditing would be useless). Falls back to the socket address for direct local debugging.
function clientIp(req) {
  const raw = req.headers['cf-connecting-ip'];
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v === 'string' && v !== '' && /^[0-9a-fA-F:.]{7,45}$/.test(v)) return v;
  return req.socket.remoteAddress || 'unknown';
}
function tooManyFails(ip) {
  const rec = fails.get(ip);
  return !!rec && (Date.now() - rec.ts < FAIL_WINDOW_MS) && rec.n >= MAX_FAILS;
}
function recordFail(ip) {
  const now = Date.now();
  const rec = fails.get(ip);
  if (!rec || now - rec.ts >= FAIL_WINDOW_MS) {
    if (fails.size > 4096) { // bound the table: a public IP space must not grow it without limit
      for (const key of fails.keys()) {
        const r = fails.get(key);
        if (!r || now - r.ts >= FAIL_WINDOW_MS) fails.delete(key);
        if (fails.size <= 2048) break;
      }
    }
    fails.set(ip, { ts: now, n: 1 });
  } else rec.n++;
}
function clearFails(ip) { fails.delete(ip); }

// ------------------------------------------------------------- page shell ---
// Every browser-facing gateway page (first-run/pairing, devices, new code) uses
// this shell: the app's settings design language, in light AND dark, following
// the system preference. The QR is transparent, so it sits in a white rounded
// box that keeps it scannable on a dark card.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PAGE_STYLE = `
:root{color-scheme:light dark;
  --bg:#f4f5f7;--card:#ffffff;--line:rgba(0,0,0,.10);--line-strong:rgba(0,0,0,.18);
  --text:#0f1115;--text-2:#61666b;--text-3:#81858c;--fill:#f2f3f5;
  --btn:#0f1115;--btn-text:#ffffff;--danger:#c0392b;--ok:#1a7f4b;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root{
  --bg:#0e0e10;--card:#1a1a1d;--line:rgba(255,255,255,.10);--line-strong:rgba(255,255,255,.20);
  --text:#f9fafb;--text-2:#cfd3d6;--text-3:#adb2b8;--fill:#232327;
  --btn:#f9fafb;--btn-text:#0f1115;--danger:#ff7b72;--ok:#3fb950}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:var(--bg);color:var(--text);
  font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;
  display:flex;align-items:center;justify-content:center;padding:24px}
.wrap{width:100%;max-width:440px}
.brand{background:var(--btn);color:var(--btn-text);border-radius:0;padding:4px 9px;font-size:16px;
  font-weight:600;letter-spacing:.08em;line-height:20px;width:fit-content;margin:0 auto 16px}
.card{background:var(--card);border:.5px solid var(--line);border-radius:16px;padding:20px}
.card+.card{margin-top:12px}
h1{font-size:18px;font-weight:600;line-height:26px;margin:0 0 6px}
p{color:var(--text-2);font-size:14px;line-height:22px;margin:0 0 14px}
p:last-child{margin-bottom:0}
b{color:var(--text);font-weight:600}
label{display:block;color:var(--text-2);font-size:12px;font-weight:500;line-height:18px;margin:0 0 6px}
input{width:100%;background:var(--card);border:.5px solid var(--line-strong);border-radius:8px;
  color:var(--text);font:inherit;padding:8px 10px;outline:none}
input:focus{border-color:var(--text-3)}
input[readonly]{background:var(--fill);color:var(--text-2);font-family:var(--mono);font-size:12px}
input.code{font-family:var(--mono);font-size:20px;letter-spacing:6px;text-align:center;text-transform:uppercase;padding:12px 10px}
button{font:inherit;cursor:pointer;border:none;border-radius:18px;height:36px;padding:0 16px;font-size:14px;line-height:22px}
button.primary{background:var(--btn);color:var(--btn-text);width:100%}
button.secondary{background:transparent;border:.5px solid var(--line-strong);color:var(--text)}
button.small{height:28px;border-radius:14px;padding:0 10px;font-size:12px;line-height:18px}
button:disabled{opacity:.4;cursor:default}
.row{display:flex;gap:8px;align-items:center}
.row>input{flex:1;min-width:0}
.row>button{flex:none;width:auto}
.code{font-family:var(--mono);font-size:24px;font-weight:600;letter-spacing:5px;text-align:center;margin:12px 0}
.qrbox{background:#fff;border-radius:14px;padding:8px;width:fit-content;margin:2px auto 12px}
.qr{display:block;width:180px;height:180px}
.steps{color:var(--text-3);font-size:12px;line-height:18px;margin:0 0 14px;padding-left:18px}
.steps li{margin:4px 0}
.hint{color:var(--text-3);font-size:12px;line-height:18px;margin:12px 0 0}
.err{color:var(--danger);font-size:12px;line-height:18px;margin:10px 0 0;min-height:18px}
.ok{color:var(--ok)}
code{font-family:var(--mono);font-size:12px}
a{color:var(--text)}
table{width:100%;border-collapse:collapse;font-size:13px;margin:4px 0 0}
th,td{text-align:left;padding:8px 6px;border-bottom:.5px solid var(--line)}
th{color:var(--text-3);font-weight:500;font-size:12px}
td:last-child,th:last-child{text-align:right}
form{margin:0}
`;
const COPY_SCRIPT = `
function copyText(t,btn){
  var done=function(){ if(!btn) return; var old=btn.textContent; btn.textContent='Copied'; setTimeout(function(){btn.textContent=old;},1400); };
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(done,function(){});return;}
  var f=document.getElementById('link'); if(f){f.focus();f.select();try{document.execCommand('copy');done();}catch(e){}}
}
`;
function pageShell(title, body, script) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${PAGE_STYLE}</style>
</head><body><div class="wrap"><div class="brand">gnts.dev</div>${body}</div>
<script>${COPY_SCRIPT}${script || ''}</script>
</body></html>`;
}
/** Read the public hostname for invite links, without recursing into status. */
function publicUrl() {
  const stored = readIfExists(URL_FILE);
  return stored !== null && stored.trim() !== '' ? stored.trim() : '';
}
/** Mint a one-time pairing code (10 minutes, single use) and prune stale ones. */
function mintPairingCode() {
  // A fresh install has no state dir yet (a container's volume starts empty), and
  // writing a code into a missing directory used to kill the whole process.
  try { fs.mkdirSync(CODES_DIR, { recursive: true, mode: 0o700 }); } catch { /* reported by the write below */ }
  try {
    for (const name of fs.readdirSync(CODES_DIR)) {
      if (!name.endsWith('.code')) continue;
      try {
        const file = path.join(CODES_DIR, name);
        if (Number(fs.readFileSync(file, 'utf8').trim()) < Date.now()) fs.unlinkSync(file);
      } catch { /* unreadable entry — leave it */ }
    }
  } catch { /* no codes dir yet */ }
  const code = Array.from(crypto.randomBytes(8)).map((b) => CODE_ALPHABET[b % 32]).join('');
  fs.writeFileSync(path.join(CODES_DIR, codeHash(code) + '.code'), String(Date.now() + CODE_TTL_MS));
  return code;
}
/** True when the request came straight from this machine (never through the tunnel). */
function isLocalRequest(req) {
  // Any request that came through a proxy is the public path, whatever address
  // the proxy itself dialled from: Cloudflare sets CF-Connecting-IP, a hosted
  // box's edge sets X-Forwarded-For / X-Real-IP / X-Gnts-Edge. A remote visitor
  // must never trigger a code — and a shared edge lives in a private range, so
  // the address check alone would wrongly call it local.
  for (const header of ['cf-connecting-ip', 'x-forwarded-for', 'x-real-ip', 'x-gnts-edge', 'forwarded']) {
    if (req.headers[header] !== undefined) return false;
  }
  let addr = String(req.socket.remoteAddress || '');
  if (addr.startsWith('::ffff:')) addr = addr.slice(7);
  if (addr === '127.0.0.1' || addr === '::1') return true;
  // Loopback-only is too strict for the ways a box is actually reached: a
  // published container port arrives from the docker bridge (172.17.x), a VM
  // from its host bridge (192.168.x / 10.x), a LAN client from its own subnet.
  // All of those mean "you already have local access to this machine", which is
  // what the first-run page needs — and a fresh box has no devices to leak.
  if (/^10\./.test(addr) || /^192\.168\./.test(addr)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(addr)) return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(addr)) return true; // IPv6 unique-local
  return false;
}
/** The code entry form, shared by the first-run and normal pairing states. */
function codeForm(autofocus) {
  return `<form method="post" action="/login" autocomplete="off">
    <label for="c">Pairing code</label>
    <input class="code" id="c" name="code" placeholder="XXXXXXXX" maxlength="10" autocapitalize="characters"${autofocus ? ' autofocus' : ''}>
    <div style="height:10px"></div>
    <label for="n">Device name <span style="font-weight:400">(optional)</span></label>
    <input id="n" name="label" placeholder="iPhone" maxlength="32">
    <div style="height:14px"></div>
    <button class="primary" type="submit">Connect</button>
  </form>`;
}
/**
 * The gateway's sign-in page. Three states:
 *  - first run, reached from this machine: mint a code and show it with a QR, so
 *    a brand-new install can be connected without touching a terminal;
 *  - first run, reached remotely: explain the one command to run on the host;
 *  - already paired before: plain code entry for the next device.
 */
function loginPage(opts) {
  const firstRun = opts.firstRun === true;
  const code = opts.code || null;
  const grouped = code === null ? '' : code.replace(/(.{4})/, '$1-');
  const invite = code === null ? '' : `${opts.url || ''}?code=${code}&label=${encodeURIComponent(opts.label || 'First device')}`;
  const qr = invite === '' ? null : qrDataUri(invite);
  const bad = opts.bad === true ? '<p class="err">Invalid or expired code \u2014 request a new one.</p>' : '';

  if (firstRun && code !== null) {
    return pageShell('Connect your first device', `<div class="card">
  <h1>Connect your first device</h1>
  <p>Scan this with your phone, or pair this browser. The code works once and expires in 10 minutes.</p>
  ${qr === null ? '' : `<div class="qrbox"><img class="qr" src="${qr}" alt="Pairing QR code" width="180" height="180"></div>`}
  <div class="code">${escapeHtml(grouped)}</div>
  <label for="link">Invite link</label>
  <div class="row"><input id="link" readonly value="${escapeHtml(invite)}"><button class="secondary" type="button" onclick="copyText(document.getElementById('link').value,this)">Copy</button></div>
  <form method="post" action="/login" style="margin-top:14px">
    <input type="hidden" name="code" value="${escapeHtml(code)}">
    <input type="hidden" name="label" value="${escapeHtml(opts.label || 'First device')}">
    <button class="primary" type="submit">Pair this browser</button>
  </form>
</div>`);
  }

  if (firstRun) {
    return pageShell('Connect your first device', `<div class="card">
  <h1>Connect your first device</h1>
  <p>This harness has no paired devices yet, so there is nothing to sign in with.</p>
  <ol class="steps">
    <li>On the machine running the harness, run <code>dsh-remote pair</code>.</li>
    <li>It prints a pairing code and a QR for the new device.</li>
    <li>Scan the QR, open the invite link, or type the code below.</li>
  </ol>
  ${codeForm(true)}
  ${bad}
</div>`);
  }

  return pageShell('Pair this device', `<div class="card">
  <h1>Pair this device</h1>
  <p>Enter the pairing code from <code>dsh-remote pair</code>, or open the invite link on this device.</p>
  ${codeForm(true)}
  ${bad}
</div>`);
}

// ------------------------------------------------------------ devices page ---
/** Paired-device admin, restyled to match the in-app Settings pages. */
function devicesPage(url, devices) {
  const active = devices.filter((d) => d.active !== false);
  const rows = active.map((d) => `<tr>
      <td>${escapeHtml(d.label)}</td>
      <td><code>${escapeHtml(d.id)}</code></td>
      <td>${new Date(d.lastSeen || Date.now()).toLocaleString()}</td>
      <td><form method="post" action="/devices/revoke"><input type="hidden" name="id" value="${escapeHtml(d.id)}"><button class="secondary small" type="submit">Revoke</button></form></td>
    </tr>`).join('');
  return pageShell('Devices', `<div class="card">
  <h1>Devices</h1>
  <p>Paired devices on this harness. Opening this page means you are one of them.</p>
  <table>
    <tr><th>Name</th><th>ID</th><th>Last seen</th><th></th></tr>
    ${rows || '<tr><td colspan="4" style="color:var(--text-3)">No paired devices yet</td></tr>'}
  </table>
  <p class="hint">Revoking a device takes effect immediately. URL: <code>${escapeHtml(url)}</code></p>
</div>
<div class="card">
  <h1>Add a device</h1>
  <p>Generate a one-time code (10 minutes, single use) for a phone or another computer.</p>
  <form method="post" action="/devices/newcode">
    <label for="label">Device name</label>
    <div class="row">
      <input id="label" name="label" placeholder="iPhone" maxlength="32">
      <button class="primary" type="submit">Generate code</button>
    </div>
  </form>
</div>`);
}
/** The freshly minted code, with the same QR the in-app Pairing page shows. */
function newcodePage(code, label, invite, qr) {
  return pageShell('Pairing code', `<div class="card">
  <h1>Pairing code for a new device</h1>
  <p>Device: <b>${escapeHtml(label)}</b> \u00b7 valid for 10 minutes, single use.</p>
  ${qr === null ? '' : `<div class="qrbox"><img class="qr" src="${qr}" alt="Pairing QR code" width="180" height="180"></div>`}
  <div class="code">${escapeHtml(code.replace(/(.{4})/, '$1-'))}</div>
  <label for="link">Invite link</label>
  <div class="row"><input id="link" readonly value="${escapeHtml(invite)}"><button class="secondary" type="button" onclick="copyText(document.getElementById('link').value,this)">Copy</button></div>
  <p class="hint">Scan the QR with the new device's camera, or open the link on it. <a href="/devices">Back to devices</a></p>
</div>`);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// --------------------------------------------------------------- PWA icons ---
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function makeIcon(size) {
  const cx = size / 2, cy = size / 2;
  const half = size * 0.26;
  const radius = size * 0.10;
  const dotR = size * 0.048;
  const barW = size * 0.30, barH = size * 0.085, barR = barH / 2;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      const o = 1 + x * 4;
      const t = (x + y) / (2 * size);
      let R = Math.round(11 + t * 30), G = Math.round(15 + t * 41), B = Math.round(27 + t * 66);
      const inSquare = (dx, dy, hw) => Math.abs(dx) <= hw && Math.abs(dy) <= hw;
      let inRounded = inSquare(x - cx, y - cy, half);
      if (inRounded) {
        const ax = Math.abs(x - cx) - (half - radius);
        const ay = Math.abs(y - cy) - (half - radius);
        if (ax > 0 && ay > 0 && ax * ax + ay * ay > radius * radius) inRounded = false;
      }
      if (inRounded) {
        const dx = x - cx, dy = y - cy;
        const inDot = (dotCx, dotCy) => {
          const ddx = dx - dotCx, ddy = dy - dotCy;
          return ddx * ddx + ddy * ddy <= dotR * dotR;
        };
        const inBar = Math.abs(dx) <= barW / 2 && Math.abs(dy - half * 0.42) <= barH / 2;
        if (inDot(-half * 0.30, -half * 0.32) || inDot(half * 0.30, -half * 0.32) || inBar) {
          R = 236; G = 240; B = 255;
        } else {
          R = 77; G = 107; B = 254;
        }
      }
      row[o] = R; row[o + 1] = G; row[o + 2] = B; row[o + 3] = 255;
    }
    rows.push(row);
  }
  const raw = Buffer.concat(rows);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
const ICONS = { 'icon-192.png': makeIcon(192), 'icon-512.png': makeIcon(512), 'icon-180.png': makeIcon(180) };

const MANIFEST = JSON.stringify({
  name: 'DeepSeek Harness',
  short_name: 'DSH',
  description: 'DeepSeek Harness Remote Console',
  start_url: '/',
  display: 'standalone',
  background_color: '#0d1322',
  theme_color: '#0d1322',
  icons: [
    { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  ],
}, null, 2);

const PWA_HEAD_INJECT = `
<link rel="manifest" href="/pwa/manifest.webmanifest">
<link rel="icon" type="image/png" href="/pwa/icon-192.png">
<link rel="apple-touch-icon" href="/pwa/icon-180.png">
<meta name="theme-color" content="#0d1322">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="DSH">`;


function reorderBootForRemoteSettings(html) {
  return html.replace(/(<script>globalThis\["__DSH_BOOT__"\] = )(\{.*?\})(<\/script>)/s, (m, pre, json, post) => {
    try {
      const boot = JSON.parse(json);
      const entries = Array.isArray(boot.entries) ? boot.entries : [];
      const idx = entries.findIndex((e) => e && e.id === 'dsh-remote-plugin');
      if (idx === -1 || idx === 0) return m;
      const [entry] = entries.splice(idx, 1);
      const conn = entries.findIndex((e) => e && e.id === '@deepseek-ai/dsh-client-connection');
      if (conn >= 0) entries.splice(conn + 1, 0, entry);
      else entries.unshift(entry);
      return pre + JSON.stringify(boot).replaceAll('<', '\\u003c') + post;
    } catch (e) {
      return m;
    }
  });
}

// ------------------------------------------------------------- proxy utils ---
function stripHopTo(headers, target) {
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    const lk = String(k).toLowerCase();
    // hop-by-hop headers are dropped and Host is rewritten to the loopback
    // upstream below. Origin / sec-fetch-* are browser-origin assertions that
    // describe the public browser->gateway hop; DSH's own loopback authority
    // checks would otherwise reject privileged host APIs (e.g. host.pickDirectory)
    // with 403 because the browser's origin (https://svlm1.abslm.nl) can never
    // match a loopback Host. The gateway is the trust boundary, so strip them.
    if (HOP_HEADERS.has(lk)) continue;
    if (lk === 'origin' || lk.startsWith('sec-fetch-')) continue;
    out[k] = v;
  }
  out.host = `${target.host}:${target.port}`;
  return out;
}
function stripHop(headers) { return stripHopTo(headers, UPSTREAM); }
function proxyRequestTo(req, res, target, headersOverride) {
  const headers = headersOverride || stripHopTo(req.headers, target);
  const preq = http.request({
    host: target.host, port: target.port,
    method: req.method, path: req.url,
    headers,
  }, (pres) => {
    const outHeaders = stripHop(pres.headers);
    applyWebCookies(outHeaders);
    // Hashed, revision-queried assets never change under their URL: let the
    // browser cache them long-term so reloads don't re-pull the plugin bundle.
    try {
      const p = String(req.url || '');
      const hashed = /^\/(assets|plugins)\//.test(p) && /(rev=[0-9a-f]+|-[A-Za-z0-9_]{8,}\.(js|css))/.test(p);
      if (pres.statusCode === 200 && req.method === 'GET' && hashed && outHeaders['cache-control'] === undefined) {
        outHeaders['cache-control'] = 'public, max-age=31536000, immutable';
      }
    } catch (e) {}
    res.writeHead(pres.statusCode || 502, outHeaders);
    pres.pipe(res);
  });
  preq.on('error', () => {
    if (!res.headersSent) { res.writeHead(502, { 'content-type': 'text/plain' }); res.end('upstream unavailable'); }
    else res.destroy();
  });
  req.pipe(preq);
}
async function proxyRequest(req, res) {
  const headers = stripHopTo(req.headers, UPSTREAM);
  await webAttach(headers, req);
  proxyRequestTo(req, res, UPSTREAM, headers);
}
async function proxyIndexWithPwa(req, res) {
  const h = stripHop(req.headers);
  await webAttach(h, req);
  const plain = new URL(req.url, 'http://gateway.local').searchParams.get('plain') === '1';
  h.accept = 'text/html';
  h['accept-encoding'] = 'identity';
  const preq = http.request({
    host: UPSTREAM.host, port: UPSTREAM.port,
    method: req.method, path: req.url, headers: h,
  }, (pres) => {
    const chunks = [];
    pres.on('data', (c) => chunks.push(c));
    pres.on('end', () => {
      let html = Buffer.concat(chunks).toString('utf8');
      // Inject the mobile layout layer (CSS + non-blocking hamburger shim).
      // Mobile layout is a client plugin (dsh-narrow-layout) layered over this
      // desktop render, so every client gets one consistent page. ?plain=1 is
      // accepted and has no further effect for compatibility.
      if (html.includes('</head>')) html = html.replace('</head>', PWA_HEAD_INJECT + '</head>');
      else html = PWA_HEAD_INJECT + html;
      html = reorderBootForRemoteSettings(html);
      const body = Buffer.from(html, 'utf8');
      const headers = stripHop(pres.headers);
      applyWebCookies(headers);
      headers['content-length'] = String(body.length);
      // Cloudflare Rocket Loader transforms <script type="module"> into a deferred
      // rockey/loader tag that breaks DSH's ES-module bootstrap ("bootstrap facade
      // missing"). 'no-transform' tells the CDN not to rewrite this HTML response.
      headers['cache-control'] = 'no-store, no-transform';
      res.writeHead(pres.statusCode || 200, headers);
      res.end(body);
    });
  });
  preq.on('error', () => {
    if (!res.headersSent) { res.writeHead(502, { 'content-type': 'text/plain' }); res.end('upstream unavailable'); }
    else res.destroy();
  });
  req.pipe(preq);
}

async function webAttachForWs(req) {
  if (webPair && latestWebToken() === webTok) {
    req.headers.cookie = (req.headers.cookie ? req.headers.cookie + '; ' : '') + webPair;
    return;
  }
  const pair = await ensureWebCookie();
  if (pair) req.headers.cookie = (req.headers.cookie ? req.headers.cookie + '; ' : '') + pair;
}

// ------------------------------------------------------------ url & helpers --
function currentUrl() {
  try { return fs.readFileSync(path.join(DIR, 'url.txt'), 'utf8').trim(); } catch {}
  // Fall back to parsing cloudflared.log (quick tunnel URL, or the remote
  // ingress hostname for named/token tunnels, JSON-escaped in the log).
  try {
    const log = fs.readFileSync(path.join(DIR, 'cloudflared.log'), 'utf8');
    const quick = log.match(/https:\/\/[a-z0-9-]*\.trycloudflare\.com/g);
    if (quick && quick.length) return quick[quick.length - 1];
    const hn = log.match(/hostname\\":\\"([^\\"]+)/g);
    if (hn && hn.length) {
      const m = hn[hn.length - 1].match(/hostname\\":\\"([^\\"]+)/);
      if (m && m[1]) return 'https://' + m[1];
    }
  } catch {}
  return '';
}

// --------------------------------------------------- web token handshake --
// DSH (upstream) mints a per-boot token (printed as "dsh web: http://127.0.0.1:3080/?token=…" in web.log)
// and hands out an HttpOnly session cookie named dsh-auth-<token> on first use. Remote browsers
// should never need to paste that token: the gateway performs the handshake internally and hands
// the cookie to the browser, keeping the public URL just "https://host/?password=…" (test mode) or
// the pairing URL. A rotated token (web restart) is picked up from the log automatically.
let webTok = null, webPair = null, webSet = null, webAt = 0;
function latestWebToken() {
  // The box entrypoint publishes the live token here (`web-token`), so a log that
  // is empty, rotated, or being rewritten cannot strand the gateway without it.
  const published = readIfExists(WEB_TOKEN_FILE);
  if (published !== null && published.trim() !== '') return published.trim();
  try {
    const raw = fs.readFileSync(WEB_LOG, 'utf8');
    const all = raw.match(/token=([A-Za-z0-9_-]+)/g);
    return all && all.length ? all[all.length - 1].slice('token='.length) : null;
  } catch { return null; }
}
function browserHasWebCookie(req) {
  const tok = latestWebToken();
  // No known token means "we cannot tell" — treat it as missing and attach one,
  // otherwise the request goes upstream bare and the browser gets the harness's
  // "authentication required" page.
  if (!tok) return false;
  return String(req.headers.cookie || '').includes('dsh-auth-' + tok + '=');
}
function webHandshake(token) {
  return new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port: UPSTREAM.port, method: 'GET', path: '/?token=' + encodeURIComponent(token) }, (res) => {
      const sc = res.headers['set-cookie'];
      res.resume();
      resolve(Array.isArray(sc) ? sc.join('; ') : (sc || null));
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}
let webPrep = null;
function ensureWebCookie(attempt = 0) {
  const tok = latestWebToken();
  if (tok && tok === webTok && webPair) return Promise.resolve(webPair);
  if (webPrep) return webPrep;
  webPrep = webHandshake(tok).then(async (cookie) => {
    webPrep = null;
    if (cookie) {
      webTok = tok; webSet = cookie; webPair = cookie.split(';')[0]; webAt = Date.now();
      return webPair;
    }
    // No token yet (web server still booting) or the handshake missed: retry a
    // few times instead of proxying the request without a cookie.
    if (attempt < 10) {
      await new Promise((r) => setTimeout(r, 500));
      return ensureWebCookie(attempt + 1);
    }
    return null;
  }).catch(() => { webPrep = null; return null; });
  return webPrep;
}
let webSetCookie = null;
// Names of stale `dsh-auth-*` cookies seen on incoming requests, so the response
// can expire them in the browser.
let webStaleCookies = [];

/**
 * Split a request Cookie header into (fresh header without any `dsh-auth-*`, the
 * stale names). The harness reads the FIRST `dsh-auth-` cookie it is offered, so
 * appending a fresh one behind a stale one from a previous token/boot yields the
 * "authentication required" page.
 */
function splitWebCookies(cookieHeader) {
  const stale = [];
  const kept = [];
  for (const raw of String(cookieHeader || '').split(';')) {
    const item = raw.trim();
    if (item === '') continue;
    if (item.startsWith('dsh-auth-')) { stale.push(item.slice(0, item.indexOf('='))); continue; }
    kept.push(item);
  }
  return { rest: kept.join('; '), stale };
}
// Attach the current web cookie to a header set when the browser lacks it and
// schedule echoing the Set-Cookie so the browser persists it (name embeds the token).
async function webAttach(headers, req) {
  if (browserHasWebCookie(req)) return;
  if (webPair && latestWebToken() === webTok) { attachWebCookie(headers, webPair, webSet); return; }
  const pair = await ensureWebCookie();
  if (pair) attachWebCookie(headers, pair, webSet);
}

/**
 * Echo the fresh web cookie to the browser and expire every stale `dsh-auth-*`
 * it sent (they accumulate across box rebuilds; cookies ignore ports, so a
 * browser that visited another box keeps offering its old token). Both proxy
 * paths must call this or the cleanup never reaches the browser.
 */
function applyWebCookies(outHeaders) {
  if (!webSetCookie && webStaleCookies.length === 0) return outHeaders;
  const cookies = [];
  if (webSetCookie) cookies.push(webSetCookie);
  for (const name of webStaleCookies) cookies.push(`${name}=; Path=/; Max-Age=0; SameSite=Lax`);
  outHeaders['set-cookie'] = cookies.length === 1 ? cookies[0] : cookies;
  webSetCookie = null;
  webStaleCookies = [];
  return outHeaders;
}

/** Replace any stale `dsh-auth-*` on the outgoing request, remember them for cleanup. */
function attachWebCookie(headers, pair, setCookie) {
  const { rest, stale } = splitWebCookies(headers.cookie);
  headers.cookie = rest === '' ? pair : rest + '; ' + pair;
  if (stale.length > 0) webStaleCookies = [...new Set([...webStaleCookies, ...stale])];
  webSetCookie = setCookie || pair;
}

// ----------------------------------------------------------------- server ----
const server = http.createServer((req, res) => {
  const ip = clientIp(req);
  const url = new URL(req.url, 'http://gateway.local');
  const auth = verifyCookie(req.headers.cookie || '');
  const urlText = currentUrl();

  // health check (JSON, for the watchdog and ops CLI)
  if (url.pathname === '/__health') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true, service: 'dsh-gateway', version: KIT_VERSION }));
    return;
  }
  // PWA static assets (public, no pairing required)
  if (url.pathname === '/pwa/manifest.webmanifest') {
    res.writeHead(200, { 'content-type': 'application/manifest+json', 'cache-control': 'no-store' });
    res.end(MANIFEST);
    return;
  }
  if (url.pathname === '/apple-touch-icon.png') {
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'max-age=86400' });
    res.end(ICONS['icon-180.png']);
    return;
  }
  const iconMatch = /^\/pwa\/icon-(\d+)\.png$/.exec(url.pathname);
  if (iconMatch && ICONS[`icon-${iconMatch[1]}.png`]) {
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'max-age=86400' });
    res.end(ICONS[`icon-${iconMatch[1]}.png`]);
    return;
  }

  // ---- device admin page (paired session required) ----
  // `?format=json` (or Accept: application/json) serves the same facts to the
  // in-app Pairing settings page: the device list and revoke actions, never a
  // pairing code (codes live in codes/ as hashes and are single-use).
  if (url.pathname === '/devices' && req.method === 'GET') {
    const wantsJson = url.searchParams.get('format') === 'json'
      || String(req.headers.accept || '').includes('application/json');
    if (!auth.ok) {
      if (wantsJson) { res.writeHead(403, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'not paired' })); return; }
      res.writeHead(302, { location: '/login' }); res.end(); return;
    }
    if (wantsJson) {
      const now = Date.now();
      const devices = readDevices()
        .filter((d) => d.active !== false)
        .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
        .map((d) => ({
          id: d.id,
          label: d.label,
          created: d.created || null,
          lastSeen: d.lastSeen || null,
          lastSeenAgoMs: d.lastSeen ? now - d.lastSeen : null,
          current: d.id === auth.deviceId,
        }));
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: true, current: auth.deviceId, devices }));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(devicesPage(urlText || '(unknown)', readDevices()));
    return;
  }
  if (url.pathname === '/devices/newcode' && req.method === 'POST') {
    if (!auth.ok) { res.writeHead(403); res.end('forbidden'); return; }
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 512) req.destroy(); });
    req.on('end', () => {
      const label = decodeURIComponent(String(body).replace(/^label=/, '').replace(/\+/g, ' ').trim()).slice(0, 32) || 'New device';
      const code = mintPairingCode();
      audit('code-issued', { ip, byDevice: auth.deviceId, label });
      const inviteLink = `${urlText || ''}?code=${code}&label=${encodeURIComponent(label)}`;
      // Machine clients (the in-app Pairing settings page) ask for JSON; the
      // browser admin page keeps the human page, now with the same QR.
      const wantsJson = url.searchParams.get('format') === 'json'
        || String(req.headers.accept || '').includes('application/json');
      if (wantsJson) {
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify({
          ok: true,
          code,
          grouped: code.replace(/(.{4})/, '$1-'),
          label,
          link: inviteLink,
          qr: qrDataUri(inviteLink),
          expiresInMinutes: Math.round(CODE_TTL_MS / 60000),
        }));
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
        'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' });
      res.end(newcodePage(code, label, inviteLink, qrDataUri(inviteLink)));
    });
    return;
  }
  if (url.pathname === '/devices/revoke' && req.method === 'POST') {
    if (!auth.ok) { res.writeHead(403); res.end('forbidden'); return; }
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 256) req.destroy(); });
    req.on('end', () => {
      const id = decodeURIComponent(String(body).replace(/^id=/, '').trim());
      const list = readDevices();
      const dev = list.find((d) => d.id === id);
      if (dev) {
        dev.active = false;
        writeDevices(list);
        audit('device-revoked', { ip, byDevice: auth.deviceId, device: id, label: dev.label });
      }
      const wantsJson = url.searchParams.get('format') === 'json'
        || String(req.headers.accept || '').includes('application/json');
      if (wantsJson) {
        res.writeHead(dev ? 200 : 404, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify(dev
          ? { ok: true, revoked: id, label: dev.label, current: id === auth.deviceId }
          : { ok: false, error: 'unknown device' }));
        return;
      }
      res.writeHead(302, { location: '/devices' });
      res.end();
    });
    return;
  }

  // ---- tunnel management (paired session required) ----
  // Backs the in-app Tunnel settings page: status, connector token, transport
  // protocol, restart. `?format=json` (or Accept: application/json) everywhere.
  if (url.pathname.startsWith('/tunnel') && (req.method === 'GET' || req.method === 'POST')) {
    const wantsJson = url.searchParams.get('format') === 'json'
      || String(req.headers.accept || '').includes('application/json');
    const json = (code, payload) => {
      res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(payload));
    };
    if (!wantsJson) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return; }
    if (!auth.ok) { json(403, { ok: false, error: 'not paired' }); return; }

    if (url.pathname === '/tunnel' && req.method === 'GET') {
      const status = tunnelStatus();
      // `&qr=1` renders the public URL as a QR only when a page asks for it (it
      // shells out to qrencode, so it stays off the polling path).
      if (url.searchParams.get('qr') === '1' && typeof status.url === 'string' && status.url !== '') {
        status.qr = qrDataUri(status.url);
      }
      json(200, status);
      return;
    }

    if (req.method === 'POST' && (url.pathname === '/tunnel/token' || url.pathname === '/tunnel/protocol'
      || url.pathname === '/tunnel/restart' || url.pathname === '/tunnel/quick' || url.pathname === '/tunnel/stop')) {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 8192) req.destroy(); });
      req.on('end', () => {
        const field = (name) => {
          const match = new RegExp(`(?:^|&)${name}=([^&]*)`).exec(body);
          return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : '';
        };
        try {
          if (url.pathname === '/tunnel/token') {
            const token = field('token').trim();
            if (token.length < 40) { json(400, { ok: false, error: 'that does not look like a tunnel token' }); return; }
            writeTunnelToken(token);
            audit('tunnel-token-set', { ip, byDevice: auth.deviceId, length: token.length });
            json(200, { ok: true, message: applyTunnelService(), status: tunnelStatus() });
            return;
          }
          if (url.pathname === '/tunnel/protocol') {
            const protocol = field('protocol').trim().toLowerCase();
            if (!['auto', 'http2', 'quic'].includes(protocol)) { json(400, { ok: false, error: 'protocol must be auto, http2 or quic' }); return; }
            writeTunnelProtocol(protocol);
            audit('tunnel-protocol-set', { ip, byDevice: auth.deviceId, protocol });
            json(200, { ok: true, message: applyTunnelService(), status: tunnelStatus() });
            return;
          }
          if (url.pathname === '/tunnel/quick') {
            // Zero-config: cloudflared mints a random *.trycloudflare.com hostname for
            // this box. No account, no domain, no token.
            const started = startGatewayTunnel('quick');
            if (!started.ok) { json(500, { ok: false, error: started.error }); return; }
            audit('tunnel-quick-started', { ip, byDevice: auth.deviceId });
            json(200, { ok: true, message: 'quick tunnel starting \u2014 the hostname appears here in a few seconds', status: tunnelStatus() });
            return;
          }
          if (url.pathname === '/tunnel/stop') {
            const stopped = stopGatewayTunnel() || capture('/bin/launchctl', ['bootout', launchctlTarget()]).ok;
            audit('tunnel-stopped', { ip, byDevice: auth.deviceId, child: stopped });
            json(200, { ok: true, message: stopped ? 'connector stopped' : 'nothing was running', status: tunnelStatus() });
            return;
          }
          const prefer = field('mode').trim().toLowerCase();
          audit('tunnel-restart', { ip, byDevice: auth.deviceId, mode: prefer || null });
          json(200, { ok: true, message: applyTunnelService(prefer), status: tunnelStatus() });
        } catch (error) {
          json(500, { ok: false, error: String((error && error.message) || error) });
        }
      });
      return;
    }

    json(404, { ok: false, error: 'unknown tunnel action' });
    return;
  }

  // test mode: a password in the URL grants a session, no pairing needed
  if (url.searchParams.has('password')) {
    if (tooManyFails(ip)) { res.writeHead(429, { 'content-type': 'text/plain' }); res.end('too many attempts'); audit('rate-limited', { ip }); return; }
    if (testPasswordOk(req)) {
      clearFails(ip);
      ensureTestmodeDevice();
      audit('password-grant', { ip });
      res.writeHead(302, { location: grantLocation(url), 'set-cookie': cookieHeader(TESTMODE_DEVICE_ID, req.headers['x-forwarded-proto']), 'cache-control': 'no-store' });
      res.end();
      return;
    }
    recordFail(ip);
    audit('password-fail', { ip });
    res.writeHead(302, { location: '/login?bad=1', 'cache-control': 'no-store' });
    res.end();
    return;
  }

  // pairing-code entry (GET ?code=…&label=…, scan-direct)
  if (url.searchParams.has('code')) {
    const code = url.searchParams.get('code');
    const label = (url.searchParams.get('label') || 'New device').slice(0, 32);
    if (tooManyFails(ip)) { res.writeHead(429, { 'content-type': 'text/plain' }); res.end('too many attempts'); audit('rate-limited', { ip }); return; }
    if (consumeCode(code)) {
      clearFails(ip);
      const dev = addDevice(label);
      audit('paired', { ip, device: dev.id, label });
      res.writeHead(302, { location: '/', 'set-cookie': cookieHeader(dev.id, req.headers['x-forwarded-proto']),
        'cache-control': 'no-store', 'content-type': 'text/html' });
      res.end('paired, redirecting…');
    } else {
      recordFail(ip);
      audit('pair-failed', { ip });
      res.writeHead(302, { location: '/login?bad=1', 'cache-control': 'no-store' });
      res.end();
    }
    return;
  }

  // login page
  if (url.pathname === '/login' && req.method === 'GET') {
    // A brand-new install opened from this machine can be connected without a
    // terminal: mint a code here and show it with a QR. Remote visitors only get
    // the instructions (never an auto-minted code).
    const firstRun = readDevices().filter((d) => d.active !== false).length === 0;
    const local = isLocalRequest(req);
    const code = firstRun && local ? mintPairingCode() : null;
    if (code !== null) audit('code-issued', { ip, label: 'First device', source: 'first-run-page' });
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
      'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' });
    res.end(loginPage({ firstRun, local, code, url: publicUrl(), label: 'First device', bad: url.searchParams.get('bad') === '1' }));
    return;
  }
  if (url.pathname === '/login' && req.method === 'POST') {
    if (tooManyFails(ip)) { res.writeHead(429); res.end('too many attempts'); return; }
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 256) req.destroy(); });
    req.on('end', () => {
      const params = new URLSearchParams(String(body));
      // test mode: the password field grants a session (pairing bypass)
      const tm = readTestmode();
      const entered = params.get('password') || '';
      if (tm !== null && entered.length === tm.password.length && crypto.timingSafeEqual(Buffer.from(entered), Buffer.from(tm.password))) {
        clearFails(ip);
        ensureTestmodeDevice();
        audit('password-grant', { ip });
        res.writeHead(302, { location: '/', 'set-cookie': cookieHeader(TESTMODE_DEVICE_ID, req.headers['x-forwarded-proto']), 'cache-control': 'no-store' });
        res.end();
        return;
      }
      const code = (params.get('code') || '').trim();
      const label = (params.get('label') || '').trim().slice(0, 32) || 'Web login';
      if (consumeCode(code)) {
        clearFails(ip);
        const dev = addDevice(label);
        audit('paired', { ip, device: dev.id, label });
        res.writeHead(302, { location: '/', 'set-cookie': cookieHeader(dev.id, req.headers['x-forwarded-proto']), 'cache-control': 'no-store' });
        res.end();
      } else {
        recordFail(ip);
        audit('pair-failed', { ip });
        res.writeHead(302, { location: '/login?bad=1', 'cache-control': 'no-store' });
        res.end();
      }
    });
    return;
  }

  // everything else: verify the session cookie first
  if (auth.ok) {
    // Slug→port routes (behind the same paired-session auth): a first path
    // segment matching routes.json is stripped and proxied to 127.0.0.1:<port>,
    // so the app sees clean root-relative paths. See ROUTES_FILE/readRoutes().
    const _first = url.pathname.split('/')[1] || '';
    const _routes = readRoutes();
    if (_first && _routes[_first]) {
      const rest = '/' + url.pathname.split('/').slice(2).join('/');
      const clean = rest === '/' ? '/' : rest;
      req.url = clean + (url.search || '');
      proxyRequestTo(req, res, { host: '127.0.0.1', port: _routes[_first].port });
      return;
    }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      // Version-stamp the app document: a cached copy from before a mobile-layer
      // change lives at a different URL, so the browser is forced to re-fetch it
      // (and with it the current inline CSS/script) on the next open.
      if (url.searchParams.get('v') !== MOBILE_REV) {
        const q = new URLSearchParams(url.searchParams);
        q.set('v', MOBILE_REV);
        res.writeHead(302, { location: `${url.pathname}?${q.toString()}`, 'cache-control': 'no-store' });
        res.end();
        return;
      }
      proxyIndexWithPwa(req, res);
    } else {
      proxyRequest(req, res);
    }
    return;
  }
  if (auth.revoked) {
    const last = throttled.get(ip) || 0;
    if (Date.now() - last > FAIL_WINDOW_MS) {
      throttled.set(ip, Date.now());
      audit('revoked-session', { ip, device: auth.revoked });
    }
  }
  res.writeHead(302, { location: '/login', 'cache-control': 'no-store' });
  res.end();
});

// WebSocket upgrade
server.on('upgrade', async (req, socket, head) => {
  const auth = verifyCookie(req.headers.cookie || '');
  if (!auth.ok) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  // Slug→port routing: mirror the HTTP branch so WebSocket/HMR works too.
  const pathname = (req.url || '').split('?')[0];
  const first = pathname.split('/')[1] || '';
  const routes = readRoutes();
  let target = UPSTREAM;
  let targetUrl = req.url;
  // web-cookie attach for the WS handshake when the browser lacks the current token cookie
  if (browserHasWebCookie(req) === false) {
    try { await webAttachForWs(req); } catch (e) {}
  }
  if (first && routes[first]) {
    const rest = '/' + pathname.split('/').slice(2).join('/');
    const clean = rest === '/' ? '/' : rest;
    const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    target = { host: '127.0.0.1', port: routes[first].port };
    targetUrl = clean + q;
  }
  const sock = net.connect(target.port, target.host, () => {
    // WebSocket upgrades must NOT lose the handshake headers: stripHop drops
    // Connection/Upgrade (they are hop-by-hop for plain HTTP proxying), but an
    // upstream WebSocketServer needs Upgrade + Connection + the sec-websocket-*
    // headers to negotiate the 101 response. Without them DSH answers 426 and
    // the phone loses its live session stream (starts a fresh session each time).
    const h = {};
    for (const [k, v] of Object.entries(req.headers)) {
      const lk = String(k).toLowerCase();
      if (lk === 'origin' || lk.startsWith('sec-fetch-')) continue;
      if (lk === 'transfer-encoding' || lk === 'keep-alive') continue;
      h[k] = v;
    }
    h.host = `${target.host}:${target.port}`;
    h.connection = req.headers.connection || 'Upgrade';
    h.upgrade = req.headers.upgrade || 'websocket';
    let headStr = `${req.method} ${targetUrl} HTTP/1.1\r\n`;
    for (const [k, v] of Object.entries(h)) {
      headStr += `${k}: ${Array.isArray(v) ? v.join(', ') : v}\r\n`;
    }
    headStr += '\r\n';
    sock.write(headStr);
    if (head && head.length) sock.write(head);
    socket.pipe(sock);
    sock.pipe(socket);
  });
  sock.on('error', () => socket.destroy());
  socket.on('error', () => sock.destroy());
});

// Keep the upstream web cookie warm: pre-warm at boot and re-check periodically,
// so the first browser request never has to discover a rotated token itself.
setInterval(() => {
  const tok = latestWebToken();
  if (tok !== null && tok !== webTok) ensureWebCookie().catch(() => {});
}, 15000).unref();

/**
 * Keep `url.txt` pointing at wherever this instance is actually reachable: a live
 * quick or named tunnel if there is one, otherwise the loopback origin. Invite
 * links, the pairing QR and the dashboard all read this file.
 */
function refreshPublicUrl() {
  const mode = tunnelMode();
  // A named tunnel's hostname lives in the dashboard, not here: when it cannot be
  // re-read (log rotated, connector just restarted) keep whatever public URL is
  // already recorded instead of downgrading invites to a loopback address.
  // `publicUrl` is a module-level function; this local must not shadow it, or
  // the call below resolves to the binding being initialised and throws a TDZ.
  const resolvedUrl = mode === 'quick' ? tunnelUrl()
    : mode === 'named' ? (namedTunnelUrl() || (String(publicUrl()).startsWith('https://') ? publicUrl() : null))
    : null;
  const wanted = resolvedUrl !== null ? resolvedUrl : `http://127.0.0.1:${PORT}/`;
  if (readIfExists(URL_FILE) !== wanted) {
    try { fs.writeFileSync(URL_FILE, wanted); } catch { /* non-fatal */ }
  }
  return wanted;
}

server.listen(PORT, HOST, () => {
  // An embedder (the desktop app) passes DSH_REMOTE_PORT=0 and learns the real
  // port from this line — logging the requested 0 instead left it loading
  // http://127.0.0.1:0/.
  const bound = server.address();
  const actual = bound && typeof bound === 'object' ? bound.port : PORT;
  console.log(`dsh-gateway v${KIT_VERSION} listening on ${HOST}:${actual} → ${UPSTREAM.host}:${UPSTREAM.port}`);
  // pre-warm the DSH web cookie so the first remote index request doesn't pay
  // an extra handshake round trip (the token handshake runs in the background)
  try { ensureWebCookie().catch(() => {}); } catch (e) {}

  // Resume the connector when this instance owns it and a token is configured.
  // Without this, restarting the app (or the gateway) left the public hostname
  // answering 530 until someone opened the Tunnel page and pressed Save and start.
  try {
    if (tunnelManagedBy() === 'gateway' && tunnelToken().configured && !cfChildRunning()) {
      const started = startGatewayTunnel('named');
      console.log(started.ok ? '[gateway] connector resumed for the configured token' : `[gateway] connector not resumed: ${started.error}`);
      audit('tunnel-resumed', { ok: started.ok });
    }
  } catch (e) { /* reported by the Tunnel page */ }
  setTimeout(refreshPublicUrl, 0);   // gnts: deferred — the module body has not finished, so reading publicUrl here hits the TDZ
  setInterval(refreshPublicUrl, 15000).unref?.();
});
