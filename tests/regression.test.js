const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const jncSource = fs.readFileSync(path.join(root, 'JNC_tools.html'), 'utf8');

function sourceBlock(start, next) {
  const from = jncSource.indexOf(start);
  const to = jncSource.indexOf(next, from + start.length);
  assert.ok(from >= 0 && to > from, `Cannot locate ${start}`);
  return jncSource.slice(from, to);
}

function testFrame(value) {
  return Uint8Array.from([0x5B, 0x0D, 0x0A, 31, 0xA4, 0x11,
    ...Array(24).fill(value), 0x5D]);
}

test('JNC serial reader handles complete and split frames without dropping trailing bytes', async () => {
  const received = [];
  const first = testFrame(1);
  const second = testFrame(2);
  const third = testFrame(3);
  const chunks = [
    Uint8Array.from([...first, ...second, ...third.slice(0, 12)]),
    third.slice(12),
  ];
  const context = {
    console: { log() {}, warn() {} },
    serialBuf: [],
    serialClearBuf: [],
    serialClearBusy: false,
    serialKeepReading: true,
    serialReader: null,
    channelPendingQuery: null,
    isSingleTestMain: b => b === 0xA4 || b === 0x04,
    toInt16: u => u >= 0x8000 ? u - 0x10000 : u,
    updateJncTable: values => received.push(values),
    parseSerialChannelResponse: () => false,
    logSerial() {},
  };
  const reader = {
    async read() {
      if (chunks.length) return { value: chunks.shift(), done: false };
      context.serialKeepReading = false;
      return { done: true };
    },
    releaseLock() {},
  };
  context.serialPort = { readable: { getReader: () => reader } };
  vm.createContext(context);
  vm.runInContext(
    sourceBlock('  function parseJncResponse(dv){', '  // 串口单通道查询响应解析') +
    sourceBlock('  async function readLoop(){', '  async function disconnectSerial(){'),
    context,
  );

  await context.readLoop();
  assert.equal(received.length, 3);
  assert.equal(received[0][0], 0x0101);
  assert.equal(received[1][0], 0x0202);
  assert.equal(received[2][0], 0x0303);
  assert.equal(context.serialBuf.length, 0);
});

test('JNC channel parser reports the consumed range', () => {
  const context = {
    channelPendingQuery: {
      chIndex: 0, lineIndex: 0, packetIndex: 0,
      vals: new Array(460), label: '通道1C', timeoutMs: 2000,
      timer: null,
    },
    SERIAL_PACKET_VALUES: 115,
    SERIAL_PACKET_COUNT: 4,
    SERIAL_QUERY_TIMEOUT_MS: 2000,
    serialChannelResult: { textContent: '' },
    toInt16: u => u >= 0x8000 ? u - 0x10000 : u,
    setTimeout: () => 1,
    clearTimeout() {},
    sendNextChannelPacket() {},
    console: { warn() {} },
  };
  vm.createContext(context);
  vm.runInContext(sourceBlock('  function parseSerialChannelResponse(dv){', '  function clearChannelPending(result){'), context);
  const frame = Uint8Array.from([0x5B, 0x0D, 0x0A, 237, 0x04, 0x11,
    ...Array(230).fill(0), 0x5D]);
  const bytes = Uint8Array.from([0x00, ...frame, 0x5B, 0x0D]);
  const result = context.parseSerialChannelResponse(new DataView(bytes.buffer));
  assert.equal(result.start, 1);
  assert.equal(result.length, 237);
  assert.equal(bytes.length - result.start - result.length, 2);
  assert.equal(context.channelPendingQuery.packetIndex, 1);
});

test('JNC serial writer releases its lock when write fails', async () => {
  let releases = 0;
  const context = {
    serialPort: { writable: { getWriter: () => ({
      write: async () => { throw new Error('write failed'); },
      releaseLock: () => { releases++; },
    }) } },
  };
  vm.createContext(context);
  vm.runInContext(sourceBlock('  async function writeSerialBytes(bytes){', '  async function sendSerial(){'), context);
  await assert.rejects(context.writeSerialBytes(Uint8Array.of(1)), /write failed/);
  assert.equal(releases, 1);
});

test('Service Worker activation preserves caches belonging to other apps', async () => {
  const handlers = {};
  const deleted = [];
  const context = {
    self: {
      addEventListener: (name, handler) => { handlers[name] = handler; },
      clients: { claim: async () => {} },
    },
    caches: {
      keys: async () => ['jnx-tools-v2-72', 'jnx-tools-v2-73', 'other-app-v1'],
      delete: async key => { deleted.push(key); },
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), context);
  let activation;
  handlers.activate({ waitUntil: promise => { activation = promise; } });
  await activation;
  assert.deepEqual(deleted, ['jnx-tools-v2-72']);
});

test('Service Worker detects binary asset changes with equal decoded text', async () => {
  const handlers = {};
  const updated = [];
  const messages = [];
  const cached = new Response(Uint8Array.of(0xFF));
  const fresh = new Response(Uint8Array.of(0xFE));
  assert.equal(await cached.clone().text(), await fresh.clone().text());
  const cache = {
    match: async () => cached,
    put: async (...args) => { updated.push(args); },
  };
  const context = {
    self: {
      addEventListener: (name, handler) => { handlers[name] = handler; },
      clients: { matchAll: async () => [{ postMessage: message => messages.push(message) }] },
    },
    caches: { open: async () => cache },
    fetch: async () => fresh,
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), context);
  let response;
  let background;
  const request = { method: 'GET', url: 'https://example.test/icon-192.png' };
  handlers.fetch({
    request,
    respondWith: promise => { response = promise; },
    waitUntil: promise => { background = promise; },
  });
  assert.equal(await response, cached);
  await background;
  assert.equal(updated.length, 1);
  assert.equal(updated[0][0], request);
  assert.equal(messages[0].type, 'VERSION_UPDATE');
});

test('every refresh button deletes only JNx caches', () => {
  for (const file of ['index.html', 'JNA_tools.html', 'JNA_Plus_Tool.html', 'JNB_Tool.html', 'JNC_tools.html']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(source, /keys\.filter\(k => k\.startsWith\('jnx-tools-'\)\)\.map\(k => caches\.delete\(k\)\)/, file);
  }
});
