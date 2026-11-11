# 衛教頁雙工作流原型：圖片生成 prompts

六張素材皆使用內建 image generation 工具。前三張是直接產圖內容區；後三張是模板合成使用的無文字插圖。沒有使用 SVG、CLI 或 API-key fallback。

## 直接產圖：梅尼爾氏症

```text
Use case: scientific-educational
Asset type: square medical education infographic content area, to be placed inside a separate fixed brand frame
Primary request: create a polished Traditional Chinese infographic comparing three common peripheral vertigo conditions
Scene/backdrop: warm off-white paper with subtle teal and peach editorial accents
Style/medium: friendly flat medical editorial illustration, consistent dark teal linework, clean vector-like finish, clinically respectful, polished enough for a clinic presentation and Instagram
Composition/framing: square composition with three equal comparison columns, generous inner padding, all important content kept away from the outer 8 percent
Text (verbatim): "常見眩暈疾病比較", "耳石脫落症", "姿勢誘發", "通常少於一分鐘", "通常無聽力變化", "梅尼爾氏症", "自發發作", "二十分鐘至數小時", "耳鳴與聽力波動", "前庭神經炎", "持續數天", "走路不穩", "通常無聽力變化"
Subject: each column has one clear medical illustration and three concise comparison facts
Constraints: Traditional Chinese only; render the listed text exactly; strong hierarchy; readable large type; no extra medical claims; no logo; no brand name; no publisher; no page number; no footer; no disclaimer; no watermark
Avoid: tiny text, dense paragraphs, 3D rendering, photography, handwritten fonts, outer frame or header bar
```

## 直接產圖：口腔潰瘍

```text
Use case: scientific-educational
Asset type: square medical education infographic content area, to be placed inside a separate fixed brand frame
Primary request: create a polished Traditional Chinese infographic with four practical oral-ulcer self-care tips
Scene/backdrop: warm cream paper with restrained coral, sky blue, lavender, and sage panels
Style/medium: friendly flat medical editorial illustration, consistent dark teal linework, clean vector-like finish, clinically respectful, polished enough for a clinic presentation and Instagram
Composition/framing: square four-quadrant composition, generous inner padding, all important content kept away from the outer 8 percent
Text (verbatim): "口腔潰瘍生活處方箋", "多喝水", "保持口腔濕潤", "避開刺激", "暫停菸酒與辛辣食物", "睡眠放鬆", "規律作息幫助修復", "留意警訊", "超過兩週未癒應就醫"
Subject: water drinking, avoiding cigarettes alcohol and spicy food, restful sleep, and a clear medical follow-up reminder
Constraints: Traditional Chinese only; render the listed text exactly; strong hierarchy; readable large type; no extra medical claims; no logo; no brand name; no publisher; no page number; no footer; no disclaimer; no watermark
Avoid: tiny text, dense paragraphs, 3D rendering, photography, handwritten fonts, outer frame or header bar
```

## 直接產圖：流感公費規則

```text
Use case: scientific-educational
Asset type: square clinical quick-reference infographic content area, to be placed inside a separate fixed brand frame
Primary request: create a polished Traditional Chinese high-density reference infographic grouping chronic conditions relevant to public influenza antiviral eligibility review
Scene/backdrop: clean warm off-white paper with six restrained pastel category panels
Style/medium: crisp medical editorial infographic, consistent dark teal linework and small organ icons, vector-like finish, highly legible and professional
Composition/framing: square six-card grid, three columns by two rows, generous inner padding, all important content kept away from the outer 7 percent
Text (verbatim): "公費流感抗病毒藥物高風險條件", "傳染與免疫", "B20、B18–19、D80–89", "代謝與內分泌", "E08–13、E66、E85", "神經系統", "G20、G30–46、G70–72", "心血管疾病", "I00–09、I34–51、I60–79", "呼吸系統", "J40–45、J47、J60–70、J82–99", "消化、泌尿與其他", "K70–76、N00–27、M05–35、Z90.81", "實際資格仍由醫師依健保規範判定"
Constraints: Traditional Chinese only; render the listed text and codes exactly; strong hierarchy; readable type; no extra codes or claims; no logo; no brand name; no publisher; no page number; no footer; no disclaimer; no watermark
Avoid: illegible tiny type, 3D rendering, photography, handwritten fonts, outer frame or header bar
```

## 模板插圖：梅尼爾氏症

```text
Use case: scientific-educational
Asset type: text-free raster illustration for a square clinic education page template
Primary request: a polished educational illustration of the human inner ear associated with dizziness
Scene/backdrop: warm off-white paper with a very subtle pale teal wash
Subject: one large anatomically recognizable outer ear, semicircular canals and cochlea, with a small tasteful inset of a seated adult experiencing dizziness
Style/medium: friendly flat medical editorial illustration, consistent dark teal linework, soft teal and peach fills, clean vector-like finish
Composition/framing: vertical editorial composition, central subject, generous padding, designed to crop safely inside a rounded rectangular panel
Constraints: no text, no labels, no arrows, no logo, no watermark; clinically respectful; consistent line weight
Avoid: 3D rendering, photography, dramatic illness, busy background, tiny decorative objects
```

## 模板插圖：口腔潰瘍

```text
Use case: scientific-educational
Asset type: text-free raster illustration for a square clinic education page template
Primary request: a polished self-care illustration for oral ulcers
Scene/backdrop: warm cream paper with a very subtle coral wash
Subject: a calm adult drinking water, with a small tasteful oral-cavity inset showing one simple round ulcer, plus understated supporting motifs for sleep and avoiding smoking or spicy food
Style/medium: friendly flat medical editorial illustration, consistent dark teal linework, coral, sky blue, lavender and sage fills, clean vector-like finish
Composition/framing: vertical editorial composition, main person centered, supporting motifs around the lower third, generous padding, designed to crop safely inside a rounded rectangular panel
Constraints: no text, no labels, no logo, no watermark; clinically respectful; consistent line weight
Avoid: 3D rendering, photography, grotesque mouth close-up, busy background, red prohibition text
```

## 模板插圖：流感公費規則

```text
Use case: scientific-educational
Asset type: text-free raster illustration for a square clinical quick-reference page template
Primary request: a polished medical icon constellation representing chronic disease categories
Scene/backdrop: warm off-white paper with a very subtle periwinkle wash
Subject: six clear organ and system symbols arranged as a balanced vertical composition: immune shield, pancreas with glucose meter, brain and neuron, heart and blood vessel, lungs with inhaler, liver with kidneys and knee joint
Style/medium: crisp medical editorial illustration, consistent dark teal linework, restrained pastel fills, clean vector-like finish
Composition/framing: balanced vertical icon atlas with generous spacing and padding, designed to crop safely inside a rounded rectangular panel
Constraints: no text, no numbers, no codes, no labels, no logo, no watermark; clinically respectful; consistent line weight
Avoid: 3D rendering, photography, tiny details, clutter, decorative background objects
```
