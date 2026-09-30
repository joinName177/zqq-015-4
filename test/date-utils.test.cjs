const test = require('node:test');
const assert = require('node:assert/strict');
const { toDateKey, addDays, diffDays, weekStartOf, weekRange, WEEKDAY_LABELS } = require('../dist-test/src/core/date-utils.js');

test('toDateKey 本地日期键格式与补零', () => {
  assert.equal(toDateKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(toDateKey(new Date(2026, 9, 30)), '2026-10-30');
});

test('addDays / diffDays 跨年计算正确', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(diffDays('2026-10-01', '2026-10-08'), 7);
  assert.equal(diffDays('2026-10-08', '2026-10-01'), -7);
});

test('weekStartOf 以周一为起点', () => {
  // 2026-10-02 是周五
  assert.equal(weekStartOf('2026-10-02'), '2026-09-28');
  // 周一当天
  assert.equal(weekStartOf('2026-09-28'), '2026-09-28');
  // 周日归到本周而不是下周
  assert.equal(weekStartOf('2026-10-04'), '2026-09-28');
});

test('weekRange 返回周一到周日', () => {
  assert.deepEqual(weekRange('2026-10-02'), { start: '2026-09-28', end: '2026-10-04' });
  assert.equal(WEEKDAY_LABELS.length, 7);
});
