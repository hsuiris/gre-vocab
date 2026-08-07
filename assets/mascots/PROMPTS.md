# 吉祥物繪圖 Prompt（貼到 ChatGPT）

畫好之後存成 PNG，檔名照下面寫的，放在這個資料夾（`assets/mascots/`）。
跟我說「存好了」，我就接進 App。

**每張圖的共同要求**

- 背景透明（transparent PNG）
- 正方形，1024×1024
- 角色完整入鏡，四周留一點空白，不要被切到
- 正面站姿，臉朝前

---

## 第 1 張：主角女生（三個表情，一次畫完）

一次畫三個姿勢最重要——同一次生成出來的三張，臉和衣服才會長得一樣。

```
Create a single transparent-background PNG, 1024x1024, containing THREE
full-body chibi anime characters of the SAME girl side by side, evenly spaced,
all facing the viewer.

Character design (identical in all three):
- Chibi proportions, about 2.5 heads tall, soft rounded body
- Shoulder-length wavy chestnut-brown hair with straight bangs
- Large round dark-brown eyes with a single white highlight, tiny nose,
  small smile, soft pink blush on both cheeks
- Light blue short-sleeve sailor dress with a white collar and a navy ribbon
  at the chest, two thin navy stripes near the hem
- White knee socks, black mary-jane shoes
- A small fluffy white cat with a simple dot face sitting on top of her head

Poses, left to right:
1. Standing calmly, arms relaxed at her sides, gentle closed-mouth smile
2. Jumping with both arms raised high, eyes closed in a happy curve, wide
   open smile, hair and skirt lifted by the motion
3. Standing slightly slumped, head tilted down a little, one hand touching her
   cheek, small worried smile, a single sweat drop near her temple

Art style: clean thick dark-brown outlines of even weight, flat cel shading
with one soft shadow tone, pastel palette, sticker-illustration look.
No background, no shadow on the ground, no text, no border, no watermark.
```

存成三個檔案（把整張圖裁成三份）：

| 姿勢 | 檔名 |
| --- | --- |
| 站著 | `girl-idle.png` |
| 跳起來 | `girl-happy.png` |
| 垂頭 | `girl-sad.png` |

---

## 第 2 張：八隻小動物

```
Create a single transparent-background PNG, 1024x1024, containing EIGHT cute
chibi animal characters arranged in a 4x2 grid, evenly spaced, all facing the
viewer, all drawn at the same scale.

The eight animals, left to right, top row then bottom row:
1. Calico cat, white with orange and grey patches
2. White rabbit with long ears and a tiny carrot
3. Penguin, black and white, wearing a small red scarf
4. Yellow baby chick with tiny orange beak and feet
5. Shiba inu, cream and orange, sitting with its tail curled
6. Grey hamster, very round, holding a sunflower seed
7. Pink pig with a round snout and curly tail
8. Light blue baby elephant with a small trunk

Shared design rules for all eight:
- Very round chubby bodies, short stubby limbs, oversized head
- Two simple black dot eyes, a tiny mouth, soft pink oval blush on each cheek
- Sitting or standing upright, calm friendly expression

Art style: clean thick dark-brown outlines of even weight, flat cel shading
with one soft shadow tone, soft pastel palette, sticker-illustration look.
No background, no ground shadow, no text, no border, no watermark.
```

裁成八個檔案：

`cat.png` `rabbit.png` `penguin.png` `chick.png` `shiba.png` `hamster.png` `pig.png` `elephant.png`

---

## 之後想再加圖的話

在**同一個對話**裡接著說，風格才會一致：

```
Same character, same art style, same line weight and palette as before.
Now draw her <描述新姿勢>. Transparent background, 1024x1024, full body,
facing the viewer. No background, no text, no watermark.
```

---

## 如果背景不是透明的

ChatGPT 有時會給白底。兩個解法：

1. 回它一句：`Redo it with a fully transparent background (alpha channel), not white.`
2. 或存下來後丟到 https://www.remove.bg 去背

---

## 裁圖工具

Mac 內建「預覽程式」就可以：打開圖 → 拖曳選取一隻 → `⌘K` 裁切 → `⌘⇧S` 另存新檔 → 格式選 PNG。
