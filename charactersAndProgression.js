// ======================================================
//   CHARACTERS + PROGRESSION + CHARACTER SELECT UI
// ======================================================

function W() {
  return canvas.width;
}
function H() {
  return canvas.height;
}

import { supabase } from "./supabaseClient.js";
import { getUser } from "./auth.js";

// ======================================================
//   PLAYER PROFILE (LOADED FROM SUPABASE)
// ======================================================
export let PlayerProfile = null;

// ======================================================
//   CHARACTER ROSTER
// ======================================================
export const CharacterRoster = [
  {
    id: "recruit",
    name: "Recruit",
    unlockedAtLevel: 0,
    stats: { speed: 0.65, jump: 0.70, power: 0.70, block: 0.70 },
    description: "Basic soldier with limited mobility and power."
  },
  {
    id: "cadet",
    name: "Cadet",
    unlockedAtLevel: 3,
    stats: { speed: 0.75, jump: 0.75, power: 0.75, block: 0.85 },
    description: "Slightly improved fundamentals, still developing."
  },
  {
    id: "corporal",
    name: "Corporal",
    unlockedAtLevel: 7,
    stats: { speed: 0.90, jump: 1.00, power: 1.00, block: 1.00 },
    description: "Balanced attacker with modest spike strength."
  },
  {
    id: "sergeant",
    name: "Sergeant",
    unlockedAtLevel: 12,
    stats: { speed: 1.00, jump: 1.20, power: 0.95, block: 1.05 },
    description: "High jumper with good aerial control."
  },
  {
    id: "lieutenant",
    name: "Lieutenant",
    unlockedAtLevel: 18,
    stats: { speed: 0.45, jump: 1.00, power: 1.00, block: 1.25 },
    description: "Strong blocker with heavy spike power."
  },
  {
    id: "captain",
    name: "Captain",
    unlockedAtLevel: 25,
    stats: { speed: 1.20, jump: 1.10, power: 0.95, block: 0.80 },
    description: "Fast tactical leader with quick reactions."
  },
  {
    id: "major",
    name: "Major",
    unlockedAtLevel: 32,
    stats: { speed: 1.10, jump: 1.15, power: 1.10, block: 0.95 },
    description: "Well-rounded officer with strong fundamentals."
  },
  {
    id: "commander",
    name: "Commander",
    unlockedAtLevel: 40,
    stats: { speed: 0.85, jump: 1.00, power: 1.50, block: 1.15 },
    description: "Slow but devastating powerhouse."
  },
  {
    id: "champion",
    name: "Champion",
    unlockedAtLevel: 50,
    stats: {
      speed: 1.20,
      jump: 1.30,
      power: {
        base: 0.90,
        max: 1.30,
        charge: true
      },
      block: 1.40
    },
    description: "Elite specialist with float serve, overcharge spike, and unmatched blocking."
  }
];

// ======================================================
//   SUPABASE PROFILE LOADING
// ======================================================
export async function loadProfile() {
  const user = await getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error && error.code === "PGRST116") {
    return await createNewProfile(user.id);
  }

  PlayerProfile = data;
  checkUnlocks();
  return PlayerProfile;
}

async function createNewProfile(userId) {
  const defaultProfile = {
    user_id: userId,
    level: 1,
    xp: 0,
    unlocked: ["recruit"],
    selected_character: "recruit"
  };

  const { data } = await supabase
    .from("players")
    .insert(defaultProfile)
    .select()
    .single();

  PlayerProfile = data;
  return PlayerProfile;
}

export async function saveProfile() {
  const user = await getUser();
  if (!user || !PlayerProfile) return;

  await supabase
    .from("players")
    .update({
      level: PlayerProfile.level,
      xp: PlayerProfile.xp,
      unlocked: PlayerProfile.unlocked,
      selected_character: PlayerProfile.selected_character
    })
    .eq("user_id", user.id);
}

// ======================================================
//   XP + LEVELING
// ======================================================
function xpNeededForLevel(level) {
  return level * 100;
}

export async function addXP(amount) {
  if (!PlayerProfile) return;

  PlayerProfile.xp += amount;

  while (PlayerProfile.xp >= xpNeededForLevel(PlayerProfile.level)) {
    PlayerProfile.xp -= xpNeededForLevel(PlayerProfile.level);
    PlayerProfile.level++;
    checkUnlocks();
  }

  await saveProfile();
}

export async function awardMatchXP(win) {
  const base = 50;
  const bonus = win ? 30 : 0;
  await addXP(base + bonus);
}

// ======================================================
//   CHARACTER UNLOCKING
// ======================================================
function checkUnlocks() {
  if (!PlayerProfile) return;

  CharacterRoster.forEach(char => {
    if (
      PlayerProfile.level >= char.unlockedAtLevel &&
      !PlayerProfile.unlocked.includes(char.id)
    ) {
      PlayerProfile.unlocked.push(char.id);
    }
  });
}

export function isUnlocked(id) {
  return PlayerProfile?.unlocked?.includes(id);
}

export async function selectCharacter(id) {
  if (!isUnlocked(id)) return false;

  PlayerProfile.selected_character = id;
  await saveProfile();
  return true;
}

// ======================================================
//   CHARACTER SELECT UI
// ======================================================
let statPulseTimer = 0;
let selectedIndex = 0;
let hoverIndex = -1;

