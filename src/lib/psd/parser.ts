import { readPsd, writePsd, type Psd } from "ag-psd";
import type { PsdMetadata, Guide, LayerNode, ColorMode } from "../../types";

// Color mode mapping from ag-psd numeric values
const COLOR_MODE_MAP: Record<number, ColorMode> = {
  0: "Bitmap",
  1: "Grayscale",
  2: "Indexed",
  3: "RGB",
  4: "CMYK",
  7: "Multichannel",
  8: "Duotone",
  9: "Lab",
};

export function mapColorMode(mode: number): ColorMode {
  return COLOR_MODE_MAP[mode] || "RGB";
}

export interface ParseResult {
  metadata: PsdMetadata;
  thumbnailData?: string; // base64 data URL
  compositeData?: string; // base64 data URL
}

export async function parsePsdBuffer(buffer: ArrayBuffer): Promise<ParseResult> {
  const psd = readPsd(buffer, {
    skipCompositeImageData: false,
    skipLayerImageData: true,
    skipThumbnail: false,
    useImageData: true,
  });

  const metadata = extractMetadata(psd);
  const thumbnailData = await generateThumbnail(psd);

  return {
    metadata,
    thumbnailData,
  };
}

export function extractMetadata(psd: Psd): PsdMetadata {
  const dpi = extractDpi(psd);
  const guides = extractGuides(psd);
  const layerTree = extractLayerTree(psd.children || []);

  return {
    width: psd.width,
    height: psd.height,
    dpi,
    colorMode: mapColorMode(psd.colorMode || 3),
    bitsPerChannel: psd.bitsPerChannel || 8,
    hasGuides: guides.length > 0,
    guides,
    layerCount: countLayers(psd.children || []),
    layerTree,
  };
}

function extractDpi(psd: Psd): number {
  // Try to get DPI from image resources
  const resolution = psd.imageResources?.resolutionInfo;
  if (resolution) {
    // resolution is in pixels per inch
    return Math.round(resolution.horizontalResolution || 72);
  }
  return 72; // Default DPI
}

export function extractGuides(psd: Psd): Guide[] {
  const guideInfo = psd.imageResources?.gridAndGuidesInformation;
  if (!guideInfo?.guides) return [];

  return guideInfo.guides.map((g) => ({
    direction: g.direction === "horizontal" ? "horizontal" : "vertical",
    position: Math.round(g.location),
  }));
}

function extractLayerTree(children: Psd["children"]): LayerNode[] {
  if (!children) return [];

  return children.map((child, index) => {
    const node: LayerNode = {
      id: `layer-${index}-${Date.now()}`,
      name: child.name || "Unnamed Layer",
      type: getLayerType(child),
      visible: !child.hidden,
      opacity: Math.round((child.opacity || 255) / 255 * 100),
      blendMode: child.blendMode || "normal",
    };

    if (child.children && child.children.length > 0) {
      node.children = extractLayerTree(child.children);
    }

    return node;
  });
}

function getLayerType(layer: any): LayerNode["type"] {
  if (layer.children && layer.children.length > 0) return "group";
  if (layer.text) return "text";
  if (layer.adjustment) return "adjustment";
  if (layer.placedLayer) return "smartObject";
  return "layer";
}

function countLayers(children: Psd["children"]): number {
  if (!children) return 0;

  let count = 0;
  for (const child of children) {
    count++;
    if (child.children) {
      count += countLayers(child.children);
    }
  }
  return count;
}

async function generateThumbnail(psd: Psd): Promise<string | undefined> {
  try {
    // Try to use the embedded thumbnail first
    const thumbResource = psd.imageResources?.thumbnail;
    if (thumbResource) {
      // Check if thumbnail has canvas or data
      const thumbData = (thumbResource as any);
      if (thumbData.canvas) {
        return thumbData.canvas.toDataURL("image/jpeg", 0.8);
      }
      if (thumbData.data && thumbData.data instanceof Uint8Array) {
        const blob = new Blob([thumbData.data], { type: "image/jpeg" });
        return await blobToDataUrl(blob);
      }
    }

    // Fall back to composite image
    if (psd.imageData) {
      const canvas = document.createElement("canvas");
      canvas.width = psd.width;
      canvas.height = psd.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Create ImageData from PixelData
        const imageData = new ImageData(
          new Uint8ClampedArray(psd.imageData.data),
          psd.imageData.width,
          psd.imageData.height
        );
        ctx.putImageData(imageData, 0, 0);

        // Scale down for thumbnail
        const maxSize = 400;
        const scale = Math.min(maxSize / psd.width, maxSize / psd.height, 1);
        const thumbCanvas = document.createElement("canvas");
        thumbCanvas.width = Math.round(psd.width * scale);
        thumbCanvas.height = Math.round(psd.height * scale);
        const thumbCtx = thumbCanvas.getContext("2d");
        if (thumbCtx) {
          thumbCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
          return thumbCanvas.toDataURL("image/jpeg", 0.8);
        }
      }
    }
  } catch (error) {
    console.error("Failed to generate thumbnail:", error);
  }
  return undefined;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Write guides to PSD
export function writeGuidesToPsd(buffer: ArrayBuffer, guides: Guide[]): ArrayBuffer {
  const psd = readPsd(buffer);

  // Initialize imageResources if needed
  psd.imageResources = psd.imageResources || {};
  psd.imageResources.gridAndGuidesInformation = {
    grid: psd.imageResources.gridAndGuidesInformation?.grid || {
      horizontal: 576,
      vertical: 576,
    },
    guides: guides.map((g) => ({
      location: g.position,
      direction: g.direction,
    })),
  };

  return writePsd(psd);
}
