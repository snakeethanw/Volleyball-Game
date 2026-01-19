// opponentAI.js
// Full advanced 3D AI with attribute matrix, tilt, confidence, fatigue, mood, learning, fakeouts
// - Uses advanced ball.js predictLanding()
// - Positions in 3D on opponent side
// - Decides jump/block/defend/let-ball-go
// - Uses game.aiProfile + game.aiMemory
// - Overcharge logic, emotional updates, pattern learning, serve reading

export class OpponentAI {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;

        // 3D mesh
        this.mesh = BABYLON.MeshBuilder.CreateCapsule(
            "opponent",
            { height: 2, radius: 0.5 },
            this.scene
        );
        this.mesh.position = new BABYLON.Vector3(0, 1, 7);

        const mat = new BABYLON.StandardMaterial("opponentMat", this.scene);
        mat.diffuseColor = new BABYLON.Color3(1.0, 0.4, 0.4);
        this.mesh.material = mat;

        // Movement
        this.speedBase = 6.5;
        this.jumpForce = 9.5;
        this.gravity = -24;
        this.velocityY = 0;
        this.onGround = true;

        // AI state (from game.aiProfile / aiMemory)
        this.profile = this.game.aiProfile;
        this.memory = this.game.aiMemory;

        // Internal
        this.hitCooldown = 0;
        this.fakeoutTimer = 0;
        this.lastServeSide = "player";
        this.lastServeDepth = "neutral";
    }

    update(dt) {
        const ball = this.game.ball;
        if (!ball) return;
        if (!ball.inRally && !ball.isServe) return;

        const ai = this.profile;
        const mem = this.memory;
        const pos = this.mesh.position;
        const ballPos = ball.mesh.position;

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
        this.game.aiReactionTimer -= dt;
        if (this.game.aiReactionTimer > 0) {
            this._applyVerticalPhysicsOnly(dt);
            this._updateOverchargeAI(dt, effectiveAggression, effectiveRisk);
            return;
        }

        // Reset reaction timer
        this.game.aiReactionTimer = ai.reactionTime * reactionMod * (1 + ai.fatigue * 0.5);

        // Predict landing using advanced ball.js
        const predicted = ball.predictLanding(3.0, 0.03);
        let targetX = predicted.x;
        let targetZ = 7;

        // Serve reading: deep vs short
        if (ball.isServe) {
            const serveDepth = ballPos.z > 4 ? "deep" : "short";
            this.lastServeDepth = serveDepth;
            if (serveDepth === "deep") mem.serveDeepCount++;
            else mem.serveShortCount++;
        }

        // Memory bias: spike direction preference
        const playerPrefersRight = mem.spikeRightCount > mem.spikeLeftCount;
        const sideBias = playerPrefersRight ? -2.0 : 2.0;
        targetX += sideBias;

        // Center bias based on aggression/patience
        const centerBias = (1 - effectiveAggression) * 0.5;
        targetX = lerp(targetX, 0, centerBias);

        // Depth bias based on serve memory
        const deepBiasFactor = mem.serveDeepCount > mem.serveShortCount ? 1 : -1;
        targetZ = 7 + deepBiasFactor * 0.5 * (effectiveAggression - 0.5);

        // Jitter based on patience (fakeouts)
        const jitter = (Math.random() - 0.5) * (1 - effectivePatience) * 3.0;
        targetX += jitter;

        // Fakeout timer: occasionally commit then bail
        this.fakeoutTimer -= dt;
        if (this.fakeoutTimer <= 0 && Math.random() < (1 - effectivePatience) * 0.15) {
            this.fakeoutTimer = 1.2 + Math.random() * 0.8;
            targetX += (Math.random() - 0.5) * 4.0;
        }

        // Clamp to opponent side
        targetX = BABYLON.Scalar.Clamp(targetX, -7.0, 7.0);
        targetZ = BABYLON.Scalar.Clamp(targetZ, 1.5, 11.5);

        // Horizontal movement
        const dx = targetX - pos.x;
        const dz = targetZ - pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const moveSpeed = this.speedBase * (1 - ai.fatigue * 0.3);

        if (dist > 0.1) {
            const nx = dx / dist;
            const nz = dz / dist;
            pos.x += nx * moveSpeed * dt;
            pos.z += nz * moveSpeed * dt;
        }

        // Keep on opponent half
        if (pos.z < 0.5) pos.z = 0.5;

        // Vertical physics
        this.velocityY += this.gravity * dt;
        pos.y += this.velocityY * dt;

        if (pos.y <= 1) {
            pos.y = 1;
            this.velocityY = 0;
            this.onGround = true;
        }

        // Jump decision
        const shouldJump = this._decideJump(ball, effectiveAggression, effectiveRisk, effectivePatience);
        if (this.onGround && shouldJump) {
            this.velocityY = this.jumpForce;
            this.onGround = false;
        }

        // Hit decision
        this.hitCooldown = Math.max(0, this.hitCooldown - dt);
        const canHit =
            this.hitCooldown <= 0 &&
            ballPos.z > 0 &&
            BABYLON.Vector3.Distance(
                pos.add(new BABYLON.Vector3(0, 1.6, 0)),
                ballPos
            ) < 2.8;

        if (canHit) {
            const context = this._buildHitContext(ball, effectiveAggression, effectiveRisk);
            const success = ball.opponentHit(context);
            if (success) {
                this.hitCooldown = 0.4;
                ai.confidenceLevel = clamp01(ai.confidenceLevel + 0.05);
                ai.tiltLevel = clamp01(ai.tiltLevel - 0.02);
                ai.fatigue = clamp01(ai.fatigue + 0.01);

                // Learning hooks
                this._learnFromHit(ball, context);
            } else {
                ai.confidenceLevel = clamp01(ai.confidenceLevel - 0.03);
                ai.tiltLevel = clamp01(ai.tiltLevel + 0.02);
            }
        }

        // Fatigue buildup
        ai.fatigue = clamp01(ai.fatigue + dt * 0.01);

        // Overcharge logic
        this._updateOverchargeAI(dt, effectiveAggression, effectiveRisk);
    }

    _applyVerticalPhysicsOnly(dt) {
        const pos = this.mesh.position;
        this.velocityY += this.gravity * dt;
        pos.y += this.velocityY * dt;

        if (pos.y <= 1) {
            pos.y = 1;
            this.velocityY = 0;
            this.onGround = true;
        }
    }

    _decideJump(ball, aggression, risk, patience) {
        const pos = this.mesh.position;
        const ballPos = ball.mesh.position;

        const ballOnTheirSide = ballPos.z > 0.5;
        const ballDescending = ball.velocity.y < 0;
        const closeHoriz = Math.abs(ballPos.x - pos.x) < 2.5;
        const highEnough = ballPos.y > 2.2;

        const blockChance = aggression * 0.6 + risk * 0.3;
        const randomFactor = Math.random();

        if (ballOnTheirSide && ballDescending && closeHoriz && highEnough) {
            return randomFactor < blockChance;
        }

        const defendChance = (1 - aggression) * 0.4 + patience * 0.2;
        if (ballOnTheirSide && !ballDescending && closeHoriz && highEnough) {
            return randomFactor < defendChance;
        }

        return false;
    }

    _buildHitContext(ball, aggression, risk) {
        const ai = this.profile;
        const mem = this.memory;
        const pos = this.mesh.position;
        const ballPos = ball.mesh.position;

        // Decide hit type based on aggression, risk, overcharge, and ball height
        let type = "spike";
        const height = ballPos.y;

        if (height < 2.0) {
            type = "bump";
        } else if (height < 3.0) {
            type = Math.random() < 0.5 ? "roll" : "tip";
        } else {
            const spikeBias = aggression * 0.7 + ai.confidenceLevel * 0.3;
            const rollBias = (1 - aggression) * 0.4 + risk * 0.2;
            const tipBias = (1 - risk) * 0.3;

            const r = Math.random();
            if (r < spikeBias) type = "spike";
            else if (r < spikeBias + rollBias) type = "roll";
            else type = "tip";
        }

        // Overcharge usage: if high, more aggressive choices
        const oc = this.game.opponentOvercharge;
        if (oc > 0.8 && type !== "spike") {
            if (Math.random() < 0.6) type = "spike";
        }

        // Direction: left/right based on memory
        const preferRight = mem.spikeRightCount > mem.spikeLeftCount;
        const dir = preferRight ? 1 : -1;

        return {
            type,
            aggression,
            risk,
            overcharge: oc,
            direction: dir,
            contactHeight: height
        };
    }

    _learnFromHit(ball, context) {
        const mem = this.memory;
        if (context.type === "roll") mem.rollUsage++;
        if (context.type === "tip") mem.tipUsage++;

        if (context.type === "spike") {
            if (context.direction < 0) mem.spikeLeftCount++;
            else mem.spikeRightCount++;
        }
    }

    _updateOverchargeAI(dt, aggression, risk) {
        const ai = this.profile;
        const pos = this.mesh.position;

        let charge = this.game.opponentOvercharge;

        const movingTowardNet = pos.z > 0 && this.velocityY <= 0;
        const speed = this.speedBase * (1 - ai.fatigue * 0.3);

        if (movingTowardNet && this.onGround) {
            const speedFactor = 0.7;
            charge += speedFactor * (0.4 + aggression * 0.3) * dt;
        }

        if (!this.onGround) {
            charge -= 0.4 * dt;
        }

        if (!movingTowardNet && this.onGround) {
            charge -= 0.5 * dt;
        }

        const maxCharge = 0.9 + risk * 0.05;
        charge = clamp(0, maxCharge, charge);
        this.game.opponentOvercharge = charge;
    }

    onPointResult(won) {
        const ai = this.profile;
        if (won) {
            ai.confidenceLevel = clamp01(ai.confidenceLevel + 0.1);
            ai.tiltLevel = clamp01(ai.tiltLevel - 0.1);
            ai.fatigue = clamp01(ai.fatigue + 0.02);
        } else {
            ai.confidenceLevel = clamp01(ai.confidenceLevel - 0.1);
            ai.tiltLevel = clamp01(ai.tiltLevel + ai.tilt * 0.2);
            ai.fatigue = clamp01(ai.fatigue + 0.04);
        }
    }
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
