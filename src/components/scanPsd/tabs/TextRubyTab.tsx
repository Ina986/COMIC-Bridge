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

  const textLayerCount = scanData?.textLayersByDoc
    ? Object.values(scanData.textLayersByDoc).reduce((sum, layers) => sum + layers.length, 0)
    : 0;
  const docCount = scanData?.textLayersByDoc ? Object.keys(scanData.textLayersByDoc).length : 0;

  return (
    <div className="space-y-4">
      {/* テキストレイヤー統計 */}
      {scanData && (
        <div className="grid grid-cols-2 gap-2">
          <div
            className="rounded-xl p-3 text-center"
            style={{ background: "linear-gradient(135deg, rgba(77,184,255,0.08), rgba(124,92,255,0.06))" }}
          >
            <span
              className="text-xl font-black font-display"
              style={{ background: "linear-gradient(135deg, #4db8ff, #7c5cff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
            >
              {textLayerCount}
            </span>
            <span className="text-[10px] text-text-muted block mt-0.5">レイヤー</span>
          </div>
          <div
            className="rounded-xl p-3 text-center"
            style={{ background: "linear-gradient(135deg, rgba(0,201,167,0.08), rgba(77,184,255,0.06))" }}
          >
            <span
              className="text-xl font-black font-display"
              style={{ background: "linear-gradient(135deg, #00c9a7, #4db8ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
            >
              {docCount}
            </span>
            <span className="text-[10px] text-text-muted block mt-0.5">ドキュメント</span>
          </div>
        </div>
      )}

      {/* ルビ一覧 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h4 className="text-[10px] font-bold text-text-secondary">ルビ一覧</h4>
            <span className="text-[9px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
              {rubyList.length}
            </span>
          </div>
          <button
            onClick={() => { setShowAdd(true); setEditingId(null); setForm({ parentText: "", rubyText: "", volume: 1, page: 1, order: 1 }); }}
            className="w-6 h-6 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 flex items-center justify-center transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>

        {/* 追加/編集フォーム */}
        {(showAdd || editingId) && (
          <div className="bg-bg-tertiary/50 rounded-xl p-3 mb-2 space-y-2 border border-accent/20">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[9px] text-text-muted font-medium">親文字</span>
                <input
                  type="text"
                  value={form.parentText}
                  onChange={(e) => setForm({ ...form, parentText: e.target.value })}
                  className="w-full bg-white border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary
                    focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
                  autoFocus
                />
              </div>
              <div>
                <span className="text-[9px] text-text-muted font-medium">ルビ</span>
                <input
                  type="text"
                  value={form.rubyText}
                  onChange={(e) => setForm({ ...form, rubyText: e.target.value })}
                  className="w-full bg-white border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary
                    focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[9px] text-text-muted font-medium">巻</span>
                <input
                  type="number"
                  value={form.volume}
                  onChange={(e) => setForm({ ...form, volume: Number(e.target.value) })}
                  min={1}
                  className="w-full bg-white border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary
                    focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
                />
              </div>
              <div>
                <span className="text-[9px] text-text-muted font-medium">ページ</span>
                <input
                  type="number"
                  value={form.page}
                  onChange={(e) => setForm({ ...form, page: Number(e.target.value) })}
                  min={1}
                  className="w-full bg-white border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary
                    focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
                />
              </div>
              <div>
                <span className="text-[9px] text-text-muted font-medium">順番</span>
                <input
                  type="number"
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
                  min={1}
                  className="w-full bg-white border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary
                    focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={editingId ? handleUpdate : handleAdd}
                className="flex-1 py-1.5 text-[10px] font-bold text-white rounded-lg transition-all"
                style={{ background: "linear-gradient(135deg, #ff5a8a, #7c5cff)" }}
              >
                {editingId ? "更新" : "追加"}
              </button>
              <button
                onClick={() => { setShowAdd(false); setEditingId(null); }}
                className="py-1.5 px-3 text-[10px] text-text-muted hover:text-text-primary rounded-lg hover:bg-bg-tertiary transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* ルビリスト */}
        {rubyList.length === 0 ? (
          <p className="text-[10px] text-text-muted py-4 text-center bg-bg-tertiary/30 rounded-xl border border-dashed border-border">
            ルビがありません
          </p>
        ) : (
          <div className="space-y-1">
            {rubyList.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 bg-bg-tertiary/40 hover:bg-bg-tertiary rounded-lg px-2.5 py-1.5 group
                  border border-transparent hover:border-border/50 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-text-primary">{r.parentText}</span>
                  <span className="text-[10px] mx-1" style={{ color: "#ff5a8a" }}>
                    ({r.rubyText})
                  </span>
                </div>
                <span className="text-[9px] text-text-muted flex-shrink-0 bg-bg-primary px-1.5 py-0.5 rounded font-mono">
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
      <div className="space-y-1.5">
        <button
          onClick={exportTextLog}
          disabled={!scanData}
          className="w-full py-2 text-xs font-medium text-text-primary bg-bg-tertiary/60 rounded-xl border border-border/40
            hover:bg-bg-tertiary hover:border-border disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          テキストログを出力
        </button>
        <button
          onClick={saveRubyList}
          disabled={rubyList.length === 0}
          className="w-full py-2 text-xs font-medium text-text-primary bg-bg-tertiary/60 rounded-xl border border-border/40
            hover:bg-bg-tertiary hover:border-border disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          ルビ一覧を外部ファイルに保存
        </button>
      </div>
    </div>
  );
}
