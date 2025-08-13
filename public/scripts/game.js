// --- Firebase Setup ---
const firebaseConfig = {
  apiKey: "AIzaSyDeT07nCmdlKXLg7aHTMPSpPHcFwBDpHdY",
  authDomain: "snail-arena-f02a4.firebaseapp.com",
  databaseURL: "https://snail-arena-f02a4-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "snail-arena-f02a4",
  storageBucket: "snail-arena-f02a4.firebasestorage.app",
  messagingSenderId: "837937294285",
  appId: "1:837937294285:web:55408717aaf2b2d2e97284"
};
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// --- Game State ---
let snail = {
    distance: 0,
    slimePoints: 0,
    speed: 1,
    slimeEfficiency: 1,
    trailBoosters: 1,
    isMoving: true,
    turboActive: false,
    turboTimer: 0,
    checkpoint: 0,
    prestige: 0,
    mutations: [],
    skin: 0,
    level: 1,
    unlockedMutations: [], // stores mutation ids that are unlocked
    dailyChallenges: [], // array of 5 daily challenges
    dailyProgress: [0,0,0,0,0],
    dailyComplete: [false,false,false,false,false],
    weeklyChallenges: [], // array of 10 weekly challenges
    weeklyProgress: Array(10).fill(0),
    weeklyComplete: Array(10).fill(false),
    dailyReset: 0,
    weeklyReset: 0,
    pet: null, // current pet id
    petLevel: 1,
    unlockedPets: [], // array of pet ids
    dailyResetCount: 0, // add daily reset counter
    weeklyResetCount: 0 // add weekly reset counter
};
// --- Challenge Definitions ---
const challengeDefs = [
    // Daily (simple cumulative)
    { id: 'collectSlimeDaily', type: 'daily', desc: 'Collect 20,000 slime', goal: 20000 },
    { id: 'reachDistanceDaily', type: 'daily', desc: 'Reach 5,000m', goal: 5000 },
    { id: 'useTurboDaily', type: 'daily', desc: 'Use turbo 10 times', goal: 10 },
    { id: 'prestigeDaily', type: 'daily', desc: 'Prestige once', goal: 1 },
    { id: 'unlockMutationDaily', type: 'daily', desc: 'Unlock 1 mutation', goal: 1 },
    // Weekly (simple cumulative)
    { id: 'collectSlimeWeekly', type: 'weekly', desc: 'Collect 100,000 slime', goal: 100000 },
    { id: 'reachDistanceWeekly', type: 'weekly', desc: 'Reach 20,000m', goal: 20000 },
    { id: 'useTurboWeekly', type: 'weekly', desc: 'Use turbo 50 times', goal: 50 },
    { id: 'prestigeWeekly', type: 'weekly', desc: 'Prestige 3 times', goal: 3 },
    { id: 'unlockMutationWeekly', type: 'weekly', desc: 'Unlock 3 mutations', goal: 3 }
];

function pickChallenges(type, count) {
    // Always pick the first N for simplicity and consistency
    return challengeDefs.filter(c => c.type === type).slice(0, count);
}

function resetDailyChallenges() {
    snail.dailyChallenges = pickChallenges('daily', 3);
    snail.dailyProgress = [0,0,0];
    snail.dailyComplete = [false,false,false];
    snail.dailyReset = getNextDailyReset();
    snail.dailyResetCount = (snail.dailyResetCount || 0) + 1; // increment counter
}
function resetWeeklyChallenges() {
    snail.weeklyChallenges = pickChallenges('weekly', 5);
    snail.weeklyProgress = Array(5).fill(0);
    snail.weeklyComplete = Array(5).fill(false);
    snail.weeklyReset = getNextWeeklyReset();
    snail.weeklyResetCount = (snail.weeklyResetCount || 0) + 1; // increment counter
}

function getNextDailyReset() {
    // EST midnight (Central European Time = UTC+2, EST = UTC-5)
    // So, reset at 6am CET (midnight EST)
    const now = new Date();
    const cetOffset = 2; // Central European Summer Time
    const estOffset = -5;
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    // Next EST midnight in UTC
    const estNow = new Date(utc + estOffset * 3600000);
    estNow.setHours(0,0,0,0);
    estNow.setDate(estNow.getDate() + 1);
    return estNow.getTime();
}
function getNextWeeklyReset() {
    // Next Monday 00:00:00am EST (add 1 second to Sunday 11:59:59pm)
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const estOffset = -5;
    const estNow = new Date(utc + estOffset * 3600000);
    estNow.setHours(23,59,59,0);
    // Find next Sunday
    const day = estNow.getDay();
    const daysToSunday = (7 - day) % 7;
    estNow.setDate(estNow.getDate() + daysToSunday);
    return estNow.getTime() + 1000;
}
let username = '';

// --- Hazards ---
// --- Mutations ---
const mutationDefs = [
    { id: 'radioactiveShell', name: 'Radioactive Shell', desc: 'Every 90s, gain a shield for 10s that blocks all hazards. (Shield animation above snail)' },
    { id: 'regenerativeSlime', name: 'Regenerative Slime', desc: 'Gain 2500 slime every time you hit a hazard.' },
    { id: 'magnetAntennae', name: 'Magnet Antennae', desc: 'Every 60s, attract 1000-3000 slime. (Magnet animation around snail)' },
    { id: 'camouflageSkin', name: 'Camouflage Skin', desc: '30% chance to avoid hazard effects.' },
    { id: 'turboGlands', name: 'Turbo Glands', desc: 'Turbo lasts 20% longer.' },
    { id: 'spikedShell', name: 'Spiked Shell', desc: 'Hazards are destroyed on contact (immune), but speed is reduced by 10% for 30s. (Spikes animation)' },
    { id: 'doubleEyes', name: 'Double Eyes', desc: 'Warns you 5s before a hazard spawns. (Eyes animation)' },
    { id: 'stickyFoot', name: 'Sticky Foot', desc: 'Immune to Puddle and Gum hazards.' },
    { id: 'miniWings', name: 'Mini Wings', desc: 'Every 60s, skip a hazard spawn. (Alert shown)' },
    { id: 'quantumTrail', name: 'Quantum Trail', desc: 'Every 90s, teleport forward 300m. (Trail animation)' },
    { id: 'crystalShell', name: 'Crystal Shell', desc: '+2000 slime at each checkpoint (scenery change). (Crystal animation)' },
    { id: 'fireSlime', name: 'Fire Slime', desc: 'Gum hazard is destroyed on contact. (Flame animation)' },
    { id: 'frostAntennae', name: 'Frost Antennae', desc: 'Every 60s, freeze a hazard for 10s. (Frost animation)' },
    { id: 'electricPulse', name: 'Electric Pulse', desc: 'Every 60s, stun all hazards for 5s. (Electric animation)' },
    { id: 'luckyCharm', name: 'Lucky Charm', desc: '20% chance to stop rare hazard spawn, double slime from rare hazards. (Sparkle animation)' },
    { id: 'ironShell', name: 'Iron Shell', desc: 'Hazard effects reduced by 30%.' },
    { id: 'slimeMagnet', name: 'Slime Magnet', desc: 'Double slime gain for 10s after every hazard. (Glow animation)' },
    { id: 'shadowCloak', name: 'Shadow Cloak', desc: 'Immune to hazards for 5s after turbo is activated. (Shadow animation)' },
    { id: 'bouncyFoot', name: 'Bouncy Foot', desc: 'Every second hazard bounces off (immune), but speed -15% for 30s when this happens. (Bounce animation)' },
    { id: 'timeDilation', name: 'Time Dilation', desc: 'Hazards last 20% longer every two minutes. (Bad mutation)' }
];

// Mutation Book logic (same as Hazard Book)
window.showMutationBook = function() {
    const mutationBookMenu = document.getElementById('mutation-book-menu');
    const mutationBookList = document.getElementById('mutation-book-list');
    mutationBookMenu.style.display = 'block';
    mutationBookList.innerHTML = '';
    const colors = [
        '#ffb300', '#00bcd4', '#8bc34a', '#e91e63', '#9c27b0', '#ff5722', '#03a9f4', '#cddc39', '#f44336', '#009688',
        '#ffc107', '#673ab7', '#4caf50', '#ff9800', '#2196f3', '#607d8b', '#795548', '#00e676', '#e040fb', '#d50000'
    ];
    mutationDefs.forEach((mut, i) => {
        const div = document.createElement('div');
        const unlocked = snail.unlockedMutations && snail.unlockedMutations.includes(mut.id);
        div.className = unlocked ? 'mutation-unlocked' : 'mutation-locked';
        div.style = 'margin-bottom:0;padding:8px 8px;border-radius:8px;min-width:0;word-break:break-word;font-size:13px;cursor:pointer;';
        const color = colors[i % colors.length];
        div.title = mut.desc;
        div.innerHTML = `<b style='color:${color};'>${mut.name}</b><br><span style='font-size:12px;color:#ccc;'>${mut.desc}</span><br><span style='font-size:11px;color:${unlocked ? "#00e676" : "#ff4444"};'>${unlocked ? "Unlocked" : "Locked"}</span>`;
        div.onmouseenter = function() { div.style.background = "rgba(255,255,255,0.08)"; };
        div.onmouseleave = function() { div.style.background = ""; };
        div.onclick = function() { showAlert(div.title, 'info'); };
        mutationBookList.appendChild(div);
    });
};
let hazards = [];
const hazardTypes = [
    { type: 'salt', name: 'Salt Patch', color: '#fff', effect: 'slow' },
    { type: 'bird', name: 'Bird Attack', color: '#222', effect: 'stop' },
    { type: 'puddle', name: 'Puddle', color: '#4fc3f7', effect: 'slide' },
    { type: 'pebble', name: 'Falling Pebble', color: '#888', effect: 'block' },
    { type: 'ants', name: 'Ant Swarm', color: '#6d4c41', effect: 'slow' },
    { type: 'gum', name: 'Sticky Gum', color: '#ff69b4', effect: 'stuck' },
    { type: 'shadow', name: 'Shadow Hand', color: '#333', effect: 'slow' },
    { type: 'wind', name: 'Wind Gust', color: '#b2ebf2', effect: 'push' },
    { type: 'oil', name: 'Oil Spill', color: '#212121', effect: 'swerve' },
    { type: 'laser', name: 'Laser Fence', color: '#e74c3c', effect: 'timed' }
];
// --- Boss Hazards ---
const bossHazardTypes = [
    {
        type: 'giantFoot',
        name: 'Giant Foot',
        color: '#ff1744',
        effect: 'crush',
        desc: 'Crushes everything in its path, snail speed massively reduced for 20s.'
    },
    {
        type: 'acidRain',
        name: 'Acid Rain',
        color: '#00e676',
        effect: 'corrode',
        desc: 'Hazard immunity disabled, snail loses slime every second for 18s.'
    },
    {
        type: 'shadowBeast',
        name: 'Shadow Beast',
        color: '#6a1b9a',
        effect: 'fear',
        desc: 'Snail cannot move for 10s, then moves at half speed for 10s.'
    }
];

