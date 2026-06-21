const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'images', 'dysautonomia');
const PROC_PATH = path.join(ROOT, 'procedures', 'dysautonomia.json');

const meta = {
  id: 'dysautonomia',
  title: '自律神經失調',
  type: 'explain',
  category: 'functional',
  subtitle: 'HRV 與功能醫學 · 10 步驟',
  slides: 10,
};

const steps = [
  {
    image: 'images/dysautonomia/step1.svg',
    title: '自律神經失調的常見症狀',
    description: '頭痛、頭暈、耳鳴、失眠、睡不好；心悸、胸悶、血壓不穩、胃食道逆流、脹氣、便秘、腹瀉；焦慮、緊張、恐慌、心煩、疲勞、無力、精神差。',
    alt: '自律神經失調的常見症狀，包含腦神經與睡眠、心血管與腸胃、情緒與全身三大面向。',
  },
  {
    image: 'images/dysautonomia/step2.svg',
    title: '什麼是自律神經失調？',
    description: '自律神經負責調節心跳、呼吸、消化、體溫等，維持身體機能平衡。交感神經像油門，副交感神經像煞車；兩者失去平衡時，就可能出現自律神經失調。',
    alt: '說明自律神經、交感神經與副交感神經的差異，以及失衡時的狀態。',
  },
  {
    image: 'images/dysautonomia/step3.svg',
    title: '為什麼會發生？',
    description: '常見原因包含壓力累積、生活作息不良與不良生活習慣。當壓力超過身體負荷，就可能引起自律神經失調。',
    alt: '自律神經失調的常見原因，包括壓力累積、作息不良與不良生活習慣。',
  },
  {
    image: 'images/dysautonomia/step4.svg',
    title: '為什麼檢查都正常？',
    description: '血液檢查、心電圖、影像檢查都可能正常，但仍有頭暈、心悸、胸悶、呼吸不順、腸胃不適、疲倦、失眠、焦慮等不舒服。自律神經失調屬於功能失衡，不一定有器官結構損傷。',
    alt: '血液、心電圖與影像檢查正常，但仍有多種不舒服症狀，提示功能失衡。',
  },
  {
    image: 'images/dysautonomia/step5.svg',
    title: '如何檢測？認識 HRV',
    description: '透過心率變異度檢測，分析心跳間隔變化，評估交感與副交感神經平衡。這是非侵入性檢測，不需抽血，約 5 到 10 分鐘即可完成。',
    alt: '介紹 HRV 檢測，包含心率變異度、非侵入、不需抽血與快速完成。',
  },
  {
    image: 'images/dysautonomia/step6.svg',
    title: 'HRV 指標怎麼看？',
    description: 'SDNN 反映整體自律神經活性；LF 代表交感神經活性；HF 代表副交感神經活性；LF/HF 用來評估壓力平衡，接近 1 通常代表平衡較好。',
    alt: '說明 HRV 的四個常見指標：SDNN、LF、HF、LF/HF。',
  },
  {
    image: 'images/dysautonomia/step7.svg',
    title: 'HRV 結果代表什麼？',
    description: 'HRV 高通常表示身心平衡、調節能力佳、適應力較強；HRV 低則常見於壓力累積、疲勞增加、焦慮或憂鬱風險上升，也可能伴隨心血管風險增加。',
    alt: '比較 HRV 高與低的意義，提示身心平衡與失衡兩種狀態。',
  },
  {
    image: 'images/dysautonomia/step8.svg',
    title: '檢查前要注意什麼？',
    description: '檢查前避免劇烈運動、咖啡、濃茶與酒精，並提前休息 5 到 10 分鐘。檢查時保持安靜、不說話、平穩呼吸、身體放鬆。',
    alt: 'HRV 檢查前與檢查時的注意事項。',
  },
  {
    image: 'images/dysautonomia/step9.svg',
    title: '自律神經失調能恢復嗎？',
    description: '大多數自律神經失調是可逆的。越早發現越容易改善，不代表永久疾病，也不代表器官壞掉。給自己時間，給身體支持，慢慢找回平衡與健康。',
    alt: '說明自律神經失調多數可逆，越早處理越容易改善。',
  },
  {
    image: 'images/dysautonomia/step10.svg',
    title: '如何改善自律神經失調？',
    description: '改善六大原則：規律作息、充足睡眠、規律運動、均衡飲食、減少咖啡因、放鬆訓練（腹式呼吸、冥想）。',
    alt: '改善自律神經失調的六大原則。',
  },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function lines(text, maxLen) {
  if (!text) return [];
  const raw = String(text).split('\n');
  const out = [];
  raw.forEach((line) => {
    if (!maxLen || line.length <= maxLen) {
      out.push(line);
      return;
    }
    let buf = '';
    for (const ch of line) {
      if (buf.length >= maxLen) {
        out.push(buf);
        buf = '';
      }
      buf += ch;
    }
    if (buf) out.push(buf);
  });
  return out;
}

function textBlock({ x, y, size, weight = 700, fill = '#123b69', content, lineGap = 1.35, anchor = 'start' }) {
  const arr = Array.isArray(content) ? content : lines(content);
  const tspans = arr.map((line, i) => {
    const dy = i === 0 ? 0 : size * lineGap;
    return `<tspan x="${x}" dy="${dy}">${esc(line)}</tspan>`;
  }).join('');
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Noto Sans TC, Microsoft JhengHei, PingFang TC, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" dominant-baseline="hanging">${tspans}</text>`;
}

function pill(x, y, w, h, fill, text, textFill = '#fff', size = 28) {
  return `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}"/>
      ${textBlock({ x: x + w / 2, y: y + h / 2 - size * 0.42, size, weight: 700, fill: textFill, content: text, anchor: 'middle' })}
    </g>`;
}

function card(x, y, w, h, fill, stroke = 'rgba(78, 123, 189, 0.18)') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="28" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
}

function circleBadge(cx, cy, r, fill, text, textFill = '#fff', size = 34) {
  return `
    <g>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>
      ${textBlock({ x: cx, y: cy - size * 0.42, size, weight: 800, fill: textFill, content: text, anchor: 'middle' })}
    </g>`;
}

function checkBullet(x, y, size, color, text, textSize = 28, textColor = '#1f2e4d') {
  return `
    <g>
      <circle cx="${x}" cy="${y}" r="${size}" fill="${color}"/>
      <path d="M ${x - size * 0.45} ${y + size * 0.02} L ${x - size * 0.10} ${y + size * 0.34} L ${x + size * 0.52} ${y - size * 0.34}" fill="none" stroke="#fff" stroke-width="${Math.max(4, size * 0.22)}" stroke-linecap="round" stroke-linejoin="round"/>
      ${textBlock({ x: x + size + 24, y: y - textSize * 0.46, size: textSize, weight: 700, fill: textColor, content: text })}
    </g>`;
}

