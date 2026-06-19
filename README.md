# COMIC-Bridge — アドレス外部参照版（セキュリティ強化ステージング）

これは COMIC-Bridge に **アドレス外部参照アーキテクチャ** を導入した作業用（ステージング）リポジトリです。
機密性のあるパス・URL・固有名詞を**ソースコードから排除**し、外部の「参照アドレスリスト」から
実行時に読み込む構成になっています。本体リポジトリへの反映は、検証完了後に行います。

> このリポジトリは **Private** 運用を前提としています。

## アーキテクチャ（3層）

```
パッチ (起動)                  %LOCALAPPDATA%\COMIC-Bridge\          参照アドレスリスト
patch\apply-address-patch.bat ─▶ address-ref-location.json      ─▶  G:\...\参照アドレス\
(G:パスを Base64 内蔵)            (中立なポインタ／ソースに残る唯一のパス)     addresses.json（リポジトリ外）
```

- **参照アドレスリスト（addresses.json）はこのリポジトリには含まれません。** 共有ドライブ上にあります。
- アプリのソースに残る位置情報は、中立な `%LOCALAPPDATA%\COMIC-Bridge\address-ref-location.json` のみです。

## 解決の実装

| 層 | 実装 |
|----|------|
| Rust | `src-tauri/src/address_ref.rs`（ポインタ→リスト読込・キャッシュ・再読込）。`commands.rs` / `security.rs` の旧定数は全廃。 |
| TS | `src/lib/addressRef.ts` + `src/lib/initAddresses.ts`（`main.tsx` で描画前ロード）。UIラベルは `getAddress("apps.*.displayName")` 等で実行時取得。 |
| JSX | レガシー `scan_psd.jsx` は `__addr()` リゾルバ。実働 `scan_psd_core.jsx` は元から設定JSON経由。 |
| アプリ内UI | TopNav の歯車 → 「参照アドレス設定」。`apply_address_patch` / `get_address_ref_status` / `reload_reference_addresses`。 |

## パッチの当て方（`patch/` 同梱）

- `patch\apply-address-patch.bat` … ダブルクリックで適用（ポインタ書込＋下記 updater 書換）
- `patch\参照アドレスをドロップして登録.bat` … 参照アドレスフォルダ/JSON をドロップして登録
- `patch\install-patch.bat` … `%LOCALAPPDATA%` へ導入＋デスクトップ/スタートメニューにショートカット作成
- 別の場所を指す場合は `apply-address-patch.ps1` の `$RefListB64`（Base64(UTF-8)）を差し替え

## updater エンドポイントについて（重要）

`src-tauri/tauri.conf.json` の updater エンドポイントは **プレースホルダ**
（`https://address-patch-required.invalid/latest.json`）になっています。
`patch\apply-address-patch.bat` を実行すると、参照アドレスリストの `updater.endpoint` の
実値へ自動で書き換えます（**ローカルビルド前提**）。

> **CI ビルドの注意**: CI は共有ドライブ（G:）に接続できないため、署名付き自動更新を
> 有効にするには **CI 側でエンドポイントを注入**する必要があります（GitHub Actions の
> variables / secrets 等）。未対応・要検討。

## 未解決時の挙動

参照リストが見つからない／壊れている場合、直打ちフォールバックはせず、該当機能を
エラー表示で停止します（セキュリティ要件）。

## 検証状況

`cargo check` / `npm run build`（tsc + vite）/ 既存の `npm run check:security` 回帰チェックに合格。
実機（`npm run tauri dev` / `tauri build`）での動作確認は未実施。