let hazardCount = 0; // Track total hazards spawned
let bossHazardActive = false;
let currentBossHazard = null;

// --- Hazard Timer ---
let hazardTimer = 60;
let hazardInterval = 60; // seconds
let currentHazard = null; // Track the currently active hazard for timer display

function getRandomHazardInterval() {
    const choices = [15, 30, 45, 60];
    return choices[Math.floor(Math.random() * choices.length)];
}

// --- Scenery ---
const scenery = [
    { name: "Garden", color: "#4e8c36" },
    { name: "Sidewalk", color: "#8a989e" },
    { name: "Desert", color: "#bfa01c" },
    { name: "Neon City", color: "#2c1e5a" },
    { name: "Outer Space", color: "#0a0820" },
    { name: "Snowfield", color: "#b0c0d8" },
    { name: "Volcano", color: "#b23c1a" },
    { name: "Swamp", color: "#145c3c" },
    { name: "Crystal Cave", color: "#6a8ca1" },
    { name: "Haunted Woods", color: "#2a2530" },
    { name: "Candy Land", color: "#b77a7c" },
    { name: "Moon", color: "#b7b1a3" },
    { name: "Underwater", color: "#1c5a7d" },
    { name: "Ruins", color: "#6c665c" },
    { name: "Sky Islands", color: "#7ac7c7" },
    { name: "Factory", color: "#353b3c" },
    { name: "Jungle", color: "#176a36" },
    { name: "Canyon", color: "#a1502c" },
    { name: "Metro", color: "#181a1b" },
    { name: "Dreamscape", color: "#a04c6a" },
    { name: "Mushroom Forest", color: "#7d5fff" },
    { name: "Coral Reef", color: "#ff7675" },
    { name: "Frost Peaks", color: "#74b9ff" },
    { name: "Molten Core", color: "#fd5c63" },
    { name: "Clockwork City", color: "#d35400" }
];
const checkpointDistance = 5000; // meters per scenery change

// --- Canvas Setup ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- Username Prompt ---
function promptUsername() {
    const container = document.getElementById('username-container');
    container.style.display = 'block';
    document.getElementById('username-confirm').onclick = () => {
        const input = document.getElementById('username-input').value.trim();
        if (input) {
            username = input;
            container.style.display = 'none';
            loadGame();
            // Ensure challenges are present after login
            setTimeout(() => {
                if (!snail.dailyChallenges.length) resetDailyChallenges();
                if (!snail.weeklyChallenges.length) resetWeeklyChallenges();
                updateUI();
            }, 300);
        } else {
            showAlert('Please enter a username!', 'error');
        }
    };
}

// --- Sprite Loading ---
const snailSprites = {
    walk: new Image(),
    walk2: new Image(),
    walk3: new Image(),
    walk4: new Image(),
    walk5: new Image(),
    walk6: new Image()
};
snailSprites.walk.src = 'assets/snail_walk.png';
snailSprites.walk2.src = 'assets/snail_walk_2.png';
snailSprites.walk3.src = 'assets/snail_walk_3.png';
snailSprites.walk4.src = 'assets/snail_walk_4.png';
snailSprites.walk5.src = 'assets/snail_walk_5.png';
snailSprites.walk6.src = 'assets/snail_walk_6.png';

let frame = 0;
let frameTimer = 0;
let frameInterval = 200; // ms per frame
let lastTime = performance.now();

// --- Upgrade Buttons ---
const upgradeDefs = [
    { id: 'speedShell', name: "Speed Shell", baseCost: 50, cost: 50, purchased: 0, desc: "Increases snail speed by 0.5.", action: () => { snail.speed += 0.5; } },
    { id: 'slimeBooster', name: "Slime Booster", baseCost: 40, cost: 40, purchased: 0, desc: "Increases slime efficiency by 0.5.", action: () => { snail.slimeEfficiency += 0.5; } },
    { id: 'turboSlime', name: "Turbo Slime", baseCost: 5000, cost: 5000, purchased: 0, desc: "Doubles speed for 60 seconds. Stackable.", action: () => {
        if (!snail.turboActive) {
            snail.turboActive = true;
            snail.turboTimer = 60000;
        } else {
            snail.turboTimer += 60000;
        }
        // Count turbo uses for challenges
        let changed = false;
        snail.dailyChallenges.forEach((ch, i) => {
            if (ch.id === 'useTurboDaily' && !snail.dailyComplete[i]) {
                snail.dailyProgress[i] = Math.min(snail.dailyProgress[i] + 1, ch.goal);
                if (snail.dailyProgress[i] >= ch.goal) snail.dailyComplete[i] = true;
                changed = true;
            }
        });
        snail.weeklyChallenges.forEach((ch, i) => {
            if (ch.id === 'useTurboWeekly' && !snail.weeklyComplete[i]) {
                snail.weeklyProgress[i] = Math.min(snail.weeklyProgress[i] + 1, ch.goal);
                if (snail.weeklyProgress[i] >= ch.goal) snail.weeklyComplete[i] = true;
                changed = true;
            }
        });
        if (changed) saveGame();
    } },
];

// --- Input Handling ---
canvas.addEventListener('click', handleInput);
canvas.addEventListener('touchstart', function(e) {
    const touch = e.touches[0];
    handleInput({ clientX: touch.clientX, clientY: touch.clientY });
});
function handleInput(e) {
    const mx = e.clientX;
    const my = e.clientY;
    // Remove upgrades canvas click logic
    // Only handle prestige button (bottom left)
    if (mx > 20 && mx < 200 && my > canvas.height - 60 && my < canvas.height - 20) {
        prestige();
        return;
    }
    // Pet sprite click detection (right of snail)
    // Move pet area slightly lower (e.g. +18px)
    const petYOffset = 18;
    const petAreaX1 = canvas.width/2 + 50;
    const petAreaX2 = canvas.width/2 + 82;
    const petAreaY1 = canvas.height/2 - 16 + petYOffset;
    const petAreaY2 = canvas.height/2 + 16 + petYOffset;
    const hasAnyPet = snail.unlockedPets && snail.unlockedPets.length > 0;
    if (
        hasAnyPet &&
        mx > petAreaX1 && mx < petAreaX2 &&
        my > petAreaY1 && my < petAreaY2
    ) {
        if (window.showPetSwitchMenu) window.showPetSwitchMenu();
        return;
    }
}

// --- Global State Fixes ---
let activeHazardEffect = null; // Track current hazard effect

// --- Pet Effect Variables ---
snail.slimeGainMultiplier = 1;
snail.speedMultiplier = 1;
snail.turboDurationMultiplier = 1;
snail.hazardImmunityDuration = 0;
snail.hazardReduction = 0;

// --- Hazard Spawning ---
function spawnHazard() {
    const type = hazardTypes[Math.floor(Math.random()*hazardTypes.length)];
    const duration = 12000 + Math.random()*6000; // 12-18 seconds
    const hazardObj = {
        type: type.type,
        name: type.name,
        color: type.color,
        effect: type.effect,
        x: snail.distance + 300 + Math.random()*200,
        active: true,
        created: performance.now(),
        duration: duration
    };
    hazards.push(hazardObj);
    showAlert(`${type.name} spawned!`, 'info');
}

function spawnBossHazard() {
    const bossType = bossHazardTypes[Math.floor(Math.random() * bossHazardTypes.length)];
    let duration = 20000; // default 20s
    if (bossType.type === 'acidRain') duration = 18000;
    currentBossHazard = {
        type: bossType.type,
        name: bossType.name,
        color: bossType.color,
        effect: bossType.effect,
        desc: bossType.desc,
        created: performance.now(),
        duration: duration,
        endTime: performance.now() + duration
    };
    bossHazardActive = true;
    showAlert(`BOSS HAZARD: ${bossType.name}!\n${bossType.desc}`, 'error');
    // Add to activeHazardEffects for counter display
    activeHazardEffects.push({
        type: bossType.type,
        name: bossType.name,
        effect: bossType.effect,
        endTime: currentBossHazard.endTime
    });
}

// --- Hazard Effect State ---
let activeHazardEffects = []; // Array of {type, name, effect, endTime, ...}

function applyHazardEffect(hazard) {
    // --- Mutation Checks ---
    // radioactiveShell: immune if shield active
    if (snail.unlockedMutations.includes('radioactiveShell') && snail.radioactiveShieldActive) {
        showAlert('Radioactive Shell: Hazard blocked by shield!', 'success');
        return;
    }
    // camouflageSkin: 30% chance to avoid hazard
    if (snail.unlockedMutations.includes('camouflageSkin')) {
        if (Math.random() < 0.3) {
            showAlert('Camouflage Skin: Hazard avoided!', 'success');
            return;
        }
    }
    // stickyFoot: immune to puddle/gum
    if (snail.unlockedMutations.includes('stickyFoot') && (hazard.type === 'puddle' || hazard.type === 'gum')) {
        showAlert('Sticky Foot: Puddle/Gum hazard ignored!', 'success');
        return;
    }
    // spikedShell: destroy hazard, immune, but slow for 30s
    if (snail.unlockedMutations.includes('spikedShell')) {
        showAlert('Spiked Shell: Hazard destroyed! Speed -10% for 30s.', 'info');
        snail.spikedShellSlowTimer = 30000;
        return;
    }

    // Duration spec for each hazard
    let duration = 0;
    switch(hazard.type) {
        case 'salt': duration = 30000; break;
        case 'bird': duration = 10000; break;
        case 'pebble': duration = 8000; break;
        case 'ants': duration = 60000; break;
        case 'gum': duration = 20000; break;
        case 'shadow': duration = 40000; break;
        case 'laser': duration = 15000; break;
        default: duration = hazard.duration || 12000;
    }
    // Stackable effect: if same type, extend timer
    let existing = activeHazardEffects.find(e => e.type === hazard.type);
    if (existing) {
        existing.endTime += duration;
        showAlert(`${hazard.name} stacked! +${Math.floor(duration/1000)}s`, 'error');
    } else {
        let effectObj = {
            type: hazard.type,
            name: hazard.name,
            effect: hazard.effect,
            endTime: performance.now() + duration
        };
        activeHazardEffects.push(effectObj);
        showAlert(`${hazard.name} applied!`, 'error');
    }
    // Apply stat changes (stacking logic)
    switch(hazard.type) {
        case 'salt':
            snail.speed *= 0.5;
            snail.speedShellDisabledUntil = Math.max(snail.speedShellDisabledUntil || 0, performance.now() + duration);
            break;
        case 'bird':
            snail.isMoving = false;
            snail.slimePoints = Math.floor(snail.slimePoints * 0.9);
            snail.movementDisabledUntil = Math.max(snail.movementDisabledUntil || 0, performance.now() + duration);
            break;
        case 'puddle':
            snail.distance += 120;
            showAlert('Puddle! Slid forward 120m!', 'info');
            break;
        case 'pebble':
            snail.isMoving = false;
            snail.movementDisabledUntil = Math.max(snail.movementDisabledUntil || 0, performance.now() + duration);
            break;
        case 'ants':
            snail.slimeEfficiency *= 0.5;
            snail.efficiencyRestoreAt = Math.max(snail.efficiencyRestoreAt || 0, performance.now() + duration);
            break;
        case 'gum':
            snail.upgradesDisabledUntil = Math.max(snail.upgradesDisabledUntil || 0, performance.now() + duration);
            break;
        case 'shadow':
            snail.speed *= 0.5;
            snail.shadowSlowRestoreAt = Math.max(snail.shadowSlowRestoreAt || 0, performance.now() + duration);
            break;
        case 'wind':
            snail.distance = Math.max(0, snail.distance - 200);
            showAlert('Wind Gust! Pushed back 200m!', 'error');
            break;
        case 'oil':
            const move = Math.random() > 0.5 ? 100 : -100;
            snail.distance = Math.max(0, snail.distance + move);
            showAlert(`Oil Spill! Swerved ${move > 0 ? '+' : ''}${move}m!`, 'info');
            break;
        case 'laser':
            snail.turboDisabledUntil = Math.max(snail.turboDisabledUntil || 0, performance.now() + duration);
            break;
    }
    // --- Mutation Effects ---
    // regenerativeSlime: +2500 slime every hazard
    if (snail.unlockedMutations.includes('regenerativeSlime')) {
        snail.slimePoints += 2500;
        showAlert('Regenerative Slime: +2500 slime restored!', 'success');
    }
}

