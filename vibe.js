(() => {
  "use strict";

  // ===== 백엔드 API 설정 =====
  // 로컬 개발: http://localhost:8080
  // 배포 후: Render URL (https://vibe-exhibition.onrender.com 등)
  // 자동 감지: 같은 호스트면 같은 origin, 아니면 기본값
  const API_BASE = (() => {
    const stored = localStorage.getItem("vibe_api_base");
    if (stored) return stored.replace(/\/$/, "");
    // 배포된 정적 사이트가 같은 도메인의 /api를 쓴다고 가정하지 않음 — 명시적 URL 필요
    return "http://localhost:8080";
  })();

  // ===== 상태 =====
  const state = {
    works: [],
    reviews: [],
    selectedWorkId: null,
    previewLoaded: false,
    reviewRating: 0,
    currentSiteUrl: "",
    currentTitle: "",
    editingWorkId: null,
    pendingAction: null, // "edit" | "delete"
  };

  // ===== 유틸 =====
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const escapeHtml = (str) =>
    String(str ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));

  function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function starsHtml(rating, max = 5) {
    let s = "";
    for (let i = 1; i <= max; i++) s += `<span class="${i <= rating ? "on" : ""}">★</span>`;
    return `<span class="stars" aria-label="별점 ${rating}점">${s}</span>`;
  }

  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  }

  function validUrl(u) {
    if (!u) return "";
    const v = String(u).trim();
    if (!v) return "";
    if (!/^https?:\/\//i.test(v)) return "";
    return v;
  }

  function placeholderThumb(title) {
    const ch = (String(title || "?").trim().slice(0, 1) || "?").toUpperCase();
    return `<div class="work-thumb-fallback">${escapeHtml(ch)}</div>`;
  }

  // ===== API 호출 헬퍼 =====
  async function api(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  // ===== 데이터 로드 =====
  async function loadWorks() {
    try {
      const { works } = await api("/api/works");
      state.works = works || [];
      renderGrid();
      renderStats();
    } catch (e) {
      console.error("works 로드 실패:", e);
      showToast("작품을 불러오지 못했습니다.");
    }
  }

  async function loadReviews() {
    try {
      // 모든 작품의 평가를 한 번에 가져오기 위해 통계 API 대신 각 작품 조회 —
      // 더 효율적으로: 백엔드에 전체 평가 조회가 없으므로, 현재 선택된 작품만 로드
      // 카드에 평점 표시를 위해 통계 활용 가능. 여기서는 선택된 작품만 로드.
      if (state.selectedWorkId) {
        const { reviews } = await api(`/api/works/${state.selectedWorkId}/reviews`);
        state.reviews = reviews || [];
        renderReviews(state.selectedWorkId);
      }
      // 카드의 평점 표시를 위해 모든 작품의 평가도 로드 (간단히 각각 조회)
      // 성능 최적화가 필요하면 백엔드에 batch 엔드포인트 추가 가능
    } catch (e) {
      console.error("reviews 로드 실패:", e);
    }
  }

  async function loadReviewStatsForAll() {
    // 각 작품의 평점을 카드에 표시하기 위해 병렬로 평가 조회
    try {
      const results = await Promise.all(
        state.works.map((w) => api(`/api/works/${w.id}/reviews`).catch(() => ({ reviews: [] })))
      );
      state.reviewsByWork = {};
      state.works.forEach((w, i) => {
        state.reviewsByWork[w.id] = results[i].reviews || [];
      });
      renderGrid();
      renderStats();
    } catch (e) {
      console.error("review stats 로드 실패:", e);
    }
  }

  function reviewStatsFor(workId) {
    const list = (state.reviewsByWork && state.reviewsByWork[workId]) || [];
    const count = list.length;
    const avg = count ? list.reduce((s, r) => s + Number(r.rating || 0), 0) / count : 0;
    return { count, avg: Math.round(avg * 10) / 10, list };
  }

  // ===== 통계 =====
  async function renderStats() {
    try {
      const stats = await api("/api/stats");
      $("#stat-works").textContent = String(stats.works_count || 0);
      $("#stat-reviews").textContent = String(stats.reviews_count || 0);
    } catch (e) {
      $("#stat-works").textContent = String(state.works.length);
      $("#stat-reviews").textContent = "0";
    }
  }

  // ===== 작품 목록 (세로) =====
  function renderGrid() {
    const grid = $("#works-grid");
    const empty = $("#empty-state");

    if (!state.works.length) {
      grid.innerHTML = "";
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    grid.innerHTML = state.works.map((w) => workCardHtml(w)).join("");
    $$("img[data-title]", grid).forEach((img) => {
      img.addEventListener("error", () => {
        const div = document.createElement("div");
        div.className = "work-thumb-fallback";
        div.textContent = String(img.dataset.title || "?").slice(0, 1).toUpperCase();
        img.replaceWith(div);
      });
    });
    $$(".work-card", grid).forEach((card) => {
      card.addEventListener("click", () => openDetail(card.dataset.id));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(card.dataset.id); }
      });
    });
    if (state.selectedWorkId) {
      const active = grid.querySelector(`.work-card[data-id="${state.selectedWorkId}"]`);
      if (active) active.classList.add("is-active");
    }
  }

  function workCardHtml(w) {
    const thumb = validUrl(w.thumbnail_url)
      ? `<img src="${escapeHtml(w.thumbnail_url)}" alt="${escapeHtml(w.title)} 썸네일" loading="lazy" data-title="${escapeHtml(w.title)}" />`
      : placeholderThumb(w.title);
    const { count, avg } = reviewStatsFor(w.id);
    const rate = count
      ? `<span class="work-rate">★ ${avg.toFixed(1)}<span style="color:var(--muted-2);font-weight:400"> · ${count}</span></span>`
      : `<span class="work-rate is-empty">평가 없음</span>`;
    return `
      <article class="work-card" data-id="${w.id}" tabindex="0" role="button" aria-label="${escapeHtml(w.title)} 작품 보기">
        <div class="work-thumb">${thumb}</div>
        <div class="work-body">
          <h3 class="work-title">${escapeHtml(w.title)}</h3>
          <p class="work-creator">${escapeHtml(w.creator_name)} · ${escapeHtml(w.exhibition_year)}</p>
          <div class="work-foot">${rate}</div>
        </div>
      </article>`;
  }

  // ===== 상세 패널 (옆에 바로 표시) =====
  async function openDetail(workId) {
    const w = state.works.find((x) => x.id === workId);
    if (!w) return;
    state.selectedWorkId = workId;
    state.previewLoaded = false;
    state.reviewRating = 0;
    renderDetailPanel(w);
    $$(".work-card").forEach((c) => c.classList.toggle("is-active", c.dataset.id === workId));
    if (window.innerWidth < 900) {
      $("#detail-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // 평가 로드
    try {
      const { reviews } = await api(`/api/works/${workId}/reviews`);
      if (!state.reviewsByWork) state.reviewsByWork = {};
      state.reviewsByWork[workId] = reviews || [];
      renderReviews(workId);
    } catch (e) {
      console.error("평가 로드 실패:", e);
    }
  }

  function renderDetailPanel(w) {
    const panel = $("#detail-panel");
    const siteUrl = validUrl(w.site_url);
    const githubUrl = validUrl(w.github_url);
    const thumb = validUrl(w.thumbnail_url);

    const stage = siteUrl
      ? `<div class="detail-stage" id="detail-stage">
           <div class="stage-toolbar">
             <button class="stage-fullscreen-btn" id="open-fullscreen" type="button" aria-label="전체 화면으로 보기" title="전체 화면으로 보기">
               <span aria-hidden="true">⤢</span> 전체 화면
             </button>
           </div>
           <div class="stage-content" id="stage-content">
             ${thumb
                ? `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(w.title)} 미리보기" />`
                : `<div class="work-thumb-fallback">${escapeHtml((w.title || "?").slice(0,1).toUpperCase())}</div>`}
             <button class="detail-stage-play" id="preview-play" type="button" aria-label="사이트 미리보기">
               <span class="play-circle" aria-hidden="true">▶</span>
               <span class="play-label">사이트 미리보기</span>
             </button>
           </div>
         </div>
         <p class="stage-note">일부 사이트는 보안 설정으로 미리보기가 표시되지 않을 수 있습니다. 그럴 땐 전체 화면이나 아래 버튼으로 새 창에서 열어 보세요.</p>`
      : `<div class="detail-stage"><div class="work-thumb-fallback">${escapeHtml((w.title || "?").slice(0,1).toUpperCase())}</div></div>
         <p class="stage-note">이 작품은 사이트 주소가 등록되지 않았습니다.</p>`;

    const links = `<div class="detail-links">
           ${siteUrl ? `<a class="btn-accent" href="${escapeHtml(siteUrl)}" target="_blank" rel="noopener noreferrer">사이트 새 창에서 보기 ↗</a>` : ""}
           ${githubUrl ? `<a class="btn-ghost btn-dark" href="${escapeHtml(githubUrl)}" target="_blank" rel="noopener noreferrer">GitHub 코드 보기 ↗</a>` : ""}
           <button class="btn-ghost btn-dark detail-edit-btn" id="open-edit" type="button">✎ 수정 / 삭제</button>
         </div>`;

    state.currentSiteUrl = siteUrl;
    state.currentTitle = w.title;

    panel.innerHTML = `
      <div class="detail-panel-inner">
        <div class="detail-grid">
          <div class="detail-media">
            ${stage}
            <div class="detail-caption">
              <h2 class="detail-title" id="detail-title">${escapeHtml(w.title)}</h2>
              <p class="detail-byline">${escapeHtml(w.creator_name)} · ${escapeHtml(w.exhibition_year)}년 · ${escapeHtml(w.grade)} · ${escapeHtml(w.category)}</p>
            </div>
            ${w.description ? `<p class="detail-desc">${escapeHtml(w.description)}</p>` : ""}
            ${links}
          </div>
          <div class="detail-meta">
            <div class="reviews-head">
              <h3 class="reviews-title">작품평</h3>
              <div class="rating-summary" id="rating-summary"></div>
            </div>
            <form class="review-form" id="review-form" novalidate>
              <div class="review-form-row">
                <div class="field rate-field">
                  <span class="field-label">별점 <em>*</em></span>
                  <div class="rate-input" id="rate-input" role="radiogroup" aria-label="별점 선택">
                    ${[1,2,3,4,5].map((n) => `<button type="button" data-v="${n}" role="radio" aria-checked="false" aria-label="${n}점">★</button>`).join("")}
                  </div>
                </div>
                <div class="field">
                  <span class="field-label">이름</span>
                  <input name="reviewer_name" type="text" maxlength="40" placeholder="익명도 가능해요" />
                </div>
              </div>
              <div class="field">
                <span class="field-label">평가</span>
                <textarea name="comment" rows="3" maxlength="400" placeholder="이 작품은 어땠나요? 솔직한 평가를 남겨 주세요."></textarea>
              </div>
              <div style="display:flex;justify-content:flex-end;gap:10px;align-items:center">
                <span class="form-status" id="review-status" aria-live="polite"></span>
                <button type="submit" class="btn-accent" id="review-send">평가 남기기</button>
              </div>
            </form>
            <div class="review-list-head">모든 평가</div>
            <div class="review-list" id="review-list"></div>
          </div>
        </div>
      </div>`;

    const playBtn = $("#preview-play");
    if (playBtn) {
      playBtn.addEventListener("click", () => {
        if (state.previewLoaded) return;
        state.previewLoaded = true;
        const content = $("#stage-content");
        if (content) {
          content.innerHTML = `<iframe src="${escapeHtml(siteUrl)}" title="${escapeHtml(w.title)} 사이트 미리보기" loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups allow-forms"></iframe>`;
        }
      });
    }

    const fsBtn = $("#open-fullscreen");
    if (fsBtn) {
      fsBtn.addEventListener("click", () => openFullscreen(siteUrl, w.title));
    }

    const editBtn = $("#open-edit");
    if (editBtn) {
      editBtn.addEventListener("click", () => openPasswordPrompt(w));
    }

    state.reviewRating = 0;
    $$("#rate-input button").forEach((b) => {
      b.addEventListener("click", () => {
        state.reviewRating = Number(b.dataset.v);
        $$("#rate-input button").forEach((x) => {
          const on = Number(x.dataset.v) <= state.reviewRating;
          x.classList.toggle("on", on);
          x.setAttribute("aria-checked", String(Number(x.dataset.v) === state.reviewRating));
        });
      });
    });

    $("#review-form").addEventListener("submit", submitReview);
    renderReviews(w.id);
  }

  function renderReviews(workId) {
    const { count, avg, list } = reviewStatsFor(workId);
    const summary = $("#rating-summary");
    if (summary) {
      summary.innerHTML = count
        ? `${starsHtml(Math.round(avg))} <span class="rating-big">${avg.toFixed(1)}</span> <span>· ${count}명</span>`
        : `<span style="color:var(--muted-2)">아직 평가가 없어요</span>`;
    }
    const wrap = $("#review-list");
    if (!wrap) return;
    if (!count) {
      wrap.innerHTML = `<p class="review-empty">첫 평가를 남겨 작가에게 응원을 전해 주세요.</p>`;
      return;
    }
    wrap.innerHTML = list.map((r) => `
      <div class="review-item">
        <div class="review-top">
          <span class="review-name">${escapeHtml(r.reviewer_name || "익명")}</span>
          <span class="review-date">${starsHtml(r.rating)} ${fmtDate(r.created_at)}</span>
        </div>
        ${r.comment ? `<p class="review-text">${escapeHtml(r.comment)}</p>` : ""}
      </div>`).join("");
  }

  async function submitReview(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const reviewer_name = String(fd.get("reviewer_name") || "").trim() || "익명";
    const comment = String(fd.get("comment") || "").trim();
    const rating = state.reviewRating;
    const status = $("#review-status");
    const sendBtn = $("#review-send");

    if (!rating) {
      if (status) { status.textContent = "별점을 선택해 주세요."; status.className = "form-status is-error"; }
      return;
    }

    sendBtn.disabled = true;
    if (status) { status.textContent = "등록 중…"; status.className = "form-status"; }

    try {
      await api(`/api/works/${state.selectedWorkId}/reviews`, {
        method: "POST",
        body: JSON.stringify({ reviewer_name, rating, comment: comment || null }),
      });
      form.reset();
      state.reviewRating = 0;
      $$("#rate-input button").forEach((x) => { x.classList.remove("on"); x.setAttribute("aria-checked", "false"); });
      if (status) { status.textContent = "평가가 등록되었습니다. 감사합니다!"; status.className = "form-status is-success"; }
      showToast("평가가 등록되었습니다.");
      // 평가 다시 로드
      const { reviews } = await api(`/api/works/${state.selectedWorkId}/reviews`);
      if (!state.reviewsByWork) state.reviewsByWork = {};
      state.reviewsByWork[state.selectedWorkId] = reviews || [];
      renderReviews(state.selectedWorkId);
      renderStats();
    } catch (err) {
      console.error(err);
      if (status) { status.textContent = err.message || "등록에 실패했습니다."; status.className = "form-status is-error"; }
    } finally {
      sendBtn.disabled = false;
    }
  }

  // ===== 작품 등록 =====
  function initYearSelect() {
    const sel = $("#year-select");
    if (!sel) return;
    const now = new Date().getFullYear();
    const years = [now, now - 1, now - 2, now + 1];
    sel.innerHTML = `<option value="" selected>선택</option>` +
      years.map((y) => `<option value="${y}">${y}년</option>`).join("");
  }

  function openSubmit() { openOverlay($("#submit-overlay")); }

  async function submitWork(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const data = {
      title: String(fd.get("title") || "").trim(),
      creator_name: String(fd.get("creator_name") || "").trim(),
      description: String(fd.get("description") || "").trim() || null,
      site_url: String(fd.get("site_url") || "").trim() || null,
      github_url: String(fd.get("github_url") || "").trim() || null,
      exhibition_year: Number(fd.get("exhibition_year")) || null,
      grade: String(fd.get("grade") || "").trim(),
      category: String(fd.get("category") || "").trim(),
      thumbnail_url: String(fd.get("thumbnail_url") || "").trim() || null,
      password: String(fd.get("password") || "").trim(),
    };

    const status = $("#submit-status");
    const sendBtn = $("#submit-send");

    if (!data.title || !data.creator_name || !data.exhibition_year || !data.grade || !data.category || !data.password) {
      if (status) { status.textContent = "필수 항목(제목, 제작자, 연도, 학년, 구분, 비밀번호)을 채워 주세요."; status.className = "form-status is-error"; }
      return;
    }

    sendBtn.disabled = true;
    if (status) { status.textContent = "등록 중…"; status.className = "form-status"; }

    try {
      await api("/api/works", { method: "POST", body: JSON.stringify(data) });
      form.reset();
      if (status) { status.textContent = ""; status.className = "form-status"; }
      showToast("작품이 전시에 등록되었습니다.");
      closeOverlay($("#submit-overlay"));
      await loadWorks();
      await loadReviewStatsForAll();
    } catch (err) {
      console.error(err);
      const msg = err.data?.details?.join(", ") || err.message || "등록에 실패했습니다.";
      if (status) { status.textContent = msg; status.className = "form-status is-error"; }
    } finally {
      sendBtn.disabled = false;
    }
  }

  // ===== 작품 수정/삭제 (비밀번호 확인 → 백엔드 검증) =====
  function openPasswordPrompt(work) {
    state.editingWorkId = work.id;
    const overlay = $("#pw-overlay");
    $("#pw-title").textContent = "비밀번호 확인";
    const sub = overlay.querySelector(".form-sub");
    if (sub) sub.textContent = "작품을 수정하려면 등록할 때 설정한 비밀번호를 입력해 주세요.";
    const form = $("#pw-form");
    if (form) form.style.display = "";
    const actions = overlay.querySelector(".form-actions");
    if (actions) actions.innerHTML = '<button type="button" class="btn-ghost" id="pw-cancel">취소</button><button type="submit" class="btn-accent btn-lg" id="pw-submit">확인</button>';
    $("#pw-status").textContent = "";
    $("#pw-status").className = "form-status";
    form.reset();
    openOverlay(overlay);
    setTimeout(() => $("#pw-input").focus(), 30);

    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    newForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = String(new FormData(newForm).get("password") || "").trim();
      if (!input) {
        const st = $("#pw-status");
        st.textContent = "비밀번호를 입력해 주세요.";
        st.className = "form-status is-error";
        return;
      }
      // 비밀번호를 백엔드에서 검증하는 대신, 수정 폼으로 바로 이동하고
      // 저장/삭제 시 백엔드에서 최종 검증 (비밀번호는 수정 폼에 보관)
      state.pendingPassword = input;
      closeOverlay(overlay);
      openEditForm(work, input);
    });
    const cancelBtn = $("#pw-cancel");
    if (cancelBtn) cancelBtn.addEventListener("click", () => closeOverlay(overlay));
  }

  function openEditForm(work, password) {
    const overlay = $("#edit-overlay");
    const form = $("#edit-form");
    $("#edit-status").textContent = "";
    $("#edit-status").className = "form-status";

    const yearSel = $("#edit-year-select");
    if (yearSel) {
      const now = new Date().getFullYear();
      const years = [now, now - 1, now - 2, now + 1];
      yearSel.innerHTML = years.map((y) => `<option value="${y}">${y}년</option>`).join("");
    }

    openOverlay(overlay);

    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    newForm.title.value = work.title || "";
    newForm.creator_name.value = work.creator_name || "";
    newForm.description.value = work.description || "";
    newForm.site_url.value = work.site_url || "";
    newForm.github_url.value = work.github_url || "";
    newForm.exhibition_year.value = String(work.exhibition_year || "");
    newForm.grade.value = work.grade || "";
    newForm.category.value = work.category || "";
    newForm.thumbnail_url.value = work.thumbnail_url || "";

    newForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(newForm);
      const data = {
        title: String(fd.get("title") || "").trim(),
        creator_name: String(fd.get("creator_name") || "").trim(),
        description: String(fd.get("description") || "").trim() || null,
        site_url: String(fd.get("site_url") || "").trim() || null,
        github_url: String(fd.get("github_url") || "").trim() || null,
        exhibition_year: Number(fd.get("exhibition_year")) || null,
        grade: String(fd.get("grade") || "").trim(),
        category: String(fd.get("category") || "").trim(),
        thumbnail_url: String(fd.get("thumbnail_url") || "").trim() || null,
        password,
      };

      const status = $("#edit-status");
      const saveBtn = $("#edit-save");

      if (!data.title || !data.creator_name || !data.exhibition_year || !data.grade || !data.category) {
        if (status) { status.textContent = "필수 항목을 모두 채워 주세요."; status.className = "form-status is-error"; }
        return;
      }
      saveBtn.disabled = true;
      if (status) { status.textContent = "저장 중…"; status.className = "form-status"; }

      try {
        await api(`/api/works/${work.id}`, { method: "PUT", body: JSON.stringify(data) });
        if (status) { status.textContent = ""; status.className = "form-status"; }
        showToast("작품이 수정되었습니다.");
        closeOverlay(overlay);
        await loadWorks();
        await loadReviewStatsForAll();
        const updated = state.works.find((w) => w.id === work.id);
        if (updated) openDetail(updated.id);
      } catch (err) {
        console.error(err);
        const msg = err.data?.details?.join(", ") || err.message || "수정에 실패했습니다.";
        if (status) { status.textContent = msg; status.className = "form-status is-error"; }
      } finally {
        saveBtn.disabled = false;
      }
    });

    const delBtn = $("#edit-delete");
    if (delBtn) {
      const newDel = delBtn.cloneNode(true);
      delBtn.parentNode.replaceChild(newDel, delBtn);
      newDel.addEventListener("click", async () => {
        if (!confirm("정말 이 작품을 삭제하시겠어요? 삭제하면 되돌릴 수 없습니다.")) return;
        newDel.disabled = true;
        const status = $("#edit-status");
        if (status) { status.textContent = "삭제 중…"; status.className = "form-status"; }
        try {
          await api(`/api/works/${work.id}`, {
            method: "DELETE",
            body: JSON.stringify({ password }),
          });
          showToast("작품이 삭제되었습니다.");
          closeOverlay(overlay);
          state.selectedWorkId = null;
          $("#detail-panel").innerHTML = `
            <div class="detail-empty" id="detail-empty">
              <div class="detail-empty-icon" aria-hidden="true">←</div>
              <p class="detail-empty-text">작품을 선택하면<br>여기에서 바로 볼 수 있어요.</p>
            </div>`;
          await loadWorks();
          await loadReviewStatsForAll();
          renderStats();
        } catch (err) {
          console.error(err);
          const msg = err.message || "삭제에 실패했습니다.";
          if (status) { status.textContent = msg; status.className = "form-status is-error"; }
        } finally {
          newDel.disabled = false;
        }
      });
    }
  }

  // ===== 오버레이 제어 =====
  let lastFocused = null;

  function openOverlay(overlay) {
    lastFocused = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    const focusable = overlay.querySelector("button, a, input, select, textarea");
    if (focusable) setTimeout(() => focusable.focus(), 30);
  }

  function closeOverlay(overlay) {
    overlay.hidden = true;
    document.body.style.overflow = "";
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  // ===== 전체 화면 사이트 미리보기 =====
  function openFullscreen(siteUrl, title) {
    if (!siteUrl) return;
    const fs = $("#stage-fullscreen");
    $("#stage-fullscreen-title").textContent = title || "사이트 미리보기";
    const openLink = $("#stage-fullscreen-open");
    if (openLink) openLink.href = siteUrl;
    const frame = $("#stage-fullscreen-frame");
    frame.innerHTML = `<iframe src="${escapeHtml(siteUrl)}" title="${escapeHtml(title || "")} 전체 화면 미리보기" loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups allow-forms"></iframe>`;
    fs.hidden = false;
    document.body.style.overflow = "hidden";
    const closeBtn = $("#stage-fullscreen-close");
    if (closeBtn) setTimeout(() => closeBtn.focus(), 30);
  }

  function closeFullscreen() {
    const fs = $("#stage-fullscreen");
    fs.hidden = true;
    const frame = $("#stage-fullscreen-frame");
    if (frame) frame.innerHTML = "";
    document.body.style.overflow = "";
  }

  function initOverlays() {
    const submit = $("#submit-overlay");
    $("#submit-close").addEventListener("click", () => closeOverlay(submit));
    $("#submit-cancel").addEventListener("click", () => closeOverlay(submit));
    submit.addEventListener("click", (e) => { if (e.target === submit) closeOverlay(submit); });

    const pw = $("#pw-overlay");
    $("#pw-close").addEventListener("click", () => closeOverlay(pw));
    $("#pw-cancel")?.addEventListener("click", () => closeOverlay(pw));
    pw.addEventListener("click", (e) => { if (e.target === pw) closeOverlay(pw); });

    const edit = $("#edit-overlay");
    $("#edit-close").addEventListener("click", () => closeOverlay(edit));
    $("#edit-cancel").addEventListener("click", () => closeOverlay(edit));
    edit.addEventListener("click", (e) => { if (e.target === edit) closeOverlay(edit); });

    const fs = $("#stage-fullscreen");
    $("#stage-fullscreen-close").addEventListener("click", closeFullscreen);
    fs.addEventListener("click", (e) => { if (e.target === fs) closeFullscreen(); });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!fs.hidden) { closeFullscreen(); return; }
      if (!edit.hidden) { closeOverlay(edit); return; }
      if (!pw.hidden) { closeOverlay(pw); return; }
      if (!submit.hidden) closeOverlay(submit);
    });
    $("#open-submit").addEventListener("click", openSubmit);
    $("#open-submit-hero").addEventListener("click", openSubmit);
    $("#submit-form").addEventListener("submit", submitWork);
  }

  // ===== 시작 =====
  async function init() {
    initYearSelect();
    initOverlays();
    await loadWorks();
    await loadReviewStatsForAll();
    renderStats();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
