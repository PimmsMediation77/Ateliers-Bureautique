(() => {
const SVG_NS = "http://www.w3.org/2000/svg";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Typographie française : espace insécable avant « : » et à l'intérieur des
// guillemets « ». Seuls les « : » suivis d'un espace (ou en fin de texte) sont
// concernés, pour ne pas toucher aux URL, heures (15:30) ni plages Excel (A1:B5).
function frenchTypography(value) {
  return String(value || "")
    .replace(/[ \u00a0\u202f]*:(?=\s|$)/g, "\u00a0:")
    .replace(/«[ \u00a0]*/g, "«\u00a0")
    .replace(/[ \u00a0]*»/g, "\u00a0»");
}

function shortDate(isoDay) {
  const parts = String(isoDay || "").split("-");
  if (parts.length !== 3) return "";
  return `${parts[2]}/${parts[1]}`;
}

function shortDateTime(value) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  const day = String(dt.getDate()).padStart(2, "0");
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const hours = String(dt.getHours()).padStart(2, "0");
  const minutes = String(dt.getMinutes()).padStart(2, "0");
  return `${day}/${month} ${hours}:${minutes}`;
}

// Repart directement sur la constante des couleurs sans la ligne fantôme
const THEME_COLORS = [
  { accent: "#2e6f76", soft: "#e8f3f5", track: "#d2e6ea" },
  { accent: "#8b6b4a", soft: "#f4eee6", track: "#e7d9c6" },
  { accent: "#3f7a52", soft: "#eaf4ed", track: "#d4e6db" },
  { accent: "#5f6f97", soft: "#eceff8", track: "#d7deee" },
  { accent: "#9a5f63", soft: "#f7ecec", track: "#ebd5d7" },
  { accent: "#5b7b45", soft: "#eef5e9", track: "#dce9d1" },
];

function hashText(value) {
  const text = String(value || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getThemeColors(themeKey) {
  const index = hashText(themeKey) % THEME_COLORS.length;
  return THEME_COLORS[index];
}

// Pour les thèmes longs, n'affiche qu'une fenêtre autour de l'exercice en cours,
// avec un « … » de chaque côté quand des exercices sont masqués.
function pickTrailWindow(steps, maxVisible = 10) {
  if (steps.length <= maxVisible) return steps;
  let anchor = steps.findIndex((step) => step.current);
  if (anchor < 0) anchor = steps.length - 1;
  const span = maxVisible - 2;
  const end = Math.min(steps.length, Math.max(0, anchor - Math.floor(span / 2)) + span);
  const start = Math.max(0, end - span);
  const visible = steps.slice(start, end);
  if (start > 0) visible.unshift({ gap: true });
  if (end < steps.length) visible.push({ gap: true });
  return visible;
}

// « 18 exercices terminés sur 42 · 🔥 3 jours d'affilée » (série masquée si nulle).
function formatProgressLine(vm) {
  const doneLabel = vm.completed > 1 ? "exercices terminés" : "exercice terminé";
  const parts = [`${vm.completed} ${doneLabel} sur ${vm.total}`];
  if (vm.streak > 0) parts.push(`🔥 ${vm.streak} ${vm.streak > 1 ? "jours" : "jour"} d'affilée`);
  return parts.join(" · ");
}

// Anneau de progression : le cercle « pathLength=100 » permet d'exprimer
// directement le pourcentage dans stroke-dasharray.
function renderProgressRing(percent) {
  const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const arc = value > 0
    ? `<circle class="progress-ring-value" cx="60" cy="60" r="52" pathLength="100" stroke-dasharray="${value} 100"></circle>`
    : "";
  return `
    <svg class="progress-ring-svg" viewBox="0 0 120 120" aria-hidden="true">
      <circle class="progress-ring-track" cx="60" cy="60" r="52" pathLength="100"></circle>
      ${arc}
    </svg>
    <span class="progress-ring-label" role="img" aria-label="${value} % des exercices terminés">
      <strong>${value} %</strong><small>terminé</small>
    </span>`;
}

// Échelle des paliers : paliers atteints pleins, palier actuel mis en avant.
function renderLevelScale(levels, currentLabel) {
  const list = Array.isArray(levels) ? levels : [];
  const currentIndex = list.findIndex((level) => level.label === currentLabel);
  return list
    .map((level, index) => {
      const classes = ["level-step"];
      if (index <= currentIndex) classes.push("is-reached");
      if (index === currentIndex) classes.push("is-current");
      const current = index === currentIndex ? ' aria-current="step"' : "";
      return `<li class="${classes.join(" ")}"${current}>${escapeHtml(level.label)}</li>`;
    })
    .join("");
}

function getThemeStateLabel(percent) {
  if (percent >= 100) return "Terminé";
  if (percent > 0) return "En cours";
  return "À démarrer";
}

class AtelierView {
  constructor() {
    this.navButtons = Array.from(document.querySelectorAll(".nav-btn"));
    this.pages = {
      home: document.getElementById("page-home"),
      themes: document.getElementById("page-themes"),
      affinity: document.getElementById("page-affinity"),
      exercise: document.getElementById("page-exercise"),
      progress: document.getElementById("page-progress"),
      profile: document.getElementById("page-profile"),
    };

    this.homeKicker = document.getElementById("home-kicker");
    this.homeTrailWrap = document.getElementById("home-trail-wrap");
    this.homeThemeName = document.getElementById("home-theme-name");
    this.homeThemePosition = document.getElementById("home-theme-position");
    this.homeTrail = document.getElementById("home-trail");
    this.homeExerciseLabel = document.getElementById("home-exercise-label");
    this.homeExerciseHeadline = document.getElementById("home-exercise-headline");
    this.homeStartBtn = document.getElementById("home-start-btn");
    this.homeOtherLink = document.getElementById("home-other-link");
    this.homeProgressLine = document.getElementById("home-progress-line");
    this.homeProgressRing = document.getElementById("home-progress-ring");
    this.homeProgressLevel = document.getElementById("home-progress-level");
    this.homeLevelScale = document.getElementById("home-level-scale");

    this.themesAffinityList = document.getElementById("themes-affinity-list");
    this.affinityTitle = document.getElementById("affinity-title");
    this.affinitySubtitle = document.getElementById("affinity-subtitle");
    this.affinityThemeList = document.getElementById("affinity-theme-list");

    this.exerciseStatusPill = document.getElementById("exercise-status-pill");
    this.exerciseTitle = document.getElementById("exercise-title");
    this.exerciseThemeLine = document.getElementById("exercise-theme-line");
    this.exerciseDescription = document.getElementById("exercise-description");
    this.exercisePreambleWrap = document.getElementById("exercise-preamble-wrap");
    this.exerciseInstructionsWrap = document.getElementById("exercise-instructions-wrap");
    this.exerciseCriteriaWrap = document.getElementById("exercise-criteria-wrap");
    this.exerciseSteps = document.getElementById("exercise-steps");
    this.exerciseStepsPreamble = document.getElementById("exercise-steps-preamble");
    this.exerciseStepsTabs = document.getElementById("exercise-steps-tabs");
    this.exerciseCriteria = document.getElementById("exercise-criteria");
    this.exerciseWorkFileBtn = document.getElementById("exercise-workfile-btn")
      || document.getElementById("exercise-docx-btn");
    this.exerciseDocxBtn = this.exerciseWorkFileBtn;
    this.exerciseDownloadBtn = document.getElementById("exercise-download-btn");
    this.exerciseFilesActions = this.exerciseWorkFileBtn ? this.exerciseWorkFileBtn.parentElement : null;
    this.exercisePickWorkFileBtn = document.getElementById("exercise-pick-workfile-btn");
    this.exerciseOpenWorkFileBtn = document.getElementById("exercise-open-workfile-btn");
    this.exerciseWorkFileStatus = document.getElementById("exercise-workfile-status");
    this.exerciseImagesGrid = document.querySelector("#page-exercise .images-grid");
    this.exerciseEnonceCaption = document.getElementById("exercise-enonce-caption");
    this.exerciseResultCaption = document.getElementById("exercise-result-caption");
    this.exerciseEnonceImages = document.getElementById("exercise-enonce-images");
    this.exerciseResultImages = document.getElementById("exercise-result-images");
    this.exerciseExtraWrap = document.getElementById("exercise-extra-wrap");
    this.exerciseExtraImages = document.getElementById("exercise-extra-images");
    this.exercisePrevBtn = document.getElementById("exercise-prev-btn");
    this.exerciseNextBtn = document.getElementById("exercise-next-btn");
    this.exerciseToggleDoneBtn = document.getElementById("exercise-toggle-done-btn");
    this.exerciseBreadcrumb = document.getElementById("exercise-breadcrumb");
    this.exerciseThemeProgress = document.getElementById("exercise-theme-progress");
    this.exerciseThemeProgressBar = document.getElementById("exercise-theme-progress-bar");
    this.exerciseSaveNudge = document.getElementById("exercise-save-nudge");
    this.activeExerciseTabIndex = 0;
    this.currentExerciseVm = null;

    this.progressCompleted = document.getElementById("progress-stat-completed");
    this.progressRate = document.getElementById("progress-stat-rate");
    this.progressStreak = document.getElementById("progress-stat-streak");
    this.progressLevel = document.getElementById("progress-stat-level");
    this.progressCurve = document.getElementById("progress-curve");
    this.progressRing = document.getElementById("progress-ring");
    this.progressLevelScale = document.getElementById("progress-level-scale");
    this.progressThemeList = document.getElementById("progress-theme-list");
    this.completionToast = null;
    this.completionToastTimer = null;
    this.progressUserPath = document.getElementById("progress-user-path");
    this.progressStatus = document.getElementById("progress-file-status");
    this.runtimeStatus = document.getElementById("runtime-status");
    this.progressUsabilitySummary = document.getElementById("progress-usability-summary");
    this.progressUsabilityList = document.getElementById("progress-usability-list");
    this.headerUserBadge = document.getElementById("header-user-badge");
    this.headerUserName = this.headerUserBadge ? this.headerUserBadge.querySelector(".header-user-name") : null;
    this.headerRuntimeStatus = document.getElementById("header-runtime-status");

    // Visionneuse d'images : panneau sur toute la fenêtre de l'appli (pensé pour l'écran partagé appli | Word),
    // avec zoom à l'endroit cliqué et possibilité de « détacher » l'image dans une fenêtre flottante
    // (Document Picture-in-Picture, Chrome 116+) qui reste au-dessus de Word.
    this.imageModal = document.getElementById("image-modal");
    this.imageModalImg = document.getElementById("image-modal-img");
    this.imageModalStage = document.getElementById("image-modal-stage");
    this.imageModalClose = document.getElementById("image-modal-close");
    this.imageModalDetach = document.getElementById("image-modal-detach");
    this.imageModalTabs = document.getElementById("image-modal-tabs");
    this.imageModalPrev = document.getElementById("image-modal-prev");
    this.imageModalNext = document.getElementById("image-modal-next");
    this.imageModalCaption = document.getElementById("image-modal-caption");
    this.imageModalCounter = document.getElementById("image-modal-counter");
    this.imageModalHint = document.getElementById("image-modal-hint");
    this.imageModalToolbar = document.getElementById("image-modal-toolbar");
    this.imageModalZoomLabel = document.getElementById("image-modal-zoom");
    this.imageModalStep = document.getElementById("image-modal-step");
    this.imageModalStepText = document.getElementById("image-modal-step-text");
    this.imageModalStepPrev = document.getElementById("image-modal-step-prev");
    this.imageModalStepNext = document.getElementById("image-modal-step-next");
    this.imageGalleries = {};
    this.modalGalleryKey = "";
    this.modalGalleryIndex = 0;
    this.modalStepIndex = 0;
    this.modalTrigger = null;
    this.viewerExerciseId = "";
    this.viewerZoom ={ scale: 1, x: 0, y: 0, width: 0, height: 0 };
    this.viewerPointers = new Map();
    this.viewerGesture = null;
    this.imageViewerPipWindow = null;
    this.imageModalHome = this.imageModal ? this.imageModal.parentElement : null;
    this.imageModalHomeNextSibling = this.imageModal ? this.imageModal.nextSibling : null;
    this.#bindModalEvents();

    this.helpModal = null;
    this.helpModalTrigger = null;
    if (this.exerciseSteps) {
      this.exerciseSteps.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-step-help]");
        if (!trigger) return;
        const topic = this.#findStepHelpTopicById(trigger.getAttribute("data-step-help"));
        if (topic) this.openHelpModal(topic, trigger);
      });
    }
  }

  setActiveNav(pageName) {
    for (const btn of this.navButtons) {
      btn.classList.toggle("active", btn.getAttribute("data-nav") === pageName);
    }
  }

  showPage(pageName) {
    for (const [key, section] of Object.entries(this.pages)) {
      section.classList.toggle("active", key === pageName);
    }
    const navPage = pageName === "exercise" || pageName === "affinity" ? "themes" : pageName;
    this.setActiveNav(navPage);
  }

  renderHome(vm) {
    this.homeKicker.textContent = vm.kicker || "";
    this.homeExerciseLabel.textContent = vm.exerciseLabel || "";
    this.homeExerciseLabel.hidden = !vm.exerciseLabel;
    this.homeExerciseHeadline.textContent = frenchTypography(vm.headline || "");
    this.homeStartBtn.textContent = vm.startLabel || "Commencer";
    this.homeOtherLink.hidden = vm.state === "all-done" || vm.state === "empty";

    this.homeProgressLine.textContent = frenchTypography(formatProgressLine(vm));
    if (this.homeProgressRing) this.homeProgressRing.innerHTML = renderProgressRing(vm.percent);
    if (this.homeProgressLevel) this.homeProgressLevel.textContent = vm.level || "";
    if (this.homeLevelScale) this.homeLevelScale.innerHTML = renderLevelScale(vm.levels, vm.level);

    const theme = vm.theme;
    this.homeTrailWrap.hidden = !theme;
    if (!theme) {
      this.homeTrail.innerHTML = "";
      return;
    }
    const hasCurrent = theme.steps.some((step) => step.current);
    this.homeThemeName.textContent = frenchTypography(`Thème : ${theme.name}`);
    this.homeThemePosition.textContent = hasCurrent ? `${theme.position} sur ${theme.total}` : "Thème terminé ✓";
    this.homeTrail.innerHTML = pickTrailWindow(theme.steps)
      .map((step) => {
        if (step.gap) {
          return `<li class="home-trail-item is-gap" aria-hidden="true"><span class="home-trail-dot">…</span></li>`;
        }
        const status = step.current ? "à faire maintenant" : step.done ? "terminé" : "à venir";
        const label = `Exercice ${step.num} – ${step.title} (${status})`;
        const classes = ["home-trail-item"];
        if (step.done) classes.push("is-done");
        if (step.current) classes.push("is-current");
        return `
          <li class="${classes.join(" ")}" title="${escapeHtml(label)}"${step.current ? ' aria-current="step"' : ""}>
            <span class="home-trail-dot" aria-hidden="true"></span>
            <span class="home-trail-sr">${escapeHtml(label)}</span>
            ${step.current ? '<span class="home-trail-here" aria-hidden="true"><span class="home-trail-arrow">▲</span><span class="home-trail-here-text">vous êtes ici</span></span>' : ""}
          </li>`;
      })
      .join("");
  }

  renderAffinityOverview(vm) {
    if (!vm.groups.length) {
      this.themesAffinityList.innerHTML = `<div class="empty">Aucune catégorie disponible.</div>`;
      return;
    }

    this.themesAffinityList.innerHTML = vm.groups
      .map((group) => {
        const colors = getThemeColors(group.id);
        return `
        <button class="affinity-card" type="button" data-action="open-affinity" data-affinity-id="${escapeHtml(group.id)}">
          <div class="affinity-card-visual" style="--affinity-accent:${colors.accent};--affinity-soft:${colors.soft};--affinity-progress:${group.percent || 0}%;">
            <span class="affinity-card-percent">${group.percent || 0}%</span>
          </div>
          <div class="affinity-card-content">
          <h3 class="affinity-card-title">${escapeHtml(group.label)}</h3>
          <p class="affinity-card-subtitle">${escapeHtml(group.subtitle)}</p>
          <p class="affinity-card-count">${group.completedExercises || 0}/${group.totalExercises} exercices</p>
          <p class="affinity-card-state">${getThemeStateLabel(group.percent || 0)}</p>
          <div class="affinity-mini-track" aria-hidden="true">
            <div class="affinity-mini-fill" style="width:${group.percent || 0}%"></div>
          </div>
          </div>
        </button>
      `;
      })
      .join("");
  }

  renderAffinityPage(vm) {
    this.affinityTitle.textContent = vm.affinity.label;
    this.affinitySubtitle.textContent = vm.affinity.subtitle;

    if (!vm.cards.length) {
      this.affinityThemeList.innerHTML = `<div class="empty">Aucun thème disponible.</div>`;
      return;
    }

    this.affinityThemeList.innerHTML = vm.cards
      .map(
        (card) => `
        <section class="theme-block ${card.open ? "open" : ""}">
          <button class="theme-block-header" data-action="toggle-theme" data-affinity-id="${escapeHtml(vm.affinity.id)}" data-theme-id="${escapeHtml(card.id)}" aria-expanded="${card.open ? "true" : "false"}">
            <span class="theme-block-title">${escapeHtml(card.name)}</span>
            <span class="theme-block-meta">${card.done}/${card.total} (${card.percent}%)</span>
            <span class="theme-block-arrow">${card.open ? "▾" : "▸"}</span>
          </button>
          <div class="theme-block-body">
            <div class="exercise-list">
              ${card.rows.length
            ? card.rows
              .map(
                (row) => `
                      <div
                        class="exercise-row clickable ${row.done ? "done" : ""}"
                        data-action="open-exercise"
                        data-id="${row.id}"
                        data-hover-label="${row.done ? "Refaire l'exercice" : "Lancer l'exercice"}"
                        role="button"
                        tabindex="0"
                        aria-label="Ouvrir l'exercice ${row.num} ${escapeHtml(row.title)}"
                      >
                        <div>
                          <p class="exercise-row-title">Exercice ${row.num}</p>
                          <p class="exercise-row-sub">${escapeHtml(row.title)}</p>
                        </div>
                        <div class="exercise-row-actions">
                          <button class="btn has-icon ${row.done ? "done" : ""}" data-icon="${row.done ? "\u2713" : "\u25CB"}" data-action="toggle-done" data-id="${row.id}">
                            ${row.done ? "Fait" : "\u00E0 faire"}
                          </button>
                        </div>
                      </div>
                    `,
              )
              .join("")
            : `<div class="empty">Aucun exercice dans ce thème.</div>`
          }
            </div>
          </div>
        </section>
      `,
      )
      .join("");
  }

  renderExercise(vm) {
    this.currentExerciseVm = vm;
    // Changement d'exercice : le panneau se ferme ; une fenêtre flottante reste ouverte et suit le nouvel exercice.
    const exerciseId = vm && vm.exercise ? vm.exercise.id : "";
    if (exerciseId !== this.viewerExerciseId) {
      this.viewerExerciseId = exerciseId;
      this.modalStepIndex = 0;
      this.modalGalleryIndex = 0;
    }
    if (!this.imageViewerPipWindow) this.closeImageModal();

    // Réinitialiser la section "Préparer l'exercice" immédiatement
    if (this.exerciseWorkFileStatus) this.exerciseWorkFileStatus.textContent = "";
    if (this.exerciseOpenWorkFileBtn) this.exerciseOpenWorkFileBtn.style.display = "none";
    if (this.exercisePickWorkFileBtn) this.exercisePickWorkFileBtn.style.display = "none";

    this.exerciseTitle.textContent = frenchTypography(`Exercice ${vm.exercise.num} - ${vm.exercise.title}`);
    this.exerciseThemeLine.textContent = vm.exercise.moduleName;

    // Fil d'ariane
    if (this.exerciseBreadcrumb) {
      const aff = vm.affinityLabel
        ? `<span class="breadcrumb-link" data-action="open-affinity" data-affinity-id="${escapeHtml(vm.affinityId || "")}">${escapeHtml(vm.affinityLabel)}</span><span class="breadcrumb-sep">&#10095;</span>`
        : "";
      const theme = `<span class="breadcrumb-link" data-action="toggle-theme" data-affinity-id="${escapeHtml(vm.affinityId || "")}" data-theme-id="${escapeHtml(vm.exercise.moduleId)}">${escapeHtml(vm.exercise.moduleName)}</span><span class="breadcrumb-sep">&#10095;</span>`;
      const home = `<a class="breadcrumb-link" href="#home">Accueil</a><span class="breadcrumb-sep">&#10095;</span>`;
      this.exerciseBreadcrumb.innerHTML = `${home}${aff}${theme}<span class="breadcrumb-current">Exercice ${vm.exercise.num}</span>`;
    }

    // Progression dans le thème
    if (this.exerciseThemeProgress && vm.themeTotal) {
      this.exerciseThemeProgress.textContent = `${vm.themeDone || 0} / ${vm.themeTotal} faits`;
    }
    if (this.exerciseThemeProgressBar && vm.themeTotal) {
      this.exerciseThemeProgressBar.style.width = `${Math.round(((vm.themeDone || 0) / vm.themeTotal) * 100)}%`;
    }

    this.exerciseStatusPill.textContent = vm.done ? "Fait ✓" : "À faire";
    this.exerciseStatusPill.classList.toggle("todo", !vm.done);
    this.exerciseToggleDoneBtn.setAttribute("data-id", vm.exercise.id);

    const preamble = (vm.exercise && vm.exercise.preamble) ? vm.exercise.preamble : "";
    if (this.exercisePreambleWrap) {
      this.exercisePreambleWrap.style.display = preamble ? "" : "none";
    }
    if (this.exerciseStepsPreamble) {
      this.exerciseStepsPreamble.textContent = frenchTypography(preamble);
      this.exerciseStepsPreamble.style.display = preamble ? "" : "none";
    }

    const activeTab = Array.isArray(vm.visuals.tabs) && vm.visuals.tabs.length
      ? vm.visuals.tabs[Math.max(0, Math.min(this.activeExerciseTabIndex, vm.visuals.tabs.length - 1))]
      : null;
    const effectiveSteps = activeTab && Array.isArray(activeTab.instructions) && activeTab.instructions.length
      ? activeTab.instructions
      : (vm.steps || []);
    this.activeExerciseTabIndex = activeTab && vm.visuals.tabs ? vm.visuals.tabs.indexOf(activeTab) : 0;

    if (this.exerciseDescription) {
      const description = this.#getExerciseDescription(vm.exercise, effectiveSteps);
      this.exerciseDescription.textContent = frenchTypography(description);
      this.exerciseDescription.style.display = description ? "" : "none";
    }

    this.#renderExerciseSteps(vm.exercise, effectiveSteps);

    if (this.exerciseInstructionsWrap) {
      this.exerciseInstructionsWrap.style.display = effectiveSteps.length ? "" : "none";
    }

    if (this.exerciseCriteria) {
      const criteria = Array.isArray(vm.exercise.criteria) ? vm.exercise.criteria.filter(Boolean) : [];
      this.exerciseCriteria.innerHTML = criteria.map((item) => `<li>${escapeHtml(frenchTypography(item))}</li>`).join("");
      if (this.exerciseCriteriaWrap) {
        this.exerciseCriteriaWrap.style.display = criteria.length ? "" : "none";
      }
    }

    const workFileUrl = vm.exercise.workFileUrl || vm.exercise.docxUrl || "";
    if (this.exerciseWorkFileBtn && workFileUrl) {
      this.exerciseWorkFileBtn.href = workFileUrl;
      this.exerciseWorkFileBtn.download = this.#getExerciseDownloadFileName(vm.exercise, workFileUrl, {
        typeLabel: "fichier-travail",
      });
      this.exerciseWorkFileBtn.style.display = "";
    } else if (this.exerciseWorkFileBtn) {
      this.exerciseWorkFileBtn.removeAttribute("href");
      this.exerciseWorkFileBtn.removeAttribute("download");
      this.exerciseWorkFileBtn.style.display = "none";
    }
    if (vm.exercise.downloadUrl) {
      this.exerciseDownloadBtn.href = vm.exercise.downloadUrl;
      const downloadLabel = vm.exercise.downloadLabel
        || (workFileUrl ? "Télécharger le 2ᵉ fichier" : "Télécharger le fichier");
      this.exerciseDownloadBtn.textContent = downloadLabel;
      this.exerciseDownloadBtn.download = this.#getExerciseDownloadFileName(vm.exercise, vm.exercise.downloadUrl, {
        typeLabel: vm.exercise.downloadLabel || (workFileUrl ? "fichier-annexe-2" : "fichier-annexe"),
      });
      this.exerciseDownloadBtn.style.display = "";
    } else {
      this.exerciseDownloadBtn.removeAttribute("href");
      this.exerciseDownloadBtn.removeAttribute("download");
      this.exerciseDownloadBtn.style.display = "none";
    }
    this.#renderExtraDownloadButtons(vm.exercise.extraDownloadUrls || []);

    const extraDownloads = vm.exercise.extraDownloadUrls || [];
    const hasFiles = Boolean(
      workFileUrl
      || vm.exercise.downloadUrl
      || (extraDownloads.length > 0),
    );
    const filesCard = document.getElementById("exercise-files-card");
    if (filesCard) filesCard.style.display = hasFiles ? "" : "none";

    // « Activer la modification » ne concerne que le fichier de travail (éventuellement zippé)
    // ou une annexe Office, pas des images seules (l'apprenant crée alors un document vierge).
    const officeHint = filesCard ? filesCard.querySelector("[class^='exercise-'][class$='-hint']") : null;
    if (officeHint) {
      const annexUrls = [vm.exercise.downloadUrl, ...extraDownloads.map((item) => item && item.url)];
      const hasOfficeFile = Boolean(workFileUrl)
        || annexUrls.some((url) => /\.(docx?|xlsx?|xlsm|pptx?)(\?|#|$)/i.test(url || ""));
      officeHint.style.display = hasOfficeFile ? "" : "none";
    }

    this.exerciseEnonceCaption.textContent = frenchTypography(vm.exercise.imageEnonceCaption || "Énoncé");
    this.exerciseResultCaption.textContent = frenchTypography(vm.exercise.imageResultatCaption || "Résultat attendu");

    this.#renderImageGroup(
      this.exerciseEnonceImages,
      vm.visuals.enonceImages,
      "Image énoncé",
      "Pas d'image d'énoncé sur la source.",
    );
    const hasTabs = Array.isArray(vm.visuals.tabs) && vm.visuals.tabs.length > 0;
    const activeResultImages = hasTabs && activeTab ? (activeTab.resultImages || []) : vm.visuals.resultImages;
    this.#renderImageGroup(
      this.exerciseResultImages,
      activeResultImages,
      "Image résultat attendu",
      "Pas d'image de résultat sur la source.",
    );
    this.#renderExerciseTabs(vm.visuals.tabs || []);
    this.#syncImagesGridLayout();
    this.#renderExtraImages(vm.visuals.extraImages || []);
    this.#refreshDetachedViewer();

    this.exercisePrevBtn.disabled = !vm.prevId;
    this.exerciseNextBtn.disabled = !vm.nextId;
    this.exercisePrevBtn.setAttribute("data-target-id", vm.prevId || "");
    this.exerciseNextBtn.setAttribute("data-target-id", vm.nextId || "");
    this.setExerciseWorkFileState(vm.workFile || null);
  }

  #formatStep(step) {
    const text = String(step || "").trim();
    const formatMultiline = (value) => escapeHtml(frenchTypography(value)).replace(/\n/g, "<br>");
    const colonIndex = text.indexOf(":");
    if (colonIndex <= 0) return formatMultiline(text);

    const label = text.slice(0, colonIndex).trim();
    if (!label) return formatMultiline(text);

    // Ne mettre en gras que les vrais "labels" courts (ex: "Police", "Titre",
    // "Élément 1"), pas les phrases longues générées automatiquement
    // (ex: "Construisez la structure ... à partir de cet objectif:").
    // Sans ce garde-fou, une phrase complète en gras suivie du contenu
    // donne l'impression visuelle de deux éléments distincts.
    const wordCount = label.split(/\s+/).filter(Boolean).length;
    const looksLikeLabel = label.length <= 30 && wordCount <= 4;

    const rest = text.slice(colonIndex + 1).trimStart();
    if (!looksLikeLabel) {
      // Phrase longue suivie de son contenu : on saute une ligne après les
      // deux-points pour bien séparer visuellement l'objectif du contenu,
      // sans pour autant le mettre en gras (ce n'est pas un vrai "label").
      if (!rest) return formatMultiline(text);
      return `${formatMultiline(`${label} :`)}<br>${formatMultiline(rest)}`;
    }
    if (!rest) return `<strong>${escapeHtml(label)}&nbsp;:</strong>`;
    return `<strong>${escapeHtml(label)}&nbsp;:</strong> ${formatMultiline(rest)}`;
  }

  #formatStepForExercise(exercise, step) {
    const raw = String(step || "").trim();
    if (exercise && exercise.id === "ex-010") {
      const normalized = raw
        .replace(/[💾"]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      if (normalized === "le raccourci clavier pour enregistrer rapidement est ctrl+s") {
        return "<strong>💾 Le raccourci clavier pour enregistrer rapidement est ctrl+s 💾</strong>";
      }
    }
    return this.#formatStep(step);
  }

  // Une étape est reliée à une fiche d'aide quand son libellé (texte avant « : »)
  // correspond à une entrée `stepHelp` de l'exercice.
  #findStepHelpTopic(exercise, step) {
    const entries = exercise && Array.isArray(exercise.stepHelp) ? exercise.stepHelp : [];
    if (!entries.length) return null;
    const text = String(step || "").trim();
    const colonIndex = text.indexOf(":");
    const label = (colonIndex > 0 ? text.slice(0, colonIndex) : text).trim().toLowerCase();
    const match = entries.find((entry) => String(entry.label || "").trim().toLowerCase() === label);
    return match ? match.topic : null;
  }

  #findStepHelpTopicById(topicId) {
    const exercise = this.currentExerciseVm ? this.currentExerciseVm.exercise : null;
    const entries = exercise && Array.isArray(exercise.stepHelp) ? exercise.stepHelp : [];
    const match = entries.find((entry) => entry.topic && entry.topic.id === topicId);
    return match ? match.topic : null;
  }

  #renderStepHelpButton(exercise, step) {
    const topic = this.#findStepHelpTopic(exercise, step);
    if (!topic) return "";
    return ` <button type="button" class="step-help-btn" data-step-help="${escapeHtml(topic.id)}" aria-haspopup="dialog" title="${escapeHtml(frenchTypography(topic.title))}">Détails</button>`;
  }

  #ensureHelpModal() {
    if (this.helpModal) return this.helpModal;
    const modal = document.createElement("div");
    modal.className = "image-modal help-modal";
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "help-modal-title");
    modal.innerHTML = `
      <div class="help-modal-content">
        <div class="help-modal-header">
          <h2 id="help-modal-title" class="help-modal-title"></h2>
          <button type="button" class="help-modal-close">Fermer</button>
        </div>
        <div class="help-modal-body"></div>
      </div>
    `;
    modal.querySelector(".help-modal-close").addEventListener("click", () => this.closeHelpModal());
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        this.closeHelpModal();
        return;
      }
      const image = event.target.closest(".help-modal-figure img");
      if (image) image.classList.toggle("is-zoomed");
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || modal.hidden) return;
      event.preventDefault();
      event.stopPropagation();
      this.closeHelpModal();
    });
    document.body.appendChild(modal);
    this.helpModal = modal;
    return modal;
  }

  openHelpModal(topic, trigger = null) {
    if (!topic) return;
    const modal = this.#ensureHelpModal();
    modal.querySelector(".help-modal-title").textContent = frenchTypography(topic.title);

    const parts = [];
    if (topic.intro) {
      parts.push(`<p class="help-modal-intro">${escapeHtml(frenchTypography(topic.intro)).replace(/\n/g, "<br>")}</p>`);
    }
    if (topic.steps.length) {
      parts.push(`<ol class="help-modal-steps">${topic.steps
        .map((step) => `<li>${escapeHtml(frenchTypography(step))}</li>`)
        .join("")}</ol>`);
    }
    for (const image of topic.images || []) {
      const caption = frenchTypography(image.caption || "");
      parts.push(`
        <figure class="help-modal-figure">
          <img src="${escapeHtml(image.src)}" alt="${escapeHtml(caption || topic.title)}" title="Cliquer pour agrandir ou réduire" loading="lazy">
          ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}
        </figure>
      `);
    }
    if (topic.sourceUrl) {
      let host = topic.sourceUrl;
      try {
        host = new URL(topic.sourceUrl).hostname.replace(/^www\./, "");
      } catch (_error) {
        // URL relative ou invalide : on affiche le texte tel quel.
      }
      parts.push(`<p class="help-modal-source">Source : <a href="${escapeHtml(topic.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(host)}</a></p>`);
    }
    const body = modal.querySelector(".help-modal-body");
    body.innerHTML = parts.join("");
    body.scrollTop = 0;

    this.helpModalTrigger = trigger;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    modal.querySelector(".help-modal-close").focus();
  }

  closeHelpModal() {
    if (!this.helpModal || this.helpModal.hidden) return;
    this.helpModal.hidden = true;
    this.helpModal.setAttribute("aria-hidden", "true");
    if (this.helpModalTrigger && typeof this.helpModalTrigger.focus === "function") {
      this.helpModalTrigger.focus();
    }
    this.helpModalTrigger = null;
  }

  #formatStepPlain(step) {
    const text = String(step || "").trim();
    return escapeHtml(frenchTypography(text)).replace(/\n/g, "<br>");
  }

  #isParagraphOnlyExercise(exercise, steps) {
    if (!exercise) return false;
    // Si le JSON dit explicitement "active le mode paragraphe", on renvoie true
    if (exercise.paragraphMode === true) {
      if (!Array.isArray(steps)) return false;
      return steps.map((line) => String(line || "").trim()).filter(Boolean).length >= 1;
    }
    // Par défaut, pour tous les autres exercices, cela renverra false
    // et l'application affichera les puces (<li>)
    return false;
  }

  #renderImageGroup(containerEl, images, altPrefix, emptyMessage) {
    const figure = containerEl.closest(".image-card");
    const existingEmpty = figure.querySelector(".image-empty");
    if (existingEmpty) existingEmpty.remove();

    const unique = [];
    const seen = new Set();
    for (const item of images || []) {
      const src = typeof item === "string" ? item : item && item.src;
      if (!src || seen.has(src)) continue;
      seen.add(src);
      unique.push({
        src,
        caption: typeof item === "object" && item ? String(item.caption || "") : "",
      });
    }
    const galleryKey = containerEl === this.exerciseEnonceImages ? "enonce" : "result";
    if (!unique.length) {
      delete this.imageGalleries[galleryKey];
      containerEl.innerHTML = "";
      figure.classList.remove("empty");
      figure.style.display = "none";
      return;
    }

    figure.style.display = "";
    figure.classList.remove("empty");
    containerEl.innerHTML = unique
      .map(
        (image, idx) => `
        <button class="image-thumb" type="button" data-zoom-src="${escapeHtml(image.src)}" title="Cliquer pour agrandir">
          <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.caption || `${altPrefix} ${idx + 1}`)}">
          <span class="image-thumb-hint">🔍 Cliquer pour agrandir</span>
        </button>
      `,
      )
      .join("");

    const buttons = Array.from(containerEl.querySelectorAll("button[data-zoom-src]"));
    const captionEl = galleryKey === "enonce" ? this.exerciseEnonceCaption : this.exerciseResultCaption;
    this.imageGalleries[galleryKey] = {
      label: (captionEl && captionEl.textContent.trim()) || (galleryKey === "enonce" ? "Énoncé" : "Résultat attendu"),
      items: unique.map((image, idx) => ({
        src: image.src,
        alt: image.caption || `${altPrefix} ${idx + 1}`,
        caption: image.caption || "",
      })),
    };
    for (const [index, btn] of buttons.entries()) {
      btn.addEventListener("click", () => this.openImageModal(galleryKey, index, btn));
      btn.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this.openImageModal(galleryKey, index, btn);
        }
      });
    }
  }

  #renderExtraImages(images) {
    const unique = [...new Set((images || []).filter(Boolean))];
    if (!unique.length) {
      delete this.imageGalleries.extra;
      this.exerciseExtraWrap.style.display = "none";
      this.exerciseExtraImages.innerHTML = "";
      return;
    }
    this.exerciseExtraWrap.style.display = "";
    this.exerciseExtraImages.innerHTML = unique
      .map(
        (src, idx) => `
        <button class="extra-image" type="button" data-zoom-src="${escapeHtml(src)}" title="Cliquer pour agrandir">
          <img src="${escapeHtml(src)}" alt="Image illustrative ${idx + 1}">
          <span class="image-thumb-hint">🔍 Cliquer pour agrandir</span>
        </button>
      `,
      )
      .join("");
    const buttons = Array.from(this.exerciseExtraImages.querySelectorAll("button[data-zoom-src]"));
    this.imageGalleries.extra = {
      label: "Images illustratives",
      items: unique.map((src, idx) => ({
        src,
        alt: `Image illustrative ${idx + 1}`,
        caption: "",
      })),
    };
    for (const [index, btn] of buttons.entries()) {
      btn.addEventListener("click", () => this.openImageModal("extra", index, btn));
      btn.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this.openImageModal("extra", index, btn);
        }
      });
    }
  }

  #renderExtraDownloadButtons(downloads) {
    if (!this.exerciseFilesActions) return;

    const oldButtons = this.exerciseFilesActions.querySelectorAll(".exercise-extra-download");
    for (const node of oldButtons) node.remove();

    const items = Array.isArray(downloads) ? downloads.filter((item) => item && item.url) : [];
    for (const item of items) {
      const link = document.createElement("a");
      link.className = "btn has-icon exercise-extra-download";
      link.dataset.icon = "⬇";
      link.target = "_blank";
      link.rel = "noopener";
      link.href = item.url;
      link.textContent = item.label || "Telecharger un fichier";
      link.download = this.#getExerciseDownloadFileName(this.currentExerciseVm && this.currentExerciseVm.exercise, item.url, {
        typeLabel: item.label || "fichier-annexe",
      });
      this.exerciseFilesActions.insertBefore(link, this.exercisePickWorkFileBtn || null);
    }
  }

  #renderExerciseTabs(tabs) {
    if (!this.exerciseStepsTabs) return;
    const items = Array.isArray(tabs) ? tabs.filter(Boolean) : [];
    if (!items.length) {
      this.exerciseStepsTabs.innerHTML = "";
      this.exerciseStepsTabs.style.display = "none";
      this.activeExerciseTabIndex = 0;
      return;
    }
    this.activeExerciseTabIndex = Math.max(0, Math.min(this.activeExerciseTabIndex, items.length - 1));

    const tabButtons = items.map((tab, index) => `
      <button
        type="button"
        class="exercise-tab-btn${index === this.activeExerciseTabIndex ? " active" : ""}"
        id="exercise-tab-${escapeHtml(tab.id)}"
        role="tab"
        aria-selected="${index === this.activeExerciseTabIndex ? "true" : "false"}"
        tabindex="${index === this.activeExerciseTabIndex ? "0" : "-1"}"
      >${escapeHtml(frenchTypography(tab.title))}</button>
    `).join("");
    this.exerciseStepsTabs.innerHTML = `
      <div class="exercise-tab-list" role="tablist" aria-label="Variantes de l'exercice">${tabButtons}</div>
    `;
    this.exerciseStepsTabs.style.display = "";

    const buttons = Array.from(this.exerciseStepsTabs.querySelectorAll(".exercise-tab-btn"));
    const activateTab = (index, focus = false) => {
      this.activeExerciseTabIndex = index;
      buttons.forEach((button, btnIndex) => {
        const active = btnIndex === index;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
        button.setAttribute("tabindex", active ? "0" : "-1");
        if (active && focus) button.focus();
      });
      this.#renderExerciseSteps(this.currentExerciseVm ? this.currentExerciseVm.exercise : null, items[index].instructions || []);
      if (this.exerciseInstructionsWrap) {
        this.exerciseInstructionsWrap.style.display = (items[index].instructions || []).length ? "" : "none";
      }
      this.#renderImageGroup(
        this.exerciseResultImages,
        items[index].resultImages || [],
        "Image résultat attendu",
        "Pas d'image de résultat sur la source.",
      );
      this.#syncImagesGridLayout();
      this.#refreshDetachedViewer();
    };

    buttons.forEach((button, index) => {
      button.addEventListener("click", () => activateTab(index));
      button.addEventListener("keydown", (event) => {
        if (event.key === "Home") {
          event.preventDefault();
          activateTab(0, true);
          return;
        }
        if (event.key === "End") {
          event.preventDefault();
          activateTab(buttons.length - 1, true);
          return;
        }
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        const delta = event.key === "ArrowRight" ? 1 : -1;
        const nextIndex = (index + delta + buttons.length) % buttons.length;
        activateTab(nextIndex, true);
      });
    });
  }

  #renderExerciseSteps(exercise, steps) {
    const paragraphOnly = this.#isParagraphOnlyExercise(exercise, steps || []);
    const formatStep = (step) => this.#formatStepForExercise(exercise, step);
    this.exerciseSteps.classList.remove("steps-copy-mode", "steps-paragraph-mode", "steps-has-copy");
    if (paragraphOnly) {
      const lines = (steps || [])
        .map((line) => String(line || "").trim())
        .filter(Boolean);
      const text = lines.length
        ? lines.map((line) => `${formatStep(line)}${this.#renderStepHelpButton(exercise, line)}`).join("<br>")
        : "Reproduisez le document en suivant l'énoncé.";
      this.exerciseSteps.classList.add("steps-paragraph-mode");
      this.exerciseSteps.innerHTML = `<p class="steps-paragraph-text">${text}</p>`;
      return;
    }

    const normalizedSteps = (steps || []).map((step) => String(step || "").trim()).filter(Boolean);
    const markerPattern = /^texte\s+à\s+copier\/coller\s*:?\s*$/i;
    const copyIntroPattern = /(texte\s+à\s+copier\/coller|copier-coller\s+(?:le|la|ce)?\s*(?:texte|liste)|copier-coller\s+ce\s+texte)/i;
    const numberedStepPattern = /^\d+\./;
    let hasCopyBlock = false;
    const items = [];

    for (let i = 0; i < normalizedSteps.length; i += 1) {
      const line = normalizedSteps[i];
      const lineParts = line.split("\n").map((part) => part.trim()).filter(Boolean);

      if (copyIntroPattern.test(lineParts[0] || "") && lineParts.length > 1) {
        hasCopyBlock = true;
        items.push(`
          <li class="copy-step">
            <p class="steps-instruction">${this.#formatStepPlain(lineParts[0])}</p>
            <pre class="steps-copy-block">${escapeHtml(lineParts.slice(1).join("\n"))}</pre>
          </li>
        `);
        continue;
      }

      if (markerPattern.test(line)) {
        const copyLines = [];
        let j = i + 1;
        while (j < normalizedSteps.length) {
          const next = normalizedSteps[j];
          if (numberedStepPattern.test(next)) break;
          copyLines.push(next);
          j += 1;
        }

        if (copyLines.length) {
          hasCopyBlock = true;
          items.push(`
            <li class="copy-step">
              <p class="steps-instruction">${this.#formatStepPlain(line)}</p>
              <pre class="steps-copy-block">${escapeHtml(copyLines.join("\n"))}</pre>
            </li>
          `);
          i = j - 1;
          continue;
        }
      }

      if (copyIntroPattern.test(line)) {
        const copyLines = [];
        let j = i + 1;
        while (j < normalizedSteps.length) {
          const next = normalizedSteps[j];
          if (numberedStepPattern.test(next)) break;
          copyLines.push(next);
          j += 1;
        }

        if (copyLines.length >= 2) {
          hasCopyBlock = true;
          items.push(`
            <li class="copy-step">
              <p class="steps-instruction">${this.#formatStepPlain(line)}</p>
              <pre class="steps-copy-block">${escapeHtml(copyLines.join("\n"))}</pre>
            </li>
          `);
          i = j - 1;
          continue;
        }
      }

      items.push(`<li>${formatStep(line)}${this.#renderStepHelpButton(exercise, line)}</li>`);
    }

    if (hasCopyBlock) this.exerciseSteps.classList.add("steps-has-copy");
    this.exerciseSteps.innerHTML = items.length
      ? items.join("")
      : "<li>Reproduisez le document en suivant l'énoncé.</li>";
  }

  #syncImagesGridLayout() {
    if (!this.exerciseImagesGrid) return;
    const cards = Array.from(this.exerciseImagesGrid.querySelectorAll(".image-card"));
    const visibleCards = cards.filter((card) => card.style.display !== "none");

    this.exerciseImagesGrid.classList.toggle("single-image-block", visibleCards.length === 1);
    for (const card of cards) {
      card.classList.remove("single-image-card");
    }
    if (visibleCards.length === 1) {
      visibleCards[0].classList.add("single-image-card");
    }
  }

  renderProgress(vm) {
    if (this.progressCompleted) this.progressCompleted.textContent = frenchTypography(formatProgressLine(vm));
    if (this.progressLevel) this.progressLevel.textContent = vm.level;
    if (this.progressRing) this.progressRing.innerHTML = renderProgressRing(vm.percent);
    if (this.progressLevelScale) this.progressLevelScale.innerHTML = renderLevelScale(vm.levels, vm.level);
    this.renderThemeProgress(vm.themeRows);
    if (this.progressCurve) this.renderCurve(vm.curveSeries);
    this.renderUsabilityReport(vm.usabilityReport);
  }

  renderThemeProgress(rows) {
    if (!this.progressThemeList) return;
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
      this.progressThemeList.innerHTML = `<li class="empty">Aucun thème disponible.</li>`;
      return;
    }
    this.progressThemeList.innerHTML = list
      .map((row) => {
        const complete = row.total > 0 && row.done >= row.total;
        const href = `#affinity/${encodeURIComponent(row.affinityId || "")}/${encodeURIComponent(row.id)}`;
        const label = `${row.name} : ${row.done} exercice${row.done > 1 ? "s" : ""} terminé${row.done > 1 ? "s" : ""} sur ${row.total}`;
        return `
          <li>
            <a class="progress-theme-row${complete ? " is-complete" : ""}" href="${href}" aria-label="${escapeHtml(frenchTypography(label))}">
              <span class="progress-theme-name">${escapeHtml(frenchTypography(row.name))}</span>
              <span class="progress-theme-bar" aria-hidden="true"><span style="width:${row.percent}%"></span></span>
              <span class="progress-theme-count" aria-hidden="true">${row.done}/${row.total}${complete ? " ✓" : ""}</span>
            </a>
          </li>`;
      })
      .join("");
  }

  // « Mon ressenti » : réponses du QCM de fin d'exercice, formulées pour l'apprenant.
  // Le rapport détaillé (moyennes, vigilance) reste exporté pour le formateur.
  renderUsabilityReport(report) {
    if (!this.progressUsabilitySummary || !this.progressUsabilityList) return;
    const safeReport = report && typeof report === "object" ? report : {};
    const totalFeedback = Number(safeReport.totalFeedback || 0);

    if (!totalFeedback || !safeReport.counts) {
      this.progressUsabilitySummary.innerHTML = "";
      this.progressUsabilitySummary.hidden = true;
      this.progressUsabilityList.innerHTML = `<li>Votre ressenti apparaîtra ici après votre premier exercice terminé.</li>`;
      return;
    }

    const { autonomy = {}, difficulty = {} } = safeReport.counts;
    const tiles = [
      ["💪", "En autonomie", autonomy.independent],
      ["🤝", "Avec un peu d'aide", autonomy.partial],
      ["🙋", "Avec de l'aide", autonomy.assisted],
      ["😓", "Trouvés difficiles", difficulty.hard],
    ];
    this.progressUsabilitySummary.hidden = false;
    this.progressUsabilitySummary.innerHTML = tiles
      .map(([icon, label, count]) => `
        <div class="stat feeling-stat">
          <p><span aria-hidden="true">${icon}</span> ${escapeHtml(label)}</p>
          <strong>${Number(count || 0)}</strong>
        </div>`)
      .join("");

    const flagLabels = {
      "difficulte elevee": "trouvé difficile",
      "clarte faible": "consignes peu claires",
      "autonomie faible": "fait avec de l'aide",
    };
    const flagged = Array.isArray(safeReport.flaggedExercises) ? safeReport.flaggedExercises : [];
    if (!flagged.length) {
      this.progressUsabilityList.innerHTML = "<li>Aucun exercice à revoir : continuez comme ça !</li>";
      return;
    }
    this.progressUsabilityList.innerHTML = [
      `<li class="feeling-list-head">À revoir si vous le souhaitez :</li>`,
      ...flagged.map((row) => `
        <li>
          <a href="#exercise/${encodeURIComponent(row.exerciseId)}"><strong>${escapeHtml(frenchTypography(row.exerciseLabel))}</strong></a>
          — ${escapeHtml(row.flags.map((flag) => flagLabels[flag] || flag).join(", "))}
          ${row.comment ? `<br><em>${escapeHtml(row.comment)}</em>` : ""}
        </li>`),
    ].join("");
  }

  // Notification de fin d'exercice : survit au passage à l'exercice suivant.
  showCompletionToast(vm) {
    if (!this.completionToast) {
      const toast = document.createElement("div");
      toast.className = "completion-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      toast.hidden = true;
      toast.addEventListener("click", (event) => {
        if (event.target.closest(".completion-toast-close, .completion-toast-link")) this.hideCompletionToast();
      });
      document.body.appendChild(toast);
      this.completionToast = toast;
    }
    const title = vm.exerciseNum ? `Exercice ${vm.exerciseNum} terminé` : "Exercice terminé";
    this.completionToast.innerHTML = `
      <span class="completion-toast-icon" aria-hidden="true">✓</span>
      <span class="completion-toast-text">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(frenchTypography(`Palier : ${vm.level} · ${vm.percent} % de l'atelier`))}</span>
      </span>
      <a class="completion-toast-link" href="#progress">📊 Voir mes progrès</a>
      <button class="completion-toast-close" type="button" aria-label="Fermer la notification">×</button>`;
    this.completionToast.hidden = false;
    window.clearTimeout(this.completionToastTimer);
    this.completionToastTimer = window.setTimeout(() => this.hideCompletionToast(), 10000);
  }

  hideCompletionToast() {
    window.clearTimeout(this.completionToastTimer);
    if (this.completionToast) this.completionToast.hidden = true;
  }

  renderCurve(series) {
    const svg = this.progressCurve;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (!series || series.length === 0) return;

    const width = 860;
    const height = 220;
    const left = 46;
    const right = 16;
    const top = 14;
    const bottom = 28;
    const chartW = width - left - right;
    const chartH = height - top - bottom;

    const maxValue = Math.max(8, ...series.map((p) => p.value));
    for (let i = 0; i <= 4; i += 1) {
      const y = top + (i / 4) * chartH;
      this.#addLine(svg, left, y, left + chartW, y, "#e7dfd4", 1);
      const val = Math.round(maxValue - (i / 4) * maxValue);
      this.#addText(svg, 8, y + 4, String(val), "#738292", 11);
    }

    const points = series.map((entry, index) => {
      const x = left + (index / (series.length - 1)) * chartW;
      const y = top + chartH - (entry.value / maxValue) * chartH;
      return { x, y, value: entry.value, day: entry.day };
    });

    const poly = document.createElementNS(SVG_NS, "polyline");
    poly.setAttribute("points", points.map((p) => `${p.x},${p.y}`).join(" "));
    poly.setAttribute("fill", "none");
    poly.setAttribute("stroke", "#2e6f76");
    poly.setAttribute("stroke-width", "3");
    poly.setAttribute("stroke-linecap", "round");
    poly.setAttribute("stroke-linejoin", "round");
    svg.appendChild(poly);

    const first = points[0];
    const last = points[points.length - 1];
    this.#addCircle(svg, first.x, first.y, 4, "#bc6f34");
    this.#addCircle(svg, last.x, last.y, 5, "#2e6f76");
    this.#addText(svg, last.x - 5, Math.max(12, last.y - 10), String(last.value), "#2e6f76", 11, "700");
    this.#addText(svg, left, height - 8, shortDate(first.day), "#6c7b8a", 11);
    this.#addText(svg, width - 46, height - 8, shortDate(last.day), "#6c7b8a", 11);
  }

  #addLine(svg, x1, y1, x2, y2, color, width) {
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", String(x1));
    line.setAttribute("y1", String(y1));
    line.setAttribute("x2", String(x2));
    line.setAttribute("y2", String(y2));
    line.setAttribute("stroke", color);
    line.setAttribute("stroke-width", String(width));
    svg.appendChild(line);
  }

  #addCircle(svg, x, y, r, fill) {
    const dot = document.createElementNS(SVG_NS, "circle");
    dot.setAttribute("cx", String(x));
    dot.setAttribute("cy", String(y));
    dot.setAttribute("r", String(r));
    dot.setAttribute("fill", fill);
    svg.appendChild(dot);
  }

  #addText(svg, x, y, text, fill, size, weight) {
    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", String(x));
    label.setAttribute("y", String(y));
    label.setAttribute("fill", fill);
    label.setAttribute("font-size", String(size));
    if (weight) label.setAttribute("font-weight", weight);
    label.textContent = text;
    svg.appendChild(label);
  }

  setProgressUserPath(message) {
    if (!this.progressUserPath) return;
    this.progressUserPath.textContent = message || "";
  }

  setProgressStatus(message) {
    this.progressStatus.textContent = message || "";
  }

  setRuntimeStatus(message) {
    const text = message || "";
    if (this.runtimeStatus) this.runtimeStatus.textContent = text;
    if (this.headerRuntimeStatus) this.headerRuntimeStatus.textContent = text;
  }

  setHeaderUser(firstName, initials) {
    if (!this.headerUserName) return;
    const safeFirstName = String(firstName || "").trim();
    const safeInitials = String(initials || "").trim();
    if (safeFirstName && safeInitials) {
      this.headerUserName.textContent = `${safeFirstName} (${safeInitials})`;
      return;
    }
    if (safeFirstName) {
      this.headerUserName.textContent = safeFirstName;
      return;
    }
    if (safeInitials) {
      this.headerUserName.textContent = safeInitials;
      return;
    }
    this.headerUserName.textContent = "Non connecté";
  }

  updateStatusTag(isDone) {
    if (!this.exerciseStatusPill) return;
    this.exerciseStatusPill.textContent = isDone ? "Fait ✓" : "À faire";
    this.exerciseStatusPill.classList.toggle("todo", !isDone);
    const id = this.exerciseToggleDoneBtn ? this.exerciseToggleDoneBtn.getAttribute("data-id") : null;
    if (id) this.exerciseToggleDoneBtn.setAttribute("data-id", id);
  }

  updateSaveNudge(isDone) {
    if (!this.exerciseSaveNudge) return;
    this.exerciseSaveNudge.hidden = isDone;
  }

  setExerciseWorkFileState(workFileVm) {
    if (!this.exercisePickWorkFileBtn || !this.exerciseOpenWorkFileBtn || !this.exerciseWorkFileStatus) return;

    const vm = workFileVm && typeof workFileVm === "object" ? workFileVm : {};
    const pickerSupported = vm.pickerSupported !== false;
    const fileName = String(vm.fileName || "").trim();

    this.exercisePickWorkFileBtn.style.display = "none";
    this.exercisePickWorkFileBtn.textContent = "S\u00e9lectionner mon fichier";

    this.exerciseOpenWorkFileBtn.style.display = "none";
    this.exerciseOpenWorkFileBtn.disabled = true;
    this.exerciseOpenWorkFileBtn.textContent = "Ouvrir mon fichier";

    if (!pickerSupported) {
      this.exerciseWorkFileStatus.textContent = "S\u00e9lection du fichier indisponible sur ce navigateur.";
      return;
    }

    if (typeof vm.statusText === "string" && vm.statusText.trim()) {
      this.exerciseWorkFileStatus.textContent = vm.statusText.trim();
      return;
    }

    this.exerciseWorkFileStatus.textContent = fileName
      ? `Fichier attendu : ${fileName}`
      : "";
  }

  #bindModalEvents() {
    if (!this.imageModal || !this.imageModalImg || !this.imageModalStage) return;
    if (this.imageModalClose) {
      this.imageModalClose.addEventListener("click", () => {
        if (this.imageViewerPipWindow) this.#attachImageViewer({ reopen: true });
        else this.closeImageModal();
      });
    }
    if (this.imageModalDetach) this.imageModalDetach.addEventListener("click", () => this.#detachImageViewer());
    if (this.imageModalPrev) this.imageModalPrev.addEventListener("click", () => this.#stepModalImage(-1));
    if (this.imageModalNext) this.imageModalNext.addEventListener("click", () => this.#stepModalImage(1));
    if (this.imageModalStepPrev) this.imageModalStepPrev.addEventListener("click", () => this.#setModalStep(this.modalStepIndex - 1));
    if (this.imageModalStepNext) this.imageModalStepNext.addEventListener("click", () => this.#setModalStep(this.modalStepIndex + 1));
    if (this.imageModalTabs) {
      this.imageModalTabs.addEventListener("click", (event) => {
        const tab = event.target.closest("[data-gallery]");
        if (!tab) return;
        this.modalGalleryKey = tab.getAttribute("data-gallery");
        this.modalGalleryIndex = 0;
        this.#renderModalImage();
      });
    }
    if (this.imageModalToolbar) {
      this.imageModalToolbar.addEventListener("click", (event) => {
        const button = event.target.closest("[data-zoom]");
        if (!button) return;
        this.#hideViewerHint();
        const action = button.getAttribute("data-zoom");
        if (action === "in") this.#zoomViewerBy(1.4);
        if (action === "out") this.#zoomViewerBy(1 / 1.4);
        if (action === "width") this.#fitViewerWidth();
        if (action === "page") this.#fitViewerPage();
      });
    }

    const stage = this.imageModalStage;
    this.imageModalImg.addEventListener("load", () => this.#initViewerImage());
    this.imageModalImg.addEventListener("dragstart", (event) => event.preventDefault());
    stage.addEventListener("pointerdown", (event) => this.#onViewerPointerDown(event));
    stage.addEventListener("pointermove", (event) => this.#onViewerPointerMove(event));
    stage.addEventListener("pointerup", (event) => this.#onViewerPointerUp(event, false));
    stage.addEventListener("pointercancel", (event) => this.#onViewerPointerUp(event, true));
    stage.addEventListener("wheel", (event) => this.#onViewerWheel(event), { passive: false });

    document.addEventListener("keydown", (event) => {
      if (!this.imageViewerPipWindow) this.#handleViewerKey(event);
    });
    window.addEventListener("resize", () => {
      if (!this.imageViewerPipWindow) this.#refitViewer();
    });
    // Retour arrière du navigateur ou changement de page : le panneau ne doit pas rester affiché.
    window.addEventListener("hashchange", () => {
      if (!this.imageViewerPipWindow) this.closeImageModal();
    });
    this.#updateDetachState();
  }

  openImageModal(galleryKey, index = 0, trigger = null) {
    const gallery = this.imageGalleries[galleryKey];
    if (!gallery || !gallery.items.length || !this.imageModal || !this.imageModalImg) return;
    this.modalGalleryKey = galleryKey;
    this.modalGalleryIndex = Math.max(0, Math.min(gallery.items.length - 1, Number(index) || 0));
    if (this.imageViewerPipWindow) {
      // Fenêtre flottante déjà ouverte : elle affiche l'image choisie, sans masquer l'exercice.
      this.#renderModalImage();
      return;
    }
    this.modalTrigger = trigger;
    this.imageModal.hidden = false;
    this.imageModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("image-viewer-open");
    if (this.imageModalHint) this.imageModalHint.hidden = false;
    this.#renderModalImage();
    this.#renderModalStep();
    if (this.imageModalClose) this.imageModalClose.focus({ preventScroll: true });
  }

  closeImageModal() {
    if (!this.imageModal || !this.imageModalImg) return;
    if (this.imageViewerPipWindow) {
      this.#attachImageViewer({ reopen: false });
      return;
    }
    const wasOpen = !this.imageModal.hidden;
    this.imageModal.hidden = true;
    this.imageModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("image-viewer-open");
    this.imageModalImg.removeAttribute("src");
    this.imageModalImg.alt = "";
    this.viewerZoom.width = 0;
    this.viewerPointers.clear();
    this.viewerGesture = null;
    if (wasOpen && this.modalTrigger && this.modalTrigger.isConnected) {
      this.modalTrigger.focus({ preventScroll: true });
    }
    this.modalTrigger = null;
  }

  #stepModalImage(delta) {
    const gallery = this.imageGalleries[this.modalGalleryKey];
    if (!gallery) return;
    const nextIndex = Math.max(0, Math.min(gallery.items.length - 1, this.modalGalleryIndex + delta));
    if (nextIndex === this.modalGalleryIndex) return;
    this.modalGalleryIndex = nextIndex;
    this.#renderModalImage();
  }

  #renderModalImage() {
    const gallery = this.imageGalleries[this.modalGalleryKey];
    const item = gallery && gallery.items[this.modalGalleryIndex];
    if (!item || !this.imageModalImg) return;

    // URL absolue : l'image reste valide une fois la visionneuse déplacée dans la fenêtre flottante.
    const src = new URL(item.src, document.baseURI).href;
    this.viewerZoom.width = 0;
    this.imageModalImg.style.visibility = "hidden";
    this.imageModalImg.alt = item.alt || "Aperçu";
    if (this.imageModalImg.src !== src) this.imageModalImg.src = src;
    if (this.imageModalImg.complete && this.imageModalImg.naturalWidth) this.#initViewerImage();

    if (this.imageModalCaption) {
      this.imageModalCaption.textContent = String(item.caption || "").trim() || gallery.label;
    }
    if (this.imageModalTabs) {
      const keys = ["enonce", "result", "extra"].filter((key) => this.imageGalleries[key]);
      this.imageModalTabs.hidden = keys.length < 2;
      this.imageModalTabs.innerHTML = keys
        .map((key) => `<button type="button" class="image-viewer-tab" data-gallery="${key}" aria-pressed="${key === this.modalGalleryKey ? "true" : "false"}">${escapeHtml(this.imageGalleries[key].label)}</button>`)
        .join("");
    }
    const total = gallery.items.length;
    const hasMultiple = total > 1;
    if (this.imageModalPrev) {
      this.imageModalPrev.hidden = !hasMultiple;
      this.imageModalPrev.disabled = this.modalGalleryIndex <= 0;
    }
    if (this.imageModalNext) {
      this.imageModalNext.hidden = !hasMultiple;
      this.imageModalNext.disabled = this.modalGalleryIndex >= total - 1;
    }
    if (this.imageModalCounter) {
      this.imageModalCounter.hidden = !hasMultiple;
      this.imageModalCounter.textContent = hasMultiple ? `${this.modalGalleryIndex + 1} / ${total}` : "";
    }
  }

  // Rappel de l'étape : les consignes restent lisibles pendant qu'on regarde l'image.
  #getViewerSteps() {
    if (!this.exerciseSteps) return [];
    return Array.from(this.exerciseSteps.children)
      .filter((node) => node.tagName === "LI")
      .map((li) => {
        const source = (li.querySelector(".steps-instruction") || li).cloneNode(true);
        for (const node of source.querySelectorAll(".step-help-btn, pre")) node.remove();
        return source.textContent.replace(/\s+/g, " ").trim();
      })
      .filter(Boolean);
  }

  #setModalStep(index) {
    this.modalStepIndex = index;
    this.#renderModalStep();
  }

  #renderModalStep() {
    if (!this.imageModalStep || !this.imageModalStepText) return;
    const steps = this.#getViewerSteps();
    if (!steps.length) {
      this.imageModalStep.hidden = true;
      return;
    }
    this.modalStepIndex = Math.max(0, Math.min(steps.length - 1, this.modalStepIndex));
    this.imageModalStep.hidden = false;
    this.imageModalStepText.innerHTML = `<strong>Étape ${this.modalStepIndex + 1}/${steps.length}</strong> ${escapeHtml(frenchTypography(steps[this.modalStepIndex]))}`;
    if (this.imageModalStepPrev) this.imageModalStepPrev.disabled = this.modalStepIndex <= 0;
    if (this.imageModalStepNext) this.imageModalStepNext.disabled = this.modalStepIndex >= steps.length - 1;
  }

  // ---- Zoom et déplacement (transform sur l'image, ancré sur le point visé) ----

  #initViewerImage() {
    const img = this.imageModalImg;
    if (!img.naturalWidth) return;
    this.viewerZoom.width = img.naturalWidth;
    this.viewerZoom.height = img.naturalHeight;
    img.style.width = `${img.naturalWidth}px`;
    img.style.visibility = "";
    this.#fitViewerWidth();
  }

  #viewerFitScales() {
    const pad = 12;
    const stage = this.imageModalStage;
    const width = Math.min(2, Math.max(0.02, (stage.clientWidth - pad * 2) / this.viewerZoom.width));
    const page = Math.min(width, Math.max(0.02, (stage.clientHeight - pad * 2) / this.viewerZoom.height));
    return { width, page };
  }

  #fitViewerWidth() {
    if (!this.viewerZoom.width) return;
    Object.assign(this.viewerZoom, { scale: this.#viewerFitScales().width, x: 0, y: 12, mode: "width" });
    this.#clampViewer();
  }

  #fitViewerPage() {
    if (!this.viewerZoom.width) return;
    Object.assign(this.viewerZoom, { scale: this.#viewerFitScales().page, mode: "page" });
    this.#clampViewer();
  }

  #refitViewer() {
    if (!this.viewerZoom.width || !this.imageModal || this.imageModal.hidden) return;
    if (this.viewerZoom.mode === "width") this.#fitViewerWidth();
    else if (this.viewerZoom.mode === "page") this.#fitViewerPage();
    else this.#clampViewer();
  }

  #zoomViewerAt(scale, pointX, pointY) {
    const zoom = this.viewerZoom;
    if (!zoom.width) return;
    const fit = this.#viewerFitScales();
    const nextScale = Math.min(Math.max(3, fit.width * 5), Math.max(fit.page, scale));
    const ratio = nextScale / zoom.scale;
    zoom.x = pointX - (pointX - zoom.x) * ratio;
    zoom.y = pointY - (pointY - zoom.y) * ratio;
    zoom.scale = nextScale;
    zoom.mode = "free";
    this.#clampViewer();
  }

  #zoomViewerBy(factor) {
    const stage = this.imageModalStage;
    this.#zoomViewerAt(this.viewerZoom.scale * factor, stage.clientWidth / 2, stage.clientHeight / 2);
  }

  #clampViewer() {
    const zoom = this.viewerZoom;
    const stage = this.imageModalStage;
    if (!zoom.width || !stage) return;
    const pad = 12;
    const stageWidth = stage.clientWidth;
    const stageHeight = stage.clientHeight;
    const width = zoom.width * zoom.scale;
    const height = zoom.height * zoom.scale;
    zoom.x = width + pad * 2 <= stageWidth ? (stageWidth - width) / 2 : Math.min(pad, Math.max(stageWidth - width - pad, zoom.x));
    zoom.y = height + pad * 2 <= stageHeight ? (stageHeight - height) / 2 : Math.min(pad, Math.max(stageHeight - height - pad, zoom.y));
    this.imageModalImg.style.transform = `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`;
    stage.classList.toggle("is-zoomed", zoom.scale > this.#viewerFitScales().width * 1.05);
    if (this.imageModalZoomLabel) this.imageModalZoomLabel.textContent = `${Math.round(zoom.scale * 100)} %`;
  }

  #viewerPoint(event) {
    const rect = this.imageModalStage.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  #hideViewerHint() {
    if (this.imageModalHint) this.imageModalHint.hidden = true;
  }

  #onViewerPointerDown(event) {
    if (event.button > 0 || !this.viewerZoom.width) return;
    this.#hideViewerHint();
    try {
      this.imageModalStage.setPointerCapture(event.pointerId);
    } catch (_error) {
      /* capture indisponible */
    }
    const point = this.#viewerPoint(event);
    this.viewerPointers.set(event.pointerId, point);
    if (this.viewerPointers.size === 1) {
      this.viewerGesture = { startX: point.x, startY: point.y, x: this.viewerZoom.x, y: this.viewerZoom.y, moved: false, pinch: null };
    } else if (this.viewerPointers.size === 2 && this.viewerGesture) {
      const [a, b] = [...this.viewerPointers.values()];
      this.viewerGesture.pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, scale: this.viewerZoom.scale };
      this.viewerGesture.moved = true;
    }
  }

  #onViewerPointerMove(event) {
    const gesture = this.viewerGesture;
    if (!gesture || !this.viewerPointers.has(event.pointerId)) return;
    const point = this.#viewerPoint(event);
    this.viewerPointers.set(event.pointerId, point);
    if (gesture.pinch && this.viewerPointers.size >= 2) {
      const [a, b] = [...this.viewerPointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      this.#zoomViewerAt(gesture.pinch.scale * distance / gesture.pinch.distance, (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    const dx = point.x - gesture.startX;
    const dy = point.y - gesture.startY;
    if (!gesture.moved && Math.hypot(dx, dy) < 5) return;
    gesture.moved = true;
    this.imageModalStage.classList.add("is-grabbing");
    this.viewerZoom.x = gesture.x + dx;
    this.viewerZoom.y = gesture.y + dy;
    this.viewerZoom.mode = "free";
    this.#clampViewer();
  }

  #onViewerPointerUp(event, cancelled) {
    const gesture = this.viewerGesture;
    if (!gesture || !this.viewerPointers.has(event.pointerId)) return;
    const wasSingle = this.viewerPointers.size === 1;
    this.viewerPointers.delete(event.pointerId);
    if (this.viewerPointers.size < 2) gesture.pinch = null;
    if (this.viewerPointers.size === 1) {
      const [rest] = [...this.viewerPointers.values()];
      Object.assign(gesture, { startX: rest.x, startY: rest.y, x: this.viewerZoom.x, y: this.viewerZoom.y });
      return;
    }
    this.imageModalStage.classList.remove("is-grabbing");
    this.viewerGesture = null;
    if (!wasSingle || gesture.moved || cancelled) return;
    // Simple clic : zoom à l'endroit cliqué, ou retour à la largeur si l'image est déjà agrandie.
    const point = this.#viewerPoint(event);
    const fitWidth = this.#viewerFitScales().width;
    if (this.viewerZoom.scale > fitWidth * 1.05) {
      this.#zoomViewerAt(fitWidth, point.x, point.y);
      this.viewerZoom.mode = "width";
    } else {
      this.#zoomViewerAt(Math.max(1, fitWidth * 2.5), point.x, point.y);
    }
  }

  #onViewerWheel(event) {
    if (!this.viewerZoom.width) return;
    event.preventDefault();
    this.#hideViewerHint();
    if (event.ctrlKey || event.metaKey) {
      // Ctrl + molette, ou pincement sur pavé tactile : zoom sous le pointeur.
      const point = this.#viewerPoint(event);
      this.#zoomViewerAt(this.viewerZoom.scale * Math.exp(-event.deltaY * 0.0025), point.x, point.y);
      return;
    }
    this.viewerZoom.x -= event.deltaX;
    this.viewerZoom.y -= event.deltaY;
    this.viewerZoom.mode = "free";
    this.#clampViewer();
  }

  #handleViewerKey(event) {
    if (!this.imageModal || this.imageModal.hidden) return;
    switch (event.key) {
      case "Escape":
        this.closeImageModal();
        break;
      case "ArrowLeft":
        this.#stepModalImage(-1);
        break;
      case "ArrowRight":
        this.#stepModalImage(1);
        break;
      case "+":
      case "=":
        this.#zoomViewerBy(1.4);
        break;
      case "-":
        this.#zoomViewerBy(1 / 1.4);
        break;
      case "0":
        this.#fitViewerWidth();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  // ---- Fenêtre flottante (Document Picture-in-Picture) ----

  #updateDetachState() {
    const detached = Boolean(this.imageViewerPipWindow);
    if (this.imageModal) this.imageModal.classList.toggle("is-detached", detached);
    if (this.imageModalDetach) this.imageModalDetach.hidden = detached || !("documentPictureInPicture" in window);
    if (this.imageModalClose) {
      this.imageModalClose.textContent = detached ? "Ramener dans l'appli" : "← Retour à l'exercice";
    }
  }

  async #detachImageViewer() {
    if (this.imageViewerPipWindow || !("documentPictureInPicture" in window)) return;
    let pipWindow;
    try {
      pipWindow = await window.documentPictureInPicture.requestWindow({ width: 440, height: 620 });
    } catch (_error) {
      if (this.imageModalDetach) this.imageModalDetach.hidden = true;
      return;
    }
    this.imageViewerPipWindow = pipWindow;
    const pipDocument = pipWindow.document;
    pipDocument.title = document.title;
    for (const node of document.querySelectorAll('link[rel="stylesheet"], style')) {
      const copy = node.cloneNode(true);
      if (node.tagName === "LINK") copy.href = node.href;
      pipDocument.head.appendChild(copy);
    }
    pipDocument.body.classList.add("image-viewer-pip");
    document.body.classList.remove("image-viewer-open");
    pipDocument.body.appendChild(this.imageModal);
    pipWindow.addEventListener("pagehide", () => this.#attachImageViewer({ reopen: false }));
    pipWindow.addEventListener("keydown", (event) => this.#handleViewerKey(event));
    pipWindow.addEventListener("resize", () => this.#refitViewer());
    this.#updateDetachState();
    if (this.modalTrigger && this.modalTrigger.isConnected) this.modalTrigger.focus({ preventScroll: true });
    this.#renderModalImage();
    this.#renderModalStep();
  }

  #attachImageViewer({ reopen }) {
    const pipWindow = this.imageViewerPipWindow;
    if (!pipWindow) return;
    this.imageViewerPipWindow = null;
    if (this.imageModalHome) this.imageModalHome.insertBefore(this.imageModal, this.imageModalHomeNextSibling);
    if (!pipWindow.closed) pipWindow.close();
    this.#updateDetachState();
    if (reopen && this.imageGalleries[this.modalGalleryKey]) {
      document.body.classList.add("image-viewer-open");
      this.#renderModalImage();
      this.#renderModalStep();
      if (this.imageModalClose) this.imageModalClose.focus({ preventScroll: true });
      return;
    }
    this.closeImageModal();
  }

  // Changement d'exercice ou d'onglet pendant que l'image est détachée : la fenêtre suit.
  #refreshDetachedViewer() {
    if (!this.imageViewerPipWindow) return;
    const key = this.imageGalleries[this.modalGalleryKey]
      ? this.modalGalleryKey
      : ["result", "enonce", "extra"].find((candidate) => this.imageGalleries[candidate]);
    if (!key) {
      this.#attachImageViewer({ reopen: false });
      return;
    }
    if (key !== this.modalGalleryKey) {
      this.modalGalleryKey = key;
      this.modalGalleryIndex = 0;
    }
    this.modalGalleryIndex = Math.min(this.modalGalleryIndex, this.imageGalleries[key].items.length - 1);
    this.#renderModalImage();
    this.#renderModalStep();
  }

  #getExerciseDescription(exercise, steps) {
    const description = String(exercise && exercise.description || "").trim();
    if (!description) return "";

    const normalizedDescription = this.#normalizeExerciseText(description);
    const normalizedSteps = Array.isArray(steps)
      ? steps.map((step) => this.#normalizeExerciseText(step)).filter(Boolean)
      : [];

    if (normalizedSteps.includes(normalizedDescription)) {
      return "";
    }

    if (/^telechargez\b/.test(normalizedDescription) && normalizedSteps.some((step) => /^telechargez\b/.test(step))) {
      return "";
    }

    return description;
  }

  #normalizeExerciseText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/^\s*[\d]+[\s.-]*/g, "")
      .replace(/^[^\p{L}\p{N}]+/gu, "")
      .replace(/[.!:;]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  #slugifyFilePart(value, fallback) {
    const slug = String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || fallback;
  }

  #getExerciseDownloadFileName(exercise, fileUrl, options = {}) {
    const exerciseNumber = Number(exercise && exercise.num);
    const exerciseId = Number.isFinite(exerciseNumber) && exerciseNumber > 0
      ? `ex-${String(exerciseNumber).padStart(3, "0")}`
      : String(exercise && exercise.id ? exercise.id : "")
        .trim()
        .toLowerCase()
        .replace(/^ex-(\d{1,2})$/, (_match, value) => `ex-${String(value).padStart(3, "0")}`)
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "exercice";
    const modulePart = this.#slugifyFilePart(
      exercise && (exercise.moduleSlug || exercise.moduleName || exercise.moduleId),
      "module",
    );
    const typePart = this.#slugifyFilePart(options.typeLabel || "fichier", "fichier");
    let extension = ".docx";

    try {
      const parsed = new URL(String(fileUrl || ""), window.location.href);
      const lastSegment = parsed.pathname.split("/").filter(Boolean).pop() || "";
      const match = lastSegment.match(/\.[a-z0-9]{2,8}$/i);
      if (match) extension = match[0].toLowerCase();
    } catch {
      // conserver .docx
    }

    return `${exerciseId}-${modulePart}-${typePart}${extension}`;
  }
}

window.AtelierView = AtelierView;
})();
