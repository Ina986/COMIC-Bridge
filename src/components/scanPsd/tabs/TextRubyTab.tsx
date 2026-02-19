import { useState } from "react";
import { useScanPsdStore } from "../../../store/scanPsdStore";
import { useScanPsdProcessor } from "../../../hooks/useScanPsdProcessor";
import type { RubyEntry } from "../../../types/scanPsd";

export function TextRubyTab() {
  const rubyList = useScanPsdStore((s) => s.rubyList);
  const addRuby = useScanPsdStore((s) => s.addRuby);
  const removeRuby = useScanPsdStore((s) => s.removeRuby);
  const updateRuby = useScanPsdStore((s) => s.updateRuby);
  const scanData = useScanPsdStore((s) => s.scanData);
  const { exportTextLog, saveRubyList } = useScanPsdProcessor();

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ parentText: "", rubyText: "", volume: 1, page: 1, order: 1 });

  const handleAdd = () => {
    if (!form.parentText.trim() || !form.rubyText.trim()) return;
    addRuby({
      id: `ruby_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ...form,
    });
    setForm({ parentText: "", rubyText: "", volume: 1, page: 1, order: 1 });
    setShowAdd(false);
  };

  const handleUpdate = () => {
    if (!editingId || !form.parentText.trim() || !form.rubyText.trim()) return;
    updateRuby(editingId, form);
    setEditingId(null);
    setForm({ parentText: "", rubyText: "", volume: 1, page: 1, order: 1 });
  };

  const startEdit = (entry: RubyEntry) => {
    setEditingId(entry.id);
    setForm({
      parentText: entry.parentText,
      rubyText: entry.rubyText,
      volume: entry.volume,
      page: entry.page,
      order: entry.order,
    });
    setShowAdd(false);
  };

  // テキストレイヤー統計
  const textLayerCount = scanData?.textLayersByDoc
    ? Object.values(scanData.textLayersByDoc).reduce((sum, layers) => sum + layers.length, 0)
    : 0;
  const docCount = scanData?.textLayersByDoc ? Object.keys(scanData.textLayersByDoc).length : 0;

  return (
    <div className="space-y-3">
      {/* テキストレイヤー統計 */}
      {scanData && (
        <div className="bg-bg-tertiary rounded-xl p-3">
          <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">テキストレイヤー</h4>
          <div className="flex gap-4">
            <div>
              <span className="text-lg font-bold text-text-primary">{textLayerCount}</span>
              <span className="text-[10px] text-text-muted ml-1">レイヤー</span>
            </div>
            <div>
              <span className="text-lg font-bold text-text-primary">{docCount}</span>
              <span className="text-[10px] text-text-muted ml-1">ドキュメント</span>
            </div>
          </div>
        </div>
      )}

      {/* ルビ一覧 */}
      <div className="bg-bg-tertiary rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
            ルビ一覧 ({rubyList.length})
          </h4>
          <button
            onClick={() => { setShowAdd(true); setEditingId(null); setForm({ parentText: "", rubyText: "", volume: 1, page: 1, order: 1 }); }}
            className="text-[10px] text-accent hover:text-accent-secondary px-1.5 py-0.5 rounded hover:bg-accent/10"
          >
            + 追加
          </button>
        </div>

        {/* 追加/編集フォーム */}
        {(showAdd || editingId) && (
          <div className="bg-bg-elevated rounded-lg p-2.5 mb-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[9px] text-text-muted">親文字</span>
                <input
                  type="text"
                  value={form.parentText}
                  onChange={(e) => setForm({ ...form, parentText: e.target.value })}
                  className="w-full bg-bg-tertiary border border-white/10 rounded px-2 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
                  autoFocus
                />
              </div>
              <div>
                <span className="text-[9px] text-text-muted">ルビ</span>
                <input
                  type="text"
                  value={form.rubyText}
                  onChange={(e) => setForm({ ...form, rubyText: e.target.value })}
                  className="w-full bg-bg-tertiary border border-white/10 rounded px-2 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[9px] text-text-muted">巻</span>
                <input
                  type="number"
                  value={form.volume}
                  onChange={(e) => setForm({ ...form, volume: Number(e.target.value) })}
                  min={1}
                  className="w-full bg-bg-tertiary border border-white/10 rounded px-2 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[9px] text-text-muted">ページ</span>
                <input
                  type="number"
                  value={form.page}
                  onChange={(e) => setForm({ ...form, page: Number(e.target.value) })}
                  min={1}
                  className="w-full bg-bg-tertiary border border-white/10 rounded px-2 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[9px] text-text-muted">順番</span>
                <input
                  type="number"
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
                  min={1}
                  className="w-full bg-bg-tertiary border border-white/10 rounded px-2 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={editingId ? handleUpdate : handleAdd}
                className="flex-1 py-1 text-[10px] font-medium text-white bg-accent rounded-lg hover:bg-accent-secondary transition-colors"
              >
                {editingId ? "更新" : "追加"}
              </button>
              <button
                onClick={() => { setShowAdd(false); setEditingId(null); }}
                className="py-1 px-3 text-[10px] text-text-muted hover:text-text-primary"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* ルビリスト */}
        {rubyList.length === 0 ? (
          <p className="text-[10px] text-text-muted py-4 text-center">ルビがありません</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-auto">
            {rubyList.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 bg-bg-elevated rounded-lg px-2.5 py-1.5 group"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-text-primary">{r.parentText}</span>
                  <span className="text-[10px] text-accent mx-1">({r.rubyText})</span>
                </div>
                <span className="text-[9px] text-text-muted flex-shrink-0">
                  {r.volume}巻 P{r.page}
                </span>
                <button
                  onClick={() => startEdit(r)}
                  className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-accent transition-all"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={() => removeRuby(r.id)}
                  className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-error transition-all"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* テキストログ出力 */}
      <div className="bg-bg-tertiary rounded-xl p-3">
        <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">テキストログ出力</h4>
        <button
          onClick={exportTextLog}
          disabled={!scanData}
          className="w-full py-2 text-xs font-medium text-text-primary bg-bg-elevated rounded-lg
            hover:bg-bg-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          テキストログを出力
        </button>
        <button
          onClick={saveRubyList}
          disabled={rubyList.length === 0}
          className="w-full py-2 mt-1.5 text-xs font-medium text-text-primary bg-bg-elevated rounded-lg
            hover:bg-bg-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ルビ一覧を外部ファイルに保存
        </button>
      </div>
    </div>
  );
}
