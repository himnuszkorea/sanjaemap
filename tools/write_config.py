"""저장소 루트 .env.local 의 VWORLD_KEY → config.js (화면이 쓰는 브이월드 키)

사용: py -3 tools/write_config.py
화면용 키는 브라우저에 그대로 보이므로 config.js 는 공개 저장소에 커밋된다.
대신 브이월드에서 이 키의 서비스 URL 을 Pages 주소(https://himnuszkorea.github.io)로만 등록해 다른 사이트에서 못 쓰게 한다.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
key = re.search(r"^VWORLD_KEY=(\S+)", (ROOT / ".env.local").read_text(encoding="utf-8-sig"), re.M).group(1)
(ROOT / "config.js").write_text(
    "// 브이월드 키 — tools/write_config.py 가 .env.local 에서 만든다. 서비스 URL 이 Pages 주소로 제한된 키다.\n"
    f'window.VWORLD_KEY = "{key}";\n', encoding="utf-8")
print(f"config.js 작성(키 앞 4자리 {key[:4]}…)")
