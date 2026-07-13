# chzzk-kuji

치지직 후원 연동 이치방쿠지 프로그램. 설계 문서: `../../docs/superpowers/specs/2026-07-06-chzzk-ichiban-kuji-design.md`

## 최초 설정

1. https://developers.chzzk.naver.com 에서 애플리케이션 등록 (이름에 "치지직/chzzk/네이버/naver" 포함 불가), Client ID/Secret 발급
2. https://supabase.com 에서 무료 프로젝트 생성 (리전은 Seoul 권장) → 대시보드 상단 **Connect** → **Session pooler**의 URI를 복사 (`postgresql://...pooler.supabase.com:5432/postgres` 형태)
3. `.env.example`을 `.env`로 복사하고 `CHZZK_CLIENT_ID`, `CHZZK_CLIENT_SECRET`, `ADMIN_PASSWORD`, `DATABASE_URL`(2번에서 복사한 URI) 입력 (서버 시작 시 `dotenv`가 `.env`를 자동으로 읽어 `process.env`에 로드합니다)
4. `TOKEN_ENCRYPTION_KEY`는 `openssl rand -hex 32`로 생성해 채워넣기
5. `npm install`
6. `npm run dev` (서버 + 클라이언트 동시 실행 — 테이블은 첫 실행 때 자동 생성됩니다)
7. `http://localhost:5173/admin.html` 접속 후 `ADMIN_PASSWORD`로 로그인
8. 로그인한 브라우저에서 `/api/chzzk/oauth/start`로 이동 → 치지직 계정으로 인가 → 자동으로 콜백 처리되어 토큰이 암호화 저장되고 `/admin.html?chzzk=connected`로 돌아옴

데이터(회차·당첨 기록·연결 토큰)는 전부 Supabase에 저장되므로, 로컬에서 돌리든 서버에 배포하든 **같은 데이터**를 보게 됩니다.

## 사용 방법 (방송마다 하는 일)

최초 설정(위 1~7번)은 한 번만 하면 됩니다. 그 다음부터 방송할 때마다는:

### 1. 프로그램 켜기

`Web/chzzk-kuji` 폴더에서 `npm run dev` 실행 (서버 + 화면이 같이 켜짐). 로컬 PC에서 쓰는 경우, **이 창을 방송 내내 켜두어야** 후원을 계속 받을 수 있습니다. 껐다 켤 때마다 치지직 계정을 다시 인가할 필요는 없습니다 — 이미 연결 정보가 저장되어 있습니다.

### 2. 관리자 화면에서 회차 만들기

1. `http://localhost:5173/admin.html` 접속 → **네이버 계정으로 로그인**
2. 사이드바 하단의 연결 상태가 "연결됨"인지 확인 (다른 상태면 아래 "문제 생겼을 때" 참고)
3. "현재 회차" 칸에서:
   - **회차 이름**: 자유롭게 (예: "7월 6일 이치방쿠지")
   - **장당 가격**: 티켓 1장당 치즈 금액 (예: 1000)
   - **최대 번호**: 몇 번까지 팔 것인지 (예: 10이면 1~10번)
   - **번호,상품명,등급(선택)**: 한 줄에 하나씩, 쉼표로 구분 (예: `1,A상`, `2,B상`). 등급은 안 써도 됩니다.
4. **"회차 시작"** 클릭 → 번호판이 뜨면 준비 완료

### 3. 후원 받기

시청자가 "장당 가격"만큼 치즈를 후원하면서 메시지에 원하는 번호(예: "3번")를 적으면, 자동으로:
- 그 번호가 아직 안 팔렸으면 → 즉시 그 시청자에게 배정되어 번호판/오버레이에 반영
- 이미 팔린 번호거나, 금액이 안 맞거나, 번호를 안 적었으면 → 배정되지 않고 "처리 필요 큐"에 기록만 됨 (환불은 자동으로 안 되니, 직접 방송에서 안내하거나 처리)

### 4. OBS에 오버레이 넣기 (한 번만 설정하면 계속 씀)

OBS에서 소스 추가 → **브라우저** 선택 → URL에 `http://localhost:5173/overlay-kuji.html`, 룰렛은 `http://localhost:5173/overlay-roulette.html` 입력 → 배경 투명하게 번호판이 화면에 뜹니다. 판매된 번호는 초록색으로 강조되고, 방금 팔린 번호는 잠깐 반짝이는 효과가 나타납니다.

### 5. 회차 마무리

번호가 다 팔렸거나 방송을 마무리할 때 관리자 화면에서 **"회차 종료"** 클릭. 종료된 회차 기록은 삭제되지 않고 남아있고, 다음 방송에는 "회차 시작"으로 새로 만들면 됩니다.

### 6. 처리 필요 큐 확인

"처리 필요 큐"에 쌓인 항목(중복 후원, 금액 불일치 등)은 방송 중/후에 확인해서 시청자에게 안내하거나 필요하면 직접 처리한 뒤, "처리완료" 버튼으로 정리하세요.

## 관리자 화면 구성

