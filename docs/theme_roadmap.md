# 🎨 Codex Pet (Wiki Wiki) 未來擴充主題設計藍圖 (Theme Roadmap)

本文件保存未來待實現之 3 款主題設計規格與 Token 標準，供後續版本擴充或開放社群匯入使用。

---

## 🌸 1. 浪漫櫻花粉 (Sakura Pink)
- **ID**: `sakura-pink`
- **視覺風格**: 夢幻日系櫻花粉、柔和金邊卡片、櫻花花瓣飄落背景底紋。
- **色彩 Token**:
  ```css
  :root[data-theme="sakura-pink"] {
    --theme-bg: linear-gradient(145deg, #fff5f8 0%, #ffebee 100%);
    --theme-bg-pattern: url('../assets/images/themes/sakura_pattern.png');
    --theme-card-bg: rgba(255, 255, 255, 0.95);
    --theme-card-border: 1px solid rgba(248, 187, 208, 0.6);
    --theme-card-radius: 24px;
    --theme-primary: #ec407a;
    --theme-primary-hover: #c2185b;
    --theme-accent: #ffb74d;
    --theme-text-title: #880e4f;
    --theme-text-body: #6a1b9a;
    --theme-btn-bg: linear-gradient(135deg, #f48fb1, #ec407a);
    --theme-btn-radius: 24px;
    --theme-shadow: 0 10px 30px rgba(236, 64, 122, 0.12);
  }
  ```

---

## 🌌 2. 星空暗夜藍 (Starry Night Dark)
- **ID**: `starry-dark`
- **視覺風格**: 賽博暗黑夜景、深藍玻璃毛玻璃、霓虹發光字體與薄霧邊框。
- **色彩 Token**:
  ```css
  :root[data-theme="starry-dark"] {
    --theme-bg: linear-gradient(145deg, #0d1b2a 0%, #1b263b 100%);
    --theme-bg-pattern: url('../assets/images/themes/starry_pattern.png');
    --theme-card-bg: rgba(27, 38, 59, 0.85);
    --theme-card-border: 1px solid rgba(65, 90, 119, 0.5);
    --theme-card-radius: 18px;
    --theme-primary: #80d8ff;
    --theme-primary-hover: #40c4ff;
    --theme-accent: #ff80ab;
    --theme-text-title: #e0f7fa;
    --theme-text-body: #b0bec5;
    --theme-btn-bg: linear-gradient(135deg, #00b0ff, #0091ea);
    --theme-btn-radius: 18px;
    --theme-shadow: 0 10px 30px rgba(0, 176, 255, 0.15);
  }
  ```

---

## 🍞 3. 溫馨吐司咖 (Cozy Toast Cafe)
- **ID**: `cozy-toast`
- **視覺風格**: 復古日系咖啡廳、燕麥奶油黃卡片、皮革質感按鈕與手繪拿鐵圖案。
- **色彩 Token**:
  ```css
  :root[data-theme="cozy-toast"] {
    --theme-bg: linear-gradient(145deg, #fdfbf7 0%, #f5efe6 100%);
    --theme-bg-pattern: url('../assets/images/themes/toast_pattern.png');
    --theme-card-bg: rgba(255, 253, 249, 0.95);
    --theme-card-border: 1px solid rgba(224, 203, 179, 0.6);
    --theme-card-radius: 20px;
    --theme-primary: #8d6e63;
    --theme-primary-hover: #5d4037;
    --theme-accent: #ffb74d;
    --theme-text-title: #4e342e;
    --theme-text-body: #6d4c41;
    --theme-btn-bg: linear-gradient(135deg, #d7ccc8, #a1887f);
    --theme-btn-radius: 20px;
    --theme-shadow: 0 10px 30px rgba(141, 110, 99, 0.1);
  }
  ```
