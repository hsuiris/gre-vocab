# 答題側邊面板、筆記庫、單字總覽播放器

日期：2026-08-07

## 目標

1. 答題畫面在寬螢幕改成左右分欄：左邊答題，右上錯題／不熟清單，右下筆記區，上方進度條。
2. 筆記可以存進「筆記庫」，首頁新增入口。
3. 首頁新增「單字總覽」，內含一個會自動朗讀的播放器。

## 已決定的取捨

| 問題 | 決定 |
| --- | --- |
| 版面 | 解鎖橫式（iPad／手機橫放）才分欄；直式退回抽屜式面板 |
| 一則筆記的單位 | 一場練習一則，依日期列出 |
| 錯題面板內容 | 這一場答錯的（自動）＋ 手動標「不熟」的 |
| 播放內容 | 只唸英文：單字 → 例句 |
| 總覽找字方式 | 搜尋框 ＋ 右側 A-Z 快速跳轉條 |
| 播放器控制 | 上一個／播放暫停／下一個 ＋ 語速選單 |

## 不做（YAGNI）

- 鎖屏／背景播放。`expo-speech` 在 App 進背景就停，平台限制。
- 筆記搜尋、標籤、富文字。純文字。
- 中途離開自動存筆記草稿。要按按鈕才存。
- 筆記綁單字。已選「一場一則」。

---

## A. 答題畫面

### 版面切換

`useWindowDimensions()` 取寬度，`wide = width >= 700`。

- **wide**：`flexDirection: 'row'`，左欄 `flex: 1`，右欄固定 320pt。右欄上半錯題、下半筆記。
- **narrow**：維持現況單欄；標題列下方右側兩顆按鈕 `錯題 N`、`筆記`，點了開 `Modal` 顯示同一個面板元件。

`app.json` 的 `orientation` 由 `portrait` 改為 `default`。

### 進度

畫面最上方一列：`{index + 1} / {queue.length}` ＋ 一條進度條（外框 `colors.line`，內填 `colors.green`，寬度 `(index+1)/total`）。

### 錯題／不熟面板

`PracticeScreen` 持有 `marked: { word: string; reason: 'wrong' | 'unsure' }[]`，只活在這一場，不進 AsyncStorage（歷史錯題已由既有的 `WRONG_KEY` 負責）。

- `handleResult(false)` 時自動 push `reason: 'wrong'`。
- `MultipleChoiceCard` 左上新增 `☆ 不熟` 按鈕 → `onMarkUnsure()` → push `reason: 'unsure'`。同一個字只留一筆，`wrong` 優先。
- 每列顯示：單字、中文意思、例句。

### 筆記區

`note` 字串 state，一場共用。`TextInput multiline`。下方「存到筆記庫」按鈕；練習結束畫面也放一顆。空白時按鈕停用。

### 筆記資料

新的 AsyncStorage key `gre-vocab:notes`，內容為陣列：

```ts
type StudyNote = {
  id: string;        // `${date}-${序號}`，不用 Date.now 以外的亂數
  date: string;      // YYYY-MM-DD
  mode: string;      // 「英選中」「句子填空」…
  total: number;     // 這場題數
  wrongCount: number;
  text: string;
};
```

`storage.ts` 新增 `getNotes()`、`saveNote(note)`（同 id 覆蓋，否則插到最前）、`deleteNote(id)`。`resetAllProgress` 不清筆記——筆記是使用者寫的內容，不是進度。

### 筆記庫畫面

`NotesScreen`：`FlatList` 依日期新到舊。每列顯示日期、題型、`N 題 · 錯 M`、筆記前兩行。點一列展開成可編輯的 `TextInput` ＋「儲存」「刪除」。

---

## B. 單字總覽 ＋ 播放器

`AllWordsScreen`：

- 上方 `TextInput` 搜尋（比對 `word` 與 `meaning`，不分大小寫）。
- `FlatList` 列出過濾後的字，每列單字＋中文。
- 右側絕對定位的 A-Z 直條，點字母 `scrollToIndex` 到該字母第一個字。因為要 `scrollToIndex`，列高固定並提供 `getItemLayout`。
- 底部播放列：`⏮ / ▶⏸ / ⏭`，右側語速 `0.75× / 1.0× / 1.25×` 循環切換，中央顯示目前單字與 `n / total`。

### 播放邏輯

`speech.ts` 新增：

```ts
speakSequence(parts: string[], opts: { rate?: number; onDone?: () => void }): void
stopSpeaking(): void
```

用 `Speech.speak(text, { onDone })` 串接下一段，段與段之間不用 `setTimeout`（`onDone` 已是自然停頓）；整串唸完呼叫 `opts.onDone`。

`AllWordsScreen` 播放時：`speakSequence([word, example], { rate, onDone: 播下一個 })`。

避免 stale closure：`playingRef` 存目前是否播放中、`indexRef` 存目前索引，`onDone` 只讀 ref。

離開畫面（`useFocusEffect` 的 cleanup）呼叫 `stopSpeaking()`。

搜尋過濾時播放清單跟著變成過濾後的清單。

---

## 檔案異動

**新增**

- `src/screens/AllWordsScreen.tsx`
- `src/screens/NotesScreen.tsx`
- `src/components/SessionSidePanel.tsx`

**修改**

- `app.json`（orientation）
- `src/lib/storage.ts`（筆記 CRUD）
- `src/lib/speech.ts`（`speakSequence`、`stopSpeaking`）
- `src/screens/PracticeScreen.tsx`
- `src/components/MultipleChoiceCard.tsx`（不熟按鈕）
- `src/screens/HomeScreen.tsx`（兩張新卡）
- `src/navigation/RootNavigator.tsx`（兩條路由）

**測試**

- `__tests__/storage.test.ts`：筆記存、覆蓋、刪、`resetAllProgress` 不動筆記。
- `__tests__/speech.test.ts`：`speakSequence` 依序唸完並回呼；`stopSpeaking` 中斷後不再往下唸。
