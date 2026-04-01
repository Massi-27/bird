import React, { useEffect, useRef, useState } from "react";

export default function StickmanWebApp() {
  const [selectedColor, setSelectedColor] = useState(null);
  const [name, setName] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Enter" && selectedColor && name.trim()) {
        setReady(true);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedColor, name]);

  if (!ready) {
    const options = [
      { name: "Nero", color: "#111111" },
      { name: "Blu", color: "#2563eb" },
      { name: "Rosso", color: "#dc2626" },
    ];

    return (
      <div className="fixed inset-0 bg-neutral-100 flex items-center justify-center px-6">
        <div className="w-full max-w-4xl">
          <h1 className="text-3xl font-semibold text-center text-neutral-800 mb-3">
            Scegli il personaggio
          </h1>
          <p className="text-center text-neutral-500 mb-6">
            Inserisci un nome e seleziona uno stickman
          </p>

          <div className="mb-8 flex justify-center">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome dello stickman"
              className="w-full max-w-md px-4 py-3 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-400"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {options.map((option) => {
              const selected = selectedColor === option.color;
              return (
                <button
                  key={option.name}
                  onClick={() => setSelectedColor(option.color)}
                  className={`bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition text-left ${
                    selected ? "border-2 border-black" : "border-neutral-300"
                  }`}
                >
                  <div className="w-full h-40 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-center mb-4">
                    <svg width="90" height="110" viewBox="0 0 90 110" fill="none">
                      <circle cx="45" cy="20" r="10" stroke={option.color} strokeWidth="4" />
                      <line x1="45" y1="30" x2="45" y2="66" stroke={option.color} strokeWidth="4" strokeLinecap="round" />
                      <line x1="45" y1="42" x2="28" y2="56" stroke={option.color} strokeWidth="4" strokeLinecap="round" />
                      <line x1="45" y1="42" x2="62" y2="56" stroke={option.color} strokeWidth="4" strokeLinecap="round" />
                      <line x1="45" y1="66" x2="32" y2="98" stroke={option.color} strokeWidth="4" strokeLinecap="round" />
                      <line x1="45" y1="66" x2="58" y2="98" stroke={option.color} strokeWidth="4" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="text-xl font-medium text-neutral-800 mb-1">
                    Stickman {option.name}
                  </div>
                  <div className="text-sm text-neutral-500">Clicca per selezionare</div>
                </button>
              );
            })}
          </div>

          <p className="text-center text-neutral-600">
            Premi <span className="font-semibold">Enter</span> per iniziare
          </p>
        </div>
      </div>
    );
  }

  return <GameScreen stickmanColor={selectedColor} playerName={name} />;
}