function clearExpiredHazardEffects() {
    const now = performance.now();
    // Remove expired effects and restore stats
    activeHazardEffects = activeHazardEffects.filter(effect => {
        if (now > effect.endTime) {
            switch(effect.type) {
                case 'salt':
                    snail.speed = 1 + snail.prestige * 0.2; // restore base speed
                    snail.speedShellDisabledUntil = 0;
                    break;
                case 'bird':
                case 'pebble':
                    snail.isMoving = true;
                    snail.movementDisabledUntil = 0;
                    break;
                case 'ants':
                    snail.slimeEfficiency = 1 + snail.prestige * 0.1; // restore base efficiency
                    snail.efficiencyRestoreAt = 0;
                    break;
                case 'gum':
                    snail.upgradesDisabledUntil = 0;
                    break;
                case 'shadow':
                    snail.speed = 1 + snail.prestige * 0.2;
                    snail.shadowSlowRestoreAt = 0;
                    break;
                case 'laser':
                    snail.turboDisabledUntil = 0;
                    break;
            }
            return false; // remove
        }
        return true; // keep
    });
}

// --- Game Loop ---
function updateUI() {
    // Defensive: only update elements that exist
    const slimePointsDiv = document.getElementById('slimePoints');
    if (slimePointsDiv) slimePointsDiv.innerText = `Slime: ${Math.floor(snail.slimePoints)}`;
    const distanceDiv = document.getElementById('distance');
    if (distanceDiv) distanceDiv.innerText = `Distance: ${snail.distance.toFixed(2)} m`;
    const speedDiv = document.getElementById('speed');
    if (speedDiv) speedDiv.innerText = `Speed: ${snail.speed.toFixed(1)}`;
    const efficiencyDiv = document.getElementById('efficiency');
    if (efficiencyDiv) efficiencyDiv.innerText = `Slime Efficiency: ${snail.slimeEfficiency.toFixed(1)}`;
    const trailBoostersDiv = document.getElementById('trail-boosters');
    if (trailBoostersDiv) trailBoostersDiv.innerText = `Trail Boosters: ${snail.trailBoosters}`;
    const prestigeDiv = document.getElementById('prestige');
    if (prestigeDiv) prestigeDiv.innerText = `Prestige: ${toRoman(snail.prestige)}`;
    const mutationCountDiv = document.getElementById('mutation-count');
    if (mutationCountDiv) mutationCountDiv.innerText = `Mutations Unlocked: ${snail.unlockedMutations.length}`;
    const dailyResetDiv = document.getElementById('daily-reset-time');
    if (dailyResetDiv) dailyResetDiv.innerText = `Daily Reset: ${new Date(snail.dailyReset).toLocaleTimeString()}`;
    const weeklyResetDiv = document.getElementById('weekly-reset-time');
    if (weeklyResetDiv) weeklyResetDiv.innerText = `Weekly Reset: ${new Date(snail.weeklyReset).toLocaleTimeString()}`;
    // Add reset counters to UI if elements exist
    const dailyResetCountDiv = document.getElementById('daily-reset-count');
    if (dailyResetCountDiv) dailyResetCountDiv.innerText = `Daily Resets: ${snail.dailyResetCount || 0}`;
    const weeklyResetCountDiv = document.getElementById('weekly-reset-count');
    if (weeklyResetCountDiv) weeklyResetCountDiv.innerText = `Weekly Resets: ${snail.weeklyResetCount || 0}`;
    // Update challenge progress bars
    updateChallengeUI('daily', snail.dailyChallenges, snail.dailyProgress, snail.dailyComplete);
    updateChallengeUI('weekly', snail.weeklyChallenges, snail.weeklyProgress, snail.weeklyComplete);
    // Update hazard timer in score panel
    const hazardTimerDiv = document.getElementById('hazard-timer');
    if (hazardTimerDiv) {
        hazardTimerDiv.innerHTML = `Next Hazard: <span style='color:#ffd700;'>${Math.ceil(hazardTimer)}s</span>`;
    }
    // Update upgrade button cost display
    upgradeDefs.forEach(upg => {
        const btn = document.getElementById(upg.id);
        if (btn) {
            const costSpan = btn.querySelector('.upgrade-cost');
            if (costSpan) {
                costSpan.innerText = ` (${upg.cost} Slime)`;
            }
            const nameSpan = btn.querySelector('.upgrade-name');
            if (nameSpan) {
                nameSpan.innerText = upg.name;
            }
        }
    });
    // Prestige requirements and cost
    const prestigeBtn = document.getElementById('prestigeBtn');
    const prestigeCostSpan = prestigeBtn ? prestigeBtn.querySelector('.prestige-cost') : null;
    const prestigeLevelSpan = prestigeBtn ? prestigeBtn.querySelector('.prestige-level') : null;
    if (prestigeBtn) {
        // Set button label to next prestige number in roman
        const nextPrestigeRoman = toRoman(snail.prestige + 1);
        const prestigeNameSpan = prestigeBtn.querySelector('.prestige-name');
        if (prestigeNameSpan) {
            prestigeNameSpan.innerText = `Prestige: ${nextPrestigeRoman}`;
        }
    }
    if (prestigeCostSpan) {
        prestigeCostSpan.innerHTML =
            `<span style="font-size:13px;color:#ffd700;">Requires: ${getPrestigeCost()} Slime</span><br>` +
            `<span style="font-size:11px;color:#ccc;">Requires Lv120+</span>`;
    }
    if (prestigeLevelSpan) {
        prestigeLevelSpan.innerText = '';
    }
}

