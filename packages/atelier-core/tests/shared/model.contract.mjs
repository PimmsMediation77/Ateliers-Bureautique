import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

function createBaseDataset() {
  return {
    modules: [
      { id: "m1", cleanName: "Saisir du texte", section: "bases", sectionOrder: 1, orderInSection: 1 },
      { id: "m2", cleanName: "Smart Art", section: "avance", sectionOrder: 2, orderInSection: 2 },
      { id: "m3", cleanName: "Impression", section: "bases", sectionOrder: 1, orderInSection: 3 },
    ],
    exercises: [
      {
        id: "ex-001",
        globalIndex: 1,
        moduleId: "m1",
        moduleNameClean: "Saisir du texte",
        num: 1,
        title: "Selectionner du texte",
        description: "Description",
        instructions: ["Etape 1", "Etape 2"],
        imageEnonce: "https://img/ex1.jpg",
        imageResultat: null,
      },
      {
        id: "ex-002",
        globalIndex: 2,
        moduleId: "m1",
        moduleNameClean: "Saisir du texte",
        num: 2,
        title: "Mettre en forme",
        instructions: ["Etape 1"],
        imageEnonce: "https://img/ex2-enonce.jpg",
        imageResultat: "https://img/ex2-result.jpg",
      },
      {
        id: "ex-003",
        globalIndex: 3,
        moduleId: "m2",
        moduleNameClean: "Smart Art",
        num: 1,
        title: "Creer un Smart Art",
        instructions: ["Etape 1", "Etape 2", "Etape 3"],
      },
    ],
  };
}

export async function createConfiguredModelFactory({ appRoot, modelGlobalName }) {
  const coreModelSource = await fs.readFile(path.join(appRoot, "js", "core", "model.js"), "utf8");
  const appConfigSource = await fs.readFile(path.join(appRoot, "js", "app-config.js"), "utf8");
  const appRuntimeSource = await fs.readFile(path.join(appRoot, "js", "core", "app-runtime.js"), "utf8");

  return function createModel(rawData = createBaseDataset(), options = {}) {
    const context = vm.createContext({ window: {} });
    vm.runInContext(appConfigSource, context, { filename: "js/app-config.js" });
    vm.runInContext(coreModelSource, context, { filename: "js/core/model.js" });
    vm.runInContext(appRuntimeSource, context, { filename: "js/core/app-runtime.js" });
    context.window.registerConfiguredAtelierModel();
    const ModelClass = context.window[modelGlobalName];
    return new ModelClass(rawData, options);
  };
}

