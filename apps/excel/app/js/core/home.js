(() => {
const HOME_STATES = {
  empty: { kicker: "Aucun exercice en cours", startLabel: "Voir les thèmes" },
  first: { kicker: "Votre premier exercice", startLabel: "Commencer" },
  "in-progress": { kicker: "Exercice en cours", startLabel: "Continuer l'exercice" },
  next: { kicker: "Prochain exercice", startLabel: "Commencer l'exercice" },
  "new-theme": { kicker: "Nouveau thème 🎉", startLabel: "Commencer l'exercice" },
  "all-done": { kicker: "Bravo, atelier terminé 🎉", startLabel: "Revoir les thèmes" },
};

function getHomeState(model, summary, lastExercise, resumeExercise) {
  if (!resumeExercise) return "empty";
  if (summary.total > 0 && summary.completed >= summary.total) return "all-done";
  if (lastExercise && lastExercise.id === resumeExercise.id && !model.getIsDone(resumeExercise.id)) return "in-progress";
  if (summary.completed === 0) return "first";
  if (lastExercise && lastExercise.moduleId !== resumeExercise.moduleId) return "new-theme";
  return "next";
}

// Fil « vous êtes ici » : position de l'exercice conseillé dans son thème.
function buildThemeTrail(model, resumeExercise, state) {
  if (!resumeExercise || typeof model.getExercisesByTheme !== "function") return null;
  const list = model.getExercisesByTheme(resumeExercise.moduleId) || [];
  const index = list.findIndex((ex) => ex.id === resumeExercise.id);
  if (index < 0) return null;
  return {
    name: resumeExercise.moduleName || "",
    position: index + 1,
    total: list.length,
    steps: list.map((ex) => ({
      id: ex.id,
      num: ex.num,
      title: ex.title,
      done: model.getIsDone(ex.id),
      current: state !== "all-done" && ex.id === resumeExercise.id,
    })),
  };
}

function createAtelierHomeRuntime(config = {}) {
  const persistenceRuntime = config.persistenceRuntime;
  const view = config.view;
  const model = config.model;

  return {
    render() {
      persistenceRuntime.persistUiState({ page: "home" });
      view.showPage("home");
      const summary = model.getSummary();
      const lastExercise = model.getLastExercise();
      const resumeExercise = model.getResumeExercise();
      const state = getHomeState(model, summary, lastExercise, resumeExercise);

      let exerciseLabel = "";
      let headline = "Choisissez un exercice dans les thèmes.";
      if (state === "all-done") {
        headline = `Vous avez terminé les ${summary.total} exercices.`;
      } else if (resumeExercise) {
        exerciseLabel = `Exercice ${resumeExercise.num}`;
        headline = resumeExercise.title;
      }

      view.renderHome({
        ...summary,
        state,
        kicker: HOME_STATES[state].kicker,
        startLabel: HOME_STATES[state].startLabel,
        exerciseLabel,
        headline,
        theme: buildThemeTrail(model, resumeExercise, state),
      });
    },
  };
}

window.createAtelierHomeRuntime = createAtelierHomeRuntime;
})();