- **간편 운영**: 연결 상태, 이치방쿠지 사용 여부, 현재 회차, 처리 필요 항목, 회차 종료를 방송 순서대로 확인합니다.
- **판매 번호판**: 전체·판매 가능·판매 완료 번호를 필터링해 확인합니다.
- **당첨 내역**: 닉네임, 상품명, 회차명, 번호로 검색합니다.
- **회차 설정**: 기본 정보 → 상품 구성 → 번호 확인 순서로 새 회차를 만듭니다.
- **오버레이**: OBS 주소와 닉네임 표시 방식을 설정합니다.
- **기타 설정**: 사용법과 로그아웃을 제공합니다.

모바일에서는 하단의 **운영·번호판·당첨·더보기** 메뉴를 사용합니다. 회차 설정, 오버레이, 기타 설정은 더보기에서 열 수 있습니다.

### 문제 생겼을 때

- **연결 상태가 "재연결 중"**: 일시적 문제, 잠시 후 자동으로 "연결됨"으로 돌아옵니다.
- **화면에 빨간 배너("재인증 필요")가 뜨면**: 배너의 "네이버로 다시 로그인" 링크 클릭 → 인가가 완료되는 순간 후원 수신이 **즉시 자동 복구**됩니다 (재시작 불필요).

## 관리자 로그인 (네이버 계정 전용)

- 로그인 화면의 초록색 **네이버 계정으로 로그인** 버튼이 유일한 로그인 방법입니다.
- 정상적으로 인증된 **모든 네이버·치지직 계정이 별도 초대 없이 관리자 화면에 로그인**할 수 있습니다.
- 가장 처음 로그인한 치지직 계정은 후원 수신 채널의 소유자로 등록됩니다. 다른 계정도 운영 기능을 사용할 수 있지만 소유자의 후원 수신 토큰과 연결 채널은 변경하지 않습니다.
- 첫 로그인과 동시에 치지직 후원 수신 연결도 자동으로 시작됩니다 (별도 연결 절차 없음).
- 네이버 로그인에 성공할 때마다 저장된 치지직 토큰이 갱신되어, 토큰 만료 걱정이 줄어듭니다.

### 비상 접근 (치지직 OAuth 장애 시)

화면에는 노출되지 않지만, 서버는 비상용 비밀번호 로그인 API를 유지합니다. 치지직 로그인이 불가능해진 경우 터미널에서:

```bash
curl -c /tmp/kuji.cookies -X POST https://<서비스 주소>/api/auth/login \
  -H "Content-Type: application/json" -d '{"password":"<ADMIN_PASSWORD 값>"}'
```

이후 같은 브라우저 대신 curl로 관리 API(`/api/admin/*`)를 직접 호출하거나, 발급된 `admin_token` 쿠키를 브라우저에 수동으로 넣어 화면을 사용할 수 있습니다.

## 배포하기 (24시간 구동 — 내 컴퓨터를 꺼도 됨)

로컬 실행은 컴퓨터/터미널을 켜둔 동안만 후원을 받습니다. 방송 시간 외에도 프로그램을 유지하거나 컴퓨터를 끄고 싶다면 상시 호스팅에 배포하세요.

### 배포 전 공통 준비

1. **치지직 개발자센터에서 배포용 Redirect URI 추가**: 앱 설정의 Redirect URI에
   `https://<배포된 도메인>/api/chzzk/oauth/callback` 을 추가 (로컬용 `http://localhost:3000/...`과 별개로 추가)
2. **환경변수 값 준비** (아래 6개):

   | 키 | 값 |
   |---|---|
   | `CHZZK_CLIENT_ID` | 개발자센터에서 발급받은 값 |
   | `CHZZK_CLIENT_SECRET` | 개발자센터에서 발급받은 값 |
   | `CHZZK_REDIRECT_URI` | `https://<배포된 도메인>/api/chzzk/oauth/callback` |
   | `TOKEN_ENCRYPTION_KEY` | `openssl rand -hex 32` 결과값 (64자리 hex) — 로컬 `.env`와 **같은 값**을 쓰면 로컬에서 연결한 치지직 토큰을 서버가 그대로 사용 가능 |
   | `ADMIN_PASSWORD` | 최초 관리자 비밀번호 |
   | `DATABASE_URL` | Supabase Session pooler URI (최초 설정 2번 참고) |

### Render 무료 플랜으로 배포 (완전 무료, 권장)

Render 무료 웹 서비스 + Supabase 무료 Postgres + GitHub Actions 핑 조합으로 비용 없이 24시간 고정 주소를 유지합니다.

1. **이 폴더를 GitHub 저장소로 업로드** (Web/chzzk-kuji 폴더가 저장소 루트가 되도록)
2. https://render.com 가입 (GitHub로 로그인) → **New +** → **Blueprint** → 방금 만든 저장소 선택
   - 포함된 `render.yaml`이 자동 인식되어 서비스가 구성됩니다
   - 환경변수 6개 입력을 요구하면 위 표의 값 입력
