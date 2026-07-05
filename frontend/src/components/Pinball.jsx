import { useEffect, useRef, useState, useCallback } from "react";

// ---- Table constants ---------------------------------------------------
const W = 460;
const H = 720;
const BALL_R = 10;
const GRAVITY = 0.28;
const FRICTION = 0.999;
const MAX_SPEED = 14;

const LAUNCH_X = W - 22;
const LAUNCH_WIDTH = 30;
const LAUNCH_WALL_X = W - LAUNCH_WIDTH - 4;

// Flippers
const FLIPPER_LEN = 92;
const FLIPPER_THICK = 12;
const FLIPPER_REST_ANGLE = 0.42; // radians below horizontal (points down/outward)
const FLIPPER_ACTIVE_ANGLE = -0.5; // when pressed - flicks up
const FLIPPER_SPEED = 0.55;

const LEFT_FLIPPER_PIVOT = { x: 130, y: H - 70 };
const RIGHT_FLIPPER_PIVOT = { x: W - LAUNCH_WIDTH - 20 - 90, y: H - 70 };

// Bumpers (circular) - big point earners
const BUMPERS = [
    { x: 130, y: 200, r: 26, points: 100, color: "#ff2fbf" },
    { x: 260, y: 160, r: 26, points: 100, color: "#00dcff" },
    { x: 200, y: 280, r: 26, points: 150, color: "#ffd600" },
    { x: 90, y: 340, r: 20, points: 75, color: "#b06bff" },
    { x: 300, y: 340, r: 20, points: 75, color: "#6bff9d" },
];

// Slingshots (angled walls near flippers)
const SLINGSHOTS = [
    // left slingshot triangle
    {
        a: { x: 40, y: H - 220 },
        b: { x: 40, y: H - 130 },
        c: { x: 100, y: H - 175 },
        color: "#00dcff",
    },
    // right slingshot triangle
    {
        a: { x: W - LAUNCH_WIDTH - 10, y: H - 220 },
        b: { x: W - LAUNCH_WIDTH - 10, y: H - 130 },
        c: { x: W - LAUNCH_WIDTH - 70, y: H - 175 },
        color: "#ff2fbf",
    },
];

// Static walls as line segments {x1,y1,x2,y2}
const WALLS = [
    // Top curve approximated by a few segments
    { x1: 0, y1: 90, x2: 30, y2: 40 },
    { x1: 30, y1: 40, x2: 90, y2: 12 },
    { x1: 90, y1: 12, x2: 230, y2: 4 },
    { x1: 230, y1: 4, x2: 360, y2: 12 },
    { x1: 360, y1: 12, x2: LAUNCH_WALL_X, y2: 40 },
    // Left wall
    { x1: 0, y1: 90, x2: 0, y2: H - 140 },
    // Left funnel to flipper
    { x1: 0, y1: H - 140, x2: 40, y2: H - 40 },
    // Right wall (launcher chute inside)
    { x1: W, y1: 40, x2: W, y2: H },
    // Launcher chute inner wall
    { x1: LAUNCH_WALL_X, y1: 40, x2: LAUNCH_WALL_X, y2: H - 120 },
    // Chute exit deflector (top of chute, one-way lip)
    { x1: LAUNCH_WALL_X, y1: 40, x2: W - 8, y2: 60 },
    // Right funnel to flipper
    { x1: W, y1: H - 140, x2: W - LAUNCH_WIDTH - 10, y2: H - 40 },
];

// ---- Utilities ---------------------------------------------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function reflectBallOffSegment(ball, seg, restitution = 0.85) {
    const vx = seg.x2 - seg.x1;
    const vy = seg.y2 - seg.y1;
    const wx = ball.x - seg.x1;
    const wy = ball.y - seg.y1;
    const len2 = vx * vx + vy * vy;
    if (len2 === 0) return false;
    let t = (wx * vx + wy * vy) / len2;
    t = clamp(t, 0, 1);
    const px = seg.x1 + t * vx;
    const py = seg.y1 + t * vy;
    const dx = ball.x - px;
    const dy = ball.y - py;
    const dist = Math.hypot(dx, dy);
    if (dist < BALL_R && dist > 0) {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = BALL_R - dist;
        ball.x += nx * overlap;
        ball.y += ny * overlap;
        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
            ball.vx = (ball.vx - 2 * dot * nx) * restitution;
            ball.vy = (ball.vy - 2 * dot * ny) * restitution;
        }
        return true;
    }
    return false;
}

