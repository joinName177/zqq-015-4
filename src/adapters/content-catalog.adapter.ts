import { ContentCatalogPort } from '../ports/content-catalog.port';
import { IdiomRepositoryPort } from '../ports/idiom-repository.port';

/**
 * 复用字典适配器：预置成语即冷启动目录，自定义搜索的成语也可直接收藏。
 * id 即成语文本本身，resolveTitle 在没有更丰富资料时回退为 id。
 */
export class IdiomCatalogAdapter implements ContentCatalogPort {
  constructor(private readonly dictionary: IdiomRepositoryPort) {}

  listCatalogIds(): string[] {
    return this.dictionary.getPresets();
  }

  resolveTitle(idiomId: string): string {
    return idiomId;
  }
}
