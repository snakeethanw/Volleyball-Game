// movement.js
// Player movement and Overcharge charge/decay/reset logic

export function initPlayerMovement(game) {
    const { canvas } = game;
    game.player.x = canvas.width * 0.25;
    game.player.y = canvas.height * 0.6;
    game.player.vx = 0;
    game.player.vy = 0;
    game.player.isGrounded = true;
    game.player.isApproaching = false;
    game.player.isJumping = false;
    game.player.isSpiking = false;

    // Input state
    game.input = {
        left: false,
        right: false,
        spike: false
    };

    setupMovementInput(game);
}

function setupMovementInput(game) {
    window.addEventListener("keydown", (e) => {
        if (e.code === "ArrowLeft" || e.code === "KeyA") game.input.left = true;
        if (e.code === "ArrowRight" || e.code === "KeyD") game.input.right = true;
        if (e.code === "KeyJ") game.input.spike = true;
    });

    window.addEventListener("keyup", (e) => {
        if (e.code === "ArrowLeft" || e.code === "KeyA") game.input.left = false;
        if (e.code === "ArrowRight" || e.code === "KeyD") game.input.right = false;
        if (e.code === "KeyJ") game.input.spike = false;
    });
}

export function updatePlayerMovement(game, dt) {
    const p = game.player;
    const speed = 260;
    const friction = 0.85;
    const gravity = 1400;
    const jumpVelocity = -650;

    // Horizontal input
    let moveDir = 0;
    if (game.input.left) moveDir -= 1;
    if (game.input.right) moveDir += 1;

    if (moveDir !== 0) {
        p.vx = moveDir * speed;
        p.facing = moveDir;
    } else {
        p.vx *= friction;
        if (Math.abs(p.vx) < 1) p.vx = 0;
    }

    // Approach detection: moving toward net (center)
    const netX = game.canvas.width / 2;
    const movingTowardNet =
        (p.x < netX && p.vx > 0) ||
        (p.x > netX && p.vx < 0);

    p.isApproaching = movingTowardNet && Math.abs(p.vx) > 40 && p.isGrounded;

    // Jump
    if (p.isGrounded && game.player.isJumping) {
        p.vy = jumpVelocity;
        p.isGrounded = false;
    }

    // Gravity
    p.vy += gravity * dt;

    // Integrate
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Ground collision
    const groundY = game.canvas.height * 0.6;
    if (p.y > groundY) {
        p.y = groundY;
        p.vy = 0;
        p.isGrounded = true;
    }

    // Clamp within court
    p.x = Math.max(40, Math.min(game.canvas.width * 0.5 - 40, p.x));

    // Spike intent
    p.isSpiking = !p.isGrounded && game.input.spike;

    // --- Overcharge Logic ---

    let charge = game.playerOvercharge;
    const isChampion = p.isChampion;

    const buildRate = isChampion ? 0.9 : 1.0;
    const decayRate = isChampion ? 0.6 : 0.8;

    // Build from approach speed & distance
    if (p.isApproaching) {
        const speedFactor = Math.min(Math.abs(p.vx) / speed, 1);
        charge += speedFactor * buildRate * dt * 0.6;
    }

    // Extra build when jumping out of an approach
    if (!p.isGrounded && movingTowardNet && Math.abs(p.vx) > 40) {
        charge += buildRate * dt * 0.4;
    }

    // Decay when stopping or moving backward
    if (!p.isApproaching && p.isGrounded) {
        charge -= decayRate * dt * 0.5;
    }

    // Decay in air without spike intent
    if (!p.isGrounded && !p.isSpiking) {
        charge -= decayRate * dt * 0.3;
    }

    // Reset after landing from spike (handled in ball.js when spike resolves)
    // Here we just clamp
    charge = Math.max(0, Math.min(1, charge));
    game.playerOvercharge = charge;
}
