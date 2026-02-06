import { readPsd, type Psd } from "ag-psd";
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

/**
 * 高速版: メタデータと埋め込みサムネイルのみ読み込み
 * 合成画像データはスキップするため高速
 */
export async function parsePsdBufferFast(buffer: ArrayBuffer): Promise<ParseResult> {
  const psd = readPsd(buffer, {
    skipCompositeImageData: true,  // 合成画像をスキップ（高速化）
    skipLayerImageData: true,
    skipThumbnail: false,          // 埋め込みサムネイルは読み込む
    useImageData: false,
  });

  const metadata = extractMetadata(psd);
  const thumbnailData = await extractEmbeddedThumbnail(psd);

  return {
    metadata,
    thumbnailData,
  };
}

/**
 * フル版: 合成画像も含めて読み込み（サムネイルがない場合のフォールバック用）
 */
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

/**
 * 埋め込みサムネイルのみ抽出（高速）
 */
async function extractEmbeddedThumbnail(psd: Psd): Promise<string | undefined> {
  try {
    const thumbResource = psd.imageResources?.thumbnail;
    if (thumbResource) {
      const thumbData = thumbResource as any;
      if (thumbData.canvas) {
        return thumbData.canvas.toDataURL("image/jpeg", 0.8);
      }
      if (thumbData.data && thumbData.data instanceof Uint8Array) {
        const blob = new Blob([thumbData.data], { type: "image/jpeg" });
        return await blobToDataUrl(blob);
      }
    }
  } catch (error) {
    console.error("Failed to extract thumbnail:", error);
  }
  return undefined;
}

export function extractMetadata(psd: Psd): PsdMetadata {
  const dpi = extractDpi(psd);
  const guides = extractGuides(psd);
  const layerTree = extractLayerTree(psd.children || []);
  const alphaChannelInfo = extractAlphaChannelInfo(psd);

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
    hasAlphaChannels: alphaChannelInfo.count > 0,
    alphaChannelCount: alphaChannelInfo.count,
    alphaChannelNames: alphaChannelInfo.names,
  };
}

/**
 * αチャンネル情報を抽出
 * カラーモードに応じた標準チャンネル数を超えるチャンネルがαチャンネル
 */
