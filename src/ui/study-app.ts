// 学习计划生成器 · UI 渲染层

import { StudyPlanState, DayQueue, CompletionRecord } from '../core/study-models';
import { StudyPlanStats } from '../core/study-models';
import { STUDY_ITEM_POOL } from '../core/study-items';

export interface StudyUIHandlers {
  onToggleFavorite: (itemId: string) => void;
  onCompleteItem: (itemId: string, quality: number) => void;
  onRollback: (completionId: string) => void;
  onAddStarterPack: () => void;
}

const REASON_LABELS: Record<string, { text: string; cls: string }> = {
  favorite: { text: '收藏', cls: 'reason-favorite' },
  'low-proficiency': { text: '薄弱', cls: 'reason-weak' },
  'due-review': { text: '到期复习', cls: 'reason-due' },
  new: { text: '新学', cls: 'reason-new' },
  starter: { text: '入门推荐', cls: 'reason-starter' }
};

const WEEKDAY_SHORT = ['日', '一', '二', '三', '四', '五', '六'];

function esc(s: string): string {
  return s.replace(/[&<>'"]/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t] || t));
}

/** 渲染单条队列条目 */
function renderQueueItem(
  item: DayQueue['items'][number],
  state: StudyPlanState,
  handlers: StudyUIHandlers
): string {
  const isFav = state.favorites.includes(item.item.id);
  const reason = REASON_LABELS[item.reason] ?? REASON_LABELS.new;
  const prof = state.proficiency[item.item.id] ?? 0;

  const profDots = Array.from({ length: 5 }, (_, i) => {
    const filled = i < prof;
    return `<span class="prof-dot ${filled ? 'filled' : ''}"></span>`;
  }).join('');

  if (item.isCompleted) {
    return `
      <div class="queue-item completed">
        <div class="qi-main">
          <div class="qi-idiom">${esc(item.item.idiom)}</div>
          <div class="qi-pinyin">${esc(item.item.pinyin)}</div>
        </div>
        <div class="qi-done">
          <span class="done-badge">✓ 已完成</span>
          <button class="btn-undo" data-rollback="${item.completionId}">撤销</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="queue-item" data-item="${item.item.id}">
      <div class="qi-main">
        <div class="qi-idiom">${esc(item.item.idiom)}</div>
        <div class="qi-pinyin">${esc(item.item.pinyin)}</div>
        <div class="qi-meaning">${esc(item.item.meaning)}</div>
        <div class="qi-meta">
          <span class="reason-tag ${reason.cls}">${reason.text}</span>
          <span class="prof-label">熟练度</span>
          <span class="prof-dots">${profDots}</span>
        </div>
      </div>
      <div class="qi-actions">
        <button class="btn-fav ${isFav ? 'active' : ''}" data-fav="${item.item.id}" title="${isFav ? '取消收藏' : '加入收藏'}">
          ${isFav ? '★' : '☆'}
        </button>
        <div class="quality-group">
          <button class="btn-quality q-forget" data-complete="${item.item.id}" data-quality="2">忘记</button>
          <button class="btn-quality q-vague" data-complete="${item.item.id}" data-quality="3">模糊</button>
          <button class="btn-quality q-master" data-complete="${item.item.id}" data-quality="5">掌握</button>
        </div>
      </div>
    </div>
  `;
}

/** 渲染冷启动引导 */
function renderColdStart(state: StudyPlanState, handlers: StudyUIHandlers): string {
  const starters = STUDY_ITEM_POOL.filter(i =>
    ['id-szdt', 'id-kzqj', 'id-wxcd', 'id-pfcz'].includes(i.id)
  );
  return `
    <section class="cold-start-banner">
      <div class="cs-icon">📚</div>
      <h2>开启你的学习计划</h2>
      <p>你还没有收藏任何学习内容。从入门包开始，一键添加收藏，系统将依据遗忘间隔为你生成一周复习队列。</p>
      <div class="cs-starters">
        ${starters
          .map(
            s => `
          <div class="cs-starter-card">
            <div class="cs-idiom">${esc(s.idiom)}</div>
            <div class="cs-pinyin">${esc(s.pinyin)}</div>
            <button class="btn-add-starter" data-add-fav="${s.id}">+ 收藏</button>
          </div>
        `
          )
          .join('')}
      </div>
      <button class="btn-add-all" data-add-all>一键收藏全部入门包</button>
    </section>
  `;
}

/** 渲染统计面板 */
function renderStats(stats: StudyPlanStats): string {
  return `
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-val">${stats.totalItems}</div>
        <div class="stat-label">学习条目</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">${stats.favoriteCount}</div>
        <div class="stat-label">收藏</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">${stats.completedToday}</div>
        <div class="stat-label">今日完成</div>
      </div>
      <div class="stat-card">
        <div class="stat-val ${stats.overdueCount > 0 ? 'warn' : ''}">${stats.dueToday + stats.overdueCount}</div>
        <div class="stat-label">待复习</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">${stats.masteredCount}</div>
        <div class="stat-label">已掌握</div>
      </div>
    </div>
  `;
}

/** 渲染最近完成记录（可回滚） */
function renderRecentCompletions(completions: CompletionRecord[]): string {
  const recent = completions.slice(0, 5);
  if (recent.length === 0) return '';
  return `
    <section class="recent-section">
      <div class="section-title"><span>↩️ 最近完成记录（可撤销）</span></div>
      <div class="recent-list">
        ${recent
          .map(c => {
            const item = STUDY_ITEM_POOL.find(i => i.id === c.itemId);
            const time = new Date(c.completedAt);
            const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
            return `
            <div class="recent-item">
              <span class="recent-idiom">${esc(item?.idiom ?? c.itemId)}</span>
              <span class="recent-time">${c.dayKey} ${timeStr}</span>
              <span class="recent-quality">质量 ${c.quality}</span>
              <button class="btn-undo-sm" data-rollback="${c.id}">撤销</button>
            </div>
          `;
          })
          .join('')}
      </div>
    </section>
  `;
}

/** 主渲染函数 */
export function renderStudyApp(
  container: HTMLElement,
  state: StudyPlanState,
  queues: DayQueue[],
  stats: StudyPlanStats,
  isColdStart: boolean,
  handlers: StudyUIHandlers
): void {
  const weekHtml = queues
    .map((day, idx) => {
      const dayItems = day.items.map(item => renderQueueItem(item, state, handlers)).join('');
      const completedCount = day.items.filter(i => i.isCompleted).length;
      return `
        <div class="day-card ${day.isToday ? 'today' : ''}">
          <div class="day-header">
            <div class="day-name">${day.isToday ? '今天' : `周${WEEKDAY_SHORT[idx]}`}</div>
            <div class="day-date">${day.dateLabel}</div>
            ${completedCount > 0 ? `<div class="day-progress">${completedCount}/${day.items.length}</div>` : ''}
          </div>
          <div class="day-items">
            ${dayItems || '<div class="day-empty">暂无安排</div>'}
          </div>
        </div>
      `;
    })
    .join('');

  container.innerHTML = `
    <div class="study-app">
      <header class="app-header">
        <div class="brand-section">
          <div class="seal-icon">学</div>
          <div>
            <h1>学习计划生成器</h1>
            <p>STUDY PLAN GENERATOR · 依据收藏 · 熟练度 · 遗忘间隔</p>
          </div>
        </div>
      </header>

      ${renderStats(stats)}

      ${isColdStart ? renderColdStart(state, handlers) : ''}

      <section class="week-section">
        <div class="section-title">
          <span>📅 一周学习队列</span>
          <span class="stable-hint">顺序稳定 · 跨天刷新不变</span>
        </div>
        <div class="week-grid">
          ${weekHtml}
        </div>
      </section>

      ${renderRecentCompletions(state.completions)}
    </div>
  `;

  // 事件绑定
  container.querySelectorAll('[data-fav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-fav');
      if (id) handlers.onToggleFavorite(id);
    });
  });

  container.querySelectorAll('[data-complete]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-complete');
      const q = Number(btn.getAttribute('data-quality'));
      if (id) handlers.onCompleteItem(id, q);
    });
  });

  container.querySelectorAll('[data-rollback]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-rollback');
      if (id) handlers.onRollback(id);
    });
  });

  container.querySelectorAll('[data-add-fav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-add-fav');
      if (id) handlers.onToggleFavorite(id);
    });
  });

  container.querySelector('[data-add-all]')?.addEventListener('click', () => {
    handlers.onAddStarterPack();
  });
}
