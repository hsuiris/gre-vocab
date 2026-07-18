# GRE 單字複習 App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React Native (Expo) GRE 單字複習 App with flip-card practice (英→中 / 中→英), 詳情展開(範例句/發音/字根字尾), Leitner 間隔重複記憶追蹤, 和學習天數熱點圖, 全部離線可用, 資料為建置期生成的靜態 `words.json`(A-Z, 由 PDF 講義 A-P 部分整理 + AI 補完 P-Z)。

**Architecture:** 純前端 Expo app,無後端。`assets/words.json` 打包進 App 當靜態資源。進度與熱點圖資料存 AsyncStorage。核心邏輯(Leitner 演算法、儲存層)是純函式/簡單 async wrapper,可獨立單元測試。UI 用 React Navigation(native-stack)串接三個畫面。發音用 `expo-speech`。

**Tech Stack:** Expo (TypeScript), React Navigation (native-stack), `@react-native-async-storage/async-storage`, `expo-speech`, `jest-expo`, Node.js scripts (CommonJS + 內建 `node:test`) for data pipeline tooling.

---

## Spec reference

見 `docs/superpowers/specs/2026-07-18-gre-vocab-app-design.md`。

## Batch letter ranges for content generation

字量分批依英文字首常見程度粗分,非硬性字數要求,以「涵蓋該範圍內合理的 GRE 常見字」為準:

| Batch file | Letters | Source |
|---|---|---|
| `data/words/01-a.json` | A | `data/raw/candidates.json`(篩 a 開頭) |
| `data/words/02-b-c.json` | B, C | candidates.json |
| `data/words/03-d-e.json` | D, E | candidates.json |
| `data/words/04-f-h.json` | F, G, H | candidates.json |
| `data/words/05-i-l.json` | I, J, K, L | candidates.json |
| `data/words/06-m-n.json` | M, N | candidates.json |
| `data/words/07-o-p.json` | O, P | candidates.json(PDF 只到 parameter,P 後半段需靠 AI 知識補完) |
| `data/words/08-q-r.json` | Q, R | 無來源,AI 生成 |
| `data/words/09-s.json` | S | 無來源,AI 生成 |
| `data/words/10-t-v.json` | T, U, V | 無來源,AI 生成 |
| `data/words/11-w-z.json` | W, X, Y, Z | 無來源,AI 生成 |

---

## Phase 1 — 專案骨架

### Task 1: Scaffold Expo TypeScript app

**Files:**
- Modify: `/Users/xuyunqin/Desktop/Iris_agent/gre-vocab/` (既有目錄,已有 `docs/` 和 `.git`)

- [ ] **Step 1: 在既有 gre-vocab 目錄內建立 Expo TypeScript 專案**

```bash
cd /Users/xuyunqin/Desktop/Iris_agent/gre-vocab
npx create-expo-app@latest . --template blank-typescript
```

若指令因目錄非空(已有 `docs/`、`.git`)而拒絕執行,改用:

```bash
mkdir /tmp/gre-vocab-scaffold && cd /tmp/gre-vocab-scaffold
npx create-expo-app@latest . --template blank-typescript
cp -r . /Users/xuyunqin/Desktop/Iris_agent/gre-vocab/
```

- [ ] **Step 2: 安裝套件**

```bash
cd /Users/xuyunqin/Desktop/Iris_agent/gre-vocab
npx expo install @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context @react-native-async-storage/async-storage expo-speech
```

- [ ] **Step 3: 確認 `docs/` 目錄仍存在、`App.tsx` 已產生**

```bash
ls docs/superpowers/specs/2026-07-18-gre-vocab-app-design.md App.tsx
```

