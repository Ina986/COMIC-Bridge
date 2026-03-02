import { useState } from "react";
import type { ProofreadingCheckItem } from "../../types/typesettingCheck";
import { CATEGORY_COLORS, getCategoryColorIndex } from "../../types/typesettingCheck";

interface Props {
  category: string;
  items: ProofreadingCheckItem[];
  onPageClick: (page: string) => void;
  searchQuery?: string;
}

/** ページ文字列を "NP" 形式にフォーマット */
function formatPage(page: string): string {
  if (!page) return "";
  const match = String(page).match(/^(\d+)/);
  return match ? `${match[1]}P` : page;
}

/** テキストのハイライト (検索クエリ一致部分を強調) */
function highlightText(text: string, query: string) {
  if (!query || !text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-accent-warm/30 text-inherit rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function CheckCategoryGroup({ category, items, onPageClick, searchQuery }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const colorIdx = getCategoryColorIndex(category);
  const borderColor = colorIdx >= 0 ? CATEGORY_COLORS[colorIdx] : "#9090a0";

  return (
    <div className="mb-2">
      {/* Category Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-bg-tertiary transition-colors text-left"
        style={{ borderLeft: `3px solid ${borderColor}` }}
      >
        <svg
          className={`w-3 h-3 text-text-muted transition-transform flex-shrink-0 ${collapsed ? "-rotate-90" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        <span className="text-[11px] font-medium text-text-primary truncate flex-1">
          {category}
        </span>
        <span className="text-[10px] text-text-muted flex-shrink-0">
          ({items.length})
        </span>
      </button>

      {/* Items Table */}
      {!collapsed && (
        <div className="ml-2 mt-0.5" style={{ borderLeft: `2px solid ${borderColor}20` }}>
          <table className="w-full text-[11px]">
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b border-border/30 last:border-b-0 hover:bg-bg-tertiary/50 transition-colors">
                  {/* Page */}
                  <td className="px-2 py-1.5 w-[42px] flex-shrink-0 align-top">
                    <button
                      onClick={() => onPageClick(item.page)}
                      className="text-accent hover:text-accent/80 font-medium underline underline-offset-2 transition-colors"
                      title={`${formatPage(item.page)} へ移動`}
                    >
                      {formatPage(item.page)}
                    </button>
                  </td>
                  {/* Excerpt */}
                  <td className="px-2 py-1.5 text-text-secondary align-top max-w-[140px] truncate">
                    {searchQuery ? highlightText(item.excerpt || "", searchQuery) : item.excerpt}
                  </td>
                  {/* Content */}
                  <td className="px-2 py-1.5 text-error font-medium align-top">
                    {searchQuery ? highlightText(item.content || "", searchQuery) : item.content}
                  </td>
                  {/* Copy */}
                  <td className="px-1 py-1.5 w-[28px] align-top">
                    <CopyButton content={item.content || ""} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`w-5 h-5 flex items-center justify-center rounded transition-all ${
        copied
          ? "text-success"
          : "text-text-muted hover:text-text-primary hover:bg-bg-tertiary"
      }`}
      title="コピー"
    >
      {copied ? (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}