function extractAlphaChannelInfo(psd: Psd): { count: number; names: string[] } {
  // αチャンネル名はimageResourcesに格納されている
  const alphaNames = psd.imageResources?.alphaChannelNames || [];

  // チャンネル数から計算（psd.channelsがある場合）
  // ag-psdでは、channelsの長さがチャンネル総数
  // または、alphaChannelNamesの長さがαチャンネル数
  const alphaCount = alphaNames.length;

  return {
    count: alphaCount,
    names: alphaNames,
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

// ============================================
// PSD バイナリ直接操作によるガイド書き込み
// ag-psd の writePsd() はファイル構造を壊すため使用しない
// ============================================

/** DataView ヘルパー: ビッグエンディアン読み書き */
function readUint32BE(view: DataView, offset: number): number {
  return view.getUint32(offset, false);
}

function readUint16BE(view: DataView, offset: number): number {
  return view.getUint16(offset, false);
}

/**
 * Image Resources セクション内のリソースブロックをパースし、
 * 各ブロックの開始オフセットとサイズを返す
 */
function parseImageResourceBlocks(
  view: DataView,
  sectionStart: number,
  sectionLength: number
): Array<{ offset: number; size: number; resourceId: number }> {
  const blocks: Array<{ offset: number; size: number; resourceId: number }> = [];
  let pos = sectionStart;
  const sectionEnd = sectionStart + sectionLength;

  while (pos + 10 < sectionEnd) {
    const blockStart = pos;

    // Signature: "8BIM" (4 bytes)
    const sig =
      String.fromCharCode(view.getUint8(pos)) +
      String.fromCharCode(view.getUint8(pos + 1)) +
      String.fromCharCode(view.getUint8(pos + 2)) +
      String.fromCharCode(view.getUint8(pos + 3));
    if (sig !== "8BIM") break;
    pos += 4;

    // Resource ID (2 bytes)
    const resourceId = readUint16BE(view, pos);
    pos += 2;

    // Pascal string (name): 1 byte length + chars, padded to even
    const nameLen = view.getUint8(pos);
    pos += 1;
    const nameTotalLen = nameLen === 0 ? 1 : nameLen; // actual chars
    pos += nameTotalLen;
    // Pad to even offset from start of pascal string (length byte + chars)
    if ((1 + nameTotalLen) % 2 !== 0) pos += 1;

    // Data length (4 bytes)
    const dataLen = readUint32BE(view, pos);
    pos += 4;

    // Data + padding to even
    pos += dataLen;
    if (dataLen % 2 !== 0) pos += 1;

    blocks.push({ offset: blockStart, size: pos - blockStart, resourceId });
  }

  return blocks;
}

/**
 * Grid & Guides リソース (ID 0x0408) のバイナリデータを構築
 */
function buildGuideResourceBlock(guides: Guide[], existingGrid?: { horizontal: number; vertical: number }): Uint8Array {
  const gridH = existingGrid?.horizontal ?? 576; // 18pt = 1inch
  const gridV = existingGrid?.vertical ?? 576;
  const guideCount = guides.length;

  // リソースデータ: version(4) + gridH(4) + gridV(4) + count(4) + guides(5 each)
  const dataLen = 16 + guideCount * 5;

  // ブロック全体: "8BIM"(4) + ID(2) + pascal("")(2) + dataLen(4) + data + padding
  const paddedDataLen = dataLen + (dataLen % 2);
  const blockSize = 4 + 2 + 2 + 4 + paddedDataLen;
  const block = new Uint8Array(blockSize);
  const bv = new DataView(block.buffer);
  let pos = 0;

  // "8BIM"
  block[pos++] = 0x38; // '8'
  block[pos++] = 0x42; // 'B'
  block[pos++] = 0x49; // 'I'
  block[pos++] = 0x4d; // 'M'

  // Resource ID: 0x0408
  bv.setUint16(pos, 0x0408, false);
  pos += 2;

  // Pascal string (empty): length=0, padding=0
  block[pos++] = 0;
  block[pos++] = 0;

  // Data length
  bv.setUint32(pos, dataLen, false);
  pos += 4;

  // Version = 1
  bv.setUint32(pos, 1, false);
  pos += 4;

  // Grid horizontal / vertical
  bv.setUint32(pos, gridH, false);
  pos += 4;
  bv.setUint32(pos, gridV, false);
  pos += 4;

  // Guide count
  bv.setUint32(pos, guideCount, false);
  pos += 4;

  // Each guide: position(4 bytes, pixels * 32 fixed-point) + direction(1 byte)
  for (const g of guides) {
    const fixedPos = Math.round(g.position * 32);
    bv.setInt32(pos, fixedPos, false);
    pos += 4;
    // PSD: 0 = vertical, 1 = horizontal
    block[pos++] = g.direction === "vertical" ? 0 : 1;
  }

  return block;
}

/**
 * 既存の 0x0408 リソースからグリッド情報を読み取る
 */
function readExistingGrid(
  view: DataView,
  blockOffset: number
): { horizontal: number; vertical: number } | undefined {
  // ブロック構造: "8BIM"(4) + ID(2) + pascal(2+) + dataLen(4) + data
  let pos = blockOffset + 4 + 2; // skip signature + ID

  // Skip pascal string
  const nameLen = view.getUint8(pos);
  pos += 1;
  const nameTotalLen = nameLen === 0 ? 1 : nameLen;
  pos += nameTotalLen;
  if ((1 + nameTotalLen) % 2 !== 0) pos += 1;

  // Data length
  const dataLen = readUint32BE(view, pos);
  pos += 4;

  if (dataLen < 12) return undefined;

  // Skip version (4 bytes)
  pos += 4;

  const horizontal = readUint32BE(view, pos);
  pos += 4;
  const vertical = readUint32BE(view, pos);

  return { horizontal, vertical };
}

/**
 * PSDファイルのバイナリを直接操作してガイド情報のみを差し替える。
 * Header / Color Mode Data / Layer & Mask / Image Data はバイト単位で保持される。
 */
export function writeGuidesToPsd(buffer: ArrayBuffer, guides: Guide[]): ArrayBuffer {
  const view = new DataView(buffer);
  const src = new Uint8Array(buffer);

  // --- PSD Header (26 bytes) ---
  // Validate signature
  const sig = String.fromCharCode(src[0], src[1], src[2], src[3]);
  if (sig !== "8BPS") throw new Error("Not a valid PSD file");

  const headerSize = 26;

  // --- Color Mode Data Section ---
  const colorModeDataLen = readUint32BE(view, headerSize);
  const colorModeEnd = headerSize + 4 + colorModeDataLen;

  // --- Image Resources Section ---
  const irSectionLenOffset = colorModeEnd;
  const irSectionLen = readUint32BE(view, irSectionLenOffset);
  const irDataStart = irSectionLenOffset + 4;
  const irDataEnd = irDataStart + irSectionLen;

  // Parse existing resource blocks
  const blocks = parseImageResourceBlocks(view, irDataStart, irSectionLen);

  // Find existing 0x0408 block and read its grid info
  let existingGrid: { horizontal: number; vertical: number } | undefined;
  const guideBlockIndex = blocks.findIndex((b) => b.resourceId === 0x0408);
  if (guideBlockIndex >= 0) {
    const gb = blocks[guideBlockIndex];
    existingGrid = readExistingGrid(view, gb.offset);
  }

  // Build new guide resource block
  const newGuideBlock = buildGuideResourceBlock(guides, existingGrid);

  // Collect all resource blocks except the old 0x0408
  const otherBlocks = blocks.filter((b) => b.resourceId !== 0x0408);

  // Calculate new Image Resources section length
  let newIrLen = 0;
  for (const b of otherBlocks) newIrLen += b.size;
  newIrLen += newGuideBlock.length;

  // --- Reassemble the PSD ---
  // Everything before Image Resources section
  const beforeIr = src.slice(0, irSectionLenOffset);
  // Everything after Image Resources section (Layer & Mask + Image Data) — preserved exactly
  const afterIr = src.slice(irDataEnd);

  // Total size
  const totalSize = beforeIr.length + 4 + newIrLen + afterIr.length;
  const result = new Uint8Array(totalSize);
  const resultView = new DataView(result.buffer);
  let writePos = 0;

  // Copy header + color mode data
  result.set(beforeIr, writePos);
  writePos += beforeIr.length;

  // Write new Image Resources section length
  resultView.setUint32(writePos, newIrLen, false);
  writePos += 4;

  // Write other resource blocks (preserving original bytes)
  for (const b of otherBlocks) {
    result.set(src.slice(b.offset, b.offset + b.size), writePos);
    writePos += b.size;
  }

  // Write new guide resource block
  result.set(newGuideBlock, writePos);
  writePos += newGuideBlock.length;

  // Copy Layer & Mask section + Image Data (byte-for-byte)
  result.set(afterIr, writePos);

  return result.buffer;
}
