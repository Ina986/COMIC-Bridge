import { useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { useScanPsdStore } from "../store/scanPsdStore";
import type {
  ScanData,
  ScanGuideSet,
  PresetJsonData,
  ScanWorkInfo,
  FontPreset,
  RubyEntry,
} from "../types/scanPsd";

/**
 * タチキリガイドセットとして有効か判定（元スクリプト isValidTachikiriGuideSet 準拠）
 * - ドキュメント中心の上下左右にそれぞれ1本以上のガイドが必要
 * - 中心から±1pxの位置にあるガイドは除外
 */
function isValidTachikiriGuideSet(gs: ScanGuideSet): boolean {
  if (!gs.docWidth || !gs.docHeight) return true; // 後方互換性
  const centerX = gs.docWidth / 2;
  const centerY = gs.docHeight / 2;
  const tolerance = 1;

  let hasAbove = false, hasBelow = false;
  for (const h of gs.horizontal) {
    if (Math.abs(h - centerY) <= tolerance) continue;
    if (h < centerY) hasAbove = true;
    else hasBelow = true;
  }

  let hasLeft = false, hasRight = false;
  for (const v of gs.vertical) {
    if (Math.abs(v - centerX) <= tolerance) continue;
    if (v < centerX) hasLeft = true;
    else hasRight = true;
  }

  return hasAbove && hasBelow && hasLeft && hasRight;
}

/**
 * ガイドセットをソートし最適なものを自動選択（元スクリプト準拠）
 * 優先順位: 1) 有効なタチキリガイドが先  2) 使用回数が多い順
 * ソート後のインデックス0を自動選択
 */
function autoSelectGuideSet(guideSets: ScanGuideSet[]): number | null {
  if (guideSets.length === 0) return null;

  // インデックス付きでソート
  const indexed = guideSets.map((gs, i) => ({ gs, originalIndex: i }));
  indexed.sort((a, b) => {
    const aValid = isValidTachikiriGuideSet(a.gs) ? 1 : 0;
    const bValid = isValidTachikiriGuideSet(b.gs) ? 1 : 0;
    if (aValid !== bValid) return bValid - aValid;
    return b.gs.count - a.gs.count;
  });

  return indexed[0].originalIndex;
}

/**
 * プリセットJSON保存の実処理（スタンドアロン関数）
 * startScan完了後の自動保存からも呼ばれる
 */
async function performPresetJsonSave(): Promise<boolean> {
  const store = useScanPsdStore.getState();
  const { workInfo, jsonFolderPath } = store;

  const hasRequiredInfo = !!(workInfo.title && workInfo.label);
  let filePath: string;

  if (hasRequiredInfo) {
    const safeLabel = workInfo.label.replace(/[\\/:*?"<>|]/g, "_");
    const safeTitle = workInfo.title.replace(/[\\/:*?"<>|]/g, "_");
    filePath = `${jsonFolderPath}/${safeLabel}/${safeTitle}.json`.replace(/\\/g, "/");
  } else {
    filePath = `${jsonFolderPath}/_仮保存/temp.json`.replace(/\\/g, "/");
  }

  // 旧ファイルを削除（タイトル/レーベル変更でパスが変わった場合）
  const oldPath = store.currentJsonFilePath;
  if (oldPath && oldPath !== filePath) {
    try { await invoke("delete_file", { filePath: oldPath }); } catch { /* ignore */ }
  }
  const oldTempPath = store.tempJsonFilePath;
  if (oldTempPath && oldTempPath !== filePath) {
    try { await invoke("delete_file", { filePath: oldTempPath }); } catch { /* ignore */ }
  }

  // 既存ファイルを読み込んでマージ
  let existingData: PresetJsonData = { presetData: {} };
  try {
    const existing = await invoke<string>("read_text_file", { filePath });
    if (existing) {
      existingData = JSON.parse(existing);
    }
  } catch {
    /* new file */
  }

  const selectedGuide =
    store.selectedGuideIndex != null && store.scanData?.guideSets[store.selectedGuideIndex]
      ? store.scanData.guideSets[store.selectedGuideIndex]
      : undefined;

  const presetData = {
    ...existingData.presetData,
    workInfo: store.workInfo,
    presets: store.presetSets,
    fontSizeStats: store.scanData?.sizeStats,
    strokeSizes: store.scanData?.strokeStats.sizes,
    guides: selectedGuide
      ? { horizontal: selectedGuide.horizontal, vertical: selectedGuide.vertical }
      : existingData.presetData?.guides,
    guideSets: undefined,
    selectedGuideSetIndex: store.selectedGuideIndex ?? undefined,
    excludedGuideIndices: undefined,
    rubyList: store.rubyList.length > 0 ? store.rubyList : undefined,
  };

  const outputData: PresetJsonData = {
    ...existingData,
    presetData,
  };

  await invoke("write_text_file", {
    filePath,
    content: JSON.stringify(outputData, null, 2),
  });

  if (hasRequiredInfo) {
    store.setCurrentJsonFilePath(filePath);
    store.setTempJsonFilePath(null);
    store.setPendingTitleLabel(false);

    if (store.scanData) {
      try {
        await saveScandataLinked(store);
      } catch (e) {
        console.error("Linked scandata save failed:", e);
      }
    }
    const oldTempScandata = store.tempScandataFilePath;
    if (oldTempScandata) {
      try { await invoke("delete_file", { filePath: oldTempScandata }); } catch { /* ignore */ }
      store.setTempScandataFilePath(null);
    }
  } else {
    store.setTempJsonFilePath(filePath);
    store.setCurrentJsonFilePath(null);
    store.setPendingTitleLabel(true);

    if (store.scanData) {
      const tempScandataPath = `${store.saveDataBasePath}/_仮保存/temp_scandata.json`.replace(/\\/g, "/");
      const scandataContent = {
        ...store.scanData,
        workInfo: store.workInfo,
        presets: store.presetSets,
        editedRubyList: store.rubyList.length > 0 ? store.rubyList : undefined,
        selectedGuideSetIndex: store.selectedGuideIndex,
        excludedGuideIndices: store.excludedGuideIndices.size > 0
          ? Array.from(store.excludedGuideIndices)
          : undefined,
      };
      const oldTempSd = store.tempScandataFilePath;
      if (oldTempSd && oldTempSd !== tempScandataPath) {
        try { await invoke("delete_file", { filePath: oldTempSd }); } catch { /* ignore */ }
      }
      await invoke("write_text_file", {
        filePath: tempScandataPath,
        content: JSON.stringify(scandataContent),
      });
      store.setTempScandataFilePath(tempScandataPath);
    }
  }

  return hasRequiredInfo;
}

/**
 * JSON保存に連動してscandataを自動保存する
 * パス: {saveDataBasePath}/{label}/{title}_scandata.json
 * 元スクリプトの saveScanDataWithInfo と同じパス規則
 */
async function saveScandataLinked(store: ReturnType<typeof useScanPsdStore.getState>) {
  const { workInfo, scanData, presetSets, rubyList, saveDataBasePath } = store;
  if (!scanData || !workInfo.title || !workInfo.label) return;

  const safeLabel = workInfo.label.replace(/[\\/:*?"<>|]/g, "_");
  const safeTitle = workInfo.title.replace(/[\\/:*?"<>|]/g, "_");

  const labelFolderPath = `${saveDataBasePath}/${safeLabel}`.replace(/\\/g, "/");
  const fileName = `${safeTitle}_scandata.json`;
  const scandataPath = `${labelFolderPath}/${fileName}`;

  // 旧scandataを削除（タイトル/レーベル変更でパスが変わった場合）
  const oldPath = store.currentScandataFilePath;
  if (oldPath && oldPath !== scandataPath) {
    try {
      await invoke("delete_file", { filePath: oldPath });
    } catch {
      // 旧ファイル削除失敗は無視
    }
  }

  const data = {
    ...scanData,
    workInfo,
    presets: presetSets,
    editedRubyList: rubyList.length > 0 ? rubyList : undefined,
    // ガイド選択・除外状態もscandataに保存
    selectedGuideSetIndex: store.selectedGuideIndex,
    excludedGuideIndices: store.excludedGuideIndices.size > 0
      ? Array.from(store.excludedGuideIndices)
      : undefined,
    saveDataPath: scandataPath,
    label: workInfo.label,
    title: workInfo.title,
  };

  // write_text_file は親フォルダを自動作成する
  await invoke("write_text_file", {
    filePath: scandataPath,
    content: JSON.stringify(data),
  });

  store.setCurrentScandataFilePath(scandataPath);
}

export function useScanPsdProcessor() {
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- スキャン実行 ---
  const startScan = useCallback(async () => {
    const store = useScanPsdStore.getState();
    if (store.folders.length === 0) return;

    store.setPhase("scanning");
    store.setProgress(0, 0, "Photoshopを起動中...");

    const settingsJson = JSON.stringify({
      folders: store.folders.map((f) => ({
        path: f.path.replace(/\\/g, "/"),
        volume: f.volume,
      })),
      existingScanData: store.scanData,
      outputPath: null, // Rust側でtemp_dirを使用
    });

    // Poll progress
    pollingRef.current = setInterval(async () => {
      try {
        const progressJson = await invoke<string | null>(
          "poll_scan_psd_progress"
        );
        if (progressJson) {
          const p = JSON.parse(progressJson);
          useScanPsdStore
            .getState()
            .setProgress(p.current || 0, p.total || 0, p.message || "");
        }
      } catch {
        /* ignore polling errors */
      }
    }, 500);

    try {
      // スキャン前のworkInfoを保持（ユーザーが事前入力した情報を消さない）
      const preExistingWorkInfo = { ...store.workInfo };

      const resultJson = await invoke<string>("run_photoshop_scan_psd", {
        settingsJson,
      });
      const scanData = JSON.parse(resultJson) as ScanData;

      // ユーザーが事前入力したworkInfoをscanDataに反映（元スクリプト準拠）
      // スキャン結果のworkInfoは空のデフォルト値なので、ユーザー入力値で上書き
      const mergedWorkInfo: ScanWorkInfo = { ...preExistingWorkInfo };
      // スキャン結果側に値がある場合のみマージ（空文字でない場合）
      if (scanData.workInfo) {
        const scanWi = scanData.workInfo as unknown as Record<string, unknown>;
        const preWi = preExistingWorkInfo as unknown as Record<string, unknown>;
        const merged = mergedWorkInfo as unknown as Record<string, unknown>;
        for (const key of Object.keys(scanWi)) {
          // ユーザーが事前入力していない項目のみスキャン結果で埋める
          if (!preWi[key] && scanWi[key]) {
            merged[key] = scanWi[key];
          }
        }
      }
      scanData.workInfo = mergedWorkInfo;

      store.setScanData(scanData);
      store.setWorkInfo(mergedWorkInfo);

      if (scanData.editedRubyList) {
        store.setRubyList(scanData.editedRubyList);
      }

      // ガイドセットの自動選択（元スクリプト準拠: 有効タチキリ優先 → 使用回数順）
      if (scanData.guideSets && scanData.guideSets.length > 0) {
        const bestIndex = autoSelectGuideSet(scanData.guideSets);
        if (bestIndex != null) {
          useScanPsdStore.getState().setSelectedGuideIndex(bestIndex);
        }
      }

      // スキャン完了後に自動保存
      try {
        await performPresetJsonSave();
      } catch (e) {
        console.error("Auto save after scan failed:", e);
      }
    } catch (e) {
      console.error("Scan PSD failed:", e);
    } finally {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      useScanPsdStore.getState().setPhase("idle");
    }
  }, []);

  // --- プリセットJSON保存（パス自動計算 + 仮保存対応） ---
  const savePresetJson = useCallback(async (): Promise<boolean> => {
    useScanPsdStore.getState().setPhase("saving");
    try {
      return await performPresetJsonSave();
    } catch (e) {
      console.error("Save preset JSON failed:", e);
      throw e;
    } finally {
      useScanPsdStore.getState().setPhase("idle");
    }
  }, []);

  // --- プリセットJSON読み込み ---
  const loadPresetJson = useCallback(async (filePath: string) => {
    const store = useScanPsdStore.getState();

    try {
      const content = await invoke<string>("read_text_file", { filePath });
      const data = JSON.parse(content) as PresetJsonData;
      store.loadFromPresetJson(data);
      store.setCurrentJsonFilePath(filePath);

      // リンクされたscandataを自動読み込み（全ガイドセット等を復元するため）
      const pd = data.presetData;
      if (pd?.workInfo?.label && pd?.workInfo?.title) {
        const safeLabel = pd.workInfo.label.replace(/[\\/:*?"<>|]/g, "_");
        const safeTitle = pd.workInfo.title.replace(/[\\/:*?"<>|]/g, "_");
        const scandataPath = `${store.saveDataBasePath}/${safeLabel}/${safeTitle}_scandata.json`.replace(/\\/g, "/");
        try {
          const scandataContent = await invoke<string>("read_text_file", { filePath: scandataPath });
          const scandataData = JSON.parse(scandataContent) as ScanData;
          store.setScanData(scandataData);
          store.setCurrentScandataFilePath(scandataPath);
          // scandataからガイド選択・除外状態を復元
          const sd = scandataData as ScanData & {
            selectedGuideSetIndex?: number;
            excludedGuideIndices?: number[];
          };
          if (sd.selectedGuideSetIndex != null) {
            store.setSelectedGuideIndex(sd.selectedGuideSetIndex);
          }
          if (sd.excludedGuideIndices) {
            store.setExcludedGuideIndices(new Set(sd.excludedGuideIndices));
          }
        } catch {
          // scandataが見つからない場合、JSON内のguideSetsから最小限のscanDataを構築
          if (pd.guideSets && pd.guideSets.length > 0) {
            // 元スクリプトのfontSizeStatsはアプリと異なるフォーマットの可能性あり
            // mostFrequent: number (元) → {size,count}|null (アプリ)
            // sizes: number[] (元) → {size,count}[] (アプリ)
            // top10Sizes: {size,count}[] (元) → 存在しない (アプリ)
            const rawStats = pd.fontSizeStats as Record<string, unknown> | undefined;
            let sizeStats: ScanData["sizeStats"] = { mostFrequent: null, sizes: [], excludeRange: null, allSizes: {} };
            if (rawStats) {
              const mf = rawStats.mostFrequent;
              sizeStats.mostFrequent =
                typeof mf === "number"
                  ? { size: mf, count: 0 }
                  : (mf as ScanData["sizeStats"]["mostFrequent"]) ?? null;
              const rawSizes = rawStats.sizes;
              if (Array.isArray(rawSizes)) {
                sizeStats.sizes = rawSizes.map((s: unknown) =>
                  typeof s === "number" ? { size: s, count: 0 } : (s as { size: number; count: number })
                );
              }
              const rawTop10 = rawStats.top10Sizes;
              if (Array.isArray(rawTop10) && sizeStats.sizes.every((s) => s.count === 0)) {
                // top10Sizesからcount情報を補完
                const countMap = new Map<number, number>();
                for (const t of rawTop10 as { size: number; count: number }[]) {
                  countMap.set(t.size, t.count);
                }
                sizeStats.sizes = sizeStats.sizes.map((s) => ({
                  ...s,
                  count: countMap.get(s.size) ?? 0,
                }));
                if (typeof mf === "number" && countMap.has(mf)) {
                  sizeStats.mostFrequent = { size: mf, count: countMap.get(mf)! };
                }
              }
              sizeStats.excludeRange = (rawStats.excludeRange as ScanData["sizeStats"]["excludeRange"]) ?? null;
              sizeStats.allSizes = (rawStats.allSizes as Record<string, number>) ?? {};
            }

            // strokeSizesも元スクリプトではcountが無い場合がある
            const rawStrokes = pd.strokeSizes ?? [];
            const safeStrokes = rawStrokes.map((s) => ({
              ...s,
              count: s.count ?? 0,
            }));

            const fallbackScanData: ScanData = {
              fonts: [],
              sizeStats,
              allFontSizes: {},
              strokeStats: { sizes: safeStrokes },
              guideSets: pd.guideSets,
              textLayersByDoc: {},
              scannedFolders: {},
              processedFiles: 0,
              workInfo: pd.workInfo ?? store.workInfo,
              textLogByFolder: {},
            };
            store.setScanData(fallbackScanData);
          }
        }
      }
    } catch (e) {
      console.error("Load preset JSON failed:", e);
      throw e;
    }
  }, []);

  // --- scandata保存 ---
  const saveScandata = useCallback(async (filePath: string) => {
    const store = useScanPsdStore.getState();
    store.setPhase("saving");

    try {
      const data: ScanData & {
        presets?: Record<string, FontPreset[]>;
        editedRubyList?: RubyEntry[];
        editedWorkInfo?: ScanWorkInfo;
      } = {
        ...(store.scanData || ({} as ScanData)),
        workInfo: store.workInfo,
        presets: store.presetSets,
        editedRubyList: store.rubyList,
      };

      await invoke("write_text_file", {
        filePath,
        content: JSON.stringify(data, null, 2),
      });

      store.setCurrentScandataFilePath(filePath);
    } catch (e) {
      console.error("Save scandata failed:", e);
      throw e;
    } finally {
      useScanPsdStore.getState().setPhase("idle");
    }
  }, []);

  // --- scandata読み込み ---
  const loadScandata = useCallback(async (filePath: string) => {
    const store = useScanPsdStore.getState();

    try {
      const content = await invoke<string>("read_text_file", { filePath });
      const data = JSON.parse(content) as ScanData;
      store.loadFromScandata(data);
      store.setCurrentScandataFilePath(filePath);
    } catch (e) {
      console.error("Load scandata failed:", e);
      throw e;
    }
  }, []);

  // --- テキストログ出力 ---
  const exportTextLog = useCallback(async () => {
    const store = useScanPsdStore.getState();
    if (!store.scanData?.textLogByFolder) return;

    const basePath = store.textLogFolderPath;
    const workInfo = store.workInfo;
    store.setPhase("exporting");

    try {
      // テキストログをフォルダごとに出力
      for (const [folderKey, pages] of Object.entries(
        store.scanData.textLogByFolder
      )) {
        const folderName = folderKey.split(/[\\/]/).pop() || folderKey;
        const lines: string[] = [];

        // ヘッダー
        lines.push(`# テキストログ: ${workInfo.title || folderName}`);
        lines.push(
          `# 出力日時: ${new Date().toLocaleString("ja-JP")}`
        );
        lines.push("");

        // ページごと
        const sortedPages = Object.entries(pages).sort(([a], [b]) =>
          a.localeCompare(b, "ja", { numeric: true })
        );
        for (const [pageName, entries] of sortedPages) {
          lines.push(`## ${pageName}`);
          const sorted = [...entries].sort((a, b) => a.yPos - b.yPos);
          for (const entry of sorted) {
            const prefix = entry.isLinked ? `[ルビ:${entry.linkGroupId}] ` : "";
            lines.push(`${prefix}${entry.content}`);
          }
          lines.push("");
        }

        const titlePrefix = workInfo.title
          ? `${workInfo.title}_`
          : "";
        const logFileName = `${titlePrefix}${folderName}_テキストログ.txt`;
        const logPath = `${basePath}/${logFileName}`.replace(/\\/g, "/");

        await invoke("write_text_file", {
          filePath: logPath,
          content: lines.join("\n"),
        });
      }
    } catch (e) {
      console.error("Export text log failed:", e);
      throw e;
    } finally {
      useScanPsdStore.getState().setPhase("idle");
    }
  }, []);

  // --- ルビ一覧外部ファイル保存 ---
  const saveRubyList = useCallback(async () => {
    const store = useScanPsdStore.getState();
    if (store.rubyList.length === 0) return;

    const result = await save({
      defaultPath: `${store.workInfo.title || "作品"}_ルビ一覧.txt`,
      filters: [{ name: "テキストファイル", extensions: ["txt"] }],
    });
    if (!result) return;

    try {
      const lines: string[] = [];
      lines.push("親文字\tルビ\t巻\tページ\t順番");
      for (const r of store.rubyList) {
        lines.push(
          `${r.parentText}\t${r.rubyText}\t${r.volume}\t${r.page}\t${r.order}`
        );
      }

      await invoke("write_text_file", {
        filePath: result,
        content: lines.join("\n"),
      });
    } catch (e) {
      console.error("Save ruby list failed:", e);
      throw e;
    }
  }, []);

  // --- scandataファイル選択（OSダイアログ：scandata用のみ残す） ---
  const selectScandataFile = useCallback(async (): Promise<string | null> => {
    const result = await open({
      directory: false,
      multiple: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
      defaultPath: useScanPsdStore.getState().saveDataBasePath,
    });
    return result && typeof result === "string" ? result : null;
  }, []);

  return {
    startScan,
    savePresetJson,
    loadPresetJson,
    saveScandata,
    loadScandata,
    exportTextLog,
    saveRubyList,
    selectScandataFile,
  };
}