function getCETTimeLeft(targetTimestamp) {
    // CET = UTC+1 or UTC+2 (summer), but for simplicity, use UTC+2 as in original code
    const now = new Date();
    const utcNow = now.getTime() + (now.getTimezoneOffset() * 60000);
    const cetOffset = 2;
    const cetNow = utcNow + cetOffset * 3600000;
    const msLeft = targetTimestamp - (utcNow + cetOffset * 3600000);
    if (msLeft <= 0) return "00:00:00";
    const totalSeconds = Math.floor(msLeft / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (days > 0) {
        return `${days}d ${hours.toString().padStart(2,"0")}:${minutes.toString().padStart(2,"0")}:${seconds.toString().padStart(2,"0")}`;
    } else {
        return `${hours.toString().padStart(2,"0")}:${minutes.toString().padStart(2,"0")}:${seconds.toString().padStart(2,"0")}`;
    }
}

// --- Challenge UI Update ---
function updateChallengeUI(type, challenges, progress, complete) {
    // type: 'daily' or 'weekly'
    let containerId = type === 'daily' ? 'dailyChallenge' : 'weeklyChallenge';
    let container = document.getElementById(containerId);
    if (!container) return;
    if (!challenges || !challenges.length) {
        container.innerHTML = `<span style="color:#aaa;">No ${type} challenges.</span>`;
        return;
    }
    let html = '';
    // Show cooldown timer above challenge count, gray, no label
    let timer = '';
    if (type === 'daily') {
        timer = getCETTimeLeft(snail.dailyReset);
        html += `<div style="font-size:13px;color:#888;margin-bottom:2px;">${timer}</div>`;
        html += `<div style="font-size:12px;color:#ffd700;margin-bottom:4px;">${challenges.length} Daily Challenges</div>`;
    } else {
        timer = getCETTimeLeft(snail.weeklyReset);
        html += `<div style="font-size:13px;color:#888;margin-bottom:2px;">${timer}</div>`;
        html += `<div style="font-size:12px;color:#ffd700;margin-bottom:4px;">${challenges.length} Weekly Challenges</div>`;
    }
    challenges.forEach((ch, i) => {
        let prog = Math.min(progress[i] || 0, ch.goal);
        // Limit decimals for slime/distance
        if (ch.id.includes('Slime')) prog = Number(prog).toFixed(2);
        if (ch.id.includes('Distance')) prog = Number(prog).toFixed(2);
        let pct = Math.floor((prog / ch.goal) * 100);
        let done = complete[i];
        html += `
            <div style="margin-bottom:8px;">
                <span style="color:${done ? '#00e676' : '#ffd700'};font-weight:bold;">${ch.desc}</span><br>
                <span style="font-size:12px;color:#ccc;">${prog} / ${ch.goal}</span>
                <div style="height:8px;width:100%;background:#222;border-radius:4px;overflow:hidden;margin-top:2px;">
                    <div style="height:8px;width:${pct}%;background:${done ? '#00e676' : '#ffd700'};transition:width 0.2s;"></div>
                </div>
                ${done ? '<span style="font-size:11px;color:#00e676;">Complete!</span>' : ''}
            </div>
        `;
    });
    container.innerHTML = html;
}

// --- Hazard Timer Logic ---
function updateHazardTimer() {
    if (!window.lastHazardTime) window.lastHazardTime = performance.now();
    let elapsed = (performance.now() - window.lastHazardTime) / 1000;
    hazardTimer = Math.max(0, hazardInterval - elapsed);

    // Always spawn hazard when timer reaches zero
    if (hazardTimer <= 0 && !bossHazardActive) {
        hazardCount++;
        if (hazardCount % 5 === 0) {
            spawnBossHazard();
        } else {
            spawnHazard();
        }
        window.lastHazardTime = performance.now();
        hazardInterval = getRandomHazardInterval();
        hazardTimer = hazardInterval;
    }

    // Boss hazard effect timer
    if (bossHazardActive && currentBossHazard) {
        if (!currentBossHazard.endTime) {
            currentBossHazard.endTime = performance.now() + currentBossHazard.duration;
        }
        if (performance.now() > currentBossHazard.endTime) {
            bossHazardActive = false;
            currentBossHazard = null;
        }
    }
}

// --- Game Loop ---
function gameLoop(now) {
    let dt = now - lastTime;
    lastTime = now;
    frameTimer += dt;
    let turbo = snail.turboActive;
    let turboSpeed = turbo ? 80 : 200;
    if (frameTimer > turboSpeed) {
        frame = (frame + 1) % 3;
        frameTimer = 0;
    }
    updateSnail(dt);
    updateUI();
    drawGame();
    updateHazardTimer();
    requestAnimationFrame(gameLoop);
}

// --- Mutation State ---
snail.radioactiveShellCooldown = 0;
snail.radioactiveShieldActive = false;
snail.radioactiveShieldTimer = 0;
snail.magnetCooldown = 0;
snail.spikedShellSlowTimer = 0;

// --- Snail Update ---
function updateSnail(dt) {
    updatePetLevel();
    applyPetEffects();
    // Restore movement after movementDisabledUntil
    if (snail.movementDisabledUntil && performance.now() > snail.movementDisabledUntil) {
        snail.isMoving = true;
        snail.movementDisabledUntil = null;
    }
    if (snail.isMoving) {
        // Calculate base speed and efficiency from upgrades and prestige
        let baseSpeed = 1 + snail.prestige * 0.2 + (upgradeDefs.find(u => u.id === 'speedShell')?.purchased || 0) * 0.5;
        let baseEfficiency = 1 + snail.prestige * 0.1 + (upgradeDefs.find(u => u.id === 'slimeBooster')?.purchased || 0) * 0.5;
        snail.speed = baseSpeed;
        snail.slimeEfficiency = baseEfficiency;

        let speed = snail.speed;
        // spikedShell slow effect
        if (snail.unlockedMutations.includes('spikedShell') && snail.spikedShellSlowTimer > 0) {
            speed *= 0.9;
        }
        if (snail.turboActive) speed *= 2;
        // Apply all hazard effect modifiers
        activeHazardEffects.forEach(effect => {
            switch (effect.type) {
                case 'salt':
                    speed *= 0.5;
                    break;
                case 'ants':
                    speed *= 0.7;
                    break;
                case 'shadow':
                    speed *= 0.6;
                    break;
                case 'spikedShell':
                    speed *= 0.9;
                    break;
            }
        });
        speed *= snail.speedMultiplier || 1;
        let efficiency = snail.slimeEfficiency;
        let slimeGain = speed * efficiency * (dt / 1000);
        slimeGain *= snail.slimeGainMultiplier || 1;
        snail.distance += speed * efficiency * (dt / 1000);
        snail.slimePoints += slimeGain;
    }

    // --- Mutation Timers ---
    // radioactiveShell: every 90s, activate shield for 10s
    if (snail.unlockedMutations.includes('radioactiveShell')) {
        if (!snail.radioactiveShellCooldown) snail.radioactiveShellCooldown = performance.now();
        if (!snail.radioactiveShieldActive && performance.now() - snail.radioactiveShellCooldown > 90000) {
            snail.radioactiveShieldActive = true;
            snail.radioactiveShieldTimer = 10000;
            snail.radioactiveShellCooldown = performance.now();
            showAlert('Radioactive Shell: Shield active! Immune to hazards for 10s.', 'info');
        }
        if (snail.radioactiveShieldActive) {
            snail.radioactiveShieldTimer -= dt;
            if (snail.radioactiveShieldTimer <= 0) {
                snail.radioactiveShieldActive = false;
                showAlert('Radioactive Shell: Shield expired.', 'info');
            }
        }
    }

    // magnetAntennae: every 60s, attract random slime
    if (snail.unlockedMutations.includes('magnetAntennae')) {
        if (!snail.magnetCooldown) snail.magnetCooldown = performance.now();
        if (performance.now() - snail.magnetCooldown > 60000) {
            const magnetGain = Math.floor(1000 + Math.random() * 2000);
            snail.slimePoints += magnetGain;
            snail.magnetCooldown = performance.now();
            showAlert(`Magnet Antennae: Magnetized slime attracted! +${magnetGain} slime.`, 'info');
        }
    }

    // quantumTrail, miniWings, etc. (add later)

    // spikedShell: slow effect timer
    if (snail.spikedShellSlowTimer > 0) {
        snail.spikedShellSlowTimer -= dt;
        if (snail.spikedShellSlowTimer <= 0) {
            snail.spikedShellSlowTimer = 0;
            showAlert('Spiked Shell: Speed restored.', 'info');
        }
    }

    // --- TurboGlands mutation ---
    // turboGlands: turbo lasts 20% longer
    if (snail.unlockedMutations.includes('turboGlands')) {
        if (snail.turboActive && snail.turboTimer > 0) {
            snail.turboTimer += dt * 0.2; // extend turbo duration by 20%
        }
    }

    // Hazard timer logic
    if (!window.lastHazardTime) window.lastHazardTime = performance.now();
    let elapsed = (performance.now() - window.lastHazardTime) / 1000;
    hazardTimer = Math.max(0, hazardInterval - elapsed);

    // Always spawn hazard when timer reaches zero
    if (hazardTimer <= 0 && !bossHazardActive) {
        hazardCount++;
        if (hazardCount % 5 === 0) {
            spawnBossHazard();
        } else {
            spawnHazard();
        }
        window.lastHazardTime = performance.now();
        hazardInterval = getRandomHazardInterval();
        hazardTimer = hazardInterval;
    }

    // Boss hazard effect timer
    if (bossHazardActive && currentBossHazard) {
        if (!currentBossHazard.endTime) {
            currentBossHazard.endTime = performance.now() + currentBossHazard.duration;
        }
        if (performance.now() > currentBossHazard.endTime) {
            bossHazardActive = false;
            currentBossHazard = null;
        }
    }

    if (snail.turboActive) {
        snail.turboTimer -= dt;
        if (snail.turboTimer <= 0) {
            snail.turboActive = false;
        }
    }

    // Check for hazard collisions/effects
    hazards.forEach(hazard => {
        if (!hazard.active) return;
        if (Math.abs(snail.distance - hazard.x) < 50) {
            applyHazardEffect(hazard);
            hazard.active = false;
        }
    });

    // Handle hazard effect timers
    clearExpiredHazardEffects();

    // Checkpoint logic
    snail.checkpoint = Math.floor(snail.distance / checkpointDistance);
    // Level logic
    snail.level = Math.floor(snail.distance / 1000) + 1;

    // Challenge progress (live update)
    let changed = false;
    // Daily
    snail.dailyChallenges.forEach((ch, i) => {
        if (snail.dailyComplete[i]) return;
        switch (ch.id) {
            case 'collectSlimeDaily':
                if (snail.slimePoints > snail.dailyProgress[i]) {
                    snail.dailyProgress[i] = Math.min(snail.slimePoints, ch.goal);
                    if (snail.dailyProgress[i] >= ch.goal) {
                        snail.dailyComplete[i] = true;
                        snail.slimePoints += 5000;
                        showAlert('Daily challenge complete! +5000 slime', 'success');
                    }
                    changed = true;
                }
                break;
            case 'reachDistanceDaily':
                if (snail.distance > snail.dailyProgress[i]) {
                    snail.dailyProgress[i] = Math.min(snail.distance, ch.goal);
                    if (snail.dailyProgress[i] >= ch.goal) {
                        snail.dailyComplete[i] = true;
                        snail.slimePoints += 5000;
                        showAlert('Daily challenge complete! +5000 slime', 'success');
                    }
                    changed = true;
                }
                break;
            case 'prestigeDaily':
                if (snail.prestige > snail.dailyProgress[i]) {
                    snail.dailyProgress[i] = Math.min(snail.prestige, ch.goal);
                    if (snail.dailyProgress[i] >= ch.goal) {
                        snail.dailyComplete[i] = true;
                        snail.slimePoints += 5000;
                        showAlert('Daily challenge complete! +5000 slime', 'success');
                    }
                    changed = true;
                }
                break;
            case 'unlockMutationDaily':
                if (snail.unlockedMutations.length > snail.dailyProgress[i]) {
                    snail.dailyProgress[i] = Math.min(snail.unlockedMutations.length, ch.goal);
                    if (snail.dailyProgress[i] >= ch.goal) {
                        snail.dailyComplete[i] = true;
                        snail.slimePoints += 5000;
                        showAlert('Daily challenge complete! +5000 slime', 'success');
                    }
                    changed = true;
                }
                break;
        }
    });
    // Weekly
    snail.weeklyChallenges.forEach((ch, i) => {
        if (snail.weeklyComplete[i]) return;
        switch (ch.id) {
            case 'collectSlimeWeekly':
                if (snail.slimePoints > snail.weeklyProgress[i]) {
                    snail.weeklyProgress[i] = Math.min(snail.slimePoints, ch.goal);
                    if (snail.weeklyProgress[i] >= ch.goal) {
                        snail.weeklyComplete[i] = true;
                        snail.slimePoints += 25000;
                        showAlert('Weekly challenge complete! +25000 slime', 'success');
                    }
                    changed = true;
                }
                break;
            case 'reachDistanceWeekly':
                if (snail.distance > snail.weeklyProgress[i]) {
                    snail.weeklyProgress[i] = Math.min(snail.distance, ch.goal);
                    if (snail.weeklyProgress[i] >= ch.goal) {
                        snail.weeklyComplete[i] = true;
                        snail.slimePoints += 25000;
                        showAlert('Weekly challenge complete! +25000 slime', 'success');
                    }
                    changed = true;
                }
                break;
            case 'prestigeWeekly':
                if (snail.prestige > snail.weeklyProgress[i]) {
                    snail.weeklyProgress[i] = Math.min(snail.prestige, ch.goal);
                    if (snail.weeklyProgress[i] >= ch.goal) {
                        snail.weeklyComplete[i] = true;
                        snail.slimePoints += 25000;
                        showAlert('Weekly challenge complete! +25000 slime', 'success');
                    }
                    changed = true;
                }
                break;
            case 'unlockMutationWeekly':
                if (snail.unlockedMutations.length > snail.weeklyProgress[i]) {
                    snail.weeklyProgress[i] = Math.min(snail.unlockedMutations.length, ch.goal);
                    if (snail.weeklyProgress[i] >= ch.goal) snail.weeklyComplete[i] = true;
                    changed = true;
                }
                break;
        }
    });
    if (changed) saveGame();
    // Remove expired hazards
    hazards = hazards.filter(h => h.active !== false);

    // Remove currentHazard if effect is over
    if (currentHazard && performance.now() - currentHazard.created > currentHazard.duration) {
        currentHazard = null;
    }
}

// --- Pet Definitions ---
const petDefs = [
    { id: 'blue', name: 'Blue Slime', desc: 'Doubles slime gain. +2% per pet level.', asset: 'assets/blue/slime_idle.png' },
    { id: 'gray', name: 'Gray Slime', desc: 'Hazard immunity for 5s after spawn. +0.1s per pet level.', asset: 'assets/gray/slime_idle.png' },
    { id: 'green', name: 'Green Slime', desc: 'Speed +50%. +1% per pet level.', asset: 'assets/green/slime_idle.png' },
    { id: 'pink', name: 'Pink Slime', desc: 'Turbo lasts 50% longer. +1% per pet level.', asset: 'assets/pink/slime_idle.png' },
    { id: 'red', name: 'Red Slime', desc: 'Hazard effects reduced by 60%. +0.5% per pet level.', asset: 'assets/red/slime_idle.png' }
];

// --- Pet Book logic ---
window.showPetBook = function() {
    const petBookMenu = document.getElementById('pet-book-menu');
    const petBookList = document.getElementById('pet-book-list');
    petBookMenu.style.display = 'block';
    petBookList.innerHTML = '';
    petDefs.forEach((pet, i) => {
        const unlocked = snail.unlockedPets && snail.unlockedPets.includes(pet.id);
        const div = document.createElement('div');
        div.className = unlocked ? 'pet-unlocked' : 'pet-locked';
        div.style = 'margin-bottom:0;padding:8px 8px;border-radius:8px;min-width:0;word-break:break-word;font-size:13px;cursor:pointer;';
        div.title = pet.desc;
        div.innerHTML = `<b style='color:#00e6ff;'>${pet.name}</b><br><span style='font-size:12px;color:#ccc;'>${pet.desc}</span><br><span style='font-size:11px;color:${unlocked ? "#00e676" : "#ff4444"};'>${unlocked ? "Unlocked" : "Locked"}</span>`;
        div.onmouseenter = function() { div.style.background = "rgba(255,255,255,0.08)"; };
        div.onmouseleave = function() { div.style.background = ""; };
        div.onclick = function() { showAlert(div.title, 'info'); };
        petBookList.appendChild(div);
    });
};

// --- Pet Sprite Loading ---
const petSprites = {};
petDefs.forEach(pet => {
    const img = new Image();
    img.src = pet.asset;
    petSprites[pet.id] = img;
});

// Add placeholder image for pet area
const petPlaceholderImg = new Image();
petPlaceholderImg.src = 'assets/template.png';

// --- Pet Leveling ---
function updatePetLevel() {
    if (snail.pet && snail.unlockedPets.includes(snail.pet)) {
        const newLevel = Math.min(60, Math.floor(snail.distance / 20000) + 1);
        if (newLevel > snail.petLevel) {
            snail.petLevel = newLevel;
            showAlert(`Your pet leveled up! Lv ${snail.petLevel}`, 'success');
            saveGame();
        }
    }
}

// --- Apply Pet Effects ---
function applyPetEffects() {
    // Reset all multipliers before applying
    snail.slimeGainMultiplier = 1;
    snail.speedMultiplier = 1;
    snail.turboDurationMultiplier = 1;
    snail.hazardImmunityDuration = 0;
    snail.hazardReduction = 0;
    if (!snail.pet || !snail.unlockedPets.includes(snail.pet)) return;
    const pet = petDefs.find(p => p.id === snail.pet);
    const lvl = snail.petLevel || 1;
    switch (pet.id) {
        case 'blue':
            snail.slimeGainMultiplier = 2 + 0.02 * lvl;
            break;
        case 'gray':
            snail.hazardImmunityDuration = 5000 + 100 * lvl;
            break;
        case 'green':
            snail.speedMultiplier = 1.5 + 0.01 * lvl;
            break;
        case 'pink':
            snail.turboDurationMultiplier = 1.5 + 0.01 * lvl;
            break;
        case 'red':
            snail.hazardReduction = 0.6 + 0.005 * lvl;
            break;
        default:
            // No effect
            break;
    }
}

// --- Hazard Description ---
function getHazardDescription(type) {
    switch(type) {
        case 'salt': return 'Halves speed and disables Speed Shell for 30s.';
        case 'bird': return 'Steals 10% slime and disables movement for 10s.';
        case 'puddle': return 'Slides forward 120m.';
        case 'pebble': return 'Blocks movement for 8s.';
        case 'ants': return 'Halves slime efficiency for 60s.';
        case 'gum': return 'Disables upgrades for 20s.';
        case 'shadow': return 'Halves speed for 40s.';
        case 'wind': return 'Pushes back 200m.';
        case 'oil': return 'Randomly moves -100m or +100m.';
        case 'laser': return 'Disables turbo for 15s.';
        default: return '';
    }
}

function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alert-container');
    const alertDiv = document.createElement('div');
    alertDiv.className = `custom-alert ${type}`;
    alertDiv.innerText = message;
    alertContainer.appendChild(alertDiv);
    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}

