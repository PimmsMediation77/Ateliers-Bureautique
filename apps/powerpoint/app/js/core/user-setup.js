(() => {
function createAtelierUserSetupRuntime(config = {}) {
  const storage = config.storage;
  const modalRefs = config.modalRefs || {};
  const deriveInitials = typeof config.deriveInitials === "function"
    ? config.deriveInitials
    : (_rootHandle, fallback = "") => fallback;
  const documentRef = config.documentRef || document;
  const hasScannedDocuments = Boolean(config.hasScannedDocuments);
  const getPreferredStorageMode = typeof config.getPreferredStorageMode === "function"
    ? config.getPreferredStorageMode
    : () => "local";
  const getRuntimeStatusLabel = typeof config.getRuntimeStatusLabel === "function"
    ? config.getRuntimeStatusLabel
    : () => "Mode local";
  const getConfiguredUserFoldersRootLabel = typeof config.getConfiguredUserFoldersRootLabel === "function"
    ? config.getConfiguredUserFoldersRootLabel
    : () => "";

  function createFolderId() {
    return `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  return {
    show(initialRootHandle, defaults = {}) {
      return new Promise((resolve) => {
        const modal = modalRefs.root;
        const status = modalRefs.status;
        const savedFoldersWrap = modalRefs.savedFoldersWrap;
        const savedFoldersSelect = modalRefs.savedFoldersSelect;
        const storageModeWrap = modalRefs.storageModeWrap;
        const localModeBtn = modalRefs.localModeBtn;
        const serverModeBtn = modalRefs.serverModeBtn;
        const modeHelp = modalRefs.modeHelp;
        const pickBtn = modalRefs.pickBtn;
        const firstNameInput = modalRefs.firstNameInput;
        const firstNameLabel = modal ? modal.querySelector('label[for="user-setup-firstname-input"]') : null;
        const cancel = modalRefs.cancelBtn;
        const validate = modalRefs.validateBtn;

        if (!modal || !status || !pickBtn || !firstNameInput || !validate) {
          resolve(null);
          return;
        }

        let rootHandle = initialRootHandle || null;
        let resolvedInitials = deriveInitials(rootHandle, defaults.initials);
        let savedFolders = Array.isArray(defaults.savedWorkFolders) ? defaults.savedWorkFolders.slice() : [];
        let selectedSavedId = "";
        let preferredStorageMode = getPreferredStorageMode();
        let configuredUserFoldersRootLabel = getConfiguredUserFoldersRootLabel();

        const getFolderStorageMode = (folder) => {
          const value = folder && typeof folder.storageMode === "string" ? folder.storageMode.trim() : "";
          return value || "local";
        };

        const getFolderStorageLabel = (folder) => (
          getFolderStorageMode(folder) === "server" ? "serveur" : "local"
        );

        const buildEmptySelectionMessage = () => {
          if (preferredStorageMode === "server" && configuredUserFoldersRootLabel) {
            return `Ouvrez un dossier utilisateur existant sur le partage serveur configure : ${configuredUserFoldersRootLabel}.`;
          }
          if (preferredStorageMode === "server") {
            return "Ouvrez un dossier utilisateur existant sur le serveur local ou restez en mode local si besoin.";
          }
          return hasScannedDocuments
            ? "Choisissez ou creez un dossier de travail dans la liste ci-dessous."
            : "Cliquez sur le bouton ci-dessous pour choisir ou creer un dossier dans Documents.";
        };

        const closeModal = (result) => {
          modal.style.display = "none";
          modal.setAttribute("aria-hidden", "true");
          pickBtn.onclick = null;
          if (localModeBtn) localModeBtn.onclick = null;
          if (serverModeBtn) serverModeBtn.onclick = null;
          if (cancel) cancel.onclick = null;
          validate.onclick = null;
          firstNameInput.onkeydown = null;
          if (savedFoldersSelect) savedFoldersSelect.onchange = null;
          resolve(result);
        };

        if (cancel) {
          cancel.onclick = () => {
            status.textContent = "Configuration annulee.";
            closeModal(null);
          };
        }

        const setFirstNameVisibility = (visible) => {
          const displayValue = visible ? "" : "none";
          if (firstNameLabel) firstNameLabel.style.display = displayValue;
          firstNameInput.style.display = displayValue;
        };

        const setValidateVisibility = (visible) => {
          validate.style.display = visible ? "" : "none";
        };

        const findBestSavedFolderIdForMode = (mode) => {
          const ordered = [...savedFolders]
            .filter((folder) => getFolderStorageMode(folder) === mode)
            .sort((a, b) => {
              const left = Date.parse(a.lastUsedAt || "") || 0;
              const right = Date.parse(b.lastUsedAt || "") || 0;
              return right - left;
            });
          return ordered.length ? ordered[0].id : "";
        };

        const renderModeHelp = () => {
          if (!modeHelp) return;
          if (preferredStorageMode === "server" && configuredUserFoldersRootLabel) {
            modeHelp.textContent = `Mode serveur : ouvrez un dossier utilisateur existant depuis ${configuredUserFoldersRootLabel}.`;
            return;
          }
          if (preferredStorageMode === "server") {
            modeHelp.textContent = "Mode serveur : ouvrez un dossier deja present sur le partage reseau local.";
            return;
          }
          modeHelp.textContent = "Mode local : choisissez ou creez un dossier sur cette machine.";
        };

        const renderStorageModeButtons = () => {
          if (!storageModeWrap || !localModeBtn || !serverModeBtn) return;
          storageModeWrap.style.display = "";
          localModeBtn.setAttribute("aria-pressed", preferredStorageMode === "local" ? "true" : "false");
          serverModeBtn.setAttribute("aria-pressed", preferredStorageMode === "server" ? "true" : "false");
          localModeBtn.className = preferredStorageMode === "local" ? "btn" : "btn btn-soft";
          serverModeBtn.className = preferredStorageMode === "server" ? "btn" : "btn btn-soft";
          serverModeBtn.disabled = !configuredUserFoldersRootLabel && getRuntimeStatusLabel() === "Mode local";
          if (serverModeBtn.disabled) {
            serverModeBtn.title = "Le dossier serveur n'est pas disponible pour le moment.";
          } else {
            serverModeBtn.removeAttribute("title");
          }
          renderModeHelp();
        };

        const updateFolderStatus = () => {
          if (!rootHandle) {
            setValidateVisibility(false);
            status.textContent = buildEmptySelectionMessage();
            return;
          }
          setValidateVisibility(true);
          const selectedStorageLabel = preferredStorageMode === "server" ? "serveur" : "local";
          status.textContent = `Dossier ${selectedStorageLabel} selectionne : ${rootHandle.name || "dossier utilisateur"}.`;
        };

        const setPickButtonMode = (mode = "hidden") => {
          const folderIcon = String.fromCodePoint(0x1f4c1);
          if (mode === "pick-folder") {
            pickBtn.style.display = "";
            pickBtn.textContent = preferredStorageMode === "server"
              ? "Ouvrir un dossier serveur existant"
              : "Choisir ou creer un dossier local";
            pickBtn.setAttribute("data-icon", folderIcon);
            return;
          }

          if (mode === "add-folder") {
            pickBtn.style.display = "";
            pickBtn.textContent = preferredStorageMode === "server"
              ? "Ouvrir un autre dossier serveur"
              : "Choisir ou creer un autre dossier local";
            pickBtn.setAttribute("data-icon", folderIcon);
            return;
          }

          pickBtn.style.display = "none";
        };

        const setFirstNameEditMode = (canEdit) => {
          firstNameInput.readOnly = !canEdit;
          if (canEdit) {
            firstNameInput.removeAttribute("aria-readonly");
            firstNameInput.placeholder = "Ex. : Alice";
          } else {
            firstNameInput.setAttribute("aria-readonly", "true");
            firstNameInput.placeholder = "Prenom du dossier";
          }
        };

        const renderSavedFolders = () => {
          if (!savedFoldersWrap || !savedFoldersSelect) return;
          if (!savedFolders.length) {
            savedFoldersWrap.style.display = "none";
            savedFoldersSelect.innerHTML = "";
            return;
          }

          savedFoldersWrap.style.display = "";
          const ordered = [...savedFolders].sort((a, b) => {
            const aPreferred = getFolderStorageMode(a) === preferredStorageMode ? 1 : 0;
            const bPreferred = getFolderStorageMode(b) === preferredStorageMode ? 1 : 0;
            if (aPreferred !== bPreferred) return bPreferred - aPreferred;
            const left = Date.parse(a.lastUsedAt || "") || 0;
            const right = Date.parse(b.lastUsedAt || "") || 0;
            return right - left;
          });

          savedFoldersSelect.innerHTML = "";
          for (const folder of ordered) {
            const option = documentRef.createElement("option");
            option.value = folder.id;
            const storageLabel = getFolderStorageLabel(folder);
            option.textContent = folder.firstName
              ? `${folder.firstName} (${folder.name}) [${storageLabel}]`
              : `${folder.name || "Dossier de travail"} [${storageLabel}]`;
            savedFoldersSelect.appendChild(option);
          }

          const currentIds = new Set(ordered.map((folder) => folder.id));
          if (!selectedSavedId || !currentIds.has(selectedSavedId)) {
            selectedSavedId = ordered[0].id;
          }
          savedFoldersSelect.value = selectedSavedId;
        };

        const findSavedFolderIdByHandle = async (handle) => {
          if (!handle) return "";
          for (const folder of savedFolders) {
            try {
              if (await folder.handle.isSameEntry(handle)) return folder.id;
            } catch {
              if (folder.name === (handle.name || folder.name)) return folder.id;
            }
          }
          return "";
        };

        const mergeSavedFolders = async (incomingFolders) => {
          if (!Array.isArray(incomingFolders) || !incomingFolders.length) return savedFolders;
          const merged = savedFolders.slice();

          for (const incoming of incomingFolders) {
            const handle = incoming && incoming.handle;
            if (!handle || handle.kind !== "directory") continue;

            let existing = null;
            for (const folder of merged) {
              try {
                if (await folder.handle.isSameEntry(handle)) {
                  existing = folder;
                  break;
                }
              } catch {
                if (folder.name === (handle.name || folder.name)) {
                  existing = folder;
                  break;
                }
              }
            }

            if (existing) {
              existing.handle = handle;
              existing.name = handle.name || existing.name || "Dossier de travail";
              continue;
            }

            merged.push({
              id: String(incoming.id || createFolderId()),
              name: String(incoming.name || handle.name || "Dossier de travail").trim() || "Dossier de travail",
              handle,
              lastUsedAt: typeof incoming.lastUsedAt === "string" ? incoming.lastUsedAt : "",
              storageMode: typeof incoming.storageMode === "string" ? incoming.storageMode : "",
            });
          }

          savedFolders = merged;
          return savedFolders;
        };

        const applySavedFolderSelection = async (folderId, options = {}) => {
          const requestPermission = options.requestPermission !== false;
          const folder = savedFolders.find((entry) => entry.id === folderId);
          if (!folder) return;
          selectedSavedId = folderId;
          preferredStorageMode = getFolderStorageMode(folder);
          renderStorageModeButtons();
          renderSavedFolders();
          rootHandle = folder.handle || null;
          resolvedInitials = deriveInitials(rootHandle, "");
          firstNameInput.value = "";
          setFirstNameVisibility(false);

          if (!requestPermission) {
            const profile = await storage.loadUserProfile(rootHandle, resolvedInitials, false);
            firstNameInput.value = profile && profile.firstName ? profile.firstName : "";
            setFirstNameEditMode(true);
            setFirstNameVisibility(true);
            setValidateVisibility(true);
            updateFolderStatus();
            return;
          }

          try {
            let selectedHandle = rootHandle;
            let ok = await storage.ensureWritePermission(selectedHandle);
            if (ok) {
              selectedHandle = await storage.resolveUserRootHandle(selectedHandle, resolvedInitials);
              ok = await storage.ensureWritePermission(selectedHandle);
            }
            if (!ok) {
              status.textContent = "Permission refusee sur ce dossier. Selectionnez-en un autre ou ajoutez-en un nouveau.";
              return;
            }

            rootHandle = selectedHandle;
            resolvedInitials = deriveInitials(rootHandle, "");
            const profile = await storage.loadUserProfile(rootHandle, resolvedInitials, false);
            if (profile) {
              const profileInitials = storage.normalizeInitials(profile.initials);
              if (profileInitials) resolvedInitials = profileInitials;
              firstNameInput.value = profile.firstName || "";
            } else {
              firstNameInput.value = "";
            }
            setFirstNameEditMode(true);
            setFirstNameVisibility(true);
            setValidateVisibility(true);
            updateFolderStatus();
          } catch {
            setValidateVisibility(false);
            status.textContent = "Impossible d'ouvrir ce dossier. Selectionnez-en un autre.";
          }
        };

        pickBtn.onclick = async () => {
          const restoreMode = savedFolders.length ? "add-folder" : "pick-folder";
          setPickButtonMode("hidden");
          try {
            const handle = await storage.pickUserDirectory();
            if (!handle) {
              setPickButtonMode(restoreMode);
              status.textContent = "Selection annulee.";
              return;
            }

            const canWrite = await storage.ensureWritePermission(handle);
            if (!canWrite) {
              setPickButtonMode(restoreMode);
              status.textContent = "Permission refusee sur ce dossier.";
              return;
            }

            let resolvedHandle = handle;
            try {
              resolvedHandle = await storage.resolveUserRootHandle(handle, "") || handle;
            } catch {
              resolvedHandle = handle;
            }
            if (resolvedHandle !== handle) {
              const ok = await storage.ensureWritePermission(resolvedHandle);
              if (!ok) {
                setPickButtonMode(restoreMode);
                status.textContent = "Permission refusee sur ce dossier.";
                return;
              }
            }

            rootHandle = resolvedHandle;
            resolvedInitials = deriveInitials(rootHandle, "");

            const profile = await storage.loadUserProfile(rootHandle, resolvedInitials, false);
            if (profile) {
              if (profile.initials) resolvedInitials = storage.normalizeInitials(profile.initials);
              firstNameInput.value = profile.firstName || "";
            } else {
              firstNameInput.value = "";
            }
            setFirstNameEditMode(true);

            await mergeSavedFolders([{
              id: createFolderId(),
              name: rootHandle.name || "Dossier de travail",
              handle: rootHandle,
              storageMode: preferredStorageMode,
            }]);
            await storage.setSavedWorkFolders(savedFolders);
            renderSavedFolders();

            const newId = await findSavedFolderIdByHandle(rootHandle);
            if (newId) {
              selectedSavedId = newId;
              if (savedFoldersSelect) savedFoldersSelect.value = newId;
            }

            setPickButtonMode("add-folder");
            setFirstNameVisibility(true);
            setValidateVisibility(true);
            updateFolderStatus();
            if (!firstNameInput.readOnly) firstNameInput.focus();
          } catch (error) {
            setPickButtonMode(restoreMode);
            if (!error || error.name === "AbortError") {
              status.textContent = "Selection annulee.";
            } else {
              status.textContent = "Impossible d'ouvrir ce dossier.";
            }
          }
        };

        if (savedFoldersSelect) {
          savedFoldersSelect.onchange = async () => {
            selectedSavedId = savedFoldersSelect.value;
            await applySavedFolderSelection(selectedSavedId);
          };
        }

        if (localModeBtn) {
          localModeBtn.onclick = async () => {
            preferredStorageMode = "local";
            selectedSavedId = findBestSavedFolderIdForMode("local");
            rootHandle = null;
            renderStorageModeButtons();
            renderSavedFolders();
            if (selectedSavedId) {
              if (savedFoldersSelect) savedFoldersSelect.value = selectedSavedId;
              await applySavedFolderSelection(selectedSavedId, { requestPermission: false });
              return;
            }
            updateFolderStatus();
          };
        }

        if (serverModeBtn) {
          serverModeBtn.onclick = async () => {
            if (serverModeBtn.disabled) return;
            preferredStorageMode = "server";
            selectedSavedId = findBestSavedFolderIdForMode("server");
            rootHandle = null;
            renderStorageModeButtons();
            renderSavedFolders();
            if (selectedSavedId) {
              if (savedFoldersSelect) savedFoldersSelect.value = selectedSavedId;
              await applySavedFolderSelection(selectedSavedId, { requestPermission: false });
              return;
            }
            updateFolderStatus();
          };
        }

        const validateSelection = async () => {
          if (!rootHandle) {
            status.textContent = "Choisissez le dossier utilisateur avant de valider.";
            return;
          }

          const firstName = storage.normalizeFirstName(firstNameInput.value);
          if (!firstName) {
            status.textContent = "Votre prenom est obligatoire.";
            firstNameInput.focus();
            return;
          }

          try {
            let selectedHandle = rootHandle;
            let ok = await storage.ensureWritePermission(selectedHandle);
            if (ok) {
              selectedHandle = await storage.resolveUserRootHandle(selectedHandle, resolvedInitials);
              ok = await storage.ensureWritePermission(selectedHandle);
            }
            if (!ok) {
              status.textContent = "Permission refusee sur ce dossier. Selectionnez-en un autre ou ajoutez-en un nouveau.";
              return;
            }

            rootHandle = selectedHandle;
            const initials = deriveInitials(rootHandle, resolvedInitials);
            resolvedInitials = initials;
            await storage.ensureProgressDirectory(rootHandle, initials, true);
            closeModal({ rootHandle, initials, firstName, storageMode: preferredStorageMode });
          } catch {
            status.textContent = "Impossible de creer ou d'ouvrir le dossier utilisateur.";
          }
        };

        validate.onclick = () => {
          validateSelection();
        };

        firstNameInput.onkeydown = (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            validateSelection();
          }
        };

        modal.style.display = "flex";
        modal.setAttribute("aria-hidden", "false");
        preferredStorageMode = getPreferredStorageMode();
        configuredUserFoldersRootLabel = getConfiguredUserFoldersRootLabel();
        renderStorageModeButtons();
        resolvedInitials = deriveInitials(rootHandle, defaults.initials);
        firstNameInput.value = "";
        setFirstNameVisibility(false);
        setValidateVisibility(false);
        setFirstNameEditMode(false);

        (async () => {
          for (const folder of savedFolders) {
            if (!folder.firstName && folder.handle && storage.loadUserProfile) {
              try {
                const folderInitials = deriveInitials(folder.handle, "");
                const profile = await storage.loadUserProfile(folder.handle, folderInitials, false);
                if (profile && profile.firstName) {
                  folder.firstName = storage.normalizeFirstName
                    ? storage.normalizeFirstName(profile.firstName)
                    : profile.firstName;
                }
              } catch {
                // Ignore unreadable folders in the chooser.
              }
            }
          }
          renderSavedFolders();
          if (savedFolders.length > 0) {
            setPickButtonMode("add-folder");
            if (rootHandle) {
              selectedSavedId = await findSavedFolderIdByHandle(rootHandle);
            }
            if (!selectedSavedId && savedFoldersSelect && savedFoldersSelect.value) {
              selectedSavedId = savedFoldersSelect.value;
            }
            if (selectedSavedId) {
              if (savedFoldersSelect) savedFoldersSelect.value = selectedSavedId;
              await applySavedFolderSelection(selectedSavedId, { requestPermission: false });
            } else {
              updateFolderStatus();
            }
          } else {
            setPickButtonMode("pick-folder");
            updateFolderStatus();
          }
          if (firstNameInput.style.display !== "none") {
            firstNameInput.focus();
          }
        })();
      });
    },
  };
}

window.createAtelierUserSetupRuntime = createAtelierUserSetupRuntime;
})();
