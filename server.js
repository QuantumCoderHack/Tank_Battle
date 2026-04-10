const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// ✅ Render + CORS güvenli Socket.IO
const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

const MAP_WIDTH = 1280;
const MAP_HEIGHT = 720;

app.use(express.static("public"));

let players = {};
let bullets = [];

const colors = ["blue", "green", "red", "purple", "orange", "yellow", "black", "aqua", "white"];

io.on("connection", (socket) => {

    // ilk veri gönderimi
    socket.emit("update", { players, bullets });

    // spawn
    const spawnX = Math.floor(Math.random() * MAP_WIDTH);
    const spawnY = Math.floor(Math.random() * MAP_HEIGHT);
    const color = colors[Math.floor(Math.random() * colors.length)];

    players[socket.id] = {
        x: spawnX,
        y: spawnY,
        angle: 0,
        ammo: 10,
        maxAmmo: 10,
        lastShot: 0,
        reloading: false,
        color,
        health: 100,
        maxHealth: 100
    };

    io.emit("update", { players, bullets });

    // MOVE
    socket.on("move", (data) => {
        const p = players[socket.id];
        if (!p) return;

        p.x += data.x;
        p.y += data.y;

        if (p.x < 0) p.x = 0;
        if (p.y < 0) p.y = 0;
        if (p.x > MAP_WIDTH) p.x = MAP_WIDTH;
        if (p.y > MAP_HEIGHT) p.y = MAP_HEIGHT;
    });

    // AIM
    socket.on("aim", (angle) => {
        const p = players[socket.id];
        if (!p) return;
        p.angle = angle;
    });

    // SHOOT
    socket.on("shoot", () => {
        const p = players[socket.id];
        if (!p || p.reloading || p.ammo <= 0) return;

        p.ammo--;

        bullets.push({
            x: p.x,
            y: p.y,
            angle: p.angle,
            owner: socket.id
        });
    });

    // RELOAD
    socket.on("reload", () => {
        const p = players[socket.id];
        if (!p || p.reloading || p.ammo === p.maxAmmo) return;

        p.reloading = true;

        setTimeout(() => {
            const p2 = players[socket.id];
            if (!p2) return;
            p2.ammo = p2.maxAmmo;
            p2.reloading = false;
        }, 1000);
    });

    // DISCONNECT
    socket.on("disconnect", () => {
        delete players[socket.id];
        bullets = bullets.filter(b => b.owner !== socket.id);
    });
});


// 🔥 SAFE GAME LOOP (splice bug fix dahil düzeltildi)
setInterval(() => {

    // bullets güvenli update (reverse loop → crash fix)
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];

        b.x += Math.cos(b.angle) * 5;
        b.y += Math.sin(b.angle) * 5;

        // sınır dışı
        if (b.x < 0 || b.y < 0 || b.x > MAP_WIDTH || b.y > MAP_HEIGHT) {
            bullets.splice(i, 1);
            continue;
        }

        for (let id in players) {
            const p = players[id];
            if (!p) continue;
            if (b.owner === id) continue;

            const dx = p.x - b.x;
            const dy = p.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 15) {
                p.health -= 10;

                if (p.health <= 0) {
                    io.to(id).emit("gameOver");
                    delete players[id];
                    bullets = bullets.filter(bb => bb.owner !== id);
                }

                bullets.splice(i, 1);
                break;
            }
        }
    }

    io.emit("update", { players, bullets });

}, 50);


// 🔥 RENDER FIX: 0.0.0.0 binding zorunlu
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
    console.log("Server çalışıyor, port:", PORT);
});
