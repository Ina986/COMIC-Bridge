/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // 基調色 - 明るいクリーム系ライトテーマ
        bg: {
          primary: "#faf8f5",      // クリームホワイト（メイン背景）
          secondary: "#ffffff",    // 純白（パネル）
          tertiary: "#f5f3f0",     // 柔らかいグレー（カード）
          elevated: "#ffffff",     // 浮き上がり要素
        },
        // テキスト - ダーク系
        text: {
          primary: "#2d2d3a",      // ダークパープル
          secondary: "#5a5a6e",    // ミディアムグレー
          muted: "#9090a0",        // ライトグレー
        },
        // ポップなアクセント（鮮やか）
        accent: {
          DEFAULT: "#ff5a8a",      // ビビッドピンク
          hover: "#ff7aa5",
          glow: "rgba(255, 90, 138, 0.25)",
          secondary: "#7c5cff",    // パープル
          tertiary: "#00c9a7",     // ミントグリーン
          warm: "#ffb142",         // オレンジ
        },
        // 漫画的装飾カラー（パステル）
        manga: {
          pink: "#ffcce5",
          mint: "#c5ffe0",
          lavender: "#e0d5ff",
          peach: "#ffe5d5",
          sky: "#d5f0ff",
          yellow: "#fff9c4",
        },
        // ステータス（明確に）
        success: "#22c55e",        // 鮮やかな緑
        warning: "#f59e0b",        // オレンジ
        error: "#ef4444",          // 鮮やかな赤
        // ガイド線
        guide: {
          h: "#ff7070",
          v: "#50c8b0",
        },
        // ボーダー・区切り線
        border: {
          DEFAULT: "#e5e5ea",
          light: "#f0f0f5",
        },
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', '"Yu Gothic UI"', '"Meiryo"', "sans-serif"],
        display: ['"Zen Maru Gothic"', '"M PLUS Rounded 1c"', '"Yu Gothic UI"', "sans-serif"],
        mono: ["Consolas", "Menlo", "monospace"],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'card': '0 4px 16px rgba(0, 0, 0, 0.06)',
        'elevated': '0 8px 24px rgba(0, 0, 0, 0.1)',
        'glow-pink': '0 0 20px rgba(255, 90, 138, 0.2)',
        'glow-purple': '0 0 20px rgba(124, 92, 255, 0.2)',
        'glow-mint': '0 0 20px rgba(0, 201, 167, 0.2)',
        'glow-success': '0 0 16px rgba(34, 197, 94, 0.25)',
        'glow-error': '0 0 16px rgba(239, 68, 68, 0.25)',
      },
      animation: {
        'bounce-soft': 'bounce-soft 0.4s ease-out',
        'pop': 'pop 0.2s ease-out',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'confetti': 'confetti 1s ease-out forwards',
      },
      keyframes: {
        'bounce-soft': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'pop': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255, 107, 157, 0.2)' },
          '50%': { boxShadow: '0 0 30px rgba(255, 107, 157, 0.4)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'confetti': {
          '0%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(-100px) rotate(720deg)', opacity: '0' },
        },
      },
      backgroundImage: {
        'gradient-pop': 'linear-gradient(135deg, #ff5a8a, #7c5cff)',
        'gradient-fresh': 'linear-gradient(135deg, #00c9a7, #7c5cff)',
        'gradient-warm': 'linear-gradient(135deg, #ffb142, #ff5a8a)',
        'gradient-card': 'linear-gradient(145deg, #ffffff, #faf8f5)',
      },
    },
  },
  plugins: [],
};