function getPrestigeCost() {
    return Math.floor(12000 * Math.pow(1.75, snail.prestige));
}

function toRoman(num) {
    if (num <= 0) return '';
    const romans = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];
    return romans[num-1] || num;
}

// --- Leaderboard ---
let leaderboardTimer = 15;
let leaderboardNeedsUpdate = true;

function updateLeaderboard() {
    if (!leaderboardNeedsUpdate) return;
    leaderboardNeedsUpdate = false;
    database.ref('users').orderByChild('distance').limitToLast(10).once('value').then(snapshot => {
        const leaderboard = [];
        snapshot.forEach(child => {
            leaderboard.push({
                username: child.key,
                distance: Math.floor(child.val().distance || 0),
                prestige: child.val().prestige || 0
            });
        });
        leaderboard.sort((a, b) => b.distance - a.distance);
        const lbDiv = document.getElementById('leaderboard-list');
        lbDiv.innerHTML = leaderboard.length ? leaderboard.map((u, i) => `${i+1}. <b>${u.username}</b>: ${u.distance}m <span style='color:#ffd700'>(${toRoman(u.prestige)})</span>`).join('<br>') : 'No entries yet.';
    });
    document.getElementById('leaderboard-timer').innerText = leaderboardTimer;
}

// Only update leaderboard every 15 seconds, not live
setInterval(() => {
    leaderboardTimer--;
    if (leaderboardTimer <= 0) {
        leaderboardNeedsUpdate = true;
        updateLeaderboard();
        leaderboardTimer = 15;
        document.getElementById('leaderboard-timer').innerText = leaderboardTimer;
    } else {
        document.getElementById('leaderboard-timer').innerText = leaderboardTimer;
    }
}, 1000);

// Remove old leaderboard panel update

function saveGame() {
    if (!username) return;
    // Save snail state and upgrade purchase counts and costs
    const saveData = { ...snail };
    saveData.upgrades = upgradeDefs.map(upg => ({ id: upg.id, purchased: upg.purchased || 0, cost: upg.cost }));
    saveData.unlockedMutations = Array.isArray(snail.unlockedMutations) ? snail.unlockedMutations : [];
    // Save challenges
    saveData.dailyChallenges = snail.dailyChallenges;
    saveData.dailyProgress = snail.dailyProgress;
    saveData.dailyComplete = snail.dailyComplete;
    saveData.weeklyChallenges = snail.weeklyChallenges;
    saveData.weeklyProgress = snail.weeklyProgress;
    saveData.weeklyComplete = snail.weeklyComplete;
    saveData.dailyReset = snail.dailyReset;
    saveData.weeklyReset = snail.weeklyReset;
    saveData.pet = snail.pet;
    saveData.petLevel = snail.petLevel;
    saveData.unlockedPets = Array.isArray(snail.unlockedPets) ? snail.unlockedPets : [];
    // Save reset counters
    saveData.dailyResetCount = snail.dailyResetCount || 0;
    saveData.weeklyResetCount = snail.weeklyResetCount || 0;
    // Save best distance if higher
    database.ref('users/' + username).once('value').then(snapshot => {
        const prev = snapshot.val();
        if (!prev || (snail.distance > (prev.distance || 0))) {
            database.ref('users/' + username).set(saveData);
        } else {
            database.ref('users/' + username).update(saveData);
        }
    });
    updateLeaderboard();
}

function loadGame() {
    if (!username) return;
    database.ref('users/' + username).once('value').then((snapshot) => {
        const loaded = snapshot.val();
        if (loaded) {
            // Defensive: ensure all properties are numbers
            snail.distance = Number(loaded.distance) || 0;
            snail.slimePoints = Number(loaded.slimePoints) || 0;
            snail.speed = Number(loaded.speed) || 1;
            snail.stamina = Number(loaded.stamina) || 100;
            snail.maxStamina = Number(loaded.maxStamina) || 100;
            snail.slimeEfficiency = Number(loaded.slimeEfficiency) || 1;
            snail.trailBoosters = Number(loaded.trailBoosters) || 1;
            snail.isMoving = Boolean(loaded.isMoving);
            snail.turboActive = Boolean(loaded.turboActive);
            snail.turboTimer = Number(loaded.turboTimer) || 0;
            snail.checkpoint = Number(loaded.checkpoint) || 0;
            snail.prestige = Number(loaded.prestige) || 0;
            snail.mutations = Array.isArray(loaded.mutations) ? loaded.mutations : [];
            snail.skin = Number(loaded.skin) || 0;
            snail.restTimer = Number(loaded.restTimer) || 0;
            snail.level = Number(loaded.level) || 1;
            snail.unlockedMutations = Array.isArray(loaded.unlockedMutations) ? loaded.unlockedMutations : [];
            // Load challenges
            snail.dailyChallenges = loaded.dailyChallenges || [];
            snail.dailyProgress = loaded.dailyProgress || [0,0,0,0,0];
            snail.dailyComplete = loaded.dailyComplete || [false,false,false,false,false];
            snail.weeklyChallenges = loaded.weeklyChallenges || [];
            snail.weeklyProgress = loaded.weeklyProgress || Array(10).fill(0);
            snail.weeklyComplete = loaded.weeklyComplete || Array(10).fill(false);
            snail.dailyReset = loaded.dailyReset || getNextDailyReset();
            snail.weeklyReset = loaded.weeklyReset || getNextWeeklyReset();
            // Load upgrade purchase counts and costs
            if (Array.isArray(loaded.upgrades)) {
                loaded.upgrades.forEach(savedUpg => {
                    const upg = upgradeDefs.find(u => u.id === savedUpg.id);
                    if (upg) {
                        upg.purchased = savedUpg.purchased || 0;
                        upg.cost = savedUpg.cost || Math.floor(upg.baseCost * Math.pow(1.25, upg.purchased));
                    }
                });
            }
            snail.pet = loaded.pet || null;
            snail.petLevel = Number(loaded.petLevel) || 1;
            snail.unlockedPets = Array.isArray(loaded.unlockedPets) ? loaded.unlockedPets : [];
            snail.dailyResetCount = loaded.dailyResetCount || 0;
            snail.weeklyResetCount = loaded.weeklyResetCount || 0;
        }
    });
}

// Save game every 10 seconds
setInterval(saveGame, 10000);

