// ball.js
// Full volleyball ball system: hybrid realism (R3), spin, hit types, roll shots (RS2), rally logic

export function initBall(game) {
    const { canvas } = game;

    game.ball = {
        x: canvas.width / 2,
        y: canvas.height / 3,
        vx: 0,
        vy: 0,
        spin: 0,              // positive = topspin, negative = underspin
        radius: 10,
        inPlay: false,
        lastHitBy: null,
        lastHitType: null,    // "bump", "set", "spike", "overcharge", "tip", "roll"
        trajectoryCache: []   // for AI prediction
    };

    if (!game.input) game.input = {};
    game.input.rollShot = false;

    // Right mouse button = roll shot
    window.addEventListener("mousedown", (e) => {
        if (e.button === 2) game.input.rollShot = true;
    });
    window.addEventListener("mouseup", (e) => {
        if (e.button === 2) game.input.rollShot = false;
    });
    window.addEventListener("contextmenu", (e) => {
        e.preventDefault();
    });
}

export function updateBall(game, dt) {
    const b = game.ball;
    if (!b.inPlay) return;

    const gravity = 1200;
    const airDrag = 0.995;
    const spinLiftFactor = 0.0009; // hybrid realism: subtle but meaningful

    // Apply gravity
    b.vy += gravity * dt;

    // Apply spin-induced lift (topspin pulls down, underspin floats)
    const spinLift = -b.spin * spinLiftFactor;
    b.vy += spinLift;

    // Integrate
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Air drag
    b.vx *= airDrag;
    b.vy *= airDrag;

    handleCollisions(game, dt);
    cacheTrajectory(game);
    handlePlayerBallInteractions(game, dt);
    handleOpponentBallInteractions(game, dt);
}

function handleCollisions(game, dt) {
    const b = game.ball;
    const { canvas } = game;
    const floorY = canvas.height * 0.6;
    const netX = canvas.width / 2;

    // Floor
    if (b.y > floorY - b.radius) {
        b.y = floorY - b.radius;
        b.vy *= -0.35;
        b.vx *= 0.8;
        b.spin *= 0.5;

        // Rally end: ball touched ground
        endRally(game, b.lastHitBy === "player" ? "opponent" : "player");
    }

    // Net (simple vertical plane)
    if (Math.abs(b.x - netX) < 4 && b.y < floorY && b.y > floorY - 220) {
        b.x = b.x < netX ? netX - 4 : netX + 4;
        b.vx *= -0.5;
        b.spin *= 0.7;
    }

    // Side walls
    if (b.x < 20) {
        b.x = 20;
        b.vx *= -0.6;
        b.spin *= 0.7;
    }
    if (b.x > canvas.width - 20) {
        b.x = canvas.width - 20;
        b.vx *= -0.6;
        b.spin *= 0.7;
    }
}

function endRally(game, winner) {
    game.ball.inPlay = false;
    // You can hook scoring here:
    // if (winner === "player") game.score.player++;
    // else game.score.opponent++;
}

function cacheTrajectory(game) {
    const b = game.ball;
    const { canvas } = game;
    const floorY = canvas.height * 0.6;

    if (!b.inPlay) {
        b.trajectoryCache = [];
        return;
    }

    // Simple forward prediction for AI: simulate a few steps
    const steps = 20;
    const dt = 0.05;
    let x = b.x;
    let y = b.y;
    let vx = b.vx;
    let vy = b.vy;
    let spin = b.spin;

    const gravity = 1200;
    const airDrag = 0.995;
    const spinLiftFactor = 0.0009;

    const points = [];
    for (let i = 0; i < steps; i++) {
        vy += gravity * dt;
        vy += -spin * spinLiftFactor;
        x += vx * dt;
        y += vy * dt;
        vx *= airDrag;
        vy *= airDrag;

        if (y > floorY - b.radius) {
            y = floorY - b.radius;
            vy *= -0.35;
            vx *= 0.8;
            spin *= 0.5;
        }

        points.push({ x, y });
    }

    b.trajectoryCache = points;
}

// ---------- Player Interactions ----------

