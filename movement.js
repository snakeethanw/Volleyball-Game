// ======================================================
//   PLAYER MOVEMENT + INPUT SYSTEM
// ======================================================
//
// This module handles:
// - WASD / Arrow key movement
// - Stat-based speed
// - Jumping
// - Spike input
// - Block input
// - Smooth acceleration
//
// It does NOT create meshes or handle physics directly.
// It only updates the player object passed into it.
//
// ======================================================

export function createMovementController(scene, player) {
  const input = {
    left: false,
    right: false,
    forward: false,
    back: false,
    jump: false,
    spike: false,
    block: false
  };

  // Movement state
  const velocity = new BABYLON.Vector3(0, 0, 0);
  const moveSpeed = 4 * player.stats.speed;      // stat-based
  const jumpStrength = 6 * player.stats.jump;    // stat-based
  const spikePower = 1.2 * (player.stats.power.base || player.stats.power); // stat-based
  const blockBoost = 1.0 + player.stats.block * 0.2;

  let isGrounded = true;
  let jumpCooldown = 0;

  // ======================================================
  //   INPUT HANDLING
  // ======================================================
  window.addEventListener("keydown", e => {
    switch (e.key) {
      case "a":
      case "ArrowLeft":
        input.left = true;
        break;
      case "d":
      case "ArrowRight":
        input.right = true;
        break;
      case "w":
      case "ArrowUp":
        input.forward = true;
        break;
      case "s":
      case "ArrowDown":
        input.back = true;
        break;
      case " ":
        input.jump = true;
        break;
      case "j":
        input.spike = true;
        break;
      case "k":
        input.block = true;
        break;
    }
  });

  window.addEventListener("keyup", e => {
    switch (e.key) {
      case "a":
      case "ArrowLeft":
        input.left = false;
        break;
      case "d":
      case "ArrowRight":
        input.right = false;
        break;
      case "w":
      case "ArrowUp":
        input.forward = false;
        break;
      case "s":
      case "ArrowDown":
        input.back = false;
        break;
      case " ":
        input.jump = false;
        break;
      case "j":
        input.spike = false;
        break;
      case "k":
        input.block = false;
        break;
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
    if (moveVec.length() > 0) {
      moveVec.normalize().scaleInPlace(moveSpeed);
    }

    // Smooth acceleration
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
    }

    // Gravity
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
    // Spike input (placeholder hook)
    // ------------------------------------------
    if (input.spike) {
      // You can trigger spike animations or effects here
      // console.log("Spike pressed! Power:", spikePower);
    }

    // ------------------------------------------
    // Block input (placeholder hook)
    // ------------------------------------------
    if (input.block) {
      // console.log("Blocking! Boost:", blockBoost);
    }
  });

  return {
    input,
    velocity
  };
}
