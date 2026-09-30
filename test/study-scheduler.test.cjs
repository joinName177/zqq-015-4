const test = require('node:test');
const assert = require('node:assert/strict');
const {
  emptyState,
  applyRating,
  newProgress,
  urgencyOf,
  buildCandidateOrder,
  ensureWeekFrozen,
  getWeeklyPlan,
  addFavorite,
  removeFavorite,
  recordReview,
  undoEvent,
  undoLast
} = require('../dist-test/src/core/study-scheduler.js');

const CATALOG = ['守株待兔', '刻舟求剑', '卧薪尝胆', '破釜沉舟'];
const MON = '2026-09-28'; // 本周一
const TUE = '2026-09-29';
const SUN = '2026-10-04';
const NEXT_MON = '2026-10-05';

function flattenIds(plan) {
  return plan.days.flatMap(d => d.items.map(i => i.idiomId));
}

// ---------------------------------------------------------------------------
// SM-2 间隔算法
// ---------------------------------------------------------------------------

test('新卡评分：again 重学(interval=0)，good 1 天，easy 3 天', () => {
  const p0 = newProgress('x', MON);
  assert.equal(applyRating(p0, 'again', MON).intervalDays, 0);
  assert.equal(applyRating(p0, 'good', MON).intervalDays, 1);
  assert.equal(applyRating(p0, 'easy', MON).intervalDays, 3);
  assert.equal(applyRating(p0, 'easy', MON).due, '2026-10-01');
});

test('熟练度 0~5 且 again 降低、easy 增长', () => {
  const p0 = newProgress('x', MON);
  const easy = applyRating(p0, 'easy', MON);
  assert.ok(easy.proficiency >= 2 && easy.proficiency <= 5);
  const again = applyRating(easy, 'again', MON);
  assert.ok(again.proficiency < easy.proficiency);
  assert.equal(again.lapses, 1);
  assert.ok(again.intervalDays === 0);
});

test('ease 不会跌破 1.3，且按 good/hard/easy 调整', () => {
  let p = newProgress('x', MON);
  for (let i = 0; i < 20; i++) p = applyRating(p, 'again', MON);
  assert.ok(p.ease >= 1.3);
});

// ---------------------------------------------------------------------------
// 紧迫度排序
// ---------------------------------------------------------------------------

test('逾期 > 今日到期 > 新卡 > 未来到期', () => {
  let s = emptyState();
  ['逾期', '今日', '未来'].forEach(id => (s = addFavorite(s, id, MON, 't')));
  s = recordReview(s, '逾期', 'good', '2026-09-20', 't').state; // due 约 9-21，逾期
  s = recordReview(s, '今日', 'good', MON, 't').state;          // due tomorrow? good 新卡 1 天
  // 重排：把「今日」造成 due=9-29，改用 again 让它今天到期
  s = recordReview(s, '今日', 'again', MON, 't').state;         // due = MON
  s = recordReview(s, '未来', 'easy', MON, 't').state;          // due +3 天
  const { candidates } = buildCandidateOrder(s, CATALOG, MON);
  const ids = candidates.map(c => c.idiomId);
  assert.equal(ids[0], '逾期');
  assert.equal(ids[1], '今日');
  assert.equal(ids[ids.length - 1], '未来');
});

test('同为新卡时按收藏插入顺序，结果确定', () => {
  let s = emptyState();
  ['a', 'b', 'c'].forEach(id => (s = addFavorite(s, id, MON, 't')));
  const run = () => buildCandidateOrder(s, CATALOG, MON).candidates.map(c => c.idiomId);
  assert.deepEqual(run(), run());
  assert.deepEqual(run(), ['a', 'b', 'c']);
});

// ---------------------------------------------------------------------------
// 冷启动
// ---------------------------------------------------------------------------