function crossBullet(x, y, size, color, text, textSize = 26, textColor = '#1f2e4d') {
  return `
    <g>
      <circle cx="${x}" cy="${y}" r="${size}" fill="${color}"/>
      <path d="M ${x - size * 0.35} ${y - size * 0.35} L ${x + size * 0.35} ${y + size * 0.35} M ${x + size * 0.35} ${y - size * 0.35} L ${x - size * 0.35} ${y + size * 0.35}" fill="none" stroke="#fff" stroke-width="${Math.max(4, size * 0.22)}" stroke-linecap="round"/>
      ${textBlock({ x: x + size + 24, y: y - textSize * 0.46, size: textSize, weight: 700, fill: textColor, content: text })}
    </g>`;
}

function rowCard(x, y, w, h, fill, number, title, bodyLines, accent, badgeText) {
  const body = lines(bodyLines, 18);
  return `
    ${card(x, y, w, h, fill)}
    ${circleBadge(x + 72, y + 70, 34, accent, number, '#fff', 38)}
    ${textBlock({ x: x + 128, y: y + 40, size: 40, weight: 800, fill: accent, content: title })}
    ${textBlock({ x: x + 128, y: y + 98, size: 28, weight: 600, fill: '#22334f', content: body, lineGap: 1.3 })}
    ${badgeText ? pill(x + w - 170, y + h - 72, 132, 46, 'rgba(255,255,255,0.72)', badgeText, accent, 22) : ''}
  `;
}

function pageShell(titleLines, accent = '#184f85') {
  const title = Array.isArray(titleLines) ? titleLines : [titleLines];
  return `
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f8fbff"/>
        <stop offset="100%" stop-color="#eef6ff"/>
      </linearGradient>
      <linearGradient id="footerWave" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#d8ecff" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#9ec7ef" stop-opacity="0.55"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#8aaad0" flood-opacity="0.18"/>
      </filter>
    </defs>
    <rect width="1200" height="1200" fill="url(#bg)"/>
    <rect x="28" y="28" width="1144" height="1144" rx="36" fill="#fff" stroke="#dbe8f5" stroke-width="2" filter="url(#shadow)"/>
    <path d="M 740 28 H 1172 V 90 H 776 Q 740 90 740 54 Z" fill="#1885cf"/>
    <path d="M 64 1110 C 190 1060, 324 1064, 444 1100 S 676 1142, 820 1110 S 1058 1060, 1136 1088 V 1172 H 64 Z" fill="url(#footerWave)" opacity="0.75"/>
    <path d="M 64 1140 C 204 1104, 358 1106, 500 1136 S 804 1174, 944 1144 S 1088 1108, 1138 1124" fill="none" stroke="#d4e8fb" stroke-width="4" opacity="0.55"/>
    ${pill(768, 36, 378, 52, '#1885cf', '工學誠心診所｜自律神經衛教', '#fff', 22)}
    ${title.map((line, i) => textBlock({ x: 82, y: 80 + i * 94, size: 82, weight: 900, fill: accent, content: line })).join('')}
    <g transform="translate(948 110) rotate(-12)">
      <path d="M 0 0 C 18 -34, 32 -56, 62 -54 C 48 -16, 26 26, -4 44 C -12 26, -8 10, 0 0 Z" fill="#ef8a1f"/>
      <path d="M 42 28 C 72 14, 98 20, 112 46 C 82 72, 44 76, 18 54 C 24 44, 32 36, 42 28 Z" fill="#9fd04b"/>
    </g>
  `;
}

function footerNote(text) {
  return `
    <g>
      <circle cx="74" cy="1126" r="18" fill="#8ec7f3"/>
      <path d="M 66 1124 L 72 1130 L 82 1118" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      ${textBlock({ x: 106, y: 1108, size: 24, weight: 700, fill: '#3a79ad', content: text })}
    </g>`;
}

