import { CharacterRoster, isUnlocked, selectCharacter, getProfile } from "./charactersAndProgression.js";

export function createCharacterCards(scene, uiLayer) {
  const cards = [];
  const radius = 8;
  const center = new BABYLON.Vector3(0, 4, 10);

  CharacterRoster.forEach((char, index) => {
    const angle = (index / CharacterRoster.length) * Math.PI * 1.4 - Math.PI * 0.7;

    // Card mesh
    const card = BABYLON.MeshBuilder.CreatePlane(`card_${char.id}`, {
      width: 3,
      height: 4
    }, scene);

    card.position = new BABYLON.Vector3(
      center.x + Math.cos(angle) * radius,
      center.y,
      center.z + Math.sin(angle) * radius
    );
    card.lookAt(new BABYLON.Vector3(center.x, center.y, center.z - 5));

    // Slight tilt
    card.rotation.x += 0.1;

    // Glow silhouette figure (simple quad)
    const figure = BABYLON.MeshBuilder.CreatePlane(`figure_${char.id}`, {
      width: 1.4,
      height: 2.4
    }, scene);
    figure.parent = card;
    figure.position = new BABYLON.Vector3(0, 0.2, -0.02);

    const figMat = new BABYLON.StandardMaterial(`figMat_${char.id}`, scene);
    figMat.emissiveColor = getCharacterColor(char.id);
    figMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    figMat.alpha = 0.9;
    figure.material = figMat;

    // Simple silhouette texture: use a gradient-like color
    figMat.disableLighting = true;
    figure.renderOutline = true;
    figure.outlineWidth = 0.03;
    figure.outlineColor = getCharacterColor(char.id);

    // Particles
    const particleSystem = new BABYLON.ParticleSystem(`particles_${char.id}`, 400, scene);
    particleSystem.particleTexture = new BABYLON.Texture("https://playground.babylonjs.com/textures/flare.png", scene);
    particleSystem.emitter = figure;
    particleSystem.minEmitBox = new BABYLON.Vector3(-0.3, -0.1, 0);
    particleSystem.maxEmitBox = new BABYLON.Vector3(0.3, 0.4, 0);
    particleSystem.color1 = getCharacterColor(char.id);
    particleSystem.color2 = getCharacterColor(char.id).scale(0.4);
    particleSystem.minSize = 0.05;
    particleSystem.maxSize = 0.15;
    particleSystem.minLifeTime = 0.4;
    particleSystem.maxLifeTime = 1.0;
    particleSystem.emitRate = isUnlocked(char.id) ? 120 : 20;
    particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    particleSystem.direction1 = new BABYLON.Vector3(0, 0.6, 0);
    particleSystem.direction2 = new BABYLON.Vector3(0, 1.0, 0);
    particleSystem.minAngularSpeed = -1;
    particleSystem.maxAngularSpeed = 1;
    particleSystem.minEmitPower = 0.2;
    particleSystem.maxEmitPower = 0.6;
    particleSystem.updateSpeed = 0.01;
    particleSystem.start();

    // GUI for card
    const tex = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(card, 512, 512, false);
    const root = new BABYLON.GUI.Rectangle();
    root.thickness = 0;
    root.background = "#101320";
    tex.addControl(root);

    // Border
    const border = new BABYLON.GUI.Rectangle();
    border.thickness = 3;
    border.color = isUnlocked(char.id) ? "#ffffff" : "#555555";
    border.cornerRadius = 18;
    border.width = 0.96;
    border.height = 0.96;
    root.addControl(border);

    // Name
    const nameText = new BABYLON.GUI.TextBlock();
    nameText.text = char.name;
    nameText.color = "#ffffff";
    nameText.fontSize = 40;
    nameText.top = "-40%";
    nameText.height = "80px";
    nameText.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    border.addControl(nameText);

    // Stats
    const statsPanel = new BABYLON.GUI.StackPanel();
    statsPanel.width = "80%";
    statsPanel.height = "40%";
    statsPanel.top = "10%";
    statsPanel.isVertical = true;
    border.addControl(statsPanel);

    ["speed", "jump", "power", "block"].forEach(statName => {
      const row = createStatRow(char, statName);
      statsPanel.addControl(row);
    });

    // Locked overlay
    if (!isUnlocked(char.id)) {
      const lockRect = new BABYLON.GUI.Rectangle();
      lockRect.background = "rgba(0,0,0,0.7)";
      lockRect.thickness = 0;
      border.addControl(lockRect);

      const lockText = new BABYLON.GUI.TextBlock();
      lockText.text = `LOCKED\nLvl ${char.unlockedAtLevel}`;
      lockText.color = "#ff6666";
      lockText.fontSize = 36;
      lockText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
      lockText.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
      lockRect.addControl(lockText);

      particleSystem.emitRate = 10;
      figMat.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.1);
      figure.outlineColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    }

    // Hover + click
    card.actionManager = new BABYLON.ActionManager(scene);

    card.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, () => {
        scene.getEngine().getRenderingCanvas().style.cursor = "pointer";
        animateCardHover(card, true);
      })
    );

    card.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, () => {
        scene.getEngine().getRenderingCanvas().style.cursor = "default";
        animateCardHover(card, false);
      })
    );

    card.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, async () => {
        if (!isUnlocked(char.id)) return;
        await selectCharacter(char.id);
        highlightSelectedCard(cards, card);
      })
    );

    cards.push({ card, figure, particleSystem, char });
  });

  // Highlight currently selected
  const profile = getProfile();
  if (profile) {
    const selected = cards.find(c => c.char.id === profile.selected_character);
    if (selected) highlightSelectedCard(cards, selected.card);
  }

  return cards;
}

