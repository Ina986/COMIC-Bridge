/**
 * 自然順比較: 文字列中の数字部分を数値として比較する
 * "file (2)" < "file (10)" になる
 */
export function naturalCompare(a: string, b: string): number {
  const ax = tokenize(a);
  const bx = tokenize(b);
  const len = Math.min(ax.length, bx.length);
  for (let i = 0; i < len; i++) {
    const ai = ax[i];
    const bi = bx[i];
    if (typeof ai === "number" && typeof bi === "number") {
      if (ai !== bi) return ai - bi;
    } else {
      const sa = String(ai).toLowerCase();
      const sb = String(bi).toLowerCase();
      if (sa !== sb) return sa < sb ? -1 : 1;
    }
  }
  return ax.length - bx.length;
}

function tokenize(s: string): (string | number)[] {
  const tokens: (string | number)[] = [];
  const re = /(\d+)|(\D+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    tokens.push(m[1] ? parseInt(m[1], 10) : m[2]);
  }
  return tokens;
}
