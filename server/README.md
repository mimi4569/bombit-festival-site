# 바이브코딩 전시 백엔드 API

Express + Supabase 기반 작품 전시 사이트 백엔드입니다.

## 실행 (로컬)

```bash
cd server
npm install
cp .env.example .env   # 값 채우기
npm start
```

서버가 `http://localhost:8080`에서 실행됩니다.

## 환경 변수

| 변수 | 설명 |
|------|------|
| `PORT` | 서버 포트 (Render는 자동 제공) |
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role 키 (RLS 우회용) |
| `CORS_ORIGIN` | 허용 도메인 (쉼표 구분, `*` 면 전체 허용) |

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/health` | 헬스 체크 |
| GET | `/api/works` | 작품 목록 |
| GET | `/api/works/:id` | 단일 작품 |
| POST | `/api/works` | 작품 등록 (비밀번호 필수) |
| PUT | `/api/works/:id` | 작품 수정 (비밀번호 확인) |
| DELETE | `/api/works/:id` | 작품 삭제 (비밀번호 확인) |
| GET | `/api/works/:id/reviews` | 작품 평가 목록 |
| POST | `/api/works/:id/reviews` | 평가 등록 |
| GET | `/api/stats` | 전시 통계 |

## 보안

- 작품 수정용 비밀번호는 **bcrypt로 해싱**되어 저장됩니다.
- service_role 키를 사용해 서버에서 RLS를 우회하고 비밀번호를 안전하게 검증합니다.
- 프론트엔드는 publishable 키로는 더 이상 직접 수정/삭제를 할 수 없고 반드시 백엔드를 거칩니다.
