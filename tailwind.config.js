/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // 基調色 - 柔らかいダーク
        bg: {
          primary: "#1e1e2e",      // 深いパープルグレー
          secondary: "#282838",    // 少し明るく
          tertiary: "#313145",     // パネル
          elevated: "#3c3c52",     // カード・浮き上がり
        },
        // テキスト
        text: {
          primary: "#f5f3f0",      // オフホワイト
          secondary: "#b8b5c8",    // 柔らかいグレー
          muted: "#7a7890",        // くすんだ色
        },
        // ポップなアクセント
        accent: {
          DEFAULT: "#ff6b9d",      // ビビッドピンク
          hover: "#ff8bb5",
          glow: "rgba(255, 107, 157, 0.3)",
          secondary: "#7c5cff",    // パープル
          tertiary: "#00d4aa",     // ミントグリーン
          warm: "#ffb347",         // マンゴーオレンジ
        },
        // 漫画的装飾カラー
        manga: {
          pink: "#ff9ed2",
          mint: "#7fefbd",
          lavender: "#b8a9ff",
          peach: "#ffcab0",
          sky: "#87ceeb",
        },
        // ステータス
        success: "#7dd87d",
        warning: "#f0c674",
        error: "#e07575",
        // ガイド線
        guide: {
          h: "#ff8a8a",
          v: "#8ad4c8",
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
        'glow-pink': '0 0 20px rgba(255, 107, 157, 0.3)',
        'glow-purple': '0 0 20px rgba(124, 92, 255, 0.3)',
        'glow-mint': '0 0 20px rgba(0, 212, 170, 0.3)',
        'soft': '0 4px 20px rgba(0, 0, 0, 0.15)',
        'card': '0 2px 12px rgba(0, 0, 0, 0.2)',
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
        'gradient-pop': 'linear-gradient(135deg, #ff6b9d, #7c5cff)',
        'gradient-fresh': 'linear-gradient(135deg, #00d4aa, #7c5cff)',
        'gradient-warm': 'linear-gradient(135deg, #ffb347, #ff6b9d)',
        'gradient-card': 'linear-gradient(145deg, rgba(60, 60, 82, 0.8), rgba(49, 49, 69, 0.8))',
      },
    },
  },
  plugins: [],
};
