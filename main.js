// main.js

// Dev/prod detection & rollover
const DEV = location.hostname === "localhost" || location.hostname === "127.0.0.1";
// Use local midnight so the live site always shows *your* current day's set
const ROLLOVER = "UTC";

// In production, ignore any dev date overrides that might be lingering
if (!DEV) localStorage.removeItem("nfl-quiz-date-override");

// IMPORTANT: cache-bust *statically* (must be a literal string in import)
import { CALENDAR } from "./questions.js?v=20250914b";

/* ---------------- Date helpers ---------------- */
function todayISO_LOCAL(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function todayISO_UTC(){ const d=new Date(); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`; }
function defaultTodayISO(){ return ROLLOVER === "LOCAL" ? todayISO_LOCAL() : todayISO_UTC(); }

// URL ?date=YYYY-MM-DD > (dev-only) localStorage override > today
function getRunDateISO(){
  const u = new URL(window.location.href);
  const q = u.searchParams.get("date");
  const devOverride = DEV ? localStorage.getItem("nfl-quiz-date-override") : null;
  const iso = q || devOverride || defaultTodayISO();
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : defaultTodayISO();
}

// These are recomputed on Start
let RUN_DATE = getRunDateISO();
let QUESTIONS = CALENDAR[RUN_DATE];

/* ---------------- DOM refs ---------------- */
const headerEl   = document.querySelector(".header");
const startScreen= document.getElementById("startScreen");
const startBtn   = document.getElementById("startBtn");

const cardSec    = document.getElementById("card");
const progressEl = document.getElementById("progress");
const questionEl = document.getElementById("question");
const choicesEl  = document.getElementById("choices");
const nextBtn    = document.getElementById("nextBtn");

const resultSec  = document.getElementById("result");
const scoreText  = document.getElementById("scoreText");
const reviewEl   = document.getElementById("review");
const restartBtn = document.getElementById("restartBtn");
const timerEl    = document.getElementById("timer");

/* ---------------- Timer ---------------- */
const TIME_LIMIT = 12;
const AUTO_ADVANCE_DELAY = 900;

let timeLeft = TIME_LIMIT;
let timerId = null;

function updateTimerUI(){ timerEl.textContent = `${timeLeft}s`; if (timeLeft <= 5) timerEl.classList.add("warning"); else timerEl.classList.remove("warning"); }
function stopTimer(){ if (timerId){ clearInterval(timerId); timerId=null; } }
function resetTimer(){ stopTimer(); timeLeft=TIME_LIMIT; updateTimerUI(); }
function startTimer(){
  stopTimer();
  timerId = setInterval(() => {
    timeLeft--; updateTimerUI();
    if (timeLeft <= 0){ stopTimer(); handleTimeout(); }
  }, 1000);
}

/* ---------------- State ---------------- */
let current = 0;
let score = 0;
let answered = false;
const picks = [];

/* ---------------- Init ---------------- */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

function init(){
  hideNextButton();
  showStartScreen();
  startBtn?.addEventListener("click", startGame);
  restartBtn?.addEventListener("click", showStartScreen);
}

/* ---------------- Start / Quiz ---------------- */
function showStartScreen(){
  document.body.classList.add("starting");   // no scroll on hero
  startScreen.classList.remove("hidden");
  cardSec.classList.add("hidden");
  resultSec.classList.add("hidden");
  headerEl?.classList.add("hidden");
  timerEl.style.display = "none";
  stopTimer();
}

function startGame(){
  document.body.classList.remove("starting");
  RUN_DATE = getRunDateISO();
  QUESTIONS = CALENDAR[RUN_DATE];
  current=0; score=0; answered=false; picks.length=0;

  if (!Array.isArray(QUESTIONS) || QUESTIONS.length !== 5){
    startScreen.classList.add("hidden");
    cardSec.classList.add("hidden");
    resultSec.classList.remove("hidden");
    headerEl?.classList.add("hidden");
    timerEl.style.display = "none";
    scoreText.textContent = `No quiz scheduled for ${RUN_DATE}.`;
    reviewEl.innerHTML = `<div class="rev"><div class="q">Add a set for ${RUN_DATE} in questions.js</div></div>`;
    return;
  }

  startScreen.classList.add("hidden");
  resultSec.classList.add("hidden");
  cardSec.classList.remove("hidden");
  headerEl?.classList.remove("hidden");
  timerEl.style.display = "block";

  renderQuestion();
}

function renderQuestion(){
  progressEl.textContent = `Question ${current + 1} / ${QUESTIONS.length}`;

  const q = QUESTIONS[current];
  questionEl.textContent = q.question;

  choicesEl.innerHTML = "";
  q.choices.forEach((text, i) => {
    const btn = document.createElement("button");
    btn.className = "choice";
    // was: btn.innerHTML = `<span class="letter">${letters[i]}</span>${text}`;
    btn.textContent = text;               // 👈 just the answer text
    btn.addEventListener("click", () => onPick(i, btn));
    choicesEl.appendChild(btn);
  });

  choicesEl.dataset.answerIdx = String(q.answer);
  answered = false;
  resetTimer();
  startTimer();
}




function onPick(choiceIndex, btnEl){
  if (answered) return;
  answered = true; stopTimer();

  const q = QUESTIONS[current];
  [...document.querySelectorAll(".choice")].forEach((b,i)=>{
    b.disabled = true;
    if (i === q.answer) b.classList.add("correct");
  });
  if (choiceIndex !== q.answer) btnEl.classList.add("wrong"); else score++;
  picks.push({ idx: current, pick: choiceIndex, correct: q.answer });

  setTimeout(goNext, AUTO_ADVANCE_DELAY);
}

function handleTimeout(){
  if (answered) return;
  answered = true;
  const answerIdx = Number(choicesEl.dataset.answerIdx);
  [...document.querySelectorAll(".choice")].forEach((b,i)=>{
    b.disabled = true;
    if (i === answerIdx) b.classList.add("correct");
  });
  picks.push({ idx: current, pick: null, correct: answerIdx });
  setTimeout(goNext, AUTO_ADVANCE_DELAY);
}

function goNext(){
  stopTimer();
  if (current < QUESTIONS.length - 1){ current++; renderQuestion(); }
  else showResult();
}

/* ---------------- Results ---------------- */
function showResult(){
  // swap to results
  cardSec.classList.add("hidden");
  resultSec.classList.remove("hidden");
  headerEl?.classList.add("hidden");
  timerEl.style.display = "none";

  // top summary
  scoreText.textContent = `You got ${score} / ${QUESTIONS.length} correct.`;

  // per-question review
  reviewEl.innerHTML = "";

  picks.forEach(({ idx, pick, correct }) => {
    const q = QUESTIONS[idx];

    const div = document.createElement("div");
    div.className = "rev";

    const qEl = document.createElement("div");
    qEl.className = "q";
    qEl.textContent = q.question;

    const yourAnswerText = (pick === null) ? "No answer" : q.choices[pick];

    const you = document.createElement("div");
    you.innerHTML = `Your answer: <strong>${yourAnswerText}</strong>`;

    const cor = document.createElement("div");
    cor.innerHTML = `Correct: <strong>${q.choices[correct]}</strong>`;

    const ex = document.createElement("div");
    ex.className = "ex";
    ex.textContent = q.explanation ?? "";

    // ✅ style per result (green for correct, red for wrong)
    if (pick === correct) {
      you.style.color = "#28a745";                             // bright green text
      div.style.background = "rgba(40, 167, 69, 0.22)";        // light green bg
      div.style.border = "1px solid rgba(40, 167, 69, 0.45)";  // optional border
    } else {
      you.style.color = "#ff4b6b";                             // pink/red text
      div.style.background = "rgba(255, 75, 107, 0.13)";       // light red bg
      div.style.border = "1px solid rgba(255, 75, 107, 0.4)";  // optional border
    }

    div.append(qEl, you, cor, ex);
    reviewEl.appendChild(div);
  });

  injectShareSummary();
}


/* ---------------- Share summary & streak ---------------- */
function injectShareSummary(){
  const title = document.createElement("div");
  title.style.fontWeight = "800";
  title.style.marginBottom = "6px";
  title.textContent = `NFL Daily 5 – ${RUN_DATE}`;

  const emoji = document.createElement("div");
  emoji.style.fontSize = "22px";
  emoji.style.letterSpacing = "2px";
  emoji.style.margin = "4px 0";
  emoji.textContent = picks.map(p => p.pick === p.correct ? "🟩" : "⬜").join("");

  const streakDiv = document.createElement("div");
  streakDiv.style.marginTop = "4px";
  streakDiv.textContent = `Streak: ${computeAndSaveStreak(RUN_DATE)}`;

  resultSec.prepend(streakDiv);
  resultSec.prepend(emoji);
  resultSec.prepend(title);
}

function computeAndSaveStreak(runDateISO){
  const LAST="nfl-quiz-last-date", STRK="nfl-quiz-streak";
  const last = localStorage.getItem(LAST);
  let s = parseInt(localStorage.getItem(STRK) || "0", 10);
  if (!last) s = 1;
  else {
    const d = daysBetweenISO(last, runDateISO);
    if (d === 0) { /* same day */ }
    else if (d === 1) s += 1;
    else s = 1;
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

/* ---------------- Utils ---------------- */
function hideNextButton(){ if (nextBtn) nextBtn.style.display = "none"; }
