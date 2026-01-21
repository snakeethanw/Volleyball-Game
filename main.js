// main.js
// Full advanced Babylon.js volleyball engine wiring
// - Scene, camera, lighting, court, net
// - Player + Opponent AI (attribute matrix, tilt, mood, learning)
// - Ball (advanced engine)
// - Overcharge UI (initialized safely in render loop)
// - Match flow, scoring, state machine

import { initMovement } from "./movement.js";
import { Ball } from "./ball.js";
import { OpponentAI } from "./opponentAI.js";
import { UIOvercharge } from "./uiOvercharge.js";

let canvas;
let engine;
let scene;
let camera;

let playerMesh;
let opponentMesh;

const inputState = {
    forward: 0,
    backward: 0,
    left: 0,
    right: 0,
    jump: false,
    spike: false,
    rollShot: false
};

const game = {
    canvas: null,
    engine: null,
    scene: null,
    camera: null,

    // 3D meshes
    playerMesh: null,
    opponentMesh: null,
    court: null,
    net: null,

    // Logical player state
    player: {
        facing: 1
    },

    // AI + memory
    aiProfile: null,
    aiMemory: null,
    aiReactionTimer: 0,

    // Core systems
    ball: null,
    opponentAI: null,
    uiOvercharge: null,
    movement: null,

    // Overcharge
    playerOvercharge: 0,
    opponentOvercharge: 0,

    // Match state
    score: { player: 0, opponent: 0 },
    state: "servePause", // "servePause" | "rally" | "point" | "replay"

    // Input flags for logic modules
    input: {
        rollShot: false
    },

    // Hooks
    onPointWon: () => {}
};

window.addEventListener("DOMContentLoaded", () => {
    canvas = document.getElementById("gameCanvas");
    game.canvas = canvas;

    // ✅ WebGL forced — prevents Babylon WebGPU crash
    engine = new BABYLON.Engine(canvas, true, {
        disableWebGPU: true
    });
    console.log("✅ Babylon engine initialized with WebGL");

    scene = new BABYLON.Scene(engine);
    game.engine = engine;
    game.scene = scene;

    setupCamera();
    setupLighting();
    setupCourt();
    setupCharacters();
    setupInput();
    initLogic();

    let uiInitialized = false;

    engine.runRenderLoop(() => {
        const dt = engine.getDeltaTime() / 1000;

        // Initialize UI AFTER engine/scene are fully alive
        if (!uiInitialized) {
            game.uiOvercharge = new UIOvercharge(game);
            uiInitialized = true;
        }

        update(dt);
        scene.render();
    });

    window.addEventListener("resize", () => {
        engine.resize();
    });
});

// ---------------- Camera & Scene ----------------

function setupCamera() {
    const alpha = Math.PI * 1.5;
    const beta = Math.PI / 3;
    const radius = 18;

    camera = new BABYLON.ArcRotateCamera(
        "camera",
        alpha,
        beta,
        radius,
        new BABYLON.Vector3(0, 2, -4),
        scene
    );

    camera.lowerRadiusLimit = 10;
    camera.upperRadiusLimit = 26;
    camera.wheelPrecision = 30;

    camera.checkCollisions = false;
    camera.attachControl(canvas, true);

    scene.clearColor = new BABYLON.Color3(0.02, 0.02, 0.04);
    scene.collisionsEnabled = true;

    game.camera = camera;
}

function setupLighting() {
    const hemi = new BABYLON.HemisphericLight(
        "hemiLight",
        new BABYLON.Vector3(0, 1, 0),
        scene
    );
    hemi.intensity = 0.9;

    const dirLight = new BABYLON.DirectionalLight(
        "dirLight",
        new BABYLON.Vector3(-0.5, -1, 0.3),
        scene
    );
    dirLight.position = new BABYLON.Vector3(0, 10, -10);
    dirLight.intensity = 0.6;
}

