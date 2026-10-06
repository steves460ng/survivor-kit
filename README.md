# 뱀서류 로그라이크 키트

| 파일 | 역할 |
|---|---|
| `index.html` | 화면 뼈대 |
| `style.css` | 스타일 |
| `game.js` | 엔진 (모든 게임 로직) |
| `mod.json` | 콘텐츠 (클래스, 스킬, 적, 맵, 강화 트리, 난이도, 화면 설정) |

## GitHub Pages 배포
1. 이 폴더의 파일을 저장소 루트에 올립니다.
2. Settings → Pages → Branch를 `main`, 폴더를 `/ (root)`로 선택합니다.
3. `https://<계정>.github.io/<저장소>/` 로 접속합니다.

## 다른 게임으로 재사용
- `mod.json`만 교체하면 됩니다. 엔진(`game.js`)은 그대로 둡니다.
- 모드 파일을 여러 개 두려면 `mods/other.json`처럼 저장하고 `?mod=mods/other.json`으로 접속합니다. 세이브는 모드 파일별로 따로 저장됩니다.

## 로컬 테스트
`index.html`을 더블클릭하면 `mod.json`을 읽지 못합니다. 폴더에서 `python3 -m http.server`를 실행한 뒤 `http://localhost:8000`으로 여세요.

## 스프라이트 이미지
- 이미지는 `index.html`과 같은 위치의 `img/` 폴더에 넣습니다. (경로는 `mod.json`의 `assets.imgDir`, 기본값 `./img`)
- `mod.json`에서는 파일명만 적습니다. 예: `"sprite": "mage.png"` -> `./img/mage.png`, 하위 폴더는 `"enemies/slime.png"`.
- 클래스, 적, 스킬(`sprite`, `hitFx`, `castFx`), 맵의 장애물과 함정, 강화 노드, 피격 스프라이트(`hurtSprite`, `hitSprite`), 화면 `background`에 모두 쓸 수 있습니다.
- 지원 확장자: png, jpg, gif, webp, svg. 이모지와 `data:image` URL도 그대로 쓸 수 있습니다.
- 파일이 없으면 해당 자리에 `?`가 표시됩니다. `..`나 `http://` 같은 경로는 검증에서 거부됩니다.
- 권장 크기: 정사각형 64x64 이상의 투명 배경 PNG. 도트 그래픽은 확대해도 선명하게 보이도록 처리되어 있습니다.
- 파일명처럼 보이는데 지원하지 않는 확장자(예: `mage.bmp`)이거나 앞뒤에 공백이 있으면 로드/적용 시 JSON 편집창 아래에 경고가 표시됩니다. 경고는 게임 실행을 막지 않고, 해당 값은 글자로 표시됩니다. (확장자가 아예 없는 `"mage"`는 일반 텍스트와 구분할 수 없어 경고하지 않습니다.)

