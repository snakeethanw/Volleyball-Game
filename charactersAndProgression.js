// ======================================================
//   CHARACTERS + PROGRESSION (NO 2D UI)
// ======================================================

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
//   PROFILE ACCESSOR
// ======================================================
export function getProfile() {
  return PlayerProfile;
}
