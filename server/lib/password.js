import bcrypt from "bcryptjs";

// 비밀번호 해싱 (작품 등록/수정 시)
export async function hashPassword(plain) {
  if (!plain) return null;
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(String(plain), salt);
}

// 비밀번호 검증 (작품 수정/삭제 시)
export async function verifyPassword(plain, hash) {
  if (!hash) return false;
  try {
    return await bcrypt.compare(String(plain || ""), String(hash));
  } catch {
    return false;
  }
}

// 기존 평문 비밀번호를 마이그레이션할 때 사용
// 평문으로 저장된 값이면 그대로 비교, 아니면 bcrypt 검증
export async function verifyPasswordAny(plain, stored) {
  if (!stored) return false;
  // bcrypt 해시는 $2a$ 또는 $2b$ 로 시작
  if (/^\$2[ab]\$\d+\$/.test(String(stored))) {
    return verifyPassword(plain, stored);
  }
  // 평문 비교 (레거시 호환)
  return String(plain) === String(stored);
}
