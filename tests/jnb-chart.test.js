const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'JNB_Tool.html'), 'utf8');

function block(start, next) {
  const from = source.indexOf(start);
  const to = source.indexOf(next, from + start.length);
  assert.ok(from >= 0 && to > from, `Cannot locate ${start}`);
  return source.slice(from, to);
}

test('JNB packet feeds C/T2/B/T1 chart in protocol order and keeps 460 points', () => {
  const context = {
    jnbPaused: false,
    JNB_CHART_FIELDS: ['C_live', 'T2_live', 'B_live', 'T1_live'],
    JNB_CHART_MAX_POINTS: 460,
    jnbChartData: [[], [], [], []],
    jnbChartStart: 0,
    jnbChartHint: { textContent: '' },
    btnJnbChartCopy: { disabled: true },
    btnJnbChartClear: { disabled: true },
    scheduleJnbChartRedraw() {},
    updateJnbTable() {},
    logToPanel() {},
    formatDataView: () => '',
    Utils: { shortUuid: () => 'FFE1' },
    FFE1_SERVICE: 'FFE1',
  };
  vm.createContext(context);
  vm.runInContext(
    block('  function parseJnb(dv){', '  function resetJnbChart(){') +
    block('  function appendJnbChartFrame(obj){', '  function drawJnbChart(){') +
    block('  function handleJnbPacket(dv){', '  function bytesHex(dv, start, end){'),
    context,
  );

  const view = new DataView(new ArrayBuffer(27));
  view.setUint8(0, 1);
  view.setUint16(18, 101, false);
  view.setUint16(20, 202, false);
  view.setUint16(22, 303, false);
  view.setUint16(24, 404, false);
  context.handleJnbPacket(view);
  assert.deepEqual(context.jnbChartData.map(series => series[0]), [101, 202, 303, 404]);
  assert.equal(context.btnJnbChartCopy.disabled, false);

  context.jnbPaused = true;
  context.handleJnbPacket(view);
  assert.equal(context.jnbChartData[0].length, 1);

  for (let i = 1; i < 462; i++) {
    context.appendJnbChartFrame({ C_live: i, T2_live: i + 1000, B_live: i + 2000, T1_live: i + 3000 });
  }
  assert.equal(context.jnbChartData[0].length, 460);
  assert.equal(context.jnbChartStart, 2);
  assert.equal(context.jnbChartData[0][0], 2);
  assert.equal(context.jnbChartData[0][459], 461);
});

test('JNB starts updating after connection and restores paused state on feed failure', async () => {
  const button = {
    disabled: false,
    textContent: '开始更新',
    classList: { toggle() {} },
  };
  let canStart = true;
  const context = {
    device: { gatt: { connected: true } },
    btnPauseJnb: button,
    jnbPaused: true,
    startFFE1Feed: async () => canStart,
    stopFFE1Feed() {},
    refreshFeatureState: () => { button.disabled = false; },
  };
  vm.createContext(context);
  vm.runInContext(block('  function setJnbPaused(paused){', '  // ---- 启动 FFE1 订阅/轮询'), context);
  assert.equal(await context.startJnbUpdates(), true);
  assert.equal(context.jnbPaused, false);
  assert.equal(button.textContent, '暂停更新');

  canStart = false;
  assert.equal(await context.startJnbUpdates(), false);
  assert.equal(context.jnbPaused, true);
  assert.equal(button.textContent, '开始更新');
});