const CHAR_BOX_W = 190;
const CHAR_BOX_H = 230;
const CHAR_BOX_MARGIN = 30;

function getAnimatedStatValue(stat) {
  if (typeof stat === "number") return stat;

  if (stat.charge) {
    const t = (Math.sin(statPulseTimer) + 1) / 2;
    return stat.base + (stat.max - stat.base) * t;
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

function drawCharacterBox(ctx, charData, x, y, isHovered, isSelected, isLocked) {
  ctx.save();
  ctx.translate(x, y);

  const baseColor = isSelected ? "#4ae86b" :
                    isHovered ? "#333a4a" :
                    "#1b1f2a";

  const gradient = ctx.createLinearGradient(0, 0, CHAR_BOX_W, CHAR_BOX_H);
  gradient.addColorStop(0, baseColor);
  gradient.addColorStop(1, "#11141c");

  ctx.fillStyle = gradient;
  ctx.strokeStyle = isSelected ? "#ffffff" : "rgba(255,255,255,0.25)";
  ctx.lineWidth = isSelected ? 3 : 1.5;
  ctx.beginPath();
  ctx.roundRect(0, 0, CHAR_BOX_W, CHAR_BOX_H, 14);
  ctx.fill();
  ctx.stroke();

  if (isLocked) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(0, 0, CHAR_BOX_W, CHAR_BOX_H, 14);
    ctx.fill();

    ctx.fillStyle = "#ff5555";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("LOCKED", CHAR_BOX_W / 2, CHAR_BOX_H / 2 - 4);
    ctx.fillText("Lvl " + charData.unlockedAtLevel, CHAR_BOX_W / 2, CHAR_BOX_H / 2 + 18);
    ctx.restore();
    return;
  }

  ctx.fillStyle = "#fff";
  ctx.font = "18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(charData.name, CHAR_BOX_W / 2, 28);

  const stats = charData.stats;
  const entries = ["speed", "jump", "power", "block"];
  let offsetY = 64;

  entries.forEach(statName => {
    const stat = stats[statName];
    const value = getAnimatedStatValue(stat);

    ctx.fillStyle = "rgba(220,220,230,0.9)";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(statName.toUpperCase(), 14, offsetY);

    ctx.fillStyle = "rgba(40,40,60,0.9)";
    ctx.roundRect(90, offsetY - 10, 86, 9, 4);
    ctx.fill();

    const pct = Math.min(value / 2.0, 1);
    ctx.fillStyle = getStatColor(statName, stat);
    ctx.roundRect(90, offsetY - 10, 86 * pct, 9, 4);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.textAlign = "right";
    ctx.fillText(value.toFixed(2), CHAR_BOX_W - 12, offsetY);

    offsetY += 36;
  });

  ctx.restore();
}

export function drawCharacterSelect(drawCtx, dt) {
  statPulseTimer += dt * 2;

  const bgGrad = drawCtx.createLinearGradient(0, 0, 0, H());
  bgGrad.addColorStop(0, "#050814");
  bgGrad.addColorStop(0.5, "#10182a");
  bgGrad.addColorStop(1, "#050814");
  drawCtx.fillStyle = bgGrad;
  drawCtx.fillRect(0, 0, W(), H());

  drawCtx.fillStyle = "#ffffff";
  drawCtx.font = "30px sans-serif";
  drawCtx.textAlign = "center";
  drawCtx.fillText("Select Your Character", W() / 2, 60);

  if (PlayerProfile) {
    drawCtx.font = "18px sans-serif";
    drawCtx.fillStyle = "#a8ffb8";
    drawCtx.fillText(
      `Level ${PlayerProfile.level}  •  XP ${PlayerProfile.xp}`,
      W() / 2,
      90
    );
  }

  let x = 80;
  let y = 120;

  CharacterRoster.forEach((char, i) => {
    const unlocked = isUnlocked(char.id);
    const hovered = (i === hoverIndex);
    const selected = (i === selectedIndex);

    drawCharacterBox(drawCtx, char, x, y, hovered, selected, !unlocked);

    x += CHAR_BOX_W + CHAR_BOX_MARGIN;
    if (x + CHAR_BOX_W > W()) {
      x = 80;
      y += CHAR_BOX_H + CHAR_BOX_MARGIN;
    }
  });
}

// Mouse hover
canvas.addEventListener("mousemove", e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  hoverIndex = -1;

  let x = 80;
  let y = 120;

  CharacterRoster.forEach((char, i) => {
    if (
      mx >= x && mx <= x + CHAR_BOX_W &&
      my >= y && my <= y + CHAR_BOX_H
    ) {
      hoverIndex = i;
    }

    x += CHAR_BOX_W + CHAR_BOX_MARGIN;
    if (x + CHAR_BOX_W > W()) {
      x = 80;
      y += CHAR_BOX_H + CHAR_BOX_MARGIN;
    }
  });
});

// Click to select
canvas.addEventListener("mousedown", async () => {
  if (hoverIndex === -1) return;

  const char = CharacterRoster[hoverIndex];
  if (!isUnlocked(char.id)) return;

  selectedIndex = hoverIndex;
  await selectCharacter(char.id);
});

export function getProfile() {
  return PlayerProfile;
}

