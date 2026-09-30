import { StudyState } from '../core/study-models';

export interface StudyStatePort {
  load(): StudyState;
  save(state: StudyState): void;
}
