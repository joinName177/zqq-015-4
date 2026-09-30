// 学习计划存储端口

import { StudyPlanState, ProficiencyLevel, CompletionRecord } from '../core/study-models';

export interface StudyStoragePort {
  /** 加载完整状态 */
  load(): StudyPlanState;

  /** 保存完整状态 */
  save(state: StudyPlanState): void;

  /** 切换收藏 */
  toggleFavorite(itemId: string): StudyPlanState;

  /** 设置熟练度 */
  setProficiency(itemId: string, level: ProficiencyLevel): StudyPlanState;

  /** 完成条目（记录完成并更新复习状态，返回新状态） */
  completeItem(itemId: string, quality: number, today: string): StudyPlanState;

  /** 回滚最近一次完成记录 */
  rollbackCompletion(completionId: string): StudyPlanState;

  /** 获取可回滚的完成记录（按时间倒序） */
  getRollbackableCompletions(): CompletionRecord[];

  /** 重置全部数据 */
  resetAll(): StudyPlanState;
}
