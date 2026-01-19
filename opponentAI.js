// opponentAI.js
// Opponent movement, basic AI, and Overcharge logic

export function initOpponentAI(game) {
    const { canvas } = game;
    game.opponent.x = canvas.width * 0.75;
    game.opponent.y = canvas.height * 0.6;
    game.opponent.vx = 0;
    game.opponent.vy = 0;
    game.opponent.isGrounded = true;
    game.opponent.difficulty = 1; // 1 = normal, 2 = hard, etc.
    game.opponentOvercharge = 0;
}

export function updateOpponentAI(game, dt) {
    const o = game.opponent;
    const b = game.ball;
    const { canvas } = game;

    const speed = 220;
    const friction = 0.85;
    const gravity = 1400;
    const jumpVelocity = -620;

    // Simple positioning AI: move toward predicted ball x on their side
    const netX = canvas.width / 2;
    const targetX = Math.max(netX + 40, Math.min(canvas.width - 40, b.x));

    let moveDir = 0;
    if (targetX < o.x - 10) moveDir = -1;
    else if (targetX > o.x + 10) moveDir = 1;

    if (moveDir !== 0) {
        o.vx = moveDir * speed;
    } else {
        o.vx *= friction;
        if (Math.abs(o.vx) < 1) o.vx = 0;
    }

    // Jump when ball is coming down near them
    const floorY = canvas.height * 0.6;
    const ballAbove = b.y < floorY - 80;
    const ballDescending = b.vy > 0;
    const closeHoriz = Math.abs(b.x - o.x) < 60;

    if (o.isGrounded && ballAbove && ballDescending && closeHoriz) {
        o.vy = jumpVelocity;
        o.isGrounded = false;
    }

    // Gravity
    o.vy += gravity * dt;

    // Integrate
    o.x += o.vx * dt;
    o.y += o.vy * dt;

    // Ground
    if (o.y > floorY) {
        o.y = floorY;
        o.vy = 0;
        o.isGrounded = true;
    }

    // Clamp to their side
    o.x = Math.max(netX + 40, Math.min(canvas.width - 40, o.x));

    // --- Overcharge Logic for AI ---

    let charge = game.opponentOvercharge;

    const difficulty = o.difficulty;
    const maxCharge = difficulty >= 2 ? 0.9 : 0.75;
    const buildRate = difficulty >= 2 ? 0.7 : 0.5;
    const decayRate = 0.7;

    const movingTowardNet =
        (o.x > netX && o.vx < 0) ||
        (o.x < canvas.width && o.vx > 0);

    if (movingTowardNet && o.isGrounded && Math.abs(o.vx) > 40) {
        const speedFactor = Math.min(Math.abs(o.vx) / speed, 1);
        charge += speedFactor * buildRate * dt * 0.5;
    }

    if (!o.isGrounded) {
        charge -= decayRate * dt * 0.3;
    }

    if (!movingTowardNet && o.isGrounded) {
        charge -= decayRate * dt * 0.4;
    }

    charge = Math.max(0, Math.min(maxCharge, charge));
    game.opponentOvercharge = charge;

    // AI spike logic could use charge later for special spikes
}
