import { loadProfile } from "./charactersAndProgression.js";
import { createCharacterCards } from "./characterCards.js";
import { createBall, updateBall, serveBall } from "./ball.js";
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

  const court = createCourt(scene);
  const player = createPlayer(scene, "left");
  const opponent = createPlayer(scene, "right");
  const ball = createBall(scene, court);

  court.root.setEnabled(false);
  player.mesh.setEnabled(false);
  opponent.mesh.setEnabled(false);
  ball.mesh.setEnabled(false);

  let movementController = null;

  window.addEventListener("keydown", e => {
    if (e.key === "Enter" && gameState === "characterSelect") {
      gameState = "playing";

      cards.forEach(c => c.card.setEnabled(false));

      court.root.setEnabled(true);
      player.mesh.setEnabled(true);
      opponent.mesh.setEnabled(true);
      ball.mesh.setEnabled(true);

      movementController = createMovementController(scene, player, ball);
      createOpponentAI(scene, opponent, ball);

      serveBall(ball, player);
      serveTimer = 15;
      serveActive = true;
    }
  });

  // SERVE TIMER
  scene.onBeforeRenderObservable.add(() => {
    if (serveActive) {
      const dt = scene.getEngine().getDeltaTime() / 1000;
      serveTimer -= dt;

      if (serveTimer <= 0) {
        serveActive = false;
        // Player loses serve
        serveBall(ball, opponent);
      }
    }
  });

  return scene;
}

createScene().then(scene => {
  engine.runRenderLoop(() => {
    if (gameState === "playing") {
      updateBall(scene, scene.ball, scene.player, scene.opponent, scene.court);
    }
    scene.render();
  });
});

window.addEventListener("resize", () => engine.resize());
