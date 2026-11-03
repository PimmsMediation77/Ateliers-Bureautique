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

  function getFolderStorageMode(folder) {
    const value = folder && typeof folder.storageMode === "string" ? folder.storageMode.trim() : "";
    return value || "local";
  }

  function formatLastUsed(value) {
    const time = Date.parse(value || "");
    if (!time) return "";
    const date = new Date(time);
    const startOfDay = (input) => new Date(input.getFullYear(), input.getMonth(), input.getDate()).getTime();
    const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
    if (days <= 0) return "aujourd'hui";
    if (days === 1) return "hier";
    return `le ${date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
  }

  function buildCardInitials(folder) {
    const fromProfile = storage.normalizeInitials ? storage.normalizeInitials(folder.initials) : folder.initials;
    if (fromProfile) return String(fromProfile).slice(0, 3);
    const label = String(folder.firstName || folder.name || "?").trim();
    return label.slice(0, 2).toUpperCase() || "?";
  }

  return {
    show(initialRootHandle, defaults = {}) {
      return new Promise((resolve) => {
        const modal = modalRefs.root;
        const title = modalRefs.title;
        const status = modalRefs.status;
        const chooserWrap = modalRefs.chooserWrap;
        const userList = modalRefs.userList;
        const openOtherBtn = modalRefs.openOtherBtn;
        const formWrap = modalRefs.formWrap;
        const backBtn = modalRefs.backBtn;
        const storageModeWrap = modalRefs.storageModeWrap;
        const modeToggleBtn = modalRefs.modeToggleBtn;
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
        let preferredStorageMode = getPreferredStorageMode();
        let configuredUserFoldersRootLabel = getConfiguredUserFoldersRootLabel();
        let isOpeningFolder = false;

        const setTitle = (text) => {
          if (title) title.textContent = text;
        };

        const buildEmptySelectionMessage = () => {
          if (preferredStorageMode === "server" && configuredUserFoldersRootLabel) {
            return `Ouvrez votre dossier sur le partage serveur : ${configuredUserFoldersRootLabel}.`;
          }
          if (preferredStorageMode === "server") {
            return "Ouvrez votre dossier sur le serveur, ou choisissez « Sur cet ordinateur ».";
          }
          return hasScannedDocuments
            ? "Choisissez ou créez votre dossier de travail."
            : "Cliquez sur le bouton ci-dessous pour choisir ou créer votre dossier dans Documents.";
        };

        const closeModal = (result) => {
          modal.style.display = "none";
          modal.setAttribute("aria-hidden", "true");
          pickBtn.onclick = null;
          if (modeToggleBtn) modeToggleBtn.onclick = null;
          if (openOtherBtn) openOtherBtn.onclick = null;
          if (backBtn) backBtn.onclick = null;
          if (cancel) cancel.onclick = null;
          validate.onclick = null;
          firstNameInput.onkeydown = null;
          resolve(result);
        };

        if (cancel) {
          cancel.onclick = () => {
            status.textContent = "Changement d'utilisateur annulé.";
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

        const isServerAvailable = () => (
          Boolean(configuredUserFoldersRootLabel) || getRuntimeStatusLabel() !== "Mode local"
        );

        const renderStorageModeBadge = () => {
          if (!storageModeWrap) return;
          // Sans serveur disponible, il n'y a rien à choisir : le badge reste caché.
          storageModeWrap.style.display = isServerAvailable() ? "flex" : "none";
          const pin = String.fromCodePoint(0x1f4cd);
          if (modeHelp) {
            modeHelp.textContent = preferredStorageMode === "server"
              ? `${pin} Enregistrement : sur le serveur`
              : `${pin} Enregistrement : sur cet ordinateur`;
          }
          if (modeToggleBtn) {
            modeToggleBtn.setAttribute("aria-label", preferredStorageMode === "server"
              ? "Enregistrer plutôt sur cet ordinateur"
              : "Enregistrer plutôt sur le serveur");
          }
        };

        const updateFolderStatus = () => {
          if (!rootHandle) {
            setValidateVisibility(false);
            status.textContent = buildEmptySelectionMessage();
            return;
          }
          setValidateVisibility(true);
          status.textContent = `Dossier choisi : ${rootHandle.name || "dossier utilisateur"}. Indiquez votre prénom puis validez.`;
        };

        const setPickButtonMode = (mode = "hidden") => {
          if (mode === "hidden") {
            pickBtn.style.display = "none";
            return;
          }
          pickBtn.style.display = "";
          pickBtn.setAttribute("data-icon", String.fromCodePoint(0x1f4c1));
          if (mode === "change-folder") {
            pickBtn.textContent = "Choisir un autre dossier";
            return;
          }
          pickBtn.textContent = preferredStorageMode === "server"
            ? "Ouvrir mon dossier sur le serveur"
            : "Choisir ou créer mon dossier";
        };

        const setFirstNameEditMode = (canEdit) => {
          firstNameInput.readOnly = !canEdit;
          if (canEdit) {
            firstNameInput.removeAttribute("aria-readonly");
            firstNameInput.placeholder = "Ex. : Alice";
          } else {
            firstNameInput.setAttribute("aria-readonly", "true");
            firstNameInput.placeholder = "Prénom du dossier";
          }
        };

        const getOrderedFolders = () => [...savedFolders].sort((a, b) => {
          const left = Date.parse(a.lastUsedAt || "") || 0;
          const right = Date.parse(b.lastUsedAt || "") || 0;
          return right - left;
        });

        const setCardsDisabled = (disabled) => {
          if (!userList || !userList.children) return;
          for (const card of Array.from(userList.children)) {
            card.disabled = disabled;
          }
        };

        const createUserCard = ({ initials, name, meta, folderId, isNew }) => {
          const card = documentRef.createElement("button");
          card.setAttribute("type", "button");
          card.className = isNew ? "user-setup-user-card user-setup-user-card-new" : "user-setup-user-card";
          if (folderId) card.setAttribute("data-folder-id", folderId);

          const avatar = documentRef.createElement("span");
          avatar.className = "user-setup-user-avatar";
          avatar.setAttribute("aria-hidden", "true");
          avatar.textContent = initials;
          card.appendChild(avatar);

          const nameEl = documentRef.createElement("span");
          nameEl.className = "user-setup-user-name";
          nameEl.textContent = name;
          card.appendChild(nameEl);

          if (meta) {
            const metaEl = documentRef.createElement("span");
            metaEl.className = "user-setup-user-meta";
            metaEl.textContent = meta;
            card.appendChild(metaEl);
          }
          return card;
        };

        const renderUserCards = () => {
          if (!userList) return;
          if (typeof userList.replaceChildren === "function") {
            userList.replaceChildren();
          } else {
            userList.innerHTML = "";
          }

          for (const folder of getOrderedFolders()) {
            const lastUsed = formatLastUsed(folder.lastUsedAt);
            const where = getFolderStorageMode(folder) === "server" ? "Serveur" : "Cet ordinateur";
            const card = createUserCard({
              initials: buildCardInitials(folder),
              name: folder.firstName || folder.name || "Dossier de travail",
              meta: lastUsed ? `${where} · ${lastUsed}` : where,
              folderId: folder.id,
            });
            card.onclick = () => {
              chooseSavedFolder(folder.id);
            };
            userList.appendChild(card);
          }

          const newCard = createUserCard({ initials: "+", name: "Nouvel utilisateur", isNew: true });
          newCard.onclick = () => {
            showForm();
          };
          userList.appendChild(newCard);
        };

        const showChooser = () => {
          rootHandle = null;
          setTitle("Qui êtes-vous ?");
          if (chooserWrap) chooserWrap.style.display = "grid";
          if (formWrap) formWrap.style.display = "none";
          if (backBtn) backBtn.style.display = "none";
          setValidateVisibility(false);
          setCardsDisabled(false);
          status.textContent = "Cliquez sur votre prénom pour continuer.";
        };

        const showForm = (options = {}) => {
          rootHandle = null;
          resolvedInitials = "";
          firstNameInput.value = "";
          setTitle(options.title || "Nouvel utilisateur");
          if (chooserWrap) chooserWrap.style.display = "none";
          if (formWrap) formWrap.style.display = "grid";
          if (backBtn) backBtn.style.display = savedFolders.length ? "" : "none";
          renderStorageModeBadge();
          setFirstNameVisibility(false);
          setFirstNameEditMode(true);
          setPickButtonMode("pick-folder");
          updateFolderStatus();
        };

        const chooseSavedFolder = async (folderId) => {
          if (isOpeningFolder) return;
          const folder = savedFolders.find((entry) => entry.id === folderId);
          if (!folder || !folder.handle) return;
          isOpeningFolder = true;
          setCardsDisabled(true);
          const label = folder.firstName || folder.name || "ce dossier";
          status.textContent = `Ouverture du dossier de ${label}…`;

          try {
            let selectedHandle = folder.handle;
            let initials = deriveInitials(selectedHandle, "");
            let ok = await storage.ensureWritePermission(selectedHandle);
            if (ok) {
              selectedHandle = await storage.resolveUserRootHandle(selectedHandle, initials);
              ok = await storage.ensureWritePermission(selectedHandle);
            }
            if (!ok) {
              status.textContent = `Accès refusé au dossier de ${label}. Cliquez à nouveau et acceptez l'autorisation du navigateur.`;
              return;
            }

            initials = deriveInitials(selectedHandle, "");
            const profile = await storage.loadUserProfile(selectedHandle, initials, false);
            const profileInitials = profile ? storage.normalizeInitials(profile.initials) : "";
            if (profileInitials) initials = profileInitials;
            const firstName = storage.normalizeFirstName(profile && profile.firstName ? profile.firstName : "");

            if (!firstName) {
              // Dossier sans profil : on demande seulement le prénom.
              preferredStorageMode = getFolderStorageMode(folder);
              showForm({ title: "Votre prénom" });
              rootHandle = selectedHandle;
              resolvedInitials = initials;
              setPickButtonMode("change-folder");
              setFirstNameVisibility(true);
              updateFolderStatus();
              firstNameInput.focus();
              return;
            }

            initials = deriveInitials(selectedHandle, initials);
            await storage.ensureProgressDirectory(selectedHandle, initials, true);
            closeModal({
              rootHandle: selectedHandle,
              initials,
              firstName,
              storageMode: getFolderStorageMode(folder),
            });
          } catch {
            status.textContent = `Impossible d'ouvrir le dossier de ${label}. Vérifiez qu'il est toujours accessible.`;
          } finally {
            isOpeningFolder = false;
            setCardsDisabled(false);
          }
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

        pickBtn.onclick = async () => {
          const restoreMode = rootHandle ? "change-folder" : "pick-folder";
          setPickButtonMode("hidden");
          try {
            const handle = await storage.pickUserDirectory();
            if (!handle) {
              setPickButtonMode(restoreMode);
              status.textContent = "Sélection annulée.";
              return;
            }

            const canWrite = await storage.ensureWritePermission(handle);
            if (!canWrite) {
              setPickButtonMode(restoreMode);
              status.textContent = "Accès refusé à ce dossier.";
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
                status.textContent = "Accès refusé à ce dossier.";
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

            setPickButtonMode("change-folder");
            setFirstNameVisibility(true);
            updateFolderStatus();
            if (!firstNameInput.readOnly) firstNameInput.focus();
          } catch (error) {
            setPickButtonMode(restoreMode);
            if (!error || error.name === "AbortError") {
              status.textContent = "Sélection annulée.";
            } else {
              status.textContent = "Impossible d'ouvrir ce dossier.";
            }
          }
        };

        const switchStorageMode = (mode) => {
          preferredStorageMode = mode;
          rootHandle = null;
          firstNameInput.value = "";
          setFirstNameVisibility(false);
          renderStorageModeBadge();
          setPickButtonMode("pick-folder");
          updateFolderStatus();
        };

        if (modeToggleBtn) {
          modeToggleBtn.onclick = () => {
            if (!isServerAvailable()) return;
            switchStorageMode(preferredStorageMode === "server" ? "local" : "server");
          };
        }

        if (openOtherBtn) {
          openOtherBtn.onclick = () => {
            showForm({ title: "Ouvrir mon dossier" });
            // Le clic courant sert de geste utilisateur pour ouvrir directement le sélecteur.
            pickBtn.onclick();
          };
        }

        if (backBtn) {
          backBtn.onclick = () => {
            renderUserCards();
            showChooser();
          };
        }

        const validateSelection = async () => {
          if (!rootHandle) {
            status.textContent = "Choisissez d'abord votre dossier.";
            return;
          }

          const firstName = storage.normalizeFirstName(firstNameInput.value);
          if (!firstName) {
            status.textContent = "Votre prénom est obligatoire.";
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
              status.textContent = "Accès refusé à ce dossier. Choisissez-en un autre.";
              return;
            }

            rootHandle = selectedHandle;
            const initials = deriveInitials(rootHandle, resolvedInitials);
            resolvedInitials = initials;
            await storage.ensureProgressDirectory(rootHandle, initials, true);
            closeModal({ rootHandle, initials, firstName, storageMode: preferredStorageMode });
          } catch {
            status.textContent = "Impossible de créer ou d'ouvrir le dossier utilisateur.";
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
        resolvedInitials = deriveInitials(rootHandle, defaults.initials);
        firstNameInput.value = "";
        setFirstNameVisibility(false);
        setValidateVisibility(false);

        if (!savedFolders.length) {
          showForm({ title: "Bienvenue !" });
          return;
        }

        if (chooserWrap) chooserWrap.style.display = "grid";
        if (formWrap) formWrap.style.display = "none";
        setTitle("Qui êtes-vous ?");
        status.textContent = "Chargement des utilisateurs…";

        (async () => {
          for (const folder of savedFolders) {
            if ((!folder.firstName || !folder.initials) && folder.handle && storage.loadUserProfile) {
              try {
                const folderInitials = deriveInitials(folder.handle, "");
                const profile = await storage.loadUserProfile(folder.handle, folderInitials, false);
                if (profile && profile.firstName && !folder.firstName) {
                  folder.firstName = storage.normalizeFirstName
                    ? storage.normalizeFirstName(profile.firstName)
                    : profile.firstName;
                }
                if (profile && profile.initials && !folder.initials) {
                  folder.initials = profile.initials;
                }
              } catch {
                // Ignore unreadable folders in the chooser.
              }
            }
          }
          renderUserCards();
          showChooser();
        })();
      });
    },
  };
}

window.createAtelierUserSetupRuntime = createAtelierUserSetupRuntime;
})();
