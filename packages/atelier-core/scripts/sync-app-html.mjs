import fs from "node:fs/promises";
import path from "node:path";
import { APP_BOOTSTRAP_SCRIPT_ORDER } from "../runtime-contract.mjs";

const SHARED_SCRIPT_BLOCK = {
  start: "<!-- ATELIER_SHARED_BOOTSTRAP_SCRIPTS:START -->",
  end: "<!-- ATELIER_SHARED_BOOTSTRAP_SCRIPTS:END -->",
};

const SHARED_HEADER_NAV_BLOCK = {
  start: "<!-- ATELIER_SHARED_HEADER_NAV:START -->",
  end: "<!-- ATELIER_SHARED_HEADER_NAV:END -->",
};

const SHARED_OVERVIEW_PAGES_BLOCK = {
  start: "<!-- ATELIER_SHARED_OVERVIEW_PAGES:START -->",
  end: "<!-- ATELIER_SHARED_OVERVIEW_PAGES:END -->",
};

const SHARED_PROGRESS_PROFILE_BLOCK = {
  start: "<!-- ATELIER_SHARED_PROGRESS_PROFILE:START -->",
  end: "<!-- ATELIER_SHARED_PROGRESS_PROFILE:END -->",
};

const SHARED_USER_SETUP_BLOCK = {
  start: "<!-- ATELIER_SHARED_USER_SETUP_MODAL:START -->",
  end: "<!-- ATELIER_SHARED_USER_SETUP_MODAL:END -->",
};

const SHARED_EXERCISE_FEEDBACK_BLOCK = {
  start: "<!-- ATELIER_SHARED_EXERCISE_FEEDBACK_MODAL:START -->",
  end: "<!-- ATELIER_SHARED_EXERCISE_FEEDBACK_MODAL:END -->",
};

const SHARED_PROGRESS_CONFLICT_BLOCK = {
  start: "<!-- ATELIER_SHARED_PROGRESS_CONFLICT_MODAL:START -->",
  end: "<!-- ATELIER_SHARED_PROGRESS_CONFLICT_MODAL:END -->",
};

// Meme suffixe ?v= que standard-version-html-updater.cjs, sinon release et sync se contredisent.
function renderScriptTags(version) {
  return APP_BOOTSTRAP_SCRIPT_ORDER
    .map((scriptPath) => `  <script defer src="${scriptPath}?v=${version}"></script>`)
    .join("\n");
}

function replaceMarkedBlock(source, block, content, indexPath) {
  const startIndex = source.indexOf(block.start);
  const endIndex = source.indexOf(block.end);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`[sync-app-html] Marqueurs introuvables dans ${indexPath}: ${block.start}`);
  }

  const before = source.slice(0, startIndex + block.start.length);
  const after = source.slice(endIndex);
  return `${before}\n${content}\n  ${after}`;
}

function renderHeaderNav({ appName, version }) {
  return `  <header class="app-header">
    <div class="app-header-top">
      <div>
        <div class="title-row">
          <h1>Atelier ${appName}</h1>
          <a class="app-version" href="releases/" aria-label="Ouvrir l'historique des releases de l'atelier ${appName}" title="Voir l'historique des releases">v${version}</a>
        </div>
        <p class="subtitle">Je choisis un thème, je lance un exercice, je suis les étapes.</p>
      </div>
      <div class="header-actions">
        <a class="header-home-link" href="../" data-local-href="../../../pages/" aria-label="Retour a l'accueil Bureautique" title="Retour a l'accueil Bureautique">
          <span class="header-home-link-icon" aria-hidden="true">&#128421;</span>
          <span class="header-home-link-text">Accueil Bureautique</span>
        </a>
        <div class="header-user-wrap">
        <button id="header-user-badge" class="header-user-badge header-user-badge-btn" type="button" aria-live="polite" aria-label="Ouvrir le menu utilisateur" aria-haspopup="true" aria-expanded="false" title="Menu utilisateur">
          <span class="header-user-label">Utilisateur &#9662;</span>
          <strong class="header-user-name">Non connecté</strong>
        </button>
        <div id="header-user-menu" class="header-user-menu" hidden role="menu">
          <button id="header-user-progress-btn" class="header-user-menu-item" type="button" role="menuitem">&#128202; Mes progrès</button>
          <button id="header-user-switch-btn" class="header-user-menu-item" type="button" role="menuitem">&#128100; Changer d'utilisateur</button>
          <button id="header-user-profile-btn" class="header-user-menu-item" type="button" role="menuitem">&#9881; Profil</button>
        </div>
        <p id="header-runtime-status" class="muted status-line">Mode local</p>
        </div>
      </div>
    </div>
  </header>

  <script>
    if (window.location.protocol === "file:") {
      const homeLink = document.querySelector(".header-home-link[data-local-href]");
      if (homeLink) homeLink.setAttribute("href", homeLink.getAttribute("data-local-href"));
    }
  </script>`;
}

