// =====================================================
//   MAIN ENTRY — FULL 3D GAME FLOW
//   - Loads Supabase profile
//   - Shows animated main menu
//   - Shows animated character select
//   - Builds 3D match scene
//   - Runs gameplay loop
// =====================================================

import { createMainMenu } from "./menu.js";
import { createCharacterSelect } from "./characterSelect.js";
import { createScoreboard } from "./scoreboard.js";

import { createCourt } from "./court.js";
import { createPlayers, updatePlayers } from "./player.js";
import { createBall, updateBall, serveBall } from "./ball.js";
import { setupCamera } from "./camera.js";
import { setupEffects, updateEffects, triggerOverchargeImpact } from "./effects.js";

import {
  loadProfile,
  PlayerProfile,
  CharacterRoster
} from "./charactersAndProgression.js";


// =====================================================
//   ENGINE + CANVAS
// =====================================================
const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true, { stencil: true });

let scene;
let court;
let player, opponent;
let ball;
let camera;
let effects;
let scoreboard;


// =====================================================
//   CREATE MATCH SCENE
// =====================================================
function createMatchScene() {
  scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.02, 0.04, 0.08, 1);

  // Lighting
  const mainLight = new BABYLON.DirectionalLight("mainLight",
    new BABYLON.Vector3(-0.4, -1, 0.3), scene);
  mainLight.intensity = 1.2;

  const hemi = new BABYLON.HemisphericLight("hemi",
    new BABYLON.Vector3(0, 1, 0), scene);
  hemi.intensity = 0.5;

  // Court
  court = createCourt(scene);

  // Camera
  camera = setupCamera(scene, canvas, court);

  // Character selection from Supabase profile
  const selectedId = PlayerProfile?.selected_character ?? "recruit";
  const charData = CharacterRoster.find(c => c.id === selectedId) || CharacterRoster[0];
  const oppChar = CharacterRoster[3] || CharacterRoster[0];

  // Players
  ({ player, opponent } = createPlayers(scene, charData, oppChar, court));

  // Ball
  ball = createBall(scene, court);

  // Effects
  effects = setupEffects(scene, player, court);

  // Scoreboard
  scoreboard = createScoreboard(scene);

  // Input state
  const inputState = {
    left: false,
    right: false,
    jump: false,
    block: false,
    spike: false
  };

  window.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    if (k === "a") inputState.left = true;
    if (k === "d") inputState.right = true;
    if (k === " ") inputState.jump = true;
    if (k === "q") inputState.block = true;
    if (k === "r") inputState.spike = true;
  });

  window.addEventListener("keyup", e => {
    const k = e.key.toLowerCase();
    if (k === "a") inputState.left = false;
    if (k === "d") inputState.right = false;
    if (k === " ") inputState.jump = false;
    if (k === "q") inputState.block = false;
    if (k === "r") inputState.spike = false;
  });

  // Serve animation at match start
  serveBall(ball, player);

  // Game loop
  scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime() / 1000;

    updatePlayers(scene, player, opponent, court, inputState, ball, (impactPos) => {
      triggerOverchargeImpact(effects, impactPos);
    });

    updateBall(scene, ball, player, opponent, court);

    updateEffects(effects, dt, player, ball);
  });

  return scene;
}


// =====================================================
//   FULL GAME FLOW
// =====================================================
async function startGameFlow() {
  // Load Supabase profile first
  await loadProfile();

  // Create a temporary scene for menus
  scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.02, 0.04, 0.08, 1);

  // 1. MAIN MENU
  createMainMenu(scene, engine, () => {
    // 2. CHARACTER SELECT
    createCharacterSelect(scene, () => {
      // 3. MATCH SCENE
      scene.dispose();
      scene = createMatchScene();
    });
  });
}


// =====================================================
//   START
// =====================================================
startGameFlow();

engine.runRenderLoop(() => {
  if (scene) scene.render();
});

window.addEventListener("resize", () => {
  engine.resize();
});
