(() => {
function dayString(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeDate(value) {
  if (typeof value !== "string") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dayString(dt);
}

function uniqueStrings(items) {
  if (!Array.isArray(items)) return [];
  return [...new Set(items.filter((v) => typeof v === "string" && v.trim()))];
}

function normalizeFeedbackValue(value, allowedValues) {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  return allowedValues.includes(text) ? text : "";
}

function normalizeFeedbackComment(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
}

function uniqueImageObjects(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const src = typeof item === "string" ? item.trim() : String(item && item.src || "").trim();
    if (!src || seen.has(src)) continue;
    seen.add(src);
    out.push({
      src,
      caption: typeof item === "object" && item ? cleanText(item.caption || "") : "",
    });
  }
  return out;
}

function normalizeImageList(items) {
  if (!Array.isArray(items)) return [];
  return uniqueImageObjects(items);
}

function coerceImageEntries(value, fallbackCaption = "") {
  if (Array.isArray(value)) {
    return uniqueImageObjects(
      value.map((item) => (
        typeof item === "string"
          ? { src: item, caption: fallbackCaption }
          : { src: item && item.src, caption: item && item.caption ? item.caption : fallbackCaption }
      )),
    );
  }

  const src = String(value || "").trim();
  if (!src) return [];
  return [{ src, caption: cleanText(fallbackCaption || "") }];
}

function normalizeExerciseTabs(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => {
      const title = cleanText(item && item.title || `Exercice ${index + 1}`);
      const instructions = Array.isArray(item && item.instructions)
        ? item.instructions.map((step) => cleanStepText(step)).filter(Boolean)
        : [];
      const resultImages = normalizeImageList(item && item.resultImages);
      const enonceImages = normalizeImageList(item && item.enonceImages);
      if (!title || (!instructions.length && !resultImages.length && !enonceImages.length)) return null;
      return {
        id: String(item && item.id || `tab-${index + 1}`).trim() || `tab-${index + 1}`,
        title,
        instructions,
        resultImages,
        enonceImages,
      };
    })
    .filter(Boolean);
}

// Fiches d'aide partagées (racine `helpTopics` des données) : contenu affiché
// dans la fenêtre « Détails » d'une étape qui y fait référence.
function normalizeHelpTopics(raw) {
  const topics = new Map();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return topics;
  for (const [id, item] of Object.entries(raw)) {
    const title = cleanText(item && item.title);
    if (!id || !title) continue;
    topics.set(id, {
      id,
      title,
      intro: cleanStepText(item.intro || ""),
      steps: Array.isArray(item.steps) ? item.steps.map((step) => cleanStepText(step)).filter(Boolean) : [],
      images: normalizeImageList(item.images),
      sourceUrl: String(item.sourceUrl || "").trim(),
    });
  }
  return topics;
}

// `stepHelp` d'un exercice : { "Libellé de l'étape": "id-de-la-fiche" }.
function normalizeStepHelp(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw)
    .map(([label, topicId]) => ({ label: cleanText(label), topicId: String(topicId || "").trim() }))
    .filter((entry) => entry.label && entry.topicId);
}

