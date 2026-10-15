(() => {
function createAtelierController(config = {}) {
  const settings = {
    progressFileName: config.progressFileName || "progression-atelier.json",
    officeAppName: config.officeAppName || "application bureautique",
    completedFileExtension: config.completedFileExtension || "dat",
  };

  return class AtelierController {
  constructor(model, view, storage) {
    this.model = model;
    this.view = view;
    this.storage = storage;

    this.currentThemeId = this.model.getDefaultThemeId();
    this.currentAffinityId = this.model.getAffinityIdForTheme(this.currentThemeId) || this.model.getDefaultAffinityId();

    this.isReady = false;
    this.userSession = null;
    this.pendingPermissionSession = null;
    this.saveQueue = Promise.resolve();
    this.exerciseWorkFileToken = 0;
    this.deploymentConfig = null;
    this.serverStatus = null;
    this.routeStorageKey = `atelier:last-hash:${settings.progressFileName}`;
    this.uiStateStorageKey = `atelier:last-ui-state:${settings.progressFileName}`;
    this.userSnapshotStorageKey = `atelier:last-user:${settings.progressFileName}`;
    this.persistenceRuntime = window.createAtelierPersistenceRuntime({
      localStorage: window.localStorage,
      routeStorageKey: this.routeStorageKey,
      uiStateStorageKey: this.uiStateStorageKey,
      userSnapshotStorageKey: this.userSnapshotStorageKey,
      model: this.model,
    });
    this.homeRuntime = window.createAtelierHomeRuntime({
      persistenceRuntime: this.persistenceRuntime,
      view: this.view,
      model: this.model,
    });
    this.themesRuntime = window.createAtelierThemesRuntime({
      persistenceRuntime: this.persistenceRuntime,
      view: this.view,
      model: this.model,
      getCurrentThemeId: () => this.currentThemeId,
      setCurrentThemeId: (themeId) => {
        this.currentThemeId = themeId;
      },
      setCurrentAffinityId: (affinityId) => {
        this.currentAffinityId = affinityId;
      },
    });
    this.exerciseRuntime = window.createAtelierExerciseRuntime({
      persistenceRuntime: this.persistenceRuntime,
      view: this.view,
      model: this.model,
      storage: this.storage,
      officeAppName: settings.officeAppName,
      getCurrentAffinityId: () => this.currentAffinityId,
      setCurrentThemeId: (themeId) => {
        this.currentThemeId = themeId;
      },
      setCurrentAffinityId: (affinityId) => {
        this.currentAffinityId = affinityId;
      },
      saveProgress: () => this.#saveProgress(),
      refreshWorkFileState: (exerciseId) => this.#refreshExerciseWorkFileState(exerciseId),
      getUserFolderLabel: () => this.#getSaveReminderFolderLabel(),
      renderAffinityFallback: () => this.#renderAffinityPage(this.currentAffinityId, this.currentThemeId),
      renderThemesFallback: () => this.#renderThemesOverview(),
    });
    this.routeRuntime = window.createAtelierRouteRuntime({
      renderHome: () => this.#renderHomePage(),
      renderThemes: () => this.#renderThemesOverview(),
      renderAffinity: (affinityId, themeId) => this.#renderAffinityPage(affinityId, themeId),
      renderExercise: (exerciseId) => this.#renderExercisePage(exerciseId),
      renderProgress: () => this.#renderProgressPage(),
      renderProfile: () => this.#renderProfilePage(),
    });
    this.uiEventsRuntime = window.createAtelierUiEventsRuntime({
      view: this.view,
      model: this.model,
      isReady: () => this.isReady,
      ensureReady: () => this.#ensureReadyFromUserGesture(),
      getCurrentAffinityId: () => this.currentAffinityId,
      getCurrentThemeId: () => this.currentThemeId,
      getDefaultThemeId: () => this.model.getDefaultThemeId(),
      saveProgress: () => this.#saveProgress(),
      submitExerciseCompletion: (exerciseId, trigger) => this.#completeExerciseWithFeedback(exerciseId, trigger),
      renderFromHash: () => this.#renderFromHash(),
      renderExercise: (exerciseId) => this.#renderExercisePage(exerciseId),
      showSaveReminder: (trigger, exerciseId) => this.#showSaveReminderModal(trigger, exerciseId),
      pickWorkFile: () => this.#pickWorkFileForCurrentExercise(),
      openWorkFile: () => this.#openWorkFileForCurrentExercise(),
      handleDownloadClick: (event, linkEl) => this.#handleExerciseDownloadClick(event, linkEl),
      storage: this.storage,
      getUserSession: () => this.userSession,
      setUserSession: (session) => {
        this.userSession = session;
      },
      setReady: (ready) => {
        this.isReady = ready;
      },
      resolveUserSession: (forcePrompt, options) => this.#resolveUserSession(forcePrompt, options),
      activateSession: (session, options) => this.#activateSession(session, options),
    });
    this.sessionRuntime = window.createAtelierSessionRuntime({
      storage: this.storage,
      view: this.view,
      progressFileName: settings.progressFileName,
      persistUserSnapshot: (snapshot) => this.persistenceRuntime.persistUserSnapshot(snapshot),
    });
    this.workFileRuntime = window.createAtelierWorkFileRuntime({
      storage: this.storage,
      view: this.view,
      model: this.model,
      officeAppName: settings.officeAppName,
      completedFileExtension: settings.completedFileExtension,
      getUserSession: () => this.userSession,
      getCurrentExerciseIdFromView: () => this.#getCurrentExerciseIdFromView(),
    });

    this.userModal = {
      root: document.getElementById("user-setup-modal"),
      status: document.getElementById("user-setup-status"),
      savedFoldersWrap: document.getElementById("user-setup-saved-folders-wrap"),
      savedFoldersSelect: document.getElementById("user-setup-saved-folders-select"),
      storageModeWrap: document.getElementById("user-setup-storage-mode-wrap"),
      localModeBtn: document.getElementById("user-setup-mode-local-btn"),
      serverModeBtn: document.getElementById("user-setup-mode-server-btn"),
      modeHelp: document.getElementById("user-setup-mode-help"),
      pickBtn: document.getElementById("user-setup-pick-root-btn"),
      firstNameInput: document.getElementById("user-setup-firstname-input"),
      cancelBtn: document.getElementById("user-setup-cancel-btn"),
      validateBtn: document.getElementById("user-setup-validate-btn"),
    };

    this.saveReminderModal = {
      root: document.getElementById("save-reminder-modal"),
      message: document.getElementById("save-reminder-message"),
      userFolder: document.getElementById("save-reminder-user-folder"),
      fileName: document.getElementById("save-reminder-file-name"),
      existingStatus: document.getElementById("save-reminder-existing-status"),
      cancelBtn: document.getElementById("save-reminder-cancel-btn"),
      continueBtn: document.getElementById("save-reminder-continue-btn"),
    };
    this.exerciseFeedbackModal = {
      root: document.getElementById("exercise-feedback-modal"),
      form: document.getElementById("exercise-feedback-form"),
      difficulty: document.querySelectorAll('input[name="exercise-feedback-difficulty"]'),
      clarity: document.querySelectorAll('input[name="exercise-feedback-clarity"]'),
      autonomy: document.querySelectorAll('input[name="exercise-feedback-autonomy"]'),
      comment: document.getElementById("exercise-feedback-comment"),
      status: document.getElementById("exercise-feedback-status"),
      cancelBtn: document.getElementById("exercise-feedback-cancel-btn"),
      continueBtn: document.getElementById("exercise-feedback-continue-btn"),
    };
    this.progressConflictModal = {
      root: document.getElementById("progress-conflict-modal"),
      title: document.getElementById("progress-conflict-title"),
      message: document.getElementById("progress-conflict-message"),
      currentLabel: document.getElementById("progress-conflict-current-label"),
      currentUpdatedAt: document.getElementById("progress-conflict-current-updated-at"),
      alternateLabel: document.getElementById("progress-conflict-alternate-label"),
      alternateUpdatedAt: document.getElementById("progress-conflict-alternate-updated-at"),
      status: document.getElementById("progress-conflict-status"),
      stayBtn: document.getElementById("progress-conflict-stay-btn"),
      switchBtn: document.getElementById("progress-conflict-switch-btn"),
    };
    this.reminderModalRuntime = window.createAtelierReminderModalRuntime({
      modalRefs: this.saveReminderModal,
      windowRef: window,
    });
    this.userSetupRuntime = window.createAtelierUserSetupRuntime({
      storage: this.storage,
      modalRefs: this.userModal,
      deriveInitials: (rootHandle, fallback) => this.#deriveInitials(rootHandle, fallback),
      documentRef: document,
      getPreferredStorageMode: () => this.#getPreferredStorageMode(),
      getRuntimeStatusLabel: () => this.#getRuntimeStatusLabel(),
      getConfiguredUserFoldersRootLabel: () => this.#getConfiguredUserFoldersRootLabel(),
    });
    this.progressRuntime = window.createAtelierProgressRuntime({
      persistenceRuntime: this.persistenceRuntime,
      view: this.view,
      model: this.model,
    });
    this.profileRuntime = window.createAtelierProfileRuntime({
      documentRef: document,
      persistenceRuntime: this.persistenceRuntime,
      view: this.view,
      storage: this.storage,
      getUserSession: () => this.userSession,
      setUserSession: (session) => {
        this.userSession = session;
      },
      getRuntimeStatusLabel: () => this.#getRuntimeStatusLabel(),
      getDeploymentConfig: () => this.deploymentConfig,
    });
  }

  init() {
    this.#bindStaticEvents();
    this.#bindDynamicEvents();
    window.addEventListener("hashchange", () => {
      this.persistenceRuntime.persistCurrentHash(window.location.hash);
      if (this.isReady) this.#renderFromHash();
    });

    if (!window.location.hash) {
      const restoredHash = this.persistenceRuntime.getPersistedHash();
      window.location.hash = restoredHash || "#home";
    } else {
      this.persistenceRuntime.persistCurrentHash(window.location.hash);
    }

    // Show the default landing page immediately while async storage/session
    // bootstrap resolves, so the UI never appears blank on slow or limited browsers.
    this.view.showPage("home");

    this.#bootstrap().catch(() => {
      this.view.setHeaderUser("", "");
      this.view.setProgressStatus("Erreur d'initialisation utilisateur.");
      this.view.showPage("home");
    });
  }

  async #bootstrap() {
    await this.#loadDeploymentRuntimeState();
    if (this.view && this.view.setRuntimeStatus) {
      this.view.setRuntimeStatus(this.#getRuntimeStatusLabel());
    }

    if (!this.storage || !this.storage.isSupported()) {
      const snapshot = this.persistenceRuntime.getPersistedUserSnapshot();
      if (snapshot && (snapshot.firstName || snapshot.initials)) {
        this.view.setHeaderUser(snapshot.firstName || "", snapshot.initials || "");
        this.view.setProgressUserPath(snapshot.folderName
          ? `Dernier dossier connu : ${snapshot.folderName}`
          : "Dernier dossier utilisateur connu.");
        this.view.setProgressStatus("Sauvegarde dossier indisponible, profil local affiche.");
        this.#renderFromHash();
        return;
      }
      this.view.setHeaderUser("", "");
      this.view.setProgressStatus("Ce navigateur ne permet pas la sauvegarde automatique locale (utiliser Edge/Chrome récents).");
      this.view.showPage("home");
      return;
    }

    const session = await this.#resolveUserSession(false, { allowPermissionPrompt: false });
    if (!session) {
      const snapshot = this.persistenceRuntime.getPersistedUserSnapshot();
      if (snapshot && (snapshot.firstName || snapshot.initials)) {
        this.view.setHeaderUser(snapshot.firstName || "", snapshot.initials || "");
        this.view.setProgressUserPath(snapshot.folderName
          ? `Dernier dossier connu : ${snapshot.folderName}`
          : "Dernier dossier utilisateur connu.");
        this.view.setProgressStatus("Profil local retrouve, mais l'acces au dossier doit etre reactive.");
        this.#renderFromHash();
        return;
      }
      this.view.setHeaderUser("", "");
      this.view.setProgressStatus("Aucun utilisateur configuré.");
      this.view.showPage("home");
      return;
    }
    if (session.permissionRequired) {
      this.pendingPermissionSession = session;
      this.view.setHeaderUser(session.firstName || "", session.initials || "");
      this.view.setProgressStatus("Accès dossier requis. Cliquez sur « Commencer maintenant » pour autoriser l'accès.");
      this.#renderFromHash();
      return;
    }

    await this.#activateSession(session, { render: true });
  }

  async #loadDeploymentRuntimeState() {
    if (typeof window.loadAtelierDeploymentConfig === "function") {
      this.deploymentConfig = await window.loadAtelierDeploymentConfig(window.getAtelierAppConfig ? window.getAtelierAppConfig() : undefined);
    }

    if (typeof window.checkAtelierServerAvailability === "function") {
      this.serverStatus = await window.checkAtelierServerAvailability(this.deploymentConfig || undefined);
    }
  }

  #getRuntimeStatusLabel() {
    const serverEnabled = Boolean(this.deploymentConfig && this.deploymentConfig.server && this.deploymentConfig.server.enabled);
    if (!serverEnabled) return "Mode local";
    if (this.serverStatus && this.serverStatus.available) return "Serveur local disponible";
    return "Serveur local indisponible, mode local";
  }

  #getPreferredStorageMode() {
    if (this.serverStatus && this.serverStatus.available) return "server";
    return "local";
  }

  #getConfiguredUserFoldersRootLabel() {
    if (!this.deploymentConfig || !this.deploymentConfig.networkShares) return "";
    return String(this.deploymentConfig.networkShares.userFoldersRoot || "").trim();
  }

  #bindStaticEvents() {
    this.uiEventsRuntime.bindExerciseNavigationEvents();
    this.uiEventsRuntime.bindUserAccountEvents();
  }

  #bindDynamicEvents() {
    this.uiEventsRuntime.bindDynamicEvents();
  }

  #renderFromHash() {
    this.routeRuntime.renderFromHash(window.location.hash);
  }

  #renderHomePage() {
    this.homeRuntime.render();
  }
  #renderThemesOverview() {
    this.themesRuntime.renderOverview();
  }

  #renderAffinityPage(affinityId, themeId) {
    this.themesRuntime.renderAffinityPage(affinityId, themeId);
  }

  #renderExercisePage(exerciseId) {
    this.exerciseRuntime.render(exerciseId);
  }

  #renderProgressPage() {
    this.progressRuntime.render();
  }

  // FIX 2 — Page Profil : affiche les infos utilisateur et permet de modifier le prénom inline.
  // Prérequis HTML : <div id="profile-user-section"></div> dans #page-profile.
  #renderProfilePage() {
    this.profileRuntime.render();
  }

  #deriveInitials(rootHandle, fallback = "") {
    return this.sessionRuntime.deriveInitials(rootHandle, fallback);
  }

  async #activateSession(session, options = {}) {
    this.userSession = session;
    this.pendingPermissionSession = null;
    await this.#loadProgressForSession(session);
    this.isReady = true;
    if (options.targetHash && String(options.targetHash).trim()) {
      window.location.hash = String(options.targetHash).trim();
    }
    if (options.render) {
      this.#renderFromHash();
    }
  }

  async #resumePendingSessionFromUserGesture() {
    if (!this.pendingPermissionSession) return false;
    if (!this.pendingPermissionSession.rootHandle) {
      this.pendingPermissionSession = null;
      const session = await this.#resolveUserSession(true, { allowPermissionPrompt: true });
      if (!session) {
        this.view.setProgressStatus("Configuration utilisateur annulee.");
        return false;
      }
      await this.#activateSession(session, { render: true });
      return true;
    }

    const pending = this.pendingPermissionSession;
    let selectedHandle = pending.rootHandle;
    let ok = await this.storage.requestDirectoryPermission(selectedHandle, "readwrite");

    if (ok) {
      selectedHandle = await this.storage.resolveUserRootHandle(selectedHandle, pending.initials || "");
      ok = await this.storage.requestDirectoryPermission(selectedHandle, "readwrite");
    }

    if (!ok) {
      this.view.setProgressStatus("Accès au dossier refusé. Cliquez à nouveau sur « Commencer maintenant » pour réessayer.");
      return false;
    }

    await this.storage.setSavedRootHandle(selectedHandle);
    const session = await this.#resolveUserSession(false, { allowPermissionPrompt: false });
    if (!session || session.permissionRequired) {
      this.view.setProgressStatus("Impossible de restaurer la session. Rechoisissez un dossier utilisateur.");
      return false;
    }

    await this.#activateSession(session, { render: true });
    return true;
  }

  async #ensureReadyFromUserGesture() {
    if (this.isReady) return true;

    if (this.pendingPermissionSession) {
      return this.#resumePendingSessionFromUserGesture();
    }

    const session = await this.#resolveUserSession(true, { allowPermissionPrompt: true });
    if (!session) {
      this.view.setProgressStatus("Configuration utilisateur annulée.");
      return false;
    }

    await this.#activateSession(session);
    return true;
  }

  #getMostRecentSavedFolder(savedWorkFolders) {
    return this.sessionRuntime.getMostRecentSavedFolder(savedWorkFolders);
  }

  #getPreferredSavedFolder(savedWorkFolders) {
    return this.sessionRuntime.getPreferredSavedFolder(savedWorkFolders, this.#getPreferredStorageMode());
  }

  async #resolveExistingRootHandle(rootHandle, initials, allowPermissionPrompt) {
    return this.sessionRuntime.resolveExistingRootHandle(
      rootHandle,
      initials,
      allowPermissionPrompt,
      { storageMode: this.#getPreferredStorageMode() },
    );
  }

  async #hydrateExistingProfile(rootHandle, initials, firstName) {
    return this.sessionRuntime.hydrateExistingProfile(rootHandle, initials, firstName);
  }

  async #resolveUserSession(forcePrompt, options = {}) {
    const allowPermissionPrompt = options.allowPermissionPrompt !== false;
    let rootHandle = null;
    let initials = "";
    let firstName = "";
    let selectedStorageMode = this.#getPreferredStorageMode();
    let savedWorkFolders = await this.storage.getSavedWorkFolders();

    if (!forcePrompt) {
      rootHandle = await this.storage.getSavedRootHandle();
      initials = this.storage.normalizeInitials(await this.storage.getSavedInitials());
      firstName = this.storage.normalizeFirstName(await this.storage.getSavedFirstName());
      const snapshot = this.persistenceRuntime.getPersistedUserSnapshot();
      if (!firstName && snapshot && snapshot.firstName) {
        firstName = this.storage.normalizeFirstName(snapshot.firstName);
      }
      if (!initials && snapshot && snapshot.initials) {
        initials = this.storage.normalizeInitials(snapshot.initials);
      }

      if (!rootHandle && savedWorkFolders.length) {
        const latestFolder = this.#getPreferredSavedFolder(savedWorkFolders);
        rootHandle = latestFolder && latestFolder.handle ? latestFolder.handle : null;
        if (latestFolder && latestFolder.storageMode) {
          selectedStorageMode = String(latestFolder.storageMode).trim() || selectedStorageMode;
        }
      }

      if (rootHandle) {
        const resolvedRoot = await this.#resolveExistingRootHandle(rootHandle, initials, allowPermissionPrompt);
        rootHandle = resolvedRoot.rootHandle;
        if (resolvedRoot.savedWorkFolders) {
          savedWorkFolders = resolvedRoot.savedWorkFolders;
        }
        if (!resolvedRoot.accessible && !allowPermissionPrompt) {
          return {
            rootHandle,
            initials: this.#deriveInitials(rootHandle, initials),
            firstName,
            permissionRequired: true,
          };
        }
      }
      const hydratedProfile = await this.#hydrateExistingProfile(rootHandle, initials, firstName);
      initials = hydratedProfile.initials;
      firstName = hydratedProfile.firstName;

      if (!rootHandle && (firstName || initials)) {
        return {
          rootHandle: null,
          initials: initials || "USER",
          firstName,
          permissionRequired: true,
        };
      }
    }

    if (forcePrompt || !rootHandle || !firstName) {
      const picked = await this.#promptUserSetup(rootHandle, { initials, firstName, savedWorkFolders });
      if (!picked) return null;
      rootHandle = picked.rootHandle;
      initials = picked.initials;
      firstName = picked.firstName;
      selectedStorageMode = picked.storageMode || selectedStorageMode;
    }

    initials = this.#deriveInitials(rootHandle, initials);

    const session = {
      rootHandle,
      initials,
      firstName,
      permissionRequired: false,
      storageMode: selectedStorageMode || this.#getPreferredStorageMode(),
    };
    await this.sessionRuntime.persistResolvedSession(session);
    return session;
  }

  async #loadProgressForSession(session) {
    let loaded = await this.storage.loadProgress(session.rootHandle, session.initials);
    const alternateResolution = await this.#maybeResolveAlternateProgress(session, loaded);
    if (alternateResolution) {
      session.rootHandle = alternateResolution.rootHandle;
      session.storageMode = alternateResolution.storageMode;
      if (alternateResolution.firstName) session.firstName = alternateResolution.firstName;
      loaded = alternateResolution.progress;
    }
    let progressStatusMessage = "";
    if (loaded) {
      this.model.importProgressObject(loaded);
      progressStatusMessage = `Progression chargee pour ${session.firstName} (${session.initials}).`;
    } else {
      this.model.resetProgress();
      progressStatusMessage = `Nouveau profil ${session.firstName} (${session.initials}) cree.`;
      await this.#saveProgress();
    }

    const divergenceNotice = await this.#buildAlternateProgressNotice(session, loaded);
    this.view.setProgressStatus(divergenceNotice
      ? `${progressStatusMessage} ${divergenceNotice}`
      : progressStatusMessage);

    this.sessionRuntime.syncSessionIdentity(session);

    const currentHash = String(window.location.hash || "").trim();
    if (!currentHash || currentHash === "#home") {
      const fallbackHash = this.persistenceRuntime.buildFallbackHashFromUiState();
      if (fallbackHash && fallbackHash !== currentHash) {
        window.location.hash = fallbackHash;
      }
    }
  }

  async #buildAlternateProgressNotice(session, currentProgress) {
    if (!session || !session.rootHandle || !session.initials) return "";

    const alternateFolder = await this.#findAlternateSavedFolder(session);
    if (!alternateFolder) return "";

    const alternateInitials = this.sessionRuntime.deriveInitials(alternateFolder.handle, session.initials);
    const alternateProgress = await this.storage.loadProgress(alternateFolder.handle, alternateInitials);
    if (!alternateProgress) return "";

    const currentUpdatedAt = this.#extractProgressUpdatedAt(currentProgress);
    const alternateUpdatedAt = this.#extractProgressUpdatedAt(alternateProgress);
    if (!alternateUpdatedAt) return "";

    const alternateLabel = alternateFolder.storageMode === "server" ? "serveur" : "local";
    if (!currentUpdatedAt) {
      return `Une progression existe aussi cote ${alternateLabel}.`;
    }
    if (alternateUpdatedAt > currentUpdatedAt) {
      return `Attention : une version ${alternateLabel} plus recente a ete detectee.`;
    }
    if (alternateUpdatedAt < currentUpdatedAt) {
      return `Information : une version ${alternateLabel} plus ancienne existe aussi.`;
    }
    return "";
  }

  async #maybeResolveAlternateProgress(session, currentProgress) {
    if (!session || !session.rootHandle || !session.initials) return null;

    const alternateFolder = await this.#findAlternateSavedFolder(session);
    if (!alternateFolder) return null;

    const alternateInitials = this.sessionRuntime.deriveInitials(alternateFolder.handle, session.initials);
    const alternateProgress = await this.storage.loadProgress(alternateFolder.handle, alternateInitials);
    if (!alternateProgress) return null;

    const currentUpdatedAt = this.#extractProgressUpdatedAt(currentProgress);
    const alternateUpdatedAt = this.#extractProgressUpdatedAt(alternateProgress);
    const alternateLabel = alternateFolder.storageMode === "server" ? "serveur" : "local";

    let shouldSwitch = false;
    if (!currentProgress && alternateProgress) {
      shouldSwitch = await this.#confirmAlternateProgress({
        title: "Progression detectee",
        message: `Une progression existe sur le dossier ${alternateLabel}. Voulez-vous l'utiliser maintenant ?`,
        currentLabel: session.storageMode === "server" ? "Version serveur" : "Version locale",
        currentUpdatedAt,
        alternateLabel: alternateFolder.storageMode === "server" ? "Version serveur" : "Version locale",
        alternateUpdatedAt,
        switchLabel: "Utiliser cette version",
      });
    } else if (alternateUpdatedAt && (!currentUpdatedAt || alternateUpdatedAt > currentUpdatedAt)) {
      shouldSwitch = await this.#confirmAlternateProgress({
        title: "Version plus recente detectee",
        message: `Une version ${alternateLabel} plus recente a ete detectee. Voulez-vous l'utiliser maintenant ?`,
        currentLabel: session.storageMode === "server" ? "Version serveur actuelle" : "Version locale actuelle",
        currentUpdatedAt,
        alternateLabel: alternateFolder.storageMode === "server" ? "Version serveur proposee" : "Version locale proposee",
        alternateUpdatedAt,
        switchLabel: "Basculer vers la version recente",
      });
    }

    if (!shouldSwitch) return null;

    let firstName = session.firstName || "";
    try {
      const profile = await this.storage.loadUserProfile(alternateFolder.handle, alternateInitials, false);
      if (profile && profile.firstName) {
        firstName = this.storage.normalizeFirstName(profile.firstName);
      }
    } catch {
      // ignore unreadable alternate profile
    }

    const nextSession = {
      ...session,
      rootHandle: alternateFolder.handle,
      initials: alternateInitials,
      firstName,
      storageMode: alternateFolder.storageMode || (session.storageMode === "server" ? "local" : "server"),
    };
    await this.sessionRuntime.persistResolvedSession(nextSession);
    return {
      rootHandle: nextSession.rootHandle,
      storageMode: nextSession.storageMode,
      firstName: nextSession.firstName,
      progress: alternateProgress,
    };
  }

  async #confirmAlternateProgress(details) {
    const refs = this.progressConflictModal;
    if (
      !refs
      || !refs.root
      || !refs.message
      || !refs.stayBtn
      || !refs.switchBtn
    ) {
      if (typeof window.confirm !== "function") return false;
      try {
        return Boolean(window.confirm(details && details.message ? details.message : ""));
      } catch {
        return false;
      }
    }

    const formatUpdatedAt = (value) => {
      const raw = String(value || "").trim();
      if (!raw) return "Non disponible";
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) return raw;
      return date.toLocaleString("fr-FR");
    };

    return new Promise((resolve) => {
      if (refs.title) refs.title.textContent = details && details.title ? details.title : "Choix de progression";
      refs.message.textContent = details && details.message ? details.message : "";
      if (refs.currentLabel) refs.currentLabel.textContent = details && details.currentLabel ? details.currentLabel : "Version actuelle";
      if (refs.currentUpdatedAt) refs.currentUpdatedAt.textContent = formatUpdatedAt(details && details.currentUpdatedAt);
      if (refs.alternateLabel) refs.alternateLabel.textContent = details && details.alternateLabel ? details.alternateLabel : "Version proposee";
      if (refs.alternateUpdatedAt) refs.alternateUpdatedAt.textContent = formatUpdatedAt(details && details.alternateUpdatedAt);
      if (refs.status) refs.status.textContent = "Choisissez la version a garder pour cette session.";
      refs.switchBtn.textContent = details && details.switchLabel ? details.switchLabel : "Utiliser cette version";

      const close = (result) => {
        refs.root.style.display = "none";
        refs.root.setAttribute("aria-hidden", "true");
        refs.stayBtn.onclick = null;
        refs.switchBtn.onclick = null;
        window.removeEventListener("keydown", onKeydown);
        resolve(result);
      };

      const onKeydown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close(false);
        }
      };

      refs.stayBtn.onclick = () => close(false);
      refs.switchBtn.onclick = () => close(true);
      window.addEventListener("keydown", onKeydown);
      refs.root.style.display = "flex";
      refs.root.setAttribute("aria-hidden", "false");
      refs.switchBtn.focus();
    });
  }

  #extractProgressUpdatedAt(progressObject) {
    if (!progressObject || typeof progressObject !== "object") return "";
    const fromMeta = progressObject.meta && typeof progressObject.meta.updatedAt === "string"
      ? progressObject.meta.updatedAt.trim()
      : "";
    if (fromMeta) return fromMeta;
    return typeof progressObject.updatedAt === "string" ? progressObject.updatedAt.trim() : "";
  }

  async #findAlternateSavedFolder(session) {
    const savedWorkFolders = await this.storage.getSavedWorkFolders();
    const oppositeMode = session.storageMode === "server" ? "local" : "server";

    for (const folder of savedWorkFolders) {
      if (!folder || !folder.handle) continue;
      if (String(folder.storageMode || "").trim() !== oppositeMode) continue;

      let sameEntry = false;
      try {
        sameEntry = await folder.handle.isSameEntry(session.rootHandle);
      } catch {
        sameEntry = folder.name === (session.rootHandle.name || folder.name);
      }
      if (sameEntry) continue;

      const folderInitials = this.sessionRuntime.deriveInitials(folder.handle, "");
      if (folderInitials !== session.initials) continue;

      try {
        const profile = await this.storage.loadUserProfile(folder.handle, folderInitials, false);
        if (profile && profile.firstName && session.firstName) {
          const left = this.storage.normalizeFirstName(profile.firstName).toLowerCase();
          const right = this.storage.normalizeFirstName(session.firstName).toLowerCase();
          if (left && right && left !== right) continue;
        }
      } catch {
      }

      return folder;
    }

    return null;
  }

  #saveProgress() {
    if (!this.userSession) return;

    this.saveQueue = this.saveQueue
      .then(async () => {
        const progressObject = JSON.parse(this.model.exportProgressJson());
        progressObject.meta = {
          ...(progressObject.meta && typeof progressObject.meta === "object" ? progressObject.meta : {}),
          updatedAt: typeof progressObject.updatedAt === "string" ? progressObject.updatedAt : new Date().toISOString(),
          deviceId: this.deploymentConfig && this.deploymentConfig.environment
            ? String(this.deploymentConfig.environment.label || "").trim()
            : "",
          storageMode: this.userSession.storageMode || "local",
        };
        const usabilityReport = typeof this.model.getUsabilityReport === "function"
          ? this.model.getUsabilityReport()
          : null;
        await this.storage.saveProgress(
          this.userSession.rootHandle,
          this.userSession.initials,
          progressObject,
        );
        if (usabilityReport && typeof this.storage.saveUsabilityReport === "function") {
          const reportPayload = {
            generatedAt: new Date().toISOString(),
            user: {
              initials: this.userSession.initials,
              firstName: this.userSession.firstName,
              folderName: this.userSession.rootHandle && this.userSession.rootHandle.name
                ? this.userSession.rootHandle.name
                : "",
            },
            report: usabilityReport,
          };
          await this.storage.saveUsabilityReport(
            this.userSession.rootHandle,
            this.userSession.initials,
            reportPayload,
          );
          if (typeof this.storage.saveUsabilityReportMarkdown === "function") {
            await this.storage.saveUsabilityReportMarkdown(
              this.userSession.rootHandle,
              this.userSession.initials,
              this.#buildUsabilityReportMarkdown(reportPayload),
            );
          }
        }
      })
      .catch(() => {
        this.view.setProgressStatus("Erreur de sauvegarde. Vérifiez les permissions du dossier utilisateur.");
      });
  }

  #buildUsabilityReportMarkdown(reportPayload) {
    const payload = reportPayload && typeof reportPayload === "object" ? reportPayload : {};
    const user = payload.user || {};
    const report = payload.report || {};
    const lines = [
      "# Rapport d'usabilite",
      "",
      `Genere le : ${String(payload.generatedAt || "")}`,
      `Utilisateur : ${String(user.firstName || "")} (${String(user.initials || "")})`.trim(),
    ];

    if (user.folderName) {
      lines.push(`Dossier : ${String(user.folderName)}`);
    }

    lines.push(
      "",
      "## Synthese",
      "",
      `- Feedbacks : ${Number(report.totalFeedback || 0)}`,
      `- Difficulte moyenne : ${report.difficultyAverage ?? "-"}/3`,
      `- Clarte moyenne : ${report.clarityAverage ?? "-"}/3`,
      `- Autonomie moyenne : ${report.autonomyAverage ?? "-"}/3`,
    );

    if (report.lastFeedback) {
      lines.push(
        "",
        "## Dernier retour",
        "",
        `- Exercice : ${String(report.lastFeedback.exerciseLabel || "")}`,
        `- Date : ${String(report.lastFeedback.submittedAt || "")}`,
        `- Difficulte : ${String(report.lastFeedback.difficultyLabel || "")}`,
        `- Clarte : ${String(report.lastFeedback.clarityLabel || "")}`,
        `- Autonomie : ${String(report.lastFeedback.autonomyLabel || "")}`,
      );
      if (report.lastFeedback.comment) {
        lines.push(`- Commentaire : ${String(report.lastFeedback.comment)}`);
      }
    }

    lines.push("", "## Exercices a surveiller", "");
    if (Array.isArray(report.flaggedExercises) && report.flaggedExercises.length) {
      for (const row of report.flaggedExercises) {
        lines.push(`### ${String(row.exerciseLabel || "")}`);
        lines.push(`- Signaux : ${Array.isArray(row.flags) ? row.flags.join(", ") : ""}`);
        lines.push(`- Difficulte : ${String(row.difficultyLabel || "")}`);
        lines.push(`- Clarte : ${String(row.clarityLabel || "")}`);
        lines.push(`- Autonomie : ${String(row.autonomyLabel || "")}`);
        if (row.comment) {
          lines.push(`- Commentaire : ${String(row.comment)}`);
        }
        lines.push("");
      }
    } else {
      lines.push("Aucun point de vigilance remonte pour le moment.", "");
    }

    return `${lines.join("\n").trim()}\n`;
  }

  async #completeExerciseWithFeedback(exerciseId, trigger) {
    if (!exerciseId || this.model.getIsDone(exerciseId)) return false;
    const feedback = await this.#showExerciseFeedbackModal(exerciseId, trigger);
    if (!feedback) return false;

    this.model.setExerciseFeedback(exerciseId, feedback);
    this.model.markExerciseDone(exerciseId, true);
    this.#saveProgress();
    return true;
  }

  #showExerciseFeedbackModal(exerciseId, trigger) {
    return new Promise((resolve) => {
      const refs = this.exerciseFeedbackModal;
      const exercise = this.model.getExerciseById(exerciseId);
      const existing = this.model.getExerciseFeedback(exerciseId);
      if (!refs.root || !refs.form || !refs.difficulty || !refs.clarity || !refs.autonomy || !refs.continueBtn) {
        resolve({
          difficulty: existing && existing.difficulty ? existing.difficulty : "adapted",
          clarity: existing && existing.clarity ? existing.clarity : "medium",
          autonomy: existing && existing.autonomy ? existing.autonomy : "partial",
          comment: existing && existing.comment ? existing.comment : "",
        });
        return;
      }

      const titleEl = refs.root.querySelector("#exercise-feedback-title");
      const saveMessageEl = refs.root.querySelector("#exercise-feedback-save-message");
      const saveStepsEl = refs.root.querySelector("#exercise-feedback-save-steps");
      if (titleEl) titleEl.textContent = "Avant de terminer";
      const folderLabel = this.#getSaveReminderFolderLabel();
      const expectedFileName = this.#getSaveReminderFileName(exerciseId);
      if (saveMessageEl) {
        saveMessageEl.textContent = "";
      }
      if (saveStepsEl) {
        saveStepsEl.innerHTML = this.#renderBeginnerSaveSteps(folderLabel, expectedFileName);
      }
      const userFolderEl = refs.root.querySelector("#exercise-feedback-user-folder");
      const fileNameEl = refs.root.querySelector("#exercise-feedback-file-name");
      if (userFolderEl) userFolderEl.textContent = folderLabel;
      if (fileNameEl) fileNameEl.textContent = expectedFileName;

      this.#setFeedbackToggleValue(refs.difficulty, existing && existing.difficulty ? existing.difficulty : "");
      this.#setFeedbackToggleValue(refs.clarity, existing && existing.clarity ? existing.clarity : "");
      this.#setFeedbackToggleValue(refs.autonomy, existing && existing.autonomy ? existing.autonomy : "");
      if (refs.comment) refs.comment.value = existing && existing.comment ? existing.comment : "";
      if (refs.status) refs.status.textContent = "";

      const close = (result) => {
        refs.root.style.display = "none";
        refs.root.setAttribute("aria-hidden", "true");
        if (refs.cancelBtn) refs.cancelBtn.onclick = null;
        refs.continueBtn.onclick = null;
        window.removeEventListener("keydown", onKeydown);
        resolve(result);
      };

      const submit = () => {
        const payload = {
          difficulty: this.#getFeedbackToggleValue(refs.difficulty),
          clarity: this.#getFeedbackToggleValue(refs.clarity),
          autonomy: this.#getFeedbackToggleValue(refs.autonomy),
          comment: refs.comment ? refs.comment.value : "",
        };
        if (!payload.difficulty || !payload.clarity || !payload.autonomy) {
          if (refs.status) refs.status.textContent = "Selectionnez une reponse pour chaque question.";
          return;
        }
        close(payload);
      };

      const onKeydown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close(null);
        }
      };

      if (refs.cancelBtn) refs.cancelBtn.onclick = () => close(null);
      refs.continueBtn.onclick = submit;
      refs.form.onsubmit = (event) => {
        event.preventDefault();
        submit();
      };
      window.addEventListener("keydown", onKeydown);
      refs.root.style.display = "flex";
      refs.root.setAttribute("aria-hidden", "false");
      const firstDifficultyOption = Array.from(refs.difficulty || []).find((input) => input instanceof HTMLElement);
      if (firstDifficultyOption) firstDifficultyOption.focus();
    });
  }

  #getFeedbackToggleValue(inputs) {
    const checked = Array.from(inputs || []).find((input) => input.checked);
    return checked ? checked.value : "";
  }

  #setFeedbackToggleValue(inputs, value) {
    for (const input of Array.from(inputs || [])) {
      input.checked = Boolean(value) && input.value === value;
    }
  }

  #getCurrentExerciseIdFromView() {
    if (!this.view || !this.view.exerciseToggleDoneBtn) return "";
    return String(this.view.exerciseToggleDoneBtn.getAttribute("data-id") || "").trim();
  }

  #buildWorkFileProfileKey() {
    return this.workFileRuntime.buildWorkFileProfileKey();
  }

  async #refreshExerciseWorkFileState(exerciseId, options = {}) {
    const token = ++this.exerciseWorkFileToken;
    await this.workFileRuntime.refreshExerciseWorkFileState(exerciseId, options);
    if (token !== this.exerciseWorkFileToken) return;
  }

  async #pickWorkFileForCurrentExercise() {
    if (!this.isReady || !this.userSession || !this.storage) return;
    const exerciseId = this.#getCurrentExerciseIdFromView();
    if (!exerciseId) return;

    if (!this.storage.supportsWorkFilePicker || !this.storage.supportsWorkFilePicker()) {
      await this.#refreshExerciseWorkFileState(exerciseId, {
        statusText: "S\u00e9lection du fichier indisponible sur ce navigateur.",
      });
      return;
    }

    const profileKey = this.#buildWorkFileProfileKey();
    const expected = await this.storage.getSavedExerciseDownload(profileKey, exerciseId);

    try {
      const handle = await this.storage.pickWorkFile({
        startIn: this.userSession.rootHandle || "downloads",
      });

      if (!handle) {
        await this.#refreshExerciseWorkFileState(exerciseId, {
          statusText: "S\u00e9lection du fichier annul\u00e9e.",
        });
        return;
      }

      await this.storage.setSavedExerciseFile(profileKey, exerciseId, handle);
      const selectedName = handle.name || "fichier s\u00e9lectionn\u00e9";
      const expectedName = expected && expected.fileName ? expected.fileName : "";
      const mismatchText = expectedName && selectedName !== expectedName
        ? ` Attention, le fichier attendu \u00e9tait ${expectedName}.`
        : "";

      await this.#refreshExerciseWorkFileState(exerciseId, {
        statusText: `Fichier s\u00e9lectionn\u00e9 : ${selectedName}.${mismatchText}`,
      });
    } catch {
      await this.#refreshExerciseWorkFileState(exerciseId, {
        statusText: "Impossible de s\u00e9lectionner le fichier.",
      });
    }
  }

  async #openWorkFileForCurrentExercise() {
    if (!this.isReady || !this.userSession || !this.storage) return;
    const exerciseId = this.#getCurrentExerciseIdFromView();
    if (!exerciseId) return;

    if (!this.storage.supportsWorkFilePicker || !this.storage.supportsWorkFilePicker()) {
      await this.#refreshExerciseWorkFileState(exerciseId, {
        statusText: "S\u00e9lection du fichier indisponible sur ce navigateur.",
      });
      return;
    }

    const profileKey = this.#buildWorkFileProfileKey();
    const entry = await this.storage.getSavedExerciseDownload(profileKey, exerciseId);
    if (!entry || !entry.fileName) {
      await this.#refreshExerciseWorkFileState(exerciseId, {
        statusText: "T\u00e9l\u00e9chargez d'abord le fichier de l'exercice, puis s\u00e9lectionnez-le ici.",
      });
      return;
    }

    await this.storage.touchSavedExerciseDownload(profileKey, exerciseId);
    const canContinue = await this.#showWorkFilePickerReminderModal();
    if (!canContinue) return;
    await this.#pickWorkFileForCurrentExercise();
  }

  #getCanonicalExerciseDownloadFileName(exerciseId, downloadUrl) {
    return this.workFileRuntime.getCanonicalExerciseDownloadFileName(exerciseId, downloadUrl);
  }

  #getDownloadFileNameFromLink(linkEl) {
    return this.workFileRuntime.getDownloadFileNameFromLink(linkEl);
  }

  async #handleExerciseDownloadClick(event, linkEl) {
    if (event) event.preventDefault();
    if (!linkEl) return;

    const href = linkEl.getAttribute("href");
    if (!href) return;

    const fileName = this.#getDownloadFileNameFromLink(linkEl);
    const canContinue = await this.#showDownloadReminderModal(fileName);
    if (!canContinue) return;

    await this.#trackExerciseDownloadFromLink(linkEl);
    this.#openDownloadLink(linkEl);
  }

  #openDownloadLink(linkEl) {
    const href = linkEl.getAttribute("href");
    if (!href) return;

    const downloadName = this.#getDownloadFileNameFromLink(linkEl);
    const target = linkEl.getAttribute("target") || "_blank";
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.rel = linkEl.getAttribute("rel") || "noopener";
    anchor.target = target;
    if (downloadName) anchor.download = downloadName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  #escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async #buildDownloadExistingStatus(fileName) {
    return this.workFileRuntime.buildDownloadExistingStatus(fileName);
  }

  async #trackExerciseDownloadFromLink(linkEl) {
    if (!this.isReady) return;
    await this.workFileRuntime.trackExerciseDownloadFromLink(linkEl);
  }

  #getSaveReminderFolderLabel() {
    return this.workFileRuntime.getSaveReminderFolderLabel();
  }

  #getDefaultSaveReminderFileName() {
    return this.workFileRuntime.getDefaultSaveReminderFileName();
  }

  #getNumberedSaveReminderFileName(exerciseNumber) {
    return this.workFileRuntime.getNumberedSaveReminderFileName(exerciseNumber);
  }

  #getDefaultOfficeDocumentName() {
    const appName = String(settings.officeAppName || "").toLowerCase();
    if (appName.includes("excel")) return "Classeur1";
    if (appName.includes("powerpoint")) return "Présentation1";
    return "Document1";
  }

  #renderBeginnerSaveSteps(folderLabel, fileName) {
    const app = settings.officeAppName;
    const closeIcon = `<span class="word-close-icon" aria-hidden="true" title="Fermer">×</span>`;
    return `
            <li>Regardez le nom affiché tout en haut de la fenêtre de ${app}.</li>
            <li><strong>Si vous voyez déjà le nom de votre fichier</strong>, cliquez sur <span aria-hidden="true">&#128190;</span> <strong>Enregistrer</strong> (en haut à gauche).</li>
            <li><strong>Si vous voyez « ${this.#getDefaultOfficeDocumentName()} »</strong> : votre travail n'est pas encore enregistré.
              <ul class="save-reminder-substeps">
                <li>Cliquez sur <strong>Fichier</strong>, puis sur <strong>Enregistrer sous</strong>.</li>
                <li>Cliquez sur <strong>Parcourir</strong>, puis sur <strong>Documents</strong>.</li>
                <li>Ouvrez votre dossier <code>${this.#escapeHtml(folderLabel)}</code> (double-clic).</li>
                <li>Dans <strong>Nom du fichier</strong>, écrivez <code>${this.#escapeHtml(fileName)}</code>.</li>
                <li>Cliquez sur <strong>Enregistrer</strong>.</li>
              </ul>
            </li>
            <li>Si un message indique que le fichier existe déjà, cliquez sur <strong>Oui</strong> pour le remplacer.</li>
            <li>Pour finir, fermez ${app} en cliquant sur ${closeIcon} (en haut à droite).</li>
          `;
  }

  #getSaveReminderFileName(exerciseId) {
    return this.workFileRuntime.getSaveReminderFileName(exerciseId);
  }

  #setSaveReminderContent({
    title,
    message,
    steps,
    continueLabel = "Continuer",
    existingStatusHtml = "",
    existingStatusImportant = false,
    numberedSteps = true,
  }) {
    this.reminderModalRuntime.setContent({
      title,
      message,
      steps,
      continueLabel,
      existingStatusHtml,
      existingStatusImportant,
      numberedSteps,
    });
  }

  async #showDownloadReminderModal(downloadFileName) {
    const existingStatus = await this.#buildDownloadExistingStatus(downloadFileName);

    return new Promise((resolve) => {
      const modal = this.saveReminderModal.root;
      const userFolder = this.saveReminderModal.userFolder;
      const fileName = this.saveReminderModal.fileName;
      const cancelBtn = this.saveReminderModal.cancelBtn;
      const continueBtn = this.saveReminderModal.continueBtn;

      if (!modal || !userFolder || !fileName || !continueBtn) {
        resolve(true);
        return;
      }

      const folderLabel = this.#getSaveReminderFolderLabel();
      const cleanFileName = downloadFileName || "fichier";
      userFolder.textContent = folderLabel;
      fileName.textContent = cleanFileName;
      this.#setSaveReminderContent({
        title: "Avant de t\u00e9l\u00e9charger",
        message: `Pensez \u00e0 enregistrer le fichier dans votre dossier ${folderLabel}.`,
        steps: `
          <li>Le t\u00e9l\u00e9chargement va d\u00e9marrer apr\u00e8s ce message.</li>
          <li>Dans la fen\u00eatre d'enregistrement, choisissez votre dossier utilisateur : <code id="save-reminder-user-folder"></code>.</li>
          <li>Conservez ou retrouvez le fichier <code id="save-reminder-file-name"></code>.</li>
          <li>Ouvrez ensuite le fichier dans ${settings.officeAppName}.</li>
        `,
        continueLabel: "T\u00e9l\u00e9charger",
        existingStatusHtml: existingStatus.html,
        existingStatusImportant: existingStatus.important,
      });

      const nextUserFolder = modal.querySelector("#save-reminder-user-folder");
      const nextFileName = modal.querySelector("#save-reminder-file-name");
      if (nextUserFolder) nextUserFolder.textContent = folderLabel;
      if (nextFileName) nextFileName.textContent = cleanFileName;

      this.reminderModalRuntime.show().then(resolve);
    });
  }

  #showWorkFilePickerReminderModal() {
    return new Promise((resolve) => {
      const modal = this.saveReminderModal.root;
      const fileName = this.saveReminderModal.fileName;
      const cancelBtn = this.saveReminderModal.cancelBtn;
      const continueBtn = this.saveReminderModal.continueBtn;

      if (!modal || !fileName || !continueBtn) {
        resolve(true);
        return;
      }

      fileName.textContent = "T\u00e9l\u00e9chargements";
      this.#setSaveReminderContent({
        title: "Avant de choisir le fichier",
        message: "Pensez \u00e0 v\u00e9rifier dans le dossier \"T\u00e9l\u00e9chargements\" si vous ne voyez pas votre fichier ici.",
        steps: `
          <li>Le s\u00e9lecteur de fichier va s'ouvrir apr\u00e8s ce message.</li>
          <li>Si le fichier n'appara\u00eet pas dans votre dossier utilisateur, regardez aussi dans <code id="save-reminder-file-name"></code>.</li>
        `,
        continueLabel: "Choisir le fichier",
      });

      const nextFileName = modal.querySelector("#save-reminder-file-name");
      if (nextFileName) nextFileName.textContent = "T\u00e9l\u00e9chargements";

      this.reminderModalRuntime.show().then(resolve);
    });
  }

  #showSaveReminderModal(trigger, exerciseId) {
    return new Promise((resolve) => {
      const modal = this.saveReminderModal.root;
      const message = this.saveReminderModal.message;
      const userFolder = this.saveReminderModal.userFolder;
      const fileName = this.saveReminderModal.fileName;
      const cancelBtn = this.saveReminderModal.cancelBtn;
      const continueBtn = this.saveReminderModal.continueBtn;

      if (!modal || !message || !userFolder || !fileName || !continueBtn) {
        resolve(true);
        return;
      }

      const folderLabel = this.#getSaveReminderFolderLabel();
      const expectedFileName = this.#getSaveReminderFileName(exerciseId);
      userFolder.textContent = folderLabel;
      fileName.textContent = expectedFileName;
      const isDoneTrigger = trigger === "done";
      const reminderSteps = this.#renderBeginnerSaveSteps(folderLabel, expectedFileName);
      this.#setSaveReminderContent({
        title: "Vous avez termin\u00e9 ?",
        message: isDoneTrigger
          ? "Pensez \u00e0 enregistrer votre travail dans votre dossier avant de marquer l'exercice comme fait."
          : "Pensez \u00e0 enregistrer votre travail dans votre dossier avant de passer \u00e0 l'exercice suivant.",
        steps: reminderSteps,
        numberedSteps: true,
      });
      const nextUserFolder = modal.querySelector("#save-reminder-user-folder");
      const nextFileName = modal.querySelector("#save-reminder-file-name");
      if (nextUserFolder) nextUserFolder.textContent = folderLabel;
      if (nextFileName) nextFileName.textContent = expectedFileName;

      this.reminderModalRuntime.show().then(resolve);
    });
  }

  #promptUserSetup(initialRootHandle, defaults = {}) {
    return this.userSetupRuntime.show(initialRootHandle, defaults);

  }
}

  ;
}

window.createAtelierController = createAtelierController;
})();
