import './ui/styles.css';
import { DictionaryAdapter } from './adapters/dictionary.adapter';
import { KinshipAdapter } from './adapters/kinship.adapter';
import { StudyStorageAdapter } from './adapters/study-storage.adapter';
import { IdiomProfile, KinshipResult } from './core/models';
import { renderIdiomApp } from './ui/app';
import { renderStudyApp } from './ui/study-app';
import { generateWeekQueue, generateStats, isColdStart } from './core/study-planner';
import { toDayKey } from './core/spaced-repetition';
import { STARTER_PACK_IDS } from './core/study-items';

const dictAdapter = new DictionaryAdapter();
const kinshipAdapter = new KinshipAdapter();
const studyStorage = new StudyStorageAdapter();

type AppMode = 'single' | 'compare' | 'study';

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

function refreshView() {
  if (currentMode === 'study') {
    renderStudyView();
  } else {
    renderIdiomView();
  }
  injectModeSwitcher();
}

function renderIdiomView() {
  renderIdiomApp(
    rootEl,
    currentProfile,
    dictAdapter.getPresets(),
    currentMode === 'single' ? 'single' : 'compare',
    kinshipResult,
    compareA,
    compareB,
    {
      onSearch: async (text: string) => {
        currentProfile = await dictAdapter.getProfile(text);
        kinshipResult = null;
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
      onSwitchMode: (mode: 'single' | 'compare') => {
        currentMode = mode;
        refreshView();
      }
    }
  );
}

function renderStudyView() {
  const state = studyStorage.getState();
  const queues = generateWeekQueue(state);
  const stats = generateStats(state);
  const cold = isColdStart(state);

  renderStudyApp(rootEl, state, queues, stats, cold, {
    onToggleFavorite: (itemId: string) => {
      studyStorage.toggleFavorite(itemId);
      refreshView();
    },
    onCompleteItem: (itemId: string, quality: number) => {
      const today = toDayKey(new Date());
      studyStorage.completeItem(itemId, quality, today);
      refreshView();
    },
    onRollback: (completionId: string) => {
      studyStorage.rollbackCompletion(completionId);
      refreshView();
    },
    onAddStarterPack: () => {
      STARTER_PACK_IDS.forEach(id => {
        if (!studyStorage.getState().favorites.includes(id)) {
          studyStorage.toggleFavorite(id);
        }
      });
      refreshView();
    }
  });
}

/** 注入全局模式切换器到 header（替换各视图内部的切换器，避免重复） */
function injectModeSwitcher() {
  const header = document.querySelector('.app-header');
  if (!header) return;
  // 移除所有已存在的切换器（成语 app 内部的 + 全局的）
  header.querySelectorAll('.mode-toggle').forEach(el => el.remove());

  const switcher = document.createElement('div');
  switcher.id = 'global-mode-switch';
  switcher.className = 'mode-toggle';
  switcher.innerHTML = `
    <button class="mode-btn ${currentMode === 'single' ? 'active' : ''}" data-mode="single">字源图谱</button>
    <button class="mode-btn ${currentMode === 'compare' ? 'active' : ''}" data-mode="compare">亲缘对比</button>
    <button class="mode-btn ${currentMode === 'study' ? 'active' : ''}" data-mode="study">学习计划</button>
  `;
  header.appendChild(switcher);

  switcher.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentMode = btn.getAttribute('data-mode') as AppMode;
      refreshView();
    });
  });
}

init();
