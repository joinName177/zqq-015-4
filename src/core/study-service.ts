import { Rating, StudyEvent, StudyState, WeeklyPlan } from './study-models';
import { Clock } from './date-utils';
import { addFavorite, getWeeklyPlan, recordReview, removeFavorite, undoEvent, undoLast } from './study-scheduler';
import { StudyStatePort } from '../ports/study-state.port';
import { ContentCatalogPort } from '../ports/content-catalog.port';

export class StudyPlannerService {
  private state: StudyState;

  constructor(
    private readonly store: StudyStatePort,
    private readonly catalog: ContentCatalogPort,
    private readonly clock: Clock
  ) {
    this.state = store.load();
  }

  getState(): StudyState {
    return this.state;
  }

  isFavorited(idiomId: string): boolean {
    return this.state.favorites.includes(idiomId);
  }

  /** 生成本周计划（幂等：本周已冻结则直接读取快照） */
  getWeeklyPlan(): WeeklyPlan {
    const { state, plan } = getWeeklyPlan(this.state, this.catalog.listCatalogIds(), this.clock.today());
    this.commit(state);
    return plan;
  }

  /** 完成一次复习并按评分更新熟练度与遗忘间隔 */
  review(idiomId: string, rating: Rating): StudyEvent {
    const { state, event } = recordReview(this.state, idiomId, rating, this.clock.today(), new Date().toISOString());
    this.commit(state);
    return event;
  }

  addFavorite(idiomId: string): void {
    this.commit(addFavorite(this.state, idiomId, this.clock.today(), new Date().toISOString()));
  }

  removeFavorite(idiomId: string): void {
    this.commit(removeFavorite(this.state, idiomId, this.clock.today(), new Date().toISOString()));
  }

  toggleFavorite(idiomId: string): boolean {
    if (this.isFavorited(idiomId)) {
      this.removeFavorite(idiomId);
      return false;
    }
    this.addFavorite(idiomId);
    return true;
  }

  /** 回滚最近一条完成 / 收藏记录 */
  undoLast(): StudyEvent | undefined {
    const { state, event } = undoLast(this.state);
    this.commit(state);
    return event;
  }

  /** 回滚指定记录（流水面板中可点任意一条） */
  undo(seq: number): StudyEvent | undefined {
    const { state, event } = undoEvent(this.state, seq);
    this.commit(state);
    return event;
  }

  /** 最近流水（倒序），供回滚面板展示 */
  recentEvents(limit = 20): StudyEvent[] {
    return [...this.state.events].sort((a, b) => b.seq - a.seq).slice(0, limit);
  }

  resolveTitle(idiomId: string): string {
    return this.catalog.resolveTitle(idiomId);
  }

  private commit(state: StudyState): void {
    this.state = state;
    this.store.save(state);
  }
}
