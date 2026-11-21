import { Router } from "express";
import { supabase } from "../lib/supabase.js";

const router = Router();

// 전시 통계: 작품 수, 평가 수, 평균 평점, 학년/구분/연도별 분포
router.get("/stats", async (req, res) => {
  try {
    const [worksRes, reviewsRes] = await Promise.all([
      supabase.from("works").select("id,grade,category,exhibition_year"),
      supabase.from("reviews").select("id,rating,work_id"),
    ]);

    if (worksRes.error) throw worksRes.error;
    if (reviewsRes.error) throw reviewsRes.error;

    const works = worksRes.data || [];
    const reviews = reviewsRes.data || [];

    const avg =
      reviews.length > 0
        ? Math.round((reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length) * 10) / 10
        : 0;

    const by = (arr, key) =>
      arr.reduce((acc, item) => {
        const k = String(item[key] ?? "기타");
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});

    res.json({
      works_count: works.length,
      reviews_count: reviews.length,
      average_rating: avg,
      by_grade: by(works, "grade"),
      by_category: by(works, "category"),
      by_year: by(works, "exhibition_year"),
    });
  } catch (e) {
    console.error("GET /stats error:", e);
    res.status(500).json({ error: "통계를 불러오지 못했습니다.", message: e.message });
  }
});

export default router;
