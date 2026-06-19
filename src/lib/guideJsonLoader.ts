import { invoke } from "@tauri-apps/api/core";
import type { ScanGuideSet } from "../types/scanPsd";
import type { Guide } from "../types";

/**
 * プリセットJSON / scandata JSON からガイドセット一覧を抽出する（スキャナー準拠）。
 * - プリセットJSON: `presetData.guideSets`
 * - scandata JSON : トップレベル `guideSets`
 * - 単一ガイドのみ: `presetData.guides`（{horizontal, vertical}）をフォールバックで1セット化
 */
export function extractGuideSetsFromJson(content: string): ScanGuideSet[] {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    return [];
  }

  const sets: ScanGuideSet[] = [];
  const toNums = (a: unknown): number[] =>
    Array.isArray(a) ? a.map(Number).filter((n) => Number.isFinite(n)) : [];

  const pushList = (arr: unknown) => {
    if (!Array.isArray(arr)) return;
    for (const g of arr) {
      if (g && typeof g === "object" && "horizontal" in g && "vertical" in g) {
        const gg = g as Record<string, unknown>;
        sets.push({
          horizontal: toNums(gg.horizontal),
          vertical: toNums(gg.vertical),
          count: typeof gg.count === "number" ? gg.count : 0,
          docNames: Array.isArray(gg.docNames) ? (gg.docNames as string[]) : [],
          docWidth: typeof gg.docWidth === "number" ? gg.docWidth : 0,
          docHeight: typeof gg.docHeight === "number" ? gg.docHeight : 0,
        });
      }
    }
  };

  const d = data as Record<string, unknown> | null;
  const presetData = d?.presetData as Record<string, unknown> | undefined;
  pushList(presetData?.guideSets);
  pushList(d?.guideSets);

  // 単一ガイドのフォールバック
  if (sets.length === 0) {
    const single = presetData?.guides as Record<string, unknown> | undefined;
    if (single && Array.isArray(single.horizontal) && Array.isArray(single.vertical)) {
      sets.push({
        horizontal: toNums(single.horizontal),
        vertical: toNums(single.vertical),
        count: 0,
        docNames: [],
        docWidth: 0,
        docHeight: 0,
      });
    }
  }

  return sets;
}

/**
 * ScanGuideSet を ガイド編集用の Guide[] に変換する。
 * canvas を渡し、かつガイドセットに docWidth/docHeight があれば、その比率で
 * キャンバスサイズへスケールする（同サイズなら等倍＝無変換）。
 */
export function guideSetToGuides(
  gs: ScanGuideSet,
  canvas?: { width: number; height: number },
): Guide[] {
  const sx = canvas && gs.docWidth > 0 ? canvas.width / gs.docWidth : 1;
  const sy = canvas && gs.docHeight > 0 ? canvas.height / gs.docHeight : 1;
  const guides: Guide[] = [];
  for (const h of gs.horizontal) {
    guides.push({ direction: "horizontal", position: Math.round(h * sy) });
  }
  for (const v of gs.vertical) {
    guides.push({ direction: "vertical", position: Math.round(v * sx) });
  }
  return guides;
}

/**
 * ガイドセットをプリセットJSONへ保存する（スキャナー互換の `presetData.guideSets`／`guides`）。
 * 連動 scandata があれば同様に書き戻す。手動ガイドの保存用なので guideSets は置き換える。
 */
export async function saveGuideSetToJson(
  jsonPath: string,
  guideSet: ScanGuideSet,
): Promise<void> {
  // presetData.guideSets（ガイドタブ/プリセット用）と トップレベル guideSets
  // （スキャナーのガイドタブが scandata から読む場所）の両方へ書く。
  // 片方だけだと「保存したのに反映されない」状態になる。
  const apply = (data: Record<string, unknown>) => {
    const pd = (data.presetData ?? (data.presetData = {})) as Record<string, unknown>;
    pd.guideSets = [guideSet];
    pd.guides = { horizontal: guideSet.horizontal, vertical: guideSet.vertical };
    pd.selectedGuideSetIndex = 0;
    // スキャナー(loadFromScandata)はトップレベル guideSets を読むため、こちらにも反映
    data.guideSets = [guideSet];
    data.selectedGuideSetIndex = 0;
    return data;
  };

  const writeJson = async (path: string) => {
    const content = await invoke<string>("read_text_file", { filePath: path });
    const data = apply(JSON.parse(content));
    await invoke("write_text_file", { filePath: path, content: JSON.stringify(data, null, 4) });
    return data;
  };

  const data = await writeJson(jsonPath);

  // 連動 scandata（saveDataPath）へも反映（無い/読めない場合のみ無視）
  const pd = data.presetData as Record<string, unknown> | undefined;
  const saveDataPath = (pd?.saveDataPath as string) || (data.saveDataPath as string);
  if (saveDataPath && saveDataPath !== jsonPath) {
    try {
      await writeJson(saveDataPath);
    } catch {
      /* 連動 scandata が無い/読めない場合は無視（本体JSONは保存済み） */
    }
  }
}