test('无收藏时用目录种子冷启动，标记 coldStart', () => {
  const s = emptyState();
  const { candidates, coldStart } = buildCandidateOrder(s, CATALOG, MON);
  assert.equal(coldStart, true);
  assert.deepEqual(candidates.map(c => c.idiomId), CATALOG);
  assert.ok(candidates.every(c => c.kind === 'cold'));

  const { plan } = getWeeklyPlan(s, CATALOG, MON);
  assert.equal(plan.coldStart, true);
  assert.equal(plan.totalCount, CATALOG.length);
});

test('空目录 + 无收藏返回空周计划而不是报错', () => {
  const { plan } = getWeeklyPlan(emptyState(), [], MON);
  assert.equal(plan.totalCount, 0);
  assert.equal(plan.completedCount, 0);
  assert.deepEqual(flattenIds(plan), []);
});

// ---------------------------------------------------------------------------
// 周队列冻结 / 跨天稳定
// ---------------------------------------------------------------------------

test('周队列轮转铺到周一..周日且名次与日期槽位确定', () => {
  let s = emptyState();
  ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].forEach(id => (s = addFavorite(s, id, MON, 't')));
  const { plan, state } = getWeeklyPlan(s, [], MON);
  assert.deepEqual(plan.days.map(d => d.items.length), [2, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual(
    plan.days[0].items.map(i => i.idiomId),
    ['a', 'h'],
    'rank 0 与 rank 7 都落在周一'
  );
  s = state;
});

test('跨天刷新：周内进度变化不改变已冻结顺序', () => {
  let s = emptyState();
  CATALOG.forEach(id => (s = addFavorite(s, id, MON, 't')));

  // 周一生成
  const r1 = getWeeklyPlan(s, CATALOG, MON);
  s = r1.state;
  const orderMon = flattenIds(r1.plan);

  // 周二：把本该排第一的「守株待兔」刷成 easy（本不该影响本周序列）
  s = recordReview(s, '守株待兔', 'easy', TUE, 't').state;
  // 再取消 + 重新收藏一个成语（同样不影响已冻结周）
  s = removeFavorite(s, '刻舟求剑', TUE, 't');

  const r2 = getWeeklyPlan(s, CATALOG, TUE);
  s = r2.state;
  assert.deepEqual(flattenIds(r2.plan), orderMon, '周二顺序与周一完全一致');

  // 周日再刷一次，依然一致
  const r3 = getWeeklyPlan(s, CATALOG, SUN);
  assert.deepEqual(flattenIds(r3.plan), orderMon, '周日顺序仍然一致');
});

test('新的一周依据最新熟练度 / 遗忘间隔重新冻结', () => {
  let s = emptyState();
  CATALOG.forEach(id => (s = addFavorite(s, id, MON, 't')));
  s = getWeeklyPlan(s, CATALOG, MON).state;

  // 刻舟求剑复习多次变熟练，守株待兔标记遗忘
  for (let i = 0; i < 3; i++) s = recordReview(s, '刻舟求剑', 'easy', MON, 't').state;
  s = recordReview(s, '守株待兔', 'again', MON, 't').state;

  const { plan } = getWeeklyPlan(s, CATALOG, NEXT_MON);
  const ids = flattenIds(plan);
  assert.ok(ids.indexOf('守株待兔') < ids.indexOf('刻舟求剑'), '遗忘项应排在熟练项之前');
});

// ---------------------------------------------------------------------------
// 完成记录与回滚
// ---------------------------------------------------------------------------

test('完成记录出现在计划完成数中，可整卡撤销', () => {
  let s = emptyState();
  s = addFavorite(s, '守株待兔', MON, 't');
  s = getWeeklyPlan(s, CATALOG, MON).state;
  s = recordReview(s, '守株待兔', 'good', MON, 't').state;

  let plan = getWeeklyPlan(s, CATALOG, MON).plan;
  assert.equal(plan.completedCount, 1);
  const item = plan.days.flatMap(d => d.items).find(i => i.idiomId === '守株待兔');
  assert.equal(item.completed, true);
  assert.ok(item.completedEventSeq);

  // 撤销该条完成
  s = undoEvent(s, item.completedEventSeq).state;
  plan = getWeeklyPlan(s, CATALOG, MON).plan;
  assert.equal(plan.completedCount, 0);
  const again = plan.days.flatMap(d => d.items).find(i => i.idiomId === '守株待兔');
  assert.equal(again.completed, false);
  assert.equal(again.completedEventSeq, undefined);
});

test('回滚复习：熟练度 / 间隔 / due 恢复到复习前', () => {
  let s = emptyState();
  s = addFavorite(s, 'x', MON, 't');
  const before = JSON.stringify(s.progress['x'] ?? null);
  const { event } = recordReview(s, 'x', 'easy', MON, 't');
  s = recordReview(s, 'x', 'easy', MON, 't').state;
  assert.notEqual(JSON.stringify(s.progress['x'] ?? null), before);
  s = undoEvent(s, event.seq).state;
  assert.equal(JSON.stringify(s.progress['x'] ?? null), before, '首次复习回滚后应回到无进度状态');
});

test('undoLast 始终撤销 seq 最大的事件', () => {
  let s = emptyState();
  s = addFavorite(s, 'a', MON, 't');
  s = recordReview(s, 'a', 'good', MON, 't').state;
  s = addFavorite(s, 'b', MON, 't');
  const undone = undoLast(s).event;
  assert.equal(undone.type, 'favoriteAdded');
  assert.equal(undone.idiomId, 'b');
});

test('可乱序回滚中间的收藏事件，其他记录保留', () => {
  let s = emptyState();
  s = addFavorite(s, 'a', MON, 't');
  const evB = addFavorite(s, 'b', MON, 't').events.find(e => e.idiomId === 'b');
  s = addFavorite(s, 'b', MON, 't');
  s = recordReview(s, 'a', 'good', MON, 't').state;
  s = undoEvent(s, evB.seq).state;
  assert.deepEqual(s.favorites, ['a']);
  assert.equal(s.events.length, 2, 'a 的收藏与复习事件保留');
  assert.ok(s.progress['a']);
});

test('回滚取消收藏事件：恢复到原下标位置', () => {
  let s = emptyState();
  ['a', 'b', 'c'].forEach(id => (s = addFavorite(s, id, MON, 't')));
  const removeEv = s.events.find(e => e.type === 'favoriteAdded' && e.idiomId === 'b');
  s = removeFavorite(s, 'b', MON, 't');
  assert.deepEqual(s.favorites, ['a', 'c']);
  // 回滚「取消收藏」事件
  const undoSeq = s.events.find(e => e.type === 'favoriteRemoved').seq;
  s = undoEvent(s, undoSeq).state;
  assert.deepEqual(s.favorites, ['a', 'b', 'c']);
  assert.ok(removeEv); // 原收藏事件仍在
});

test('重复收藏幂等；无事件时 undoLast 安全返回', () => {
  let s = emptyState();
  s = addFavorite(s, 'a', MON, 't');
  const again = addFavorite(s, 'a', MON, 't');
  assert.equal(again, s, '同一内容重复收藏应原样返回');
  assert.equal(undoLast(emptyState()).event, undefined);
});

// ---------------------------------------------------------------------------
// 冻结幂等
// ---------------------------------------------------------------------------

test('ensureWeekFrozen 幂等：已存在的周不重写', () => {
  let s = emptyState();
  CATALOG.forEach(id => (s = addFavorite(s, id, MON, 't')));
  s = ensureWeekFrozen(s, CATALOG, MON);
  const frozen = s.frozenWeeks[MON];
  // 状态变化后再次 ensure 同一周，快照不变
  s = recordReview(s, CATALOG[0], 'easy', MON, 't').state;
  s = ensureWeekFrozen(s, CATALOG, MON);
  assert.strictEqual(s.frozenWeeks[MON], frozen, '同一对象引用，未重新生成');
});