Expected: 兩個檔案都存在,無錯誤。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Expo TypeScript app, install core deps"
```

### Task 2: 設定 Jest (jest-expo) 並驗證

**Files:**
- Modify: `package.json`
- Create: `__tests__/sanity.test.ts`

- [ ] **Step 1: 安裝測試依賴**

```bash
npm install --save-dev jest-expo @types/jest
```

- [ ] **Step 2: 在 `package.json` 加入 test script 與 jest 設定**

```json
{
  "scripts": {
    "test": "jest"
  },
  "jest": {
    "preset": "jest-expo"
  }
}
```

- [ ] **Step 3: 寫一個最小測試確認環境可跑**

```typescript
// __tests__/sanity.test.ts
test('jest-expo environment works', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 4: 執行測試**

Run: `npm test`
Expected: PASS,1 個測試通過。

- [ ] **Step 5: Commit**

```bash
git add package.json __tests__/sanity.test.ts
git commit -m "test: configure jest-expo"
```

---

## Phase 2 — 資料處理工具腳本

### Task 3: 把 PDF 轉成純文字

**Files:**
- Create: `data/raw/pdf-text.txt`

- [ ] **Step 1: 建立目錄並用 pdftotext 轉檔**

```bash
mkdir -p /Users/xuyunqin/Desktop/Iris_agent/gre-vocab/data/raw
pdftotext -layout ~/Desktop/GRE词汇红宝书赵丽.pdf /Users/xuyunqin/Desktop/Iris_agent/gre-vocab/data/raw/pdf-text.txt
```

（若系統無 `pdftotext`,用 `brew install poppler` 安裝。）

- [ ] **Step 2: 驗證輸出**

```bash
wc -l data/raw/pdf-text.txt
grep -c "abate" data/raw/pdf-text.txt
```

Expected: 行數 > 2000,且 `abate` 至少出現一次。

- [ ] **Step 3: Commit**

```bash
git add data/raw/pdf-text.txt
git commit -m "data: extract raw text from GRE vocab PDF"
```

### Task 4: 寫 parse-wordlist.js 解析候選字

**Files:**
- Create: `scripts/parse-wordlist.js`
- Test: `scripts/parse-wordlist.test.js`

- [ ] **Step 1: 寫測試**

```javascript
// scripts/parse-wordlist.test.js
const test = require('node:test');
const assert = require('node:assert');
const { parseCandidates } = require('./parse-wordlist');

test('extracts headword and raw line', () => {
  const input = 'abate 减少 bate 减少 rebate 打折\n';
  const result = parseCandidates(input);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].word, 'abate');
  assert.strictEqual(result[0].rawLine, 'abate 减少 bate 减少 rebate 打折');
});

test('skips junk lines (headers, emails, page numbers)', () => {
  const input = 'Wordlist 1\nhandout-author@example.com\n123\nIntroduction and Suggestions\n';
  const result = parseCandidates(input);
  assert.strictEqual(result.length, 0);
});

test('dedupes repeated headwords, keeps first occurrence raw line', () => {
  const input = 'abide 忍受，遵守（助记）离开爱的要忍耐\nabide sth 于事，坚持（重複出現的行）\n';
  const result = parseCandidates(input);
  const abideEntries = result.filter((r) => r.word === 'abide');
  assert.strictEqual(abideEntries.length, 1);
  assert.strictEqual(abideEntries[0].rawLine, 'abide 忍受，遵守（助记）离开爱的要忍耐');
});

test('a line starting with a root fragment (trailing hyphen) yields no candidate', () => {
  // parser only looks at the first token per line；"ac-" 是字根片語不是完整字，
  // 該行被跳過，不會往後找同行其他字（後續字仍會在自己的行首被抓到）
  const input = 'ac- 尖 acid 尖酸的 acute 尖的，敏锐的\n';
  const result = parseCandidates(input);
  assert.strictEqual(result.length, 0);
});
```

- [ ] **Step 2: 執行測試確認失敗(尚未實作)**

Run: `node --test scripts/parse-wordlist.test.js`
Expected: FAIL,`Cannot find module './parse-wordlist'`

- [ ] **Step 3: 實作 parse-wordlist.js**

```javascript
// scripts/parse-wordlist.js
const fs = require('fs');

const SKIP_PATTERNS = [
  /@/,
  /^wordlist\b/i,
  /^\d+$/,
  /handout-author/i,
  /^introduction and suggestions/i,
  /^gre\s*词汇/i,
];

function parseCandidates(text) {
  const lines = text.split('\n');
  const seen = new Map();
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (SKIP_PATTERNS.some((p) => p.test(line))) continue;

    const match = line.match(/^([a-zA-Z][a-zA-Z-]{1,25})\s+(.+)/);
    if (!match) continue;

    const word = match[1].toLowerCase();
    if (word.length < 3 || word.endsWith('-')) continue;

    if (!seen.has(word)) {
      seen.set(word, line);
    }
  }
  return Array.from(seen.entries()).map(([word, rawLine]) => ({ word, rawLine }));
}

function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  const text = fs.readFileSync(inputPath, 'utf8');
  const candidates = parseCandidates(text);
  fs.writeFileSync(outputPath, JSON.stringify(candidates, null, 2));
  console.log(`Extracted ${candidates.length} candidates -> ${outputPath}`);
}

if (require.main === module) {
  main();
}

module.exports = { parseCandidates };
```

- [ ] **Step 4: 執行測試確認通過**

Run: `node --test scripts/parse-wordlist.test.js`
Expected: PASS,4 個測試通過。

- [ ] **Step 5: 對真實 PDF 文字執行,產出候選清單**

```bash
node scripts/parse-wordlist.js data/raw/pdf-text.txt data/raw/candidates.json
```

Expected: 印出 `Extracted N candidates -> data/raw/candidates.json`,N 應在 1000-2500 之間。

- [ ] **Step 6: Commit**

```bash
git add scripts/parse-wordlist.js scripts/parse-wordlist.test.js data/raw/candidates.json
git commit -m "feat: add PDF candidate word parser"
```

### Task 5: 寫 validate-words.js 資料驗證器

**Files:**
- Create: `scripts/validate-words.js`
- Test: `scripts/validate-words.test.js`

- [ ] **Step 1: 寫測試**

```javascript
// scripts/validate-words.test.js
const test = require('node:test');
const assert = require('node:assert');
const { validateWords } = require('./validate-words');

test('valid entry passes with no errors', () => {
  const errors = validateWords([
    { word: 'abate', pos: 'v.', meaning: '減輕、緩和', example: 'The storm began to abate.', roots: 'a- (加強) + bate (打擊)' },
  ]);
  assert.strictEqual(errors.length, 0);
});

test('catches missing/empty field', () => {
  const errors = validateWords([
    { word: 'abate', pos: 'v.', meaning: '', example: 'x abate y', roots: 'r' },
  ]);
  assert.ok(errors.some((e) => e.includes('meaning')));
});

test('catches invalid word format', () => {
  const errors = validateWords([
    { word: 'Abate!', pos: 'v.', meaning: 'm', example: 'abate here', roots: 'r' },
  ]);
  assert.ok(errors.some((e) => e.includes('invalid word format')));
});

test('catches duplicate word across entries', () => {
  const entries = [
    { word: 'abate', pos: 'v.', meaning: 'm', example: 'abate here', roots: 'r' },
    { word: 'abate', pos: 'v.', meaning: 'm2', example: 'abate again', roots: 'r2' },
  ];
  const errors = validateWords(entries);
  assert.ok(errors.some((e) => e.includes('duplicate')));
});

test('catches example that does not use the word (even inflected)', () => {
  const errors = validateWords([
    { word: 'abate', pos: 'v.', meaning: 'm', example: 'The storm calmed down.', roots: 'r' },
  ]);
  assert.ok(errors.some((e) => e.includes('does not contain')));
});

test('accepts example using an inflected form of the word', () => {
  const errors = validateWords([
    { word: 'abate', pos: 'v.', meaning: 'm', example: 'The noise was abating slowly.', roots: 'r' },
  ]);
  assert.strictEqual(errors.length, 0);
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `node --test scripts/validate-words.test.js`
Expected: FAIL,`Cannot find module './validate-words'`

- [ ] **Step 3: 實作 validate-words.js**

```javascript
// scripts/validate-words.js
const fs = require('fs');

const REQUIRED_FIELDS = ['word', 'pos', 'meaning', 'example', 'roots'];
const WORD_PATTERN = /^[a-z][a-z-]*$/;

function containsWordStem(example, word) {
  const stem = word.slice(0, Math.max(4, word.length - 3)).toLowerCase();
  return example.toLowerCase().includes(stem);
}

function validateWords(entries) {
  const errors = [];
  const seen = new Set();

  entries.forEach((entry, i) => {
    for (const field of REQUIRED_FIELDS) {
      if (!entry[field] || typeof entry[field] !== 'string' || !entry[field].trim()) {
        errors.push(`[${i}] missing or empty field "${field}"`);
      }
    }

    if (entry.word && !WORD_PATTERN.test(entry.word)) {
      errors.push(`[${i}] invalid word format: "${entry.word}"`);
    }

    if (entry.word) {
      if (seen.has(entry.word)) {
        errors.push(`[${i}] duplicate word: "${entry.word}"`);
      }
      seen.add(entry.word);
    }

    if (entry.word && entry.example && !containsWordStem(entry.example, entry.word)) {
      errors.push(`[${i}] example does not contain the word "${entry.word}"`);
    }
  });

  return errors;
}

function main() {
  const filePath = process.argv[2];
  const entries = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const errors = validateWords(entries);
  if (errors.length) {
    console.error(`${errors.length} error(s) in ${filePath}:`);
    errors.forEach((e) => console.error(' -', e));
    process.exit(1);
  }
  console.log(`${filePath}: ${entries.length} entries OK`);
}

if (require.main === module) {
  main();
}

module.exports = { validateWords, containsWordStem };
```

- [ ] **Step 4: 執行測試確認通過**

Run: `node --test scripts/validate-words.test.js`
Expected: PASS,6 個測試通過。

- [ ] **Step 5: Commit**

```bash
git add scripts/validate-words.js scripts/validate-words.test.js
git commit -m "feat: add word entry schema validator"
```

### Task 6: 寫 merge-batches.js

**Files:**
- Create: `scripts/merge-batches.js`

- [ ] **Step 1: 實作**

```javascript
// scripts/merge-batches.js
const fs = require('fs');
const path = require('path');
const { validateWords } = require('./validate-words');

function mergeBatches(batchDir) {
  const files = fs.readdirSync(batchDir).filter((f) => f.endsWith('.json')).sort();
  const merged = [];
  for (const file of files) {
    const batch = JSON.parse(fs.readFileSync(path.join(batchDir, file), 'utf8'));
    merged.push(...batch);
  }
  return merged;
}

function main() {
  const batchDir = process.argv[2] || 'data/words';
  const outputPath = process.argv[3] || 'assets/words.json';
  const merged = mergeBatches(batchDir);
  const errors = validateWords(merged);
  if (errors.length) {
    console.error(`${errors.length} error(s) found across merged batches:`);
    errors.forEach((e) => console.error(' -', e));
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2));
  console.log(`Merged ${merged.length} words -> ${outputPath}`);
}

