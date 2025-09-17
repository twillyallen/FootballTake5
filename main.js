
import { CALENDAR } from "./questions.js?v=20250914c";

// ==============================
// Config 
// ==============================
const TIME_LIMIT = 12; // seconds per question
const KEY_ATTEMPT_PREFIX = "ft5_attempt_";
const KEY_RESULT_PREFIX  = "ft5_result_"; // stores {score, picks}
const PROD_HOSTS = ["twillyallen.github.io", "footballtake5.com"]; // add custom domain when ready

function isProd() {
  return PROD_HOSTS.includes(location.hostname);
}
function hasAttempt(dateStr) {
  return localStorage.getItem(KEY_ATTEMPT_PREFIX + dateStr) === "1";
}
function setAttempt(dateStr) {
  localStorage.setItem(KEY_ATTEMPT_PREFIX + dateStr, "1");
}
function saveResult(dateStr, payload) {
  try { localStorage.setItem(KEY_RESULT_PREFIX + dateStr, JSON.stringify(payload)); } catch {}
}
function loadResult(dateStr) {
  try {
    const raw = localStorage.getItem(KEY_RESULT_PREFIX + dateStr);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

// --- State
let RUN_DATE = null;
let QUESTIONS = [];
let current = 0;
let score = 0;
let answered = false;
let picks = [];
let timerId = null;
let timeLeft = TIME_LIMIT;

// --- DOM refs
let startScreen, startBtn, cardSec, resultSec, questionEl, choicesEl;
let progressEl, timerEl, scoreText, reviewEl, restartBtn, headerEl;

// ---------- Utilities ----------
function getRunDateISO() {
  const p = new URLSearchParams(window.location.search);
  const allowOverride = !isProd();
  if (allowOverride && p.has("date")) return p.get("date");

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
      pickAnswer(null, QUESTIONS[current].answer);
    }
  }, 1000);
}

// ---------- Streak Counter ----------
function computeAndSaveStreak(dateStr) {
  const KEY_STREAK = "dailyStreak";
  const KEY_LAST = "dailyLastDate";

  let streak = parseInt(localStorage.getItem(KEY_STREAK) || "0", 10);
  const last = localStorage.getItem(KEY_LAST);

  if (last !== dateStr) {
    streak = streak + 1; 
    localStorage.setItem(KEY_STREAK, String(streak));
    localStorage.setItem(KEY_LAST, dateStr);
  }
  return streak;
}

// ---------- Locked Result (persisted) ----------
function renderPersistedResult(dateStr, persisted) {
  RUN_DATE = dateStr;
  QUESTIONS = CALENDAR[RUN_DATE] || [];
  picks = Array.isArray(persisted?.picks) ? persisted.picks : [];
  score = Number.isFinite(persisted?.score) ? persisted.score : picks.filter(p => p && p.pick === p.correct).length;

  document.body.classList.remove("no-scroll");
  startScreen.classList.add("hidden");
  cardSec.classList.add("hidden");
  resultSec.classList.remove("hidden");
  headerEl?.classList.add("hidden");
  timerEl.style.display = "none";

  scoreText.textContent = `You got ${score} / ${QUESTIONS.length || 5} correct.`;

  reviewEl.innerHTML = "";
  picks.forEach(({ idx, pick, correct }) => {
    const q = QUESTIONS[idx] || { question: `Question ${idx + 1}`, choices: ["A","B","C","D"], explanation: "" };

    const div = document.createElement("div");
    div.className = "rev";

    const qEl = document.createElement("div");
    qEl.className = "q";
    qEl.textContent = q.question;

    const yourAnswerText = pick === null ? "No answer" : q.choices?.[pick] ?? `Choice ${pick + 1}`;
    const you = document.createElement("div");
    you.innerHTML = `Your answer: <strong>${yourAnswerText}</strong>`;

    const cor = document.createElement("div");
    const correctText = q.choices?.[correct] ?? `Choice ${correct + 1}`;
    cor.innerHTML = `Correct: <strong>${correctText}</strong>`;

    const ex = document.createElement("div");
    ex.className = "ex";
    ex.textContent = q.explanation ?? "";

    if (pick === correct) {
      you.style.color = "#28a745";
      div.style.background = "rgba(40, 167, 69, 0.22)";
      div.style.border = "1px solid rgba(40, 167, 69, 0.45)";
    } else {
      you.style.color = "#ff4b6b";
      div.style.background = "rgba(255, 75, 107, 0.13)";
      div.style.border = "1px solid rgba(255, 75, 107, 0.4)";
    }

    div.append(qEl, you, cor, ex);
    reviewEl.appendChild(div);
  });

  if (restartBtn) {
    restartBtn.style.display = "inline-block";
    restartBtn.textContent = "COME BACK TOMORROW";
    restartBtn.disabled = true;
    restartBtn.style.cursor = "default";
    restartBtn.style.opacity = "0.7";
  }

  injectShareSummary();
}

