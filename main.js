// main.js
// Babylon.js scene + Roblox-style camera + shift-lock (toggle) + integration with logic modules

import { initBall, updateBall } from "./ball.js";
import { initOpponentAI, updateOpponentAI } from "./opponentAI.js";
import { initMovement, updateMovement } from "./movement.js";
import { initOverchargeUI, updateOverchargeUI } from "./uiOvercharge.js";

let canvas;
let engine;
let scene;
let camera;
let light;

let playerMesh;
let opponentMesh;
let ballMesh;

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
    player: {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        isGrounded: true,
        facing: 1
    },
    opponent: null,
    ball: null,
    aiProfile: null,
    aiMemory: null,
    playerOvercharge: 0,
    opponentOvercharge: 0,
    input: {
        rollShot: false
    }
};

window.addEventListener("DOMContentLoaded", () => {
    canvas = document.getElementById("gameCanvas");
    game.canvas = canvas;

    engine = new BABYLON.Engine(canvas, true);
    scene = new BABYLON.Scene(engine);

    setupCamera();
    setupLighting();
    setupCourt();
    setupCharacters();
    setupBall();
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
    // Roblox-like third-person camera using ArcRotateCamera
    const alpha = Math.PI * 1.5; // behind player
    const beta = Math.PI / 3;    // slightly above
    const radius = 12;           // D1 default distance

    camera = new BABYLON.ArcRotateCamera(
        "camera",
        alpha,
        beta,
        radius,
        new BABYLON.Vector3(0, 2, 0),
        scene
    );

    camera.lowerRadiusLimit = 6;
    camera.upperRadiusLimit = 24;
    camera.wheelPrecision = 30;

    camera.checkCollisions = true;
    camera.collisionRadius = new BABYLON.Vector3(0.5, 0.5, 0.5);
    camera.attachControl(canvas, true);

    scene.collisionsEnabled = true;
}

function setupLighting() {
    light = new BABYLON.HemisphericLight(
        "hemiLight",
        new BABYLON.Vector3(0, 1, 0),
        scene
    );
    light.intensity = 0.9;

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
        { width: 30, height: 18 },
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
        { width: 0.2, height: 2.4, depth: 18 },
        scene
    );
    net.position = new BABYLON.Vector3(0, 1.2, 0);
    net.checkCollisions = true;

    const netMat = new BABYLON.StandardMaterial("netMat", scene);
    netMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
    net.material = netMat;
}

function setupCharacters() {
    // Player
    playerMesh = BABYLON.MeshBuilder.CreateCapsule(
        "player",
        { height: 2, radius: 0.5 },
        scene
    );
    playerMesh.position = new BABYLON.Vector3(-6, 1, 0);
    playerMesh.checkCollisions = true;

    // Opponent
    opponentMesh = BABYLON.MeshBuilder.CreateCapsule(
        "opponent",
        { height: 2, radius: 0.5 },
        scene
    );
    opponentMesh.position = new BABYLON.Vector3(6, 1, 0);
    opponentMesh.checkCollisions = true;

    game.player.x = playerMesh.position.x;
    game.player.y = playerMesh.position.y;
}

function setupBall() {
    ballMesh = BABYLON.MeshBuilder.CreateSphere(
        "ball",
        { diameter: 1 },
        scene
    );
    ballMesh.position = new BABYLON.Vector3(0, 4, 0);

    const ballMat = new BABYLON.StandardMaterial("ballMat", scene);
    ballMat.diffuseColor = new BABYLON.Color3(1, 0.9, 0.6);
    ballMesh.material = ballMat;
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
            // If pointer lock was lost (ESC), disable shift-lock too
            shiftLockEnabled = false;
        }
    });
}

function toggleShiftLock() {
    shiftLockEnabled = !shiftLockEnabled;

    if (shiftLockEnabled) {
        // Request pointer lock but keep cursor visible via CSS
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
    initBall(game);
    initOpponentAI(game);
    initMovement(game);
    initOverchargeUI(game);
}

// ---------------- Update Loop ----------------

function update(dt) {
    updateCameraFollow(dt);
    updatePlayerFromInput(dt);
    syncGameStateFromMeshes();

    updateMovement(game, dt);
    updateBall(game, dt);
    updateOpponentAI(game, dt);
    updateOverchargeUI(game, dt);

    syncMeshesFromGameState();
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

    // Simple ground clamp
    if (playerMesh.position.y < 1) {
        playerMesh.position.y = 1;
    }
}

function syncGameStateFromMeshes() {
    game.player.x = playerMesh.position.x;
    game.player.y = playerMesh.position.y;

    if (game.opponent) {
        opponentMesh.position.x = game.opponent.x;
        opponentMesh.position.y = game.opponent.y;
    }

    if (game.ball) {
        ballMesh.position.x = game.ball.x / 50; // scale if needed
        ballMesh.position.y = game.ball.y / 50;
    }
}

function syncMeshesFromGameState() {
    // If your logic updates positions directly, sync them back here.
    // For now, we assume playerMesh is the source of truth for player.
}

// ---------------- Utility ----------------

// You can add helpers here if needed.
