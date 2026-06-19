import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";
import { initAddresses } from "./lib/initAddresses";
import { checkSharedListUpdate } from "./lib/checkAddressUpdate";

function renderApp() {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

// 参照アドレスリストを先に読み込んでから描画する。共有ドライブが遅い/不通でも
// 一定時間で描画へ進む(その場合、共有パス依存機能は実行時にエラー停止する)。
const ADDRESS_LOAD_TIMEOUT_MS = 6000;
Promise.race([
  initAddresses(),
  new Promise<void>((resolve) => setTimeout(resolve, ADDRESS_LOAD_TIMEOUT_MS)),
]).finally(() => {
  renderApp();
  // 描画後に、共有先(addresses.json)が前回起動時から更新されていないか確認する。
  // 変化していれば確認ダイアログを出し、OK のときだけ再読込する(描画は妨げない)。
  void checkSharedListUpdate();
});