function renderOverviewPages() {
  return `    <section id="page-home" class="page" aria-labelledby="home-title">
      <article class="card home-resume-card">
        <p id="home-kicker" class="home-kicker">Reprendre mon atelier</p>
        <div id="home-trail-wrap" class="home-trail-wrap" hidden>
          <p class="home-trail-head">
            <span id="home-theme-name" class="home-theme-name"></span>
            <span id="home-theme-position" class="home-theme-position"></span>
          </p>
          <ol id="home-trail" class="home-trail" aria-label="Exercices du thème"></ol>
        </div>
        <h2 id="home-title" class="home-exercise-title">
          <span id="home-exercise-label" class="home-exercise-label"></span>
          <span id="home-exercise-headline" class="home-exercise-headline">Chargement…</span>
        </h2>
        <div class="home-actions">
          <button id="home-start-btn" class="btn btn-large home-start-btn has-icon" data-icon="&#9654;">Commencer</button>
          <a id="home-other-link" class="home-other-link" href="#themes">Choisir un autre exercice →</a>
        </div>
      </article>
      <article class="card progress-overview-card home-progress-card" aria-labelledby="home-progress-title">
        <div id="home-progress-ring" class="progress-ring"></div>
        <div class="progress-overview-body">
          <h3 id="home-progress-title" class="progress-overview-title">Palier : <span id="home-progress-level">Démarrage</span></h3>
          <ol id="home-level-scale" class="level-scale" aria-label="Paliers de progression"></ol>
          <p id="home-progress-line" class="home-progress-line"></p>
          <a id="home-progress-link" class="btn btn-soft has-icon home-progress-link" data-icon="&#128202;" href="#progress">Voir mes progrès</a>
        </div>
      </article>
    </section>

    <section id="page-themes" class="page" aria-labelledby="themes-title">
      <article class="card themes-hero-card">
        <div class="exercise-top-row">
          <a class="btn btn-soft has-icon" data-icon="&#9664;" href="#home">Retour à l'accueil</a>
        </div>
        <h2 id="themes-title">Explorer les thèmes</h2>
        <p class="muted">Choisissez une catégorie pour voir les séries d'exercices. Chaque catégorie regroupe des compétences proches.</p>
        <div class="themes-legend">
          <span class="themes-legend-item"><strong>1.</strong> Ouvrir une catégorie</span>
          <span class="themes-legend-item"><strong>2.</strong> Choisir une série</span>
          <span class="themes-legend-item"><strong>3.</strong> Lancer un exercice</span>
        </div>
      </article>

      <article class="card themes-list-card">
        <h3>Catégories d'affinité</h3>
        <div id="themes-affinity-list" class="affinity-grid"></div>
      </article>
    </section>

    <section id="page-affinity" class="page" aria-labelledby="affinity-title">
      <article class="card">
        <div class="exercise-top-row">
          <button id="affinity-back-btn" class="btn btn-soft has-icon" data-icon="&#9664;">Retour catégories</button>
        </div>
        <h2 id="affinity-title">Catégorie</h2>
        <p id="affinity-subtitle" class="muted"></p>
        <div id="affinity-theme-list" class="theme-accordion"></div>
      </article>
    </section>`;
}

