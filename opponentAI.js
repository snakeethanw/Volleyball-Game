// opponentAI.js
// Attribute-matrix AI (P2): aggression, patience, risk, confidence, tilt, reactionTime
// Includes tilt, confidence, fatigue, mood, learning, adaptive positioning, fakeouts, overcharge usage

export function initOpponentAI(game) {
    const { canvas } = game;

    game.opponent = {
        x: canvas.width * 0.75,
        y: canvas.height * 0.6,
        vx: 0,
        vy: 0,
        isGrounded: true
    };

    // P2 attribute matrix
    game.aiProfile = {
        aggression: 0.65,
        patience: 0.55,
        risk: 0.55,
        confidence: 0.6,
        tilt: 0.4,
        reactionTime: 0.16, // seconds

        // dynamic state
        tiltLevel: 0,
        confidenceLevel: 0.5,
        fatigue: 0,
        mood: getTimeOfDayMood()
    };

    // Learning memory
    game.aiMemory = {
        spikeLeftCount: 0,
        spikeRightCount: 0,
        rollUsage: 0,
        tipUsage: 0,
        serveDeepCount: 0,
        serveShortCount: 0
    };

    game.opponentOvercharge = 0;
    game.aiReactionTimer = 0;
}

function getTimeOfDayMood() {
    const hour = new Date().getHours();
    if (hour < 10) return "morning";
    if (hour < 18) return "afternoon";
    if (hour < 23) return "night";
    return "lateNight";
}