export function registerSharedModelContractTests(createModel) {
  test("constructor filters modules without exercises", () => {
    const model = createModel();
    const themeIds = model.getThemes().map((theme) => theme.id);
    assert.deepEqual(themeIds, ["m1", "m2"]);
  });

  test("availability overrides can disable a whole module", () => {
    const model = createModel(createBaseDataset(), {
      availabilityOverrides: {
        modules: {
          m2: { active: false },
        },
      },
    });

    assert.deepEqual(model.getThemes().map((theme) => theme.id), ["m1"]);
    assert.equal(model.getExerciseById("ex-003"), null);
    assert.equal(model.getSummary().total, 2);
  });

  test("availability overrides can disable a single exercise", () => {
    const model = createModel(createBaseDataset(), {
      availabilityOverrides: {
        exercises: {
          "ex-002": { active: false },
        },
      },
    });

    assert.deepEqual(model.getExercisesByTheme("m1").map((exercise) => exercise.id), ["ex-001"]);
    assert.equal(model.getExerciseById("ex-002"), null);
    assert.equal(model.getSummary().total, 2);
  });

  test("markExerciseDone updates summary and history", () => {
    const model = createModel();
    model.markExerciseDone("ex-001", true);
    const summary = model.getSummary();

    assert.equal(summary.completed, 1);
    assert.equal(model.getIsDone("ex-001"), true);
    assert.equal(model.getLastExercise().id, "ex-001");
  });

  test("resume exercise continues in same theme when possible", () => {
    const model = createModel();
    model.markExerciseDone("ex-001", true);
    const resume = model.getResumeExercise();
    assert.equal(resume.id, "ex-002");
  });

  test("resume exercise returns last opened exercise when it is not done yet", () => {
    const model = createModel();
    model.markExerciseOpened("ex-003");
    const resume = model.getResumeExercise();
    assert.equal(resume.id, "ex-003");
  });

  test("single image is treated as expected result when result image is missing", () => {
    const model = createModel();
    const exercise = model.getExerciseById("ex-001");
    const visuals = model.getVisualsForExercise(exercise);
    assert.deepEqual(Array.from(visuals.enonceImages), []);
    assert.equal(
      JSON.stringify(Array.from(visuals.resultImages)),
      JSON.stringify([{ src: "https://img/ex1.jpg", caption: "" }]),
    );
  });

  test("multiple fallback result images are preserved", () => {
    const model = createModel({
      modules: [{ id: "m1", cleanName: "Prise en main", section: "bases", sectionOrder: 1, orderInSection: 1 }],
      exercises: [
        {
          id: "ex-001",
          globalIndex: 1,
          moduleId: "m1",
          moduleNameClean: "Prise en main",
          num: 1,
          title: "Plusieurs images",
          instructions: ["Etape 1"],
          imageResultat: ["data/ex-001a.png", "data/ex-001b.png", "data/ex-001c.png"],
        },
      ],
    });

    const exercise = model.getExerciseById("ex-001");
    const visuals = model.getVisualsForExercise(exercise);

    assert.deepEqual(JSON.parse(JSON.stringify(visuals.resultImages)), [
      { src: "data/ex-001a.png", caption: "" },
      { src: "data/ex-001b.png", caption: "" },
      { src: "data/ex-001c.png", caption: "" },
    ]);
  });

  test("explicit scrape image lists do not inherit fallback images", () => {
    const model = createModel({
      modules: [{ id: "m1", cleanName: "Images", section: "bases", sectionOrder: 1, orderInSection: 1 }],
      exercises: [
        {
          id: "ex-001",
          globalIndex: 1,
          moduleId: "m1",
          moduleNameClean: "Images",
          num: 1,
          title: "Image d'énoncé uniquement",
          instructions: ["Etape 1"],
          imageEnonce: "data/fallback-enonce.jpg",
          imageResultat: "data/fallback-resultat.jpg",
          scrape: {
            enonceImages: ["data/scrape-enonce.jpg"],
            resultImages: [],
          },
        },
      ],
    });

    const visuals = model.getVisualsForExercise(model.getExerciseById("ex-001"));

    assert.deepEqual(JSON.parse(JSON.stringify(visuals.enonceImages)), [
      { src: "data/scrape-enonce.jpg", caption: "" },
    ]);
    assert.deepEqual(Array.from(visuals.resultImages), []);
  });

  test("importProgressObject sanitizes invalid exercise ids", () => {
    const model = createModel();
    model.importProgressObject({
      completedIds: ["ex-001", "unknown-id"],
      lastExerciseId: "unknown-id",
      history: [
        { date: "2026-04-20T10:00:00.000Z", exerciseId: "ex-001", delta: 1 },
        { date: "2026-04-20", exerciseId: "unknown-id", delta: 1 },
      ],
    });

    assert.equal(model.getIsDone("ex-001"), true);
    assert.equal(model.getIsDone("unknown-id"), false);
    assert.equal(model.getLastExercise().id, "ex-001");
  });

  test("exercise feedback is stored once per exercise and exposed in usability report", () => {
    const model = createModel();

    assert.equal(model.setExerciseFeedback("ex-001", {
      difficulty: "hard",
      clarity: "unclear",
      autonomy: "assisted",
      comment: "Besoin d'aide",
    }), true);
    assert.equal(model.setExerciseFeedback("ex-001", {
      difficulty: "adapted",
      clarity: "clear",
      autonomy: "independent",
      comment: "Mieux compris",
    }), true);

    const feedback = model.getExerciseFeedback("ex-001");
    const report = model.getUsabilityReport();

    assert.equal(feedback.difficulty, "adapted");
    assert.equal(feedback.clarity, "clear");
    assert.equal(feedback.autonomy, "independent");
    assert.equal(report.totalFeedback, 1);
    assert.equal(report.flaggedExercises.length, 0);
    assert.match(report.lastFeedback.exerciseLabel, /Exercice 1/);
  });

  test("importProgressObject drops malformed feedback entries", () => {
    const model = createModel();
    model.importProgressObject({
      completedIds: [],
      history: [],
      feedback: [
        {
          exerciseId: "ex-001",
          difficulty: "hard",
          clarity: "unclear",
          autonomy: "assisted",
          comment: "A revoir",
        },
        {
          exerciseId: "unknown-id",
          difficulty: "adapted",
          clarity: "clear",
          autonomy: "independent",
        },
        {
          exerciseId: "ex-002",
          difficulty: "invalid",
          clarity: "clear",
          autonomy: "independent",
        },
      ],
    });

    const report = model.getUsabilityReport();
    assert.equal(report.totalFeedback, 1);
    assert.equal(report.flaggedExercises.length, 1);
    assert.match(report.flaggedExercises[0].exerciseLabel, /Exercice 1/);
  });

  test("resetProgress clears completion data", () => {
    const model = createModel();
    model.markExerciseDone("ex-001", true);
    model.resetProgress();

    const summary = model.getSummary();
    assert.equal(summary.completed, 0);
    assert.equal(model.getLastExercise(), null);
  });

  test("step help links resolve to shared help topics", () => {
    const dataset = createBaseDataset();
    dataset.helpTopics = {
      "aide-1": {
        title: "Fiche d'aide",
        intro: "Introduction",
        steps: ["Repère 1", "", "Repère 2"],
        images: [{ src: "https://img/aide.png", caption: "Capture" }],
        sourceUrl: "https://example.org/support",
      },
      "sans-titre": { steps: ["Ignorée"] },
    };
    dataset.exercises[0].stepHelp = {
      "Etape 1": "aide-1",
      "Etape 2": "fiche-inconnue",
    };
    const model = createModel(dataset);

    const help = model.getStepHelpForExercise(model.getExerciseById("ex-001"));
    assert.equal(help.length, 1);
    assert.equal(help[0].label, "Etape 1");
    assert.deepEqual(JSON.parse(JSON.stringify(help[0].topic)), {
      id: "aide-1",
      title: "Fiche d'aide",
      intro: "Introduction",
      steps: ["Repère 1", "Repère 2"],
      images: [{ src: "https://img/aide.png", caption: "Capture" }],
      sourceUrl: "https://example.org/support",
    });
    assert.equal(model.getStepHelpForExercise(model.getExerciseById("ex-002")).length, 0);
  });

  test("theme affinity groups are generated by pedagogical family", () => {
    const model = createModel();
    const affinityIds = Array.from(model.getThemeAffinityGroups(), (group) => group.id);
    assert.deepEqual(affinityIds, ["fondations", "visuel"]);
  });
}
