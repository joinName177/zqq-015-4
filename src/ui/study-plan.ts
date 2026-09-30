import { WeeklyPlan, StudyEvent, Rating } from '../core/study-models';

export interface StudyUIHandlers {
  onReview: (idiomId: string, rating: Rating) => void;
  onUndo: (seq: number) => void;
  onToggleFavorite: (idiomId: string) => void;
}

const CATEGORY_LABEL: Record<string, string> = {
  overdue: '逾期复习',
  due: '今日到期',
  new: '新内容',
  upcoming: '预排'
};

const RATING_LABELS: { value: Rating; label: string; cls: string }[] = [
  { value: 'again', label: '忘了', cls: 'rating-again' },
  { value: 'hard', label: '困难', cls: 'rating-hard' },
  { value: 'good', label: '记得', cls: 'rating-good' },
  { value: 'easy', label: '熟练', cls: 'rating-easy' }
];

function esc(s: string): string {
  return s.replace(/[&<>'"]/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t] || t));
}

function proficiencyDots(level: number): string {
  return Array.from({ length: 5 }, (_, i) => `<span class="prof-dot ${i < level ? 'on' : ''}"></span>`).join('');
}

function eventText(e: StudyEvent): string {
  if (e.type === 'reviewed') {
    const rating = { again: '忘了', hard: '困难', good: '记得', easy: '熟练' }[e.rating ?? 'good'];
    return `完成复习《${esc(e.idiomId)}》· 评分【${rating}】`;
  }
  if (e.type === 'favoriteAdded') return `收藏《${esc(e.idiomId)}》`;
  return `取消收藏《${esc(e.idiomId)}》`;
}

export function renderStudyPlan(
  container: HTMLElement,
  plan: WeeklyPlan,
  events: StudyEvent[],
  favoriteIds: string[],
  resolveTitle: (id: string) => string,
  handlers: StudyUIHandlers
): void {
  const percent = plan.totalCount === 0 ? 0 : Math.round((plan.completedCount / plan.totalCount) * 100);

  container.innerHTML = `
    <div class="study-app">
      <section class="study-hero">
        <div class="section-title"><span>🗓️ 本周学习队列</span></div>
        <p class="study-sub">
          ${plan.weekStart} ~ ${plan.weekEnd} · 依据收藏、熟练度与遗忘间隔生成，队列已冻结，跨天刷新顺序不变
        </p>
        <div class="study-progress-bar">
          <div class="study-progress-fill" style="width:${percent}%"></div>
        </div>
        <div class="study-progress-meta">
          已完成 <strong>${plan.completedCount}</strong> / ${plan.totalCount}
          ${plan.coldStart ? '<span class="cold-badge">冷启动 · 推荐内容</span>' : ''}
        </div>
        ${
          plan.coldStart
            ? `<div class="cold-notice">还没有收藏内容。已为你从经典成语库中预置本周学习单；在单词模式点击 ★ 收藏后，下周将完全按你的收藏排期。</div>`
            : ''
        }
      </section>

      <section class="study-days">
        ${plan.days
          .map(
            day => `
          <article class="study-day ${day.isToday ? 'is-today' : ''} ${day.items.length === 0 ? 'is-empty' : ''}">
            <header class="study-day-head">
              <span class="study-day-name">${day.weekday}${day.isToday ? ' · 今天' : ''}</span>
              <span class="study-day-date">${day.date.slice(5)}</span>
            </header>
            ${
              day.items.length === 0
                ? '<div class="study-day-empty">无安排</div>'
                : day.items
                    .map(
                      item => `
              <div class="study-card ${item.completed ? 'is-done' : ''}" data-item-id="${esc(item.idiomId)}">
                <div class="study-card-top">
                  <span class="study-card-title">${esc(resolveTitle(item.idiomId))}</span>
                  <button class="fav-btn ${favoriteIds.includes(item.idiomId) ? 'on' : ''}" data-fav="${esc(item.idiomId)}"
                          title="${favoriteIds.includes(item.idiomId) ? '取消收藏（下周生效）' : '收藏（下周生效）'}">★</button>
                </div>
                <div class="study-card-meta">
                  <span class="plan-tag tag-${item.category}">${CATEGORY_LABEL[item.category]}</span>
                  ${item.kind === 'cold' ? '<span class="plan-tag tag-cold">推荐</span>' : ''}
                  <span class="prof-line">熟练度 ${proficiencyDots(item.proficiency)}</span>
                </div>
                <div class="study-card-due">到期 ${item.due}${item.intervalDays > 0 ? ` · 间隔 ${item.intervalDays} 天` : ''}</div>
                ${
                  item.completed
                    ? `<div class="done-row">
                         <span class="done-label">✓ 已完成</span>
                         <button class="btn-undo-card" data-undo-seq="${item.completedEventSeq}">撤销完成</button>
                       </div>`
                    : `<div class="rating-row">
                         ${RATING_LABELS.map(
                           r =>
                             `<button class="rating-btn ${r.cls}" data-rating="${r.value}" data-idiom="${esc(item.idiomId)}">${r.label}</button>`
                         ).join('')}
                       </div>`
                }
              </div>`
                    )
                    .join('')
            }
          </article>`
          )
          .join('')}
      </section>

      <section class="event-log-panel">
        <div class="section-title"><span>🕘 完成记录（可回滚）</span></div>
        ${
          events.length === 0
            ? '<p class="study-sub">暂无完成记录。点击上面的评分按钮即可记录一次复习。</p>'
            : `<ul class="event-log">
                ${events
                  .map(
                    e => `
                  <li>
                    <span class="event-text">${eventText(e)}</span>
                    <span class="event-date">${e.date}</span>
                    <button class="btn-undo-event" data-undo-seq="${e.seq}">回滚</button>
                  </li>`
                  )
                  .join('')}
              </ul>`
        }
      </section>
    </div>
  `;

  container.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      handlers.onReview(btn.getAttribute('data-idiom')!, btn.getAttribute('data-rating') as Rating);
    });
  });
  container.querySelectorAll('.btn-undo-card, .btn-undo-event').forEach(btn => {
    btn.addEventListener('click', () => {
      handlers.onUndo(Number(btn.getAttribute('data-undo-seq')));
    });
  });
  container.querySelectorAll('.fav-btn').forEach(btn => {
    btn.addEventListener('click', () => handlers.onToggleFavorite(btn.getAttribute('data-fav')!));
  });
}
