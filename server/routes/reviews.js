import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { validateReview } from "../lib/validate.js";

const router = Router();

// 특정 작품의 평가 목록
router.get("/:id/reviews", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from("reviews")
      .select("id,work_id,reviewer_name,rating,comment,created_at")
      .eq("work_id", id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ reviews: data || [] });
  } catch (e) {
    console.error("GET reviews error:", e);
    res.status(500).json({ error: "평가를 불러오지 못했습니다.", message: e.message });
  }
});

// 평가 등록
router.post("/:id/reviews", async (req, res) => {
  try {
    const { id } = req.params;
    const { errors, clean } = validateReview(req.body);
    if (errors.length) return res.status(400).json({ error: "검증 실패", details: errors });

    // 작품 존재 확인
    const { data: work, error: workErr } = await supabase
      .from("works")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (workErr) throw workErr;
    if (!work) return res.status(404).json({ error: "작품을 찾을 수 없습니다." });

    const { data, error } = await supabase
      .from("reviews")
      .insert({ work_id: id, ...clean })
      .select("id,work_id,reviewer_name,rating,comment,created_at")
      .single();
    if (error) throw error;

    res.status(201).json({ review: data });
  } catch (e) {
    console.error("POST reviews error:", e);
    res.status(500).json({ error: "평가 등록에 실패했습니다.", message: e.message });
  }
});

export default router;