3. 배포가 끝나면 서비스 주소(`https://xxxx.onrender.com`) 확인 → `CHZZK_REDIRECT_URI` 환경변수와 치지직 개발자센터 Redirect URI를 이 주소 기준으로 맞춤
4. **잠자기 방지**: GitHub 저장소 → Settings → Secrets and variables → Actions → **Variables** → `RENDER_URL` = `https://xxxx.onrender.com` 추가. 포함된 keepalive 워크플로가 10분마다 핑을 보내 무료 인스턴스가 잠들지 않게 유지합니다.
   (⚠️ GitHub는 저장소에 60일간 활동이 없으면 예약 워크플로를 자동 비활성화합니다 — 가끔 커밋하거나 Actions 탭에서 재활성화하세요)
5. `https://xxxx.onrender.com/admin.html` 접속 → 비밀번호 로그인 → 치지직 계정 연결 → 완료
6. OBS 브라우저 소스 URL을 `https://xxxx.onrender.com/overlay-kuji.html`과 `https://xxxx.onrender.com/overlay-roulette.html`로 등록 (주소가 고정이라 한 번만 설정)

**무료 플랜 한계**: 월 750시간 무료 인스턴스 시간(1개 서비스 상시 구동 가능 수준)이고, 핑이 끊기면 15분 뒤 잠들며 다음 접속 시 깨어나는 데 ~1분 걸립니다. 데이터는 Supabase에 있으므로 잠들거나 재배포되어도 소실되지 않습니다.

### Docker로 배포 (Railway / Fly.io / 자체 서버 등)

`Dockerfile`이 포함되어 있어 Docker를 지원하는 어디서든 동일하게 배포할 수 있습니다. 데이터가 전부 `DATABASE_URL`의 Postgres에 있어서 컨테이너는 무상태 — 볼륨이 필요 없습니다:

```bash
docker build -t chzzk-kuji .
docker run -d -p 3000:3000 \
  -e CHZZK_CLIENT_ID=... -e CHZZK_CLIENT_SECRET=... \
  -e CHZZK_REDIRECT_URI=... -e TOKEN_ENCRYPTION_KEY=... \
  -e ADMIN_PASSWORD=... -e DATABASE_URL=postgresql://... \
  chzzk-kuji
```

### 배포 없이 로컬 PC + 무료 터널로 쓰기 (완전 무료, 방송 중에만 필요할 때)

상시로 켜둘 필요 없이 **방송할 때만** 다른 장비(폰, 다른 PC 등)에서 접속하면 되는 경우, 클라우드에 올리지 않고 로컬 PC + [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) 무료 "quick tunnel"로 충분합니다. 계정/카드 등록이 전혀 필요 없습니다.

1. `cloudflared` 설치 (최초 1회): [공식 다운로드](https://github.com/cloudflare/cloudflared/releases/latest)에서 자신의 OS/아키텍처에 맞는 바이너리를 받아 실행 권한 부여
2. 방송 시작 전, 이 프로젝트 폴더에서:
   ```bash
   CLOUDFLARED_BIN=/path/to/cloudflared ./scripts/start-with-tunnel.sh
   ```
   (`cloudflared`를 PATH에 설치했다면 `CLOUDFLARED_BIN` 없이 실행 가능하도록 스크립트 상단의 기본 경로를 자신의 설치 경로로 수정하세요.)
3. 콘솔에 뜨는 `https://xxxxx.trycloudflare.com/admin.html` 등의 주소를 다른 장비에서 그대로 열면 접속됩니다.
4. 방송이 끝나면 그 터미널 창에서 `Ctrl+C` 한 번으로 서버와 터널이 함께 종료됩니다.

**주의**: 이 주소는 스크립트를 실행할 때마다 랜덤하게 새로 생성됩니다 (같은 주소 재사용 불가). OBS 오버레이 URL도 방송 시작마다 새로 발급된 주소로 갱신해야 합니다. 매번 고정된 주소가 필요하면 Cloudflare 계정에 도메인을 연결해 "named tunnel"을 만드는 방법으로 업그레이드할 수 있습니다.

### 배포 없이 로컬로만 쓰기

터널도 필요 없고 같은 PC/네트워크에서만 쓴다면 방송 때마다 `npm run dev`로 켜는 방식도 충분합니다. 단, 이 창이 꺼져 있는 동안 들어온 후원은 수신되지 않습니다.

## 수동 종단 테스트 체크리스트

- [ ] 개발자센터 테스트 계정으로 실제 1,000치즈 후원 1건 발생 → 관리자 화면 번호판에 즉시 반영되는지 확인
- [ ] 동일 번호로 중복 후원 발생 → 처리 필요 큐에 `duplicate_rejected`로 표시되는지 확인
- [ ] OBS 브라우저 소스로 `/overlay-kuji.html`과 `/overlay-roulette.html` 추가 → 투명 배경과 실시간 하이라이트 애니메이션 확인
- [ ] 서버 재시작 후 관리자 화면에서 진행 중이던 회차/번호판이 그대로 복구되는지 확인
- [ ] 소켓 연결을 강제로 끊고(개발자센터에서 세션 종료 등) 재연결 배너와 자동 재연결이 동작하는지 확인