function cleanText(value) {
  return String(value || "")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanDescriptionText(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .trim();
}

function cleanStepText(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .trim();
}

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function foldText(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeAvailabilityEntry(value) {
  if (typeof value === "boolean") return { active: value };
  if (value && typeof value === "object" && typeof value.active === "boolean") {
    return { active: value.active };
  }
  return null;
}

function normalizeAvailabilityOverrides(value) {
  const normalized = {
    modules: new Map(),
    exercises: new Map(),
  };

  if (!value || typeof value !== "object") return normalized;

  const moduleEntries = value.modules && typeof value.modules === "object"
    ? Object.entries(value.modules)
    : [];
  for (const [moduleId, entry] of moduleEntries) {
    const normalizedEntry = normalizeAvailabilityEntry(entry);
    if (!normalizedEntry || !String(moduleId || "").trim()) continue;
    normalized.modules.set(String(moduleId).trim(), normalizedEntry);
  }

  const exerciseEntries = value.exercises && typeof value.exercises === "object"
    ? Object.entries(value.exercises)
    : [];
  for (const [exerciseId, entry] of exerciseEntries) {
    const normalizedEntry = normalizeAvailabilityEntry(entry);
    if (!normalizedEntry || !String(exerciseId || "").trim()) continue;
    normalized.exercises.set(String(exerciseId).trim(), normalizedEntry);
  }

  return normalized;
}

class AtelierModel {
  constructor(rawData, options = {}) {
    if (!rawData || !Array.isArray(rawData.exercises) || !Array.isArray(rawData.modules)) {
      throw new Error("Données invalides");
    }

    this.availabilityOverrides = normalizeAvailabilityOverrides(options.availabilityOverrides);
    this.helpTopics = normalizeHelpTopics(rawData.helpTopics);
    const allowedModuleIds = new Set(
      rawData.modules
        .filter((module) => this.#isModuleActive(module && module.id))
        .map((module) => module.id),
    );

    this.themes = rawData.modules
      .filter((module) => allowedModuleIds.has(module.id))
      .map((m) => ({
        id: m.id,
        name: cleanText(m.cleanName || m.name || "Thème"),
        section: m.section || "",
        sectionOrder: toInt(m.sectionOrder, 99),
        orderInSection: toInt(m.orderInSection, 999),
      }))
      .sort((a, b) => {
        if (a.sectionOrder !== b.sectionOrder) return a.sectionOrder - b.sectionOrder;
        return a.orderInSection - b.orderInSection;
      });

    this.exercises = rawData.exercises
      .filter((ex) => allowedModuleIds.has(ex.moduleId) && this.#isExerciseActive(ex && ex.id))
      .map((ex) => ({
        id: ex.id,
        globalIndex: toInt(ex.globalIndex, 0),
        moduleId: ex.moduleId,
        moduleName: cleanText(ex.moduleNameClean || ex.moduleName || "Thème"),
        num: toInt(ex.num, 0),
        title: cleanText(ex.title || `Exercice ${ex.num || ""}`),
        level: toInt(ex.level, 0),
        description: cleanDescriptionText(ex.description || ""),
        workFileUrl: ex.workFileUrl || ex.docxUrl || null,
        docxUrl: ex.docxUrl || ex.workFileUrl || null,
        downloadUrl: ex.downloadUrl || null,
        downloadLabel: cleanText(ex.downloadLabel || ""),
        extraDownloadUrls: Array.isArray(ex.extraDownloadUrls)
          ? ex.extraDownloadUrls
            .map((item, index) => {
              if (typeof item === "string") {
                return {
                  url: item.trim(),
                  label: `Telecharger le ${index + 3}e fichier`,
                };
              }
              const url = String(item && item.url || "").trim();
              if (!url) return null;
              return {
                url,
                label: cleanText(item.label || `Telecharger le ${index + 3}e fichier`),
              };
            })
            .filter(Boolean)
          : [],
        imageEnonce: ex.imageEnonce || null,
        imageResultat: ex.imageResultat || null,
        imageEnonceCaption: cleanText(ex.imageEnonceCaption || ""),
        imageResultatCaption: cleanText(ex.imageResultatCaption || ""),
        scrapeEnonceImagesProvided: Array.isArray(ex.scrape && ex.scrape.enonceImages),
        scrapeResultImagesProvided: Array.isArray(ex.scrape && ex.scrape.resultImages),
        scrapeEnonceImages: normalizeImageList(ex.scrape && ex.scrape.enonceImages),
        scrapeResultImages: normalizeImageList(ex.scrape && ex.scrape.resultImages),
        exerciseTabs: normalizeExerciseTabs(ex.exerciseTabs),
        stepHelp: normalizeStepHelp(ex.stepHelp),
        criteria: Array.isArray(ex.criteria) ? ex.criteria.map((s) => cleanStepText(s)).filter(Boolean) : [],
        extraImages: uniqueStrings(
          Array.isArray(ex.extraImages)
            ? ex.extraImages
            : Array.isArray(ex.scrape && ex.scrape.extraImages)
              ? ex.scrape.extraImages
              : [],
        ),
        preamble: typeof ex.preamble === "string" ? ex.preamble.trim() : "",
        instructions: Array.isArray(ex.instructions) ? ex.instructions.map((s) => cleanStepText(s)).filter(Boolean) : [],
      }))
      .sort((a, b) => a.globalIndex - b.globalIndex);

    this.exById = new Map(this.exercises.map((ex) => [ex.id, ex]));
    this.exByTheme = new Map();
    for (const theme of this.themes) {
      this.exByTheme.set(
        theme.id,
        this.exercises.filter((ex) => ex.moduleId === theme.id).sort((a, b) => a.num - b.num),
      );
    }
    this.themes = this.themes.filter((theme) => (this.exByTheme.get(theme.id) || []).length > 0);

    this.progress = this.#emptyProgress();
  }

  #isModuleActive(moduleId) {
    if (!moduleId) return true;
    const override = this.availabilityOverrides.modules.get(String(moduleId).trim());
    return override ? override.active !== false : true;
  }

  #isExerciseActive(exerciseId) {
    if (!exerciseId) return true;
    const override = this.availabilityOverrides.exercises.get(String(exerciseId).trim());
    return override ? override.active !== false : true;
  }

  #emptyProgress() {
    return {
      version: 3,
      updatedAt: new Date().toISOString(),
      completedIds: [],
      lastExerciseId: null,
      history: [],
      feedback: [],
    };
  }

  #loadProgress() {
    return this.#emptyProgress();
  }

  #saveProgress() {
    this.progress.updatedAt = new Date().toISOString();
  }

  #sanitizeProgress() {
    this.progress.completedIds = this.progress.completedIds.filter((id) => this.exById.has(id));
    this.progress.history = this.progress.history.filter((h) => this.exById.has(h.exerciseId));
    this.progress.feedback = this.progress.feedback.filter((entry) => (
      entry
      && this.exById.has(entry.exerciseId)
      && entry.difficulty
      && entry.clarity
      && entry.autonomy
    ));
    if (!this.progress.lastExerciseId || !this.exById.has(this.progress.lastExerciseId)) {
      this.progress.lastExerciseId = this.#findLatestCompletedFromHistory();
    }
    this.#saveProgress();
  }

  #findLatestCompletedFromHistory() {
    const doneSet = new Set(this.progress.completedIds);
    for (let i = this.progress.history.length - 1; i >= 0; i -= 1) {
      const h = this.progress.history[i];
      if (h.delta > 0 && doneSet.has(h.exerciseId)) return h.exerciseId;
    }
    return doneSet.size ? [...doneSet][doneSet.size - 1] : null;
  }

  getThemes() {
    return this.themes.slice();
  }

  getThemeById(themeId) {
    return this.themes.find((t) => t.id === themeId) || null;
  }

  getDefaultAffinityId() {
    const groups = this.getThemeAffinityGroups();
    return groups.length ? groups[0].id : null;
  }

  getAffinityIdForTheme(themeId) {
    const theme = this.getThemeById(themeId);
    return theme ? this.getThemeAffinity(theme).id : null;
  }

  getThemeAffinity(theme) {
    const name = foldText(theme && theme.name);
    const section = String(theme && theme.section || "").toLowerCase();

    if (section === "complets" || name.includes("niveau")) {
      return {
        id: "parcours",
        label: "Parcours guidés",
        subtitle: "Exercices complets classés par niveau.",
        order: 5,
      };
    }

    if (
      /chercher et remplacer|publipostage|lier le document|champs et formulaire/.test(name)
    ) {
      return {
        id: "automatisation",
        label: "Automatisation et production",
        subtitle: "Gagner du temps sur les tâches répétitives et les supports pro.",
        order: 4,
      };
    }

    if (
      /tableau|document long|section et saut|en-tete et pied de page|styles|modeles/.test(name)
    ) {
      return {
        id: "structure",
        label: "Structure et organisation",
        subtitle: "Construire des supports organisés, lisibles et solides.",
        order: 3,
      };
    }

    if (
      /word art|lettrine|forme|zone de texte|image|format de page|affichage|smart art/.test(name)
    ) {
      return {
        id: "visuel",
        label: "Mise en forme visuelle",
        subtitle: "Travailler l'apparence et l'impact visuel des supports.",
        order: 2,
      };
    }

    return {
      id: "fondations",
      label: "Fondations bureautiques",
      subtitle: "Prendre en main les bases de saisie, de mise en forme et d'organisation simple.",
      order: 1,
    };
  }

  getThemeAffinityGroups() {
    const groupsById = new Map();
    for (const theme of this.themes) {
      const affinity = this.getThemeAffinity(theme);
      if (!groupsById.has(affinity.id)) {
        groupsById.set(affinity.id, {
          id: affinity.id,
          label: affinity.label,
          subtitle: affinity.subtitle,
          order: affinity.order,
          themes: [],
        });
      }
      groupsById.get(affinity.id).themes.push(theme);
    }

    return [...groupsById.values()]
      .map((group) => ({
        ...group,
        themes: group.themes.sort((a, b) => {
          if (a.sectionOrder !== b.sectionOrder) return a.sectionOrder - b.sectionOrder;
          return a.orderInSection - b.orderInSection;
        }),
      }))
      .sort((a, b) => a.order - b.order);
  }

  getDefaultThemeId() {
    return this.themes.length ? this.themes[0].id : null;
  }

  getExercisesByTheme(themeId) {
    return (this.exByTheme.get(themeId) || []).slice();
  }

  getExerciseById(exerciseId) {
    return this.exById.get(exerciseId) || null;
  }

  getNeighbors(exerciseId) {
    const ex = this.getExerciseById(exerciseId);
    if (!ex) return { prevId: null, nextId: null };
    const list = this.exercises;
    const idx = list.findIndex((item) => item.id === exerciseId);
    return {
      prevId: idx > 0 ? list[idx - 1].id : null,
      nextId: idx >= 0 && idx < list.length - 1 ? list[idx + 1].id : null,
    };
  }

  getLastExercise() {
    if (this.progress.lastExerciseId && this.exById.has(this.progress.lastExerciseId)) {
      const ex = this.getExerciseById(this.progress.lastExerciseId);
      if (ex) return ex;
    }
    const fallbackId = this.#findLatestCompletedFromHistory();
    return fallbackId ? this.getExerciseById(fallbackId) : null;
  }

  getResumeExercise() {
    const doneSet = new Set(this.progress.completedIds);
    if (!this.exercises.length) return null;

    const anchorId = this.progress.lastExerciseId || this.#findLatestCompletedFromHistory();
    const anchor = anchorId ? this.getExerciseById(anchorId) : null;
    if (anchor && !doneSet.has(anchor.id)) {
      return anchor;
    }

    const totalDone = doneSet.size;
    if (totalDone === 0) {
      return this.exercises[0];
    }

    // Priorité 1: continuer dans la même série à partir du dernier exercice fait.
    if (anchor) {
      const themeList = this.getExercisesByTheme(anchor.moduleId);
      const anchorIndex = themeList.findIndex((item) => item.id === anchor.id);
      if (anchorIndex >= 0) {
        for (let i = anchorIndex + 1; i < themeList.length; i += 1) {
          const candidate = themeList[i];
          if (!doneSet.has(candidate.id)) return candidate;
        }
      }
    }

    // Priorité 2: premier exercice non terminé dans l'ordre global.
    for (const exercise of this.exercises) {
      if (!doneSet.has(exercise.id)) return exercise;
    }

    // Tout est terminé: reprendre sur le dernier exercice connu.
    if (anchor) return anchor;
    return this.exercises[this.exercises.length - 1];
  }

  getLastCompletedDate(exerciseId) {
    if (!exerciseId) return null;
    for (let i = this.progress.history.length - 1; i >= 0; i -= 1) {
      const h = this.progress.history[i];
      if (h.exerciseId === exerciseId && h.delta > 0) return h.date;
    }
    return null;
  }

  getIsDone(exerciseId) {
    return this.progress.completedIds.includes(exerciseId);
  }

  getStepsForExercise(exercise) {
    if (!exercise) return [];
    if (exercise.instructions && exercise.instructions.length > 0) return exercise.instructions;

    const fallback = [];
    if (exercise.description) fallback.push(exercise.description);
    fallback.push("Reproduisez le document en vous aidant de l'image de l'énoncé.");
    if (exercise.imageResultat) fallback.push("Comparez votre travail avec le résultat attendu.");
    return fallback;
  }

  getStepHelpForExercise(exercise) {
    if (!exercise || !Array.isArray(exercise.stepHelp)) return [];
    return exercise.stepHelp
      .map((entry) => ({ label: entry.label, topic: this.helpTopics.get(entry.topicId) || null }))
      .filter((entry) => entry.topic);
  }

  getExerciseStepsView(exercise) {
    const steps = this.getStepsForExercise(exercise)
      .map((step) => String(step || "").trim())
      .filter(Boolean);
    if (!steps.length) return { preamble: "", steps: [] };

    const explicitPreamble = String(exercise && exercise.preamble ? exercise.preamble : "").trim();
    if (explicitPreamble) return { preamble: explicitPreamble, steps };

    const [firstStep, ...remainingSteps] = steps;
    if (remainingSteps.length && this.#looksLikeStepIntro(firstStep)) {
      return { preamble: firstStep, steps: remainingSteps };
    }

    return { preamble: "", steps };
  }

  #looksLikeStepIntro(value) {
    const text = cleanText(value);
    if (!text) return false;
    if (text.includes("\n")) return false;
    if (/^\d+[\.)]\s+/.test(text)) return false;
    if (text.length > 140) return false;

    const lower = text.toLowerCase();
    const actionStarters = [
      "affichez",
      "ajoutez",
      "appliquez",
      "choisissez",
      "cliquez",
      "comparez",
      "copiez",
      "cr\u00e9ez",
      "faites",
      "ins\u00e9rez",
      "modifiez",
      "ouvrez",
      "pr\u00e9sentez",
      "reproduisez",
      "s\u00e9lectionnez",
      "tapez",
      "t\u00e9l\u00e9chargez",
      "utilisez",
      "validez",
    ];
    if (actionStarters.some((starter) => lower.startsWith(starter))) return false;

    return [
      /\bexercice\b/,
      /\bobjectif\b/,
      /\ble but\b/,
      /\bil s'agit\b/,
      /\bvous allez\b/,
      /\bcet exercice\b/,
      /\bdans cet exercice\b/,
    ].some((pattern) => pattern.test(lower));
  }

  getVisualsForExercise(exercise) {
    if (!exercise) return { enonceImages: [], resultImages: [], extraImages: [], tabs: [] };

    const scrapeEnonceImages = uniqueImageObjects(exercise.scrapeEnonceImages);
    const scrapeResultImages = uniqueImageObjects(exercise.scrapeResultImages);
    const fallbackEnonceSingle = coerceImageEntries(exercise.imageEnonce, exercise.imageEnonceCaption || "");
    const fallbackResultSingle = coerceImageEntries(exercise.imageResultat, exercise.imageResultatCaption || "");
    let fallbackEnonceImages = [];
    let fallbackResultImages = [];

    if (fallbackEnonceSingle.length && fallbackResultSingle.length) {
      const sameSet = fallbackEnonceSingle.length === fallbackResultSingle.length
        && fallbackEnonceSingle.every((image, index) => image.src === fallbackResultSingle[index].src);
      if (sameSet) {
        fallbackResultImages = fallbackResultSingle;
      } else {
        fallbackEnonceImages = fallbackEnonceSingle;
        fallbackResultImages = fallbackResultSingle;
      }
    } else if (fallbackResultSingle.length) {
      fallbackResultImages = fallbackResultSingle;
    } else if (fallbackEnonceSingle.length) {
      // Règle métier demandée: image unique => résultat attendu.
      fallbackResultImages = fallbackEnonceSingle;
    }

    const enonceImagesRaw = exercise.scrapeEnonceImagesProvided ? scrapeEnonceImages : fallbackEnonceImages;
    const resultImagesRaw = exercise.scrapeResultImagesProvided ? scrapeResultImages : fallbackResultImages;
    const enonceImages = uniqueImageObjects(
      enonceImagesRaw.map((item) => (
        typeof item === "string"
          ? { src: item, caption: exercise.imageEnonceCaption || "" }
          : { src: item.src, caption: item.caption || exercise.imageEnonceCaption || "" }
      )),
    );
    const resultImages = uniqueImageObjects(
      resultImagesRaw.map((item) => (
        typeof item === "string"
          ? { src: item, caption: exercise.imageResultatCaption || "" }
          : { src: item.src, caption: item.caption || exercise.imageResultatCaption || "" }
      )),
    );
    const resultSrcSet = new Set(resultImages.map((image) => image.src));
    const dedupedEnonceImages = enonceImages.filter((image) => !resultSrcSet.has(image.src));

    const used = new Set([...dedupedEnonceImages, ...resultImages].map((image) => image.src));
    const extraImages = uniqueStrings(exercise.extraImages).filter((url) => !used.has(url));
    const tabs = Array.isArray(exercise.exerciseTabs)
      ? exercise.exerciseTabs.map((tab) => ({
        ...tab,
        enonceImages: uniqueImageObjects(tab.enonceImages || []),
        resultImages: uniqueImageObjects(tab.resultImages || []),
      }))
      : [];
    return { enonceImages: dedupedEnonceImages, resultImages, extraImages, tabs };
  }

  markExerciseDone(exerciseId, done) {
    if (!this.exById.has(exerciseId)) return;
    const set = new Set(this.progress.completedIds);
    const has = set.has(exerciseId);
    if (done && !has) {
      set.add(exerciseId);
      this.progress.history.push({ date: dayString(new Date()), exerciseId, delta: 1 });
    } else if (!done && has) {
      set.delete(exerciseId);
      this.progress.history.push({ date: dayString(new Date()), exerciseId, delta: -1 });
    } else {
      return;
    }
    this.progress.completedIds = [...set];
    this.progress.lastExerciseId = exerciseId;
    this.#saveProgress();
  }

  markExerciseOpened(exerciseId) {
    if (!this.exById.has(exerciseId)) return false;
    if (this.progress.lastExerciseId === exerciseId) return false;
    this.progress.lastExerciseId = exerciseId;
    this.#saveProgress();
    return true;
  }

  setExerciseFeedback(exerciseId, payload = {}) {
    if (!this.exById.has(exerciseId)) return false;

    const difficulty = normalizeFeedbackValue(payload.difficulty, ["easy", "adapted", "hard"]);
    const clarity = normalizeFeedbackValue(payload.clarity, ["unclear", "medium", "clear"]);
    const autonomy = normalizeFeedbackValue(payload.autonomy, ["assisted", "partial", "independent"]);
    if (!difficulty || !clarity || !autonomy) return false;

    const nextEntry = {
      exerciseId,
      submittedAt: new Date().toISOString(),
      difficulty,
      clarity,
      autonomy,
      comment: normalizeFeedbackComment(payload.comment),
    };

    const remaining = Array.isArray(this.progress.feedback)
      ? this.progress.feedback.filter((entry) => entry.exerciseId !== exerciseId)
      : [];
    remaining.push(nextEntry);
    this.progress.feedback = remaining;
    this.#saveProgress();
    return true;
  }

  getExerciseFeedback(exerciseId) {
    if (!exerciseId || !Array.isArray(this.progress.feedback)) return null;
    return this.progress.feedback.find((entry) => entry.exerciseId === exerciseId) || null;
  }

  getUsabilityReport() {
    const entries = Array.isArray(this.progress.feedback) ? this.progress.feedback.slice() : [];
    const empty = {
      totalFeedback: 0,
      difficultyAverage: null,
      clarityAverage: null,
      autonomyAverage: null,
      lastFeedback: null,
      flaggedExercises: [],
    };
    if (!entries.length) return empty;

    const scoreMaps = {
      difficulty: { easy: 1, adapted: 2, hard: 3 },
      clarity: { unclear: 1, medium: 2, clear: 3 },
      autonomy: { assisted: 1, partial: 2, independent: 3 },
    };
    const labelMaps = {
      difficulty: { easy: "Trop facile", adapted: "Adaptee", hard: "Difficile" },
      clarity: { unclear: "Pas claire", medium: "Moyenne", clear: "Tres claire" },
      autonomy: { assisted: "Avec aide", partial: "Aide partielle", independent: "En autonomie" },
    };
    const average = (key) => {
      const total = entries.reduce((sum, entry) => sum + (scoreMaps[key][entry[key]] || 0), 0);
      return Number((total / entries.length).toFixed(1));
    };

    const flaggedExercises = entries
      .map((entry) => {
        const exercise = this.getExerciseById(entry.exerciseId);
        if (!exercise) return null;
        const flags = [];
        if (entry.difficulty === "hard") flags.push("difficulte elevee");
        if (entry.clarity === "unclear") flags.push("clarte faible");
        if (entry.autonomy === "assisted") flags.push("autonomie faible");
        if (!flags.length) return null;
        return {
          exerciseId: entry.exerciseId,
          exerciseLabel: exercise ? `Exercice ${exercise.num} - ${exercise.title}` : entry.exerciseId,
          flags,
          difficultyLabel: labelMaps.difficulty[entry.difficulty],
          clarityLabel: labelMaps.clarity[entry.clarity],
          autonomyLabel: labelMaps.autonomy[entry.autonomy],
          comment: entry.comment || "",
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.exerciseLabel.localeCompare(b.exerciseLabel, "fr", { sensitivity: "base" }));

    const lastFeedback = entries
      .slice()
      .sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")))[0];
    const lastExercise = lastFeedback ? this.getExerciseById(lastFeedback.exerciseId) : null;

    return {
      totalFeedback: entries.length,
      difficultyAverage: average("difficulty"),
      clarityAverage: average("clarity"),
      autonomyAverage: average("autonomy"),
      lastFeedback: lastFeedback ? {
        exerciseLabel: lastExercise ? `Exercice ${lastExercise.num} - ${lastExercise.title}` : lastFeedback.exerciseId,
        submittedAt: lastFeedback.submittedAt,
        difficultyLabel: labelMaps.difficulty[lastFeedback.difficulty],
        clarityLabel: labelMaps.clarity[lastFeedback.clarity],
        autonomyLabel: labelMaps.autonomy[lastFeedback.autonomy],
        comment: lastFeedback.comment || "",
      } : null,
      flaggedExercises,
    };
  }

  getSummary() {
    const total = this.exercises.length;
    const completed = this.progress.completedIds.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const streak = this.getCurrentStreak();
    const level = this.getLevelLabel(percent);
    return { total, completed, percent, streak, level };
  }

  getCurrentStreak() {
    const positiveDays = new Set(this.progress.history.filter((h) => h.delta > 0).map((h) => h.date));
    let streak = 0;
    const cursor = new Date();
    while (true) {
      const key = dayString(cursor);
      if (positiveDays.has(key)) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  getLevelLabel(percent) {
    if (percent >= 90) return "Maîtrise";
    if (percent >= 65) return "Autonomie";
    if (percent >= 35) return "Pratique";
    if (percent >= 10) return "Lancement";
    return "Démarrage";
  }

  getThemeProgressRows() {
    const doneSet = new Set(this.progress.completedIds);
    return this.themes.map((theme) => {
      const list = this.getExercisesByTheme(theme.id);
      const done = list.filter((e) => doneSet.has(e.id)).length;
      return {
        id: theme.id,
        name: theme.name,
        done,
        total: list.length,
        percent: list.length ? Math.round((done / list.length) * 100) : 0,
      };
    });
  }

  getCurveSeries(days = 30) {
    const seriesDays = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i -= 1) {
      const dt = new Date(now);
      dt.setDate(now.getDate() - i);
      seriesDays.push(dayString(dt));
    }

    const deltaByDay = new Map();
    for (const h of this.progress.history) {
      deltaByDay.set(h.date, (deltaByDay.get(h.date) || 0) + h.delta);
    }

    const windowDelta = seriesDays.reduce((sum, day) => sum + (deltaByDay.get(day) || 0), 0);
    let running = this.progress.completedIds.length - windowDelta;
    if (running < 0) running = 0;

    return seriesDays.map((day) => {
      running += deltaByDay.get(day) || 0;
      if (running < 0) running = 0;
      return { day, value: running };
    });
  }

  exportProgressJson() {
    return JSON.stringify(this.progress, null, 2);
  }

  importProgressObject(obj) {
    const imported = {
      version: 3,
      updatedAt: new Date().toISOString(),
      completedIds: uniqueStrings(obj && obj.completedIds),
      lastExerciseId: obj && typeof obj.lastExerciseId === "string" ? obj.lastExerciseId : null,
      history: Array.isArray(obj && obj.history)
        ? obj.history
            .map((h) => ({
              date: normalizeDate(h && h.date),
              exerciseId: h && typeof h.exerciseId === "string" ? h.exerciseId : null,
              delta: Number.isFinite(h && h.delta) ? Math.trunc(h.delta) : 0,
            }))
            .filter((h) => h.date && h.exerciseId && h.delta !== 0)
        : [],
      feedback: Array.isArray(obj && obj.feedback)
        ? obj.feedback
          .map((entry) => ({
            exerciseId: entry && typeof entry.exerciseId === "string" ? entry.exerciseId : null,
            submittedAt: entry && typeof entry.submittedAt === "string" ? entry.submittedAt : new Date().toISOString(),
            difficulty: normalizeFeedbackValue(entry && entry.difficulty, ["easy", "adapted", "hard"]),
            clarity: normalizeFeedbackValue(entry && entry.clarity, ["unclear", "medium", "clear"]),
            autonomy: normalizeFeedbackValue(entry && entry.autonomy, ["assisted", "partial", "independent"]),
            comment: normalizeFeedbackComment(entry && entry.comment),
          }))
          .filter((entry) => entry.exerciseId && entry.difficulty && entry.clarity && entry.autonomy)
        : [],
    };
    this.progress = imported;
    this.#sanitizeProgress();
  }

  resetProgress() {
    this.progress = this.#emptyProgress();
    this.#saveProgress();
  }
}

window.AtelierModel = AtelierModel;

})();