function renderProgressProfile() {
  return `    <section id="page-progress" class="page" aria-labelledby="progress-title">
      <article class="card progress-overview-card">
        <div class="exercise-top-row">
          <a class="btn btn-soft has-icon" data-icon="&#9664;" href="#home">Retour à l'accueil</a>
        </div>
        <h2 id="progress-title">Où j'en suis</h2>
        <div class="progress-overview">
          <div id="progress-ring" class="progress-ring progress-ring-large"></div>
          <div class="progress-overview-body">
            <h3 class="progress-overview-title">Palier : <span id="progress-stat-level">Démarrage</span></h3>
            <ol id="progress-level-scale" class="level-scale" aria-label="Paliers de progression"></ol>
            <p id="progress-stat-completed" class="home-progress-line"></p>
          </div>
        </div>
      </article>

      <article class="card">
        <h2>Mes thèmes</h2>
        <ul id="progress-theme-list" class="progress-theme-list"></ul>
      </article>

      <article class="card">
        <h2>Mon activité (30 jours)</h2>
        <svg id="progress-curve" viewBox="0 0 860 220" role="img" aria-label="Exercices terminés sur les 30 derniers jours"></svg>
      </article>

      <article class="card">
        <h2>Mon ressenti</h2>
        <p class="muted">D'après vos réponses au questionnaire de fin d'exercice.</p>
        <div id="progress-usability-summary" class="stats-grid feeling-grid" hidden></div>
        <ul id="progress-usability-list" class="profile-tips feeling-list">
          <li>Votre ressenti apparaîtra ici après votre premier exercice terminé.</li>
        </ul>
      </article>
    </section>

    <section id="page-profile" class="page" aria-labelledby="profile-title">
      <article class="card">
        <div class="exercise-top-row">
          <a class="btn btn-soft has-icon" data-icon="&#9664;" href="#home">Retour à l'accueil</a>
        </div>
        <h2 id="profile-title">Mon profil</h2>
        <p class="muted">Sauvegarde automatique dans le dossier utilisateur : <code>Dossier utilisateur &gt; ProgressionAtelier</code>.</p>
        <p id="progress-user-path" class="muted status-line">Aucun utilisateur sélectionné.</p>
        <div class="progress-actions">
          <a class="btn btn-soft has-icon" data-icon="&#128202;" href="#progress">Voir mes progrès</a>
          <button id="progress-change-user-btn" class="btn btn-soft has-icon" data-icon="&#128100;">Changer d'utilisateur</button>
          <button id="progress-reset-btn" class="btn btn-danger has-icon" data-icon="&#8634;">Réinitialiser progression</button>
          <button id="progress-reset-profile-btn" class="btn btn-danger has-icon" data-icon="&#128465;">Réinitialiser profil local</button>
        </div>
        <p id="progress-file-status" class="muted status-line"></p>
      </article>

      <article class="card">
        <h2>Conseils</h2>
        <ul class="profile-tips">
          <li>Utilisez un dossier utilisateur dédié par usager (ex. : AD) pour éviter tout mélange de progression.</li>
          <li>Le changement d'utilisateur ouvre ce dossier puis recharge automatiquement la progression associée.</li>
          <li>Réinitialiser progression efface uniquement l'avancement des exercices du profil actif.</li>
          <li>Réinitialiser profil local oublie le prénom et le dossier de référence sur cet appareil.</li>
        </ul>
      </article>
    </section>`;
}

