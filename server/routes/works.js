import { Router } from "express";
import bcrypt from "bcryptjs";
import { supabase } from "../lib/supabase.js";
import { validateWork } from "../lib/validate.js";
import { hashPassword, verifyPasswordAny } from "../lib/password.js";

const router = Router();

// 작품 목록 조회 (비밀번호 제외)
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("works")
      .select("id,title,creator_name,description,site_url,github_url,exhibition_year,grade,category,thumbnail_url,created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ works: data || [] });
  } catch (e) {
    console.error("GET /works error:", e);
    res.status(500).json({ error: "작품을 불러오지 못했습니다.", message: e.message });
  }
});

// 단일 작품 조회 (비밀번호 제외)
router.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("works")
      .select("id,title,creator_name,description,site_url,github_url,exhibition_year,grade,category,thumbnail_url,created_at")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "작품을 찾을 수 없습니다." });
    res.json({ work: data });
  } catch (e) {
    console.error("GET /works/:id error:", e);
    res.status(500).json({ error: "작품을 불러오지 못했습니다.", message: e.message });
  }
});

// 작품 등록 (비밀번호는 bcrypt 해싱 후 저장)
router.post("/", async (req, res) => {
  try {
    const { errors, clean } = validateWork(req.body, { requirePassword: true });
    if (errors.length) return res.status(400).json({ error: "검증 실패", details: errors });

    const password = String(req.body.password || "").trim();
    const passwordHash = await hashPassword(password);

    const row = { ...clean, password: passwordHash };

    const { data, error } = await supabase
      .from("works")
      .insert(row)
      .select("id,title,creator_name,description,site_url,github_url,exhibition_year,grade,category,thumbnail_url,created_at")
      .single();
    if (error) throw error;

    res.status(201).json({ work: data });
  } catch (e) {
    console.error("POST /works error:", e);
    res.status(500).json({ error: "작품 등록에 실패했습니다.", message: e.message });
  }
});

// 작품 수정 — 비밀번호 확인 후 업데이트
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const password = String(req.body.password || "").trim();
    if (!password) return res.status(400).json({ error: "비밀번호를 입력해 주세요." });

    // 저장된 비밀번호 해시 조회 (RLS 우회: service_role)
    const { data: existing, error: findErr } = await supabase
      .from("works")
      .select("id,password")
      .eq("id", id)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!existing) return res.status(404).json({ error: "작품을 찾을 수 없습니다." });

    const ok = await verifyPasswordAny(password, existing.password);
    if (!ok) return res.status(403).json({ error: "비밀번호가 일치하지 않습니다." });

    const { errors, clean } = validateWork(req.body, { requirePassword: false });
    if (errors.length) return res.status(400).json({ error: "검증 실패", details: errors });

    const { data, error } = await supabase
      .from("works")
      .update(clean)
      .eq("id", id)
      .select("id,title,creator_name,description,site_url,github_url,exhibition_year,grade,category,thumbnail_url,created_at")
      .single();
    if (error) throw error;

    res.json({ work: data });
  } catch (e) {
    console.error("PUT /works/:id error:", e);
    res.status(500).json({ error: "작품 수정에 실패했습니다.", message: e.message });
  }
});

// 작품 삭제 — 비밀번호 확인 후 삭제
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const password = String(req.body.password || "").trim();
    if (!password) return res.status(400).json({ error: "비밀번호를 입력해 주세요." });

    const { data: existing, error: findErr } = await supabase
      .from("works")
      .select("id,password")
      .eq("id", id)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!existing) return res.status(404).json({ error: "작품을 찾을 수 없습니다." });

    const ok = await verifyPasswordAny(password, existing.password);
    if (!ok) return res.status(403).json({ error: "비밀번호가 일치하지 않습니다." });

    const { error } = await supabase.from("works").delete().eq("id", id);
    if (error) throw error;

    res.json({ deleted: true, id });
  } catch (e) {
    console.error("DELETE /works/:id error:", e);
    res.status(500).json({ error: "작품 삭제에 실패했습니다.", message: e.message });
  }
});

export default router;