function handlePlayerBallInteractions(game, dt) {
    const p = game.player;
    const b = game.ball;
    if (!b.inPlay) return;

    const floorY = game.canvas.height * 0.6;
    const contactX = p.x;
    const contactY = p.y - 30;

    const dx = b.x - contactX;
    const dy = b.y - contactY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const withinReach = dist < 45;

    if (!withinReach) return;

    const isBelowChest = b.y > p.y - 10;
    const isAboveHead = b.y < p.y - 60;
    const isMid = !isBelowChest && !isAboveHead;

    const wantsSpike = p.isSpiking;
    const wantsRoll = game.input.rollShot;
    const wantsSet = !wantsSpike && !wantsRoll && isMid;
    const wantsBump = !wantsSpike && !wantsRoll && isBelowChest;
    const wantsTip = wantsSpike && Math.abs(dx) < 15 && dy < -10;

    const contactHeight = floorY - b.y;
    const overchargeReady = game.playerOvercharge >= 0.98;

    if (wantsSpike && !wantsRoll && !wantsTip) {
        if (overchargeReady && contactHeight < 220) {
            applyOverchargeSpike(game, p, b);
            game.playerOvercharge = 0;
            b.lastHitType = "overcharge";
        } else {
            applyNormalSpike(game, p, b);
            game.playerOvercharge = 0;
            b.lastHitType = "spike";
        }
        b.lastHitBy = "player";
        return;
    }

    if (wantsRoll) {
        applyRollShot(game, p, b);
        game.playerOvercharge = Math.max(0, game.playerOvercharge - 0.2);
        b.lastHitBy = "player";
        b.lastHitType = "roll";
        return;
    }

    if (wantsTip) {
        applyTip(game, p, b);
        b.lastHitBy = "player";
        b.lastHitType = "tip";
        return;
    }

    if (wantsSet) {
        applySet(game, p, b);
        b.lastHitBy = "player";
        b.lastHitType = "set";
        return;
    }

    if (wantsBump) {
        applyBump(game, p, b);
        b.lastHitBy = "player";
        b.lastHitType = "bump";
        return;
    }
}

// ---------- Opponent Interactions (AI) ----------

function handleOpponentBallInteractions(game, dt) {
    const o = game.opponent;
    const b = game.ball;
    if (!b.inPlay) return;

    const floorY = game.canvas.height * 0.6;
    const contactX = o.x;
    const contactY = o.y - 30;

    const dx = b.x - contactX;
    const dy = b.y - contactY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const withinReach = dist < 45;
    if (!withinReach) return;

    const isBelowChest = b.y > o.y - 10;
    const isAboveHead = b.y < o.y - 60;
    const isMid = !isBelowChest && !isAboveHead;

    const ai = game.aiProfile;
    const overchargeReady = game.opponentOvercharge >= 0.9 && ai.risk > 0.6;

    const wantsSpike = aiDecisionSpike(game, ai, b, o);
    const wantsRoll = aiDecisionRoll(game, ai, b, o);
    const wantsTip = aiDecisionTip(game, ai, b, o);
    const wantsSet = !wantsSpike && !wantsRoll && isMid;
    const wantsBump = !wantsSpike && !wantsRoll && isBelowChest;

    const contactHeight = floorY - b.y;

    if (wantsSpike && !wantsRoll && !wantsTip) {
        if (overchargeReady && contactHeight < 220) {
            applyOverchargeSpikeAI(game, o, b);
            game.opponentOvercharge = 0;
            b.lastHitType = "overcharge";
        } else {
            applyNormalSpikeAI(game, o, b);
            game.opponentOvercharge = Math.max(0, game.opponentOvercharge - 0.3);
            b.lastHitType = "spike";
        }
        b.lastHitBy = "opponent";
        return;
    }

    if (wantsRoll) {
        applyRollShotAI(game, o, b);
        game.opponentOvercharge = Math.max(0, game.opponentOvercharge - 0.2);
        b.lastHitBy = "opponent";
        b.lastHitType = "roll";
        return;
    }

    if (wantsTip) {
        applyTipAI(game, o, b);
        b.lastHitBy = "opponent";
        b.lastHitType = "tip";
        return;
    }

    if (wantsSet) {
        applySetAI(game, o, b);
        b.lastHitBy = "opponent";
        b.lastHitType = "set";
        return;
    }

    if (wantsBump) {
        applyBumpAI(game, o, b);
        b.lastHitBy = "opponent";
        b.lastHitType = "bump";
        return;
    }
}

// ---------- Hit Implementations (Player) ----------

function applyBump(game, p, b) {
    const baseSpeed = 650;
    const angle = -Math.PI * 0.35;
    const dirX = p.x < game.canvas.width / 2 ? 1 : -1;

    b.vx = dirX * baseSpeed * Math.cos(angle);
    b.vy = baseSpeed * Math.sin(angle);
    b.spin = -80; // slight underspin
}

function applySet(game, p, b) {
    const baseSpeed = 520;
    const angle = -Math.PI * 0.6;
    const dirX = p.x < game.canvas.width / 2 ? 1 : -1;

    b.vx = dirX * baseSpeed * Math.cos(angle);
    b.vy = baseSpeed * Math.sin(angle);
    b.spin = 40; // light topspin
}

function applyNormalSpike(game, p, b) {
    const baseSpeed = 950;
    const angleDown = Math.PI * 0.65;
    const dirX = p.facing;

    b.vx = dirX * baseSpeed * Math.cos(angleDown);
    b.vy = baseSpeed * Math.sin(angleDown);
    b.spin = 160; // strong topspin
}

