import { useScanPsdStore } from "../../../store/scanPsdStore";
import { GENRE_LABELS } from "../../../types/scanPsd";

export function WorkInfoTab() {
  const workInfo = useScanPsdStore((s) => s.workInfo);
  const setWorkInfo = useScanPsdStore((s) => s.setWorkInfo);

  const genres = Object.keys(GENRE_LABELS);
  const labels = workInfo.genre ? GENRE_LABELS[workInfo.genre] || [] : [];

  return (
    <div className="space-y-4">
      {/* ジャンル・レーベル */}
      <Section title="レーベル" accent="#ff5a8a">
        <div className="flex gap-2">
          <div className="flex-1">
            <Label>ジャンル</Label>
            <select
              value={workInfo.genre}
              onChange={(e) => setWorkInfo({ genre: e.target.value, label: "" })}
              className="w-full bg-bg-primary border border-border rounded-xl px-3 py-1.5 text-xs text-text-primary
                focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10 transition-all"
            >
              <option value="">選択...</option>
              {genres.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <Label>レーベル</Label>
            <select
              value={workInfo.label}
              onChange={(e) => setWorkInfo({ label: e.target.value })}
              className="w-full bg-bg-primary border border-border rounded-xl px-3 py-1.5 text-xs text-text-primary
                focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10 transition-all"
              disabled={!workInfo.genre}
            >
              <option value="">選択...</option>
              {labels.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      {/* 著者 */}
      <Section title="著者情報" accent="#7c5cff">
        <div className="flex gap-3 mb-2">
          {(["single", "dual", "none"] as const).map((t) => (
            <label key={t} className="flex items-center gap-1.5 cursor-pointer group">
              <input
                type="radio"
                name="authorType"
                checked={workInfo.authorType === t}
                onChange={() => setWorkInfo({ authorType: t })}
                className="accent-accent w-3.5 h-3.5"
              />
              <span className="text-[11px] text-text-secondary group-hover:text-text-primary transition-colors">
                {t === "single" ? "著者" : t === "dual" ? "原作/作画" : "なし"}
              </span>
            </label>
          ))}
        </div>
        {workInfo.authorType === "single" && (
          <div>
            <Label>著者名</Label>
            <Input value={workInfo.author} onChange={(v) => setWorkInfo({ author: v })} placeholder="著者名" />
          </div>
        )}
        {workInfo.authorType === "dual" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>原作</Label>
              <Input value={workInfo.original} onChange={(v) => setWorkInfo({ original: v })} placeholder="原作者" />
            </div>
            <div>
              <Label>作画</Label>
              <Input value={workInfo.artist} onChange={(v) => setWorkInfo({ artist: v })} placeholder="作画者" />
            </div>
          </div>
        )}
      </Section>

      {/* タイトル */}
      <Section title="作品情報" accent="#00c9a7">
        <div className="space-y-2">
          <div>
            <Label>タイトル</Label>
            <Input value={workInfo.title} onChange={(v) => setWorkInfo({ title: v })} placeholder="作品タイトル" />
          </div>
          <div>
            <Label>サブタイトル</Label>
            <Input value={workInfo.subtitle} onChange={(v) => setWorkInfo({ subtitle: v })} placeholder="サブタイトル（任意）" />
          </div>
          <div>
            <Label>編集者</Label>
            <Input value={workInfo.editor} onChange={(v) => setWorkInfo({ editor: v })} placeholder="編集者名" />
          </div>
        </div>
      </Section>

      {/* 保存パス・備考 */}
      <Section title="その他" accent="#9090a0">
        <div className="space-y-2">
          <div>
            <Label>保存パス</Label>
            <Input value={workInfo.storagePath} onChange={(v) => setWorkInfo({ storagePath: v })} placeholder="保存先パス（任意）" />
          </div>
          <div>
            <Label>備考</Label>
            <textarea
              value={workInfo.notes}
              onChange={(e) => setWorkInfo({ notes: e.target.value })}
              placeholder="メモ（任意）"
              rows={3}
              className="w-full bg-bg-primary border border-border rounded-xl px-3 py-1.5 text-xs text-text-primary
                focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10 resize-none transition-all"
            />
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="relative rounded-xl bg-bg-tertiary/60 border border-border/40 overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl" style={{ background: accent }} />
      <div className="pl-4 pr-3 py-3">
        <h4 className="text-[10px] font-bold uppercase tracking-wider mb-2.5" style={{ color: accent }}>
          {title}
        </h4>
        {children}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] text-text-muted block mb-1">{children}</span>;
}

function Input({
  value, onChange, placeholder,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-bg-primary border border-border rounded-xl px-3 py-1.5 text-xs text-text-primary
        focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10 transition-all"
    />
  );
}
