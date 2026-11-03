(() => {
// La progression s'affiche dans la page Profil : ce runtime ne fait que remplir
// ses sections, sans changer de page.
function createAtelierProgressRuntime(config = {}) {
  const view = config.view;
  const model = config.model;

  return {
    render() {
      const summary = model.getSummary();
      const curveSeries = model.getCurveSeries(30);
      const usabilityReport = typeof model.getUsabilityReport === "function"
        ? model.getUsabilityReport()
        : null;
      view.renderProgress({ ...summary, curveSeries, usabilityReport });
    },
  };
}

window.createAtelierProgressRuntime = createAtelierProgressRuntime;
})();