function applyOverchargeSpike(game, p, b) {
    const baseSpeed = 1250;
    const angleDown = Math.PI * 0.8;
    const dirX = p.facing;

    b.vx = dirX * baseSpeed * Math.cos(angleDown);
    b.vy = baseSpeed * Math.sin(angleDown);
    b.spin = 220; // very strong topspin
}

function applyRollShot(game, p, b) {
    const baseSpeed = 720; // RS2 hybrid: faster than realistic, slower than spike
    const angle = -Math.PI * 0.55; // higher arc than spike
    const dirX = p.facing;

    b.vx = dirX * baseSpeed * Math.cos(angle);
    b.vy = baseSpeed * Math.sin(angle);
    b.spin = 180; // heavy topspin for dip
}

function applyTip(game, p, b) {
    const baseSpeed = 420;
    const angle = -Math.PI * 0.4;
    const dirX = p.facing;

    b.vx = dirX * baseSpeed * Math.cos(angle);
    b.vy = baseSpeed * Math.sin(angle);
    b.spin = 60;
}

// ---------- Hit Implementations (AI) ----------

function applyBumpAI(game, o, b) {
    const baseSpeed = 630;
    const angle = -Math.PI * 0.35;
    const dirX = o.x > game.canvas.width / 2 ? -1 : 1;

    b.vx = dirX * baseSpeed * Math.cos(angle);
    b.vy = baseSpeed * Math.sin(angle);
    b.spin = -70;
}

function applySetAI(game, o, b) {
    const baseSpeed = 500;
    const angle = -Math.PI * 0.6;
    const dirX = o.x > game.canvas.width / 2 ? -1 : 1;

    b.vx = dirX * baseSpeed * Math.cos(angle);
    b.vy = baseSpeed * Math.sin(angle);
    b.spin = 40;
}

function applyNormalSpikeAI(game, o, b) {
    const baseSpeed = 900;
    const angleDown = Math.PI * 0.65;
    const dirX = o.x > game.canvas.width / 2 ? -1 : 1;

    b.vx = dirX * baseSpeed * Math.cos(angleDown);
    b.vy = baseSpeed * Math.sin(angleDown);
    b.spin = 150;
}

function applyOverchargeSpikeAI(game, o, b) {
    const baseSpeed = 1180;
    const angleDown = Math.PI * 0.78;
    const dirX = o.x > game.canvas.width / 2 ? -1 : 1;

    b.vx = dirX * baseSpeed * Math.cos(angleDown);
    b.vy = baseSpeed * Math.sin(angleDown);
    b.spin = 210;
}

function applyRollShotAI(game, o, b) {
    const baseSpeed = 700;
    const angle = -Math.PI * 0.55;
    const dirX = o.x > game.canvas.width / 2 ? -1 : 1;

    b.vx = dirX * baseSpeed * Math.cos(angle);
    b.vy = baseSpeed * Math.sin(angle);
    b.spin = 170;
}

function applyTipAI(game, o, b) {
    const baseSpeed = 400;
    const angle = -Math.PI * 0.4;
    const dirX = o.x > game.canvas.width / 2 ? -1 : 1;

    b.vx = dirX * baseSpeed * Math.cos(angle);
    b.vy = baseSpeed * Math.sin(angle);
    b.spin = 50;
}

// ---------- AI Decision Helpers ----------

function aiDecisionSpike(game, ai, b, o) {
    const floorY = game.canvas.height * 0.6;
    const contactHeight = floorY - b.y;
    const highEnough = contactHeight < 260 && contactHeight > 120;
    const ballOnTheirSide = b.x > game.canvas.width / 2 + 20;
    const aggressive = ai.aggression > 0.5;
    return highEnough && ballOnTheirSide && aggressive;
}

function aiDecisionRoll(game, ai, b, o) {
    const floorY = game.canvas.height * 0.6;
    const contactHeight = floorY - b.y;
    const midHeight = contactHeight >= 140 && contactHeight <= 260;
    const ballOnTheirSide = b.x > game.canvas.width / 2 + 20;
    const risk = ai.risk > 0.4;
    const patience = ai.patience > 0.3;
    return midHeight && ballOnTheirSide && risk && patience;
}

function aiDecisionTip(game, ai, b, o) {
    const floorY = game.canvas.height * 0.6;
    const contactHeight = floorY - b.y;
    const closeToNet = Math.abs(b.x - game.canvas.width / 2) < 80;
    const midHeight = contactHeight > 120 && contactHeight < 220;
    const trickiness = ai.risk > 0.5 && ai.patience > 0.5;
    return closeToNet && midHeight && trickiness;
}
