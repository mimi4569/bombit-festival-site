import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { supabase } from "./lib/supabase.js";
import worksRouter from "./routes/works.js";
import reviewsRouter from "./routes/reviews.js";
import statsRouter from "./routes/stats.js";

const app = express();
const PORT = process.env.PORT || 8080;

// CORS
const allowedOrigins = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (allowedOrigins.includes("*") || !origin || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error("Not allowed by CORS"));
      }
    },
  })
);

// 보안 헤더 (iframe 미리보기 허용을 위해 CSP 완화)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(morgan("combined"));

// 기본 rate limit
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// 헬스 체크 (Render 배포 상태 확인용)
app.get("/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// API 라우트
app.use("/api/works", worksRouter);
app.use("/api/works", reviewsRouter);
app.use("/api", statsRouter);

// Supabase 연결 확인
app.get("/api/ping", async (req, res) => {
  try {
    const { error } = await supabase.from("works").select("id").limit(1);
    if (error) throw error;
    res.json({ db: "ok" });
  } catch (e) {
    res.status(500).json({ db: "error", message: e.message });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

app.listen(PORT, () => {
  console.log(`✅ 바이브코딩 전시 API 서버가 포트 ${PORT}에서 실행 중`);
});
