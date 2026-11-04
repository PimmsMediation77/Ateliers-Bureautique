# Contrat DOM du runtime atelier-core

Ce document liste les éléments HTML minimaux attendus par le runtime partagé `atelier-core`.

## Navigation et structure

- `themes-affinity-list`
- `affinity-theme-list`
- `page-home`
- `page-themes`
- `page-affinity`
- `page-exercise`
- `page-progress`
- `page-profile`

## Identité utilisateur

- `header-user-badge`
- `header-user-menu`
- `header-user-switch-btn`
- `header-user-profile-btn`
- `header-runtime-status`
- `progress-change-user-btn`
- `progress-reset-btn`
- `progress-reset-profile-btn`
- `runtime-status`

## Fichier de travail

- `exercise-workfile-btn`
- `exercise-download-btn`
- `exercise-pick-workfile-btn`
- `exercise-open-workfile-btn`
- `exercise-workfile-status`

## Modales

- `identity-check-modal`
- `identity-check-title`
- `identity-check-initials`
- `identity-check-confirm-btn`
- `identity-check-switch-btn`
- `user-setup-modal`
- `user-setup-title`
- `user-setup-status`
- `user-setup-chooser`
- `user-setup-user-list`
- `user-setup-open-other-btn`
- `user-setup-form`
- `user-setup-back-btn`
- `user-setup-storage-mode-wrap`
- `user-setup-mode-toggle-btn`
- `user-setup-mode-help`
- `user-setup-pick-root-btn`
- `user-setup-firstname-input`
- `user-setup-cancel-btn`
- `user-setup-validate-btn`
- `save-reminder-modal`
- `save-reminder-message`
- `save-reminder-user-folder`
- `save-reminder-file-name`
- `save-reminder-existing-status`
- `save-reminder-cancel-btn`
- `save-reminder-continue-btn`
- `exercise-feedback-modal`
- `exercise-feedback-form`
- `exercise-feedback-difficulty`
- `exercise-feedback-clarity`
- `exercise-feedback-autonomy`
- `exercise-feedback-comment`
- `exercise-feedback-status`
- `exercise-feedback-cancel-btn`
- `exercise-feedback-continue-btn`
- `progress-conflict-modal`
- `progress-conflict-title`
- `progress-conflict-message`
- `progress-conflict-current-label`
- `progress-conflict-current-updated-at`
- `progress-conflict-alternate-label`
- `progress-conflict-alternate-updated-at`
- `progress-conflict-status`
- `progress-conflict-stay-btn`
- `progress-conflict-switch-btn`

## Progression (accueil et page « Où j'en suis »)

- `home-progress-ring`
- `home-progress-level`
- `home-level-scale`
- `home-progress-line`
- `progress-ring`
- `progress-level-scale`
- `progress-stat-level`
- `progress-stat-completed`
- `progress-theme-list`
- `progress-curve`
- `header-user-progress-btn`

## Rapport d'usabilite (« Mon ressenti »)

- `progress-usability-summary`
- `progress-usability-list`

## Ordre de chargement des scripts partages

- `js/core/home.js`
- `js/core/themes.js`
- `js/core/persistence.js`
- `js/core/session.js`
- `js/core/workfile.js`
- `js/core/reminder-modal.js`
- `js/core/user-setup.js`
- `js/core/progress.js`
- `js/core/profile.js`
- `js/core/controller.js`

## Règle d'évolution

Toute modification d'un de ces IDs doit être répercutée dans `packages/atelier-core/browser/*`, synchronisée vers les apps, puis couverte par les tests de contrat HTML de chaque atelier.
