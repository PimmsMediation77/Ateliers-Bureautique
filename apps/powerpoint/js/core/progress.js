(() => {
// Page « Où j'en suis » (#progress) : synthèse, thèmes, activité et ressenti.
function createAtelierProgressRuntime(config = {}) {
  const persistenceRuntime = config.persistenceRuntime;
  const view = config.view;
  const model = config.model;

  return {
    render() {
      if (persistenceRuntime) persistenceRuntime.persistUiState({ page: "progress" });
      view.showPage("progress");
      const summary = model.getSummary();
      const curveSeries = model.getCurveSeries(30);
      const usabilityReport = typeof model.getUsabilityReport === "function"
        ? model.getUsabilityReport()
        : null;
      const themeRows = typeof model.getThemeProgressRows === "function"
        ? model.getThemeProgressRows().filter((row) => row.total > 0)
        : [];
      view.renderProgress({
        ...summary,
        levels: typeof model.getLevelSteps === "function" ? model.getLevelSteps() : [],
        themeRows,
        curveSeries,
        usabilityReport,
      });
    },
  };
}

window.createAtelierProgressRuntime = createAtelierProgressRuntime;
})();
