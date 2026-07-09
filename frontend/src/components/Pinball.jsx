import { useEffect, useRef, useState, useCallback } from "react";

// ---- Table constants ---------------------------------------------------
const W = 480;
const H = 760;
const BALL_R = 12;
const GRAVITY = 0.22;
const FRICTION = 0.999;
const MAX_SPEED = 30;

const LAUNCH_WIDTH = 43;
const LAUNCH_WALL_X = W - LAUNCH_WIDTH - 4;
const LAUNCH_X = LAUNCH_WALL_X + LAUNCH_WIDTH / 2 + 2;

// Flippers
const FLIPPER_LEN = 92;
const FLIPPER_THICK = 12;
const FLIPPER_REST_ANGLE = 0.42;
const FLIPPER_ACTIVE_ANGLE = -0.5;
const FLIPPER_SPEED = 0.55;

const LEFT_FLIPPER_PIVOT = { x: 140, y: H - 70 };
const RIGHT_FLIPPER_PIVOT = { x: W - LAUNCH_WIDTH - 20 - 90, y: H - 70 };

// Bumpers (pop bumpers)
const BUMPERS = [
    { x: 130, y: 210, r: 26, points: 100, color: "#ff2fbf" },
    { x: 270, y: 175, r: 26, points: 100, color: "#00dcff" },
    { x: 200, y: 280, r: 32, points: 150, color: "#ffd600" },
    { x: 370, y: 220, r: 24, points: 100, color: "#b06bff" },
    { x: 100, y: 300, r: 20, points: 75, color: "#6bff9d" },
    { x: 340, y: 300, r: 20, points: 75, color: "#ff6b9d" },
];

// Small bumpers
const MINI_BUMPERS = [
    { x: 85, y: 400, r: 16, points: 50, color: "#6bff9d" },
    { x: 335, y: 400, r: 16, points: 50, color: "#ff6b9d" },
    { x: 60, y: 200, r: 14, points: 50, color: "#6be7ff" },
    { x: 420, y: 155, r: 14, points: 75, color: "#ffab6b" },
    { x: 200, y: 130, r: 14, points: 75, color: "#ffd6f9" },
];

// Slingshots
const SLINGSHOTS = [
    {
        a: { x: 40, y: H - 230 },
        b: { x: 40, y: H - 130 },
        c: { x: 105, y: H - 180 },
        color: "#00dcff",
    },
    {
        a: { x: W - LAUNCH_WIDTH - 10, y: H - 230 },
        b: { x: W - LAUNCH_WIDTH - 10, y: H - 130 },
        c: { x: W - LAUNCH_WIDTH - 75, y: H - 180 },
        color: "#ff2fbf",
    },
];

// Top rollover lanes: 4 lanes separated by 3 vertical walls
// Lane sensor Y line: 105
const LANE_TOP = 30;
const LANE_BOTTOM = 110;
const LANE_DIVIDERS = [
    { x: 100, color: "#00dcff" },
    { x: 175, color: "#ff2fbf" },
    { x: 250, color: "#ffd600" },
    { x: 325, color: "#6bff9d" },
];
// The 4 lanes are the gaps between (leftWall,100), (100,175), (175,250), (250,325), (325,400=inner)
// We'll count "left of first divider" as lane 0, then between each divider, then "right of last"

// Drop targets bank (horizontal row above slingshots)
const DROP_TARGET_Y = 445;
const DROP_TARGET_H = 14;
const DROP_TARGET_W = 40;
const DROP_TARGET_GAP = 8;
const DROP_TARGET_START_X = 105;
const DROP_TARGET_COUNT = 5;
const DROP_TARGET_COLORS = [
    "#ff2fbf",
    "#00dcff",
    "#ffd600",
    "#b06bff",
    "#6bff9d",
];

// Spinner: horizontal bar that ball passes through, gives points
const SPINNER = { x: W / 2, y: 340, w: 60, points: 10 };