if (require.main === module) {
  main();
}

module.exports = { mergeBatches };
```

這支腳本重用 `validate-words.js` 的 `validateWords`,不用重寫驗證邏輯(DRY),Phase 4 會用它產出最終 `assets/words.json`,此階段先不用執行(`data/words/` 還是空的)。

- [ ] **Step 2: Commit**

```bash
git add scripts/merge-batches.js
git commit -m "feat: add batch merge + validate script"
```

---

## Phase 3 — 內容批次生成(A-Z)

以下 11 個 task 每個都是:讀取來源(PDF 候選字或既有 GRE 知識)→ 撰寫該範圍的 JSON 批次檔 → 跑驗證器 → 修正錯誤 → commit。每筆條目 schema 固定:

```json
{
  "word": "abate",
  "pos": "v.",
  "meaning": "中文意思(簡潔)",
  "example": "一句自然、程度符合 GRE 的英文例句，必須包含該單字(可用字尾變化)",
  "roots": "字根/字首/字尾拆解說明，中文敘述，例如：a- (加強) + bate (打擊，源自拉丁文 batre) → 打到力道減弱"
}
```

對於有 PDF 來源的批次(A-P),先讀 `data/raw/candidates.json` 篩出對應字首的條目,把裡面的中文意思與字根聯想文字當作素材整理成上述 schema(講義筆記格式不一定乾淨,可用自己的 GRE 知識校正/補充);範例句一律自己生成,因為來源沒有。對於無來源的批次(Q-Z),直接依自己的 GRE 常見字知識生成完整條目。

### Task 7: Batch A

**Files:**
- Create: `data/words/01-a.json`

- [ ] **Step 1: 篩出來源候選字**

```bash
node -e "const c=require('./data/raw/candidates.json'); console.log(JSON.stringify(c.filter(w=>w.word[0]==='a'), null, 2))" > /tmp/candidates-a.json
wc -l /tmp/candidates-a.json
```

- [ ] **Step 2: 撰寫 `data/words/01-a.json`**

參考 `/tmp/candidates-a.json` 內容,整理成完整 schema 的 JSON 陣列,涵蓋該字母下合理數量的 GRE 常見字。

- [ ] **Step 3: 驗證**

Run: `node scripts/validate-words.js data/words/01-a.json`
Expected: `data/words/01-a.json: N entries OK`(無錯誤訊息才算過)。若有錯誤,依錯誤訊息修正後重跑。

- [ ] **Step 4: Commit**

```bash
git add data/words/01-a.json
git commit -m "data: author GRE word batch (letter A)"
```

### Task 8: Batch B–C

**Files:**
- Create: `data/words/02-b-c.json`

- [ ] **Step 1: 篩出來源候選字**

```bash
node -e "const c=require('./data/raw/candidates.json'); console.log(JSON.stringify(c.filter(w=>['b','c'].includes(w.word[0])), null, 2))" > /tmp/candidates-bc.json
```

- [ ] **Step 2: 撰寫 `data/words/02-b-c.json`**(schema 同上)

- [ ] **Step 3: 驗證**

Run: `node scripts/validate-words.js data/words/02-b-c.json`
Expected: 無錯誤。

- [ ] **Step 4: Commit**

```bash
git add data/words/02-b-c.json
git commit -m "data: author GRE word batch (letters B-C)"
```

### Task 9: Batch D–E

**Files:**
- Create: `data/words/03-d-e.json`

- [ ] **Step 1:** 篩出候選字(`w.word[0]` in `['d','e']`),同 Task 8 手法。
- [ ] **Step 2:** 撰寫 `data/words/03-d-e.json`。
- [ ] **Step 3:** `node scripts/validate-words.js data/words/03-d-e.json` → 無錯誤。
- [ ] **Step 4:** `git add data/words/03-d-e.json && git commit -m "data: author GRE word batch (letters D-E)"`

### Task 10: Batch F–H

**Files:**
- Create: `data/words/04-f-h.json`

- [ ] **Step 1:** 篩出候選字(`['f','g','h']`)。
- [ ] **Step 2:** 撰寫 `data/words/04-f-h.json`。
- [ ] **Step 3:** `node scripts/validate-words.js data/words/04-f-h.json` → 無錯誤。
- [ ] **Step 4:** `git add data/words/04-f-h.json && git commit -m "data: author GRE word batch (letters F-H)"`

### Task 11: Batch I–L

**Files:**
- Create: `data/words/05-i-l.json`

- [ ] **Step 1:** 篩出候選字(`['i','j','k','l']`)。
- [ ] **Step 2:** 撰寫 `data/words/05-i-l.json`。
- [ ] **Step 3:** `node scripts/validate-words.js data/words/05-i-l.json` → 無錯誤。
- [ ] **Step 4:** `git add data/words/05-i-l.json && git commit -m "data: author GRE word batch (letters I-L)"`

### Task 12: Batch M–N

**Files:**
- Create: `data/words/06-m-n.json`

- [ ] **Step 1:** 篩出候選字(`['m','n']`)。
- [ ] **Step 2:** 撰寫 `data/words/06-m-n.json`。
- [ ] **Step 3:** `node scripts/validate-words.js data/words/06-m-n.json` → 無錯誤。
- [ ] **Step 4:** `git add data/words/06-m-n.json && git commit -m "data: author GRE word batch (letters M-N)"`

### Task 13: Batch O–P

**Files:**
- Create: `data/words/07-o-p.json`

- [ ] **Step 1: 篩出候選字**(`['o','p']`)。注意 PDF 只到 `parameter`,P 開頭候選字只涵蓋到 par- 附近,超過的部分(如 pedantic、pernicious、plausible…)直接依 GRE 常見字知識補上,不受候選字清單限制。
- [ ] **Step 2:** 撰寫 `data/words/07-o-p.json`。
- [ ] **Step 3:** `node scripts/validate-words.js data/words/07-o-p.json` → 無錯誤。
- [ ] **Step 4:** `git add data/words/07-o-p.json && git commit -m "data: author GRE word batch (letters O-P)"`

### Task 14: Batch Q–R(無 PDF 來源)

**Files:**
- Create: `data/words/08-q-r.json`

- [ ] **Step 1: 依 GRE 常見字知識直接撰寫 `data/words/08-q-r.json`**,schema 同上,Q 開頭字數天生較少屬正常。
- [ ] **Step 2:** `node scripts/validate-words.js data/words/08-q-r.json` → 無錯誤。
- [ ] **Step 3:** `git add data/words/08-q-r.json && git commit -m "data: author GRE word batch (letters Q-R)"`

### Task 15: Batch S(無 PDF 來源)

**Files:**
- Create: `data/words/09-s.json`

- [ ] **Step 1: 依 GRE 常見字知識撰寫 `data/words/09-s.json`**,S 開頭字通常數量最多,盡量涵蓋。
- [ ] **Step 2:** `node scripts/validate-words.js data/words/09-s.json` → 無錯誤。
- [ ] **Step 3:** `git add data/words/09-s.json && git commit -m "data: author GRE word batch (letter S)"`

### Task 16: Batch T–V(無 PDF 來源)

**Files:**
- Create: `data/words/10-t-v.json`

- [ ] **Step 1:** 撰寫 `data/words/10-t-v.json`。
- [ ] **Step 2:** `node scripts/validate-words.js data/words/10-t-v.json` → 無錯誤。
- [ ] **Step 3:** `git add data/words/10-t-v.json && git commit -m "data: author GRE word batch (letters T-V)"`

### Task 17: Batch W–Z(無 PDF 來源)

**Files:**
- Create: `data/words/11-w-z.json`

- [ ] **Step 1:** 撰寫 `data/words/11-w-z.json`,W/X/Y/Z 開頭字天生很少,盡力涵蓋合理範圍即可。
- [ ] **Step 2:** `node scripts/validate-words.js data/words/11-w-z.json` → 無錯誤。
- [ ] **Step 3:** `git add data/words/11-w-z.json && git commit -m "data: author GRE word batch (letters W-Z)"`

---

## Phase 4 — 合併資料

### Task 18: 合併批次產出 assets/words.json

**Files:**
- Create: `assets/words.json`(由腳本產生)
- Create: `src/data/words.ts`

- [ ] **Step 1: 執行合併**

```bash
node scripts/merge-batches.js data/words assets/words.json
```

Expected: `Merged N words -> assets/words.json`,無驗證錯誤(若有,回到對應 batch task 修正該筆資料後重跑)。

- [ ] **Step 2: 寫 `src/data/words.ts` 型別化 loader**

```typescript
// src/data/words.ts
import raw from '../../assets/words.json';