function renderUserSetupModal() {
  return `  <style>
    .user-setup-user-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 10px;
    }

    .user-setup-user-card {
      position: relative;
      display: grid;
      justify-items: center;
      gap: 4px;
      padding: 14px 10px;
      border: 2px solid var(--line);
      border-radius: 14px;
      background: var(--panel);
      color: inherit;
      font: inherit;
      text-align: center;
      cursor: pointer;
      transition: border-color 120ms ease, background 120ms ease;
    }

    .user-setup-user-card:hover,
    .user-setup-user-card:focus-visible {
      border-color: var(--accent);
      background: var(--accent-soft);
    }

    .user-setup-user-card:disabled {
      cursor: wait;
      opacity: 0.6;
    }

    .user-setup-user-remove {
      position: absolute;
      top: 6px;
      right: 6px;
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      color: var(--muted, #666);
      font-size: 1.1rem;
      line-height: 1;
      cursor: pointer;
      opacity: 0;
      transition: opacity 120ms ease, background 120ms ease, color 120ms ease;
    }

    .user-setup-user-card:hover .user-setup-user-remove,
    .user-setup-user-card:focus-within .user-setup-user-remove {
      opacity: 1;
    }

    .user-setup-user-remove:hover,
    .user-setup-user-remove:focus-visible {
      background: #c0392b;
      color: #fff;
    }

    .user-setup-user-card:disabled .user-setup-user-remove {
      display: none;
    }

    .user-setup-user-avatar {
      display: grid;
      place-items: center;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: var(--accent);
      color: #fff;
      font-size: 1.15rem;
      font-weight: 700;
    }

    .user-setup-user-card-new .user-setup-user-avatar {
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 1.6rem;
    }

    .user-setup-user-name {
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    .user-setup-user-meta {
      color: var(--muted);
      font-size: 0.85rem;
    }

    .user-setup-mode-badge {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      justify-self: start;
      margin: 0;
      padding: 4px 12px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--muted);
      font-size: 0.9rem;
    }

    .identity-check-content {
      display: grid;
      justify-items: center;
      gap: 12px;
      max-width: 460px;
      text-align: center;
    }

    .identity-check-content h2,
    .identity-check-content p {
      margin: 0;
    }

    .identity-check-avatar {
      display: grid;
      place-items: center;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: var(--accent);
      color: #fff;
      font-size: 1.5rem;
      font-weight: 800;
    }

    .identity-check-actions {
      display: grid;
      gap: 10px;
      width: 100%;
      margin-top: 8px;
    }

    .identity-check-actions .btn {
      width: 100%;
      min-height: 56px;
      font-size: 1.1rem;
    }

    .user-setup-link-btn {
      padding: 0;
      border: 0;
      background: none;
      color: var(--accent);
      font: inherit;
      text-decoration: underline;
      cursor: pointer;
    }
  </style>
  <div id="identity-check-modal" class="image-modal" style="display:none;" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="identity-check-title">
    <div class="modal-content user-setup-content identity-check-content">
      <p id="identity-check-initials" class="identity-check-avatar" aria-hidden="true"></p>
      <h2 id="identity-check-title">Bonjour, est-ce bien vous ?</h2>
      <p class="muted">Avant de commencer, vérifiez que vous travaillez bien sur votre session.</p>
      <div class="identity-check-actions">
        <button id="identity-check-confirm-btn" class="btn btn-large has-icon" data-icon="&#10003;" type="button">Oui, c'est moi</button>
        <button id="identity-check-switch-btn" class="btn btn-soft has-icon" data-icon="&#128100;" type="button">Non, changer d'utilisateur</button>
      </div>
    </div>
  </div>
  <div id="user-setup-modal" class="image-modal" style="display:none;" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="user-setup-title">
    <div class="modal-content user-setup-content">
      <h2 id="user-setup-title" style="margin-top:0;">Qui êtes-vous ?</h2>
      <p id="user-setup-status" class="muted status-line" aria-live="polite">Cliquez sur votre prénom pour continuer.</p>

      <div id="user-setup-chooser" style="display:none;margin-top:12px;gap:12px;">
        <div id="user-setup-user-list" class="user-setup-user-list"></div>
        <p style="margin:0;"><button id="user-setup-open-other-btn" class="user-setup-link-btn" type="button">Mon prénom n'est pas dans la liste : ouvrir mon dossier</button></p>
      </div>

      <div id="user-setup-form" style="display:none;margin-top:12px;gap:10px;">
        <p id="user-setup-storage-mode-wrap" class="user-setup-mode-badge" style="display:none;">
          <span id="user-setup-mode-help">&#128205; Enregistrement : sur cet ordinateur</span>
          <button id="user-setup-mode-toggle-btn" class="user-setup-link-btn" type="button">changer</button>
        </p>

        <button id="user-setup-pick-root-btn" class="btn btn-soft has-icon" data-icon="&#128193;" type="button" style="display:none;">Choisir ou créer un dossier</button>

        <label for="user-setup-firstname-input" class="field" style="margin-bottom:0;">Votre prénom</label>
        <input id="user-setup-firstname-input" type="text" maxlength="30" placeholder="Ex. : Alice" style="border:2px solid var(--line);border-radius:10px;padding:10px;font:inherit;">
      </div>

      <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;">
        <button id="user-setup-back-btn" class="btn btn-soft" type="button" style="display:none;margin-right:auto;">&#8592; Retour à la liste</button>
        <button id="user-setup-cancel-btn" class="btn btn-soft" type="button">Annuler</button>
        <button id="user-setup-validate-btn" class="btn has-icon" data-icon="&#10003;" type="button" style="display:none;">Valider</button>
      </div>
    </div>
  </div>`;
}

