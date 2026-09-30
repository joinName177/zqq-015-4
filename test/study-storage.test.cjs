const test = require('node:test');
const assert = require('node:assert/strict');
const { LocalStorageStudyAdapter } = require('../dist-test/src/adapters/study-storage.adapter.js');

function fakeStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, v),
    removeItem: k => m.delete(k),
    _dump: () => Object.fromEntries(m)
  };
}

test('空存储返回空状态', () => {
  const a = new LocalStorageStudyAdapter(fakeStorage());
  assert.deepEqual(a.load(), { favorites: [], progress: {}, events: [], frozenWeeks: {} });
});

test('保存后可往返读取', () => {
  const storage = fakeStorage();
  const a = new LocalStorageStudyAdapter(storage);
  const state = { favorites: ['x'], progress: { x: { idiomId: 'x' } }, events: [], frozenWeeks: { w: { ids: ['x'] } } };
  a.save(state);
  const loaded = a.load();
  assert.deepEqual(loaded.favorites, ['x']);
  assert.deepEqual(loaded.frozenWeeks, { w: { ids: ['x'] } });
});

test('损坏 JSON 降级为空状态，不抛错', () => {
  const storage = fakeStorage();
  storage.setItem('idiom-study-state-v1', '{不是合法json');
  const a = new LocalStorageStudyAdapter(storage);
  assert.deepEqual(a.load().favorites, []);
});

test('旧版本缺字段时迁移补全', () => {
  const storage = fakeStorage();
  storage.setItem('idiom-study-state-v1', JSON.stringify({ favorites: ['a'] }));
  const loaded = new LocalStorageStudyAdapter(storage).load();
  assert.deepEqual(loaded.favorites, ['a']);
  assert.deepEqual(loaded.progress, {});
  assert.deepEqual(loaded.events, []);
  assert.deepEqual(loaded.frozenWeeks, {});
});

test('无 storage（SSR / 隐私模式）时不抛错', () => {
  const a = new LocalStorageStudyAdapter(null);
  assert.deepEqual(a.load().favorites, []);
  assert.doesNotThrow(() => a.save({ favorites: [], progress: {}, events: [], frozenWeeks: {} }));
});