function smallDot(cx, cy, r, fill) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="0.96"/>`;
}

function renderSlide1() {
  return `
    ${pageShell(['自律神經失調的', '常見症狀'], '#184f85')}
    ${rowCard(70, 315, 1060, 206, '#edf5ff', '1', '腦神經與睡眠', '頭痛、頭暈、耳鳴、失眠、睡不好', '#1180cf', '症狀')}
    ${rowCard(70, 552, 1060, 206, '#eff6ff', '2', '心血管與腸胃', '心悸、胸悶、血壓不穩、胃食道逆流、脹氣、便秘、腹瀉', '#1180cf', '反應')}
    ${rowCard(70, 789, 1060, 206, '#f4f8e9', '3', '情緒與全身', '焦慮、緊張、恐慌、心煩、疲勞、無力、精神差', '#78a91d', '警訊')}
    <g transform="translate(896 352)">
      <circle cx="110" cy="88" r="58" fill="#f0f7ff" stroke="#d7e7f7" stroke-width="3"/>
      <circle cx="220" cy="88" r="58" fill="#f0f7ff" stroke="#d7e7f7" stroke-width="3"/>
      <circle cx="55" cy="204" r="58" fill="#f0f7ff" stroke="#d7e7f7" stroke-width="3"/>
      <circle cx="165" cy="204" r="58" fill="#f0f7ff" stroke="#d7e7f7" stroke-width="3"/>
      <circle cx="275" cy="204" r="58" fill="#f0f7ff" stroke="#d7e7f7" stroke-width="3"/>
      ${circleBadge(110, 88, 24, '#1180cf', '腦', '#fff', 24)}
      ${circleBadge(220, 88, 24, '#5a87bb', '睡', '#fff', 24)}
      ${circleBadge(55, 204, 24, '#5a87bb', '耳', '#fff', 24)}
      ${circleBadge(165, 204, 24, '#1180cf', '心', '#fff', 24)}
      ${circleBadge(275, 204, 24, '#78a91d', '胃', '#fff', 24)}
    </g>
    ${footerNote('工學誠心診所  關心您的身心健康')}
  `;
}

function renderSlide2() {
  return `
    ${pageShell(['什麼是', '自律神經失調？'], '#184f85')}
    ${rowCard(70, 338, 1060, 190, '#f2f7ff', '1', '自律神經是什麼？', '自律神經負責調節心跳、呼吸、消化、體溫等，維持身體機能平衡。', '#1180cf')}
    ${rowCard(70, 562, 1060, 190, '#eef6ff', '2', '交感神經（油門）', '讓身體進入「戰鬥或逃跑」狀態，使心跳加快、血壓上升、精神集中。', '#1180cf', '啟動')}
    ${rowCard(70, 786, 1060, 190, '#f2f6e9', '3', '副交感神經（煞車）', '讓身體進入「休息與修復」狀態，使心跳減慢、放鬆身心、促進恢復。', '#7ba520', '修復')}
    <g transform="translate(764 974)">
      <path d="M 0 52 C 78 24, 176 26, 278 50" fill="none" stroke="#3f4958" stroke-width="8" stroke-linecap="round"/>
      <rect x="92" y="0" width="28" height="56" rx="14" fill="#1180cf"/>
      <rect x="180" y="4" width="28" height="56" rx="14" fill="#7ba520"/>
      ${textBlock({ x: 62, y: 64, size: 24, weight: 700, fill: '#1180cf', content: '交感' })}
      ${textBlock({ x: 148, y: 64, size: 24, weight: 700, fill: '#7ba520', content: '副交感' })}
    </g>
    <g transform="translate(790 172)">
      <circle cx="0" cy="0" r="58" fill="#f7fbff" stroke="#d7e7f7" stroke-width="3"/>
      <circle cx="0" cy="0" r="20" fill="#f4d2b9"/>
      <path d="M -16 -4 C -4 -28, 20 -28, 32 -2" fill="none" stroke="#f4d2b9" stroke-width="10" stroke-linecap="round"/>
      <path d="M -10 28 C 0 14, 18 14, 28 28" fill="none" stroke="#1180cf" stroke-width="8" stroke-linecap="round"/>
    </g>
  `;
}

function renderSlide3() {
  return `
    ${pageShell(['為什麼會發生？'], '#184f85')}
    ${textBlock({ x: 82, y: 222, size: 40, weight: 800, fill: '#1180cf', content: '自律神經失調的常見原因' })}
    ${card(70, 330, 694, 206, '#edf5ff')}
    ${circleBadge(115, 402, 34, '#1180cf', '1', '#fff', 38)}
    ${textBlock({ x: 170, y: 358, size: 40, weight: 800, fill: '#184f85', content: '壓力累積' })}
    ${textBlock({ x: 170, y: 424, size: 26, weight: 600, fill: '#22334f', content: ['長期壓力、工作負荷過大，', '使身心持續緊繃，', '壓力越積越多。'], lineGap: 1.38 })}
    ${card(70, 566, 694, 206, '#eef6ff')}
    ${circleBadge(115, 638, 34, '#1180cf', '2', '#fff', 38)}
    ${textBlock({ x: 170, y: 594, size: 40, weight: 800, fill: '#184f85', content: '生活作息不良' })}
    ${textBlock({ x: 170, y: 660, size: 26, weight: 600, fill: '#22334f', content: ['熬夜與睡眠不足、', '作息不規律，', '打亂生理時鐘。'], lineGap: 1.38 })}
    ${card(70, 802, 694, 206, '#f4f8e9')}
    ${circleBadge(115, 874, 34, '#78a91d', '3', '#fff', 38)}
    ${textBlock({ x: 170, y: 830, size: 40, weight: 800, fill: '#4d8f12', content: '不良生活習慣' })}
    ${textBlock({ x: 170, y: 896, size: 26, weight: 600, fill: '#22334f', content: ['飲食失衡、缺乏運動，', '影響身體機能平衡，', '增加失調風險。'], lineGap: 1.38 })}
    <g transform="translate(800 292)">
      <path d="M 150 86 C 150 24, 262 18, 262 118 C 262 195, 202 234, 150 252 C 98 234, 38 195, 38 118 C 38 18, 150 24, 150 86 Z" fill="#f7fbff" stroke="#d7e7f7" stroke-width="4"/>
      <path d="M 80 150 C 112 184, 188 184, 220 150" fill="none" stroke="#1180cf" stroke-width="8" stroke-linecap="round"/>
      <circle cx="150" cy="86" r="58" fill="#dfefff" opacity="0.7"/>
      ${smallDot(148, 48, 10, '#8ec7f3')}
      ${smallDot(178, 72, 10, '#8ec7f3')}
      ${smallDot(126, 112, 10, '#8ec7f3')}
      <path d="M 166 72 L 206 72 L 182 116 L 216 116 L 140 206 L 166 138 L 130 138 Z" fill="#ef8a1f"/>
      <path d="M 106 188 C 128 158, 176 160, 194 194" fill="none" stroke="#1180cf" stroke-width="6" stroke-linecap="round"/>
      <path d="M 118 196 C 126 212, 156 220, 176 212" fill="none" stroke="#78a91d" stroke-width="6" stroke-linecap="round"/>
      ${textBlock({ x: 92, y: 272, size: 24, weight: 700, fill: '#a0aab8', content: '壓力累積 / 作息 / 習慣' })}
    </g>
    <g transform="translate(790 618)">
      <rect x="0" y="0" width="318" height="266" rx="34" fill="#f7fbff" stroke="#d7e7f7" stroke-width="3"/>
      <rect x="96" y="36" width="126" height="168" rx="12" fill="#f3efe8" stroke="#c8d7ea" stroke-width="3"/>
      <rect x="118" y="58" width="84" height="32" rx="16" fill="#b7d4f3"/>
      <path d="M 150 90 C 150 126, 150 154, 150 190" stroke="#b77a4d" stroke-width="6" stroke-linecap="round"/>
      <path d="M 58 48 C 72 20, 112 10, 128 32" fill="none" stroke="#dbe5f5" stroke-width="6" stroke-linecap="round"/>
      <path d="M 258 20 C 244 44, 250 72, 282 84" fill="none" stroke="#dbe5f5" stroke-width="6" stroke-linecap="round"/>
    </g>
    ${textBlock({ x: 800, y: 924, size: 24, weight: 700, fill: '#1f2e4d', content: '當壓力超過身體負荷，就可能引起自律神經失調。' })}
    ${footerNote('工學誠心診所  關心您的身心健康')}
  `;
}

function renderSlide4() {
  return `
    ${pageShell(['為什麼檢查都正常？'], '#184f85')}
    ${rowCard(70, 256, 1060, 150, '#eef6ff', '1', '血液檢查正常', '無發炎、貧血、甲狀腺異常等。', '#1180cf')}
    ${rowCard(70, 430, 1060, 150, '#eef6ff', '2', '心電圖正常', '心臟節律與電氣活動正常。', '#1180cf')}
    ${rowCard(70, 604, 1060, 150, '#eef6ff', '3', '影像檢查正常', 'X 光、超音波、電腦斷層等無異常。', '#1180cf')}
    ${rowCard(70, 778, 1060, 174, '#f4f8e9', '4', '卻仍有許多不舒服症狀', '頭暈、心悸、胸悶、呼吸不順、腸胃不適、疲倦、失眠、焦慮等。', '#78a91d')}
    <g transform="translate(832 848)">
      <circle cx="42" cy="42" r="32" fill="#f7fbff" stroke="#d7e7f7" stroke-width="3"/>
      <path d="M 42 24 v 18 l 14 8" fill="none" stroke="#1180cf" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="172" cy="42" r="32" fill="#f7fbff" stroke="#d7e7f7" stroke-width="3"/>
      <path d="M 154 42 h 36 M 172 24 v 36" fill="none" stroke="#78a91d" stroke-width="6" stroke-linecap="round"/>
      <circle cx="300" cy="42" r="32" fill="#f7fbff" stroke="#d7e7f7" stroke-width="3"/>
      <path d="M 286 28 L 314 56" stroke="#ef8a1f" stroke-width="6" stroke-linecap="round"/>
      <path d="M 314 28 L 286 56" stroke="#ef8a1f" stroke-width="6" stroke-linecap="round"/>
    </g>
    <g transform="translate(780 224)">
      <path d="M 220 0 C 285 18, 334 74, 334 148 C 334 252, 246 330, 144 330 C 74 330, 14 292, 0 234 C 56 222, 88 186, 88 132 C 88 60, 148 10, 220 0 Z" fill="#f7fbff" stroke="#d7e7f7" stroke-width="3" opacity="0.55"/>
      <path d="M 120 92 C 132 74, 148 66, 164 66 C 182 66, 198 76, 208 92 C 218 76, 234 66, 252 66 C 268 66, 284 74, 296 92 C 296 124, 232 164, 208 184 C 184 164, 120 124, 120 92 Z" fill="#ef8a1f" opacity="0.12"/>
      <path d="M 112 196 C 136 162, 174 142, 208 142 C 242 142, 280 162, 304 196 C 286 224, 256 242, 208 242 C 160 242, 130 224, 112 196 Z" fill="#b7d4f3" stroke="#7eaedc" stroke-width="4"/>
      <path d="M 76 206 C 72 138, 98 76, 146 46" fill="none" stroke="#8eaac6" stroke-width="6" stroke-linecap="round"/>
      <path d="M 340 206 C 344 138, 318 76, 270 46" fill="none" stroke="#8eaac6" stroke-width="6" stroke-linecap="round"/>
      ${textBlock({ x: 60, y: 8, size: 28, weight: 800, fill: '#184f85', content: '檢查結果都正常' })}
    </g>
    ${textBlock({ x: 92, y: 980, size: 30, weight: 800, fill: '#ef8a1f', content: '自律神經失調屬於功能失衡，不一定有器官結構損傷。' })}
    ${footerNote('工學誠心診所  關心您的身心健康')}
  `;
}

function renderSlide5() {
  return `
    ${pageShell(['如何檢測？', '認識 HRV'], '#184f85')}
    ${rowCard(70, 314, 1060, 170, '#eef6ff', '1', '心率變異度檢測', '透過分析心跳間隔變化，評估交感與副交感神經平衡。', '#1180cf')}
    ${rowCard(70, 510, 1060, 170, '#eef6ff', '2', '非侵入性', '透過感測器接觸皮膚進行檢測，安全舒適、無痛無創。', '#1180cf')}
    ${rowCard(70, 706, 1060, 170, '#eef6ff', '3', '不需抽血', '無需採血，不造成身體負擔，適合各年齡層定期檢測。', '#1180cf')}
    ${rowCard(70, 902, 1060, 170, '#eef6ff', '4', '約 5～10 分鐘完成', '檢測快速簡便，過程放鬆，輕鬆掌握自律神經健康狀態。', '#1180cf')}
    <g transform="translate(792 92)">
      <path d="M 0 110 H 290" stroke="#8ec7f3" stroke-width="6" stroke-linecap="round"/>
      <path d="M 0 110 L 20 72 L 36 148 L 52 102 L 66 110 L 90 62 L 104 110 L 140 52 L 154 110 L 172 92 L 188 110 L 220 80 L 242 110 L 290 110" fill="none" stroke="#5ba0da" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="122" cy="110" r="56" fill="#fff" stroke="#ef8a1f" stroke-width="6"/>
      <path d="M 122 78 v 34 l 26 14" fill="none" stroke="#ef8a1f" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="122" cy="110" r="24" fill="none" stroke="#ef8a1f" stroke-width="5" opacity="0.3"/>
    </g>
    <g transform="translate(845 346)">
      <rect x="0" y="0" width="262" height="110" rx="18" fill="#fff" stroke="#7eaedc" stroke-width="4"/>
      <path d="M 18 66 C 30 46, 44 46, 58 66 S 86 86, 98 66 S 118 46, 132 66 S 160 86, 172 66 S 198 46, 214 66 S 242 86, 244 66" fill="none" stroke="#78a91d" stroke-width="4"/>
      ${textBlock({ x: 22, y: 14, size: 26, weight: 800, fill: '#184f85', content: 'HRV' })}
    </g>
    <g transform="translate(850 542)">
      <circle cx="112" cy="58" r="42" fill="#f7fbff" stroke="#7eaedc" stroke-width="3"/>
      <rect x="94" y="48" width="36" height="22" rx="8" fill="#d7e7f7" stroke="#7eaedc" stroke-width="2"/>
      <path d="M 112 70 V 112" stroke="#7eaedc" stroke-width="4" stroke-linecap="round"/>
    </g>
    <g transform="translate(850 734)">
      <circle cx="112" cy="58" r="42" fill="#f7fbff" stroke="#7eaedc" stroke-width="3"/>
      <path d="M 94 42 L 130 74" stroke="#ef8a1f" stroke-width="6" stroke-linecap="round"/>
      <path d="M 130 42 L 94 74" stroke="#ef8a1f" stroke-width="6" stroke-linecap="round"/>
    </g>
    <g transform="translate(850 936)">
      <circle cx="112" cy="58" r="42" fill="#f7fbff" stroke="#7eaedc" stroke-width="3"/>
      <path d="M 112 28 v 34" stroke="#184f85" stroke-width="6" stroke-linecap="round"/>
      <path d="M 112 62 l 18 12" stroke="#184f85" stroke-width="6" stroke-linecap="round"/>
    </g>
    ${footerNote('工學誠心診所  關心您的身心健康')}
  `;
}

function renderSlide6() {
  return `
    ${pageShell(['HRV 指標怎麼看？'], '#184f85')}
    ${card(68, 276, 506, 390, '#f2f7ff')}
    ${card(626, 276, 506, 390, '#fff7ee')}
    ${card(68, 708, 506, 390, '#f4f8e9')}
    ${card(626, 708, 506, 390, '#fff7ee')}
    ${circleBadge(116, 340, 34, '#1180cf', '1', '#fff', 38)}
    ${textBlock({ x: 170, y: 304, size: 54, weight: 900, fill: '#1180cf', content: 'SDNN：' })}
    ${textBlock({ x: 170, y: 370, size: 34, weight: 800, fill: '#184f85', content: '整體自律神經活性' })}
    <circle cx="320" cy="504" r="102" fill="#1180cf" opacity="0.96"/>
    <path d="M 260 506 h 36 l 16 -26 l 16 52 l 16 -20 h 56" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 232 504 C 232 424, 296 360, 376 360" fill="none" stroke="#a9d2f5" stroke-width="4" stroke-dasharray="6 9"/>
    <path d="M 408 504 C 408 424, 344 360, 264 360" fill="none" stroke="#a9d2f5" stroke-width="4" stroke-dasharray="6 9"/>
    ${textBlock({ x: 160, y: 638, size: 24, weight: 600, fill: '#22334f', content: '反映整體心律變異程度，數值越高，身體適應力越好。', lineGap: 1.2 })}

    ${circleBadge(674, 340, 34, '#ef8a1f', '2', '#fff', 38)}
    ${textBlock({ x: 728, y: 304, size: 54, weight: 900, fill: '#ef8a1f', content: 'LF：' })}
    ${textBlock({ x: 728, y: 370, size: 34, weight: 800, fill: '#ef8a1f', content: '交感神經活性' })}
    <path d="M 812 542 L 866 410 L 834 410 L 898 300 L 872 430 L 906 430 Z" fill="#ef8a1f"/>
    ${textBlock({ x: 718, y: 638, size: 24, weight: 600, fill: '#22334f', content: '代表壓力、警覺與活躍狀態，數值偏高可能壓力過大。', lineGap: 1.2 })}

    ${circleBadge(116, 772, 34, '#78a91d', '3', '#fff', 38)}
    ${textBlock({ x: 170, y: 736, size: 54, weight: 900, fill: '#78a91d', content: 'HF：' })}
    ${textBlock({ x: 170, y: 802, size: 34, weight: 800, fill: '#4d8f12', content: '副交感神經活性' })}
    <g transform="translate(250 878)">
      <path d="M 0 46 C 22 18, 56 4, 92 10 C 66 30, 40 64, 32 106 C 12 84, 0 66, 0 46 Z" fill="#78a91d"/>
      <path d="M 104 10 C 140 4, 174 18, 196 46 C 196 66, 184 84, 164 106 C 156 64, 130 30, 104 10 Z" fill="#5ca72f"/>
      <path d="M 114 90 C 130 96, 150 96, 172 88" fill="none" stroke="#d2e8b8" stroke-width="8" stroke-linecap="round"/>
    </g>
    ${textBlock({ x: 160, y: 1066, size: 24, weight: 600, fill: '#22334f', content: '代表放鬆、修復與休息狀態，數值越高，越有助於身心恢復。', lineGap: 1.2 })}

    ${circleBadge(674, 772, 34, '#ef8a1f', '4', '#fff', 38)}
    ${textBlock({ x: 728, y: 736, size: 54, weight: 900, fill: '#ef8a1f', content: 'LF/HF：' })}
    ${textBlock({ x: 728, y: 802, size: 34, weight: 800, fill: '#ef8a1f', content: '壓力平衡指數' })}
    <g transform="translate(760 874)">
      <path d="M 42 64 H 308" stroke="#184f85" stroke-width="10" stroke-linecap="round"/>
      <path d="M 174 12 v 134" stroke="#184f85" stroke-width="10" stroke-linecap="round"/>
      <circle cx="174" cy="44" r="14" fill="#184f85"/>
      <path d="M 38 64 C 58 52, 88 36, 114 26" fill="none" stroke="#184f85" stroke-width="8" stroke-linecap="round"/>
      <path d="M 236 64 C 260 52, 284 36, 302 26" fill="none" stroke="#184f85" stroke-width="8" stroke-linecap="round"/>
      <path d="M 18 66 L 38 66 L 48 32 L 78 88 L 112 34 L 128 66 L 154 66" fill="none" stroke="#ef8a1f" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 192 66 L 220 66 L 232 30 L 258 80 L 292 32 L 314 66 L 344 66" fill="none" stroke="#78a91d" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    ${textBlock({ x: 718, y: 1070, size: 24, weight: 600, fill: '#22334f', content: '評估交感與副交感的平衡狀態，接近 1 代表身心平衡良好。', lineGap: 1.2 })}
    ${footerNote('工學誠心診所  關心您的身心健康')}
  `;
}

function renderSlide7() {
  return `
    ${pageShell(['HRV 結果代表什麼？'], '#184f85')}
    <rect x="68" y="246" width="510" height="734" rx="30" fill="#f4f8e9" stroke="#bfd98b" stroke-width="2"/>
    <rect x="622" y="246" width="510" height="734" rx="30" fill="#fff2e4" stroke="#f2c596" stroke-width="2"/>
    <rect x="118" y="274" width="410" height="64" rx="20" fill="#78a91d"/>
    ${textBlock({ x: 323, y: 288, size: 44, weight: 900, fill: '#fff', content: 'HRV 高', anchor: 'middle' })}
    ${textBlock({ x: 323, y: 372, size: 38, weight: 800, fill: '#4d8f12', content: '身心平衡，狀態佳！', anchor: 'middle' })}
    <g transform="translate(132 448)">
      <circle cx="128" cy="106" r="88" fill="#eaf5d9"/>
      <path d="M 48 138 C 78 126, 106 126, 128 138 C 150 126, 178 126, 208 138" fill="none" stroke="#78a91d" stroke-width="6" stroke-linecap="round"/>
      <circle cx="64" cy="112" r="44" fill="#fff" stroke="#78a91d" stroke-width="4"/>
      <path d="M 52 112 h 24 l 10 -18 l 10 36 l 10 -18 h 24" fill="none" stroke="#78a91d" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 182 82 L 182 172 M 154 140 H 210" stroke="#78a91d" stroke-width="6" stroke-linecap="round"/>
      <path d="M 176 98 L 188 98 L 188 152 L 176 152 Z" fill="#78a91d"/>
    </g>
    ${checkBullet(138, 792, 14, '#78a91d', '調節能力佳')}
    ${checkBullet(138, 866, 14, '#78a91d', '適應力較強')}
    ${checkBullet(138, 940, 14, '#78a91d', '身心狀態較健康')}

    <rect x="672" y="274" width="410" height="64" rx="20" fill="#ef8a1f"/>
    ${textBlock({ x: 877, y: 288, size: 44, weight: 900, fill: '#fff', content: 'HRV 低', anchor: 'middle' })}
    ${textBlock({ x: 877, y: 372, size: 38, weight: 800, fill: '#ef8a1f', content: '身心失衡，需多關注！', anchor: 'middle' })}
    <g transform="translate(796 428)">
      <circle cx="120" cy="112" r="84" fill="#ffe8d6"/>
      <path d="M 54 70 C 76 44, 118 36, 142 58 C 162 76, 166 116, 146 132 C 132 144, 104 150, 88 140 C 72 130, 58 112, 54 70 Z" fill="#184f85" opacity="0.9"/>
      <path d="M 50 42 C 70 22, 100 18, 122 34" fill="none" stroke="#9a9a9a" stroke-width="6" stroke-linecap="round"/>
      <path d="M 16 96 L 40 110 L 16 126" fill="none" stroke="#ef8a1f" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="214" y="70" width="52" height="112" rx="10" fill="#ffffff" stroke="#9ba9bd" stroke-width="4"/>
      <rect x="226" y="136" width="28" height="20" rx="4" fill="#ef8a1f"/>
      <path d="M 232 52 C 246 36, 274 34, 286 50 C 296 62, 292 82, 276 92 C 262 100, 240 102, 228 90 C 216 80, 218 62, 232 52 Z" fill="#9ba9bd" opacity="0.95"/>
    </g>
    ${crossBullet(698, 792, 14, '#ef8a1f', '壓力累積', 28)}
    ${crossBullet(698, 866, 14, '#ef8a1f', '疲勞增加', 28)}
    ${crossBullet(698, 940, 14, '#ef8a1f', '焦慮或憂鬱風險上升', 28)}
    ${crossBullet(698, 1014, 14, '#ef8a1f', '心血管風險可能增加', 28)}
    <rect x="70" y="1040" width="1060" height="104" rx="26" fill="#fff3df" stroke="#f4d39c" stroke-width="2"/>
    ${textBlock({ x: 110, y: 1068, size: 28, weight: 800, fill: '#184f85', content: '給自己時間，給身體支持，您一定可以慢慢找回平衡與健康！' })}
    <g transform="translate(888 1052)">
      <circle cx="120" cy="34" r="26" fill="#ff9d9a"/>
      <path d="M 104 30 C 112 18, 128 18, 136 30 C 144 42, 132 54, 120 64 C 108 54, 96 42, 104 30 Z" fill="#fff" opacity="0.4"/>
      <path d="M 160 68 C 180 72, 194 88, 194 108 C 194 138, 172 160, 142 160 C 128 160, 110 152, 100 140" fill="none" stroke="#9fd04b" stroke-width="6" stroke-linecap="round"/>
      <path d="M 100 140 L 86 130" stroke="#9fd04b" stroke-width="6" stroke-linecap="round"/>
      <path d="M 100 140 L 102 162" stroke="#9fd04b" stroke-width="6" stroke-linecap="round"/>
    </g>
    ${footerNote('工學誠心診所  關心您的身心健康')}
  `;
}

function renderSlide8() {
  return `
    ${pageShell(['檢查前要注意什麼？'], '#184f85')}
    <rect x="70" y="222" width="1060" height="508" rx="30" fill="#eef6ff" stroke="#d7e7f7" stroke-width="2"/>
    <rect x="70" y="762" width="1060" height="316" rx="30" fill="#f4f8e9" stroke="#dceab6" stroke-width="2"/>
    ${circleBadge(128, 314, 36, '#1180cf', '1', '#fff', 40)}
    ${textBlock({ x: 184, y: 278, size: 46, weight: 900, fill: '#1180cf', content: '檢查前' })}
    ${checkBullet(132, 440, 12, '#1180cf', '避免劇烈運動')}
    ${checkBullet(132, 512, 12, '#1180cf', '避免咖啡')}
    ${checkBullet(132, 584, 12, '#1180cf', '避免濃茶')}
    ${checkBullet(132, 656, 12, '#1180cf', '避免酒精')}
    ${checkBullet(132, 728, 12, '#1180cf', '提前休息 5～10 分鐘')}
    <g transform="translate(700 286)">
      <circle cx="84" cy="40" r="34" fill="#fff" stroke="#d7e7f7" stroke-width="3"/>
      <path d="M 84 20 v 20 l 14 8" fill="none" stroke="#ef8a1f" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="244" cy="40" r="34" fill="#fff" stroke="#d7e7f7" stroke-width="3"/>
      <path d="M 224 30 h 40" stroke="#ef8a1f" stroke-width="6" stroke-linecap="round"/>
      <path d="M 224 50 h 40" stroke="#ef8a1f" stroke-width="6" stroke-linecap="round"/>
      <circle cx="84" cy="156" r="34" fill="#fff" stroke="#d7e7f7" stroke-width="3"/>
      <path d="M 60 166 L 108 146" stroke="#ef8a1f" stroke-width="6" stroke-linecap="round"/>
      <path d="M 108 166 L 60 146" stroke="#ef8a1f" stroke-width="6" stroke-linecap="round"/>
      <circle cx="244" cy="156" r="34" fill="#fff" stroke="#d7e7f7" stroke-width="3"/>
      <path d="M 228 140 L 260 172" stroke="#ef8a1f" stroke-width="6" stroke-linecap="round"/>
      <path d="M 260 140 L 228 172" stroke="#ef8a1f" stroke-width="6" stroke-linecap="round"/>
      <circle cx="164" cy="232" r="38" fill="#fff" stroke="#d7e7f7" stroke-width="3"/>
      <path d="M 164 208 v 28" stroke="#184f85" stroke-width="6" stroke-linecap="round"/>
      <path d="M 164 236 l 14 10" stroke="#184f85" stroke-width="6" stroke-linecap="round"/>
      <path d="M 148 246 h 32" stroke="#184f85" stroke-width="6" stroke-linecap="round"/>
    </g>
    ${circleBadge(128, 854, 36, '#78a91d', '2', '#fff', 40)}
    ${textBlock({ x: 184, y: 818, size: 46, weight: 900, fill: '#78a91d', content: '檢查時' })}
    ${checkBullet(132, 956, 12, '#78a91d', '保持安靜')}
    ${checkBullet(132, 1028, 12, '#78a91d', '不說話')}
    ${checkBullet(470, 956, 12, '#78a91d', '平穩呼吸')}
    ${checkBullet(470, 1028, 12, '#78a91d', '身體放鬆')}
    <g transform="translate(720 840)">
      <circle cx="82" cy="48" r="42" fill="#fff" stroke="#d7e7f7" stroke-width="3"/>
      <path d="M 64 48 C 68 36, 84 34, 90 46 C 94 54, 90 64, 82 68 C 74 64, 62 58, 64 48 Z" fill="#184f85" opacity="0.9"/>
      <circle cx="250" cy="48" r="42" fill="#fff" stroke="#d7e7f7" stroke-width="3"/>
      <path d="M 232 42 h 36" stroke="#184f85" stroke-width="6" stroke-linecap="round"/>
      <circle cx="82" cy="158" r="42" fill="#fff" stroke="#d7e7f7" stroke-width="3"/>
      <path d="M 70 146 C 76 136, 88 136, 94 146 C 100 156, 96 168, 82 172 C 68 168, 64 156, 70 146 Z" fill="#184f85" opacity="0.9"/>
      <circle cx="250" cy="158" r="42" fill="#fff" stroke="#d7e7f7" stroke-width="3"/>
      <path d="M 238 140 C 246 132, 258 132, 266 140 C 274 148, 274 162, 266 170 C 258 178, 246 178, 238 170 C 230 162, 230 148, 238 140 Z" fill="#184f85" opacity="0.9"/>
      <path d="M 52 182 C 86 182, 104 176, 118 164" fill="none" stroke="#8ec7f3" stroke-width="4" stroke-linecap="round"/>
    </g>
    ${footerNote('工學誠心診所  關心您的身心健康')}
  `;
}

function renderSlide9() {
  return `
    ${pageShell(['自律神經失調能恢復嗎？'], '#184f85')}
    <rect x="70" y="240" width="1060" height="346" rx="34" fill="#fff7de" stroke="#f4d39c" stroke-width="2"/>
    ${textBlock({ x: 120, y: 282, size: 74, weight: 900, fill: '#1180cf', content: '大多數' })}
    ${textBlock({ x: 120, y: 380, size: 66, weight: 900, fill: '#184f85', content: '自律神經失調' })}
    ${textBlock({ x: 120, y: 476, size: 70, weight: 900, fill: '#ef8a1f', content: '是可逆的' })}
    <g transform="translate(720 250)">
      <circle cx="140" cy="92" r="112" fill="#f4f8e9"/>
      <path d="M 80 138 C 98 108, 126 90, 158 90 C 190 90, 220 108, 238 138" fill="none" stroke="#9fd04b" stroke-width="8" stroke-linecap="round"/>
      <path d="M 126 174 C 138 146, 158 138, 184 146" fill="none" stroke="#78a91d" stroke-width="7" stroke-linecap="round"/>
      <circle cx="138" cy="88" r="36" fill="#fff" stroke="#78a91d" stroke-width="5"/>
      <path d="M 124 88 C 130 78, 146 78, 152 88 C 158 98, 150 108, 138 116 C 126 108, 118 98, 124 88 Z" fill="#78a91d"/>
      <path d="M 236 52 C 264 24, 318 28, 336 66 C 344 82, 344 104, 338 122 C 312 110, 286 98, 260 94 C 250 74, 246 60, 236 52 Z" fill="#ffe289"/>
      <path d="M 250 24 L 274 0" stroke="#f4c12e" stroke-width="8" stroke-linecap="round"/>
      <path d="M 284 34 L 314 20" stroke="#f4c12e" stroke-width="8" stroke-linecap="round"/>
    </g>
    <rect x="70" y="624" width="326" height="290" rx="30" fill="#eef6ff" stroke="#d7e7f7" stroke-width="2"/>
    <rect x="437" y="624" width="326" height="290" rx="30" fill="#f4f8e9" stroke="#dceab6" stroke-width="2"/>
    <rect x="804" y="624" width="326" height="290" rx="30" fill="#fff2e4" stroke="#f2c596" stroke-width="2"/>
    ${circleBadge(120, 688, 30, '#1180cf', '✓', '#fff', 34)}
    ${textBlock({ x: 176, y: 660, size: 32, weight: 900, fill: '#1180cf', content: '越早發現' })}
    ${textBlock({ x: 176, y: 714, size: 26, weight: 700, fill: '#22334f', content: '越容易改善' })}
    <path d="M 118 842 C 132 818, 150 796, 176 780 L 176 744" fill="none" stroke="#8ec7f3" stroke-width="8" stroke-linecap="round"/>
    <rect x="164" y="802" width="20" height="96" fill="#8ec7f3"/>
    <rect x="194" y="768" width="20" height="130" fill="#8ec7f3"/>
    <rect x="224" y="734" width="20" height="164" fill="#8ec7f3"/>
    <rect x="254" y="700" width="20" height="198" fill="#8ec7f3"/>

    ${circleBadge(487, 688, 30, '#78a91d', '✓', '#fff', 34)}
    ${textBlock({ x: 543, y: 660, size: 32, weight: 900, fill: '#78a91d', content: '不代表' })}
    ${textBlock({ x: 543, y: 714, size: 26, weight: 700, fill: '#22334f', content: '永久疾病' })}
    <g transform="translate(530 792)">
      <circle cx="70" cy="48" r="38" fill="none" stroke="#9fd04b" stroke-width="10"/>
      <circle cx="126" cy="48" r="38" fill="none" stroke="#9fd04b" stroke-width="10"/>
    </g>

    ${circleBadge(854, 688, 30, '#ef8a1f', '✓', '#fff', 34)}
    ${textBlock({ x: 910, y: 660, size: 32, weight: 900, fill: '#ef8a1f', content: '不代表' })}
    ${textBlock({ x: 910, y: 714, size: 26, weight: 700, fill: '#22334f', content: '器官壞掉' })}
    <g transform="translate(910 776)">
      <path d="M 38 104 C 24 92, 20 74, 24 58 C 30 34, 52 20, 78 20 C 102 20, 124 32, 132 54 C 148 52, 164 58, 174 72 C 186 88, 184 110, 172 126 C 158 144, 136 152, 114 148" fill="#fff" stroke="#7eaedc" stroke-width="6"/>
      <path d="M 86 58 C 98 44, 122 44, 132 58 C 140 70, 136 88, 122 96 C 108 88, 78 82, 86 58 Z" fill="#ff9ca4"/>
    </g>
    <rect x="70" y="962" width="1060" height="110" rx="26" fill="#fff3df" stroke="#f4d39c" stroke-width="2"/>
    ${textBlock({ x: 112, y: 994, size: 28, weight: 800, fill: '#184f85', content: '給自己時間，給身體支持，您一定可以慢慢找回平衡與健康！' })}
    ${footerNote('工學誠心診所  關心您的身心健康')}
  `;
}

function renderSlide10() {
  return `
    ${pageShell(['如何改善', '自律神經失調？'], '#184f85')}
    ${pill(388, 262, 424, 60, '#eef6ff', '改善六大原則', '#1180cf', 34)}
    <rect x="70" y="354" width="330" height="238" rx="28" fill="#f4f8ff" stroke="#d7e7f7" stroke-width="2"/>
    <rect x="435" y="354" width="330" height="238" rx="28" fill="#f4f8ff" stroke="#d7e7f7" stroke-width="2"/>
    <rect x="800" y="354" width="330" height="238" rx="28" fill="#f4f8ff" stroke="#d7e7f7" stroke-width="2"/>
    <rect x="70" y="656" width="330" height="238" rx="28" fill="#f4f8ff" stroke="#d7e7f7" stroke-width="2"/>
    <rect x="435" y="656" width="330" height="238" rx="28" fill="#f4f8ff" stroke="#d7e7f7" stroke-width="2"/>
    <rect x="800" y="656" width="330" height="238" rx="28" fill="#f4f8ff" stroke="#d7e7f7" stroke-width="2"/>
    <rect x="70" y="958" width="1060" height="142" rx="30" fill="#fff3df" stroke="#f4d39c" stroke-width="2"/>
    ${circleBadge(126, 410, 30, '#1180cf', '1', '#fff', 34)}
    ${textBlock({ x: 184, y: 386, size: 40, weight: 900, fill: '#184f85', content: '規律作息' })}
    <circle cx="200" cy="512" r="64" fill="#eaf5ff" stroke="#8ec7f3" stroke-width="4"/>
    <path d="M 200 474 v 38 l 24 14" fill="none" stroke="#184f85" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 246 500 C 260 478, 278 472, 296 478" fill="none" stroke="#9fd04b" stroke-width="6" stroke-linecap="round"/>
    ${circleBadge(491, 410, 30, '#1180cf', '2', '#fff', 34)}
    ${textBlock({ x: 549, y: 386, size: 40, weight: 900, fill: '#184f85', content: '充足睡眠' })}
    <rect x="540" y="470" width="150" height="84" rx="24" fill="#184f85"/>
    <path d="M 560 504 C 580 474, 622 474, 642 504 C 614 524, 592 530, 560 504 Z" fill="#dfefff"/>
    <path d="M 652 466 C 664 452, 680 448, 692 454" fill="none" stroke="#f4c12e" stroke-width="6" stroke-linecap="round"/>
    ${circleBadge(856, 410, 30, '#1180cf', '3', '#fff', 34)}
    ${textBlock({ x: 914, y: 386, size: 40, weight: 900, fill: '#184f85', content: '規律運動' })}
    <circle cx="978" cy="514" r="48" fill="#dff1ff"/>
    <path d="M 960 530 L 972 496 L 988 532 L 1004 482" fill="none" stroke="#1180cf" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 914 518 C 932 490, 948 478, 966 474" fill="none" stroke="#9fd04b" stroke-width="6" stroke-linecap="round"/>
    ${circleBadge(126, 712, 30, '#1180cf', '4', '#fff', 34)}
    ${textBlock({ x: 184, y: 688, size: 40, weight: 900, fill: '#184f85', content: '均衡飲食' })}
    <circle cx="202" cy="814" r="68" fill="#fff" stroke="#d7e7f7" stroke-width="4"/>
    <path d="M 150 810 h 104" stroke="#f4c12e" stroke-width="8" stroke-linecap="round"/>
    <path d="M 174 782 C 188 772, 210 772, 220 784" fill="none" stroke="#78a91d" stroke-width="8" stroke-linecap="round"/>
    <circle cx="210" cy="814" r="24" fill="#ef8a1f"/>
    ${circleBadge(491, 712, 30, '#1180cf', '5', '#fff', 34)}
    ${textBlock({ x: 549, y: 688, size: 40, weight: 900, fill: '#184f85', content: '減少咖啡因' })}
    <circle cx="600" cy="812" r="60" fill="#fff" stroke="#ef8a1f" stroke-width="6"/>
    <path d="M 572 810 h 56" stroke="#ef8a1f" stroke-width="6" stroke-linecap="round"/>
    <path d="M 570 770 L 630 850" stroke="#ef8a1f" stroke-width="6" stroke-linecap="round"/>
    <path d="M 592 774 C 602 756, 624 754, 636 770" fill="none" stroke="#8ec7f3" stroke-width="6" stroke-linecap="round"/>
    ${circleBadge(856, 712, 30, '#1180cf', '6', '#fff', 34)}
    ${textBlock({ x: 914, y: 688, size: 40, weight: 900, fill: '#184f85', content: '放鬆訓練' })}
    ${textBlock({ x: 914, y: 744, size: 22, weight: 700, fill: '#184f85', content: '（腹式呼吸、冥想）' })}
    <circle cx="974" cy="810" r="62" fill="#eaf5d9"/>
    <path d="M 948 812 C 960 778, 988 778, 1000 812 C 986 824, 962 830, 948 812 Z" fill="#78a91d"/>
    <path d="M 946 818 C 956 836, 968 846, 986 852" fill="none" stroke="#78a91d" stroke-width="6" stroke-linecap="round"/>
    ${textBlock({ x: 112, y: 990, size: 28, weight: 800, fill: '#184f85', content: '規律作息、睡眠、運動、飲食、減少刺激、放鬆訓練，都是把神經系統拉回平衡的基本功。' })}
    ${footerNote('工學誠心診所  關心您的身心健康')}
  `;
}

function renderThumb() {
  return `
    ${pageShell(['自律神經失調', 'HRV 衛教圖集'], '#184f85')}
    <rect x="70" y="286" width="1060" height="610" rx="34" fill="#f4f8ff" stroke="#d7e7f7" stroke-width="2"/>
    ${textBlock({ x: 118, y: 338, size: 42, weight: 900, fill: '#1180cf', content: '功能醫學' })}
    ${textBlock({ x: 118, y: 404, size: 54, weight: 900, fill: '#184f85', content: '自律神經失調' })}
    ${textBlock({ x: 118, y: 480, size: 32, weight: 700, fill: '#22334f', content: '10 張圖，依序說明症狀、原因、檢測、HRV 判讀與改善方式。' })}
    <g transform="translate(694 360)">
      <circle cx="166" cy="166" r="162" fill="#fff" stroke="#d7e7f7" stroke-width="4"/>
      <rect x="64" y="74" width="204" height="104" rx="22" fill="#eef6ff" stroke="#d7e7f7" stroke-width="3"/>
      <path d="M 90 130 C 108 106, 124 106, 142 130 S 176 154, 192 130 S 224 106, 238 130" fill="none" stroke="#1180cf" stroke-width="6" stroke-linecap="round"/>
      <rect x="102" y="220" width="128" height="78" rx="20" fill="#f4f8e9" stroke="#dceab6" stroke-width="3"/>
      <path d="M 128 258 C 142 236, 170 230, 188 244" fill="none" stroke="#78a91d" stroke-width="6" stroke-linecap="round"/>
      <circle cx="130" cy="80" r="22" fill="#1180cf"/>
      <circle cx="196" cy="80" r="22" fill="#ef8a1f"/>
      <circle cx="162" cy="170" r="22" fill="#78a91d"/>
    </g>
    ${pill(74, 952, 520, 64, '#1180cf', '自律神經檢測 · 功能醫學分類', '#fff', 28)}
    ${pill(620, 952, 506, 64, '#78a91d', '可依序閱讀：症狀、原因、HRV、改善', '#fff', 28)}
    ${footerNote('工學誠心診所  關心您的身心健康')}
  `;
}

const slideRenderers = [
  renderSlide1,
  renderSlide2,
  renderSlide3,
  renderSlide4,
  renderSlide5,
  renderSlide6,
  renderSlide7,
  renderSlide8,
  renderSlide9,
  renderSlide10,
];

function wrapSvg(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
${inner}
</svg>
`;
}

ensureDir(OUT_DIR);

const procedure = {
  id: meta.id,
  title: meta.title,
  type: meta.type,
  category: meta.category,
  subtitle: meta.subtitle,
  slides: meta.slides,
  steps: steps.map((step) => ({
    image: step.image,
    title: step.title,
    description: step.description,
    alt: step.alt,
  })),
};

fs.writeFileSync(PROC_PATH, JSON.stringify(procedure, null, 2) + '\n');

fs.writeFileSync(path.join(OUT_DIR, 'thumb.svg'), wrapSvg(renderThumb()));
slideRenderers.forEach((render, i) => {
  fs.writeFileSync(path.join(OUT_DIR, `step${i + 1}.svg`), wrapSvg(render()));
});

