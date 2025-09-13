// main.js

// --- Import your scheduled questions (bump the v= when you edit questions.js)
import { CALENDAR } from "./questions.js?v=20250914c";

// --- Config
const TIME_LIMIT = 12; // seconds per question

// --- State
let RUN_DATE = null;
let QUESTIONS = [];
let current = 0;
let score = 0;
let answered = false;
let picks = [];
let timerId = null;
let timeLeft = TIME_LIMIT;

// --- DOM refs (assigned in init())
let startScreen, startBtn, cardSec, resultSec, questionEl, choicesEl;
let progressEl, timerEl, scoreText, reviewEl, restartBtn, headerEl;

// ---------- Utilities ----------
function getRunDateISO() {
  // URL ?date=YYYY-MM-DD takes priority for testing
  const p = new URLSearchParams(window.location.search);
  if (p.has("date")) return p.get("date");

  // default: local "today"
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

function startTimer(seconds) {
  stopTimer();
  timeLeft = seconds;
  timerEl.textContent = `${timeLeft}s`;
  timerId = setInterval(() => {
    timeLeft--;
    timerEl.textContent = `${timeLeft}s`;
    if (timeLeft <= 0) {
      stopTimer();
      pickAnswer(null, QUESTIONS[current].answer); // timeout counts as no answer
    }
  }, 1000);
}

// ---------- Screen Switchers ----------
function showStartScreen() {
  document.body.classList.add("no-scroll"); // lock scroll on Start/Quiz
  startScreen.classList.remove("hidden");
  cardSec.classList.add("hidden");
  resultSec.classList.add("hidden");
  headerEl?.classList.add("hidden");
  timerEl.style.display = "none";
  stopTimer();
}

function startGame() {
  document.body.classList.add("no-scroll"); // keep locked during quiz

  RUN_DATE = getRunDateISO();
  QUESTIONS = CALENDAR[RUN_DATE];

  current = 0;
  score = 0;
  answered = false;
  picks = [];

  if (!Array.isArray(QUESTIONS) || QUESTIONS.length !== 5) {
    // Friendly message if that date isn't scheduled
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

function showResult() {
  document.body.classList.remove("no-scroll"); // allow scroll on Results (mobile)
  cardSec.classList.add("hidden");
  resultSec.classList.remove("hidden");
  headerEl?.classList.add("hidden");
  timerEl.style.display = "none";

  scoreText.textContent = `You got ${score} / ${QUESTIONS.length} correct.`;

  reviewEl.innerHTML = "";
  picks.forEach(({ idx, pick, correct }) => {
    const q = QUESTIONS[idx];

    const div = document.createElement("div");
    div.className = "rev";

    const qEl = document.createElement("div");
    qEl.className = "q";
    qEl.textContent = q.question;

    const yourAnswerText = pick === null ? "No answer" : q.choices[pick];
    const you = document.createElement("div");
    you.innerHTML = `Your answer: <strong>${yourAnswerText}</strong>`;

    const cor = document.createElement("div");
    cor.innerHTML = `Correct: <strong>${q.choices[correct]}</strong>`;

    const ex = document.createElement("div");
    ex.className = "ex";
    ex.textContent = q.explanation ?? "";

    // Color the review card clearly based on correctness
    if (pick === correct) {
      you.style.color = "#28a745";                              // green text
      div.style.background = "rgba(40, 167, 69, 0.22)";         // light green bg
      div.style.border = "1px solid rgba(40, 167, 69, 0.45)";   // optional border
    } else {
      you.style.color = "#ff4b6b";                              // red text
      div.style.background = "rgba(255, 75, 107, 0.13)";        // light red bg
      div.style.border = "1px solid rgba(255, 75, 107, 0.4)";   // optional border
    }

    div.append(qEl, you, cor, ex);
    reviewEl.appendChild(div);
  });

  injectShareSummary();
}

// ---------- Quiz Flow ----------
function renderQuestion() {
  answered = false;

  const q = QUESTIONS[current];
  questionEl.textContent = q.question;
  progressEl.textContent = `Question ${current + 1} / ${QUESTIONS.length}`;

  // Build buttons (no A/B/C labels)
  choicesEl.innerHTML = "";
  q.choices.forEach((choice, i) => {
    const btn = document.createElement("button");
    btn.textContent = choice;
    btn.addEventListener("click", () => pickAnswer(i, q.answer));
    choicesEl.appendChild(btn);
  });

  startTimer(TIME_LIMIT);
}

function pickAnswer(i, correct) {
  if (answered) return;
  answered = true;
  stopTimer();

  // Get all choice buttons for this question
  const buttons = Array.from(choicesEl.querySelectorAll("button"));

  // Disable all buttons to lock the question
  buttons.forEach(b => { b.disabled = true; });

  // Always show the correct one in green
  if (typeof correct === "number" && buttons[correct]) {
    buttons[correct].classList.add("correct");
  }

  // If the user picked a wrong answer (i !== null), mark it red
  if (i !== null && i !== correct && typeof i === "number" && buttons[i]) {
    buttons[i].classList.add("wrong");
  }

  // Score + record
  if (i === correct) score++;
  picks.push({ idx: current, pick: i, correct });

  // Pause briefly so the user sees feedback, then advance
  setTimeout(() => {
    current++;
    if (current < QUESTIONS.length) {
      renderQuestion();
    } else {
      showResult();
    }
  }, 700);
}

function showToast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  // animate in
  requestAnimationFrame(() => t.classList.add("show"));
  // remove after 1.6s
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 200);
  }, 1600);
}

