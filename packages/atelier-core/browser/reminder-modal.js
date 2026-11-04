(() => {
function createAtelierReminderModalRuntime(config = {}) {
  const modalRefs = config.modalRefs || {};
  const windowRef = config.windowRef || window;

  function setContent({
    title,
    message,
    steps,
    continueLabel = "Continuer",
    numberedSteps = true,
  }) {
    const modal = modalRefs.root;
    const titleEl = modal ? modal.querySelector("#save-reminder-title") : null;
    const stepsEl = modal ? modal.querySelector(".save-reminder-steps") : null;
    const continueBtn = modalRefs.continueBtn;

    if (titleEl) titleEl.textContent = title;
    if (modalRefs.message) modalRefs.message.textContent = message;
    if (stepsEl) {
      stepsEl.innerHTML = steps;
      stepsEl.classList.toggle("is-unnumbered", !numberedSteps);
    }
    if (continueBtn) continueBtn.textContent = continueLabel;
  }

  function show(options = {}) {
    return new Promise((resolve) => {
      const modal = modalRefs.root;
      const cancelBtn = modalRefs.cancelBtn;
      const continueBtn = modalRefs.continueBtn;

      if (!modal || !continueBtn) {
        resolve(true);
        return;
      }

      const onClose = (result) => {
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
        if (cancelBtn) cancelBtn.onclick = null;
        continueBtn.onclick = null;
        windowRef.removeEventListener("keydown", onKeydown);
        resolve(result);
      };

      const onKeydown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose(false);
        }
        if (event.key === "Enter") {
          event.preventDefault();
          onClose(true);
        }
      };

      if (typeof options.beforeOpen === "function") {
        options.beforeOpen(modal);
      }

      if (cancelBtn) cancelBtn.onclick = () => onClose(false);
      continueBtn.onclick = () => onClose(true);
      windowRef.addEventListener("keydown", onKeydown);
      modal.style.display = "flex";
      modal.setAttribute("aria-hidden", "false");
      continueBtn.focus();
    });
  }

  return {
    setContent,
    show,
  };
}

window.createAtelierReminderModalRuntime = createAtelierReminderModalRuntime;
})();
