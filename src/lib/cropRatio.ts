import type { TiffCropBounds, TiffCropGuide } from "../types/tiff";

/** クロップ範囲の実アスペクト比 (w/h) を返す。高さ0なら0。 */
export function cropRatioOf(b: TiffCropBounds): number {
  const w = b.right - b.left;
  const h = b.bottom - b.top;
  return h > 0 ? w / h : 0;
}

/**
 * 目標比率 (ratioW:ratioH) に対し、現在のクロップ比率が許容誤差内か。
 * 整数丸めの誤差を許容するため既定 1%。
 */
export function isCropRatioValid(
  b: TiffCropBounds,
  ratioW: number,
  ratioH: number,
  tol = 0.01,
): boolean {
  const target = ratioH > 0 ? ratioW / ratioH : 0;
  const actual = cropRatioOf(b);
  if (actual <= 0 || target <= 0) return false;
  return Math.abs(actual - target) / target <= tol;
}

export interface GuideOverflow {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
  any: boolean;
}

/**
 * クロップ範囲がガイド枠（cropGuides の外周＝最小〜最大位置）を突き抜けているか各方向で判定する。
 * 各方向のガイドが2本未満ならその方向は枠なしとして判定しない。
 */
export function cropGuideOverflow(b: TiffCropBounds, guides: TiffCropGuide[]): GuideOverflow {
  const v = guides.filter((g) => g.direction === "vertical").map((g) => g.position);
  const h = guides.filter((g) => g.direction === "horizontal").map((g) => g.position);
  const res: GuideOverflow = {
    left: false,
    right: false,
    top: false,
    bottom: false,
    any: false,
  };
  if (v.length >= 2) {
    const minV = Math.min(...v);
    const maxV = Math.max(...v);
    if (b.left < minV - 0.5) res.left = true;
    if (b.right > maxV + 0.5) res.right = true;
  }
  if (h.length >= 2) {
    const minH = Math.min(...h);
    const maxH = Math.max(...h);
    if (b.top < minH - 0.5) res.top = true;
    if (b.bottom > maxH + 0.5) res.bottom = true;
  }
  res.any = res.left || res.right || res.top || res.bottom;
  return res;
}
