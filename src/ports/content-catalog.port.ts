/** 可学习内容目录（冷启动种子 + 标题解析） */
export interface ContentCatalogPort {
  /** 内容 id 列表，顺序即冷启动时的候选兜底顺序 */
  listCatalogIds(): string[];
  resolveTitle(idiomId: string): string;
}