function setupCourt() {
    const ground = BABYLON.MeshBuilder.CreateGround(
        "court",
        { width: 16, height: 24 },
        scene
    );
    ground.position.y = 0;
    ground.checkCollisions = true;

    const mat = new BABYLON.StandardMaterial("courtMat", scene);
    mat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.2);
    mat.specularColor = new BABYLON.Color3(0, 0, 0);
    ground.material = mat;

    const net = BABYLON.MeshBuilder.CreateBox(
        "net",
        { width: 0.2, height: 2.4, depth: 16 },
        scene
    );
    net.position = new BABYLON.Vector3(0, 1.2, 0);
    net.checkCollisions = true;

    const netMat = new BABYLON.StandardMaterial("netMat", scene);
    netMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
    net.material = netMat;

    game.court = ground;
    game.net = net;
}

function setupCharacters() {
    // Player
    playerMesh = BABYLON.MeshBuilder.CreateCapsule(
        "player",
        { height: 2, radius: 0.5 },
        scene
    );
    playerMesh.position = new BABYLON.Vector3(0, 1, -7);
    playerMesh.checkCollisions = true;

    const playerMat = new BABYLON.StandardMaterial("playerMat", scene);
    playerMat.diffuseColor = new BABYLON.Color3(0.3, 0.8, 1.0);
    playerMesh.material = playerMat;

    // Opponent placeholder (real mesh comes from OpponentAI)
    opponentMesh = BABYLON.MeshBuilder.CreateCapsule(
        "opponentPlaceholder",
        { height: 2, radius: 0.5 },
        scene
    );
    opponentMesh.position = new BABYLON.Vector3(0, 1, 7);
    opponentMesh.isVisible = false;

    game.playerMesh = playerMesh;
    game.opponentMesh = opponentMesh;
}

// ---------------- Input ----------------

function setupInput() {
    window.addEventListener("keydown", (e) => {
        switch (e.code) {
            case "KeyW":
            case "ArrowUp":
                inputState.forward = 1;
                break;
            case "KeyS":
            case "ArrowDown":
                inputState.backward = 1;
                break;
            case "KeyA":
            case "ArrowLeft":
                inputState.left = 1;
                break;
            case "KeyD":
            case "ArrowRight":
                inputState.right = 1;
                break;
            case "Space":
                inputState.jump = true;
                break;
            case "KeyJ":
                inputState.spike = true;
                break;
        }
    });

    window.addEventListener("keyup", (e) => {
        switch (e.code) {
            case "KeyW":
            case "ArrowUp":
                inputState.forward = 0;
                break;
            case "KeyS":
            case "ArrowDown":
                inputState.backward = 0;
                break;
            case "KeyA":
            case "ArrowLeft":
                inputState.left = 0;
                break;
            case "KeyD":
            case "ArrowRight":
                inputState.right = 0;
                break;
            case "Space":
                inputState.jump = false;
                break;
            case "KeyJ":
                inputState.spike = false;
                break;
        }
    });

    canvas.addEventListener("mousedown", (e) => {
        if (e.button === 2) {
            inputState.rollShot = true;
            game.input.rollShot = true;
        }
    });

    canvas.addEventListener("mouseup", (e) => {
        if (e.button === 2) {
            inputState.rollShot = false;
            game.input.rollShot = false;
        }
    });

    window.addEventListener("contextmenu", (e) => {
        e.preventDefault();
    });
}

// ---------------- Logic Init ----------------

