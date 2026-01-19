import { loadProfile } from "./charactersAndProgression.js";
import { createCharacterCards } from "./characterCards.js";
import { createBall, updateBall, serveBall } from "./ball.js";
import { createPlayer } from "./player.js";
import { createCourt } from "./court.js";

const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

let scene;
let gameState = "menu"; // "menu" | "characterSelect" | "playing"

async function createScene() {
  scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color3(0.05, 0.05, 0.1);

  // Camera
  const camera = new BABYLON.ArcRotateCamera(
    "camera",
    Math.PI / 2,
    1.1,
    22,
    new BABYLON.Vector3(0, 3, 0),
    scene
  );
  camera.attachControl(canvas, true);

  // Lights
  const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 0.9;

  // Load profile
  await loadProfile();

  // Character Select Cards
  const uiLayer = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
  const cards = createCharacterCards(scene, uiLayer);

  // Court + Players + Ball (hidden until game starts)
  const court = createCourt(scene);
  const player = createPlayer(scene, "left");
  const opponent = createPlayer(scene, "right");
  const ball = createBall(scene, court);

  court.root.setEnabled(false);
  player.mesh.setEnabled(false);
  opponent.mesh.setEnabled(false);
  ball.mesh.setEnabled(false);

  // Start game when user presses Enter
  window.addEventListener("keydown", e => {
    if (e.key === "Enter" && gameState === "characterSelect") {
      gameState = "playing";

      // Hide cards
      cards.forEach(c => c.card.setEnabled(false));

      // Show gameplay
      court.root.setEnabled(true);
      player.mesh.setEnabled(true);
      opponent.mesh.setEnabled(true);
      ball.mesh.setEnabled(true);

      serveBall(ball, player);
    }
  });

  return scene;
}

createScene().then(scene => {
  engine.runRenderLoop(() => {
    if (gameState === "playing") {
      // Update ball physics
      // (player/opponent movement handled elsewhere)
      updateBall(scene, scene.ball, scene.player, scene.opponent, scene.court);
    }

    scene.render();
  });
});

window.addEventListener("resize", () => engine.resize());