function renderExerciseFeedbackModal() {
  return `  <style>
    .feedback-toggle-group {
      margin: 0;
      padding: 0;
      border: 0;
    }

    .feedback-toggle-options {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0;
      border: 2px solid #c6d3e2;
      border-radius: 16px;
      overflow: hidden;
      background: #e9f0f7;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75), 0 1px 2px rgba(27, 52, 84, 0.08);
    }

    .feedback-toggle-option {
      display: block;
      position: relative;
      background: transparent;
      color: #29435f;
      transition: background 120ms ease, color 120ms ease;
    }

    .feedback-toggle-option input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    .feedback-toggle-option span {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      min-height: 54px;
      padding: 8px 6px;
      border-right: 1px solid #c6d3e2;
      font-size: 0.85rem;
      font-weight: 700;
      line-height: 1.2;
      text-align: center;
      cursor: pointer;
      color: inherit;
    }

    .feedback-toggle-option:last-child span {
      border-right: 0;
    }

    .feedback-toggle-option span i {
      font-style: normal;
      font-size: 1.4rem;
      line-height: 1;
    }

    .feedback-toggle-option:has(input[value="easy"]:checked) {
      background: #dff3e6;
      color: #1f5b35;
    }

    .feedback-toggle-option:has(input[value="adapted"]:checked),
    .feedback-toggle-option:has(input[value="medium"]:checked),
    .feedback-toggle-option:has(input[value="partial"]:checked) {
      background: #fff1cf;
      color: #815a00;
    }

    .feedback-toggle-option:has(input[value="hard"]:checked),
    .feedback-toggle-option:has(input[value="unclear"]:checked),
    .feedback-toggle-option:has(input[value="assisted"]:checked) {
      background: #fde0dc;
      color: #7d2e24;
    }

    .feedback-toggle-option:has(input[value="clear"]:checked),
    .feedback-toggle-option:has(input[value="independent"]:checked) {
      background: #dff3e6;
      color: #1f5b35;
    }

    .feedback-toggle-option input:focus-visible + span {
      outline: 3px solid rgba(47, 124, 133, 0.28);
      outline-offset: -3px;
    }

    @media (max-width: 780px) {
      .feedback-toggle-option span {
        font-size: 0.78rem;
        padding: 6px 4px;
      }
    }
  </style>
  <div id="exercise-feedback-modal" class="image-modal" style="display:none;" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Questionnaire de fin d'exercice">
    <div class="modal-content user-setup-content save-reminder-content">
      <h2 id="exercise-feedback-title" style="margin-top:0;">Avant de terminer</h2>
      <section class="exercise-feedback-section exercise-feedback-section-tips">
        <div class="exercise-feedback-section-head">
          <p class="exercise-feedback-eyebrow">Pensez &agrave; enregistrer votre travail</p>
        </div>
        <p id="exercise-feedback-save-message" class="muted"></p>
        <ol id="exercise-feedback-save-steps" class="save-reminder-steps">
          <li>Dans l'application, cliquez sur <strong>Fichier</strong> puis <strong>Enregistrer sous</strong>.</li>
          <li>Choisissez votre dossier utilisateur : <code id="exercise-feedback-user-folder">xxx</code>.</li>
          <li>Nommez le fichier <code id="exercise-feedback-file-name">ex-xxx-termine</code>, puis validez avec <strong>Enregistrer</strong>.</li>
          <li>Si un message indique que le fichier existe d&eacute;j&agrave;, cliquez sur <strong>Oui</strong> pour le remplacer.</li>
        </ol>
      </section>
      <form id="exercise-feedback-form" class="exercise-feedback-section exercise-feedback-form" style="display:grid;gap:12px;">
        <div class="exercise-feedback-section-head">
          <p class="exercise-feedback-eyebrow">Dites-nous comment cela s&apos;est pass&eacute;</p>
        </div>
        <fieldset class="feedback-toggle-group" id="exercise-feedback-difficulty-group">
          <legend class="field">Difficult&eacute; ressentie</legend>
          <div class="feedback-toggle-options">
            <label class="feedback-toggle-option"><input type="radio" name="exercise-feedback-difficulty" value="easy"><span><i aria-hidden="true">&#128564;</i>Trop facile</span></label>
            <label class="feedback-toggle-option"><input type="radio" name="exercise-feedback-difficulty" value="adapted"><span><i aria-hidden="true">&#128077;</i>Adapt&eacute;e</span></label>
            <label class="feedback-toggle-option"><input type="radio" name="exercise-feedback-difficulty" value="hard"><span><i aria-hidden="true">&#128555;</i>Difficile</span></label>
          </div>
        </fieldset>

        <fieldset class="feedback-toggle-group" id="exercise-feedback-clarity-group">
          <legend class="field">Clart&eacute; des consignes</legend>
          <div class="feedback-toggle-options">
            <label class="feedback-toggle-option"><input type="radio" name="exercise-feedback-clarity" value="unclear"><span><i aria-hidden="true">&#10067;</i>Pas claire</span></label>
            <label class="feedback-toggle-option"><input type="radio" name="exercise-feedback-clarity" value="medium"><span><i aria-hidden="true">&#129300;</i>Moyenne</span></label>
            <label class="feedback-toggle-option"><input type="radio" name="exercise-feedback-clarity" value="clear"><span><i aria-hidden="true">&#128161;</i>Tr&egrave;s claire</span></label>
          </div>
        </fieldset>

        <fieldset class="feedback-toggle-group" id="exercise-feedback-autonomy-group">
          <legend class="field">Autonomie ressentie</legend>
          <div class="feedback-toggle-options">
            <label class="feedback-toggle-option"><input type="radio" name="exercise-feedback-autonomy" value="assisted"><span><i aria-hidden="true">&#128587;</i>Besoin d'aide</span></label>
            <label class="feedback-toggle-option"><input type="radio" name="exercise-feedback-autonomy" value="partial"><span><i aria-hidden="true">&#129309;</i>Un peu d'aide</span></label>
            <label class="feedback-toggle-option"><input type="radio" name="exercise-feedback-autonomy" value="independent"><span><i aria-hidden="true">&#128170;</i>En autonomie</span></label>
          </div>
        </fieldset>

        <label class="field" for="exercise-feedback-comment">Commentaire optionnel</label>
        <textarea id="exercise-feedback-comment" rows="3" maxlength="280" placeholder="Blocage, point confus, aide re&ccedil;ue..."></textarea>
        <p id="exercise-feedback-status" class="muted status-line"></p>
      </form>
      <div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end;">
        <button id="exercise-feedback-cancel-btn" class="btn btn-soft" type="button">Annuler</button>
        <button id="exercise-feedback-continue-btn" class="btn has-icon" data-icon="&#10003;" type="button">Terminer l'exercice</button>
      </div>
    </div>
  </div>`;
}

