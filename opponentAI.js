// opponentAI.js
// Human-like AI with personality, learning, sleepy mode, tilt, and Champion nerf.

import { getProfile, CharacterRoster } from "./charactersAndProgression.js";

export function createOpponentAI(scene, opponent, ball) {
  const profile = getProfile();
  const playerLevel = profile?.level || 1;

  const difficulty = Math.min(1, playerLevel / 50);

  const charData = CharacterRoster.find(c => c.id === opponent.charId) || { id: "recruit" };

  // Learning style
  const learningStyles = ["learner", "semi", "none", "anti"];
  const learningStyle = learningStyles[Math.floor(Math.random() * learningStyles.length)];

  let learningRate = 0.0;
  let patternMemory = 0.0;

  switch (learningStyle) {
    case "learner": learningRate = 0.25 + difficulty * 0.4; break;
    case "semi": learningRate = 0.15 + difficulty * 0.2; break;
    case "none": learningRate = 0.0; break;
    case "anti": learningRate = -0.15; break;
  }

  // Personality
  const personalities = ["chill", "focused", "annoying", "chaotic", "lazy", "sweaty"];
  const personality = personalities[Math.floor(Math.random() * personalities.length)];

  let reactionDelay = 0.6 - difficulty * 0.4;
  let mistakeChance = 0.35 - difficulty * 0.25;
  let annoyingChance = 0.05 + difficulty * 0.07;

  switch (personality) {
    case "chill": reactionDelay += 0.2; mistakeChance += 0.15; break;
    case "focused": reactionDelay -= 0.1; mistakeChance -= 0.1; break;
    case "annoying": annoyingChance += 0.15; break;
    case "chaotic": mistakeChance += 0.1; annoyingChance += 0.05; break;
    case "lazy": reactionDelay += 0.25; mistakeChance += 0.2; break;
    case "sweaty": reactionDelay -= 0.15; annoyingChance += 0.1; break;
  }

  // Sleepy mode (time-based)
  const hour = new Date().getHours();
  const sleepyHours = (hour >= 5 && hour <= 7) || (hour >= 14 && hour <= 15) || (hour >= 23);
  const sleepy = sleepyHours && Math.random() < 0.1;

  if (sleepy) {
    reactionDelay += 0.25;
    mistakeChance += 0.15;
  }

  // Character-based tweaks
  if (charData.id === "captain") reactionDelay -= 0.1;
  if (charData.id === "sergeant") opponent.stats.jump *= 1.15;
  if (charData.id === "commander") mistakeChance -= 0.1;
  if (charData.id === "lieutenant") annoyingChance += 0.05;
  if (charData.id === "champion") annoyingChance += 0.1;

  // Champion nerf (AI only)
  if (charData.id === "champion") {
    opponent.stats.speed *= 0.9;
    opponent.stats.jump *= 0.92;
    opponent.stats.block *= 0.85;
    learningRate *= 0.5;
  }

  // Tilt system
  let tilt = 0; // 0 calm, 1 tilted
  opponent.addTilt = amount => { tilt = Math.min(1, tilt + amount); };
  opponent.reduceTilt = amount => { tilt = Math.max(0, tilt - amount); };

  const baseSpeed = 2.2 + difficulty * 2.0;
  const moveSpeed = baseSpeed * opponent.stats.speed;
  const jumpStrength = 5.0 + opponent.stats.jump * 1.5;

  let reactionTimer = 0;
  let velocityY = 0;
  let grounded = true;

  // Serve mistakes
  opponent.missServeChance = 0.1 - difficulty * 0.07; // 10% -> 3%
  opponent.shouldMissServe = () => Math.random() < opponent.missServeChance;

  scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime() / 1000;

    reactionTimer -= dt;
    if (reactionTimer > 0) return;
    reactionTimer = reactionDelay;

    const makeMistake = Math.random() < mistakeChance;
    const beAnnoying = Math.random() < annoyingChance;

    // Learn player patterns (X position of last hit)
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

    const effectiveMoveSpeed =
      moveSpeed *
      (sleepy ? 0.8 : 1) *
      (tilt > 0.7 ? 1.2 : 1);

    const dx = targetX - opponent.mesh.position.x;
    const dz = targetZ - opponent.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.1) {
      opponent.mesh.position.x += (dx / dist) * effectiveMoveSpeed * dt;
      opponent.mesh.position.z += (dz / dist) * effectiveMoveSpeed * dt;
    }

    const jumpThreshold = 2.0 - difficulty * 1.2;
    const shouldJump =
      ball.mesh.position.y > jumpThreshold &&
      ball.mesh.position.z < 1 &&
      !makeMistake;

    if (shouldJump && grounded) {
      velocityY = jumpStrength * (sleepy ? 0.85 : 1);
      grounded = false;
    }

    velocityY -= 18 * dt;
    opponent.mesh.position.y += velocityY * dt;

    if (opponent.mesh.position.y <= 1) {
      opponent.mesh.position.y = 1;
      velocityY = 0;
      grounded = true;
    }
  });
}
