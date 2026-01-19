// movement.js
// Player movement, jump, approach speed, and hit timing hooks

export function initMovement(game) {
    const scene = game.scene;
    const player = game.player;

    const input = {
        forward: false,
        back: false,
        left: false,
        right: false,
        jump: false,
        hit: false,
        tip: false,
        roll: false
    };

    const speed = 7.5;
    const jumpForce = 9.5;
    const gravity = -24;

    let velocityY = 0;
    let onGround = true;
    let lastPos = player.position.clone();
    let approachSpeed = 0;
    let jumpStartTime = 0;
    let hitBuffer = 0;

    window.addEventListener("keydown", (e) => {
        if (e.code === "KeyW" || e.code === "ArrowUp") input.forward = true;
        if (e.code === "KeyS" || e.code === "ArrowDown") input.back = true;
        if (e.code === "KeyA" || e.code === "ArrowLeft") input.left = true;
        if (e.code === "KeyD" || e.code === "ArrowRight") input.right = true;
        if (e.code === "Space") input.jump = true;
        if (e.code === "KeyJ") input.hit = true;   // spike
        if (e.code === "KeyK") input.tip = true;   // soft tip
        if (e.code === "KeyL") input.roll = true;  // roll shot
    });

    window.addEventListener("keyup", (e) => {
        if (e.code === "KeyW" || e.code === "ArrowUp") input.forward = false;
        if (e.code === "KeyS" || e.code === "ArrowDown") input.back = false;
        if (e.code === "KeyA" || e.code === "ArrowLeft") input.left = false;
        if (e.code === "KeyD" || e.code === "ArrowRight") input.right = false;
        if (e.code === "Space") input.jump = false;
        if (e.code === "KeyJ") input.hit = false;
        if (e.code === "KeyK") input.tip = false;
        if (e.code === "KeyL") input.roll = false;
    });

    function update(dt) {
        if (!player || game.state === "point" || game.state === "replay") return;

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

        player.position.x += moveX * speed * dt;
        player.position.z += moveZ * speed * dt;

        player.position.x = BABYLON.Scalar.Clamp(player.position.x, -7.5, 7.5);
        player.position.z = BABYLON.Scalar.Clamp(player.position.z, -11.5, -0.5);

        const frameDelta = player.position.subtract(lastPos);
        approachSpeed = frameDelta.length() / dt;
        lastPos.copyFrom(player.position);

        if (onGround && input.jump && game.state === "rally") {
            velocityY = jumpForce;
            onGround = false;
            jumpStartTime = scene.getEngine().getDeltaTime();
        }

        velocityY += gravity * dt;
        player.position.y += velocityY * dt;

        if (player.position.y <= 1) {
            player.position.y = 1;
            velocityY = 0;
            onGround = true;
        }

        if (input.hit || input.tip || input.roll) {
            hitBuffer = 0.12;
        } else {
            hitBuffer = Math.max(0, hitBuffer - dt);
        }

        if (hitBuffer > 0 && game.ball && game.state === "rally") {
            const type = input.hit ? "spike" : input.tip ? "tip" : input.roll ? "roll" : "spike";

            const jumpPhase = BABYLON.Scalar.Clamp(
                (player.position.y - 1) / (jumpForce * jumpForce / (-2 * gravity) || 1),
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
                const timingBonus = Math.abs(jumpPhase - 0.6) < 0.15 ? 0.2 : 0;
                game.playerOvercharge = Math.min(1, game.playerOvercharge + 0.12 + timingBonus);
            }
        }
    }

    return { update };
}
