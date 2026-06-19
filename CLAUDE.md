# COMIC-Bridge Developer Notes / 現行仕様サマリ

漫画原稿の入稿チェック・差替え・分割・写植支援を行う **Tauri 2.x** デスクトップアプリ。
**Rust backend（`src-tauri/src`）＋ React/TS frontend（`src`）＋ Photoshop JSX（`src-tauri/scripts`）**。

> 🔒 **秘密はソースに置かない**：社内パス・組織名・取引先名・更新先・APP_SECRET・署名鍵は本ソースツリーに含めない。
> 実値は**参照アドレス（`addresses.json`→暗号化 `addresses.enc`）**と**リポジトリ外フォルダ**で管理。
> 詳細な内部メモ: `comicbridge\パッチ\CLAUDE_internal_notes.md`（リポ外）。
> セキュリティ仕様の全体: `comicbridge\0608\セキュリティ手順書\COMIC-Bridge_セキュリティ仕様_横展開用\`（`セキュリティ強化運用方法\`00〜12 ＋ `パッチ処理方法\`別冊）。

---

## バージョンとビルド／リリース（★コーディングAIが必ず守る）

- **バージョンは3ファイルを同時に上げる**：`package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml`。
- **署名ビルドはユーザーが実行**（署名鍵が必要）。エージェントは**編集＋検証（`npx tsc --noEmit` / `cargo check`）まで**。
  - コマンド: `0608\新)パッチ\build-with-updater-signing.ps1`（`-RepoRoot` / `-RefList` / `-KeyDir`）。
- 🔴 **署名の順序（最重要）**：`tauri build` の `.sig` は署名前exeへの署名。**Authenticode(signtool)はexeを書き換える**ため、**Authenticode後に `.sig` を再生成**する（スクリプトが実施。`Updater signatures (.sig) regenerated ...` ログ確認）。逆順だと**全端末の自動更新が静かに停止**する。
- **配布先 = G:App_installerの `COMIC-Bridge\`（アプリ別サブフォルダ）** に `exe`＋`.sig` を置く（移行期は直下にも）。
- **配布前に `.sig` を機械検証**（minisign＝Ed25519 over Blake2b-512(file)。keyid一致だけでなく署名一致を見る）。
- **JSXを変更したら必ず再ビルド**（整合性ゲートのハッシュが変わるため）。

## 自動更新（脱GitHub・`src-tauri/src/updater_local.rs`）

- 取得元は **G:共有ドライブ**（参照アドレス `updater.localDir` の `\COMIC-Bridge\` サブフォルダ。無ければ直下フォールバック）。実行時GitHub非接触。
- **minisign 署名検証**（内蔵公開鍵 `updater.pubkey`）で未署名/改ざん/別鍵を拒否。
- **サイレント更新**：NSIS を `/S /R /UPDATE`（無人・完了後に自動再起動・更新モード）。
- **MOTW回避**：G:由来exeのMark-of-the-WebでSmartScreenに阻まれないよう **`CreateProcess` で起動**（ShellExecute非経由）。
- 起動時チェックはリトライ＋更新は**先に通知モーダル→押下後のみ適用**。
- サブフォルダ名は定数 `APP_UPDATE_SUBDIR`（横展開時はアプリ名へ）。

## pdfium（`src-tauri/src/pdf.rs`）

- **同梱しない**。配布元＝G:共有（`pdf.pdfiumPath`）→ 実行時の実体＝**ローカル `%LOCALAPPDATA%\COMIC-Bridge\pdfium\pdfium.dll`** に取得（`ensure_local_pdfium`）。
- 一度ローカルに置けば **G:未接続でもPDFが動く（オフライン対応）**。
- **三重ハッシュ検証**（配布元コピー前／コピー後／ロード直前）。期待値は `pdf.pdfiumSha256`。
- pdfium 更新＝**G:差し替え＋`pdf.pdfiumSha256` を再シール**（→ アプリ再ビルド不要）。起動ログ `[pdfium] OK`。

## セキュリティ設計（不変条件・崩さない）

- **全FS/プロセスIPCは `security.rs` の `ensure_read_path`/`ensure_write_path`/`ensure_query_path`/`ensure_directory_read_path` を通す**（canonical化＋許可リスト＋保護パス拒否）。新コマンド追加時も必須。
- 外部起動は `Command::new(固定exe).arg()` か `opener`（**`cmd /c start` 禁止＝シェル注入回避**）。
- **CSP**：`script-src 'self'`・`unsafe-eval` なし。**capability**：`fs:read-all`/`fs:write-all` なし（最小権限）。
- **整合性ゲート**：`build.rs` が `scripts/*.jsx` と pdfium の SHA-256 を exe へ焼込 → `integrity.rs` が実行前に照合（不一致で停止・fail-closed）。
- **temp**：`%TEMP%\COMIC-Bridge`、`harden_temp_dir` で ACL を現ユーザ＋SYSTEMのみに。ジョブ別ファイル名で衝突回避。
- **生プラグイン封鎖**：`vite.config.ts` の alias で `plugin-fs`/`plugin-dialog` を `src/lib/secureTauri.ts` に差し替え（全操作を `secure_*` 経由へ強制）。**secureTauri.ts と alias を削除しない**。
- **PSD入口ガード**：`src-tauri/src/psd_safety.rs`（ファイルサイズ上限＋`8BPS`＋寸法/画素数サニティを全パース入口の手前で検査）。

## アドレス外部参照＋割符暗号化

- 社内パス・更新先・固有名詞は **`addresses.json` に外部化** → **`addresses.enc`（割符 AES-256-GCM）** をG:に置き、アプリが**起動毎に復号**（`crypto.rs`/`address_ref.rs`）。ソースに残るのは中立ポインタのみ。
- マスター平文（`comicbridge\参照アドレス管理\addresses.json`）を編集したら **`comicbridge\ツール\アドレス暗号化.ps1` をダブルクリックで再シール**（既存割符を再利用）。
- 🔴 **ソースに固有名詞・実パス・秘密を直書きしない**（`参照アドレス管理\addr_verify.py` で残存固有名詞・未定義キーを静的検査）。

## テキスト抽出／写植ツール(ProGen)ハンドオフ（1.9.44〜）

- テキスト抽出の **.txt 本体**も、ProGen受け渡しマーカー **`.progen_handoff.txt`** も、ともに **`Desktop\Script_Output\テキスト抽出`** に出す（フォルダ一体化・受け渡し先は `launch_typeset_tool` に直打ち）。
- マーカーの中身＝抽出 .txt のフルパス。ProGen はこのフォルダを監視して開く。

## ソース同期（G:共有ドライブ方式・脱GitHub）— コーディングAIは必ず従う

ソース（元データ）は **G:「更新用フォルダ」に zip 保管**し、**修正のたびに 最新取得→作業→戻す**。詳細・コマンドは **`SOURCE_SYNC.md`（リポジトリ直下）**。

- 保管場所: `(社内共有ドライブの所定フォルダ／具体パスは社内手順書を参照)`
- ファイル名規約（**他アプリも同居＝プレフィックスで仕分け**）: `COMIC-Bridge_src_v<version>_<YYYYMMDD-HHMMSS>.zip`（最新＝日時最大）
- **作業開始時**: `SOURCE_SYNC.md` 手順1で最新取得。**完了時（tsc/cargo通過後）**: 手順3で zip 化してアップロード。
- アーカイブに **node_modules / dist / target / .git / patch / .env / 秘密（addresses平文・署名鍵・APP_SECRET）は入れない**（`patch` は社内実パスを含むため必須）。
- これはソース同期。**配布exeの自動更新（`App_installer\COMIC-Bridge\`）とは別系統**。

## 開発上の注意

- `npm run tauri dev` は使わない（ビルドで確認）。
- フロントのみの変更は再ビルドで反映／Rust・JSX変更も再ビルド（JSXは整合性ゲートのため必須）。
- 詳細な現行実装の対応表・脅威モデル・実装雛形は **セキュリティ手順書 kit**（上記パス）を参照。