// Static walls as line segments {x1,y1,x2,y2}
const WALLS = [
    // Top curve approximated
    { x1: 0, y1: 90, x2: 20, y2: 40 },
    { x1: 20, y1: 40, x2: 80, y2: 12 },
    { x1: 80, y1: 12, x2: 240, y2: 4 },
    { x1: 240, y1: 4, x2: 380, y2: 12 },
    { x1: 380, y1: 12, x2: LAUNCH_WALL_X, y2: 32 },
    // Lane dividers
    ...LANE_DIVIDERS.map((d) => ({
        x1: d.x,
        y1: LANE_TOP,
        x2: d.x,
        y2: LANE_BOTTOM,
    })),
    // Left wall
    { x1: 0, y1: 90, x2: 0, y2: H - 150 },
    // Left funnel to flipper
    { x1: 0, y1: H - 150, x2: 45, y2: H - 40 },
    // Right wall (full height)
    { x1: W, y1: 90, x2: W, y2: H },
    // Launcher chute inner wall (full height - fully enclosed chute)
    { x1: LAUNCH_WALL_X, y1: 92, x2: LAUNCH_WALL_X, y2: H },
    // Chute exit deflector at top - deflects ball leftward into playfield
    { x1: LAUNCH_WALL_X, y1: 50, x2: W, y2: 100 },
    // Right playfield funnel (guides balls to right flipper - inside playfield only)
    { x1: LAUNCH_WALL_X - 4, y1: H - 150, x2: LAUNCH_WALL_X - 45, y2: H - 40 },
    // Left inner guides (top of playfield below lanes)
    { x1: 20, y1: 120, x2: 55, y2: 160 },
    { x1: 55, y1: 160, x2: 55, y2: 240 },
    // Right inner guide
    { x1: LAUNCH_WALL_X - 20, y1: 120, x2: LAUNCH_WALL_X - 55, y2: 160 },
    { x1: LAUNCH_WALL_X - 55, y1: 160, x2: LAUNCH_WALL_X - 55, y2: 240 },
];

// ---- Sound engine ------------------------------------------------------
let audioCtx = null;
const getAudio = () => {
    if (typeof window === "undefined") return null;
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            return null;
        }
    }
    if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
    }
    return audioCtx;
};

const soundEnabledRef = { current: true };

function beep(freq, duration = 0.1, type = "square", gain = 0.12) {
    if (!soundEnabledRef.current) return;
    const ctx = getAudio();
    if (!ctx) return;
    try {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.connect(g);
        g.connect(ctx.destination);
        const now = ctx.currentTime;
        g.gain.setValueAtTime(gain, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.start(now);
        osc.stop(now + duration + 0.02);
    } catch (e) {
        /* ignore */
    }
}

function sweep(from, to, duration = 0.3, type = "sawtooth", gain = 0.15) {
    if (!soundEnabledRef.current) return;
    const ctx = getAudio();
    if (!ctx) return;
    try {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        const now = ctx.currentTime;
        osc.frequency.setValueAtTime(from, now);
        osc.frequency.exponentialRampToValueAtTime(
            Math.max(20, to),
            now + duration,
        );
        g.gain.setValueAtTime(gain, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration + 0.02);
    } catch (e) {
        /* ignore */
    }
}

function fanfare() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) =>
        setTimeout(() => beep(f, 0.15, "square", 0.15), i * 90),
    );
}

// ---- Geometry helpers --------------------------------------------------
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
            const impact = Math.abs(dot);
            return impact;
        }
        return 0.01;
    }
    return false;
}

function collideBallCircle(ball, cx, cy, r, restitution = 1.15, boost = 2.5) {
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
            ball.vx += nx * boost;
            ball.vy += ny * boost;
        }
        return true;
    }
    return false;
}

// Rectangle collision (axis-aligned)
function collideBallRect(ball, rx, ry, rw, rh, restitution = 0.9) {
    const cx = clamp(ball.x, rx, rx + rw);
    const cy = clamp(ball.y, ry, ry + rh);
    const dx = ball.x - cx;
    const dy = ball.y - cy;
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

function getFlipperSegment(pivot, angle, isLeft) {
    const dir = isLeft ? 1 : -1;
    const x2 = pivot.x + dir * Math.cos(angle) * FLIPPER_LEN;
    const y2 = pivot.y + Math.sin(angle) * FLIPPER_LEN;
    return { x1: pivot.x, y1: pivot.y, x2, y2 };
}

function collideBallFlipper(ball, pivot, angle, angularVel, isLeft) {
    const seg = getFlipperSegment(pivot, angle, isLeft);
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
        const rx = px - pivot.x;
        const ry = py - pivot.y;
        const flipperVx = -angularVel * ry;
        const flipperVy = angularVel * rx;
        const relVx = ball.vx - flipperVx;
        const relVy = ball.vy - flipperVy;
        const dot = relVx * nx + relVy * ny;
        if (dot < 0) {
            const restitution = 1.05;
            ball.vx = ball.vx - (1 + restitution) * dot * nx;
            ball.vy = ball.vy - (1 + restitution) * dot * ny;
            if (angularVel < -0.1) {
                const boost = Math.min(Math.abs(angularVel) * 8, 8);
                ball.vx += nx * boost * 0.5;
                ball.vy += ny * boost;
                beep(300 + Math.random() * 100, 0.06, "square", 0.1);
            }
        }
        return true;
    }
    return false;
}

