// main.js
// Core game loop, state, and UI wiring (including Overcharge Meter)

import { UIOvercharge } from "./uiOvercharge.js";
import { updatePlayerMovement, initPlayerMovement } from "./movement.js";
import { updateBall, initBall, handlePlayerSpike } from "./ball.js";
import { updateOpponentAI, initOpponentAI } from "./opponentAI.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const game = {
    canvas,
    ctx,
    timeScale: 1,
    lastTime: 0,

    // State
    state: "menu", // "menu", "playing", "paused"

    // Player
    player: {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        isGrounded: true,
        isApproaching: false,
        isJumping: false,
        isSpiking: false,
        facing: 1,
        isChampion: false
    },

    // Opponent
    opponent: {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        isGrounded: true,
        difficulty: 1
    },

    // Ball
    ball: {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        inPlay: false,
        lastHitBy: null
    },

    // Overcharge
    playerOvercharge: 0, // 0–1
    opponentOvercharge: 0, // 0–1

    // UI
    uiOvercharge: null
};

// ---------- Initialization ----------

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function initGame() {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    initPlayerMovement(game);
    initBall(game);
    initOpponentAI(game);

    game.uiOvercharge = new UIOvercharge(game);
    game.uiOvercharge.setVisible(false); // hidden in menu

    setupInput();
    game.state = "menu";
    requestAnimationFrame(loop);
}

// ---------- Input ----------

function setupInput() {
    window.addEventListener("keydown", (e) => {
        if (e.code === "Space") {
            if (game.state === "menu") {
                startMatch();
            } else if (game.state === "playing") {
                // Jump / spike intent handled in movement.js / ball.js
                game.player.isJumping = true;
            }
        }

        if (e.code === "KeyP") {
            if (game.state === "playing") pauseGame();
            else if (game.state === "paused") resumeGame();
        }
    });

    window.addEventListener("keyup", (e) => {
        if (e.code === "Space") {
            game.player.isJumping = false;
        }
    });
}

function startMatch() {
    game.state = "playing";
    game.playerOvercharge = 0;
    game.opponentOvercharge = 0;
    game.uiOvercharge.setVisible(true);
    resetRally();
}

function pauseGame() {
    game.state = "paused";
    game.uiOvercharge.setVisible(false);
}

function resumeGame() {
    game.state = "playing";
    game.uiOvercharge.setVisible(true);
}

function resetRally() {
    game.ball.inPlay = true;
    game.ball.x = game.canvas.width / 2;
    game.ball.y = game.canvas.height / 3;
    game.ball.vx = 0;
    game.ball.vy = 0;
    game.player.isSpiking = false;
    game.player.isApproaching = false;
}

// ---------- Main Loop ----------

function loop(timestamp) {
    const dt = (timestamp - game.lastTime) / 1000;
    game.lastTime = timestamp;

    update(dt * game.timeScale);
    draw();

    requestAnimationFrame(loop);
}

function update(dt) {
    if (game.state === "menu") {
        // Menu idle animations could go here
        if (game.uiOvercharge) {
            game.uiOvercharge.setCharge(0);
            game.uiOvercharge.setVisible(false);
            game.uiOvercharge.update(dt);
        }
        return;
    }

    if (game.state === "paused") {
        if (game.uiOvercharge) {
            game.uiOvercharge.setVisible(false);
            game.uiOvercharge.update(dt);
        }
        return;
    }

    // --- Playing state ---

    // Movement & overcharge
    updatePlayerMovement(game, dt);

    // Opponent AI & its overcharge
    updateOpponentAI(game, dt);

    // Ball physics & spike handling
    updateBall(game, dt);

    // Overcharge UI
    if (game.uiOvercharge) {
        game.uiOvercharge.setVisible(true);
        game.uiOvercharge.setCharge(game.playerOvercharge);
        game.uiOvercharge.update(dt);
    }
}

// ---------- Drawing ----------

function draw() {
    const { ctx, canvas } = game;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (game.state === "menu") {
        drawMenu(ctx, canvas);
    } else {
        drawCourt(ctx, canvas);
        drawPlayers(ctx, canvas);
        drawBall(ctx, canvas);
    }

    if (game.uiOvercharge) {
        game.uiOvercharge.draw(ctx, canvas);
    }
}

function drawMenu(ctx, canvas) {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#fff";
    ctx.font = "32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Volleyball Overcharge", canvas.width / 2, canvas.height / 2 - 40);
    ctx.font = "20px sans-serif";
    ctx.fillText("Press SPACE to start", canvas.width / 2, canvas.height / 2 + 10);
}

function drawCourt(ctx, canvas) {
    ctx.fillStyle = "#20232a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#2c3e50";
    ctx.fillRect(0, canvas.height * 0.6, canvas.width, canvas.height * 0.4);

    ctx.strokeStyle = "#ecf0f1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height * 0.6);
    ctx.lineTo(canvas.width, canvas.height * 0.6);
    ctx.stroke();
}

function drawPlayers(ctx, canvas) {
    // Player
    ctx.fillStyle = "#3498db";
    ctx.fillRect(game.player.x - 15, game.player.y - 40, 30, 40);

    // Opponent
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(game.opponent.x - 15, game.opponent.y - 40, 30, 40);
}

function drawBall(ctx, canvas) {
    if (!game.ball.inPlay) return;

    ctx.fillStyle = "#f1c40f";
    ctx.beginPath();
    ctx.arc(game.ball.x, game.ball.y, 10, 0, Math.PI * 2);
    ctx.fill();
}

// ---------- Start ----------

initGame();
