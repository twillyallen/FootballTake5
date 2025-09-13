// main.js
// --- Daily rollover mode: "UTC" or "LOCAL"
const ROLLOVER = "UTC";

// IMPORTANT: cache-bust for questions.js (bump when you change questions)
import { CALENDAR } from "./questions.js?v=20250913a";

/* ========================= Date helpers ========================= */

function todayISO_UTC() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
}
function todayISO_LOCAL() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function defaultTodayISO() {
  return ROLLOVER === "LOCAL" ? todayISO_LOCAL() : todayISO_UTC();
}

// ?date=YYYY-MM-DD (URL) > localStorage override > today
function getRunDateISO() {
  const u = new URL(window.location.href);
  const q = u.searchParams.get("date");
  const override = localStorage.getItem("nfl-quiz-date-override");
  const iso = q || override || defaultTodayISO();
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : defaultTodayISO();
}

// These are recomputed when Start is pressed
let RUN_DATE = getRunDateISO();
let QUESTIONS = CALENDAR[RUN_DATE];

/* ============================ DOM refs =========================== */

const headerEl   = document.querySelector(".header");
const startScreen= document.getElementById("startScreen");
const startBtn   = document.getElementById("startBtn");

const cardSec    = document.getElementById("card");
const progressEl = document.getElementById("progress");
const questionEl = document.getElementById("question");
const choicesEl  = document.getElementById("choices");
const nextBtn    = document.getElementById("nextBtn"); // unused (auto-advance)

const resultSec  = document.getElementById("result");
const scoreText  = document.getElementById("scoreText");
const reviewEl   = document.getElementById("review");
const restartBtn = document.getElementById("restartBtn");
const timerEl    = document.getElementById("timer");

/* ============================== Timer ============================ */

const TIME_LIMIT = 12;          // seconds per question
const AUTO_ADVANCE_DELAY = 900; // ms after answer/timeout

let timeLeft = TIME_LIMIT;
let timerId = null;

function updateTimerUI() {
  timerEl.textContent = `${timeLeft}s`;
  if (timeLeft <= 5) timerEl.classList.add("warning");
  else timerEl.classList.remove("warning");
}
function stopTimer() {
  if (timerId !== null) { clearInterval(timerId); timerId = null; }
}
function resetTimer() {
  stopTimer();
  timeLeft = TIME_LIMIT;
  updateTimerUI();
}
function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    timeLeft--;
    updateTimerUI();
    if (timeLeft <= 0) {
      stopTimer();
      handleTimeout();
    }
  }, 1000);
}

/* ============================== State ============================ */

let current = 0;       // question index
let score = 0;         // correct count
let answered = false;  // lock per question
const picks = [];      // { idx, pick, correct }

/* =============================== Init ============================ */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

function init() {
  // Ensure the quiz board is hidden at load; show Start screen only
  hideNextButton();
  showStartScreen();

  if (startBtn) startBtn.addEventListener("click", startGame);
  if (restartBtn) restartBtn.addEventListener("click", showStartScreen);
}

/* ============================ Start page ========================= */

function showStartScreen() {
  startScreen.classList.remove("hidden");
  cardSec.classList.add("hidden");
  resultSec.classList.add("hidden");
  headerEl.classList.add("hidden"); // hide header (progress/timer) on Start
  timerEl.style.display = "none";   // extra safety
  stopTimer();
}

function startGame() {
  // Recompute date & questions (so ?date= or localStorage override apply)
  RUN_DATE = getRunDateISO();
  QUESTIONS = CALENDAR[RUN_DATE];

  current = 0;
  score = 0;
  answered = false;
  picks.length = 0;

  if (!Array.isArray(QUESTIONS) || QUESTIONS.length !== 5) {
    startScreen.classList.add("hidden");
    cardSec.classList.add("hidden");
    resultSec.classList.remove("hidden");
    headerEl.classList.add("hidden");
    timerEl.style.display = "none";
    scoreText.textContent = `No quiz scheduled for ${RUN_DATE}.`;
    reviewEl.innerHTML = `
      <div class="rev">
        <div class="q">Add a set for <strong>${RUN_DATE}</strong> in <code>questions.js</code>.</div>
        <div class="ex">CALENDAR["${RUN_DATE}"] = [ { question, choices:[...4], answer:0..3 }, ... x5 ]</div>
      </div>`;
    return;
  }

  startScreen.classList.add("hidden");
  resultSec.classList.add("hidden");
  cardSec.classList.remove("hidden");
  headerEl.classList.remove("hidden"); // show header (progress/timer) during quiz
  timerEl.style.display = "block";

  renderQuestion();
}

/* ============================ Quiz flow ========================== */