// Prompt for username on load
window.addEventListener('DOMContentLoaded', () => {

    promptUsername();
    // Initialize daily/weekly challenges if not set or expired
    const now = Date.now();
    if (!snail.dailyChallenges.length || now > snail.dailyReset) resetDailyChallenges();
    if (!snail.weeklyChallenges.length || now > snail.weeklyReset) resetWeeklyChallenges();
    // Do not call updateLeaderboard here, only refresh on timer
    // Restore upgrade button click handlers
    upgradeDefs.forEach(upg => {
        const btn = document.getElementById(upg.id);
        btn.onclick = () => {
            if (snail.slimePoints >= upg.cost) {
                snail.slimePoints -= upg.cost;
                upg.purchased = (upg.purchased || 0) + 1;
                if (upg.id === 'turboSlime') upg.action();
                upg.cost = Math.floor(upg.baseCost * Math.pow(1.25, upg.purchased));
                updateUI();
                showAlert(`Upgraded: ${upg.name}!`, 'success');
                saveGame();
            } else {
                showAlert('Not enough slime!', 'error');
            }
        };
    });
    // Add prestige button click handler
    const prestigeBtn = document.getElementById('prestigeBtn');
    if (prestigeBtn) {
        prestigeBtn.onclick = () => {
            prestige();
        };
    }
    // Hazard Book logic
    const hazardBookBtn = document.getElementById('open-hazard-book');
    const hazardBookMenu = document.getElementById('hazard-book-menu');
    const hazardBookList = document.getElementById('hazard-book-list');
    const closeHazardBookBtn = document.getElementById('close-hazard-book');

    hazardBookBtn.onclick = () => {
        hazardBookMenu.style.display = 'block';
        // Normal hazards
        let hazardHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 14px;">';
        hazardTypes.forEach(h => {
            hazardHtml += `<div style="margin-bottom:14px;padding:10px 0;border-bottom:1px solid #333;">
                <span style="font-size:16px;color:${h.color};font-weight:bold;">${h.name}</span><br>
                <span style="font-size:13px;color:#fff;">${getHazardDescription(h.type)}</span>
            </div>`;
        });
        hazardHtml += '</div>';
        // Boss hazards (rare hazards)
        hazardHtml += '<div style="margin-top:18px;font-size:17px;color:#ffd700;font-weight:bold;text-align:center;">Rare Hazards</div>';
        hazardHtml += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px 14px;">';
        bossHazardTypes.forEach(bh => {
            hazardHtml += `<div style="margin-bottom:14px;padding:10px 0;border-bottom:1px solid #333;">
                <span style="font-size:16px;color:${bh.color};font-weight:bold;">${bh.name}</span><br>
                <span style="font-size:13px;color:#fff;">${bh.desc}</span>
            </div>`;
        });
        hazardHtml += '</div>';
        hazardBookList.innerHTML = hazardHtml;
    };
    closeHazardBookBtn.onclick = () => {
        hazardBookMenu.style.display = 'none';
    };
    });

requestAnimationFrame(gameLoop);

