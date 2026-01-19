// ball.js
// Ball physics, spike handling, and Overcharge spike behavior

export function initBall(game) {
    const { canvas } = game;
    game.ball.x = canvas.width / 2;
    game.ball.y = canvas.height / 3;
    game.ball.vx = 0;
    game.ball.vy = 0;
    game.ball.inPlay = false;
    game.ball.lastHitBy = null;
}

export function updateBall(game, dt) {
    const b = game.ball;
    if (!b.inPlay) return;

    const gravity = 1200;

    b.vy += gravity * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Floor
    const floorY = game.canvas.height * 0.6;
    if (b.y > floorY - 10) {
        b.y = floorY - 10;
        b.vy *= -0.4;
        b.vx *= 0.8;

        // Rally end condition could go here
    }

    // Net collision (simple)
    const netX = game.canvas.width / 2;
    if (Math.abs(b.x - netX) < 6 && b.y < floorY && b.y > floorY - 200) {
        b.vx *= -0.6;
    }

    // Side walls
    if (b.x < 20) {
        b.x = 20;
        b.vx *= -0.6;
    }
    if (b.x > game.canvas.width - 20) {
        b.x = game.canvas.width - 20;
        b.vx *= -0.6;
    }

    // Player spike check
    handlePlayerSpike(game);
}

export function handlePlayerSpike(game) {
    const p = game.player;
    const b = game.ball;
    const floorY = game.canvas.height * 0.6;

    if (!b.inPlay) return;
    if (!p.isSpiking) return;

    const dx = b.x - p.x;
    const dy = b.y - (p.y - 30);
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 40 && b.y < p.y) {
        const contactHeight = floorY - b.y;

        const overchargeReady = game.playerOvercharge >= 0.98;
        if (overchargeReady && contactHeight < 220) {
            applyOverchargeSpike(game, p, b);
            game.playerOvercharge = 0;
        } else {
            applyNormalSpike(game, p, b);
            game.playerOvercharge = 0;
        }

        p.isSpiking = false;
        b.lastHitBy = "player";
    }
}

function applyNormalSpike(game, p, b) {
    const baseSpeed = 900;
    const angleDown = Math.PI * 0.65; // downward

    const dirX = p.facing;
    const vx = dirX * baseSpeed * Math.cos(angleDown);
    const vy = baseSpeed * Math.sin(angleDown);

    b.vx = vx;
    b.vy = vy;
}

function applyOverchargeSpike(game, p, b) {
    const baseSpeed = 1250;
    const angleDown = Math.PI * 0.8; // steeper downward

    const dirX = p.facing;
    const vx = dirX * baseSpeed * Math.cos(angleDown);
    const vy = baseSpeed * Math.sin(angleDown);

    b.vx = vx;
    b.vy = vy;

    // Optional: small screen shake or effect could be triggered here
}