// ---------- Share + Streak ----------
function injectShareSummary() {
  const resultTop = document.getElementById("result");

  // Remove a previous header if we already added one (replay safe)
  const old = resultTop.querySelector(".share-header");
  if (old) old.remove();

  const headerWrap = document.createElement("div");
  headerWrap.className = "share-header";
  headerWrap.style.display = "flex";
  headerWrap.style.alignItems = "center";
  headerWrap.style.gap = "10px";
  headerWrap.style.marginBottom = "8px";

  const squaresText = picks.map(p => (p.pick === p.correct ? "🟩" : "⬜")).join("");

  const emojiLine = document.createElement("div");
  emojiLine.style.fontSize = "22px";
  emojiLine.style.letterSpacing = "2px";
  emojiLine.style.userSelect = "text";
  emojiLine.textContent = squaresText;

  const shareBtn = document.createElement("button");
  shareBtn.id = "shareBtn";
  shareBtn.textContent = "Share";
  shareBtn.style.padding = "6px 12px";
  shareBtn.style.border = "none";
  shareBtn.style.borderRadius = "8px";
  shareBtn.style.background = "#b7f7ff";
  shareBtn.style.color = "#0b1116";
  shareBtn.style.fontWeight = "800";
  shareBtn.style.cursor = "pointer";
shareBtn.addEventListener("click", async () => {
  const squaresText = picks.map(p => (p.pick === p.correct ? "🟩" : "⬜")).join("");
  const shareText = `I scored ${squaresText} in NFL Take 5!`;

  try {
    // 1) Copy to clipboard first so paste is exactly what you want
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(shareText);
    } else {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = shareText;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }

    // 2) Show toast feedback
    showToast("Copied to clipboard");

    // 3) Optionally try native share sheet (non-blocking; clipboard already done)
    if (navigator.share) {
      navigator.share({ text: shareText }).catch(() => { /* ignore */ });
    }
  } catch (e) {
    console.error("Share failed:", e);
    showToast("Could not copy. Try manual paste.");
  }
});


  const streakDiv = document.createElement("div");
  streakDiv.style.marginLeft = "auto";
  streakDiv.textContent = `Streak: ${computeAndSaveStreak(RUN_DATE)}`;

  headerWrap.append(emojiLine, shareBtn, streakDiv);

  // Insert at the very top of results
  resultTop.insertBefore(headerWrap, resultTop.firstChild);

  // Optional date line above
  const dateLine = document.createElement("div");
  dateLine.style.fontWeight = "800";
  dateLine.style.marginBottom = "4px";
  dateLine.textContent = `NFL Daily 5 – ${RUN_DATE}`;
  resultTop.insertBefore(dateLine, headerWrap);
}

function computeAndSaveStreak(dateStr) {
  const KEY_STREAK = "nflStreak";
  const KEY_LAST = "nflLastDate";

  let streak = parseInt(localStorage.getItem(KEY_STREAK) || "0", 10);
  const last = localStorage.getItem(KEY_LAST);

  if (last !== dateStr) {
    // Increment if perfect today; reset otherwise. (Adjust logic if you want.)
    const perfect = picks.every(p => p.pick === p.correct);
    streak = perfect ? streak + 1 : 0;
    localStorage.setItem(KEY_STREAK, String(streak));
    localStorage.setItem(KEY_LAST, dateStr);
  }
  return streak;
}

// ---------- Init ----------
function init() {
  // Grab refs AFTER DOM is ready
  startScreen = document.getElementById("startScreen");
  startBtn     = document.getElementById("startBtn");
  cardSec      = document.getElementById("card");
  resultSec    = document.getElementById("result");
  questionEl   = document.getElementById("question");
  choicesEl    = document.getElementById("choices");
  progressEl   = document.getElementById("progress");
  timerEl      = document.getElementById("timer");
  scoreText    = document.getElementById("scoreText");
  reviewEl     = document.getElementById("review");
  restartBtn   = document.getElementById("restartBtn");
  headerEl     = document.querySelector(".header"); // header is a CLASS in your HTML

  // Wire events safely
  startBtn?.addEventListener("click", startGame);
  restartBtn?.addEventListener("click", showStartScreen);

  // Start on the start screen
  showStartScreen();
}

// Ensure DOM is ready before wiring anything
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
