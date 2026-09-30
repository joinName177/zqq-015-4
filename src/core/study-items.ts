// 学习条目池
// 以成语为学习内容，包含 4 个富条目（有完整字源/典故）与若干扩展条目。

import { StudyItem } from './study-models';

export const STUDY_ITEM_POOL: StudyItem[] = [
  {
    id: 'id-szdt',
    idiom: '守株待兔',
    pinyin: 'shǒu zhū dài tù',
    meaning: '比喻不主动努力，心存侥幸，希望得到意外收获；也比喻死守狭隘经验不知变通。'
  },
  {
    id: 'id-kzqj',
    idiom: '刻舟求剑',
    pinyin: 'kè zhōu qiú jiàn',
    meaning: '比喻死守狭隘经验，拘泥固执，不知随时间空间客观条件的变化而变化。'
  },
  {
    id: 'id-wxcd',
    idiom: '卧薪尝胆',
    pinyin: 'wò xīn cháng dǎn',
    meaning: '形容人刻苦自励，发愤图强，在极其艰难屈辱的逆境中坚韧不拔。'
  },
  {
    id: 'id-pfcz',
    idiom: '破釜沉舟',
    pinyin: 'pò fǔ chén zhōu',
    meaning: '比喻下定决心，不顾一切干到底，不留退路。'
  },
  {
    id: 'id-hlzz',
    idiom: '狐假虎威',
    pinyin: 'hú jiǎ hǔ wēi',
    meaning: '比喻依仗别人的势力欺压人，或借着别人的威势来抬高自己。'
  },
  {
    id: 'id-jrzz',
    idiom: '精卫填海',
    pinyin: 'jīng wèi tián hǎi',
    meaning: '比喻意志坚决，不畏艰难，奋斗不息；也比喻仇恨极深，立志报复。'
  },
  {
    id: 'id-kuafu',
    idiom: '夸父追日',
    pinyin: 'kuā fù zhuī rì',
    meaning: '比喻人有宏大的志向或巨大的力量和气魄，也比喻不自量力。'
  },
  {
    id: 'id-yugong',
    idiom: '愚公移山',
    pinyin: 'yú gōng yí shān',
    meaning: '比喻坚持不懈地改造自然和坚定不移地进行斗争。'
  },
  {
    id: 'id-wangyang',
    idiom: '亡羊补牢',
    pinyin: 'wáng yáng bǔ láo',
    meaning: '比喻出了问题以后想办法补救，可以防止继续受损失。'
  },
  {
    id: 'id-bingqian',
    idiom: '杯弓蛇影',
    pinyin: 'bēi gōng shé yǐng',
    meaning: '比喻因疑神疑鬼而引起恐惧，妄自惊慌。'
  },
  {
    id: 'id-canghai',
    idiom: '沧海桑田',
    pinyin: 'cāng hǎi sāng tián',
    meaning: '比喻世事变化巨大，或比喻世事变迁之速。'
  },
  {
    id: 'id-dongshi',
    idiom: '东施效颦',
    pinyin: 'dōng shī xiào pín',
    meaning: '比喻胡乱模仿，效果极坏，有时也作自谦之词。'
  }
];

/** 冷启动推荐条目（初学者入门包） */
export const STARTER_PACK_IDS = ['id-szdt', 'id-kzqj', 'id-wxcd', 'id-pfcz'];

/** 按 id 查找学习条目 */
export function findStudyItem(id: string): StudyItem | undefined {
  return STUDY_ITEM_POOL.find(item => item.id === id);
}