function initLogic() {
    // AI profile + memory
    game.aiProfile = {
        aggression: 0.65,
        patience: 0.55,
        risk: 0.55,
        confidence: 0.6,
        tilt: 0.4,
        reactionTime: 0.16,
        tiltLevel: 0,
        confidenceLevel: 0.5,
        fatigue: 0,
        mood: getTimeOfDayMood()
    };

    game.aiMemory = {
        spikeLeftCount: 0,
        spikeRightCount: 0,
        rollUsage: 0,
        tipUsage: 0,
        serveDeepCount: 0,
        serveShortCount: 0
    };

    game.aiReactionTimer = 0;

    // Opponent AI
    const opponentAI = new OpponentAI(game);
    game.opponentAI = opponentAI;
    game.opponentMesh = opponentAI.mesh;

    // Ball
    const ball = new Ball(game);
    game.ball = ball;

    // Movement
    const movement = initMovement(game);
    game.movement = movement;

    // Score + state text (created once UIOvercharge exists)
    game.onPointWon = function (winner) {
        game.state = "point";

        if (winner === "player") {
            game.score.player += 1;
            opponentAI.onPointResult(false);
        } else {
            game.score.opponent += 1;
            opponentAI.onPointResult(true);
        }

        if (game.uiOvercharge && game.uiOvercharge.scoreText && game.uiOvercharge.stateText) {
            game.uiOvercharge.scoreText.text = `${game.score.player} - ${game.score.opponent}`;
            game.uiOvercharge.stateText.text = winner === "player" ? "YOU SCORED" : "OPPONENT SCORED";
        }

        game.playerOvercharge = Math.max(0, game.playerOvercharge - 0.25);
        game.opponentOvercharge = Math.max(0, game.opponentOvercharge - 0.25);
        if (game.uiOvercharge) game.uiOvercharge.resetFlash();

        setTimeout(() => {
            const nextServeSide = winner === "player" ? "player" : "opponent";
            if (game.uiOvercharge && game.uiOvercharge.stateText) {
                game.uiOvercharge.stateText.text = "SERVE";
            }
            ball.startServe(nextServeSide, "float");
        }, 1200);
    };

    // Initial serve
    ball.startServe("player", "float");
}

function getTimeOfDayMood() {
    const hour = new Date().getHours();
    if (hour < 10) return "morning";
    if (hour < 18) return "afternoon";
    if (hour < 23) return "night";
    return "lateNight";
}

// ---------------- Update Loop ----------------

function update(dt) {
    updatePlayerFromInput(dt);

    if (game.state === "rally" || game.state === "servePause") {
        if (game.movement) game.movement.update(dt);
        if (game.ball) game.ball.update(dt);
        if (game.opponentAI) game.opponentAI.update(dt);
    }

    if (game.uiOvercharge) {
        game.uiOvercharge.setCharge(game.playerOvercharge);
        game.uiOvercharge.update(dt);
    }
}

function updatePlayerFromInput(dt) {
    const moveSpeed = 7;
    const forward = camera.getForwardRay().direction;
    const right = camera.getDirection(new BABYLON.Vector3(1, 0, 0));

    const moveDir = new BABYLON.Vector3(0, 0, 0);

    if (inputState.forward) moveDir.addInPlace(new BABYLON.Vector3(forward.x, 0, forward.z));
    if (inputState.backward) moveDir.addInPlace(new BABYLON.Vector3(-forward.x, 0, -forward.z));
    if (inputState.left) moveDir.addInPlace(new BABYLON.Vector3(-right.x, 0, -right.z));
    if (inputState.right) moveDir.addInPlace(new BABYLON.Vector3(right.x, 0, right.z));

    if (moveDir.lengthSquared() > 0.0001) {
        moveDir.normalize();
        playerMesh.position.addInPlace(moveDir.scale(moveSpeed * dt));

        const angle = Math.atan2(moveDir.x, moveDir.z);
        playerMesh.rotation.y = angle;
        game.player.facing = moveDir.x >= 0 ? 1 : -1;
    }

    if (playerMesh.position.y < 1) {
        playerMesh.position.y = 1;
    }

    playerMesh.position.x = BABYLON.Scalar.Clamp(playerMesh.position.x, -7.5, 7.5);
    playerMesh.position.z = BABYLON.Scalar.Clamp(playerMesh.position.z, -11.5, -0.5);
}