function collideTriangle(ball, tri, restitution = 1.1) {
    let hit = false;
    const edges = [
        { x1: tri.a.x, y1: tri.a.y, x2: tri.b.x, y2: tri.b.y },
        { x1: tri.b.x, y1: tri.b.y, x2: tri.c.x, y2: tri.c.y },
        { x1: tri.c.x, y1: tri.c.y, x2: tri.a.x, y2: tri.a.y },
    ];
    for (const e of edges) {
        if (reflectBallOffSegment(ball, e, restitution)) hit = true;
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
    const [status, setStatus] = useState("intro");
    const [combo, setCombo] = useState(0);
    const [message, setMessage] = useState("");
    const [soundOn, setSoundOn] = useState(true);
    const [lanesLit, setLanesLit] = useState([false, false, false, false]);
    const [targetsUp, setTargetsUp] = useState([true, true, true, true, true]);

    useEffect(() => {
        soundEnabledRef.current = soundOn;
    }, [soundOn]);

    useEffect(() => {
        const b = parseInt(localStorage.getItem("pinball_best") || "0", 10);
        setBest(Number.isFinite(b) ? b : 0);
    }, []);

    const initState = useCallback(() => {
        stateRef.current = {
            ball: {
                x: LAUNCH_X,
                y: H - 40,
                vx: 0,
                vy: 0,
                onLaunch: true,
                prevY: H - 40,
            },
            ballTrail: [],
            leftAngle: FLIPPER_REST_ANGLE,
            rightAngle: FLIPPER_REST_ANGLE,
            leftAngleTarget: FLIPPER_REST_ANGLE,
            rightAngleTarget: FLIPPER_REST_ANGLE,
            leftAngularVel: 0,
            rightAngularVel: 0,
            plungerPower: 0,
            bumperFlash: [...BUMPERS, ...MINI_BUMPERS].map(() => 0),
            slingFlash: SLINGSHOTS.map(() => 0),
            targetFlash: Array(DROP_TARGET_COUNT).fill(0),
            laneFlash: [0, 0, 0, 0],
            lanesLit: [false, false, false, false],
            targetsUp: [true, true, true, true, true],
            spinnerAngle: 0,
            spinnerVel: 0,
            spinnerCooldown: 0,
            laneSensorCooldown: [0, 0, 0, 0],
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
            y: H - 40,
            vx: 0,
            vy: 0,
            onLaunch: true,
            prevY: H - 40,
        };
        stateRef.current.ballTrail = [];
        stateRef.current.plungerPower = 0;
    }, [initState]);

    const startGame = useCallback(() => {
        // Force init audio context (needs user gesture)
        getAudio();
        initState();
        setScore(0);
        setBalls(3);
        setCombo(0);
        setMessage("");
        setLanesLit([false, false, false, false]);
        setTargetsUp([true, true, true, true, true]);
        setStatus("playing");
        sweep(200, 800, 0.3, "sawtooth", 0.12);
    }, [initState]);

    // Keyboard
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
            if (e.key === "Enter" && status !== "playing") startGame();
            if (e.key === "m" || e.key === "M") setSoundOn((v) => !v);
        };
        const up = (e) => {
            if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A")
                keysRef.current.left = false;
            if (e.key === "ArrowRight" || e.key === "d" || e.key === "D")
                keysRef.current.right = false;
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

            s.leftAngleTarget = keysRef.current.left
                ? FLIPPER_ACTIVE_ANGLE
                : FLIPPER_REST_ANGLE;
            s.rightAngleTarget = keysRef.current.right
                ? FLIPPER_ACTIVE_ANGLE
                : FLIPPER_REST_ANGLE;

            const prevLeft = s.leftAngle;
            const prevRight = s.rightAngle;
            const stepA = FLIPPER_SPEED;
            s.leftAngle +=
                clamp(s.leftAngleTarget - s.leftAngle, -stepA, stepA);
            s.rightAngle +=
                clamp(s.rightAngleTarget - s.rightAngle, -stepA, stepA);
            s.leftAngularVel = s.leftAngle - prevLeft;
            s.rightAngularVel = s.rightAngle - prevRight;

            // Update spinner rotation (damped)
            s.spinnerAngle += s.spinnerVel;
            s.spinnerVel *= 0.95;
            if (s.spinnerCooldown > 0) s.spinnerCooldown--;
            for (let i = 0; i < 4; i++) {
                if (s.laneSensorCooldown[i] > 0) s.laneSensorCooldown[i]--;
            }

            const ball = s.ball;

            if (status === "playing") {
                if (ball.onLaunch) {
                    if (keysRef.current.launch) {
                        s.plungerPower = Math.min(s.plungerPower + 0.4, 20);
                    } else if (s.plungerPower > 0) {
                        ball.vy = -s.plungerPower;
                        ball.vx = -0.4;
                        sweep(
                            150 + s.plungerPower * 30,
                            800,
                            0.35,
                            "square",
                            0.15,
                        );
                        s.plungerPower = 0;
                        ball.onLaunch = false;
                    }
                } else {
                    ball.vy += GRAVITY;
                    ball.vx *= FRICTION;
                    ball.vy *= FRICTION;

                    const sp = Math.hypot(ball.vx, ball.vy);
                    if (sp > MAX_SPEED) {
                        ball.vx = (ball.vx / sp) * MAX_SPEED;
                        ball.vy = (ball.vy / sp) * MAX_SPEED;
                    }

                    const substeps = Math.max(
                        1,
                        Math.ceil(sp / (BALL_R * 0.5)),
                    );
                    for (let ss = 0; ss < substeps; ss++) {
                        const prevY = ball.y;
                        ball.x += ball.vx / substeps;
                        ball.y += ball.vy / substeps;

                        // Walls
                        for (const wall of WALLS) {
                            const impact = reflectBallOffSegment(
                                ball,
                                wall,
                                0.85,
                            );
                            if (impact && impact > 2.5) {
                                beep(180, 0.04, "sine", 0.06);
                            }
                        }
                        // Slingshots
                        SLINGSHOTS.forEach((tri, i) => {
                            if (collideTriangle(ball, tri, 1.2)) {
                                s.slingFlash[i] = 12;
                                setScore((v) => v + 25);
                                addParticles(ball.x, ball.y, tri.color, 6);
                                beep(900, 0.05, "square", 0.15);
                            }
                        });
                        // Bumpers
                        BUMPERS.forEach((b, i) => {
                            if (
                                collideBallCircle(
                                    ball,
                                    b.x,
                                    b.y,
                                    b.r,
                                    1.15,
                                    3,
                                )
                            ) {
                                s.bumperFlash[i] = 12;
                                setScore((v) => v + b.points);
                                s.comboCount += 1;
                                s.lastHitTime = s.frame;
                                setCombo(s.comboCount);
                                addParticles(b.x, b.y, b.color, 12);
                                beep(700 + i * 100, 0.08, "square", 0.16);
                            }
                        });
                        // Mini bumpers
                        MINI_BUMPERS.forEach((b, i) => {
                            const idx = BUMPERS.length + i;
                            if (
                                collideBallCircle(
                                    ball,
                                    b.x,
                                    b.y,
                                    b.r,
                                    1.1,
                                    2,
                                )
                            ) {
                                s.bumperFlash[idx] = 10;
                                setScore((v) => v + b.points);
                                addParticles(b.x, b.y, b.color, 6);
                                beep(1100, 0.05, "triangle", 0.12);
                            }
                        });
                        // Drop targets
                        for (let k = 0; k < DROP_TARGET_COUNT; k++) {
                            if (!s.targetsUp[k]) continue;
                            const rx =
                                DROP_TARGET_START_X +
                                k * (DROP_TARGET_W + DROP_TARGET_GAP);
                            if (
                                collideBallRect(
                                    ball,
                                    rx,
                                    DROP_TARGET_Y,
                                    DROP_TARGET_W,
                                    DROP_TARGET_H,
                                    0.5,
                                )
                            ) {
                                s.targetsUp[k] = false;
                                s.targetFlash[k] = 20;
                                setTargetsUp([...s.targetsUp]);
                                setScore((v) => v + 250);
                                addParticles(
                                    rx + DROP_TARGET_W / 2,
                                    DROP_TARGET_Y + DROP_TARGET_H / 2,
                                    DROP_TARGET_COLORS[k],
                                    10,
                                );
                                beep(500 + k * 80, 0.08, "triangle", 0.14);
                                // Check all dropped
                                if (s.targetsUp.every((t) => !t)) {
                                    setScore((v) => v + 2000);
                                    setMessage("BONUS! +2000");
                                    fanfare();
                                    setTimeout(() => {
                                        s.targetsUp = [
                                            true,
                                            true,
                                            true,
                                            true,
                                            true,
                                        ];
                                        setTargetsUp([...s.targetsUp]);
                                        setMessage("");
                                    }, 1400);
                                }
                            }
                        }
                        // Spinner sensor - detect ball passing near spinner
                        {
                            const dx = ball.x - SPINNER.x;
                            const dy = ball.y - SPINNER.y;
                            if (
                                Math.abs(dx) < SPINNER.w / 2 &&
                                Math.abs(dy) < 12 &&
                                s.spinnerCooldown === 0
                            ) {
                                s.spinnerVel =
                                    (ball.vx > 0 ? 1 : -1) *
                                    Math.min(Math.abs(ball.vx) * 0.1, 0.6);
                                s.spinnerCooldown = 10;
                                setScore((v) => v + SPINNER.points);
                                beep(1400, 0.03, "square", 0.08);
                            }
                        }
                        // Lane sensors (top rollovers)
                        {
                            // Ball crossed y=95 downward or upward
                            if (
                                prevY < 95 &&
                                ball.y >= 95 &&
                                ball.x > 0 &&
                                ball.x < LAUNCH_WALL_X
                            ) {
                                // determine lane index
                                const bounds = [
                                    0,
                                    ...LANE_DIVIDERS.map((d) => d.x),
                                    LAUNCH_WALL_X,
                                ];
                                for (let i = 0; i < 4; i++) {
                                    if (
                                        ball.x > bounds[i] &&
                                        ball.x < bounds[i + 1] &&
                                        s.laneSensorCooldown[i] === 0
                                    ) {
                                        s.laneSensorCooldown[i] = 30;
                                        s.laneFlash[i] = 15;
                                        if (!s.lanesLit[i]) {
                                            s.lanesLit[i] = true;
                                            setLanesLit([...s.lanesLit]);
                                            setScore((v) => v + 50);
                                            beep(
                                                600 + i * 150,
                                                0.08,
                                                "triangle",
                                                0.13,
                                            );
                                            // All lanes lit
                                            if (
                                                s.lanesLit.every((x) => x)
                                            ) {
                                                setScore((v) => v + 1500);
                                                setMessage(
                                                    "SUPER LANES! +1500",
                                                );
                                                fanfare();
                                                setTimeout(() => {
                                                    s.lanesLit = [
                                                        false,
                                                        false,
                                                        false,
                                                        false,
                                                    ];
                                                    setLanesLit([
                                                        ...s.lanesLit,
                                                    ]);
                                                    setMessage("");
                                                }, 1400);
                                            }
                                        } else {
                                            setScore((v) => v + 10);
                                        }
                                        break;
                                    }
                                }
                            }
                        }
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

                    if (s.frame - s.lastHitTime > 90 && s.comboCount > 0) {
                        s.comboCount = 0;
                        setCombo(0);
                    }

                    if (ball.y > H + 30) {
                        setBalls((prev) => {
                            const next = prev - 1;
                            sweep(400, 60, 0.6, "sawtooth", 0.15);
                            if (next <= 0) {
                                setStatus("gameover");
                                setMessage("GAME OVER");
                                setTimeout(
                                    () =>
                                        sweep(300, 80, 1.0, "square", 0.12),
                                    400,
                                );
                            } else {
                                setMessage("BOLA PERDIDA!");
                                setTimeout(() => setMessage(""), 1400);
                                spawnBall();
                            }
                            return next;
                        });
                    }
                }
            }

            s.bumperFlash = s.bumperFlash.map((v) => Math.max(0, v - 1));
            s.slingFlash = s.slingFlash.map((v) => Math.max(0, v - 1));
            s.targetFlash = s.targetFlash.map((v) => Math.max(0, v - 1));
            s.laneFlash = s.laneFlash.map((v) => Math.max(0, v - 1));

            // Update ball trail
            if (!ball.onLaunch && (Math.abs(ball.vx) > 1 || Math.abs(ball.vy) > 1)) {
                if (!s.ballTrail) s.ballTrail = [];
                s.ballTrail.push({ x: ball.x, y: ball.y });
                if (s.ballTrail.length > 8) s.ballTrail.shift();
            } else {
                s.ballTrail = [];
            }

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

            const bg = ctx.createLinearGradient(0, 0, 0, H);
            bg.addColorStop(0, "#160a3a");
            bg.addColorStop(0.5, "#0a0326");
            bg.addColorStop(1, "#03001a");
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, H);

            // Grid
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

            // Playfield decorative arcs
            ctx.strokeStyle = "rgba(255, 47, 191, 0.12)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(W / 2, 240, 150, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = "rgba(0, 220, 255, 0.08)";
            ctx.beginPath();
            ctx.arc(W / 2, 240, 100, 0, Math.PI * 2);
            ctx.stroke();

            // Rollover lane arrows/indicators
            const bounds = [
                8,
                ...LANE_DIVIDERS.map((d) => d.x),
                LAUNCH_WALL_X - 8,
            ];
            for (let i = 0; i < 4; i++) {
                const cx = (bounds[i] + bounds[i + 1]) / 2;
                const lit = s.lanesLit[i];
                const flash = s.laneFlash[i] / 15;
                const color = LANE_DIVIDERS[i]?.color || "#ffffff";
                // arrow
                ctx.save();
                ctx.translate(cx, LANE_TOP + 30);
                ctx.beginPath();
                ctx.moveTo(-8, -8);
                ctx.lineTo(8, -8);
                ctx.lineTo(0, 8);
                ctx.closePath();
                ctx.fillStyle = lit
                    ? color
                    : `rgba(255,255,255,${0.1 + flash * 0.5})`;
                ctx.shadowBlur = lit ? 12 : flash * 12;
                ctx.shadowColor = color;
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.restore();
                // small light
                ctx.beginPath();
                ctx.arc(cx, LANE_TOP + 55, 5, 0, Math.PI * 2);
                ctx.fillStyle = lit ? color : "rgba(255,255,255,0.15)";
                ctx.shadowBlur = lit ? 10 : 0;
                ctx.shadowColor = color;
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            // Walls
            ctx.shadowBlur = 10;
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

            // Launcher chute
            ctx.fillStyle = "rgba(255, 214, 0, 0.08)";
            ctx.fillRect(LAUNCH_WALL_X + 2, 92, W - LAUNCH_WALL_X - 4, H - 92);
            // Plunger visual (at bottom of chute)
            const plungerY = H - 8 - s.plungerPower * 2;
            ctx.fillStyle = "#ffd600";
            ctx.shadowBlur = 10;
            ctx.shadowColor = "#ffd600";
            ctx.fillRect(LAUNCH_WALL_X + 6, plungerY, LAUNCH_WIDTH - 12, 8);
            ctx.shadowBlur = 0;
            // Plunger power bar
            if (s.plungerPower > 0) {
                ctx.fillStyle = "#ffd600";
                ctx.fillRect(
                    LAUNCH_WALL_X + 12,
                    H - 200 + (200 - s.plungerPower * 10),
                    10,
                    s.plungerPower * 10,
                );
            }

            // Slingshots
            SLINGSHOTS.forEach((tri, i) => {
                const flash = s.slingFlash[i] / 12;
                ctx.beginPath();
                ctx.moveTo(tri.a.x, tri.a.y);
                ctx.lineTo(tri.b.x, tri.b.y);
                ctx.lineTo(tri.c.x, tri.c.y);
                ctx.closePath();
                ctx.fillStyle = tri.color + (flash > 0.1 ? "66" : "22");
                ctx.fill();
                ctx.strokeStyle = tri.color;
                ctx.shadowBlur = 12 + flash * 20;
                ctx.shadowColor = tri.color;
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.shadowBlur = 0;
            });

            // Drop targets
            for (let k = 0; k < DROP_TARGET_COUNT; k++) {
                const rx =
                    DROP_TARGET_START_X +
                    k * (DROP_TARGET_W + DROP_TARGET_GAP);
                const color = DROP_TARGET_COLORS[k];
                const flash = s.targetFlash[k] / 20;
                if (s.targetsUp[k]) {
                    ctx.fillStyle = color;
                    ctx.shadowBlur = 10 + flash * 20;
                    ctx.shadowColor = color;
                    ctx.fillRect(rx, DROP_TARGET_Y, DROP_TARGET_W, DROP_TARGET_H);
                    ctx.shadowBlur = 0;
                    // highlight
                    ctx.fillStyle = "rgba(255,255,255,0.35)";
                    ctx.fillRect(rx + 2, DROP_TARGET_Y + 2, DROP_TARGET_W - 4, 3);
                } else {
                    // Sunk target - show subtle outline
                    ctx.strokeStyle = "rgba(255,255,255,0.15)";
                    ctx.lineWidth = 1;
                    ctx.strokeRect(
                        rx,
                        DROP_TARGET_Y + DROP_TARGET_H - 2,
                        DROP_TARGET_W,
                        2,
                    );
                }
            }

            // Spinner
            {
                ctx.save();
                ctx.translate(SPINNER.x, SPINNER.y);
                ctx.rotate(s.spinnerAngle);
                ctx.strokeStyle = "#ffd600";
                ctx.shadowBlur = 8;
                ctx.shadowColor = "#ffd600";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(-SPINNER.w / 2, 0);
                ctx.lineTo(SPINNER.w / 2, 0);
                ctx.stroke();
                // dots at ends
                ctx.fillStyle = "#ffd600";
                ctx.beginPath();
                ctx.arc(-SPINNER.w / 2, 0, 3, 0, Math.PI * 2);
                ctx.arc(SPINNER.w / 2, 0, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.restore();
                // small mount posts
                ctx.fillStyle = "#ffd60088";
                ctx.beginPath();
                ctx.arc(SPINNER.x - SPINNER.w / 2 - 2, SPINNER.y, 4, 0, Math.PI * 2);
                ctx.arc(SPINNER.x + SPINNER.w / 2 + 2, SPINNER.y, 4, 0, Math.PI * 2);
                ctx.fill();
            }

            // Bumpers
            const allBumpers = [...BUMPERS, ...MINI_BUMPERS];
            allBumpers.forEach((b, i) => {
                const flash = s.bumperFlash[i] / 12;
                const r = b.r + flash * 4;
                ctx.beginPath();
                ctx.arc(b.x, b.y, r + 6, 0, Math.PI * 2);
                ctx.fillStyle = b.color + "22";
                ctx.fill();
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
                ctx.beginPath();
                ctx.arc(b.x, b.y, r * 0.5, 0, Math.PI * 2);
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.fillStyle = "#0a0018";
                ctx.font = `bold ${b.r > 20 ? 10 : 8}px 'Press Start 2P', monospace`;
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
                ctx.beginPath();
                ctx.arc(pivot.x, pivot.y, 5, 0, Math.PI * 2);
                ctx.fillStyle = "#ffffff";
                ctx.fill();
            };
            drawFlipper(LEFT_FLIPPER_PIVOT, s.leftAngle, true, "#00dcff");
            drawFlipper(RIGHT_FLIPPER_PIVOT, s.rightAngle, false, "#ff2fbf");

            // Drain zone indicator
            ctx.fillStyle = "rgba(255, 0, 60, 0.06)";
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

            // Ball trail
            if (s.ballTrail && s.ballTrail.length > 0) {
                for (let i = 0; i < s.ballTrail.length; i++) {
                    const t = s.ballTrail[i];
                    const alpha = ((i + 1) / s.ballTrail.length) * 0.5;
                    ctx.globalAlpha = alpha;
                    ctx.beginPath();
                    ctx.arc(t.x, t.y, BALL_R * (0.4 + 0.6 * (i / s.ballTrail.length)), 0, Math.PI * 2);
                    ctx.fillStyle = "#a0c8ff";
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
            }

            // Ball
            // Outer glow
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_R + 8, 0, Math.PI * 2);
            const glowGrad = ctx.createRadialGradient(
                ball.x, ball.y, BALL_R,
                ball.x, ball.y, BALL_R + 8,
            );
            glowGrad.addColorStop(0, "rgba(160, 200, 255, 0.6)");
            glowGrad.addColorStop(1, "rgba(160, 200, 255, 0)");
            ctx.fillStyle = glowGrad;
            ctx.fill();
            // Ball body
            const ballGrad = ctx.createRadialGradient(
                ball.x - 4,
                ball.y - 4,
                1,
                ball.x,
                ball.y,
                BALL_R,
            );
            ballGrad.addColorStop(0, "#ffffff");
            ballGrad.addColorStop(0.4, "#e8ecff");
            ballGrad.addColorStop(1, "#6060c0");
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
            ctx.fillStyle = ballGrad;
            ctx.shadowBlur = 25;
            ctx.shadowColor = "#a0c8ff";
            ctx.fill();
            ctx.shadowBlur = 0;
            // Ball outline
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
            ctx.lineWidth = 1;
            ctx.stroke();

            // "READY - PRESS SPACE" hint when ball on launcher
            if (status === "playing" && ball.onLaunch && s.plungerPower === 0) {
                const pulse = 0.5 + 0.5 * Math.sin(s.frame * 0.1);
                ctx.font = "bold 11px 'Press Start 2P', monospace";
                ctx.fillStyle = `rgba(255, 214, 0, ${0.6 + pulse * 0.4})`;
                ctx.textAlign = "right";
                ctx.textBaseline = "middle";
                ctx.shadowBlur = 8;
                ctx.shadowColor = "#ffd600";
                // Draw hint to the LEFT of the ball (avoids canvas clipping)
                ctx.fillText("SEGURE", ball.x - 30, ball.y - 12);
                ctx.fillText("ESPACO", ball.x - 30, ball.y + 4);
                ctx.shadowBlur = 0;
                // arrow pointing at ball (from left)
                ctx.strokeStyle = `rgba(255, 214, 0, ${0.6 + pulse * 0.4})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(ball.x - 28, ball.y + 20);
                ctx.lineTo(ball.x - 18, ball.y + 20);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(ball.x - 22, ball.y + 16);
                ctx.lineTo(ball.x - 18, ball.y + 20);
                ctx.lineTo(ball.x - 22, ball.y + 24);
                ctx.stroke();
            }

            rafRef.current = requestAnimationFrame(step);
        };

        rafRef.current = requestAnimationFrame(step);
        return () => {
            running = false;
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [status, initState, spawnBall]);

    useEffect(() => {
        if (status === "gameover" && score > best) {
            setBest(score);
            localStorage.setItem("pinball_best", String(score));
        }
    }, [status, score, best]);

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

                    <div className="hud-card cyan">
                        <div className="hud-label">CORREDORES</div>
                        <div className="lane-lights" data-testid="lane-lights">
                            {lanesLit.map((lit, i) => (
                                <div
                                    key={i}
                                    className={
                                        "lane-light" + (lit ? " lit" : "")
                                    }
                                    style={{
                                        background: lit
                                            ? LANE_DIVIDERS[i].color
                                            : "rgba(255,255,255,0.1)",
                                        boxShadow: lit
                                            ? `0 0 10px ${LANE_DIVIDERS[i].color}`
                                            : "none",
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="hud-card">
                        <div className="hud-label">ALVOS</div>
                        <div className="lane-lights" data-testid="target-lights">
                            {targetsUp.map((up, i) => (
                                <div
                                    key={i}
                                    className={
                                        "lane-light" + (up ? " lit" : "")
                                    }
                                    style={{
                                        background: up
                                            ? DROP_TARGET_COLORS[i]
                                            : "rgba(255,255,255,0.1)",
                                        boxShadow: up
                                            ? `0 0 10px ${DROP_TARGET_COLORS[i]}`
                                            : "none",
                                    }}
                                />
                            ))}
                        </div>
                    </div>
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
                                {status === "intro" ? "PIMBOL" : "GAME OVER"}
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
                    <button
                        className="sound-toggle"
                        data-testid="sound-toggle"
                        onClick={() => setSoundOn((v) => !v)}
                        aria-label="Toggle sound"
                    >
                        {soundOn ? "♪ SOM ON" : "✕ SOM OFF"}
                    </button>
                </div>

                <div className="side-panel right">
                    <div className="hud-card cyan">
                        <div className="hud-label">BOLAS</div>
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
                            <span className="key">←</span>{" "}
                            <span className="key">A</span> — palheta esq.
                            <br />
                            <span className="key">→</span>{" "}
                            <span className="key">D</span> — palheta dir.
                            <br />
                            <span className="key">ESPAÇO</span> — lançar
                            <br />
                            <span className="key">M</span> — mute
                            <br />
                            <span className="key">ENTER</span> — reiniciar
                        </div>
                    </div>

                    <div className="hud-card yellow">
                        <div className="hud-label">PONTUAÇÃO</div>
                        <div className="instructions">
                            Bumper grande — 100/150
                            <br />
                            Bumper mini — 50
                            <br />
                            Slingshot — 25
                            <br />
                            Alvo (drop target) — 250
                            <br />
                            Corredor novo — 50
                            <br />
                            Spinner — 10
                            <br />
                            <br />
                            <span style={{ color: "#ffd600" }}>
                                BÔNUS 5 alvos: +2000
                            </span>
                            <br />
                            <span style={{ color: "#00dcff" }}>
                                BÔNUS 4 lanes: +1500
                            </span>
                        </div>
                    </div>
                </div>
            </div>

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
                    className="mobile-btn launch-btn"
                    data-testid="mobile-launch"
                    onTouchStart={touchLaunch(true)}
                    onTouchEnd={touchLaunch(false)}
                    onMouseDown={touchLaunch(true)}
                    onMouseUp={touchLaunch(false)}
                    onMouseLeave={touchLaunch(false)}
                >
                    LANÇAR
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
