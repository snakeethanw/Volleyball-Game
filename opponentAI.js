import { getProfile, CharacterRoster } from "./charactersAndProgression.js";

export function createOpponentAI(scene, opponent, ball) {
  const profile = getProfile();
  const playerLevel = profile?.level || 1;

  // Difficulty scaling
  const difficulty = Math.min(1, playerLevel / 50);

  // Opponent character data
  const charData = CharacterRoster.find(c => c.id === opponent.charId);

  // ======================================================
  //   PERSONALITY + LEARNING STYLE
  // ======================================================
  const learningStyles = ["learner", "semi", "none", "anti"];
  const learningStyle = learningStyles[Math.floor(Math.random() * learningStyles.length)];

  let learningRate = 0.0;
  let patternMemory = 0.0;

  switch (learningStyle) {
    case "learner":
      learningRate = 0.25 + difficulty * 0.4;
      break;
    case "semi":
      learningRate = 0.15 + difficulty * 0.2;
      break;
    case "none":
      learningRate = 0.0;
      break;
    case "anti":
      learningRate = -0.15; // learns the wrong thing
      break;
  }

  // ======================================================
  //   SLEEPY MODE (5–10% chance based on time)
  // ======================================================
  const hour = new Date().getHours();
  const sleepyHours = (hour >= 5 && hour <= 7) || (hour >= 14 && hour <= 15) || (hour >= 23);

  const sleepy = sleepyHours && Math.random() < 0.10;

  // ======================================================
  //   TILT SYSTEM
  // ======================================================
  let tilt = 0; // 0 = calm, 1 = tilted

  opponent.addTilt = amount => {
    tilt = Math.min(1, tilt + amount);
  };

  opponent.reduceTilt = amount => {
    tilt = Math.max(0, tilt - amount);
  };

  // ======================================================
  //   CHAMPION NERF (AI ONLY)
  // ======================================================
  if (charData.id === "champion") {
    opponent.stats.speed *= 0.90;
    opponent.stats.jump *= 0.92;
    opponent.stats.block *= 0.85;
    learningRate *= 0.5;
  }

  // ======================================================
  //   BASE MOVEMENT + JUMP
  // ======================================================
  const moveSpeed =
    (2.2 + difficulty * 2.0) *
    opponent.stats.speed *
    (sleepy ? 0.8 : 1) *
    (tilt > 0.7 ? 1.2 : 1);

  const jumpStrength =
    (5.0 + opponent.stats.jump * 1.5) *
    (sleepy ? 0.85 : 1);

  let reactionDelay = 0.6 - difficulty * 0.4 + (sleepy ? 0.25 : 0);
  let mistakeChance = 0.35 - difficulty * 0.25 + (sleepy ? 0.15 : 0);
  let annoyingChance = 0.05 + difficulty * 0.07 + (tilt > 0.5 ? 0.1 : 0);

  let reactionTimer = 0;
  let velocityY = 0;
  let grounded = true;

  // ======================================================
  //   MAIN AI LOOP
  // ======================================================
  scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime() / 1000;

    reactionTimer -= dt;
    if (reactionTimer > 0) return;
    reactionTimer = reactionDelay;

    const makeMistake = Math.random() < mistakeChance;
    const beAnnoying = Math.random() < annoyingChance;

    // Track player patterns
    const playerX = ball.lastPlayerHitX || 0;
    patternMemory += (playerX - patternMemory) * learningRate * dt;

    // Predict landing
    let targetX = ball.mesh.position.x - patternMemory;
    let targetZ = Math.min(ball.mesh.position.z, 0);

    if (makeMistake) {
      targetX += (Math.random() - 0.5) * 2.0;
      targetZ += (Math.random() - 0.5) * 1.5;
    }

    if (beAnnoying) {
      targetX = ball.mesh.position.x;
      targetZ = ball.mesh.position.z * 0.5;
    }

    // Move horizontally
    const dx = targetX - opponent.mesh.position.x;
    const dz = targetZ - opponent.mesh.position.z;

    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 0.1) {
      opponent.mesh.position.x += (dx / dist) * moveSpeed * dt;
      opponent.mesh.position.z += (dz / dist) * moveSpeed * dt;
    }

    // Jump logic
    const jumpThreshold = 2.0 - difficulty * 1.2;

    const shouldJump =
      ball.mesh.position.y > jumpThreshold &&
      ball.mesh.position.z < 1 &&
      !makeMistake;

    if (shouldJump && grounded) {
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
