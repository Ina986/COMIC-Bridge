import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = (message) => {
  console.error(`Security regression check failed: ${message}`);
  process.exit(1);
};

const packageJson = JSON.parse(read("package.json"));
const tauriConf = JSON.parse(read("src-tauri/tauri.conf.json"));
const capability = JSON.parse(read("src-tauri/capabilities/default.json"));
const indexHtml = read("index.html");
const libRs = read("src-tauri/src/lib.rs");
const commandsRs = read("src-tauri/src/commands.rs");
const securityRs = read("src-tauri/src/security.rs");
const viteConfig = read("vite.config.ts");

const capabilityText = JSON.stringify(capability);
const assetScope = tauriConf.app?.security?.assetProtocol?.scope ?? [];
const csp = tauriConf.app?.security?.csp ?? "";

if (capabilityText.includes("fs:read-all")) fail("fs:read-all is enabled");
if (capabilityText.includes("fs:write-all")) fail("fs:write-all is enabled");
if (capabilityText.includes('"path":"**"') || capabilityText.includes('"path": "**"')) {
  fail("fs scope contains **");
}
if (assetScope.some((scope) => scope === "**" || scope === "$TEMP/**")) {
  fail("assetProtocol scope contains a broad wildcard");
}

for (const directive of ["script-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) {
  if (!csp.includes(directive)) fail(`tauri CSP is missing ${directive}`);
  if (!indexHtml.includes(directive)) fail(`index.html CSP is missing ${directive}`);
}

for (const forbidden of ["authorize_user_paths", "confirm_file_picker_paths", "allowPath", "registerPath"]) {
  if (`${libRs}\n${commandsRs}\n${securityRs}`.includes(forbidden)) {
    fail(`forbidden path registration API marker found: ${forbidden}`);
  }
}

for (const required of [
  "ensure_read_path",
  "ensure_write_path",
  "ensure_query_path",
  "validate_file_name",
  "grant_user_path",
  "app_temp_dir",
  // 一時ファイル管理（姉妹アプリ統一仕様）: カテゴリ別サブフォルダ＋起動時クリーンアップ
  "temp_subdir",
  "cleanup_temp_on_startup",
]) {
  if (!securityRs.includes(required)) fail(`security helper is missing: ${required}`);
}

for (const command of [
  "secure_open_dialog",
  "secure_save_dialog",
  "secure_read_dir",
  "secure_stat",
  "secure_read_binary_file",
]) {
  if (!libRs.includes(command)) fail(`secure command is not registered: ${command}`);
}

if (!viteConfig.includes('"@tauri-apps/plugin-fs"') || !viteConfig.includes('"@tauri-apps/plugin-dialog"')) {
  fail("Vite aliases for secure Tauri wrappers are missing");
}

if (packageJson.scripts?.["check:security"] !== "node scripts/check-security-regression.mjs") {
  fail("package.json check:security script is missing");
}

console.log("Security regression check passed");