export type WordEntry = {
  word: string;
  pos: string;
  meaning: string;
  example: string;
  roots: string;
};

export const words: WordEntry[] = raw as WordEntry[];
```

- [ ] **Step 3: 確認可載入**

```bash
node -e "console.log(require('./assets/words.json').length)"
```

Expected: 印出總字數(> 0)。

- [ ] **Step 4: Commit**

```bash
git add assets/words.json src/data/words.ts
git commit -m "data: merge all batches into final words.json"
```

---

## Phase 5 — 核心邏輯(TDD)

### Task 19: Leitner 間隔重複演算法

**Files:**
- Create: `src/lib/date.ts`
- Create: `src/lib/leitner.ts`
- Test: `__tests__/leitner.test.ts`

- [ ] **Step 1: 寫 `src/lib/date.ts`**(小工具,無需測試,單行邏輯)

```typescript
// src/lib/date.ts
export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
```

- [ ] **Step 2: 寫失敗測試**

```typescript
// __tests__/leitner.test.ts
import { initialProgress, reviewWord, isDue, addDays } from '../src/lib/leitner';

test('initialProgress starts at box 1, due today', () => {
  const p = initialProgress('2026-07-18');
  expect(p).toEqual({ box: 1, nextReviewDate: '2026-07-18' });
});

