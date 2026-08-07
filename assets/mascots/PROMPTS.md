# 吉祥物繪圖 Prompt（貼到 ChatGPT）

畫好之後存成 PNG，放進 `assets/mascots/raw/`，然後跑：

```bash
python3 scripts/prepMascots.py
```

## 千萬不要叫它「背景透明」

第一次就是這樣壞掉的。ChatGPT 去背時，會把**角色身上顏色跟背景像的地方一起挖掉**：

- 嘴巴裡面 → 沒了，變成一個洞
- 臉頰腮紅 → 沒了
- 大腿和白襪的分界 → 沒了，整條腿變成一個洞

那些像素是真的消失，不是被藏起來，事後補不回來。

**正確做法：叫它畫在一塊純色背景上**，選一個角色身上絕對不會出現的顏色（例如亮洋紅 `#FF00FF`）。
`prepMascots.py` 會自己把那個顏色去掉，角色本身一根寒毛都不會動。

**每張圖的共同要求**

- 背景：純色 `#FF00FF`（亮洋紅），**不要透明**
- 正方形，1024×1024
- 角色完整入鏡，四周留一點空白，不要被切到
- 正面站姿，臉朝前

---

## 第 1 張：主角女生（三個表情，一次畫完）

一次畫三個姿勢最重要——同一次生成出來的三張，臉和衣服才會長得一樣。

```
Create a single 1024x1024 PNG on a SOLID FLAT MAGENTA background, hex #FF00FF,
filling the entire canvas edge to edge. Do NOT make the background transparent.
Do not use magenta or pink anywhere on the characters themselves.

The image contains THREE full-body chibi anime characters of the SAME girl side
by side, evenly spaced, all facing the viewer.

Character design (identical in all three):
- Chibi proportions, about 2.5 heads tall, soft rounded body
- Shoulder-length wavy chestnut-brown hair with straight bangs
- Warm light peach skin, clearly visible on the face, arms, hands and thighs
- Large round dark-brown eyes with a single white highlight, tiny nose,
  small smile, soft coral blush on both cheeks
- When the mouth is open it is filled dark rosy red, not left blank
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
No ground shadow, no text, no border, no watermark.
```

**整張存成 `assets/mascots/raw/chibi-girl-poses.png` 就好，不用自己裁。**
`prepMascots.py` 會自動切成三份並命名為 `girl-idle` / `girl-happy` / `girl-sad`。

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
Now draw her <描述新姿勢>. Solid flat magenta background #FF00FF filling the
whole canvas, 1024x1024, full body, facing the viewer. No text, no watermark.
```

---

## 如果它還是給你透明背景

回一句：

```
The background must be solid opaque magenta #FF00FF, not transparent.
Fill every pixel outside the character with that colour.
```

---

## 檢查有沒有畫對

存進 `raw/` 跑完 `python3 scripts/prepMascots.py` 之後，打開 `assets/mascots/girl-happy.png`：

- 嘴巴裡面是深紅色，不是膚色 ✓
- 大腿是膚色、膝下才是白襪 ✓
- 臉頰有腮紅 ✓

三個都對就成功了。
