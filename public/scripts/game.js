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
};
let username = '';

// --- Hazards ---
// --- Mutations ---
const mutationDefs = [
    { id: 'radioactiveShell', name: 'Radioactive Shell', desc: 'Immune to one hazard per run.' },
    { id: 'regenerativeSlime', name: 'Regenerative Slime', desc: 'Heals from hazard effects over time.' },
    { id: 'magnetAntennae', name: 'Magnet Antennae', desc: 'Attracts slime points from a wider area.' },
    { id: 'camouflageSkin', name: 'Camouflage Skin', desc: 'Chance to avoid hazards automatically.' },
    { id: 'turboGlands', name: 'Turbo Glands', desc: 'Turbo lasts 20% longer.' },
    { id: 'spikedShell', name: 'Spiked Shell', desc: 'Destroys hazards on contact, but slightly slower.' },
    { id: 'doubleEyes', name: 'Double Eyes', desc: 'Reveals upcoming hazards briefly.' },
    { id: 'stickyFoot', name: 'Sticky Foot', desc: 'Immune to slide effects.' },
    { id: 'miniWings', name: 'Mini Wings', desc: 'Jump over one hazard every minute.' },
    { id: 'quantumTrail', name: 'Quantum Trail', desc: 'Occasionally teleports forward.' },
    { id: 'crystalShell', name: 'Crystal Shell', desc: 'Bonus slime from checkpoints.' },
    { id: 'fireSlime', name: 'Fire Slime', desc: 'Burns away sticky hazards.' },
    { id: 'frostAntennae', name: 'Frost Antennae', desc: 'Slows down hazards near you.' },
    { id: 'electricPulse', name: 'Electric Pulse', desc: 'Stuns hazards for a short time.' },
    { id: 'luckyCharm', name: 'Lucky Charm', desc: 'Higher chance for rare hazards to drop bonuses.' },
    { id: 'ironShell', name: 'Iron Shell', desc: 'Reduces damage from hazards.' },
    { id: 'slimeMagnet', name: 'Slime Magnet', desc: 'Doubles slime pickup for 10 seconds after hazard.' },
    { id: 'shadowCloak', name: 'Shadow Cloak', desc: 'Invisible to hazards for a few seconds after turbo.' },
    { id: 'bouncyFoot', name: 'Bouncy Foot', desc: 'Hazards bounce off you, but you lose a bit of speed.' },
    { id: 'timeDilation', name: 'Time Dilation', desc: 'Slows down hazard timer occasionally.' }
];