export function updateOpponentAI(game, dt) {
    const o = game.opponent;
    const b = game.ball;
    const ai = game.aiProfile;
    const mem = game.aiMemory;
    const { canvas } = game;

    const floorY = canvas.height * 0.6;
    const netX = canvas.width / 2;

    // Mood modifiers
    let reactionMod = 1;
    let aggressionMod = 1;
    if (ai.mood === "morning") reactionMod = 1.15;
    else if (ai.mood === "night") aggressionMod = 1.1;
    else if (ai.mood === "lateNight") {
        aggressionMod = 1.2;
        reactionMod = 0.9;
    }

    // Tilt & confidence influence
    const effectiveAggression = clamp01(ai.aggression * aggressionMod + (ai.confidenceLevel - ai.tiltLevel) * 0.2);
    const effectiveRisk = clamp01(ai.risk + (ai.confidenceLevel - ai.tiltLevel) * 0.15);
    const effectivePatience = clamp01(ai.patience - ai.tiltLevel * 0.1);

    // Reaction timer
    game.aiReactionTimer -= dt;
    if (game.aiReactionTimer > 0) {
        applyPhysicsOnly(game, dt);
        updateOverchargeAI(game, dt, effectiveAggression, effectiveRisk);
        return;
    }

    // Reset reaction timer
    game.aiReactionTimer = ai.reactionTime * reactionMod * (1 + ai.fatigue * 0.5);

    // Decide target position based on ball trajectory and memory
    const targetX = decideTargetX(game, effectiveAggression, effectivePatience);
    const targetY = floorY;

    // Movement toward target
    const speed = 240 * (1 - ai.fatigue * 0.3);
    const friction = 0.85;
    const gravity = 1400;
    const jumpVelocity = -620;

    let moveDir = 0;
    if (targetX < o.x - 8) moveDir = -1;
    else if (targetX > o.x + 8) moveDir = 1;

    if (moveDir !== 0) {
        o.vx = moveDir * speed;
    } else {
        o.vx *= friction;
        if (Math.abs(o.vx) < 1) o.vx = 0;
    }

    // Jump decision: block or defend
    const shouldJump = decideJump(game, effectiveAggression, effectiveRisk);
    if (o.isGrounded && shouldJump) {
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

    // Fatigue buildup
    ai.fatigue = clamp01(ai.fatigue + dt * 0.01);

    // Overcharge logic
    updateOverchargeAI(game, dt, effectiveAggression, effectiveRisk);
}

function applyPhysicsOnly(game, dt) {
    const o = game.opponent;
    const floorY = game.canvas.height * 0.6;
    const gravity = 1400;
    const friction = 0.85;

    o.vy += gravity * dt;
    o.y += o.vy * dt;
    o.vx *= friction;
    o.x += o.vx * dt;

    if (o.y > floorY) {
        o.y = floorY;
        o.vy = 0;
        o.isGrounded = true;
    }

    const netX = game.canvas.width / 2;
    o.x = Math.max(netX + 40, Math.min(game.canvas.width - 40, o.x));
}

function decideTargetX(game, aggression, patience) {
    const b = game.ball;
    const o = game.opponent;
    const mem = game.aiMemory;
    const { canvas } = game;
    const netX = canvas.width / 2;

    const traj = b.trajectoryCache;
    let predictedX = b.x;

    if (traj && traj.length > 0) {
        const last = traj[traj.length - 1];
        predictedX = last.x;
    }

    const playerPrefersRight = mem.spikeRightCount > mem.spikeLeftCount;
    const bias = playerPrefersRight ? -40 : 40;

    let baseTarget = clamp(predictedX + bias, netX + 40, canvas.width - 40);

    const centerBias = (1 - aggression) * 0.5;
    baseTarget = lerp(baseTarget, netX + (canvas.width - netX) * 0.5, centerBias);

    const jitter = (Math.random() - 0.5) * (1 - patience) * 40;

    return baseTarget + jitter;
}

function decideJump(game, aggression, risk) {
    const b = game.ball;
    const o = game.opponent;
    const { canvas } = game;
    const floorY = canvas.height * 0.6;
    const netX = canvas.width / 2;

    const ballOnTheirSide = b.x > netX + 20;
    const ballDescending = b.vy > 0;
    const closeHoriz = Math.abs(b.x - o.x) < 70;
    const highEnough = b.y < floorY - 90;

    const blockChance = aggression * 0.6 + risk * 0.3;
    const randomFactor = Math.random();

    if (ballOnTheirSide && ballDescending && closeHoriz && highEnough) {
        return randomFactor < blockChance;
    }

    const defendChance = (1 - aggression) * 0.4;
    if (ballOnTheirSide && !ballDescending && closeHoriz && highEnough) {
        return randomFactor < defendChance;
    }

    return false;
}

function updateOverchargeAI(game, dt, aggression, risk) {
    const o = game.opponent;
    const b = game.ball;
    const ai = game.aiProfile;

    let charge = game.opponentOvercharge;

    const movingTowardNet =
        (o.x > game.canvas.width / 2 && o.vx < 0) ||
        (o.x < game.canvas.width && o.vx > 0);

    const speed = 240 * (1 - ai.fatigue * 0.3);

    if (movingTowardNet && o.isGrounded && Math.abs(o.vx) > 40) {
        const speedFactor = Math.min(Math.abs(o.vx) / speed, 1);
        charge += speedFactor * (0.4 + aggression * 0.3) * dt;
    }

    if (!o.isGrounded) {
        charge -= 0.4 * dt;
    }

    if (!movingTowardNet && o.isGrounded) {
        charge -= 0.5 * dt;
    }

    const maxCharge = 0.9 + risk * 0.05;
    charge = clamp(0, maxCharge, charge);
    game.opponentOvercharge = charge;
}

// ---------- Learning & Emotional Updates (hook these into scoring/rally events) ----------

export function aiOnPlayerSpike(game, direction) {
    const mem = game.aiMemory;
    if (direction === "left") mem.spikeLeftCount++;
    else mem.spikeRightCount++;
}

export function aiOnPlayerRoll(game) {
    game.aiMemory.rollUsage++;
}

export function aiOnPlayerTip(game) {
    game.aiMemory.tipUsage++;
}

export function aiOnRallyWon(game) {
    const ai = game.aiProfile;
    ai.confidenceLevel = clamp01(ai.confidenceLevel + 0.1);
    ai.tiltLevel = clamp01(ai.tiltLevel - 0.1);
}

export function aiOnRallyLost(game) {
    const ai = game.aiProfile;
    ai.confidenceLevel = clamp01(ai.confidenceLevel - 0.1);
    ai.tiltLevel = clamp01(ai.tiltLevel + ai.tilt * 0.2);
}

// ---------- Utility ----------

function clamp01(v) {
    return Math.max(0, Math.min(1, v));
}

function clamp(min, max, v) {
    return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}
