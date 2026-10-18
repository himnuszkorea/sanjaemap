import sys
from PIL import Image, ImageDraw, ImageFont
W, H = 1200, 630
NAVY, GOLD, WHITE, MUTED = (27, 42, 74), (200, 150, 62), (255, 255, 255), (190, 200, 220)
img = Image.new("RGB", (W, H), NAVY)
d = ImageDraw.Draw(img)
F = lambda w, s: ImageFont.truetype(f"C:/Windows/Fonts/{'malgunbd' if w else 'malgun'}.ttf", s)
d.rectangle([0, H - 14, W, H], fill=GOLD)
# 지도 핀
cx, cy, r = 1055, 175, 82
d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE, outline=GOLD, width=10)
d.polygon([(cx - 58, cy + 58), (cx + 58, cy + 58), (cx, cy + 175)], fill=WHITE)
d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE, outline=GOLD, width=10)
d.ellipse([cx - 34, cy - 34, cx + 34, cy + 34], fill=NAVY)  # 핀 가운데 점(적십자 표장과 비슷한 십자는 쓰지 않는다)
d.text((80, 110), "산재맵", font=F(1, 128), fill=WHITE)
d.text((84, 270), "산재보험 의료기관 찾기 · 산재 특진 의료기관 지도", font=F(1, 36), fill=GOLD)
y = 350
for line in ["산재보험 지정의료기관 6,742곳", "소음성 난청 청력 특진 의뢰기관 220곳", "근로복지공단 지사 · 가까운 순 · 길찾기"]:
    d.ellipse([86, y + 14, 104, y + 32], fill=GOLD)
    d.text((122, y), line, font=F(0, 36), fill=WHITE)
    y += 58
d.text((84, 548), "himnuszkorea.github.io/sanjaemap", font=F(0, 28), fill=MUTED)
img.save(sys.argv[1], optimize=True)
