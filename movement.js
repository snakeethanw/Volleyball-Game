// ======================================================
//   PLAYER MOVEMENT + INPUT + ACTIONS
// ======================================================
//
// Handles:
// - WASD / Arrow movement
// - Stat-based speed
// - Jumping
// - Spike input
// - Block input
// - Smooth acceleration
// - Animation hooks
//
// ======================================================

export function createMovementController(scene, player, ball) {
  const input = {
    left: false,
    right: false,
    forward: false,
    back: false,
    jump: false,
    spike: false,
    block: false
  };

  const velocity = new BABYLON.Vector3(0, 0, 0);

  const moveSpeed = 4 * player.stats.speed;
  const jumpStrength = 6 * player.stats.jump;
  const spikePower = 1.2 * (player.stats.power.base || player.stats.power);
  const blockBoost = 1.0 + player.stats.block * 0.2;

  let isGrounded = true;
  let jumpCooldown = 0;

  // ======================================================
  //   INPUT HANDLING
  // ======================================================
  window.addEventListener("keydown", e => {
    switch (e.key) {
      case "a":
      case "ArrowLeft": input.left = true; break;
      case "d":
      case "ArrowRight": input.right = true; break;
      case "w":
      case "ArrowUp": input.forward = true; break;
      case "s":
      case "ArrowDown": input.back = true; break;
      case " ": input.jump = true; break;
      case "j": input.spike = true; break;
      case "k": input.block = true; break;
    }
  });

  window.addEventListener("keyup", e => {
    switch (e.key) {
      case "a":
      case "ArrowLeft": input.left = false; break;
      case "d":
      case "ArrowRight": input.right = false; break;
      case "w":
      case "ArrowUp": input.forward = false; break;
      case "s":
      case "ArrowDown": input.back = false; break;
      case " ": input.jump = false; break;
      case "j": input.spike = false; break;
      case "k": input.block = false; break;
    }
  });

  // ======================================================
  //   UPDATE LOOP
  // ======================================================
  scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime() / 1000;

    // ------------------------------------------
    // Horizontal movement
    // ------------------------------------------
    let moveX = 0;
    let moveZ = 0;

    if (input.left) moveX -= 1;
    if (input.right) moveX += 1;
    if (input.forward) moveZ += 1;
    if (input.back) moveZ -= 1;

    const moveVec = new BABYLON.Vector3(moveX, 0, moveZ);
    if (moveVec.length() > 0) moveVec.normalize().scaleInPlace(moveSpeed);

    velocity.x = BABYLON.Scalar.Lerp(velocity.x, moveVec.x, 0.15);
    velocity.z = BABYLON.Scalar.Lerp(velocity.z, moveVec.z, 0.15);

    // ------------------------------------------
    // Jumping
    // ------------------------------------------
    if (jumpCooldown > 0) jumpCooldown -= dt;

    if (input.jump && isGrounded && jumpCooldown <= 0) {
      velocity.y = jumpStrength;
      isGrounded = false;
      jumpCooldown = 0.25;

      if (player.onJump) player.onJump();
    }

    velocity.y -= 18 * dt;

    // ------------------------------------------
    // Apply movement
    // ------------------------------------------
    player.mesh.position.addInPlace(velocity.scale(dt));

    // ------------------------------------------
    // Ground collision
    // ------------------------------------------
    if (player.mesh.position.y <= 1) {
      player.mesh.position.y = 1;
      velocity.y = 0;
      isGrounded = true;
    }

    // ------------------------------------------
    // Spike
    // ------------------------------------------
    if (input.spike && player.mesh.position.y > 1.5) {
      if (player.onSpike) player.onSpike(spikePower, ball);
    }

    // ------------------------------------------
    // Block
    // ------------------------------------------
    if (input.block) {
      if (player.onBlock) player.onBlock(blockBoost);
    }
  });

  return { input, velocity };
}