test('reviewWord: knowing it advances one box and extends interval', () => {
  const p = reviewWord({ box: 1, nextReviewDate: '2026-07-18' }, true, '2026-07-18');
  expect(p.box).toBe(2);
  expect(p.nextReviewDate).toBe('2026-07-20'); // box 2 = 2 天
});

test('reviewWord: box caps at 5', () => {
  const p = reviewWord({ box: 5, nextReviewDate: '2026-07-18' }, true, '2026-07-18');
  expect(p.box).toBe(5);
  expect(p.nextReviewDate).toBe('2026-08-01'); // box 5 = 14 天
});

test('reviewWord: not knowing it resets to box 1', () => {
  const p = reviewWord({ box: 4, nextReviewDate: '2026-07-18' }, false, '2026-07-18');
  expect(p.box).toBe(1);
  expect(p.nextReviewDate).toBe('2026-07-19'); // box 1 = 1 天
});

test('isDue: true when nextReviewDate is today or earlier', () => {
  expect(isDue({ box: 1, nextReviewDate: '2026-07-18' }, '2026-07-18')).toBe(true);
  expect(isDue({ box: 1, nextReviewDate: '2026-07-17' }, '2026-07-18')).toBe(true);
});

test('isDue: false when nextReviewDate is in the future', () => {
  expect(isDue({ box: 1, nextReviewDate: '2026-07-19' }, '2026-07-18')).toBe(false);
});

test('addDays handles month rollover', () => {
  expect(addDays('2026-07-31', 2)).toBe('2026-08-02');
});
```

- [ ] **Step 3: 執行測試確認失敗**

Run: `npm test -- leitner`
Expected: FAIL,`Cannot find module '../src/lib/leitner'`

- [ ] **Step 4: 實作 `src/lib/leitner.ts`**

```typescript
// src/lib/leitner.ts
export type WordProgress = {
  box: number; // 1-5
  nextReviewDate: string; // YYYY-MM-DD
};

export const INTERVAL_DAYS = [1, 2, 4, 7, 14];

export function initialProgress(today: string): WordProgress {
  return { box: 1, nextReviewDate: today };
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function reviewWord(
  progress: WordProgress,
  knewIt: boolean,
  today: string
): WordProgress {
  const box = knewIt ? Math.min(progress.box + 1, 5) : 1;
  return { box, nextReviewDate: addDays(today, INTERVAL_DAYS[box - 1]) };
}

export function isDue(progress: WordProgress, today: string): boolean {
  return progress.nextReviewDate <= today;
}
```

- [ ] **Step 5: 執行測試確認通過**

Run: `npm test -- leitner`
Expected: PASS,7 個測試通過。

- [ ] **Step 6: Commit**

```bash
git add src/lib/date.ts src/lib/leitner.ts __tests__/leitner.test.ts
git commit -m "feat: add Leitner spaced repetition algorithm"
```

### Task 20: 儲存層(AsyncStorage wrapper)

**Files:**
- Create: `src/lib/storage.ts`
- Test: `__tests__/storage.test.ts`

- [ ] **Step 1: 寫失敗測試(用官方 AsyncStorage mock)**

```typescript
// __tests__/storage.test.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAllProgress,
  saveWordProgress,
  getHeatmap,
  incrementHeatmapToday,
  resetAllProgress,
} from '../src/lib/storage';

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('getAllProgress returns empty object when nothing saved', async () => {
  expect(await getAllProgress()).toEqual({});
});

