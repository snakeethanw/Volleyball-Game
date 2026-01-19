// ======================================================
//   SIMPLE OPPONENT AI
// ======================================================
//
// Behavior:
// - Moves toward ball
// - Predicts landing
// - Blocks near net
// - Spikes when ball is high
//
// ======================================================

export function createOpponentAI(scene, opponent, ball) {
  const moveSpeed = 3.2 * opponent.stats.speed;
  const jumpStrength = 5.5 * opponent.stats.jump;

  let velocityY = 0;
  let grounded = true;

  scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime() / 1000;

    // Predict ball landing
    const targetX = ball.mesh.position.x;
    const targetZ = Math.min(ball.mesh.position.z, 0); // stays on right side

    // Move horizontally
    const dx = targetX - opponent.mesh.position.x;
    const dz = targetZ - opponent.mesh.position.z;

    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 0.1) {
      opponent.mesh.position.x += (dx / dist) * moveSpeed * dt;
      opponent.mesh.position.z += (dz / dist) * moveSpeed * dt;
    }

    // Jump to block
    if (ball.mesh.position.y > 2.5 && grounded) {
      velocityY = jumpStrength;
      grounded = false;
    }

    // Gravity
    velocityY -= 18 * dt;
    opponent.mesh.position.y += velocityY * dt;

    if (opponent.mesh.position.y <= 1) {
      opponent.mesh.position.y = 1;
      velocityY = 0;
      grounded = true;
    }
  });
}