// ---------- Locked Gate (fallback) ----------
function showLockedGate(dateStr) {
  const persisted = loadResult(dateStr);
  if (persisted) {
    renderPersistedResult(dateStr, persisted);
    return;
  }

  document.body.classList.remove("no-scroll");
  startScreen.classList.add("hidden");
  cardSec.classList.add("hidden");
  resultSec.classList.remove("hidden");
  headerEl?.classList.add("hidden");
  timerEl.style.display = "none";
  scoreText.textContent = `You already played ${dateStr}. Come back tomorrow!`;
  reviewEl.innerHTML = "";
  if (restartBtn) {
    restartBtn.style.display = "inline-block";
    restartBtn.textContent = "COME BACK TOMORROW";
    restartBtn.disabled = true;
    restartBtn.style.cursor = "default";
    restartBtn.style.opacity = "0.7";
  }
}

// ---------- Screen Switchers ----------
function showStartScreen() {
  document.body.classList.add("no-scroll");

  const today = getRunDateISO();
  if (hasAttempt(today)) {
    showLockedGate(today);
    return;
  }

  startScreen.classList.remove("hidden");
  cardSec.classList.add("hidden");
  resultSec.classList.add("hidden");
  headerEl?.classList.add("hidden");
  timerEl.style.display = "none";
  stopTimer();

  startBtn.disabled = false;
  startBtn.textContent = "START";
}

function startGame() {
  document.body.classList.add("no-scroll");

  RUN_DATE = getRunDateISO();
  if (hasAttempt(RUN_DATE)) {
    showLockedGate(RUN_DATE);
    return;
  }

  QUESTIONS = CALENDAR[RUN_DATE];

  current = 0;
  score = 0;
  answered = false;
  picks = [];

  if (!Array.isArray(QUESTIONS) || QUESTIONS.length !== 5) {
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

  setAttempt(RUN_DATE);
  renderQuestion();
}

function showResult() {
  document.body.classList.remove("no-scroll");
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

    if (pick === correct) {
      you.style.color = "#28a745";
      div.style.background = "rgba(40, 167, 69, 0.22)";
      div.style.border = "1px solid rgba(40, 167, 69, 0.45)";
    } else {
      you.style.color = "#ff4b6b";
      div.style.background = "rgba(255, 75, 107, 0.13)";
      div.style.border = "1px solid rgba(255, 75, 107, 0.4)";
    }

    div.append(qEl, you, cor, ex);
    reviewEl.appendChild(div);
  });

  saveResult(RUN_DATE, { score, picks });

  if (restartBtn) {
    restartBtn.style.display = "inline-block";
    restartBtn.textContent = "COME BACK TOMORROW";
    restartBtn.disabled = true;
    restartBtn.style.cursor = "default";
    restartBtn.style.opacity = "0.7";
  }

  injectShareSummary();
}

// ---------- Quiz Flow ----------
function renderQuestion() {
  answered = false;
  const q = QUESTIONS[current];
  questionEl.textContent = q.question;
  progressEl.textContent = `Question\n ${current + 1} / ${QUESTIONS.length}`;
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
  const buttons = Array.from(choicesEl.querySelectorAll("button"));
  buttons.forEach(b => { b.disabled = true; });
  if (typeof correct === "number" && buttons[correct]) buttons[correct].classList.add("correct");
  if (i !== null && i !== correct && typeof i === "number" && buttons[i]) buttons[i].classList.add("wrong");
  if (i === correct) score++;
  picks.push({ idx: current, pick: i, correct });
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
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 200);
  }, 1600);
}

// ---------- Share + Streak ----------
function injectShareSummary() {
  const resultTop = document.getElementById("result");
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
    const shareText = `I scored ${squaresText} in Football Take-5! \n \n https://twillyallen.github.io/FootballTake5/\n\n@TwillysTakes on X!`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareText);
      } else {
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
      showToast("Copied to clipboard");
      if (navigator.share) navigator.share({ text: shareText }).catch(() => {});
    } catch (e) {
      console.error("Share failed:", e);
      showToast("Could not copy. Try manual paste.");
    }
  });

  const streakDiv = document.createElement("div");
  streakDiv.style.marginLeft = "auto";
  streakDiv.textContent = `Daily Streak: ${computeAndSaveStreak(RUN_DATE)}`;

  headerWrap.append(emojiLine, shareBtn, streakDiv);
  resultTop.insertBefore(headerWrap, resultTop.firstChild);
  const dateLine = document.createElement("div");
  dateLine.style.fontWeight = "800";
  dateLine.style.marginBottom = "4px";
  dateLine.textContent = `Football Take-5 – ${RUN_DATE}`;
  resultTop.insertBefore(dateLine, headerWrap);
}

// ---------- Init ----------
function init() {
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
  headerEl     = document.querySelector(".header");

  startBtn?.addEventListener("click", startGame);
  restartBtn?.addEventListener("click", showStartScreen);
  showStartScreen();

  const menuBtn = document.getElementById("menu-toggle");
const menu = document.getElementById("menu");

menuBtn?.addEventListener("click", () => {
  menu.classList.toggle("hidden");
});

}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