function GameScreen({ stickmanColor, playerName }) {
  const canvasRef = useRef(null);
  const keysRef = useRef({ left: false, right: false, jump: false, run: false });
  const stateRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const projectilesRef = useRef([]);
  const birdsRef = useRef([]);
  const scoreRef = useRef(0);
  const fireCooldownRef = useRef(0);
  const birdSpawnTimerRef = useRef(50);

  const timeRef = useRef(0);
  const pausedRef = useRef(false);
  const angerClicksRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (stateRef.current) {
        const groundY = canvas.height - 90;
        if (stateRef.current.y > groundY) {
          stateRef.current.y = groundY;
          stateRef.current.vy = 0;
        }
      }
    };

    const state = {
      x: 140,
      y: 0,
      vx: 0,
      vy: 0,
      speed: 0.7,
      runSpeed: 1.15,
      maxSpeed: 6,
      maxRunSpeed: 10,
      jumpStrength: 14,
      gravity: 0.7,
      friction: 0.82,
      facing: 1,
      step: 0,
      crouch: 0,
      life: 100,
      maxLife: 100,
    };
    stateRef.current = state;

    resize();

    const getGroundY = () => canvas.height - 90;

    const getMuzzle = () => ({
      x: state.x + state.facing * 22,
      y: Math.min(state.y - 46, getGroundY() - 46),
    });

    const spawnProjectile = (targetX, targetY) => {
      const muzzle = getMuzzle();
      const dx = targetX - muzzle.x;
      const dy = targetY - muzzle.y;
      const len = Math.hypot(dx, dy) || 1;
      const speed = 11;

      projectilesRef.current.push({
        x: muzzle.x,
        y: muzzle.y,
        vx: (dx / len) * speed,
        vy: (dy / len) * speed,
        width: 16,
        height: 6,
        angle: Math.atan2(dy, dx),
      });
    };

    const createBirdPath = (fromLeft, maxAge, sameSideExit) => {
      const startX = fromLeft ? -40 : canvas.width + 40;

      const exitSide = sameSideExit
        ? (fromLeft ? "left" : "right")
        : (fromLeft ? "right" : "left");

      const endX = exitSide === "left" ? -80 : canvas.width + 80;
      const distanceX = endX - startX;
      const baseVX = distanceX / maxAge;

      return { startX, endX, baseVX, exitSide };
    };

    const spawnBird = () => {
      if (birdsRef.current.length >= 8) return;

      const fromLeft = Math.random() < 0.5;
      const sameSideExit = Math.random() < 0.3;
      const minAge = sameSideExit ? 900 : 600;
      const maxExtra = sameSideExit ? 600 : 600;
      const maxAge = minAge + Math.floor(Math.random() * (maxExtra + 1));
      const { startX, endX, baseVX } = createBirdPath(fromLeft, maxAge, sameSideExit);
      const y = 70 + Math.random() * Math.max(120, canvas.height - 280);

      birdsRef.current.push({
        x: startX,
        y,
        baseY: y,
        vx: baseVX,
        vy: 0,
        flapPhase: Math.random() * Math.PI * 2,
        driftPhase: Math.random() * Math.PI * 2,
        driftSpeed: 0.06 + Math.random() * 0.04,
        driftAmp: 25 + Math.random() * 22,
        jitterTimer: 12 + Math.floor(Math.random() * 35),
        age: 0,
        maxAge,
        exitX: endX,
        size: 1 + Math.random() * 0.25,
      });
    };

    const updateMousePosition = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const triggerAngerPause = () => {
      pausedRef.current = true;
      angerClicksRef.current = [];
    };

    const keyDown = (e) => {
      if (pausedRef.current) {
        if (e.key === "Enter") {
          pausedRef.current = false;
          angerClicksRef.current = [];
        }
        return;
      }

      const key = e.key.toLowerCase();
      if (["arrowleft", "a"].includes(key)) keysRef.current.left = true;
      if (["arrowright", "d"].includes(key)) keysRef.current.right = true;
      if (key === "shift") keysRef.current.run = true;
      if (["arrowup", "w", " "].includes(key) || e.code === "Space") {
        if (!keysRef.current.jump && state.y >= getGroundY()) {
          state.vy = -state.jumpStrength;
        }
        keysRef.current.jump = true;
        e.preventDefault();
      }
    };

    const keyUp = (e) => {
      const key = e.key.toLowerCase();
      if (["arrowleft", "a"].includes(key)) keysRef.current.left = false;
      if (["arrowright", "d"].includes(key)) keysRef.current.right = false;
      if (key === "shift") keysRef.current.run = false;
      if (["arrowup", "w", " "].includes(key) || e.code === "Space") {
        keysRef.current.jump = false;
      }
    };

    const mouseDown = (e) => {
      if (e.button !== 0 || pausedRef.current) return;

      updateMousePosition(e);
      state.facing = mouseRef.current.x >= state.x ? 1 : -1;

      const now = performance.now();
      angerClicksRef.current = [
        ...angerClicksRef.current.filter((t) => now - t < 1000),
        now,
      ];

      if (angerClicksRef.current.length >= 4) {
        triggerAngerPause();
        return;
      }

      if (fireCooldownRef.current <= 0) {
        spawnProjectile(mouseRef.current.x, mouseRef.current.y);
        fireCooldownRef.current = 10;
      }
    };

    const mouseMove = (e) => {
      updateMousePosition(e);
      state.facing = mouseRef.current.x >= state.x ? 1 : -1;
    };

    window.addEventListener("resize", resize);
    window.addEventListener("keydown", keyDown, { passive: false });
    window.addEventListener("keyup", keyUp);
    canvas.addEventListener("mousedown", mouseDown);
    canvas.addEventListener("mousemove", mouseMove);

    const drawStickman = (x, groundY, facing, walkPhase, jumping, speed, crouch, running) => {
      const lean = jumping
        ? 0
        : running
        ? facing * 0.18
        : facing * Math.max(-0.08, Math.min(0.08, speed / 40));
      const crouchPx = jumping ? 10 : crouch * 14;
      const bob = jumping ? -8 : Math.abs(Math.sin(walkPhase)) * (running ? 4 : 3);

      const hipX = x;
      const hipY = groundY - 34 + bob + crouchPx;
      const torsoLen = 34 - crouchPx * 0.35;
      const torsoTopX = hipX + lean * torsoLen;
      const torsoTopY = hipY - torsoLen;
      const headR = 10;
      const headX = torsoTopX + lean * 8;
      const headY = torsoTopY - 16;
      const shoulderX = torsoTopX;
      const shoulderY = torsoTopY + 10;

      const strideBase = running ? 20 : 14;
      const stride = jumping
        ? 4
        : Math.sin(walkPhase) *
          Math.min(strideBase, 6 + Math.abs(speed) * (running ? 1.7 : 1.3));
      const armStride = jumping
        ? 6
        : Math.sin(walkPhase + Math.PI) *
          Math.min(running ? 18 : 12, 5 + Math.abs(speed) * (running ? 1.2 : 1));
      const kneeLiftA =
        jumping ? 10 : Math.max(0, Math.sin(walkPhase)) * (running ? 12 : 8) + crouchPx * 0.6;
      const kneeLiftB =
        jumping ? 10 : Math.max(0, -Math.sin(walkPhase)) * (running ? 12 : 8) + crouchPx * 0.6;

      const legAFootX = hipX + stride;
      const legBFootX = hipX - stride;
      const legAFootY = groundY;
      const legBFootY = groundY;
      const kneeAX = hipX + stride * 0.45;
      const kneeBX = hipX - stride * 0.45;
      const kneeAY = hipY + 15 - kneeLiftA;
      const kneeBY = hipY + 15 - kneeLiftB;

      const armAX = shoulderX - 16 - lean * 6;
      const armBX = shoulderX + 16 - lean * 6;
      const armAY = shoulderY + 18 + armStride * 0.45;
      const armBY = shoulderY + 18 - armStride * 0.45;

      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = stickmanColor;

      ctx.beginPath();
      ctx.arc(headX, headY, headR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(torsoTopX, torsoTopY);
      ctx.lineTo(hipX, hipY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(shoulderX, shoulderY);
      ctx.lineTo(armAX, armAY);
      ctx.moveTo(shoulderX, shoulderY);
      ctx.lineTo(armBX, armBY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(hipX, hipY);
      ctx.lineTo(kneeAX, kneeAY);
      ctx.lineTo(legAFootX, legAFootY);
      ctx.moveTo(hipX, hipY);
      ctx.lineTo(kneeBX, kneeBY);
      ctx.lineTo(legBFootX, legBFootY);
      ctx.stroke();
    };

    const drawBird = (bird) => {
      const wingLift = Math.sin(bird.flapPhase) * 7 * bird.size;
      const width = 12 * bird.size;

      ctx.strokeStyle = "#111";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(bird.x - width, bird.y);
      ctx.quadraticCurveTo(bird.x - width * 0.35, bird.y - wingLift, bird.x, bird.y);
      ctx.quadraticCurveTo(bird.x + width * 0.35, bird.y - wingLift, bird.x + width, bird.y);
      ctx.stroke();
    };

    const drawAimLine = () => {
      const muzzle = getMuzzle();
      const dx = mouseRef.current.x - muzzle.x;
      const dy = mouseRef.current.y - muzzle.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) return;

      const lineLen = Math.min(36, len);
      const endX = muzzle.x + (dx / len) * lineLen;
      const endY = muzzle.y + (dy / len) * lineLen;

      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(muzzle.x, muzzle.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    };

    const drawUi = () => {
      const barX = 20;
      const barY = 20;
      const barW = 220;
      const barH = 22;
      const fillW = (state.life / state.maxLife) * barW;
      const seconds = Math.floor(timeRef.current / 60);

      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(barX, barY, fillW, barH);
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 2;
      ctx.strokeRect(barX, barY, barW, barH);

      ctx.fillStyle = "#222";
      ctx.font = "16px sans-serif";
      ctx.fillText(playerName, 20, 60);
      ctx.font = "14px sans-serif";
      ctx.fillText("HP", barX + 8, barY + 16);
      ctx.fillText(`Time: ${seconds}s`, 20, 84);
      ctx.fillText("Comandi:", 20, 106);
      ctx.fillText("A / D o ← / → = muovi", 20, 128);
      ctx.fillText("Space / ↑ / W = salta", 20, 150);
      ctx.fillText("Shift = corri", 20, 172);
      ctx.fillText("Click sinistro = spara verso il mouse", 20, 194);
      ctx.fillText(`Birds hit: ${scoreRef.current}`, 20, 216);
    };

    const drawAngerOverlay = () => {
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const boxW = Math.min(640, canvas.width - 80);
      const boxH = 180;
      const x = (canvas.width - boxW) / 2;
      const y = (canvas.height - boxH) / 2;

      ctx.fillStyle = "#e5e7eb";
      ctx.fillRect(x, y, boxW, boxH);

      ctx.strokeStyle = "#9ca3af";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, boxW, boxH);

      ctx.fillStyle = "#111";
      ctx.textAlign = "center";
      ctx.font = "bold 30px sans-serif";
      ctx.fillText("ANGER IS THE PATH FOR THE DARK SIDE!!!", canvas.width / 2, y + 78);
      ctx.font = "20px sans-serif";
      ctx.fillText("Press Enter to go back to the game", canvas.width / 2, y + 128);
      ctx.textAlign = "start";
    };

    let raf;
    const loop = () => {
      const k = keysRef.current;
      const groundY = getGroundY();

      if (!pausedRef.current) {
        timeRef.current += 1;

        const halfWidth = 20;
        const onGround = state.y >= groundY;
        const accelerating = k.left || k.right;
        const accel = k.run ? state.runSpeed : state.speed;
        const maxSpeed = k.run ? state.maxRunSpeed : state.maxSpeed;

        if (fireCooldownRef.current > 0) fireCooldownRef.current -= 1;
        if (birdSpawnTimerRef.current > 0) birdSpawnTimerRef.current -= 1;
        if (birdSpawnTimerRef.current <= 0) {
          spawnBird();
          birdSpawnTimerRef.current = 5 + Math.floor(Math.random() * 10);
        }

        if (onGround) {
          const targetCrouch = k.jump && !accelerating ? 1 : 0;
          state.crouch += (targetCrouch - state.crouch) * 0.25;
        } else {
          state.crouch *= 0.85;
        }

        if (k.left) {
          state.vx -= accel;
          state.facing = -1;
        }
        if (k.right) {
          state.vx += accel;
          state.facing = 1;
        }

        state.vx = Math.max(-maxSpeed, Math.min(maxSpeed, state.vx));
        state.vy += state.gravity;
        state.x += state.vx;
        state.y += state.vy;

        if (state.y >= groundY) {
          state.y = groundY;
          state.vy = 0;
        }

        state.vx *= state.friction;
        if (Math.abs(state.vx) < 0.05) state.vx = 0;

        if (state.x < halfWidth) {
          state.x = halfWidth;
          state.vx = 0;
        }
        if (state.x > canvas.width - halfWidth) {
          state.x = canvas.width - halfWidth;
          state.vx = 0;
        }

        if (Math.abs(state.vx) > 0.2 && onGround) {
          state.step += k.run ? 0.28 : 0.18;
        }

        projectilesRef.current = projectilesRef.current
          .map((p) => ({ ...p, x: p.x + p.vx, y: p.y + p.vy }))
          .filter((p) => p.x > -60 && p.x < canvas.width + 60 && p.y > -60 && p.y < canvas.height + 60);

        birdsRef.current = birdsRef.current
          .map((b) => {
            let jitterTimer = b.jitterTimer - 1;
            let vx = b.vx;
            let vy = b.vy;

            if (jitterTimer <= 0) {
              vx += (Math.random() - 0.5) * 2;
              vy += (Math.random() - 0.5) * 2;
              vx = Math.max(-4.4, Math.min(4.4, vx));
              vy = Math.max(-2.8, Math.min(2.8, vy));
              jitterTimer = 10 + Math.floor(Math.random() * 30);
            }

            const targetVX = (b.exitX - b.x) / Math.max(1, b.maxAge - b.age);
            vx += (targetVX - vx) * 0.02;

            const driftY = Math.sin(b.driftPhase) * b.driftAmp;
            let y = b.baseY + driftY + vy;
            let baseY = b.baseY;

            if (y < 45) {
              y = 45;
              baseY += 4;
              vy = Math.abs(vy) * 0.6;
            }
            if (y > canvas.height - 170) {
              y = canvas.height - 170;
              baseY -= 4;
              vy = -Math.abs(vy) * 0.6;
            }

            return {
              ...b,
              x: b.x + vx,
              y,
              baseY,
              vx,
              vy: vy * 0.94,
              flapPhase: b.flapPhase + 0.24 + Math.abs(vx) * 0.02,
              driftPhase: b.driftPhase + b.driftSpeed,
              jitterTimer,
              age: b.age + 1,
            };
          })
          .filter((b) => {
            const exitedLeft = b.exitX < 0 && b.x < -90;
            const exitedRight = b.exitX > canvas.width && b.x > canvas.width + 90;
            return !(exitedLeft || exitedRight || b.age > b.maxAge + 30);
          });

        const projectileKeep = new Array(projectilesRef.current.length).fill(true);
        const birdKeep = new Array(birdsRef.current.length).fill(true);

        for (let i = 0; i < projectilesRef.current.length; i += 1) {
          for (let j = 0; j < birdsRef.current.length; j += 1) {
            if (!projectileKeep[i] || !birdKeep[j]) continue;
            const p = projectilesRef.current[i];
            const b = birdsRef.current[j];
            const dx = p.x - b.x;
            const dy = p.y - b.y;
            if (Math.hypot(dx, dy) < 16) {
              projectileKeep[i] = false;
              birdKeep[j] = false;
              scoreRef.current += 1;
            }
          }
        }

        projectilesRef.current = projectilesRef.current.filter((_, i) => projectileKeep[i]);
        birdsRef.current = birdsRef.current.filter((_, i) => birdKeep[i]);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#f7f7f7";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "#444";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(canvas.width, groundY);
      ctx.stroke();

      birdsRef.current.forEach(drawBird);
      drawAimLine();
      drawStickman(
        state.x,
        state.y,
        state.facing,
        state.step,
        state.y < groundY,
        state.vx,
        state.crouch,
        k.run && Math.abs(state.vx) > 1
      );

      ctx.fillStyle = "#111";
      projectilesRef.current.forEach((p) => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        ctx.restore();
      });

      drawUi();
      if (pausedRef.current) drawAngerOverlay();

      raf = requestAnimationFrame(loop);
    };

    state.y = getGroundY();
    mouseRef.current = { x: state.x + 80, y: state.y - 40 };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      canvas.removeEventListener("mousedown", mouseDown);
      canvas.removeEventListener("mousemove", mouseMove);
    };
  }, [stickmanColor, playerName]);

  return (
    <div className="fixed inset-0 m-0 p-0 overflow-hidden bg-neutral-100">
      <canvas ref={canvasRef} className="block w-screen h-screen" />
    </div>
  );
}