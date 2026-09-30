import './ui/styles.css';
import { DictionaryAdapter } from './adapters/dictionary.adapter';
import { KinshipAdapter } from './adapters/kinship.adapter';
import { LocalStorageStudyAdapter } from './adapters/study-storage.adapter';
import { IdiomCatalogAdapter } from './adapters/content-catalog.adapter';
import { IdiomProfile, KinshipResult } from './core/models';
import { systemClock } from './core/date-utils';
import { StudyPlannerService } from './core/study-service';
import { renderIdiomApp, AppMode } from './ui/app';
import { renderStudyPlan } from './ui/study-plan';

const dictAdapter = new DictionaryAdapter();
const kinshipAdapter = new KinshipAdapter();
const studyPlanner = new StudyPlannerService(
  new LocalStorageStudyAdapter(),
  new IdiomCatalogAdapter(dictAdapter),
  systemClock
);

let currentMode: AppMode = 'single';
let currentProfile: IdiomProfile;
let compareA = '守株待兔';
let compareB = '刻舟求剑';
let kinshipResult: KinshipResult | null = null;

const rootEl = document.getElementById('app')!;

async function init() {
  currentProfile = await dictAdapter.getProfile('守株待兔');
  const profA = await dictAdapter.getProfile(compareA);
  const profB = await dictAdapter.getProfile(compareB);
  kinshipResult = kinshipAdapter.compareIdioms(profA, profB);
  refreshView();
}

function renderStudy() {
  const plan = studyPlanner.getWeeklyPlan();
  renderStudyPlan(
    rootEl,
    plan,
    studyPlanner.recentEvents(),
    studyPlanner.getState().favorites,
    id => studyPlanner.resolveTitle(id),
    {
      onReview: (idiomId, rating) => {
        studyPlanner.review(idiomId, rating);
        refreshView();
      },
      onUndo: seq => {
        studyPlanner.undo(seq);
        refreshView();
      },
      onToggleFavorite: idiomId => {
        studyPlanner.toggleFavorite(idiomId);
        refreshView();
      }
    }
  );
}

function refreshView() {
  if (currentMode === 'study') {
    renderStudy();
    return;
  }

  renderIdiomApp(
    rootEl,
    currentProfile,
    dictAdapter.getPresets(),
    currentMode,
    kinshipResult,
    compareA,
    compareB,
    {
      onSearch: async (text: string) => {
        currentProfile = await dictAdapter.getProfile(text);
        kinshipResult = null;
        currentMode = 'single';
        refreshView();
      },
      onCompare: async (textA: string, textB: string) => {
        compareA = textA;
        compareB = textB;
        const pA = await dictAdapter.getProfile(textA);
        const pB = await dictAdapter.getProfile(textB);
        kinshipResult = kinshipAdapter.compareIdioms(pA, pB);
        refreshView();
      },
      onSwitchMode: (mode: AppMode) => {
        currentMode = mode;
        refreshView();
      },
      onToggleFavorite: (idiomText: string) => {
        studyPlanner.toggleFavorite(idiomText);
        refreshView();
      },
      isFavorited: (idiomText: string) => studyPlanner.isFavorited(idiomText)
    }
  );
}

init();
