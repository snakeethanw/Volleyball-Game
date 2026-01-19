// main.js
// Full advanced Babylon.js scene + Roblox-style camera + shift-lock + integration
// with advanced ball.js, movement.js, opponentAI.js, and uiOvercharge.js
// Preserves original systems: shift-lock, pointer lock, roll-shot input,
// AI profile/memory hooks, overcharge, rally flow.

import { Ball } from "./ball.js";
import { initMovement } from "./movement.js";
import { OpponentAI } from "./opponentAI.js";
import { UIOvercharge } from "./uiOvercharge.js";

let canvas;
let engine;
let scene;
let camera;

let playerMesh;
let opponentMesh;

let shiftLockEnabled = false;
let pointerLocked = false;

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

    // Logical player state (facing, etc.)
    player: {
        facing: 1
    },

    // AI + memory (ported from old engine)
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

    engine = new BABYLON.Engine(canvas, true);
    scene = new BABYLON.Scene(engine);
    game.engine = engine;
    game.scene = scene;

    setupCamera();
    setupLighting();
    setupCourt();
    setupCharacters();
    setupInput();

    initLogic();

    engine.runRenderLoop(() => {
        const dt = engine.getDeltaTime() / 1000;
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

    // Opponent
    opponentMesh = BABYLON.MeshBuilder.CreateCapsule(
        "opponent",
        { height: 2, radius: 0.5 },
        scene
    );
    opponentMesh.position = new BABYLON.Vector3(0, 1, 7);
    opponentMesh.checkCollisions = true;

    const opponentMat = new BABYLON.StandardMaterial("opponentMat", scene);
    opponentMat.diffuseColor = new BABYLON.Color3(1.0, 0.4, 0.4);
    opponentMesh.material = opponentMat;

    game.playerMesh = playerMesh;
    game.opponentMesh = opponentMesh;
}

// ---------------- Input & Shift-Lock ----------------

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
            case "ShiftLeft":
            case "ShiftRight":
                toggleShiftLock();
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

    document.addEventListener("pointerlockchange", () => {
        pointerLocked = document.pointerLockElement === canvas;
        if (!pointerLocked && shiftLockEnabled) {
            shiftLockEnabled = false;
        }
    });
}

function toggleShiftLock() {
    shiftLockEnabled = !shiftLockEnabled;

    if (shiftLockEnabled) {
        if (canvas.requestPointerLock) {
            canvas.requestPointerLock({ unadjustedMovement: true });
        }
        snapPlayerToCamera();
    } else {
        if (document.exitPointerLock) {
            document.exitPointerLock();
        }
    }
}

function snapPlayerToCamera() {
    const forward = camera.getForwardRay().direction;
    const angle = Math.atan2(forward.x, forward.z);
    playerMesh.rotation.y = angle;
    game.player.facing = forward.x >= 0 ? 1 : -1;
}

// ---------------- Logic Init ----------------

function initLogic() {
    // AI profile + memory (ported from old engine)
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

    // Opponent AI (3D, but using attribute matrix)
    const opponentAI = new OpponentAI(game);
    game.opponentAI = opponentAI;
    game.opponentMesh = opponentAI.mesh;

    // Ball (advanced engine, 3D)
    const ball = new Ball(game);
    game.ball = ball;

    // Overcharge UI
    const uiOvercharge = new UIOvercharge(game);
    game.uiOvercharge = uiOvercharge;

    // Movement (3D, but preserving approach speed + timing hooks)
    const movement = initMovement(game);
    game.movement = movement;

    // Score + state text
    const scoreText = new BABYLON.GUI.TextBlock("scoreText", "0 - 0");
    scoreText.color = "white";
    scoreText.fontSize = 32;
    scoreText.top = "-45%";
    scoreText.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    scoreText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    uiOvercharge.ui.addControl(scoreText);

    const stateText = new BABYLON.GUI.TextBlock("stateText", "SERVE");
    stateText.color = "#ccccff";
    stateText.fontSize = 22;
    stateText.top = "-40%";
    stateText.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    stateText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    uiOvercharge.ui.addControl(stateText);

    // Point resolution hook
    game.onPointWon = function (winner) {
        game.state = "point";

        if (winner === "player") {
            game.score.player += 1;
            opponentAI.onPointResult(false);
        } else {
            game.score.opponent += 1;
            opponentAI.onPointResult(true);
        }

        scoreText.text = `${game.score.player} - ${game.score.opponent}`;
        stateText.text = winner === "player" ? "YOU SCORED" : "OPPONENT SCORED";

        game.playerOvercharge = Math.max(0, game.playerOvercharge - 0.25);
        game.opponentOvercharge = Math.max(0, game.opponentOvercharge - 0.25);
        uiOvercharge.resetFlash();

        setTimeout(() => {
            const nextServeSide = winner === "player" ? "player" : "opponent";
            stateText.text = "SERVE";
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
    updateCameraFollow(dt);
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

function updateCameraFollow(dt) {
    const target = playerMesh.position.clone();
    target.y += 1.5;

    camera.target = BABYLON.Vector3.Lerp(
        camera.target,
        target,
        0.15
    );

    if (shiftLockEnabled) {
        const forward = camera.getForwardRay().direction;
        const angle = Math.atan2(forward.x, forward.z);
        playerMesh.rotation.y = angle;
        game.player.facing = forward.x >= 0 ? 1 : -1;
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

        if (!shiftLockEnabled) {
            const angle = Math.atan2(moveDir.x, moveDir.z);
            playerMesh.rotation.y = angle;
            game.player.facing = moveDir.x >= 0 ? 1 : -1;
        }
    }

    if (playerMesh.position.y < 1) {
        playerMesh.position.y = 1;
    }

    playerMesh.position.x = BABYLON.Scalar.Clamp(playerMesh.position.x, -7.5, 7.5);
    playerMesh.position.z = BABYLON.Scalar.Clamp(playerMesh.position.z, -11.5, -0.5);
}
