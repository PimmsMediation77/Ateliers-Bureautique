(() => {
function createAtelierExerciseRuntime(config = {}) {
  const persistenceRuntime = config.persistenceRuntime;
  const view = config.view;
  const model = config.model;
  const storage = config.storage;
  const officeAppName = config.officeAppName || "l'application bureautique";
  const getCurrentAffinityId = typeof config.getCurrentAffinityId === "function"
    ? config.getCurrentAffinityId
    : () => null;
  const setCurrentThemeId = typeof config.setCurrentThemeId === "function"
    ? config.setCurrentThemeId
    : () => {};
  const setCurrentAffinityId = typeof config.setCurrentAffinityId === "function"
    ? config.setCurrentAffinityId
    : () => {};
  const saveProgress = typeof config.saveProgress === "function" ? config.saveProgress : () => {};
  const refreshWorkFileState = typeof config.refreshWorkFileState === "function"
    ? config.refreshWorkFileState
    : () => {};
  const renderAffinityFallback = typeof config.renderAffinityFallback === "function"
    ? config.renderAffinityFallback
    : () => {};
  const renderThemesFallback = typeof config.renderThemesFallback === "function"
    ? config.renderThemesFallback
    : () => {};
  const getUserFolderLabel = typeof config.getUserFolderLabel === "function"
    ? config.getUserFolderLabel
    : () => "Dossier utilisateur";

  // Remplace {dossierUtilisateur} par le nom du dossier choisi par l'usager.
  function resolvePlaceholders(text) {
    const value = String(text || "");
    if (!value.includes("{dossierUtilisateur}")) return value;
    return value.replace(/\{dossierUtilisateur\}/g, getUserFolderLabel() || "Dossier utilisateur");
  }

  function buildLaunchStep() {
    const appLower = officeAppName.toLowerCase();
    const isWord = appLower.includes("word");
    const docType = isWord ? "Document vierge" : "Classeur vierge";
    return `Lancez ${officeAppName} : cliquez sur le bouton Demarrer (icone Windows en bas a gauche de l'ecran), tapez "${officeAppName}" dans la barre de recherche, puis cliquez sur le resultat. Dans la page d'accueil, cliquez sur "${docType}" pour creer un nouveau document vide.`;
  }

  function hasLaunchInstruction(steps) {
    if (!steps || !steps.length) return false;
    const first = String(steps[0] || "").toLowerCase();
    if (/ouvrez|lancez|d\u00e9marrez|demarrez|cherchez|trouvez/.test(first)) return true;
    // Une \u00e9tape ult\u00e9rieure peut d\u00e9j\u00e0 demander d'ouvrir l'application (ex: apr\u00e8s la cr\u00e9ation de dossiers).
    const appLower = officeAppName.toLowerCase();
    return steps.some((step) => {
      const lower = String(step || "").toLowerCase();
      return /^(ouvrez|lancez|d\u00e9marrez|demarrez)\s/.test(lower) && lower.includes(appLower);
    });
  }

  return {
    render(exerciseId) {
      const exercise = model.getExerciseById(exerciseId);
      if (!exercise) {
        const currentAffinityId = getCurrentAffinityId();
        if (currentAffinityId) {
          renderAffinityFallback();
        } else {
          renderThemesFallback();
        }
        return false;
      }

      const currentThemeId = exercise.moduleId;
      const currentAffinityId = model.getAffinityIdForTheme(exercise.moduleId) || getCurrentAffinityId();
      setCurrentThemeId(currentThemeId);
      setCurrentAffinityId(currentAffinityId);

      persistenceRuntime.persistUiState({
        page: "exercise",
        exerciseId: exercise.id,
        affinityId: currentAffinityId || "",
        themeId: currentThemeId || "",
      });
      if (model.markExerciseOpened(exercise.id)) {
        saveProgress();
      }
      view.showPage("exercise");
      if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }

      const done = model.getIsDone(exercise.id);
      const stepsVm = model.getExerciseStepsView
        ? model.getExerciseStepsView(exercise)
        : { preamble: "", steps: model.getStepsForExercise(exercise) };

      const hasFiles = Boolean(
        exercise.workFileUrl || exercise.docxUrl || exercise.downloadUrl
        || (exercise.extraDownloadUrls && exercise.extraDownloadUrls.length),
      );
      const steps = (stepsVm.steps || []).map(resolvePlaceholders);
      if (!hasFiles && !hasLaunchInstruction(steps)) {
        steps.unshift(buildLaunchStep());
      }

      const visuals = model.getVisualsForExercise(exercise);
      const { prevId, nextId } = model.getNeighbors(exercise.id);
      view.renderExercise({
        exercise: {
          ...exercise,
          preamble: resolvePlaceholders(stepsVm.preamble),
          stepHelp: model.getStepHelpForExercise ? model.getStepHelpForExercise(exercise) : [],
        },
        done,
        steps,
        visuals,
        prevId,
        nextId,
        workFile: {
          pickerSupported: Boolean(
            storage && storage.supportsWorkFilePicker && storage.supportsWorkFilePicker(),
          ),
        },
      });
      refreshWorkFileState(exercise.id);
      return true;
    },
  };
}

window.createAtelierExerciseRuntime = createAtelierExerciseRuntime;
})();
