import { useState } from "react";
import { useGuideStore } from "../../store/guideStore";
import type { Guide } from "../../types";

export function GuideList() {
  const guides = useGuideStore((state) => state.guides);
  const selectedGuideIndex = useGuideStore((state) => state.selectedGuideIndex);
  const setSelectedGuideIndex = useGuideStore((state) => state.setSelectedGuideIndex);
  const updateGuide = useGuideStore((state) => state.updateGuide);
  const removeGuide = useGuideStore((state) => state.removeGuide);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleStartEdit = (index: number, position: number) => {
    setEditingIndex(index);
    setEditValue(String(position));
  };

  const handleFinishEdit = (index: number, guide: Guide) => {
    const newPosition = parseInt(editValue, 10);
    if (!isNaN(newPosition) && newPosition >= 0) {
      updateGuide(index, { ...guide, position: newPosition });
    }
    setEditingIndex(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number, guide: Guide) => {
    if (e.key === "Enter") {
      handleFinishEdit(index, guide);
    } else if (e.key === "Escape") {
      setEditingIndex(null);
    }
  };

  if (guides.length === 0) {
    return (
      <div className="text-sm text-text-muted text-center py-4">
        ガイドがありません
        <br />
        <span className="text-xs">ルーラーからドラッグして追加</span>
      </div>
    );
  }

  // Group guides by direction
  const horizontalGuides = guides
    .map((g, i) => ({ ...g, index: i }))
    .filter((g) => g.direction === "horizontal")
    .sort((a, b) => a.position - b.position);

  const verticalGuides = guides
    .map((g, i) => ({ ...g, index: i }))
    .filter((g) => g.direction === "vertical")
    .sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-4">
      {/* Horizontal Guides */}
      {horizontalGuides.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-text-muted mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-guide-h" />
            水平ガイド ({horizontalGuides.length})
          </h4>
          <div className="space-y-1">
            {horizontalGuides.map((guide) => (
              <GuideItem
                key={guide.index}
                guide={guide}
                index={guide.index}
                isSelected={selectedGuideIndex === guide.index}
                isEditing={editingIndex === guide.index}
                editValue={editValue}
                onSelect={() => setSelectedGuideIndex(guide.index)}
                onStartEdit={() => handleStartEdit(guide.index, guide.position)}
                onEditChange={(v) => setEditValue(v)}
                onFinishEdit={() => handleFinishEdit(guide.index, guide)}
                onKeyDown={(e) => handleKeyDown(e, guide.index, guide)}
                onDelete={() => removeGuide(guide.index)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Vertical Guides */}
      {verticalGuides.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-text-muted mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-guide-v" />
            垂直ガイド ({verticalGuides.length})
          </h4>
          <div className="space-y-1">
            {verticalGuides.map((guide) => (
              <GuideItem
                key={guide.index}
                guide={guide}
                index={guide.index}
                isSelected={selectedGuideIndex === guide.index}
                isEditing={editingIndex === guide.index}
                editValue={editValue}
                onSelect={() => setSelectedGuideIndex(guide.index)}
                onStartEdit={() => handleStartEdit(guide.index, guide.position)}
                onEditChange={(v) => setEditValue(v)}
                onFinishEdit={() => handleFinishEdit(guide.index, guide)}
                onKeyDown={(e) => handleKeyDown(e, guide.index, guide)}
                onDelete={() => removeGuide(guide.index)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface GuideItemProps {
  guide: Guide & { index: number };
  index: number;
  isSelected: boolean;
  isEditing: boolean;
  editValue: string;
  onSelect: () => void;
  onStartEdit: () => void;
  onEditChange: (value: string) => void;
  onFinishEdit: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onDelete: () => void;
}

function GuideItem({
  guide,
  isSelected,
  isEditing,
  editValue,
  onSelect,
  onStartEdit,
  onEditChange,
  onFinishEdit,
  onKeyDown,
  onDelete,
}: GuideItemProps) {
  return (
    <div
      className={`
        flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors
        ${isSelected ? "bg-bg-elevated" : "hover:bg-bg-tertiary"}
      `}
      onClick={onSelect}
    >
      {/* Position */}
      {isEditing ? (
        <input
          type="number"
          className="input w-20 text-xs py-0.5"
          value={editValue}
          onChange={(e) => onEditChange(e.target.value)}
          onBlur={onFinishEdit}
          onKeyDown={onKeyDown}
          autoFocus
        />
      ) : (
        <span
          className="font-mono text-sm text-text-primary cursor-text"
          onDoubleClick={onStartEdit}
        >
          {guide.position} px
        </span>
      )}

      {/* Delete Button */}
      <button
        className="ml-auto p-1 rounded text-text-muted hover:text-error hover:bg-error/10"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="削除"
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}
