# 去找朋友，最後錄首歌（暫定）

第一人稱像素網頁遊戲原型。從租屋處出發，依序拜訪六位朋友，再到新店王17家錄音、混音，最後點擊藍牙喇叭聽歌。

## 在電腦啟動

需要 Node.js 24 LTS。於專案資料夾執行：

```powershell
npm.cmd ci
npm.cmd run dev
```

開啟終端機顯示的 Local 網址，預設為 `http://localhost:5173/`。保持終端機開啟；按 Ctrl+C 停止。

同一個 Wi-Fi 的手機可使用 Vite 顯示的 Network 網址（電腦防火牆必須允許）；正式上線後直接分享 GitHub Pages 的 HTTPS 網址。請橫屏遊玩。

## 操作

| 裝置 | 操作 |
| --- | --- |
| 電腦 | WASD 移動、E 互動、滑鼠轉視角、Esc 暫停。點擊場景可鎖定游標，拖曳及左右方向鍵也可轉視角。 |
| 手機 | 左側搖桿移動、右側滑動轉視角、互動按鈕。直屏時暫停。 |
| 記憶／料理／照片 | 點擊按鈕，或使用數字鍵。 |
| 節拍 | F 左、J 右；手機按左右大按鈕。 |
| 錄音 | 按住畫面錄音鍵或空白鍵，完成三個樂句。 |

每站完成後與關鍵進度變更時自動存檔；首頁的「繼續上次旅程」可恢復。存檔僅存在目前瀏覽器，不會同步裝置。暫停、切換分頁或轉直屏會停止當前小遊戲；回來後重新開始未完成的小遊戲，已完成的關卡和錄音仍保留。

約 15 分鐘為設計目標，完整歌曲播放時間另計；實際首次遊玩 12–18 分鐘仍需玩家試玩校準，沒有用等待時間強制拉長流程。

## 換成你的朋友與新歌

所有故事資料集中在 `src/content.ts`。

- `chapters`：名字、地點、衣服顏色、開場對話、完成對話、線索、兩級提示、轉場字幕。
- 原創的六位朋友和新增劇情均標註 `（暫定）`。提供真實設定後，可以逐段替換並移除对应標記；王17保留指定名字。
- 每個角色可設定 `portrait: 'characters/friend.png'`，並把透明背景 PNG 放進 `public/characters/`。建議 32×48 或其整數倍；保留透明留白。未設定時使用程式繪製的替代像素人物。
- 正式音檔放入 `public/audio/`，修改 `gameConfig.song.src`、`title`、`artist`。例如 `audio/my-new-song.mp3`。替換後同步修改結局的示範提示設定（見下方）。
- 三條混音音軌由 `gameConfig.stems` 指定；不需要真實歌曲分軌也能完成遊戲。
- 配方、照片位置、回憶順序、記憶序列、混音目標都在 `gameConfig`。更動答案時，要一併更新朋友對話、線索與提示。
- `gameConfig.prototype` 控制原型／正式歌曲提示，正式素材就緒時可設為 `false`。

現有音訊是自行合成的原創替代素材：三條 16 秒循環音軌、一首 32 秒示範曲，**不是你的正式新歌**。可用 `npm.cmd run audio` 重新產生。

錄音為遊戲互動，不會存取麥克風；藍牙喇叭為遊戲物件，不會要求配對硬體。聲音走玩家裝置當前的音訊輸出。

## GitHub Pages 部署

建議儲存庫名稱：`friend-song-game`。此專案不依賴伺服器 API、登入、資料庫或密鑰。

1. 在你的 GitHub 帳號建立儲存庫，將此資料夾的原始碼、`public`、`package-lock.json` 及 `.github/workflows/deploy.yml` 推上 `main` 分支。不要上傳 `node_modules` 或 `dist`。
2. 儲存庫 **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**。
3. 在 Actions 執行 **Deploy game to GitHub Pages**，或推送新的 `main` 提交。
4. 等待部署成功，開啟 workflow 提供的網址，通常為 `https://你的帳號.github.io/friend-song-game/`。

Workflow 使用 Node 24，依序安裝、執行邏輯測試、建置、部署 `dist`。Vite 的相對 `base` 讓素材同時支援專案子路徑與網站根目錄，不需要填 GitHub 帳號進程式。

GitHub Pages 的網站與音訊是靜態公開資源。「通關才能聽歌」是介面流程，不是保密或數位版權保護；尚不能公開的新歌請先保留替代音訊。

目前交付包含部署設定；只有實際 workflow 成功並取得網址後，才算已上線。

## 驗證與結構

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

- `src/world.ts`：像素房間、人物、碰撞與互動標記。
- `src/main.ts`：主線、介面、輸入、對話、暫停與結局播放器。
- `src/puzzles.ts`：各站桌面小遊戲及錄音／混音互動。
- `src/state.ts`：存檔驗證、完成與轉場、答案判定。
- `tests/state.test.ts`：關卡不可跳過、重複完成、完整進度、存檔損壞、答案與容錯。
- `scripts/generate-audio.mjs`：可重現的原創示範音訊生成器。

相容性目標：支援 WebGL 2 的新版 Chrome、Edge、Android Chrome、iPhone Safari。無 WebGL 2 時顯示說明。全螢幕、方向鎖定失敗時仍可手動橫屏遊玩。

實機手機效能、Safari 音訊及首次遊玩時長仍需在對應裝置驗收。瀏覽器視窗尺寸模擬不能代替真實手機測試。
