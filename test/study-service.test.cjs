const test = require('node:test');
const assert = require('node:assert/strict');
const { StudyPlannerService } = require('../dist-test/src/core/study-service.js');

const CATALOG = ['守株待兔', '刻舟求剑', '卧薪尝胆', '破釜沉舟'];

function makeHarness(today = '2026-09-28') {
  let current = today;
  const mem = new Map();
  const store = {
    load: () => (mem.has('s') ? JSON.parse(mem.get('s')) : { favorites: [], progress: {}, events: [], frozenWeeks: {} }),
    save: st => mem.set('s', JSON.stringify(st))
  };
  const catalog = { listCatalogIds: () => CATALOG, resolveTitle: id => id };
  const clock = { today: () => current };
  const svc = new StudyPlannerService(store, catalog, clock);
  return {
    svc,
    setToday: t => (current = t),
    persisted: () => JSON.parse(mem.get('s'))
  };
}

function flattenIds(plan) {
  return plan.days.flatMap(d => d.items.map(i => i.idiomId));
}

test('冷启动：无收藏也能立即生成一周计划', () => {
  const { svc } = makeHarness();
  const plan = svc.getWeeklyPlan();
  assert.equal(plan.coldStart, true);
  assert.equal(plan.totalCount, 4);
  assert.deepEqual(flattenIds(plan), CATALOG);
});

test('getWeeklyPlan 幂等，且每次刷新结果稳定', () => {
  const { svc } = makeHarness();
  const first = flattenIds(svc.getWeeklyPlan());
  const second = flattenIds(svc.getWeeklyPlan());
  assert.deepEqual(second, first);
});

test('跨天刷新（模拟时钟前进到周日）顺序保持冻结', () => {
  const h = makeHarness('2026-09-28');
  const monday = flattenIds(h.svc.getWeeklyPlan());
  h.setToday('2026-10-02'); // 周五
  h.svc.review('守株待兔', 'easy');
  h.setToday('2026-10-04'); // 周日
  const sunday = flattenIds(h.svc.getWeeklyPlan());
  assert.deepEqual(sunday, monday);
});

test('完成复习后再跨天，当天高亮随日期移动但顺序不变', () => {
  const h = makeHarness('2026-09-28');
  h.svc.getWeeklyPlan();
  h.svc.review('守株待兔', 'good'); // 周一槽位完成
  h.setToday('2026-09-29');
  const plan = h.svc.getWeeklyPlan();
  assert.equal(plan.days[0].isToday, false);
  assert.equal(plan.days[1].isToday, true);
  assert.equal(plan.completedCount, 1);
  assert.equal(plan.days[0].items[0].completed, true);
});

test('收藏写入持久化；undoLast 可跨刷新回滚完成记录', () => {
  const h = makeHarness();
  h.svc.addFavorite('守株待兔');
  assert.ok(h.persisted().favorites.includes('守株待兔'));
  h.svc.getWeeklyPlan();
  h.svc.review('守株待兔', 'good');
  assert.equal(h.svc.getWeeklyPlan().completedCount, 1);
  const ev = h.svc.undoLast();
  assert.equal(ev.type, 'reviewed');
  assert.equal(h.svc.getWeeklyPlan().completedCount, 0);
  assert.equal(h.persisted().events.filter(e => e.type === 'reviewed').length, 0);
});

test('回滚收藏后再刷新，本周队列不受影响（冻结语义），下一周生效', () => {
  const h = makeHarness('2026-09-28');
  CATALOG.slice(0, 2).forEach(id => h.svc.addFavorite(id));
  const weekIds = flattenIds(h.svc.getWeeklyPlan());
  assert.deepEqual(weekIds, CATALOG.slice(0, 2));
  h.svc.removeFavorite('刻舟求剑');
  // 本周仍包含
  assert.deepEqual(flattenIds(h.svc.getWeeklyPlan()), weekIds);
  // 下周只剩守株待兔
  h.setToday('2026-10-05');
  assert.deepEqual(flattenIds(h.svc.getWeeklyPlan()), ['守株待兔']);
});
