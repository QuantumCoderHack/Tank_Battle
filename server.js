const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { exec } = require("child_process");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const MAP_WIDTH = 1280;
const MAP_HEIGHT = 720;

app.use(express.static("public"));

let players = {};
let bullets = [];

 const colors = ["blue", "green", "red", "purple", "orange", "yellow","black","purple","aqua","white"];

io.on("connection", (socket) => {

    // 🔥 Random renk ve random spawn
    socket.emit("update", { players, bullets });

    // Random renk ve random spawn
   const spawnX = Math.floor(Math.random() * MAP_WIDTH);
    const spawnY = Math.floor(Math.random() * MAP_HEIGHT);
    const color = colors[Math.floor(Math.random() * colors.length)];

    players[socket.id] = {
        x: spawnX,
        y: spawnY,
        angle: 0,
        ammo: 10,
        maxAmmo: 10,
        reloading: false,
        color: color,
        health: 100,
        maxHealth: 100
    };

    // Sonrasında tüm client'lara yeni oyuncuyu bildir
    io.emit("update", { players, bullets });

    // HAREKET
    socket.on("move", (data) => {
        let p = players[socket.id];
        if (!p) return;

        p.x += data.x;
        p.y += data.y;

        if (p.x < 0) p.x = 0;
        if (p.y < 0) p.y = 0;
        if (p.x > MAP_WIDTH) p.x = MAP_WIDTH;
        if (p.y > MAP_HEIGHT) p.y = MAP_HEIGHT;
    });

    // NİŞAN
    socket.on("aim", (angle) => {
        let p = players[socket.id];
        if (!p) return;

        p.angle = angle;
    });

    // ATEŞ
    socket.on("shoot", () => {
        let p = players[socket.id];
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
        let p = players[socket.id];
        if (!p || p.reloading || p.ammo === p.maxAmmo) return;

        p.reloading = true;
        setTimeout(() => {
            let p = players[socket.id];
            if (!p) return;
            p.ammo = p.maxAmmo;
            p.reloading = false;
        }, 1000);
    });

    // ÇIKIŞ
     socket.on("disconnect", () => {
        delete players[socket.id];
        bullets = bullets.filter(b => b.owner !== socket.id);
    });
});

// OYUN LOOP
setInterval(() => {

 // BULLET LOOP içinde can düşme
bullets.forEach((b, i) => {
    b.x += Math.cos(b.angle) * 5;
    b.y += Math.sin(b.angle) * 5;

    if (b.x < 0 || b.y < 0 || b.x > MAP_WIDTH || b.y > MAP_HEIGHT) {
        bullets.splice(i, 1);
        return;
    }

    for (let id in players) {
        let p = players[id];
        if (!p) continue;
        if (b.owner === id) continue;

        let dx = p.x - b.x;
        let dy = p.y - b.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 15) {
            p.health -= 10;

            if (p.health <= 0) {
                // 0 altına düştü, oyundan çıkar ve client’a mesaj gönder
                io.to(id).emit("gameOver");
                delete players[id];

                // mermileri de temizle
                bullets = bullets.filter(bullet => bullet.owner !== id);
            }

            bullets.splice(i, 1);
            break;
        }
    }
});

    io.emit("update", { players, bullets });

}, 50);

// SERVER BAŞLAT
server.listen(3000, () => {
    console.log("Server çalışıyor: http://localhost:3000");
    exec("start http://localhost:3000");
});