// main.js
import { CALENDAR } from "./questions.js";

/* -------------------- Daily date (UTC) -------------------- */

// YYYY-MM-DD in UTC so everyone shares the same rollover time (00:00 UTC)
function todayISO_UTC(){
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth()+1).padStart(2,"0");
  const day = String(d.getUTCDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

// Optional preview for testing: index.html?date=YYYY-MM-DD (interpreted as a UTC calendar day)
function getRunDateISO(){
  const u = new URL(window.location.href);
  const q = u.searchParams.get("date");
  return q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : todayISO_UTC();
}

const RUN_DATE = getRunDateISO();
const QUESTIONS = CALENDAR[RUN_DATE];

/* ----------------------------- DOM refs ----------------------------- */

const progressEl = document.getElementById("progress");
const questionEl = document.getElementById("question");
const choicesEl  = document.getElementById("choices");
const nextBtn    = document.getElementById("nextBtn"); // hidden (auto-advance)

const resultSec  = document.getElementById("result");
const scoreText  = document.getElementById("scoreText");
const reviewEl   = document.getElementById("review");
const restartBtn = document.getElementById("restartBtn");
const timerEl    = document.getElementById("timer");

/* ------------------------------ Timer ------------------------------ */

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
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
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

/* ------------------------------ State ------------------------------ */

let current = 0;       // question index
let score = 0;         // number correct
let answered = false;  // lock per question
const picks = [];      // { idx, pick, correct }

/* ------------------------------ Init ------------------------------- */

hideNextButton();

// If the date isn’t scheduled, show a friendly message.
if (!Array.isArray(QUESTIONS) || QUESTIONS.length !== 5) {
  document.getElementById("card").classList.add("hidden");
  resultSec.classList.remove("hidden");
  scoreText.textContent = `No quiz scheduled for ${RUN_DATE}.`;
  reviewEl.innerHTML = `
    <div class="rev">
      <div class="q">Add a set for <strong>${RUN_DATE}</strong> in <code>questions.js</code>:</div>
      <div class="ex">CALENDAR["${RUN_DATE}"] = [ { question, choices:[...4], answer:0..3 }, ... x5 ]</div>
    </div>
  `;
} else {
  renderQuestion();
}

function renderQuestion(){
  const total = QUESTIONS.length;
  progressEl.textContent = `Question ${current + 1} / ${total}`;

  const q = QUESTIONS[current];
  questionEl.textContent = q.question;

  // Build 4 choice buttons in the exact order you authored
  choicesEl.innerHTML = "";
  const letters = ["A","B","C","D"];

  q.choices.forEach((text, i) => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.innerHTML = `<span class="letter">${letters[i]}</span>${text}`;
    btn.addEventListener("click", () => onPick(i, btn));
    choicesEl.appendChild(btn);
  });

  // store the correct index so timeout can reveal it
  choicesEl.dataset.answerIdx = String(q.answer);

  answered = false;

  // (re)start timer
  resetTimer();
  startTimer();

  // show/hide sections
  document.getElementById("card").classList.remove("hidden");
  resultSec.classList.add("hidden");
}