function getCharacterColor(id) {
  switch (id) {
    case "recruit":    return new BABYLON.Color3(0.6, 0.6, 0.9);
    case "cadet":      return new BABYLON.Color3(0.4, 0.7, 1.0);
    case "corporal":   return new BABYLON.Color3(0.8, 0.8, 1.0);
    case "sergeant":   return new BABYLON.Color3(1.0, 0.9, 0.4);
    case "lieutenant": return new BABYLON.Color3(1.0, 0.6, 0.4);
    case "captain":    return new BABYLON.Color3(0.4, 1.0, 0.8);
    case "major":      return new BABYLON.Color3(0.7, 1.0, 0.7);
    case "commander":  return new BABYLON.Color3(1.0, 0.3, 0.3);
    case "champion":   return new BABYLON.Color3(1.0, 0.6, 0.2);
    default:           return new BABYLON.Color3(0.7, 0.7, 0.9);
  }
}

function createStatRow(char, statName) {
  const stats = char.stats;
  const stat = stats[statName];

  const row = new BABYLON.GUI.StackPanel();
  row.isVertical = false;
  row.height = "22%";
  row.spacing = 6;

  const label = new BABYLON.GUI.TextBlock();
  label.text = statName.toUpperCase();
  label.color = "#ccccdd";
  label.fontSize = 26;
  label.width = "40%";
  label.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  row.addControl(label);

  const barBack = new BABYLON.GUI.Rectangle();
  barBack.height = "40%";
  barBack.width = "60%";
  barBack.cornerRadius = 8;
  barBack.thickness = 0;
  barBack.background = "#1a1d2a";
  row.addControl(barBack);

  const barFill = new BABYLON.GUI.Rectangle();
  barFill.height = 1;
  barFill.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  barFill.thickness = 0;
  barFill.background = getStatColor(statName, stat);
  barFill.width = "0%";
  barBack.addControl(barFill);

  // Animate fill
  const value = getStatValue(stat);
  const pct = Math.min(value / 2.0, 1);
  barFill.width = `${pct * 100}%`;

  return row;
}

function getStatValue(stat) {
  if (typeof stat === "number") return stat;
  if (stat.charge) {
    // For now, show average between base and max
    return (stat.base + stat.max) / 2;
  }
  return stat.base;
}

function getStatColor(statName, stat) {
  if (typeof stat === "object" && stat.charge) return "#ff8844";

  switch (statName) {
    case "speed": return "#4aa3ff";
    case "jump":  return "#ffe850";
    case "power": return "#ff6b6b";
    case "block": return "#8affc1";
    default:      return "#4ae86b";
  }
}

function animateCardHover(card, hover) {
  const targetScale = hover ? 1.08 : 1.0;
  const anim = new BABYLON.Animation(
    `cardHover_${card.name}`,
    "scaling",
    60,
    BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
    BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
  );

  const keys = [];
  keys.push({ frame: 0, value: card.scaling.clone() });
  keys.push({ frame: 10, value: new BABYLON.Vector3(targetScale, targetScale, targetScale) });
  anim.setKeys(keys);

  card.animations = [];
  card.animations.push(anim);
  card.getScene().beginAnimation(card, 0, 10, false);
}

function highlightSelectedCard(cards, selectedCard) {
  cards.forEach(({ card }) => {
    card.renderOutline = false;
  });
  selectedCard.renderOutline = true;
  selectedCard.outlineWidth = 0.06;
  selectedCard.outlineColor = new BABYLON.Color3(1, 1, 1);
}
