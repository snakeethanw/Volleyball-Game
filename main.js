// main.js
// Scene setup, game state, serve logic, movement, AI, and ball integration.

import { loadProfile } from "./charactersAndProgression.js";
import { createCharacterCards } from "./characterCards.js";
import { createBall, updateBall, serveBall, hitBall } from "./ball.js";
import { createPlayer } from "./player.js";
import { createCourt } from "./court.js";
import { createMovementController } from "./movement.js";
import { createOpponentAI } from "./opponentAI.js";

const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

let scene;
let gameState = "characterSelect";
let serveTimer = 0;
let serveActive = false;

let player, opponent, ball, court, movementController;

async function createScene() {
  scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color3(0.05, 0.05, 0.1);

  const camera = new BABYLON.ArcRotateCamera(
    "camera",
    Math.PI / 2,
    1.1,
    22,
    new BABYLON.Vector3(0, 3, 0),
    scene
  );
  camera.attachControl(canvas, true);

  new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

  await loadProfile();

  const uiLayer = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
  const cards = createCharacterCards(scene, uiLayer);

  court = createCourt(scene);
  player = createPlayer(scene, "left");
  opponent = createPlayer(scene, "right");
  ball = createBall(scene, court);

  court.root.setEnabled(false);
  player.mesh.setEnabled(false);
  opponent.mesh.setEnabled(false);
  ball.mesh.setEnabled(false);

  window.addEventListener("keydown", e => {
    if (e.key === "Enter" && gameState === "characterSelect") {
      startMatch(cards);
    }

    if (e.key === "j" && gameState === "playing") {
      tryPlayerHit(false);
    }
  });

  // Serve timer
  scene.onBeforeRenderObservable.add(() => {
    if (serveActive) {
      const dt = scene.getEngine().getDeltaTime() / 1000;
      serveTimer -= dt;

      if (serveTimer <= 0) {
        serveActive = false;
        // Player loses serve, opponent serves
        serveBall(ball, opponent);
        serveTimer = 15;
        serveActive = true;
      }
    }
  });

  return scene;
}

function startMatch(cards) {
  gameState = "playing";

  cards.forEach(c => c.card.setEnabled(false));

  court.root.setEnabled(true);
  player.mesh.setEnabled(true);
  opponent.mesh.setEnabled(true);
  ball.mesh.setEnabled(true);

  movementController = createMovementController(scene, player);
  createOpponentAI(scene, opponent, ball);

  serveBall(ball, player);
  serveTimer = 15;
  serveActive = true;
}

function tryPlayerHit(isOvercharge) {
  if (!movementController) return;

  const tilt = movementController.tilt;
  const contactHeight = ball.mesh.position.y;

  // Simple hitbox: ball must be near player
  const dx = ball.mesh.position.x - player.mesh.position.x;
  const dz = ball.mesh.position.z - player.mesh.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist < 2.0 && contactHeight > 1.5) {
    hitBall(ball, player, tilt, isOvercharge, contactHeight);
    serveActive = false;
  }
}

createScene().then(scene => {
  engine.runRenderLoop(() => {
    if (gameState === "playing") {
      updateBall(scene, ball, player, opponent, court);
    }
    scene.render();
  });
});

window.addEventListener("resize", () => engine.resize());