function renderProgressConflictModal() {
  return `  <div id="progress-conflict-modal" class="image-modal" style="display:none;" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Choix de progression">
    <div class="modal-content user-setup-content save-reminder-content">
      <h2 id="progress-conflict-title" style="margin-top:0;">Choix de progression</h2>
      <p id="progress-conflict-message" class="muted">Deux versions de progression ont ete detectees.</p>
      <div style="display:grid;gap:12px;margin-top:14px;">
        <article class="card" style="margin:0;">
          <p class="field" id="progress-conflict-current-label" style="margin-bottom:6px;">Version actuelle</p>
          <p id="progress-conflict-current-updated-at" class="muted status-line">Non disponible</p>
        </article>
        <article class="card" style="margin:0;">
          <p class="field" id="progress-conflict-alternate-label" style="margin-bottom:6px;">Version proposee</p>
          <p id="progress-conflict-alternate-updated-at" class="muted status-line">Non disponible</p>
        </article>
      </div>
      <p id="progress-conflict-status" class="muted status-line" style="margin-top:14px;">Choisissez la version a garder pour cette session.</p>
      <div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end;">
        <button id="progress-conflict-stay-btn" class="btn btn-soft" type="button">Garder la version actuelle</button>
        <button id="progress-conflict-switch-btn" class="btn has-icon" data-icon="&#10003;" type="button">Utiliser cette version</button>
      </div>
    </div>
  </div>`;
}

