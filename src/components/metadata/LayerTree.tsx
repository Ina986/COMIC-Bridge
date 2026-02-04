import { useState } from "react";
import type { LayerNode } from "../../types";

interface LayerTreeProps {
  layers: LayerNode[];
  depth?: number;
}

export function LayerTree({ layers, depth = 0 }: LayerTreeProps) {
  return (
    <div className="text-xs">
      {layers.map((layer) => (
        <LayerItem key={layer.id} layer={layer} depth={depth} />
      ))}
    </div>
  );
}

interface LayerItemProps {
  layer: LayerNode;
  depth: number;
}

function LayerItem({ layer, depth }: LayerItemProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const hasChildren = layer.children && layer.children.length > 0;

  const getLayerIcon = () => {
    switch (layer.type) {
      case "group":
        return (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
        );
      case "text":
        return (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        );
      case "adjustment":
        return (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        );
      case "smartObject":
        return (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div>
      <div
        className={`
          flex items-center gap-1 py-0.5 rounded hover:bg-bg-elevated/50
          ${!layer.visible ? "opacity-50" : ""}
        `}
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        {/* Expand/Collapse Button */}
        {hasChildren ? (
          <button
            className="w-4 h-4 flex items-center justify-center text-text-muted hover:text-text-primary"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <svg
              className={`w-3 h-3 transition-transform ${
                isExpanded ? "rotate-90" : ""
              }`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        ) : (
          <div className="w-4" />
        )}

        {/* Visibility Indicator */}
        <div
          className={`w-3 h-3 ${
            layer.visible ? "text-text-secondary" : "text-text-muted"
          }`}
        >
          {layer.visible ? (
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path
                fillRule="evenodd"
                d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                clipRule="evenodd"
              />
              <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
            </svg>
          )}
        </div>

        {/* Layer Type Icon */}
        <div className="text-text-muted">{getLayerIcon()}</div>

        {/* Layer Name */}
        <span
          className={`truncate ${
            layer.visible ? "text-text-primary" : "text-text-muted"
          }`}
          title={layer.name}
        >
          {layer.name}
        </span>

        {/* Opacity */}
        {layer.opacity < 100 && (
          <span className="text-text-muted ml-auto">{layer.opacity}%</span>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <LayerTree layers={layer.children!} depth={depth + 1} />
      )}
    </div>
  );
}