function drawGame() {
    // Defensive: fallback to first scenery if checkpoint is invalid
    let sceneryIndex = Number.isFinite(snail.checkpoint) && snail.checkpoint >= 0 ? snail.checkpoint % scenery.length : 0;
    let currentScenery = scenery[sceneryIndex] || scenery[0];
    ctx.fillStyle = currentScenery.color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw hazards with simple animations
        hazards.forEach(hazard => {
            // Calculate hazard position relative to snail
            const relX = canvas.width/2 + (hazard.x - snail.distance);
            const relY = canvas.height/2 + 40;
            const elapsed = performance.now() - hazard.created;
            const progress = Math.min(elapsed / hazard.duration, 1);
            ctx.save();
            switch(hazard.type) {
                case 'salt': // Salt Patch: pulsing white circle
                    ctx.globalAlpha = 0.7 + 0.3*Math.sin(elapsed/200);
                    ctx.beginPath();
                    ctx.arc(relX, relY, 28 + 4*Math.sin(elapsed/150), 0, 2*Math.PI);
                    ctx.fillStyle = '#fff';
                    ctx.fill();
                    break;
                case 'bird': // Bird Attack: swooping triangle
                    ctx.globalAlpha = 0.85;
                    ctx.fillStyle = '#222';
                    ctx.save();
                    ctx.translate(relX, relY - 40 - 30*Math.sin(progress*Math.PI));
                    ctx.rotate(Math.sin(elapsed/300)*0.2);
                    ctx.beginPath();
                    ctx.moveTo(0,0);
                    ctx.lineTo(-18,24);
                    ctx.lineTo(18,24);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                    break;
                case 'puddle': // Puddle: animated blue ellipse
                    ctx.globalAlpha = 0.7;
                    ctx.beginPath();
                    ctx.ellipse(relX, relY+8, 32+6*Math.sin(elapsed/180), 16+3*Math.cos(elapsed/120), 0, 0, 2*Math.PI);
                    ctx.fillStyle = '#4fc3f7';
                    ctx.fill();
                    break;
                case 'pebble': // Falling Pebble: gray circle dropping
                    ctx.globalAlpha = 0.8;
                    ctx.beginPath();
                    ctx.arc(relX, relY - 40 + 40*progress, 14, 0, 2*Math.PI);
                    ctx.fillStyle = '#888';
                    ctx.fill();
                    break;
                case 'ants': // Ant Swarm: brown dots moving in a wave
                    ctx.globalAlpha = 0.8;
                    for (let i=0; i<7; i++) {
                        let ax = relX - 18 + i*6;
                        let ay = relY + 10*Math.sin(elapsed/120 + i);
                        ctx.beginPath();
                        ctx.arc(ax, ay, 4, 0, 2*Math.PI);
                        ctx.fillStyle = '#6d4c41';
                        ctx.fill();
                    }
                    break;
                case 'gum': // Sticky Gum: pink blob pulsing
                    ctx.globalAlpha = 0.7 + 0.2*Math.sin(elapsed/100);
                    ctx.beginPath();
                    ctx.ellipse(relX, relY, 22+6*Math.sin(elapsed/90), 18+4*Math.cos(elapsed/120), 0, 0, 2*Math.PI);
                    ctx.fillStyle = '#ff69b4';
                    ctx.fill();
                    break;
                case 'shadow': // Shadow Hand: dark hand-like shape rising
                    ctx.globalAlpha = 0.6;
                    ctx.save();
                    ctx.translate(relX, relY + 30 - 30*progress);
                    ctx.rotate(Math.sin(elapsed/200)*0.1);
                    ctx.beginPath();
                    ctx.moveTo(0,0);
                    ctx.lineTo(-12,-18);
                    ctx.lineTo(-6,-8);
                    ctx.lineTo(0,-22);
                    ctx.lineTo(6,-8);
                    ctx.lineTo(12,-18);
                    ctx.closePath();
                    ctx.fillStyle = '#333';
                    ctx.fill();
                    ctx.restore();
                    break;
                case 'wind': // Wind Gust: animated cyan swirls
                    ctx.globalAlpha = 0.5;
                    for (let i=0; i<3; i++) {
                        ctx.beginPath();
                        ctx.arc(relX + 18*Math.sin(elapsed/200 + i), relY - 10 + 8*i, 10 + 2*Math.cos(elapsed/150 + i), 0, 2*Math.PI);
                        ctx.strokeStyle = '#b2ebf2';
                        ctx.lineWidth = 3;
                        ctx.stroke();
                    }
                    break;
                case 'oil': // Oil Spill: animated black blob
                    ctx.globalAlpha = 0.7;
                    ctx.beginPath();
                    ctx.ellipse(relX, relY+10, 26+5*Math.sin(elapsed/110), 14+3*Math.cos(elapsed/90), 0, 0, 2*Math.PI);
                    ctx.fillStyle = '#212121';
                    ctx.fill();
                    break;
                case 'laser': // Laser Fence: flashing red lines
                    ctx.globalAlpha = 0.8;
                    for (let i=0; i<3; i++) {
                        ctx.beginPath();
                        ctx.moveTo(relX-20+i*20, relY-18);
                        ctx.lineTo(relX-20+i*20, relY+18);
                        ctx.strokeStyle = (Math.floor(elapsed/150)%2===0)?'#e74c3f':'#fff';
                        ctx.lineWidth = 4;
                        ctx.stroke();
                    }
                    break;
                default:
                    // Generic hazard: gray circle
                    ctx.globalAlpha = 0.7;
                    ctx.beginPath();
                    ctx.arc(relX, relY, 20, 0, 2*Math.PI);
                    ctx.fillStyle = hazard.color || '#888';
                    ctx.fill();
            }
            ctx.restore();
        });

    // Speed effect: animated motion blur lines if turbo
    if (snail.turboActive) {
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 6;
        // Animate lines using frame
        let animOffset = frame * 4;
        for (let i = 0; i < 8; i++) {
            let x = canvas.width/2 - 40 - i*12 - animOffset;
            let y = canvas.height/2 + Math.sin(i + frame/2)*18;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x-30, y);
            ctx.stroke();
        }
        ctx.restore();
    }

    // Milestone markers (centered under snail)
    const markerY = canvas.height/2 + 80;
    const markerSpacing = 60;
    const markerCount = 5;
    const startX = canvas.width/2 - ((markerCount-1)/2)*markerSpacing;
    for (let i = 0; i < markerCount; i++) {
        let mark = Math.floor(snail.distance / 100) + i + 1;
        ctx.fillStyle = '#fff';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${mark * 100}m`, startX + i*markerSpacing, markerY);
    }

    // Draw snail level above snail
    ctx.save();
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.strokeText(`Lv ${snail.level}`, canvas.width/2, canvas.height/2 - 60);
    ctx.fillText(`Lv ${snail.level}`, canvas.width/2, canvas.height/2 - 60);

    // Draw turbo slime counter above snail if active
    let yOffset = -90;
    if (snail.turboActive && snail.turboTimer > 0) {
        ctx.font = 'bold 18px monospace';
        ctx.fillStyle = '#00e676';
        ctx.fillText(`Turbo: ${Math.ceil(snail.turboTimer/1000)}s`, canvas.width/2, canvas.height/2 + yOffset);
        yOffset -= 25;
    }
    if (bossHazardActive && currentBossHazard) {
        ctx.font = 'bold 18px monospace';
        ctx.fillStyle = '#ff1744';
        const timeLeft = Math.max(0, Math.ceil((currentBossHazard.endTime - performance.now()) / 1000));
        ctx.fillText(`BOSS: ${currentBossHazard.name} (${timeLeft}s)`, canvas.width/2, canvas.height/2 + yOffset);
        yOffset -= 25;
    }
    // Show all active hazard effects with counters, except puddle, wind, oil
    activeHazardEffects.forEach(effect => {
        if (['puddle', 'wind', 'oil'].includes(effect.type)) return;
        // Boss hazard durations
        let timeLeft;
        if (['giantFoot', 'shadowBeast'].includes(effect.type)) {
            // Giant Foot: 20s, Shadow Beast: 20s
            timeLeft = Math.max(0, Math.ceil((effect.endTime - performance.now()) / 1000));
        } else if (effect.type === 'acidRain') {
            // Acid Rain: 18s
            timeLeft = Math.max(0, Math.ceil((effect.endTime - performance.now()) / 1000));
        } else {
            // Normal hazards
            timeLeft = Math.max(0, Math.ceil((effect.endTime - performance.now()) / 1000));
        }
        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = '#e74c3c';
        ctx.fillText(`${effect.name} (${timeLeft}s)`, canvas.width/2, canvas.height/2 + yOffset);
        yOffset -= 25;
    });
    ctx.restore();

    // Snail animation (walk, walk2, walk3, walk4, walk5, walk6 based on prestige)
    // Prestige 0: walk, 1: walk2, 2: walk3, 3: walk4, 4: walk5, 5 and above: walk6
    let sprite;
    if (snail.prestige >= 6) {
        sprite = snailSprites.walk6;
    } else if (snail.prestige === 5) {
        sprite = snailSprites.walk5;
    } else if (snail.prestige === 4) {
        sprite = snailSprites.walk4;
    } else if (snail.prestige === 3) {
        sprite = snailSprites.walk3;
    } else if (snail.prestige === 2) {
        sprite = snailSprites.walk2;
    } else if (snail.prestige === 1) {
        sprite = snailSprites.walk2;
    } else {
        sprite = snailSprites.walk;
    }
    // Actually, walk2 should be for prestige 1, walk3 for 2, etc. Let's fix:
    // Prestige sprite mapping:
    // 0: walk, 1: walk2, 2: walk3, 3: walk4, 4: walk5, 5 and above: walk6
    const spriteMap = [snailSprites.walk, snailSprites.walk2, snailSprites.walk3, snailSprites.walk4, snailSprites.walk5];
    sprite = snail.prestige >= 5 ? snailSprites.walk6 : spriteMap[snail.prestige];
    // If you add more sprites, expand spriteMap and adjust the logic above.
    let spriteW = 32, spriteH = 32, frames = 3;
    ctx.drawImage(
        sprite,
        frame * spriteW,
        0,
        spriteW,
        spriteH,
        canvas.width/2 - spriteW,
        canvas.height/2 - spriteH/2,
        spriteW * 2,
        spriteH * 2
    );

    // Draw pet sprite or placeholder next to snail
    const petYOffset = 18; // Move pet sprite slightly lower
    const petAreaX = canvas.width/2 + 50;
    const petAreaY = canvas.height/2 - 16 + petYOffset;
    if (snail.pet && petSprites[snail.pet]) {
        // Use frame for animation (4 frames, 128x32)
        const petImg = petSprites[snail.pet];
        const petFrame = Math.floor((performance.now()/200)%4);
        ctx.drawImage(
            petImg,
            petFrame * 32, 0, 32, 32,
            petAreaX, petAreaY,
            32, 32
        );
        // Show pet level above pet
        ctx.save();
        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = '#00e6ff';
        ctx.textAlign = 'center';
        ctx.fillText(`Lv${snail.petLevel}`, canvas.width/2 + 66, canvas.height/2 - 24 + petYOffset);
        ctx.restore();
    } else if (snail.unlockedPets && snail.unlockedPets.length > 0) {
        ctx.drawImage(
            petPlaceholderImg,
            0, 0, 32, 32,
            petAreaX, petAreaY,
            32, 32
        );
        ctx.save();
        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = '#00e6ff';
                      ctx.textAlign = 'center';
        ctx.fillText(`Choose Pet`, canvas.width/2 + 66, canvas.height/2 - 24 + petYOffset);
        ctx.restore();
    }

    // --- Mutation Animations ---
    // radioactiveShell: shield effect
    if (snail.unlockedMutations.includes('radioactiveShell') && snail.radioactiveShieldActive) {
        ctx.save();
        ctx.globalAlpha = 0.5 + 0.2 * Math.sin(performance.now()/200);
        ctx.beginPath();
        ctx.arc(canvas.width/2, canvas.height/2-16, 38 + 4*Math.sin(performance.now()/150), 0, 2*Math.PI);
        ctx.strokeStyle = '#00e6ff';
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.restore();
    }
    // magnetAntennae: magnet effect
    if (snail.unlockedMutations.includes('magnetAntennae')) {
        ctx.save();
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(performance.now()/180);
        ctx.beginPath();
        ctx.arc(canvas.width/2, canvas.height/2, 48 + 8*Math.sin(performance.now()/120), 0, 2*Math.PI);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    }
    // spikedShell: spikes effect
    if (snail.unlockedMutations.includes('spikedShell')) {
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = '#ff5722';
        ctx.lineWidth =         4;
        for (let i=0; i<8; i++) {
            let angle = (Math.PI*2/8)*i;
            let x1 = canvas.width/2 + Math.cos(angle)*32;
            let y1 = canvas.height/2-16 + Math.sin(angle)*32;
            let x2 = canvas.width/2 + Math.cos(angle)*44;
            let y2 = canvas.height/2-16 + Math.sin(angle)*44;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        ctx.restore();
    }

    // Draw equipped mutations below snail/meters
    const eq = snail.equippedMutations || [];
    if (eq.length > 0) {
        // Move circles lower
        const y = canvas.height/2 + 130; // was +110
        const spacing = 55;
        const startX = canvas.width/2 - ((eq.length-1)/2)*spacing;
        eq.forEach((mutId, idx) => {
            const mutIdx = mutationDefs.findIndex(m => m.id === mutId);
            // Make circles darker
            const color = "#222"; // dark gray
            ctx.save();
            ctx.beginPath();
            ctx.arc(startX + idx*spacing, y, 22, 0, 2*Math.PI);
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.92;
            ctx.fill();
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#111';
            ctx.stroke();
            // Draw mutation index
            ctx.font = 'bold 18px monospace';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(mutIdx+1, startX + idx*spacing, y);
            // Draw cooldown timer (if any) with swaying white color
            const state = snail.mutationCooldowns[idx] || {};
            if (state.cooldown > 0 || state.active > 0) {
                const timer = Math.ceil((state.active > 0 ? state.active : state.cooldown) / 1000);
                // Swaying white color
                const sway = Math.floor(220 + 20 * Math.sin(performance.now()/200));
                ctx.font = 'bold 13px monospace';
                ctx.fillStyle = `rgb(${sway},${sway},${sway})`;
                ctx.fillText(`${timer}s`, startX + idx*spacing, y + 28);
            }
            ctx.restore();
        });
        // Store coords for canvas click handler (for "+" logic)
        window._mutationSlotCoords = eq.map((mutId, idx) => ({
            x: startX + idx*spacing,
            y: y,
            r: 24
        }));
    }
}

// --- Mutation Colors (same as mutation book) ---
const mutationColors = [
    '#ffb300', '#00bcd4', '#8bc34a', '#e91e63', '#9c27b0', '#ff5722', '#03a9f4', '#cddc39', '#f44336', '#009688',
    '#ffc107', '#673ab7', '#4caf50', '#ff9800', '#2196f3', '#607d8b', '#795548', '#00e676', '#e040fb', '#d50000'
];

// --- Equipped Mutations State ---
snail.equippedMutations = [null, null, null]; // 3 slots, null if not equipped

// --- Mutation Cooldown State ---
if (!snail.mutationCooldowns) snail.mutationCooldowns = [{}, {}, {}]; // {cooldown: ms, active: ms}

// --- Mutation Equip Menu ---
window.showMutationEquipMenu = function(slotIdx = null) {
    let menu = document.getElementById('mutation-equip-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'mutation-equip-menu';
        menu.style = `
            position:fixed;left:50%;top:56%;transform:translate(-50%,0);
            z-index:400;background:rgba(20,20,20,0.98);border-radius:18px;
            padding:18px 24px;box-shadow:0 4px 24px #000;min-width:220px;
            max-width:340px;max-height:60vh;overflow-y:auto;text-align:center;
        `;
        document.body.appendChild(menu);
    }
    menu.innerHTML = `<div style="font-size:20px;font-weight:bold;color:#ffd700;margin-bottom:12px;">Equip Mutation</div>`;
    menu.innerHTML += `<div id="mutation-equip-list" style="display:flex;justify-content:center;gap:18px;margin-bottom:14px;"></div>`;
    const list = menu.querySelector('#mutation-equip-list');
    mutationDefs.forEach((mut, i) => {
        if (!snail.unlockedMutations.includes(mut.id)) return;
        const color = mutationColors[i % mutationColors.length];
        const equippedIdx = snail.equippedMutations.indexOf(mut.id);
        const div = document.createElement('div');
        div.style = `
            width:48px;height:48px;border-radius:50%;background:${color};
            display:flex;align-items:center;justify-content:center;cursor:pointer;
            box-shadow:0 2px 8px #000;position:relative;border:${equippedIdx !== -1 ? '3px solid #ffd700' : '2px solid #222'};
            transition:border 0.2s;
        `;
        div.title = mut.name;
        div.innerHTML = `<span style="color:#fff;font-size:18px;font-weight:bold;">${i+1}</span>`;
        if (equippedIdx !== -1) {
            div.innerHTML += `<span style="position:absolute;bottom:2px;right:6px;font-size:12px;color:#ffd700;">✔</span>`;
        }
        div.onclick = function() {
            if (equippedIdx !== -1) {
                snail.equippedMutations[equippedIdx] = null;
                snail.mutationCooldowns[equippedIdx] = {};
            } else if (slotIdx !== null) {
                snail.equippedMutations[slotIdx] = mut.id;
                snail.mutationCooldowns[slotIdx] = {};
            }
            menu.style.display = 'none';
            updateUI();
            saveGame();
        };
        list.appendChild(div);
    });
    menu.innerHTML += `<button id="close-mutation-equip-menu" style="margin-top:18px;padding:7px 18px;border-radius:8px;background:#222;color:#ffd700;font-size:15px;border:none;cursor:pointer;">Close</button>`;
    menu.querySelector('#close-mutation-equip-menu').onclick = function() {
        menu.style.display = 'none';
    };
    menu.style.display = 'block';
};

// --- Add button to open equip menu (optional, can remove if only using "+" on circles) ---
window.addEventListener('DOMContentLoaded', function() {
    // ...existing code...
    let equipBtn = document.getElementById('open-mutation-equip');
    if (!equipBtn) {
        equipBtn = document.createElement('button');
        equipBtn.id = 'open-mutation-equip';
        equipBtn.innerText = '⚡ Equip Mutations';
        equipBtn.style = `
            position:fixed;left:50%;top:68%;transform:translate(-50%,0); /* was 64% */
            z-index:399;padding:8px 18px;border-radius:18px;background:#222;
            color:#ffd700;font-size:16px;border:none;cursor:pointer;box-shadow:0 2px 8px #000;
        `;
        document.body.appendChild(equipBtn);
    }
    equipBtn.onclick = function() {
        window.showMutationEquipMenu();
    };
    // ...existing code...
});

// --- Mutation Cooldown Logic ---
// Example for radioactiveShell (slot-based)
function updateMutationCooldowns(dt) {
    snail.equippedMutations.forEach((mutId, idx) => {
        if (!mutId) return;
        const mut = mutationDefs.find(m => m.id === mutId);
        const state = snail.mutationCooldowns[idx] || {};
        // Example: radioactiveShell
        if (mutId === 'radioactiveShell') {
            if (!state.cooldown && !state.active) {
                state.cooldown = 90000; // 90s cooldown
                state.active = 0;
            }
            if (state.cooldown > 0) {
                state.cooldown -= dt;
                if (state.cooldown <= 0) {
                    state.cooldown = 0;
                    state.active = 10000; // 10s active
                    showAlert('Radioactive Shell: Shield active! Immune to hazards for 10s.', 'info');
                }
            } else if (state.active > 0) {
                state.active -= dt;
                if (state.active <= 0) {
                    state.active = 0;
                    state.cooldown = 90000;
                    showAlert('Radioactive Shell: Shield expired.', 'info');
                }
            }
        }
        // Add similar logic for other mutations with cooldowns/active durations
        snail.mutationCooldowns[idx] = state;
    });
}

// --- Snail Update ---
function updateSnail(dt) {
    updatePetLevel();
    applyPetEffects();
    // Restore movement after movementDisabledUntil
    if (snail.movementDisabledUntil && performance.now() > snail.movementDisabledUntil) {
        snail.isMoving = true;
        snail.movementDisabledUntil = null;
    }
    if (snail.isMoving) {
        // Calculate base speed and efficiency from upgrades and prestige
        let baseSpeed = 1 + snail.prestige * 0.2 + (upgradeDefs.find(u => u.id === 'speedShell')?.purchased || 0) * 0.5;
        let baseEfficiency = 1 + snail.prestige * 0.1 + (upgradeDefs.find(u => u.id === 'slimeBooster')?.purchased || 0) * 0.5;
        snail.speed = baseSpeed;
        snail.slimeEfficiency = baseEfficiency;

        let speed = snail.speed;
        // spikedShell slow effect
        if (snail.unlockedMutations.includes('spikedShell') && snail.spikedShellSlowTimer > 0) {
            speed *= 0.9;
        }
        if (snail.turboActive) speed *= 2;
        // Apply all hazard effect modifiers
        activeHazardEffects.forEach(effect => {
            switch (effect.type) {
                case 'salt':
                    speed *= 0.5;
                    break;
                case 'ants':
                    speed *= 0.7;
                    break;
                case 'shadow':
                    speed *= 0.6;
                    break;
                case 'spikedShell':
                    speed *= 0.9;
                    break;
            }
        });
        speed *= snail.speedMultiplier || 1;
        let efficiency = snail.slimeEfficiency;
        let slimeGain = speed * efficiency * (dt / 1000);
        slimeGain *= snail.slimeGainMultiplier || 1;
        snail.distance += speed * efficiency * (dt / 1000);
        snail.slimePoints += slimeGain;
    }

    // --- Mutation Timers ---
    // radioactiveShell: every 90s, activate shield for 10s
    if (snail.unlockedMutations.includes('radioactiveShell')) {
        if (!snail.radioactiveShellCooldown) snail.radioactiveShellCooldown = performance.now();
        if (!snail.radioactiveShieldActive && performance.now() - snail.radioactiveShellCooldown > 90000) {
            snail.radioactiveShieldActive = true;
            snail.radioactiveShieldTimer = 10000;
            snail.radioactiveShellCooldown = performance.now();
            showAlert('Radioactive Shell: Shield active! Immune to hazards for 10s.', 'info');
        }
        if (snail.radioactiveShieldActive) {
            snail.radioactiveShieldTimer -= dt;
            if (snail.radioactiveShieldTimer <= 0) {
                snail.radioactiveShieldActive = false;
                showAlert('Radioactive Shell: Shield expired.', 'info');
            }
        }
    }

    // magnetAntennae: every 60s, attract random slime
    if (snail.unlockedMutations.includes('magnetAntennae')) {
        if (!snail.magnetCooldown) snail.magnetCooldown = performance.now();
        if (performance.now() - snail.magnetCooldown > 60000) {
            const magnetGain = Math.floor(1000 + Math.random() * 2000);
            snail.slimePoints += magnetGain;
            snail.magnetCooldown = performance.now();
            showAlert(`Magnet Antennae: Magnetized slime attracted! +${magnetGain} slime.`, 'info');
        }
    }

    // quantumTrail, miniWings, etc. (add later)

    // spikedShell: slow effect timer
    if (snail.spikedShellSlowTimer > 0) {
        snail.spikedShellSlowTimer -= dt;
        if (snail.spikedShellSlowTimer <= 0) {
            snail.spikedShellSlowTimer = 0;
            showAlert('Spiked Shell: Speed restored.', 'info');
        }
    }

    // --- TurboGlands mutation ---
    // turboGlands: turbo lasts 20% longer
    if (snail.unlockedMutations.includes('turboGlands')) {
        if (snail.turboActive && snail.turboTimer > 0) {
            snail.turboTimer += dt * 0.2; // extend turbo duration by 20%
        }
    }

    // Hazard timer logic
    if (!window.lastHazardTime) window.lastHazardTime = performance.now();
    let elapsed = (performance.now() - window.lastHazardTime) / 1000;
    hazardTimer = Math.max(0, hazardInterval - elapsed);

    // Always spawn hazard when timer reaches zero
    if (hazardTimer <= 0 && !bossHazardActive) {
        hazardCount++;
        if (hazardCount % 5 === 0) {
            spawnBossHazard();
        } else {
            spawnHazard();
        }
        window.lastHazardTime = performance.now();
        hazardInterval = getRandomHazardInterval();
        hazardTimer = hazardInterval;
    }

    // Boss hazard effect timer
    if (bossHazardActive && currentBossHazard) {
        if (!currentBossHazard.endTime) {
            currentBossHazard.endTime = performance.now() + currentBossHazard.duration;
        }
        if (performance.now() > currentBossHazard.endTime) {
            bossHazardActive = false;
            currentBossHazard = null;
        }
    }

    if (snail.turboActive) {
        snail.turboTimer -= dt;
        if (snail.turboTimer <= 0) {
            snail.turboActive = false;
        }
    }

    // Check for hazard collisions/effects
    hazards.forEach(hazard => {
        if (!hazard.active) return;
        if (Math.abs(snail.distance - hazard.x) < 50) {
            applyHazardEffect(hazard);
            hazard.active = false;
        }
    });

    // Handle hazard effect timers
    clearExpiredHazardEffects();

    // Checkpoint logic
    snail.checkpoint = Math.floor(snail.distance / checkpointDistance);
    // Level logic
    snail.level = Math.floor(snail.distance / 1000) + 1;

    // Challenge progress (live update)
    let changed = false;
    // Daily
    snail.dailyChallenges.forEach((ch, i) => {
        if (snail.dailyComplete[i]) return;
        switch (ch.id) {
            case 'collectSlimeDaily':
                if (snail.slimePoints > snail.dailyProgress[i]) {
                    snail.dailyProgress[i] = Math.min(snail.slimePoints, ch.goal);
                    if (snail.dailyProgress[i] >= ch.goal) {
                        snail.dailyComplete[i] = true;
                        snail.slimePoints += 5000;
                        showAlert('Daily challenge complete! +5000 slime', 'success');
                    }
                    changed = true;
                }
                break;
            case 'reachDistanceDaily':
                if (snail.distance > snail.dailyProgress[i]) {
                    snail.dailyProgress[i] = Math.min(snail.distance, ch.goal);
                    if (snail.dailyProgress[i] >= ch.goal) {
                        snail.dailyComplete[i] = true;
                        snail.slimePoints += 5000;
                        showAlert('Daily challenge complete! +5000 slime', 'success');
                    }
                    changed = true;
                }
                break;
            case 'prestigeDaily':
                if (snail.prestige > snail.dailyProgress[i]) {
                    snail.dailyProgress[i] = Math.min(snail.prestige, ch.goal);
                    if (snail.dailyProgress[i] >= ch.goal) {
                        snail.dailyComplete[i] = true;
                        snail.slimePoints += 5000;
                        showAlert('Daily challenge complete! +5000 slime', 'success');
                    }
                    changed = true;
                }
                break;
            case 'unlockMutationDaily':
                if (snail.unlockedMutations.length > snail.dailyProgress[i]) {
                    snail.dailyProgress[i] = Math.min(snail.unlockedMutations.length, ch.goal);
                    if (snail.dailyProgress[i] >= ch.goal) {
                        snail.dailyComplete[i] = true;
                        snail.slimePoints += 5000;
                        showAlert('Daily challenge complete! +5000 slime', 'success');
                    }
                    changed = true;
                }
                break;
        }
    });
    // Weekly
    snail.weeklyChallenges.forEach((ch, i) => {
        if (snail.weeklyComplete[i]) return;
        switch (ch.id) {
            case 'collectSlimeWeekly':
                if (snail.slimePoints > snail.weeklyProgress[i]) {
                    snail.weeklyProgress[i] = Math.min(snail.slimePoints, ch.goal);
                    if (snail.weeklyProgress[i] >= ch.goal) {
                        snail.weeklyComplete[i] = true;
                        snail.slimePoints += 25000;
                        showAlert('Weekly challenge complete! +25000 slime', 'success');
                    }
                    changed = true;
                }
                break;
            case 'reachDistanceWeekly':
                if (snail.distance > snail.weeklyProgress[i]) {
                    snail.weeklyProgress[i] = Math.min(snail.distance, ch.goal);
                    if (snail.weeklyProgress[i] >= ch.goal) {
                        snail.weeklyComplete[i] = true;
                        snail.slimePoints += 25000;
                        showAlert('Weekly challenge complete! +25000 slime', 'success');
                    }
                    changed = true;
                }
                break;
            case 'prestigeWeekly':
                if (snail.prestige > snail.weeklyProgress[i]) {
                    snail.weeklyProgress[i] = Math.min(snail.prestige, ch.goal);
                    if (snail.weeklyProgress[i] >= ch.goal) {
                        snail.weeklyComplete[i] = true;
                        snail.slimePoints += 25000;
                        showAlert('Weekly challenge complete! +25000 slime', 'success');
                    }
                    changed = true;
                }
                break;
            case 'unlockMutationWeekly':
                if (snail.unlockedMutations.length > snail.weeklyProgress[i]) {
                    snail.weeklyProgress[i] = Math.min(snail.unlockedMutations.length, ch.goal);
                    if (snail.weeklyProgress[i] >= ch.goal) snail.weeklyComplete[i] = true;
                    changed = true;
                }
                break;
        }
    });
    if (changed) saveGame();
    // Remove expired hazards
    hazards = hazards.filter(h => h.active !== false);

    // Remove currentHazard if effect is over
    if (currentHazard && performance.now() - currentHazard.created > currentHazard.duration) {
        currentHazard = null;
    }
}