export async function syncAppHtml({ appRoot, appName, logger = console }) {
  if (!appRoot) throw new Error("appRoot est requis");
  if (!appName) throw new Error("appName est requis");

  const indexPath = path.join(appRoot, "index.html");
  const packageJson = JSON.parse(await fs.readFile(path.join(appRoot, "package.json"), "utf8"));
  const version = packageJson.version || "0.0.0";
  const current = await fs.readFile(indexPath, "utf8");

  let next = current;
  next = replaceMarkedBlock(next, SHARED_SCRIPT_BLOCK, renderScriptTags(version), indexPath);
  next = replaceMarkedBlock(next, SHARED_HEADER_NAV_BLOCK, renderHeaderNav({ appName, version }), indexPath);
  next = replaceMarkedBlock(next, SHARED_OVERVIEW_PAGES_BLOCK, renderOverviewPages(), indexPath);
  next = replaceMarkedBlock(next, SHARED_PROGRESS_PROFILE_BLOCK, renderProgressProfile(), indexPath);
  next = replaceMarkedBlock(next, SHARED_USER_SETUP_BLOCK, renderUserSetupModal(), indexPath);
  next = replaceMarkedBlock(next, SHARED_EXERCISE_FEEDBACK_BLOCK, renderExerciseFeedbackModal(), indexPath);
  next = replaceMarkedBlock(next, SHARED_PROGRESS_CONFLICT_BLOCK, renderProgressConflictModal(), indexPath);

  if (next !== current) {
    await fs.writeFile(indexPath, next, "utf8");
    logger.log("[sync-app-html] Blocs HTML partages mis a jour.");
    return true;
  }

  logger.log("[sync-app-html] Blocs HTML deja a jour.");
  return false;
}