function collideBallCircle(ball, cx, cy, r, restitution = 1.15) {
    const dx = ball.x - cx;
    const dy = ball.y - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < BALL_R + r && dist > 0) {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = BALL_R + r - dist;
        ball.x += nx * overlap;
        ball.y += ny * overlap;
        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
            ball.vx = (ball.vx - 2 * dot * nx) * restitution;
            ball.vy = (ball.vy - 2 * dot * ny) * restitution;
            // Extra kick for that bumper "pop"
            ball.vx += nx * 2.5;
            ball.vy += ny * 2.5;
        }
        return true;
    }
    return false;
}

// Compute flipper segment given pivot and angle (0 = horizontal towards center)
function getFlipperSegment(pivot, angle, isLeft) {
    // For left flipper: angle 0 => tip to the right; positive angle => tip goes down
    // For right flipper: mirrored
    const dir = isLeft ? 1 : -1;
    const x2 = pivot.x + dir * Math.cos(angle) * FLIPPER_LEN;
    const y2 = pivot.y + Math.sin(angle) * FLIPPER_LEN;
    return { x1: pivot.x, y1: pivot.y, x2, y2 };
}

function collideBallFlipper(ball, pivot, angle, angularVel, isLeft) {
    const seg = getFlipperSegment(pivot, angle, isLeft);
    // Check as thick segment (capsule) using segment-circle distance
    const vx = seg.x2 - seg.x1;
    const vy = seg.y2 - seg.y1;
    const wx = ball.x - seg.x1;
    const wy = ball.y - seg.y1;
    const len2 = vx * vx + vy * vy;
    if (len2 === 0) return false;
    let t = (wx * vx + wy * vy) / len2;
    t = clamp(t, 0, 1);
    const px = seg.x1 + t * vx;
    const py = seg.y1 + t * vy;
    const dx = ball.x - px;
    const dy = ball.y - py;
    const dist = Math.hypot(dx, dy);
    const R = BALL_R + FLIPPER_THICK / 2;
    if (dist < R && dist > 0) {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = R - dist;
        ball.x += nx * overlap;
        ball.y += ny * overlap;
        // Point velocity from flipper rotation
        const rx = px - pivot.x;
        const ry = py - pivot.y;
        // v = omega x r (2D: v = (-omega*ry, omega*rx))
        const flipperVx = -angularVel * ry;
        const flipperVy = angularVel * rx;
        // Relative velocity
        const relVx = ball.vx - flipperVx;
        const relVy = ball.vy - flipperVy;
        const dot = relVx * nx + relVy * ny;
        if (dot < 0) {
            const restitution = 1.05;
            ball.vx = ball.vx - (1 + restitution) * dot * nx;
            ball.vy = ball.vy - (1 + restitution) * dot * ny;
            // Boost if flipper is actively swinging up
            if (angularVel < -0.1) {
                const boost = Math.min(Math.abs(angularVel) * 8, 8);
                ball.vx += nx * boost * 0.5;
                ball.vy += ny * boost;
            }
        }
        return true;
    }
    return false;
}

// Triangle collision - break into 3 line segments
function collideTriangle(ball, tri, restitution = 1.1) {
    let hit = false;
    const edges = [
        { x1: tri.a.x, y1: tri.a.y, x2: tri.b.x, y2: tri.b.y },
        { x1: tri.b.x, y1: tri.b.y, x2: tri.c.x, y2: tri.c.y },
        { x1: tri.c.x, y1: tri.c.y, x2: tri.a.x, y2: tri.a.y },
    ];
    for (const e of edges) {
        if (reflectBallOffSegment(ball, e, restitution)) {
            hit = true;
        }
    }
    return hit;
}