// Mutation Book logic (same as Hazard Book)
window.showMutationBook = function() {
    const mutationBookMenu = document.getElementById('mutation-book-menu');
    const mutationBookList = document.getElementById('mutation-book-list');
    mutationBookMenu.style.display = 'block';
    mutationBookList.innerHTML = '';
    // Color palette for mutation titles
    const colors = [
        '#ffb300', '#00bcd4', '#8bc34a', '#e91e63', '#9c27b0', '#ff5722', '#03a9f4', '#cddc39', '#f44336', '#009688',
        '#ffc107', '#673ab7', '#4caf50', '#ff9800', '#2196f3', '#607d8b', '#795548', '#00e676', '#e040fb', '#d50000'
    ];
    mutationDefs.forEach((mut, i) => {
        const div = document.createElement('div');
        const unlocked = snail.unlockedMutations && snail.unlockedMutations.includes(mut.id);
        div.className = unlocked ? 'mutation-unlocked' : 'mutation-locked';
        div.style = 'margin-bottom:0;padding:8px 8px;border-radius:8px;min-width:0;word-break:break-word;font-size:13px;';
        const color = colors[i % colors.length];
        if (unlocked) {
            div.innerHTML = `<b style='color:${color};'>${mut.name}</b><br><span style='font-size:12px;'>${mut.desc}</span>`;
        } else {
            div.innerHTML = `<b style='color:${color};'>${mut.name}</b><br><span style='font-size:12px;color:#ccc;'>${mut.desc}</span><br><span style='font-size:11px;color:#ff4444;'>Locked</span>`;
        }
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
        // Always allow stacking: add 60s to turbo timer, activate if not active
        if (!snail.turboActive) {
            snail.turboActive = true;
            snail.turboTimer = 60000;
        } else {
            snail.turboTimer += 60000;
        }
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
    }
}

// --- Game Loop ---
function gameLoop(now) {
    let dt = now - lastTime;
    lastTime = now;
    // Speed up animation if turbo is active
    frameTimer += dt;
    let turbo = snail.turboActive;
    let turboSpeed = turbo ? 80 : 200; // 80ms per frame if turbo
    if (frameTimer > turboSpeed) {
        frame = (frame + 1) % 3;
        frameTimer = 0;
    }
    updateSnail(dt);
    updateUI();
    drawGame();
    requestAnimationFrame(gameLoop);
}

function getPrestigeCost() {
    return Math.floor(12000 * Math.pow(1.75, snail.prestige));
}

document.getElementById('prestigeBtn').onclick = () => {
    const currentCost = getPrestigeCost();
    if (snail.level >= 120 && snail.slimePoints >= currentCost) {
        prestige();
    } else if (snail.level < 120) {
        showAlert('Reach level 120 to prestige!', 'error');
    } else if (snail.slimePoints < currentCost) {
        showAlert('Not enough slime to prestige!', 'error');
    }
};

const prestigeCost = 10000;
function prestige() {
    const currentCost = getPrestigeCost();
    if (snail.level >= 120 && snail.slimePoints >= currentCost) {
        snail.prestige++;
        // Permanent boosts
        const baseSpeed = 1 + snail.prestige * 0.2;
        const baseEfficiency = 1 + snail.prestige * 0.1;
        // Reset all stats except prestige and skin
        snail.distance = 0;
        snail.slimePoints = 0;
        snail.speed = baseSpeed;
        snail.slimeEfficiency = baseEfficiency;
        snail.trailBoosters = 1;
        snail.isMoving = true;
        snail.turboActive = false;
        snail.turboTimer = 0;
        snail.checkpoint = 0;
        snail.mutations = [];
        snail.level = 1;
        // Reset upgrades
        upgradeDefs.forEach(upg => {
            upg.purchased = 0;
            upg.cost = upg.baseCost;
        });
        // Change snail sprite
        snail.skin = snail.prestige % 2;
        showAlert('Prestige! Permanent boost unlocked!', 'success');
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

function updateSnail(dt) {
    if (snail.isMoving) {
        let speed = snail.speed;
        if (snail.turboActive) speed *= 2;
        snail.distance += speed * snail.slimeEfficiency * (dt / 1000);
        snail.slimePoints += speed * snail.slimeEfficiency * (dt / 1000);
        // Hazard spawn timer
        if (!window.lastHazardTime) window.lastHazardTime = performance.now();
        let elapsed = (performance.now() - window.lastHazardTime) / 1000;
        hazardTimer = Math.max(0, hazardInterval - elapsed);
        if (elapsed >= hazardInterval) {
            spawnHazard();
            window.lastHazardTime = performance.now();
            hazardInterval = getRandomHazardInterval(); // Set next interval randomly
            hazardTimer = hazardInterval;
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
        // Simple collision: if snail is near hazard x
        if (Math.abs(snail.distance - hazard.x) < 50) {
            applyHazardEffect(hazard);
            currentHazard = hazard; // Track for timer display
            hazard.active = false;
        }
    });
    // Checkpoint logic
    snail.checkpoint = Math.floor(snail.distance / checkpointDistance);
    // Level logic
    snail.level = Math.floor(snail.distance / 1000) + 1;
    // Remove expired hazards
    hazards = hazards.filter(h => h.active !== false);
    // Remove currentHazard if effect is over
    if (currentHazard && performance.now() - currentHazard.created > currentHazard.duration) {
        currentHazard = null;
    }
}

function spawnHazard() {
    const type = hazardTypes[Math.floor(Math.random()*hazardTypes.length)];
    const hazardObj = {
        type: type.type,
        name: type.name,
        color: type.color,
        effect: type.effect,
        x: snail.distance + 300 + Math.random()*200,
        active: true,
        created: performance.now(),
        duration: 12000 + Math.random()*6000 // Effects now last 12-18 seconds for more impact
    };
    hazards.push(hazardObj);
    showAlert(`${type.name} spawned!`, 'info'); // Alert for hazard spawn
}

function applyHazardEffect(hazard) {
    switch(hazard.type) {
        case 'salt':
            snail.speed *= 0.5;
            showAlert('Salt Patch! Slowed down!', 'error');
            setTimeout(() => { snail.speed /= 0.5; }, hazard.duration);
            break;
        case 'bird':
            snail.isMoving = false;
            showAlert('Bird Attack! Stopped!', 'error');
            setTimeout(() => { snail.isMoving = true; }, hazard.duration);
            break;
        case 'puddle':
            snail.distance += 120;
            showAlert('Puddle! Slid forward!', 'info');
            break;
        case 'pebble':
            snail.isMoving = false;
            showAlert('Pebble! Blocked!', 'error');
            setTimeout(() => { snail.isMoving = true; }, hazard.duration);
            break;
        case 'ants':
            snail.speed *= 0.7;
            showAlert('Ant Swarm! Slowed!', 'error');
            setTimeout(() => { snail.speed /= 0.7; }, hazard.duration);
            break;
        case 'gum':
            snail.isMoving = false;
            showAlert('Sticky Gum! Wiggle free!', 'error');
            setTimeout(() => { snail.isMoving = true; }, hazard.duration);
            break;
        case 'shadow':
            snail.speed *= 0.6;
            showAlert('Shadow Hand! Slowed!', 'error');
            setTimeout(() => { snail.speed /= 0.6; }, hazard.duration);
            break;
        case 'wind':
            snail.distance -= 80;
            showAlert('Wind Gust! Pushed back!', 'error');
            break;
        case 'oil':
            snail.distance += (Math.random() > 0.5 ? 60 : -60);
            showAlert('Oil Spill! Swerved!', 'info');
            break;
        case 'laser':
            snail.isMoving = false;
            showAlert('Laser Fence! Wait to cross!', 'error');
            setTimeout(() => { snail.isMoving = true; }, hazard.duration);
            break;
    }
}

function updateUI() {
    document.getElementById('distance').innerText = `Distance: ${snail.distance.toFixed(2)} m`;
    document.getElementById('slimePoints').innerText = `Slime: ${Math.floor(snail.slimePoints)}`;
    let sceneryIndex = Number.isFinite(snail.checkpoint) && snail.checkpoint >= 0 ? snail.checkpoint % scenery.length : 0;
    let checkpointName = (scenery[sceneryIndex] && scenery[sceneryIndex].name) ? scenery[sceneryIndex].name : scenery[0].name;
    document.getElementById('checkpoint').innerText = `Checkpoint: ${checkpointName}`;
    document.getElementById('prestige').innerText = `Prestige: ${toRoman(snail.prestige)}`;
    document.getElementById('mutations').innerText = 'Mutations: ' + (snail.mutations.length ? snail.mutations.join(', ') : 'None');
    // Remove Turbo Slime info from info panel
    const turboDiv = document.getElementById('turboInfo');
    if (turboDiv) turboDiv.remove();
    const currentCost = getPrestigeCost();
    document.getElementById('prestigeBtn').disabled = !(snail.level >= 120 && snail.slimePoints >= currentCost);
    document.getElementById('prestigeBtn').innerHTML = `Prestige: <span style='color:#ffd700'>${toRoman(snail.prestige + 1)}</span><br><span style='font-size:0.85em'>Requirements:</span><br><span style='font-size:0.75em'>Cost: <span style='color:#ffd700'>${currentCost}</span>, Level: <span style='color:#ffd700'>120+</span></span>`;
    // Hazard timer UI
    const hazardTimerDiv = document.getElementById('hazard-timer');
    if (hazardTimerDiv) {
    hazardTimerDiv.innerText = `Next Hazard in: ${Math.ceil(hazardTimer)}s`;
    }
    upgradeDefs.forEach(upg => {
        const btn = document.getElementById(upg.id);
        btn.innerText = `${upg.name} (${upg.cost} Slime)`;
        // Only disable if not enough slime
        btn.disabled = snail.slimePoints < upg.cost;
        // Add hover description
        btn.title = upg.desc;
    });
}

// --- Leaderboard ---
let leaderboardTimer = 30;
function toRoman(num) {
    if (num <= 0) return '';
    const romans = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];
    return romans[num-1] || num;
}

function updateLeaderboard() {
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
    // Only update timer display, do not reset timer here
    document.getElementById('leaderboard-timer').innerText = leaderboardTimer;
}
setInterval(() => {
    leaderboardTimer--;
    if (leaderboardTimer <= 0) {
        updateLeaderboard();
        leaderboardTimer = 30;
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
        }
    });
}

// Save game every 10 seconds
setInterval(saveGame, 10000);

// Prompt for username on load
window.addEventListener('DOMContentLoaded', () => {

    promptUsername();
    // Do not call updateLeaderboard here, only refresh on timer
    // Restore upgrade button click handlers
        // Hazard Book logic
        const hazardBookBtn = document.getElementById('open-hazard-book');
        const hazardBookMenu = document.getElementById('hazard-book-menu');
        const hazardBookList = document.getElementById('hazard-book-list');
        const closeHazardBookBtn = document.getElementById('close-hazard-book');

        hazardBookBtn.onclick = () => {
            hazardBookMenu.style.display = 'block';
            hazardBookList.innerHTML = hazardTypes.map(h => `
                <div style="margin-bottom:14px;padding:10px 0;border-bottom:1px solid #333;">
                    <span style="font-size:16px;color:${h.color};font-weight:bold;">${h.name}</span><br>
                    <span style="font-size:13px;color:#fff;">${getHazardDescription(h.type)}</span>
                </div>
            `).join('');
        };
        closeHazardBookBtn.onclick = () => {
            hazardBookMenu.style.display = 'none';
        };
    });

    function getHazardDescription(type) {
        switch(type) {
            case 'salt': return 'Slows your snail and drains slime.';
            case 'bird': return 'A bird swoops down and stops you briefly.';
            case 'puddle': return 'Slides your snail forward uncontrollably.';
            case 'pebble': return 'Blocks your path, forcing a short wait.';
            case 'ants': return 'Ants crawl over you, reducing speed.';
            case 'gum': return 'Sticky gum stops you, wiggle free!';
            case 'shadow': return 'A shadow hand slows your progress.';
            case 'wind': return 'Wind gust pushes you backward.';
            case 'oil': return 'Oil spill makes you swerve randomly.';
            case 'laser': return 'Laser fence activates, wait to cross.';
            default: return '';
        }
    }
    upgradeDefs.forEach(upg => {
        const btn = document.getElementById(upg.id);
        btn.onclick = () => {
            if (snail.slimePoints >= upg.cost) {
                snail.slimePoints -= upg.cost;
                upg.purchased = (upg.purchased || 0) + 1;
                upg.action();
                // Exponential scaling for all upgrades
                upg.cost = Math.floor(upg.baseCost * Math.pow(1.25, upg.purchased));
                updateUI();
                showAlert(`Upgraded: ${upg.name}!`, 'success');
                saveGame(); // Save immediately after upgrade
            } else {
                showAlert('Not enough slime!', 'error');
            }
        };
    });
    // Remove duplicate hazard timer creation (now in HTML)
// Removed extra closing bracket to fix syntax error

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
    if (snail.turboActive && snail.turboTimer > 0) {
        ctx.font = 'bold 18px monospace';
        ctx.fillStyle = '#00e676';
        ctx.fillText(`Turbo: ${Math.ceil(snail.turboTimer/1000)}s`, canvas.width/2, canvas.height/2 - 90);
    }
    // Draw hazard effect timer above turbo counter if active
    if (currentHazard && performance.now() - currentHazard.created < currentHazard.duration) {
        const timeLeft = Math.ceil((currentHazard.duration - (performance.now() - currentHazard.created))/1000);
        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = '#e74c3c';
        ctx.fillText(`Hazard: ${currentHazard.name} (${timeLeft}s)`, canvas.width/2, canvas.height/2 - 115);
    }
    ctx.restore();

    // Snail animation (walk, walk2, walk3, walk4, walk5, walk6 based on prestige)
    // Prestige 0: walk, 1: walk2, 2: walk3, ..., 6+: walk6
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
}