function onPick(choiceIndex, btnEl){
  if (answered) return;
  answered = true;
  stopTimer();

  const q = QUESTIONS[current];
  const buttons = [...document.querySelectorAll(".choice")];

  // Reveal correct; mark wrong if chosen
  buttons.forEach((b, i) => {
    b.setAttribute("disabled", "true");
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

function handleTimeout(){
  if (answered) return;
  answered = true;

  const answerIdx = Number(choicesEl.dataset.answerIdx);
  const buttons = [...document.querySelectorAll(".choice")];

  buttons.forEach((b, i) => {
    b.setAttribute("disabled", "true");
    if (i === answerIdx) b.classList.add("correct");
  });

  picks.push({ idx: current, pick: null, correct: answerIdx });

  setTimeout(goNext, AUTO_ADVANCE_DELAY);
}

function goNext(){
  stopTimer();
  if (current < QUESTIONS.length - 1){
    current++;
    renderQuestion();
  } else {
    showResult();
  }
}

restartBtn.addEventListener("click", () => {
  stopTimer();
  current = 0;
  score = 0;
  answered = false;
  picks.length = 0;
  // reload same day’s questions (useful if you want to replay)
  renderQuestion();
});

/* -------------------- Result + Share/Streak UI -------------------- */

function showResult(){
  document.getElementById("card").classList.add("hidden");
  resultSec.classList.remove("hidden");

  scoreText.textContent = `You got ${score} / ${QUESTIONS.length} correct.`;

  // quick review list
  reviewEl.innerHTML = "";
  const letters = ["A","B","C","D"];

  picks.forEach(({ idx, pick, correct }) => {
    const q = QUESTIONS[idx];

    const div = document.createElement("div");
    div.className = "rev";

    const qEl = document.createElement("div");
    qEl.className = "q";
    qEl.textContent = q.question;

    const yourAnswerText = (pick === null)
      ? "No answer"
      : `${letters[pick]}. ${q.choices[pick]}`;

    const you = document.createElement("div");
    you.innerHTML = `Your answer: <strong>${yourAnswerText}</strong>`;

    const cor = document.createElement("div");
    cor.innerHTML = `Correct: <strong>${letters[correct]}. ${q.choices[correct]}</strong>`;

    const ex = document.createElement("div");
    ex.className = "ex";
    ex.textContent = q.explanation ?? "";

    if (pick === correct) {
      you.style.color = "var(--correct)";
    } else {
      you.style.color = "var(--wrong)";
    }

    div.append(qEl, you, cor, ex);
    reviewEl.appendChild(div);
  });

  injectShareSummary();
}

function injectShareSummary(){
  const containerTitle = document.createElement("div");
  containerTitle.style.fontWeight = "800";
  containerTitle.style.marginBottom = "6px";
  containerTitle.textContent = `NFL Daily 5 – ${RUN_DATE}`;

  const emojiLine = document.createElement("div");
  emojiLine.style.fontSize = "22px";
  emojiLine.style.letterSpacing = "2px";
  emojiLine.style.margin = "4px 0";
  const squares = picks.map(({pick, correct}) => (pick === correct ? "🟩" : "⬜"));
  emojiLine.textContent = squares.join("");

  const streakDiv = document.createElement("div");
  streakDiv.style.marginTop = "4px";
  const streak = computeAndSaveStreak(RUN_DATE);
  streakDiv.textContent = `Streak: ${streak}`;

  const resultTop = document.getElementById("result");
  resultTop.insertBefore(streakDiv, resultTop.firstChild);
  resultTop.insertBefore(emojiLine, resultTop.firstChild);
  resultTop.insertBefore(containerTitle, resultTop.firstChild);
}

/* -------------------------- Streak helpers -------------------------- */

function computeAndSaveStreak(runDateISO){
  const KEY_LAST = "nfl-quiz-last-date";
  const KEY_STREAK = "nfl-quiz-streak";

  const last = localStorage.getItem(KEY_LAST);
  let streak = parseInt(localStorage.getItem(KEY_STREAK) || "0", 10);

  if (!last) {
    streak = 1;
  } else {
    const delta = daysBetweenISO(last, runDateISO);
    if (delta === 0) {
      // same calendar date: don't change streak
    } else if (delta === 1) {
      streak = streak + 1;
    } else {
      streak = 1; // missed at least one day
    }
  }

  localStorage.setItem(KEY_LAST, runDateISO);
  localStorage.setItem(KEY_STREAK, String(streak));
  return streak;
}

function daysBetweenISO(iso1, iso2){
  const [y1,m1,d1] = iso1.split("-").map(Number);
  const [y2,m2,d2] = iso2.split("-").map(Number);
  const t1 = Date.UTC(y1, m1-1, d1);
  const t2 = Date.UTC(y2, m2-1, d2);
  return Math.round((t2 - t1) / (1000*60*60*24));
}

/* ------------------------------ Utility ------------------------------ */

function hideNextButton(){
  if (nextBtn) nextBtn.style.display = "none";
}