// ---- Component ---------------------------------------------------------
export default function Pinball() {
    const canvasRef = useRef(null);
    const rafRef = useRef(null);
    const stateRef = useRef(null);
    const keysRef = useRef({ left: false, right: false, launch: false });

    const [score, setScore] = useState(0);
    const [best, setBest] = useState(0);
    const [balls, setBalls] = useState(3);
    const [status, setStatus] = useState("intro"); // intro | ready | playing | gameover
    const [combo, setCombo] = useState(0);
    const [message, setMessage] = useState("");

    // Load best score
    useEffect(() => {
        const b = parseInt(localStorage.getItem("pinball_best") || "0", 10);
        setBest(Number.isFinite(b) ? b : 0);
    }, []);

    // Init game state
    const initState = useCallback(() => {
        stateRef.current = {
            ball: {
                x: LAUNCH_X,
                y: H - 60,
                vx: 0,
                vy: 0,
                onLaunch: true,
            },
            leftAngle: FLIPPER_REST_ANGLE,
            rightAngle: FLIPPER_REST_ANGLE,
            leftAngleTarget: FLIPPER_REST_ANGLE,
            rightAngleTarget: FLIPPER_REST_ANGLE,
            leftAngularVel: 0,
            rightAngularVel: 0,
            plungerPower: 0,
            bumperFlash: BUMPERS.map(() => 0),
            lastHitTime: 0,
            comboCount: 0,
            particles: [],
            frame: 0,
        };
    }, []);

    const spawnBall = useCallback(() => {
        if (!stateRef.current) initState();
        stateRef.current.ball = {
            x: LAUNCH_X,
            y: H - 60,
            vx: 0,
            vy: 0,
            onLaunch: true,
        };
        stateRef.current.plungerPower = 0;
    }, [initState]);

    const startGame = useCallback(() => {
        initState();
        setScore(0);
        setBalls(3);
        setCombo(0);
        setMessage("");
        setStatus("playing");
    }, [initState]);

    // Keyboard input
    useEffect(() => {
        const down = (e) => {
            if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
                keysRef.current.left = true;
                e.preventDefault();
            }
            if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
                keysRef.current.right = true;
                e.preventDefault();
            }
            if (e.key === " " || e.key === "ArrowDown" || e.key === "s") {
                keysRef.current.launch = true;
                e.preventDefault();
            }
            if (e.key === "Enter" && status !== "playing") {
                startGame();
            }
        };
        const up = (e) => {
            if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
                keysRef.current.left = false;
            }
            if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
                keysRef.current.right = false;
            }
            if (e.key === " " || e.key === "ArrowDown" || e.key === "s") {
                keysRef.current.launch = false;
            }
        };
        window.addEventListener("keydown", down);
        window.addEventListener("keyup", up);
        return () => {
            window.removeEventListener("keydown", down);
            window.removeEventListener("keyup", up);
        };
    }, [status, startGame]);

    // Main loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!stateRef.current) initState();

        let running = true;

        const addParticles = (x, y, color, count = 8) => {
            const s = stateRef.current;
            for (let i = 0; i < count; i++) {
                const a = Math.random() * Math.PI * 2;
                const sp = 1 + Math.random() * 3;
                s.particles.push({
                    x,
                    y,
                    vx: Math.cos(a) * sp,
                    vy: Math.sin(a) * sp,
                    life: 24,
                    color,
                });
            }
        };

        const step = () => {
            if (!running) return;
            const s = stateRef.current;
            s.frame += 1;

            // Flipper target angles based on keys
            s.leftAngleTarget = keysRef.current.left
                ? FLIPPER_ACTIVE_ANGLE
                : FLIPPER_REST_ANGLE;
            s.rightAngleTarget = keysRef.current.right
                ? FLIPPER_ACTIVE_ANGLE
                : FLIPPER_REST_ANGLE;

            const prevLeft = s.leftAngle;
            const prevRight = s.rightAngle;

            // Move angles towards targets (left: negative = up)
            const stepAngle = FLIPPER_SPEED;
            if (s.leftAngle > s.leftAngleTarget) {
                s.leftAngle = Math.max(
                    s.leftAngleTarget,
                    s.leftAngle - stepAngle,
                );
            } else if (s.leftAngle < s.leftAngleTarget) {
                s.leftAngle = Math.min(
                    s.leftAngleTarget,
                    s.leftAngle + stepAngle,
                );
            }
            if (s.rightAngle > s.rightAngleTarget) {
                s.rightAngle = Math.max(
                    s.rightAngleTarget,
                    s.rightAngle - stepAngle,
                );
            } else if (s.rightAngle < s.rightAngleTarget) {
                s.rightAngle = Math.min(
                    s.rightAngleTarget,
                    s.rightAngle + stepAngle,
                );
            }

            s.leftAngularVel = s.leftAngle - prevLeft;
            s.rightAngularVel = s.rightAngle - prevRight;

            const ball = s.ball;

            if (status === "playing") {
                if (ball.onLaunch) {
                    // Plunger mechanic
                    if (keysRef.current.launch) {
                        s.plungerPower = Math.min(s.plungerPower + 0.4, 18);
                    } else if (s.plungerPower > 0) {
                        ball.vy = -s.plungerPower;
                        ball.vx = -0.2;
                        s.plungerPower = 0;
                        ball.onLaunch = false;
                    }
                } else {
                    // Physics
                    ball.vy += GRAVITY;
                    ball.vx *= FRICTION;
                    ball.vy *= FRICTION;

                    // Cap speed
                    const sp = Math.hypot(ball.vx, ball.vy);
                    if (sp > MAX_SPEED) {
                        ball.vx = (ball.vx / sp) * MAX_SPEED;
                        ball.vy = (ball.vy / sp) * MAX_SPEED;
                    }

                    // Sub-step integration to avoid tunneling
                    const substeps = Math.max(
                        1,
                        Math.ceil(sp / (BALL_R * 0.5)),
                    );
                    for (let ss = 0; ss < substeps; ss++) {
                        ball.x += ball.vx / substeps;
                        ball.y += ball.vy / substeps;

                        // Collisions
                        for (const wall of WALLS) {
                            reflectBallOffSegment(ball, wall, 0.85);
                        }
                        for (const tri of SLINGSHOTS) {
                            if (collideTriangle(ball, tri, 1.15)) {
                                setScore((v) => v + 25);
                                addParticles(ball.x, ball.y, tri.color, 6);
                            }
                        }
                        BUMPERS.forEach((b, i) => {
                            if (collideBallCircle(ball, b.x, b.y, b.r, 1.15)) {
                                s.bumperFlash[i] = 12;
                                setScore((v) => v + b.points);
                                s.comboCount += 1;
                                s.lastHitTime = s.frame;
                                setCombo(s.comboCount);
                                addParticles(b.x, b.y, b.color, 12);
                            }
                        });
                        // Flippers
                        collideBallFlipper(
                            ball,
                            LEFT_FLIPPER_PIVOT,
                            s.leftAngle,
                            s.leftAngularVel,
                            true,
                        );
                        collideBallFlipper(
                            ball,
                            RIGHT_FLIPPER_PIVOT,
                            s.rightAngle,
                            s.rightAngularVel,
                            false,
                        );
                    }

                    // Reset combo if too much time passed
                    if (s.frame - s.lastHitTime > 90 && s.comboCount > 0) {
                        s.comboCount = 0;
                        setCombo(0);
                    }

                    // Drain detection
                    if (ball.y > H + 30) {
                        setBalls((prev) => {
                            const next = prev - 1;
                            if (next <= 0) {
                                setStatus("gameover");
                                setMessage("GAME OVER");
                            } else {
                                setMessage("BALL LOST!");
                                setTimeout(() => setMessage(""), 1400);
                                spawnBall();
                            }
                            return next;
                        });
                    }
                }
            }

            // Update bumper flash timers
            s.bumperFlash = s.bumperFlash.map((v) => Math.max(0, v - 1));

            // Update particles
            s.particles = s.particles
                .map((p) => ({
                    ...p,
                    x: p.x + p.vx,
                    y: p.y + p.vy,
                    vy: p.vy + 0.1,
                    life: p.life - 1,
                }))
                .filter((p) => p.life > 0);

            // ----- RENDER -----
            ctx.clearRect(0, 0, W, H);

            // Playfield background gradient
            const bg = ctx.createLinearGradient(0, 0, 0, H);
            bg.addColorStop(0, "#160a3a");
            bg.addColorStop(0.5, "#0a0326");
            bg.addColorStop(1, "#03001a");
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, H);

            // Grid overlay
            ctx.strokeStyle = "rgba(107, 231, 255, 0.06)";
            ctx.lineWidth = 1;
            for (let x = 0; x < W; x += 30) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, H);
                ctx.stroke();
            }
            for (let y = 0; y < H; y += 30) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(W, y);
                ctx.stroke();
            }

            // Center art - big circle
            ctx.strokeStyle = "rgba(255, 47, 191, 0.15)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(W / 2, 230, 150, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = "rgba(0, 220, 255, 0.1)";
            ctx.beginPath();
            ctx.arc(W / 2, 230, 100, 0, Math.PI * 2);
            ctx.stroke();

            // Draw walls (neon lines)
            ctx.shadowBlur = 12;
            ctx.shadowColor = "#00dcff";
            ctx.strokeStyle = "#00dcff";
            ctx.lineWidth = 3;
            for (const w of WALLS) {
                ctx.beginPath();
                ctx.moveTo(w.x1, w.y1);
                ctx.lineTo(w.x2, w.y2);
                ctx.stroke();
            }
            ctx.shadowBlur = 0;

            // Launcher chute base
            ctx.fillStyle = "rgba(255, 214, 0, 0.08)";
            ctx.fillRect(LAUNCH_WALL_X, 40, W - LAUNCH_WALL_X, H - 40);
            // Plunger visual
            const plungerY = H - 10 - s.plungerPower * 2;
            ctx.fillStyle = "#ffd600";
            ctx.shadowBlur = 10;
            ctx.shadowColor = "#ffd600";
            ctx.fillRect(LAUNCH_WALL_X + 6, plungerY, 20, 10);
            ctx.shadowBlur = 0;

            // Slingshots
            for (const tri of SLINGSHOTS) {
                ctx.beginPath();
                ctx.moveTo(tri.a.x, tri.a.y);
                ctx.lineTo(tri.b.x, tri.b.y);
                ctx.lineTo(tri.c.x, tri.c.y);
                ctx.closePath();
                ctx.fillStyle = tri.color + "22";
                ctx.fill();
                ctx.strokeStyle = tri.color;
                ctx.shadowBlur = 12;
                ctx.shadowColor = tri.color;
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // Bumpers
            BUMPERS.forEach((b, i) => {
                const flash = s.bumperFlash[i] / 12;
                const r = b.r + flash * 4;
                // outer glow ring
                ctx.beginPath();
                ctx.arc(b.x, b.y, r + 6, 0, Math.PI * 2);
                ctx.fillStyle = b.color + "22";
                ctx.fill();
                // body
                const g = ctx.createRadialGradient(
                    b.x - r / 3,
                    b.y - r / 3,
                    2,
                    b.x,
                    b.y,
                    r,
                );
                g.addColorStop(0, "#ffffff");
                g.addColorStop(0.3, b.color);
                g.addColorStop(1, "#1a0033");
                ctx.beginPath();
                ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
                ctx.fillStyle = g;
                ctx.shadowBlur = 15 + flash * 20;
                ctx.shadowColor = b.color;
                ctx.fill();
                ctx.shadowBlur = 0;
                // inner ring
                ctx.beginPath();
                ctx.arc(b.x, b.y, r * 0.5, 0, Math.PI * 2);
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2;
                ctx.stroke();
                // points label
                ctx.fillStyle = "#0a0018";
                ctx.font = "bold 10px 'Press Start 2P', monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(String(b.points), b.x, b.y);
            });

            // Flippers
            const drawFlipper = (pivot, angle, isLeft, color) => {
                const seg = getFlipperSegment(pivot, angle, isLeft);
                ctx.strokeStyle = color;
                ctx.shadowBlur = 14;
                ctx.shadowColor = color;
                ctx.lineWidth = FLIPPER_THICK;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(seg.x1, seg.y1);
                ctx.lineTo(seg.x2, seg.y2);
                ctx.stroke();
                ctx.shadowBlur = 0;
                // pivot dot
                ctx.beginPath();
                ctx.arc(pivot.x, pivot.y, 4, 0, Math.PI * 2);
                ctx.fillStyle = "#ffffff";
                ctx.fill();
            };
            drawFlipper(LEFT_FLIPPER_PIVOT, s.leftAngle, true, "#00dcff");
            drawFlipper(RIGHT_FLIPPER_PIVOT, s.rightAngle, false, "#ff2fbf");

            // Drain zone (gap between flippers)
            ctx.fillStyle = "rgba(255, 0, 60, 0.08)";
            ctx.fillRect(
                LEFT_FLIPPER_PIVOT.x + 20,
                H - 20,
                RIGHT_FLIPPER_PIVOT.x - LEFT_FLIPPER_PIVOT.x - 40,
                20,
            );

            // Particles
            for (const p of s.particles) {
                ctx.globalAlpha = Math.max(0, p.life / 24);
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, 3, 3);
            }
            ctx.globalAlpha = 1;

            // Ball
            const ballGrad = ctx.createRadialGradient(
                ball.x - 3,
                ball.y - 3,
                1,
                ball.x,
                ball.y,
                BALL_R,
            );
            ballGrad.addColorStop(0, "#ffffff");
            ballGrad.addColorStop(0.5, "#d0d8ff");
            ballGrad.addColorStop(1, "#4030a0");
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
            ctx.fillStyle = ballGrad;
            ctx.shadowBlur = 20;
            ctx.shadowColor = "#a0c8ff";
            ctx.fill();
            ctx.shadowBlur = 0;

            rafRef.current = requestAnimationFrame(step);
        };

        rafRef.current = requestAnimationFrame(step);
        return () => {
            running = false;
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [status, initState, spawnBall]);

    // Update best score
    useEffect(() => {
        if (status === "gameover" && score > best) {
            setBest(score);
            localStorage.setItem("pinball_best", String(score));
        }
    }, [status, score, best]);

    // Touch handlers
    const touchLeft = (down) => (e) => {
        e.preventDefault();
        keysRef.current.left = down;
    };
    const touchRight = (down) => (e) => {
        e.preventDefault();
        keysRef.current.right = down;
    };
    const touchLaunch = (down) => (e) => {
        e.preventDefault();
        keysRef.current.launch = down;
    };

    return (
        <div className="pinball-shell" data-testid="pinball-shell">
            <div className="pinball-cabinet">
                <div className="side-panel left">
                    <div className="arcade-title" data-testid="game-title">
                        NEON
                        <br />
                        PIMBOL
                    </div>
                    <div className="arcade-sub">*** ARCADE ***</div>

                    <div className="hud-card">
                        <div className="hud-label">SCORE</div>
                        <div className="hud-value" data-testid="score-value">
                            {String(score).padStart(6, "0")}
                        </div>
                    </div>

                    <div className="hud-card yellow">
                        <div className="hud-label">HIGH SCORE</div>
                        <div
                            className="hud-value yellow"
                            data-testid="best-value"
                        >
                            {String(best).padStart(6, "0")}
                        </div>
                    </div>

                    {combo > 1 && (
                        <div className="hud-card cyan">
                            <div className="hud-label">COMBO</div>
                            <div
                                className="hud-value cyan"
                                data-testid="combo-value"
                            >
                                x{combo}
                            </div>
                        </div>
                    )}
                </div>

                <div className="table-wrap" data-testid="table-wrap">
                    <div className="marquee">PRESS START</div>
                    <canvas
                        ref={canvasRef}
                        width={W}
                        height={H}
                        className="pinball-canvas"
                        data-testid="pinball-canvas"
                    />
                    {(status === "intro" || status === "gameover") && (
                        <div className="overlay" data-testid="overlay">
                            <div
                                className={
                                    "overlay-title" +
                                    (status === "gameover" ? " small" : "")
                                }
                            >
                                {status === "intro"
                                    ? "PIMBOL"
                                    : "GAME OVER"}
                            </div>
                            {status === "gameover" && (
                                <>
                                    <div className="overlay-sub">
                                        SCORE:{" "}
                                        {String(score).padStart(6, "0")}
                                    </div>
                                    {score >= best && score > 0 && (
                                        <div
                                            className="overlay-sub"
                                            style={{ color: "#ffd600" }}
                                        >
                                            * NOVO RECORDE! *
                                        </div>
                                    )}
                                </>
                            )}
                            {status === "intro" && (
                                <div className="overlay-sub">
                                    Insira sua ficha e jogue!
                                </div>
                            )}
                            <button
                                className="arcade-btn"
                                data-testid="start-btn"
                                onClick={startGame}
                            >
                                {status === "intro"
                                    ? "COMEÇAR"
                                    : "JOGAR DE NOVO"}
                            </button>
                            <div
                                className="overlay-sub blink"
                                style={{ fontSize: 18 }}
                            >
                                pressione ENTER
                            </div>
                        </div>
                    )}
                    {status === "playing" && message && (
                        <div className="hint-tag" data-testid="ball-message">
                            {message}
                        </div>
                    )}
                </div>

                <div className="side-panel right">
                    <div className="hud-card cyan">
                        <div className="hud-label">BALLS LEFT</div>
                        <div className="balls-row" data-testid="balls-row">
                            {[0, 1, 2].map((i) => (
                                <div
                                    key={i}
                                    className={
                                        "ball-dot" +
                                        (i >= balls ? " spent" : "")
                                    }
                                />
                            ))}
                        </div>
                    </div>

                    <div className="hud-card">
                        <div className="hud-label">CONTROLES</div>
                        <div className="instructions">
                            <span className="key">←</span> ou{" "}
                            <span className="key">A</span> — palheta esquerda
                            <br />
                            <span className="key">→</span> ou{" "}
                            <span className="key">D</span> — palheta direita
                            <br />
                            <span className="key">ESPAÇO</span> — lançar
                            bolinha
                            <br />
                            <span className="key">ENTER</span> — reiniciar
                        </div>
                    </div>

                    <div className="hud-card yellow">
                        <div className="hud-label">DICAS</div>
                        <div className="instructions">
                            Segure <span className="key">ESPAÇO</span> para
                            carregar
                            <br />
                            e solte para lançar.
                            <br />
                            <br />
                            Acerte os alvos brilhantes para pontuar. Combos
                            valem muito!
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile controls */}
            <div className="mobile-controls">
                <button
                    className="mobile-btn cyan"
                    data-testid="mobile-left"
                    onTouchStart={touchLeft(true)}
                    onTouchEnd={touchLeft(false)}
                    onMouseDown={touchLeft(true)}
                    onMouseUp={touchLeft(false)}
                    onMouseLeave={touchLeft(false)}
                >
                    ◀
                </button>
                <button
                    className="mobile-btn"
                    data-testid="mobile-launch"
                    onTouchStart={touchLaunch(true)}
                    onTouchEnd={touchLaunch(false)}
                    onMouseDown={touchLaunch(true)}
                    onMouseUp={touchLaunch(false)}
                    onMouseLeave={touchLaunch(false)}
                >
                    ▲
                </button>
                <button
                    className="mobile-btn"
                    data-testid="mobile-right"
                    onTouchStart={touchRight(true)}
                    onTouchEnd={touchRight(false)}
                    onMouseDown={touchRight(true)}
                    onMouseUp={touchRight(false)}
                    onMouseLeave={touchRight(false)}
                >
                    ▶
                </button>
            </div>
        </div>
    );
}
