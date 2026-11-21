(() => {
  const SUPABASE_URL = "https://sksvygodhnlcrznfuklr.supabase.co";
  const SUPABASE_KEY = "sb_publishable_ByyXSG9SvnbdtNwCQuLTTg_SobTQOUt";
  const FESTIVAL_START = new Date("2026-05-16T11:00:00+09:00");
  const FESTIVAL_END = new Date("2026-05-17T21:00:00+09:00");

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function initMenu() {
    const toggle = document.querySelector(".menu-toggle");
    const nav = document.querySelector(".site-nav");
    if (!toggle || !nav) return;

    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        if (nav.classList.contains("open")) {
          nav.classList.remove("open");
          toggle.setAttribute("aria-expanded", "false");
          toggle.setAttribute("aria-label", "메뉴 열기");
        }
      });
    });
  }

  function initCountdown() {
    const labelEl = document.getElementById("countdown-label");
    const valueEl = document.getElementById("countdown-value");
    if (!labelEl || !valueEl) return;

    function pad(n) { return String(n).padStart(2, "0"); }

    function render() {
      const now = new Date();
      if (now < FESTIVAL_START) {
        const diff = FESTIVAL_START - now;
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        labelEl.textContent = "축제 시작까지";
        valueEl.textContent = `${days}일 ${pad(hours)}:${pad(mins)}:${pad(secs)}`;
      } else if (now >= FESTIVAL_START && now <= FESTIVAL_END) {
        const diff = FESTIVAL_END - now;
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        labelEl.textContent = "지금 축제가 진행 중입니다";
        valueEl.textContent = `종료까지 ${pad(hours)}:${pad(mins)}:${pad(secs)}`;
      } else {
        labelEl.textContent = "2026 봄빛 문화 축제";
        valueEl.textContent = "행사가 종료되었습니다";
      }
    }

    render();
    setInterval(render, 1000);
  }

  function initPrograms() {
    const cards = Array.from(document.querySelectorAll(".card[data-program-index]"));
    if (!cards.length) return;

    let programs = [];

    function renderCounts() {
      cards.forEach((card) => {
        const idx = Number(card.dataset.programIndex);
        const program = programs[idx];
        const el = card.querySelector(".count-value");
        if (program && el) el.textContent = String(program.click_count ?? 0);
      });
      updatePopular();
    }

    function updatePopular() {
      const max = Math.max(0, ...programs.map((p) => Number(p.click_count) || 0));
      cards.forEach((card) => {
        const idx = Number(card.dataset.programIndex);
        const program = programs[idx];
        const isPopular = !!program && max > 0 && Number(program.click_count) === max;
        card.classList.toggle("is-popular", isPopular);
      });
    }

    async function loadPrograms() {
      const { data, error } = await sb
        .from("programs")
        .select("id,title,click_count,sort_order")
        .eq("is_published", true)
        .order("sort_order", { ascending: true });
      if (error) {
        console.error(error);
        return;
      }
      programs = data || [];
      renderCounts();
    }

    async function incrementClick(card) {
      const idx = Number(card.dataset.programIndex);
      const program = programs[idx];
      if (!program) return;
      const { data, error } = await sb.rpc("increment_program_click", { p_program_id: program.id });
      if (error) {
        console.error(error);
        showToast("클릭 저장에 실패했습니다.");
        return;
      }
      if (typeof data === "number") program.click_count = data;
      renderCounts();
    }

    cards.forEach((card) => {
      card.addEventListener("click", () => incrementClick(card));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          incrementClick(card);
        }
      });
    });

    sb.channel("programs-live")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "programs" }, (payload) => {
        const next = payload.new;
        if (!next || !next.id) return;
        const target = programs.find((p) => p.id === next.id);
        if (target) {
          target.click_count = next.click_count;
          renderCounts();
        }
      })
      .subscribe();

    loadPrograms();
  }

  function initGallery() {
    const grid = document.getElementById("gallery-grid");
    const input = document.getElementById("gallery-file");
    const status = document.getElementById("gallery-status");
    if (!grid || !input) return;

    function setStatus(msg) { if (status) status.textContent = msg || ""; }

    function renderEmpty() {
      if (!grid.querySelector(".gallery-item")) {
        grid.innerHTML = '<p class="gallery-empty" id="gallery-empty">아직 업로드된 이미지가 없습니다.</p>';
      }
    }

    function prependImage(url, name) {
      const empty = grid.querySelector(".gallery-empty");
      if (empty) empty.remove();
      const figure = document.createElement("figure");
      figure.className = "gallery-item";
      const img = document.createElement("img");
      img.src = url;
      img.alt = name || "축제 갤러리 이미지";
      img.loading = "lazy";
      figure.appendChild(img);
      grid.prepend(figure);
    }

    async function loadGallery() {
      const { data, error } = await sb
        .from("gallery_images")
        .select("file_path,file_name,created_at")
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) {
        console.error(error);
        return;
      }
      grid.innerHTML = "";
      if (!data || !data.length) {
        renderEmpty();
        return;
      }
      data.forEach((item) => {
        const { data: pub } = sb.storage.from("festival-gallery").getPublicUrl(item.file_path);
        prependImage(pub.publicUrl, item.file_name);
      });
      // prependImage prepended in reverse? We iterated desc order and prepended each, resulting in reversed. Fix by appending instead.
    }

    async function loadGalleryFixed() {
      const { data, error } = await sb
        .from("gallery_images")
        .select("file_path,file_name,created_at")
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) { console.error(error); return; }
      grid.innerHTML = "";
      if (!data || !data.length) { renderEmpty(); return; }
      data.forEach((item) => {
        const { data: pub } = sb.storage.from("festival-gallery").getPublicUrl(item.file_path);
        const figure = document.createElement("figure");
        figure.className = "gallery-item";
        const img = document.createElement("img");
        img.src = pub.publicUrl;
        img.alt = item.file_name || "축제 갤러리 이미지";
        img.loading = "lazy";
        figure.appendChild(img);
        grid.appendChild(figure);
      });
    }

    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        showToast("이미지 파일만 업로드할 수 있습니다.");
        input.value = "";
        return;
      }
      setStatus("업로드 중...");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await sb.storage.from("festival-gallery").upload(path, file, { upsert: false });
      if (uploadError) {
        console.error(uploadError);
        setStatus("");
        showToast("이미지 업로드에 실패했습니다.");
        input.value = "";
        return;
      }

      const { error: insertError } = await sb.from("gallery_images").insert({ file_path: path, file_name: file.name });
      if (insertError) {
        console.error(insertError);
        setStatus("");
        showToast("갤러리 저장에 실패했습니다.");
        input.value = "";
        return;
      }

      const { data: pub } = sb.storage.from("festival-gallery").getPublicUrl(path);
      const empty = grid.querySelector(".gallery-empty");
      if (empty) empty.remove();
      const figure = document.createElement("figure");
      figure.className = "gallery-item";
      const img = document.createElement("img");
      img.src = pub.publicUrl;
      img.alt = file.name || "축제 갤러리 이미지";
      img.loading = "lazy";
      figure.appendChild(img);
      grid.prepend(figure);

      setStatus("");
      showToast("이미지가 갤러리에 업로드되었습니다.");
      input.value = "";
    });

    loadGalleryFixed();
  }

  function initMap() {
    const el = document.getElementById("map");
    if (!el || !window.L) return;
    const lat = 37.5286;
    const lng = 126.933;
    const map = L.map(el, { scrollWheelZoom: false }).setView([lat, lng], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    L.marker([lat, lng]).addTo(map).bindPopup("2026 봄빛 문화 축제<br>여의도 한강공원 잔디마당").openPopup();
  }

  function initAccordion() {
    document.querySelectorAll(".accordion-trigger").forEach((btn) => {
      btn.addEventListener("click", () => {
        const expanded = btn.getAttribute("aria-expanded") === "true";
        const panel = btn.parentElement.querySelector(".accordion-panel");
        const icon = btn.querySelector(".accordion-icon");
        btn.setAttribute("aria-expanded", String(!expanded));
        if (panel) panel.hidden = expanded;
        if (icon) icon.textContent = expanded ? "+" : "−";
      });
    });
  }

  function initContactForm() {
    const form = document.getElementById("contact-form");
    const status = document.getElementById("contact-status");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = String(fd.get("name") || "").trim();
      const email = String(fd.get("email") || "").trim();
      const message = String(fd.get("message") || "").trim();

      if (!name || !email || !message) {
        if (status) { status.textContent = "모든 항목을 입력해 주세요."; status.className = "form-status is-error"; }
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (status) { status.textContent = "이메일 형식을 확인해 주세요."; status.className = "form-status is-error"; }
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      if (status) { status.textContent = "전송 중..."; status.className = "form-status"; }

      const { error } = await sb.from("contact_messages").insert({ name, email, message });
      if (submitBtn) submitBtn.disabled = false;

      if (error) {
        console.error(error);
        if (status) { status.textContent = "문의 전송에 실패했습니다. 잠시 후 다시 시도해 주세요."; status.className = "form-status is-error"; }
        return;
      }

      form.reset();
      if (status) { status.textContent = "문의가 접수되었습니다. 감사합니다."; status.className = "form-status is-success"; }
      showToast("문의가 성공적으로 접수되었습니다.");
    });
  }

  initMenu();
  initCountdown();
  initPrograms();
  initGallery();
  initMap();
  initAccordion();
  initContactForm();
})();