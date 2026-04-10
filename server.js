const express = require("express");
const http = require("http");
const { Server } = require("socket.io");


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

  
    socket.emit("update", { players, bullets });

   
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

  
    io.emit("update", { players, bullets });


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

    
    socket.on("aim", (angle) => {
        let p = players[socket.id];
        if (!p) return;

        p.angle = angle;
    });

   
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

   
     socket.on("disconnect", () => {
        delete players[socket.id];
        bullets = bullets.filter(b => b.owner !== socket.id);
    });
});


setInterval(() => {


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
            
                io.to(id).emit("gameOver");
                delete players[id];

                
                bullets = bullets.filter(bullet => bullet.owner !== id);
            }

            bullets.splice(i, 1);
            break;
        }
    }
});

    io.emit("update", { players, bullets });

}, 50);
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("Server çalışıyor, port: " + PORT);
});
