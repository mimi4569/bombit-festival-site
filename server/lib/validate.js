// 작품 데이터 검증 유틸
export function validateWork(data, { requirePassword = false } = {}) {
  const errors = [];
  const title = String(data.title || "").trim();
  const creator_name = String(data.creator_name || "").trim();
  const exhibition_year = Number(data.exhibition_year);
  const grade = String(data.grade || "").trim();
  const category = String(data.category || "").trim();

  if (!title) errors.push("제목은 필수입니다.");
  if (!creator_name) errors.push("제작자 이름은 필수입니다.");
  if (!exhibition_year || exhibition_year < 1900 || exhibition_year > 2100) {
    errors.push("전시 연도가 올바르지 않습니다.");
  }
  if (!grade) errors.push("학년은 필수입니다.");
  if (!category) errors.push("구분은 필수입니다.");
  if (requirePassword && !String(data.password || "").trim()) {
    errors.push("수정용 비밀번호는 필수입니다.");
  }

  // URL 선택 검증
  const siteUrl = String(data.site_url || "").trim();
  if (siteUrl && !/^https?:\/\//i.test(siteUrl)) errors.push("사이트 주소는 http(s):// 로 시작해야 합니다.");
  const githubUrl = String(data.github_url || "").trim();
  if (githubUrl && !/^https?:\/\//i.test(githubUrl)) errors.push("GitHub URL은 http(s):// 로 시작해야 합니다.");
  const thumb = String(data.thumbnail_url || "").trim();
  if (thumb && !/^https?:\/\//i.test(thumb)) errors.push("썸네일 URL은 http(s):// 로 시작해야 합니다.");

  return {
    errors,
    clean: {
      title,
      creator_name,
      description: String(data.description || "").trim() || null,
      site_url: siteUrl || null,
      github_url: githubUrl || null,
      exhibition_year,
      grade,
      category,
      thumbnail_url: thumb || null,
    },
  };
}

export function validateReview(data) {
  const errors = [];
  const reviewer_name = String(data.reviewer_name || "").trim() || "익명";
  const rating = Number(data.rating);
  const comment = String(data.comment || "").trim();

  if (!rating || rating < 1 || rating > 5) errors.push("별점은 1~5 사이여야 합니다.");
  if (comment.length > 400) errors.push("평가는 400자 이내여야 합니다.");

  return {
    errors,
    clean: { reviewer_name, rating, comment: comment || null },
  };
}
