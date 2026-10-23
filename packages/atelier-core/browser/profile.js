(() => {
function createAtelierProfileRuntime(config = {}) {
  const documentRef = config.documentRef || document;
  const persistenceRuntime = config.persistenceRuntime;
  const view = config.view;
  const storage = config.storage;
  const getUserSession = typeof config.getUserSession === "function"
    ? config.getUserSession
    : () => null;
  const setUserSession = typeof config.setUserSession === "function"
    ? config.setUserSession
    : () => {};
  const getRuntimeStatusLabel = typeof config.getRuntimeStatusLabel === "function"
    ? config.getRuntimeStatusLabel
    : () => "Mode local";
  const getDeploymentConfig = typeof config.getDeploymentConfig === "function"
    ? config.getDeploymentConfig
    : () => null;

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function buildConfiguredRootsHtml(deploymentConfig) {
    const shares = deploymentConfig && deploymentConfig.networkShares
      ? deploymentConfig.networkShares
      : {};

    const rows = [
      ["Dossiers utilisateurs", shares.userFoldersRoot],
      ["Documents", shares.documentsRoot],
      ["Exports", shares.exportsRoot],
      ["Rapports", shares.reportsRoot],
    ].filter(([, value]) => String(value || "").trim());

    if (!rows.length) {
      return `<p class="profile-info-line"><strong>Configuration reseau :</strong> aucun chemin partage configure.</p>`;
    }

    return rows
      .map(([label, value]) => `<p class="profile-info-line"><strong>${escapeHtml(label)} :</strong> <code>${escapeHtml(value)}</code></p>`)
      .join("");
  }

  return {
    render() {
      persistenceRuntime.persistUiState({ page: "profile" });
      view.showPage("profile");

      const userSession = getUserSession();
      if (!userSession) return;

      const profileSection = documentRef.getElementById("profile-user-section");
      if (!profileSection) return;

      const deploymentConfig = getDeploymentConfig();
      const folderName = userSession.rootHandle && userSession.rootHandle.name
        ? userSession.rootHandle.name
        : "Dossier utilisateur";
      const storageModeLabel = userSession.storageMode === "server" ? "Serveur local" : "Local";
      let currentFirstName = userSession.firstName || "";
      const initials = userSession.initials || "";
      const runtimeStatus = getRuntimeStatusLabel();

      profileSection.innerHTML = `
        <p class="profile-info-line"><strong>Prenom :</strong> <span id="profile-firstname-display">${escapeHtml(currentFirstName)}</span></p>
        <p class="profile-info-line"><strong>Initiales :</strong> ${escapeHtml(initials)}</p>
        <p class="profile-info-line"><strong>Mode actif :</strong> ${escapeHtml(storageModeLabel)}</p>
        <p class="profile-info-line"><strong>Etat runtime :</strong> ${escapeHtml(runtimeStatus)}</p>
        <p class="profile-info-line"><strong>Dossier actif :</strong> ${escapeHtml(folderName)}</p>
        ${buildConfiguredRootsHtml(deploymentConfig)}
        <div id="profile-rename-wrap" style="display:none;margin-top:0.75rem;">
          <label for="profile-firstname-input" style="display:block;margin-bottom:0.35rem;font-size:0.9rem;">Nouveau prenom :</label>
          <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
            <input id="profile-firstname-input" type="text" maxlength="30" placeholder="Ex. : Alice"
              style="flex:1;min-width:140px;padding:0.4rem 0.6rem;border:1px solid #bbb;border-radius:6px;font-size:0.95rem;">
            <button id="profile-firstname-save-btn" class="btn" type="button">Enregistrer</button>
            <button id="profile-firstname-cancel-btn" class="btn btn-secondary" type="button">Annuler</button>
          </div>
          <p id="profile-rename-status" style="margin-top:0.4rem;font-size:0.85rem;color:#555;"></p>
        </div>
        <button id="profile-edit-firstname-btn" class="btn" type="button" style="margin-top:0.75rem;">Modifier le prenom</button>
      `;

      const editBtn = documentRef.getElementById("profile-edit-firstname-btn");
      const renameWrap = documentRef.getElementById("profile-rename-wrap");
      const input = documentRef.getElementById("profile-firstname-input");
      const saveBtn = documentRef.getElementById("profile-firstname-save-btn");
      const cancelBtn = documentRef.getElementById("profile-firstname-cancel-btn");
      const renameStatus = documentRef.getElementById("profile-rename-status");
      const display = documentRef.getElementById("profile-firstname-display");

      if (!editBtn || !renameWrap || !input || !saveBtn || !cancelBtn || !renameStatus || !display) return;

      editBtn.addEventListener("click", () => {
        input.value = currentFirstName;
        renameWrap.style.display = "";
        editBtn.style.display = "none";
        renameStatus.textContent = "";
        input.focus();
        if (typeof input.select === "function") input.select();
      });

      cancelBtn.addEventListener("click", () => {
        renameWrap.style.display = "none";
        editBtn.style.display = "";
      });

      const doSave = async () => {
        const newName = storage.normalizeFirstName(input.value);
        if (!newName) {
          renameStatus.textContent = "Le prenom ne peut pas etre vide.";
          input.focus();
          return;
        }

        try {
          const currentSession = getUserSession();
          if (!currentSession) return;
          await storage.saveUserProfile(currentSession.rootHandle, currentSession.initials, newName);
          await storage.setSavedFirstName(newName);
          const nextSession = { ...currentSession, firstName: newName };
          setUserSession(nextSession);
          currentFirstName = newName;
          view.setHeaderUser(newName, nextSession.initials);
          display.textContent = newName;
          renameWrap.style.display = "none";
          editBtn.style.display = "";
        } catch {
          renameStatus.textContent = "Erreur lors de l'enregistrement.";
        }
      };

      saveBtn.addEventListener("click", doSave);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          doSave();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          cancelBtn.click();
        }
      });
    },
  };
}

window.createAtelierProfileRuntime = createAtelierProfileRuntime;
})();
