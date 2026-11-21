import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
// service_role 키를 사용하면 RLS를 무시하고 서버에서 데이터를 제어할 수 있습니다.
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.warn(
    "⚠️ SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.\n" +
      "server/.env 파일을 확인해 주세요."
  );
}

export const supabase = createClient(url || "", serviceKey || "", {
  auth: { persistSession: false, autoRefreshToken: false },
});