function renderQuestion() {
  progressEl.textContent = `Question ${current + 1} / ${QUESTIONS.length}`;

  const q = QUESTIONS[current];
  questionEl.textContent = q.question;

  // Build choices
  choicesEl.innerHTML = "";
  const letters = ["A","B","C","D"];
  q.choices.forEach((text, i) => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.innerHTML = `<span class="letter">${letters[i]}</span>${text}`;
    btn.addEventListener("click", () => onPick(i, btn));
    choicesEl.appendChild(btn);
  });

  // For timeout reveal
  choicesEl.dataset.answerIdx = String(q.answer);

  answered = false;
  resetTimer();
  startTimer();
}

function onPick(choiceIndex, btnEl) {
  if (answered) return;
  answered = true;
  stopTimer();

  const q = QUESTIONS[current];
  const buttons = [...document.querySelectorAll(".choice")];

  buttons.forEach((b, i) => {
    b.disabled = true;
    if (i === q.answer) b.classList.add("correct");
  });
  if (choiceIndex !== q.answer) {
    btnEl.classList.add("wrong");
  } else {
    score++;
  }

  picks.push({ idx: current, pick: choiceIndex, correct: q.answer });

  setTimeout(goNext, AUTO_ADVANCE_DELAY);
}

function handleTimeout() {
  if (answered) return;
  answered = true;

  const answerIdx = Number(choicesEl.dataset.answerIdx);
  const buttons = [...document.querySelectorAll(".choice")];

  buttons.forEach((b, i) => {
    b.disabled = true;
    if (i === answerIdx) b.classList.add("correct");
  });

  picks.push({ idx: current, pick: null, correct: answerIdx });

  setTimeout(goNext, AUTO_ADVANCE_DELAY);
}

function goNext() {
  stopTimer();
  if (current < QUESTIONS.length - 1) {
    current++;
    renderQuestion();
  } else {
    showResult();
  }
}

/* ============================ Results page ======================= */

function showResult() {
  cardSec.classList.add("hidden");
  resultSec.classList.remove("hidden");
  headerEl.classList.add("hidden");  // hide header on results
  timerEl.style.display = "none";

  scoreText.textContent = `You got ${score} / ${QUESTIONS.length} correct.`;

  reviewEl.innerHTML = "";
  const letters = ["A","B","C","D"];
  picks.forEach(({ idx, pick, correct }) => {
    const q = QUESTIONS[idx];
    const div = document.createElement("div");
    div.className = "rev";

    const yourAnswerText = (pick === null)
      ? "No answer"
      : `${letters[pick]}. ${q.choices[pick]}`;

    div.innerHTML = `
      <div class="q">${q.question}</div>
      <div>Your answer: <strong>${yourAnswerText}</strong></div>
      <div>Correct: <strong>${letters[correct]}. ${q.choices[correct]}</strong></div>
      ${q.explanation ? `<div class="ex">${q.explanation}</div>` : "" }
    `;
    reviewEl.appendChild(div);
  });

  injectShareSummary();
}

/* ====================== Share summary & Streak =================== */

function injectShareSummary() {
  const resultTop = document.getElementById("result");

  const title = document.createElement("div");
  title.style.fontWeight = "800";
  title.style.marginBottom = "6px";
  title.textContent = `NFL Daily 5 – ${RUN_DATE}`;

  const emoji = document.createElement("div");
  emoji.style.fontSize = "22px";
  emoji.style.letterSpacing = "2px";
  emoji.style.margin = "4px 0";
  emoji.textContent = picks.map(p => (p.pick === p.correct ? "🟩" : "⬜")).join("");

  const streakDiv = document.createElement("div");
  streakDiv.style.marginTop = "4px";
  streakDiv.textContent = `Streak: ${computeAndSaveStreak(RUN_DATE)}`;

  resultTop.insertBefore(streakDiv, resultTop.firstChild);
  resultTop.insertBefore(emoji, resultTop.firstChild);
  resultTop.insertBefore(title, resultTop.firstChild);
}

function computeAndSaveStreak(runDateISO){
  const LAST="nfl-quiz-last-date", STRK="nfl-quiz-streak";
  const last = localStorage.getItem(LAST);
  let s = parseInt(localStorage.getItem(STRK) || "0", 10);
  if (!last) s = 1;
  else {
    const d = daysBetweenISO(last, runDateISO);
    if (d === 0) {}           // same day, keep
    else if (d === 1) s += 1; // consecutive day
    else s = 1;               // missed day(s)
  }
  localStorage.setItem(LAST, runDateISO);
  localStorage.setItem(STRK, String(s));
  return s;
}
function daysBetweenISO(a,b){
  const [y1,m1,d1]=a.split("-").map(Number);
  const [y2,m2,d2]=b.split("-").map(Number);
  return Math.round((Date.UTC(y2,m2-1,d2)-Date.UTC(y1,m1-1,d1))/(1000*60*60*24));
}

/* ============================== Utils ============================ */

function hideNextButton(){ if (nextBtn) nextBtn.style.display = "none"; }
