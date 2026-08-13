# 中文概念分群：用意思找字，並分強弱

日期：2026-08-14

## 目標

把「近義詞／反義詞」分頁從**以英文字為主**改成**以中文概念為主**。

現在：查 `abhor` → 看到 WordNet 挖出來的 `abominate`。
之後：點「討厭」→ 看到全部討厭類的字，由強到弱排好，旁邊掛著相反概念「喜歡」。

## 已決定的取捨

| 問題 | 決定 |
| --- | --- |
| 擺在哪 | 直接改掉 `RelationsScreen`，不新增分頁 |
| `assets/relations.json` | **保留**。`MultipleChoiceCard` 還在用它出干擾選項 |
| 概念清單怎麼定 | 先由 AI 擬一份 60–80 個的固定清單，使用者過目後才分字 |
| 分群資料怎麼生 | 平行 subagent 跑完 3192 個字，兩輪 |
| 反義詞 | 概念對概念（討厭 ⇄ 喜歡），不做單字對單字 |
| 一個字可以進幾組 | 最多 2 組 |
| 強弱分級 | 資料存 1–5，畫面歸成 3 段（強 / 中 / 弱） |
| 概念卡預設狀態 | 收合。平均一組 ~45 個字，全攤開會爆 |
| A–Z 索引 | 拿掉。概念是中文，字母跳轉沒有意義 |

## 不做（YAGNI）

- 概念的階層／子分類。一層就好。
- 使用者自訂概念或自己調強弱。
- 用概念出測驗題。測驗照舊走 `relations.json`。
- 補上沒被分到組的字。分不到就分不到，畫面不顯示。

## 資料

新檔 `assets/concepts.json`：

```json
[
  {
    "id": "dislike",
    "zh": "討厭",
    "opposite": "like",
    "words": [
      { "w": "abhor", "lv": 5 },
      { "w": "detest", "lv": 5 },
      { "w": "loathe", "lv": 4 },
      { "w": "dislike", "lv": 2 }
    ]
  }
]
```

- `id`：英文小寫 kebab-case，唯一。
- `zh`：畫面上顯示的中文概念名。
- `opposite`：另一個概念的 `id`，或 `null`。**必須互指**（`like.opposite === "dislike"`）。
- `words[].w`：必須存在於 `assets/words.json`。
- `words[].lv`：整數 1–5，5 最強。

新檔 `src/data/concepts.ts`，比照 `src/data/relations.ts` 的寫法：

```ts
export type ConceptWord = { w: string; lv: number };
export type Concept = { id: string; zh: string; opposite: string | null; words: ConceptWord[] };
export const concepts: Concept[];
export function conceptsOf(word: string): Concept[];   // 這個字屬於哪些概念
```

## 產生流程（一次性）

腳本不進 repo，用 subagent 跑，結果 commit 進 `assets/concepts.json`。

1. **第一輪 — 擬概念清單。** 8 個 subagent，各拿 ~400 個字的 `word + meaning`，各自回報看到的概念。主流程合併去重、配對相反概念，產出 60–80 個概念的清單。**使用者過目、刪改後才進第二輪。**
2. **第二輪 — 分字。** 完整清單發給 16 個 subagent，各拿 200 個字，每個字回傳 0–2 筆 `{ concept_id, lv }`。
3. **合併＋清理。**
   - 丟掉 `concept_id` 不在清單裡的
   - 丟掉字數 < 3 的概念（連同它的 `opposite` 反指也要清掉）
   - 每個字超過 2 組時，留 `lv` 最高的兩組
   - 每組內依 `lv` 由大到小排序

## 畫面

`RelationsScreen` 重寫，`FlatList` 的每一列是一個概念卡。

**收合狀態**：概念名、字數、相反概念、前 6 個字（只有英文，無中文）。
**展開狀態**：分 3 段列出全部的字。

```
┌─ 討厭  23字 ─────────┐
│ ⇄ 相反：喜歡          │
│ 強                    │   lv 4–5
│   abhor    憎惡       │
│   detest   痛恨       │
│ 中                    │   lv 3
│   loathe   厭惡       │
│ 弱                    │   lv 1–2
│   dislike  不喜歡     │
└──────────────────────┘
```

- 點英文字＝朗讀（沿用 `speakWord`）。
- 點「⇄ 相反：喜歡」＝捲到那張卡並展開。
- 搜尋框一個，兩種用法：輸入中文比對 `zh`；輸入英文比對 `words[].w`，命中則顯示該字所在的概念卡。
- 現有的「只看有反義詞」按鈕改成「只看有相反概念」。
- `AlphabetIndex` 與 `SwipeToRemove` 從這一頁移除；被丟進回收桶的字仍要從概念卡內濾掉。

展開狀態用一個 `useState<Set<string>>` 存已展開的 `id`，不落地儲存。

## 檢查

`scripts/validate-concepts.js`，比照 `scripts/validate-words.js` 的寫法與 `npm test` 的接法：

- `id` 唯一、非空
- `opposite` 若非 null，該 id 必須存在且互指
- 每個 `w` 都在 `words.json` 裡（不分大小寫）
- `lv` 是 1–5 的整數
- 每個字最多出現在 2 個概念裡
- 每個概念至少 3 個字

`__tests__/relations.test.ts` 保留（`relations.json` 還在）。新增 `__tests__/concepts.test.ts` 測 `conceptsOf()` 找不到時回傳 `[]`。`__tests__/screens.test.tsx` 裡碰到 `RelationsScreen` 的段落要改成用概念資料。
