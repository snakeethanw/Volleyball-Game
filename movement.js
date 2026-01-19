// movement.js
// Handles player movement, jump, input, and tilt (keys + slight movement influence).

export function createMovementController(scene, player) {
  const input = {
    left: false,
    right: false,
    forward: false,
    back: false,
    jump: false
  };

  const action = {
    spike: false,
    block: false
  };

  const velocity = new BABYLON.Vector3(0, 0, 0);

  const tilt = {
    side: 0,    // -1 (left) to 1 (right)
    forward: 0, // 0..1
    back: 0     // 0..1
  };

  const tiltTarget = { side: 0, forward: 0, back: 0 };

  const moveSpeed = 4 * player.stats.speed;
  const jumpStrength = 6 * player.stats.jump;

  let isGrounded = true;
  let jumpCooldown = 0;

  // INPUT
  window.addEventListener("keydown", e => {
    switch (e.key) {
      case "a":
      case "ArrowLeft": input.left = true; tiltTarget.side = -1; break;
      case "d":
      case "ArrowRight": input.right = true; tiltTarget.side = 1; break;
      case "w":
      case "ArrowUp": input.forward = true; tiltTarget.forward = 1; tiltTarget.back = 0; break;
      case "s":
      case "ArrowDown": input.back = true; tiltTarget.back = 1; tiltTarget.forward = 0; break;
      case " ": input.jump = true; break;
      case "j": action.spike = true; break;
      case "k": action.block = true; break;
    }
  });

  window.addEventListener("keyup", e => {
    switch (e.key) {
      case "a":
      case "ArrowLeft": input.left = false; if (!input.right) tiltTarget.side = 0; break;
      case "d":
      case "ArrowRight": input.right = false; if (!input.left) tiltTarget.side = 0; break;
      case "w":
      case "ArrowUp": input.forward = false; if (!input.back) tiltTarget.forward = 0; break;
      case "s":
      case "ArrowDown": input.back = false; if (!input.forward) tiltTarget.back = 0; break;
      case " ": input.jump = false; break;
      case "j": action.spike = false; break;
      case "k": action.block = false; break;
    }
  });

  scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime() / 1000;

    // Movement vector
    let moveX = 0;
    let moveZ = 0;

    if (input.left) moveX -= 1;
    if (input.right) moveX += 1;
    if (input.forward) moveZ += 1;
    if (input.back) moveZ -= 1;

    const moveVec = new BABYLON.Vector3(moveX, 0, moveZ);
    if (moveVec.length() > 0) moveVec.normalize().scaleInPlace(moveSpeed);

    // Smooth acceleration
    velocity.x = BABYLON.Scalar.Lerp(velocity.x, moveVec.x, 0.15);
    velocity.z = BABYLON.Scalar.Lerp(velocity.z, moveVec.z, 0.15);

    // Jump
    if (jumpCooldown > 0) jumpCooldown -= dt;

    if (input.jump && isGrounded && jumpCooldown <= 0) {
      velocity.y = jumpStrength;
      isGrounded = false;
      jumpCooldown = 0.25;
      if (player.onJump) player.onJump();
    }

    velocity.y -= 18 * dt;

    // Apply movement
    player.mesh.position.addInPlace(velocity.scale(dt));

    // Ground
    if (player.mesh.position.y <= 1) {
      player.mesh.position.y = 1;
      velocity.y = 0;
      isGrounded = true;
    }

    // Tilt: keys + slight movement influence
    const moveInfluenceSide = BABYLON.Scalar.Clamp(moveX * 0.25, -0.25, 0.25);
    const moveInfluenceForward = moveZ > 0 ? 0.2 : 0;
    const moveInfluenceBack = moveZ < 0 ? 0.2 : 0;

    const targetSide = tiltTarget.side + moveInfluenceSide;
    const targetForward = Math.min(1, tiltTarget.forward + moveInfluenceForward);
    const targetBack = Math.min(1, tiltTarget.back + moveInfluenceBack);

    tilt.side = BABYLON.Scalar.Lerp(tilt.side, targetSide, 0.2);
    tilt.forward = BABYLON.Scalar.Lerp(tilt.forward, targetForward, 0.2);
    tilt.back = BABYLON.Scalar.Lerp(tilt.back, targetBack, 0.2);
  });

  return { input, action, velocity, tilt };
}
