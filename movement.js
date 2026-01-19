// movement.js
// Full advanced player movement, jump, approach speed, and hit timing hooks
// - 3D movement synced to camera (Roblox-style feel)
// - Jump with gravity
// - Approach speed tracking
// - Hit buffer + hit type selection (spike, tip, roll, bump, set-ready)
// - Overcharge gain based on timing + hit type
// - Fully synced with advanced ball.js and main.js

export function initMovement(game) {
    const scene = game.scene;
    const playerMesh = game.playerMesh;

    const input = {
        forward: false,
        back: false,
        left: false,
        right: false,
        jump: false,
        hitSpike: false,
        hitTip: false,
        hitRoll: false,
        hitBump: false,
        hitSet: false
    };

    const speed = 7.5;
    const jumpForce = 9.5;
    const gravity = -24;

    let velocityY = 0;
    let onGround = true;
    let lastPos = playerMesh.position.clone();
    let approachSpeed = 0;
    let hitBuffer = 0;

    // ---------------- Input mapping ----------------

    window.addEventListener("keydown", (e) => {
        if (e.code === "KeyW" || e.code === "ArrowUp") input.forward = true;
        if (e.code === "KeyS" || e.code === "ArrowDown") input.back = true;
        if (e.code === "KeyA" || e.code === "ArrowLeft") input.left = true;
        if (e.code === "KeyD" || e.code === "ArrowRight") input.right = true;
        if (e.code === "Space") input.jump = true;

        if (e.code === "KeyJ") input.hitSpike = true; // spike
        if (e.code === "KeyK") input.hitTip = true;   // tip
        if (e.code === "KeyL") input.hitRoll = true;  // roll
        if (e.code === "KeyU") input.hitBump = true;  // bump/pass
        if (e.code === "KeyI") input.hitSet = true;   // set
    });

    window.addEventListener("keyup", (e) => {
        if (e.code === "KeyW" || e.code === "ArrowUp") input.forward = false;
        if (e.code === "KeyS" || e.code === "ArrowDown") input.back = false;
        if (e.code === "KeyA" || e.code === "ArrowLeft") input.left = false;
        if (e.code === "KeyD" || e.code === "ArrowRight") input.right = false;
        if (e.code === "Space") input.jump = false;

        if (e.code === "KeyJ") input.hitSpike = false;
        if (e.code === "KeyK") input.hitTip = false;
        if (e.code === "KeyL") input.hitRoll = false;
        if (e.code === "KeyU") input.hitBump = false;
        if (e.code === "KeyI") input.hitSet = false;
    });

    // ---------------- Core update ----------------

    function update(dt) {
        if (!playerMesh || game.state === "point" || game.state === "replay") return;

        // --- Movement (camera-relative, like Roblox) ---
        let moveX = 0;
        let moveZ = 0;

        if (input.forward) moveZ += 1;
        if (input.back) moveZ -= 1;
        if (input.left) moveX -= 1;
        if (input.right) moveX += 1;

        const len = Math.hypot(moveX, moveZ);
        if (len > 0) {
            moveX /= len;
            moveZ /= len;
        }

        if (len > 0) {
            const camForward = game.camera.getForwardRay().direction;
            const camRight = game.camera.getDirection(new BABYLON.Vector3(1, 0, 0));

            const moveDir = new BABYLON.Vector3(
                camForward.x * moveZ + camRight.x * moveX,
                0,
                camForward.z * moveZ + camRight.z * moveX
            );

            moveDir.normalize();
            playerMesh.position.addInPlace(moveDir.scale(speed * dt));

            const angle = Math.atan2(moveDir.x, moveDir.z);
            playerMesh.rotation.y = angle;
            game.player.facing = moveDir.x >= 0 ? 1 : -1;
        }

        // Clamp to player side of court
        playerMesh.position.x = BABYLON.Scalar.Clamp(playerMesh.position.x, -7.5, 7.5);
        playerMesh.position.z = BABYLON.Scalar.Clamp(playerMesh.position.z, -11.5, -0.5);

        // --- Approach speed (for hit quality) ---
        const frameDelta = playerMesh.position.subtract(lastPos);
        approachSpeed = frameDelta.length() / dt;
        lastPos.copyFrom(playerMesh.position);

        // --- Jump ---
        if (onGround && input.jump && game.state === "rally") {
            velocityY = jumpForce;
            onGround = false;
        }

        velocityY += gravity * dt;
        playerMesh.position.y += velocityY * dt;

        if (playerMesh.position.y <= 1) {
            playerMesh.position.y = 1;
            velocityY = 0;
            onGround = true;
        }

        // --- Hit buffer ---
        const anyHitKey =
            input.hitSpike ||
            input.hitTip ||
            input.hitRoll ||
            input.hitBump ||
            input.hitSet;

        if (anyHitKey) {
            hitBuffer = 0.12;
        } else {
            hitBuffer = Math.max(0, hitBuffer - dt);
        }

        // --- Hit attempt (sync with advanced ball.js) ---
        if (hitBuffer > 0 && game.ball && (game.state === "rally" || game.ball.isServe)) {
            let type = "spike";
            if (input.hitTip) type = "tip";
            else if (input.hitRoll) type = "roll";
            else if (input.hitBump) type = "bump";
            else if (input.hitSet) type = "set";

            const jumpApexTime = (2 * jumpForce) / -gravity;
            const currentJumpHeight = playerMesh.position.y - 1;
            const maxJumpHeight = (jumpForce * jumpForce) / (-2 * gravity);
            const jumpPhase = BABYLON.Scalar.Clamp(
                maxJumpHeight > 0 ? currentJumpHeight / maxJumpHeight : 0,
                0,
                1
            );

            const context = {
                type,
                approachSpeed,
                jumpPhase,
                overcharge: game.playerOvercharge
            };

            const success = game.ball.tryPlayerHit(context);
            if (success) {
                hitBuffer = 0;

                // Overcharge gain logic (ported + expanded)
                const timingCenter = 0.6;
                const timingError = Math.abs(jumpPhase - timingCenter);
                const timingScore = BABYLON.Scalar.Clamp(1 - timingError / 0.4, 0, 1);

                let baseGain = 0.1;
                if (type === "spike") baseGain = 0.15;
                else if (type === "roll") baseGain = 0.12;
                else if (type === "tip") baseGain = 0.08;
                else if (type === "set") baseGain = 0.06;
                else if (type === "bump") baseGain = 0.05;

                const timingBonus = timingScore * 0.25;
                game.playerOvercharge = Math.min(1, game.playerOvercharge + baseGain + timingBonus);
            }
        }
    }

    return { update };
}