test('saveWordProgress persists and getAllProgress reads it back', async () => {
  await saveWordProgress('abate', { box: 2, nextReviewDate: '2026-07-20' });
  const all = await getAllProgress();
  expect(all.abate).toEqual({ box: 2, nextReviewDate: '2026-07-20' });
});

test('incrementHeatmapToday accumulates counts per date', async () => {
  await incrementHeatmapToday('2026-07-18');
  await incrementHeatmapToday('2026-07-18');
  const heat = await getHeatmap();
  expect(heat['2026-07-18']).toBe(2);
});

test('resetAllProgress clears both progress and heatmap', async () => {
  await saveWordProgress('abate', { box: 2, nextReviewDate: '2026-07-20' });
  await incrementHeatmapToday('2026-07-18');
  await resetAllProgress();
  expect(await getAllProgress()).toEqual({});
  expect(await getHeatmap()).toEqual({});
});
```

- [ ] **Step 2: 在 jest 設定加上 AsyncStorage 官方 mock**

在 `package.json` 的 `jest` 區塊加入:

```json
{
  "jest": {
    "preset": "jest-expo",
    "setupFiles": [
      "@react-native-async-storage/async-storage/jest/async-storage-mock"
    ]
  }
}
```

- [ ] **Step 3: 執行測試確認失敗**

Run: `npm test -- storage`
Expected: FAIL,`Cannot find module '../src/lib/storage'`

- [ ] **Step 4: 實作 `src/lib/storage.ts`**

```typescript
// src/lib/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WordProgress } from './leitner';

const PROGRESS_KEY = 'gre-vocab:progress';
const HEATMAP_KEY = 'gre-vocab:heatmap';

type ProgressMap = Record<string, WordProgress>;
type HeatmapMap = Record<string, number>;

