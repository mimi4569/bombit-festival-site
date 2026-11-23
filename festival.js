/* ===========================================================
   별빛야시장 — 인터랙션
   =========================================================== */

(function () {
  "use strict";

  /* ---------- 밤하늘 별빛 캔버스 ---------- */
  const canvas = document.getElementById("stars");
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let stars = [];
  let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  let rafId = null;

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initStars();
  }

  function initStars() {
    // 화면 크기에 비례한 별 개수
    const count = Math.min(180, Math.floor((w * h) / 9000));
    stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.4 + 0.3,
        baseAlpha: Math.random() * 0.6 + 0.2,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.6 + 0.2,
        hue: Math.random() < 0.15 ? "gold" : "white"
      });
    }
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    const time = t * 0.001;

    // 별 그리기
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const flicker = Math.sin(time * s.speed + s.phase) * 0.35;
      const alpha = Math.max(0.05, s.baseAlpha + flicker);

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      if (s.hue === "gold") {
        ctx.fillStyle = "rgba(232, 180, 71, " + alpha + ")";
        // 황금별은 약한 광채
        ctx.shadowColor = "rgba(232, 180, 71, 0.8)";
        ctx.shadowBlur = 6;
      } else {
        ctx.fillStyle = "rgba(245, 240, 220, " + alpha + ")";
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 가끔 별똥별
    if (Math.random() < 0.002 && !reduceMotion) {
      drawShootingStar();
    }

    rafId = requestAnimationFrame(draw);
  }

  let shooting = null;
  function drawShootingStar() {
    if (shooting) return;
    const startX = Math.random() * w * 0.6;
    const startY = Math.random() * h * 0.4;
    shooting = {
      x: startX,
      y: startY,
      vx: 6 + Math.random() * 3,
      vy: 2 + Math.random() * 1.5,
      life: 1,
      trail: []
    };
  }

  function updateShooting() {
    if (!shooting) return;
    const s = shooting;
    s.trail.push({ x: s.x, y: s.y });
    if (s.trail.length > 12) s.trail.shift();
    s.x += s.vx;
    s.y += s.vy;
    s.life -= 0.015;

    for (let i = 0; i < s.trail.length; i++) {
      const p = s.trail[i];
      const a = (i / s.trail.length) * s.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 248, 231, " + a + ")";
      ctx.fill();
    }

    if (s.life <= 0 || s.x > w || s.y > h) {
      shooting = null;
    }
  }

  // 별똥별을 메인 루프에 끼워 넣기 위해 draw 재작성
  function loop(t) {
    ctx.clearRect(0, 0, w, h);
    const time = t * 0.001;

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const flicker = Math.sin(time * s.speed + s.phase) * 0.35;
      const alpha = Math.max(0.05, s.baseAlpha + flicker);

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      if (s.hue === "gold") {
        ctx.fillStyle = "rgba(232, 180, 71, " + alpha + ")";
        ctx.shadowColor = "rgba(232, 180, 71, 0.8)";
        ctx.shadowBlur = 6;
      } else {
        ctx.fillStyle = "rgba(245, 240, 220, " + alpha + ")";
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    if (!reduceMotion && Math.random() < 0.0025 && !shooting) {
      drawShootingStar();
    }
    updateShooting();

    rafId = requestAnimationFrame(loop);
  }

  // 가시성에 따라 애니메이션 일시정지 (배터리 절약)
  function start() {
    if (rafId) return;
    rafId = requestAnimationFrame(loop);
  }
  function stop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else start();
  });

  resize();
  start();

  /* ---------- hero-title 글자 튀어내려오기 (GSAP) ---------- */
  function splitTitleChars(titleEl) {
    const chars = [];
    const walk = (node) => {
      const children = Array.from(node.childNodes);
      children.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent;
          const frag = document.createDocumentFragment();
          for (const ch of text) {
            // 공백/줄바꿈은 텍스트 노드로 유지 (레이아웃 보존)
            if (ch === " " || ch === "\n" || ch === "\t" || ch === "\r") {
              frag.appendChild(document.createTextNode(ch));
            } else {
              const span = document.createElement("span");
              span.className = "char";
              span.textContent = ch;
              frag.appendChild(span);
              chars.push(span);
            }
          }
          node.replaceChild(frag, child);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          // <br>, <em> 등은 그대로 두고 내부 텍스트만 순회
          walk(child);
        }
      });
    };
    walk(titleEl);
    return chars;
  }

  function animateHeroTitle() {
    const titleEl = document.getElementById("hero-title");
    if (!titleEl || !window.gsap) return;

    const chars = splitTitleChars(titleEl);
    if (!chars.length) return;

    // reduced motion: 글자 분리만 하고 바로 보이게
    if (reduceMotion) {
      gsap.set(chars, { opacity: 1, y: 0, scale: 1 });
      return;
    }

    // 위에서 살짝 크게 튀어내려와 elastic으로 제자리로
    gsap.from(chars, {
      y: -55,
      scale: 1.45,
      opacity: 0,
      duration: 1.15,
      ease: "elastic.out(1, 0.45)",
      stagger: 0.045,
      delay: 0.25,
    });
  }

  // GSAP 스크립트(defer)가 로드된 뒤 실행 보장
  if (document.readyState === "complete") {
    animateHeroTitle();
  } else {
    window.addEventListener("load", animateHeroTitle, { once: true });
  }

  /* ---------- scene 스크롤 진입 (AOS) ---------- */
  // data-aos 속성은 마크업에 정적으로 기입되어 있고, AOS는 body 끝 일반 스크립트로 로드됨
  function setupSceneAOS() {
    if (!window.AOS) return;

    AOS.init({
      duration: 700,
      easing: "ease-out-cubic",
      once: true,
      offset: 80,
      disable: reduceMotion,
    });
  }
  setupSceneAOS();

  /* ---------- 헤더 스크롤 효과 ---------- */
  const header = document.querySelector(".site-header");
  let ticking = false;

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(function () {
        if (window.scrollY > 40) {
          header.classList.add("scrolled");
        } else {
          header.classList.remove("scrolled");
        }
        ticking = false;
      });
      ticking = true;
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- 부스 카드 살짝 떠오르는 인터랙션 ---------- */
  // hover는 CSS로 처리. 여기서는 터치 디바이스에서 탭 시 잠깐 활성화
  const cards = document.querySelectorAll(".booth-card");
  cards.forEach(function (card) {
    card.addEventListener("touchstart", function () {
      card.classList.add("is-active");
    }, { passive: true });
    card.addEventListener("touchend", function () {
      setTimeout(function () { card.classList.remove("is-active"); }, 400);
    }, { passive: true });
  });

})();
