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
};
let username = '';

const scenery = [
    { name: "Garden", color: "#6ab04c" },
    { name: "Sidewalk", color: "#bdc3c7" },
    { name: "Desert", color: "#f9ca24" },
    { name: "Neon City", color: "#4834d4" },
    { name: "Outer Space", color: "#130f40" }
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
    { id: 'turboSlime', name: "Turbo Slime", baseCost: 2500, cost: 2500, purchased: 0, desc: "Doubles speed for 60 seconds.", action: () => { if (!snail.turboActive) { snail.turboActive = true; snail.turboTimer = 60000; } } },
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
    }
    if (snail.turboActive) {
        snail.turboTimer -= dt;
        if (snail.turboTimer <= 0) {
            snail.turboActive = false;
        }
    }
    // Checkpoint logic
    snail.checkpoint = Math.floor(snail.distance / checkpointDistance);
    // Level logic
    snail.level = Math.floor(snail.distance / 1000) + 1;
}

function updateUI() {
    document.getElementById('distance').innerText = `Distance: ${snail.distance.toFixed(2)} m`;
    document.getElementById('slimePoints').innerText = `Slime: ${Math.floor(snail.slimePoints)}`;
    let sceneryIndex = Number.isFinite(snail.checkpoint) && snail.checkpoint >= 0 ? snail.checkpoint % scenery.length : 0;
    let checkpointName = (scenery[sceneryIndex] && scenery[sceneryIndex].name) ? scenery[sceneryIndex].name : scenery[0].name;
    document.getElementById('checkpoint').innerText = `Checkpoint: ${checkpointName}`;
    document.getElementById('prestige').innerText = `Prestige: ${snail.prestige > 0 ? toRoman(snail.prestige) : ''}`;
    document.getElementById('mutations').innerText = 'Mutations: ' + (snail.mutations.length ? snail.mutations.join(', ') : 'None');
    // Turbo Slime activation counter
    const turboInfo = snail.turboActive ? `Turbo Slime: ${Math.ceil(snail.turboTimer/1000)}s left` : 'Turbo Slime: Ready';
    if (document.getElementById('turboInfo')) {
        document.getElementById('turboInfo').innerText = turboInfo;
    } else {
        const infoPanel = document.getElementById('info-panel');
        const turboDiv = document.createElement('div');
        turboDiv.id = 'turboInfo';
        turboDiv.className = 'info';
        turboDiv.innerText = turboInfo;
        infoPanel.insertBefore(turboDiv, document.getElementById('hazards'));
    }
    const currentCost = getPrestigeCost();
    document.getElementById('prestigeBtn').disabled = !(snail.level >= 120 && snail.slimePoints >= currentCost);
    document.getElementById('prestigeBtn').innerHTML = `Prestige: <span style='color:#ffd700'>${snail.prestige > 0 ? toRoman(snail.prestige) : 'I'}</span><br><span style='font-size:0.85em'>Requirements:</span><br><span style='font-size:0.75em'>Cost: <span style='color:#ffd700'>${currentCost}</span>, Level: <span style='color:#ffd700'>120+</span></span>`;
    upgradeDefs.forEach(upg => {
        const btn = document.getElementById(upg.id);
        btn.innerText = `${upg.name} (${upg.cost} Slime)`;
        btn.disabled = snail.slimePoints < upg.cost || (upg.id === 'turboSlime' && snail.turboActive);
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
    leaderboardTimer = 30;
    document.getElementById('leaderboard-timer').innerText = leaderboardTimer;
}
setInterval(() => {
    leaderboardTimer--;
    if (leaderboardTimer <= 0) {
        updateLeaderboard();
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
    updateLeaderboard();
    // Restore upgrade button click handlers
    upgradeDefs.forEach(upg => {
        const btn = document.getElementById(upg.id);
        btn.onclick = () => {
            if (snail.slimePoints >= upg.cost && !(upg.id === 'turboSlime' && snail.turboActive)) {
                snail.slimePoints -= upg.cost;
                upg.purchased = (upg.purchased || 0) + 1;
                upg.action();
                // Exponential scaling for all upgrades
                upg.cost = Math.floor(upg.baseCost * Math.pow(1.25, upg.purchased));
                updateUI();
                showAlert(`Upgraded: ${upg.name}!`, 'success');
                saveGame(); // Save immediately after upgrade
            } else {
                showAlert('Not enough slime or turbo already active!', 'error');
            }
        };
    });
});

requestAnimationFrame(gameLoop);

function drawGame() {
    // Defensive: fallback to first scenery if checkpoint is invalid
    let sceneryIndex = Number.isFinite(snail.checkpoint) && snail.checkpoint >= 0 ? snail.checkpoint % scenery.length : 0;
    let currentScenery = scenery[sceneryIndex] || scenery[0];
    ctx.fillStyle = currentScenery.color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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
    // Prestige 0: walk, 1: walk2, ..., 4: walk5, 5+: walk6
    const spriteMap = [snailSprites.walk, snailSprites.walk2, snailSprites.walk3, snailSprites.walk4, snailSprites.walk5, snailSprites.walk6];
    sprite = snail.prestige >= 5 ? snailSprites.walk6 : spriteMap[snail.prestige];
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