export async function getAllProgress(): Promise<ProgressMap> {
  const raw = await AsyncStorage.getItem(PROGRESS_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function saveWordProgress(word: string, progress: WordProgress): Promise<void> {
  const all = await getAllProgress();
  all[word] = progress;
  await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
}

export async function getHeatmap(): Promise<HeatmapMap> {
  const raw = await AsyncStorage.getItem(HEATMAP_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function incrementHeatmapToday(today: string): Promise<void> {
  const map = await getHeatmap();
  map[today] = (map[today] ?? 0) + 1;
  await AsyncStorage.setItem(HEATMAP_KEY, JSON.stringify(map));
}

export async function resetAllProgress(): Promise<void> {
  await AsyncStorage.multiRemove([PROGRESS_KEY, HEATMAP_KEY]);
}
```

- [ ] **Step 5: 執行測試確認通過**

Run: `npm test -- storage`
Expected: PASS,4 個測試通過。

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage.ts __tests__/storage.test.ts package.json
git commit -m "feat: add AsyncStorage-backed progress and heatmap storage"
```

---

## Phase 6 — UI

### Task 21: 發音 wrapper

**Files:**
- Create: `src/lib/speech.ts`

- [ ] **Step 1: 實作(單行邏輯,不需測試)**

```typescript
// src/lib/speech.ts
import * as Speech from 'expo-speech';

export function speakWord(word: string): void {
  Speech.speak(word, { language: 'en-US' });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/speech.ts
git commit -m "feat: add expo-speech pronunciation wrapper"
```

### Task 22: 學習天數熱點圖元件

**Files:**
- Create: `src/components/Heatmap.tsx`
- Test: `__tests__/heatmap.test.ts`

- [ ] **Step 1: 寫失敗測試(只測純函式 colorForCount)**

```typescript
// __tests__/heatmap.test.ts
import { colorForCount } from '../src/components/Heatmap';

test('zero count is the empty color', () => {
  expect(colorForCount(0)).toBe('#ebedf0');
});

test('higher counts map to darker greens', () => {
  const colors = [colorForCount(1), colorForCount(10), colorForCount(20), colorForCount(50)];
  expect(new Set(colors).size).toBe(4); // 四種不同深淺
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npm test -- heatmap`
Expected: FAIL,`Cannot find module '../src/components/Heatmap'`

- [ ] **Step 3: 實作 `src/components/Heatmap.tsx`**

```tsx
// src/components/Heatmap.tsx
import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';

type Props = { heatmap: Record<string, number>; weeks?: number };

export function colorForCount(count: number): string {
  if (count === 0) return '#ebedf0';
  if (count < 5) return '#c6e48b';
  if (count < 15) return '#7bc96f';
  if (count < 30) return '#239a3b';
  return '#196127';
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function Heatmap({ heatmap, weeks = 16 }: Props) {
  const days: Date[] = [];
  const today = new Date();
  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  const columns: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    columns.push(days.slice(i, i + 7));
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
      <View style={styles.grid}>
        {columns.map((col, ci) => (
          <View key={ci} style={styles.column}>
            {col.map((d, di) => (
              <View
                key={di}
                style={[styles.cell, { backgroundColor: colorForCount(heatmap[toDateStr(d)] ?? 0) }]}
              />
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginVertical: 12 },
  grid: { flexDirection: 'row' },
  column: { marginRight: 3 },
  cell: { width: 12, height: 12, borderRadius: 2, marginBottom: 3 },
});
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npm test -- heatmap`
Expected: PASS,2 個測試通過。

- [ ] **Step 5: Commit**

```bash
git add src/components/Heatmap.tsx __tests__/heatmap.test.ts
git commit -m "feat: add learning-day heatmap component"
```

### Task 23: FlashCard 翻卡元件

**Files:**
- Create: `src/components/FlashCard.tsx`

- [ ] **Step 1: 實作**

```tsx
// src/components/FlashCard.tsx
import React, { useRef, useState } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { WordEntry } from '../data/words';
import { speakWord } from '../lib/speech';

type Props = {
  entry: WordEntry;
  direction: 'en-zh' | 'zh-en';
  onResult: (knewIt: boolean) => void;
};

export function FlashCard({ entry, direction, onResult }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;

  const front = direction === 'en-zh' ? entry.word : entry.meaning;
  const back = direction === 'en-zh' ? entry.meaning : entry.word;

  function flip() {
    Animated.timing(spin, {
      toValue: flipped ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setFlipped(!flipped);
  }

  function handleResult(knewIt: boolean) {
    setFlipped(false);
    setExpanded(false);
    spin.setValue(0);
    onResult(knewIt);
  }

  const rotateY = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <View style={styles.container}>
      <Pressable onPress={flip}>
        <Animated.View style={[styles.card, { transform: [{ rotateY }] }]}>
          <Text style={styles.cardText}>{flipped ? back : front}</Text>
        </Animated.View>
      </Pressable>

      {flipped && (
        <View style={styles.actions}>
          <Pressable style={styles.knowBtn} onPress={() => handleResult(true)}>
            <Text style={styles.btnText}>認識</Text>
          </Pressable>
          <Pressable style={styles.dontKnowBtn} onPress={() => handleResult(false)}>
            <Text style={styles.btnText}>不認識</Text>
          </Pressable>
        </View>
      )}

      <Pressable onPress={() => setExpanded(!expanded)}>
        <Text style={styles.detailToggle}>{expanded ? '收起詳情 ▲' : '詳情 ▼'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.detail}>
          <Pressable onPress={() => speakWord(entry.word)}>
            <Text style={styles.speaker}>🔊 {entry.word}</Text>
          </Pressable>
          <Text style={styles.detailLabel}>範例句</Text>
          <Text style={styles.detailText}>{entry.example}</Text>
          <Text style={styles.detailLabel}>字根字尾</Text>
          <Text style={styles.detailText}>{entry.roots}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: 16 },
  card: {
    width: 300,
    height: 180,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardText: { fontSize: 28, fontWeight: '600' },
  actions: { flexDirection: 'row', marginTop: 16, gap: 12 },
  knowBtn: { backgroundColor: '#2e7d32', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  dontKnowBtn: { backgroundColor: '#c62828', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '600' },
  detailToggle: { marginTop: 16, color: '#555' },
  detail: { marginTop: 12, width: 300 },
  speaker: { fontSize: 18, marginBottom: 8 },
  detailLabel: { fontWeight: '600', marginTop: 8 },
  detailText: { color: '#333' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FlashCard.tsx
git commit -m "feat: add flip-card practice component"
```

### Task 24: HomeScreen

**Files:**
- Create: `src/screens/HomeScreen.tsx`

- [ ] **Step 1: 實作**

```tsx
// src/screens/HomeScreen.tsx
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { words } from '../data/words';
import { getAllProgress, getHeatmap } from '../lib/storage';
import { isDue } from '../lib/leitner';
import { Heatmap } from '../components/Heatmap';
import { todayStr } from '../lib/date';

export function HomeScreen({ navigation }: any) {
  const [dueCount, setDueCount] = useState(0);
  const [heatmap, setHeatmap] = useState<Record<string, number>>({});

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [progress, heat] = await Promise.all([getAllProgress(), getHeatmap()]);
        const today = todayStr();
        const due = words.filter((w) => {
          const p = progress[w.word];
          return !p || isDue(p, today);
        }).length;
        if (active) {
          setDueCount(due);
          setHeatmap(heat);
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GRE 單字複習</Text>
      <Text style={styles.due}>今日待複習：{dueCount} 字</Text>

      <Pressable style={styles.button} onPress={() => navigation.navigate('Practice', { direction: 'en-zh' })}>
        <Text style={styles.buttonText}>英 → 中</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={() => navigation.navigate('Practice', { direction: 'zh-en' })}>
        <Text style={styles.buttonText}>中 → 英</Text>
      </Pressable>
      <Pressable style={styles.linkButton} onPress={() => navigation.navigate('Stats')}>
        <Text style={styles.linkText}>統計</Text>
      </Pressable>

      <Heatmap heatmap={heatmap} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  due: { fontSize: 16, color: '#555', marginBottom: 20 },
  button: { backgroundColor: '#3949ab', padding: 14, borderRadius: 8, marginBottom: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkButton: { alignItems: 'center', marginBottom: 20 },
  linkText: { color: '#3949ab' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat: add home screen with due count and heatmap"
```

### Task 25: PracticeScreen

**Files:**
- Create: `src/screens/PracticeScreen.tsx`

- [ ] **Step 1: 實作**

```tsx
// src/screens/PracticeScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { words, WordEntry } from '../data/words';
import { getAllProgress, saveWordProgress, incrementHeatmapToday } from '../lib/storage';
import { initialProgress, isDue, reviewWord } from '../lib/leitner';
import { todayStr } from '../lib/date';
import { FlashCard } from '../components/FlashCard';

export function PracticeScreen({ route }: any) {
  const direction: 'en-zh' | 'zh-en' = route.params?.direction ?? 'en-zh';
  const [queue, setQueue] = useState<WordEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const progress = await getAllProgress();
      const today = todayStr();
      const due = words.filter((w) => {
        const p = progress[w.word];
        return !p || isDue(p, today);
      });
      setQueue(due);
      setIndex(0);
      setLoaded(true);
    })();
  }, []);

  async function handleResult(knewIt: boolean) {
    const entry = queue[index];
    const today = todayStr();
    const progress = await getAllProgress();
    const current = progress[entry.word] ?? initialProgress(today);
    const updated = reviewWord(current, knewIt, today);
    await saveWordProgress(entry.word, updated);
    await incrementHeatmapToday(today);
    setIndex((i) => i + 1);
  }

  if (!loaded) {
    return (
      <View style={styles.center}>
        <Text>載入中…</Text>
      </View>
    );
  }

  if (index >= queue.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.done}>今天的複習都完成了！</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>{index + 1} / {queue.length}</Text>
      <FlashCard entry={queue[index]} direction={direction} onResult={handleResult} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  progress: { textAlign: 'center', color: '#888', marginBottom: 8 },
  done: { fontSize: 18, fontWeight: '600' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/PracticeScreen.tsx
git commit -m "feat: add practice screen wiring cards to Leitner storage"
```

### Task 26: StatsScreen

**Files:**
- Create: `src/screens/StatsScreen.tsx`

- [ ] **Step 1: 實作**

```tsx
// src/screens/StatsScreen.tsx
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { words } from '../data/words';
import { getAllProgress, resetAllProgress } from '../lib/storage';

export function StatsScreen() {
  const [boxCounts, setBoxCounts] = useState<number[]>([0, 0, 0, 0, 0]);
  const [newCount, setNewCount] = useState(0);

  const load = useCallback(async () => {
    const progress = await getAllProgress();
    const counts = [0, 0, 0, 0, 0];
    let newWords = 0;
    for (const w of words) {
      const p = progress[w.word];
      if (!p) {
        newWords++;
      } else {
        counts[p.box - 1]++;
      }
    }
    setBoxCounts(counts);
    setNewCount(newWords);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function handleReset() {
    Alert.alert('重置進度', '確定要清除所有複習紀錄嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '確定',
        style: 'destructive',
        onPress: async () => {
          await resetAllProgress();
          load();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>統計</Text>
      <Text>尚未開始：{newCount} 字</Text>
      {boxCounts.map((count, i) => (
        <Text key={i}>盒子 {i + 1}：{count} 字</Text>
      ))}
      <Pressable style={styles.resetButton} onPress={handleReset}>
        <Text style={styles.resetText}>重置所有進度</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  resetButton: { marginTop: 24, backgroundColor: '#c62828', padding: 12, borderRadius: 8, alignItems: 'center' },
  resetText: { color: '#fff', fontWeight: '600' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/StatsScreen.tsx
git commit -m "feat: add stats screen with box counts and reset"
```

### Task 27: 導覽與 App 進入點

**Files:**
- Create: `src/navigation/RootNavigator.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: 實作 `src/navigation/RootNavigator.tsx`**

```tsx
// src/navigation/RootNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { PracticeScreen } from '../screens/PracticeScreen';
import { StatsScreen } from '../screens/StatsScreen';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'GRE 單字' }} />
        <Stack.Screen name="Practice" component={PracticeScreen} options={{ title: '練習' }} />
        <Stack.Screen name="Stats" component={StatsScreen} options={{ title: '統計' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 2: 修改 `App.tsx`**

```tsx
// App.tsx
import React from 'react';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return <RootNavigator />;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/navigation/RootNavigator.tsx App.tsx
git commit -m "feat: wire navigation between home, practice, and stats screens"
```

---

## Phase 7 — 驗證

### Task 28: 全套自動測試 + 手動 smoke test

**Files:**
- 無新檔案,驗證既有實作

- [ ] **Step 1: 跑全部單元測試**

Run: `npm test`
Expected: 所有測試(sanity, leitner, storage, heatmap)PASS,無失敗。

- [ ] **Step 2: 跑所有資料驗證器**

```bash
for f in data/words/*.json; do node scripts/validate-words.js "$f"; done
node scripts/validate-words.js assets/words.json
```

Expected: 每個檔案都印出 `... entries OK`,無錯誤。

- [ ] **Step 3: 啟動 App 做手動流程測試**

```bash
npx expo start
```

用 Expo Go(手機掃 QR code)或模擬器操作,確認:
1. 首頁顯示待複習字數與熱點圖(空熱點圖也應正常渲染,不crash)
2. 點「英→中」進入練習,卡片顯示英文單字,翻卡看到中文意思
3. 展開「詳情」看到範例句、字根字尾說明,按喇叭圖示能聽到英文發音
4. 按「認識」或「不認識」後換下一張卡,複習完畢顯示完成訊息
5. 回首頁,待複習字數有減少(答對的字被延後到未來日期)
6. 點「中→英」確認方向相反時邏輯一致(共用同一份進度)
7. 進入「統計」畫面,盒子字數與剛才操作相符;按「重置所有進度」後回首頁,待複習字數變回全部字數

- [ ] **Step 4: 若手動測試中發現問題,回對應 task 修正並重新驗證**

- [ ] **Step 5: 最終 commit(若有修正)**

```bash
git add -A
git commit -m "fix: address issues found during manual smoke test"
```
