import { CALENDAR } from "./questions.js?v=20250914c";

// ==============================
// Config 
// ==============================
const TIME_LIMIT = 15; // seconds per question
const KEY_ATTEMPT_PREFIX = "ft5_attempt_";
const KEY_RESULT_PREFIX  = "ft5_result_"; // stores {score, picks}
const PROD_HOSTS = ["twillyallen.github.io", "pigskin5.com"]; 

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

    // === DEV OVERRIDE ===
  //return "2025-10-02";   // Change this date to test
  // ====================

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

// ---------- Touchdown Streak (5/5 days) ----------
function computeAndSaveTouchdownStreak(dateStr) {
  const KEY_TD_STREAK = "tdStreak";
  const KEY_TD_LAST   = "tdLastDate";

  let streak = parseInt(localStorage.getItem(KEY_TD_STREAK) || "0", 10);
  const last = localStorage.getItem(KEY_TD_LAST);

  // Only increment once per date when you actually hit a perfect score
  if (last !== dateStr) {
    streak = streak + 1;
    localStorage.setItem(KEY_TD_STREAK, String(streak));
    localStorage.setItem(KEY_TD_LAST, dateStr);
  }
  return streak;
}

// ---------- Locked Result ----------
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
    restartBtn.textContent = "COME BACK TOMORROW!";
    restartBtn.disabled = true;
    restartBtn.style.cursor = "default";
    restartBtn.style.opacity = "0.7";
  }

  injectShareSummary();
}

// ---------- Locked Gate ----------
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
  document.body.classList.remove("no-scroll");
  document.body.classList.remove("hide-footer");

  const runDate = getRunDateISO();
  if (hasAttempt(runDate)) {
    showLockedGate(runDate);
    return;
  }

// --- Add College Edition badge on Saturdays ---
const now = new Date();                     // (use real date in prod)
const isSaturday = now.getDay() === 6;      // Sunday=0 ... Saturday=6
const titleEl = document.querySelector(".game-title");

// Clean up previous badge if navigating back
document.querySelector(".college-badge")?.remove();

if (isSaturday && titleEl) {
  // Ensure the title is in a positioned wrapper
  let wrap = titleEl.closest(".title-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "title-wrap";
    titleEl.parentNode.insertBefore(wrap, titleEl); // wrap before -> then move title inside
    wrap.appendChild(titleEl);

    // OPTIONAL: if your subtitle/tagline should stay with the title, move it into wrap:
    // const tagline = document.querySelector(".tagline"); 
    // if (tagline) wrap.appendChild(tagline);
  }

  // Insert the image badge
  const badge = document.createElement("img");
  badge.className = "college-badge";
  badge.src = "./college.png";           // <-- your file name (put it in the same folder as index.html)
  badge.alt = "College Edition";
  wrap.appendChild(badge);
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
  document.body.classList.remove("no-scroll");
  document.body.classList.add("hide-footer");

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
    reviewEl.innerHTML = `<div class=\"rev\"><div class=\"q\">Add a set for ${RUN_DATE} in questions.js</div></div>`;
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
  document.body.classList.remove("hide-footer");
  cardSec.classList.add("hidden");
  resultSec.classList.remove("hidden");
  headerEl?.classList.add("hidden");
  timerEl.style.display = "none";

  
  // Ensure we start at the top so footer never overlays
  requestAnimationFrame(() => window.scrollTo(0, 0));
if (score === QUESTIONS.length) {
    scoreText.textContent = `TOUCHDOWN! You got ${score} / ${QUESTIONS.length}!`;

    // Save/advance Touchdown Streak (5/5 days)
    computeAndSaveTouchdownStreak(RUN_DATE);

    // Confetti (requires canvas-confetti script on the page)
    if (typeof confetti === "function") {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    }
  } else {
    scoreText.textContent = `You got ${score} / ${QUESTIONS.length} correct.`;
  }

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

// ---------- Quiz Shit ----------
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
  if (!resultTop) return;

  resultTop.querySelectorAll(".share-header,.date-line").forEach(n => n.remove());

  const dateLine = document.createElement("div");
  dateLine.className = "date-line";
  dateLine.textContent = `Pigskin 5 — ${RUN_DATE}`;
  resultTop.insertBefore(dateLine, resultTop.firstChild);

  // Build header (sits under "Your Score")
  const headerWrap = document.createElement("div");
  headerWrap.className = "share-header under-score";

  
  const leftRow = document.createElement("div");
  leftRow.className = "share-left-row";

  const squares = picks.map(p => (p.pick === p.correct ? "🟩" : "⬜")).join("");
  const grid = document.createElement("div");
  grid.className = "share-grid";
  grid.textContent = squares;

  const shareBtn = document.createElement("button");
  shareBtn.id = "shareBtn";
  shareBtn.className = "share-btn";
  shareBtn.textContent = "Share";
  shareBtn.addEventListener("click", async () => {
    const squaresNow = picks.map(p => (p.pick === p.correct ? "🟩" : "⬜")).join("");
    // Check for 5/5
    let shareText;
    if (score === QUESTIONS.length) {
      shareText = `I Scored a Touchdown! ${squaresNow}\n\nhttps://pigskin5.com\n\n@TwillysTakes on X!`;
    } else {
      shareText = `I scored ${squaresNow} in Pigskin 5!\n\nhttps://pigskin5.com\n\n@TwillysTakes on X!`;
    }
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

  leftRow.append(grid, shareBtn);

  // Streaks Tags
  const rightCol = document.createElement("div");
  rightCol.className = "share-right";

  const daily = document.createElement("div");
  daily.className = "pill";
  daily.textContent = `Daily Streak: ${computeAndSaveStreak(RUN_DATE)}`;

  const td = document.createElement("div");
  td.className = "pill";
  td.textContent = `Touchdown Streak: ${localStorage.getItem("tdStreak") || 0}`;

  rightCol.append(daily, td);

  headerWrap.append(leftRow, rightCol);

  // ---- Insert header directly under the "Your Score" line ----
  const anchor = document.getElementById("scoreText");
  if (anchor && anchor.parentNode) {
    anchor.parentNode.insertBefore(headerWrap, anchor.nextSibling);
  } else {
    const review = document.getElementById("review");
    if (review && review.parentNode) {
      review.parentNode.insertBefore(headerWrap, review);
    } else {
      resultTop.appendChild(headerWrap);
    }
  }
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


// ---- Header controls (help/about) ----
(function(){
  const helpBtn = document.getElementById('helpBtn');
  const howTo = document.getElementById('howTo');
  const aboutBtn = document.getElementById('aboutBtn');
  const startScreen = document.getElementById('startScreen');
  const quizCard = document.getElementById('card');
  const result = document.getElementById('result');
  const topbar = document.getElementById('topbar');
  const restartBtn = document.getElementById('restartBtn');

  function showTopbar(show){
    if(!topbar) return;
    topbar.style.display = show ? 'flex' : 'none';
    // Hide howto when hiding the topbar
    if(!show && howTo) { howTo.hidden = true; helpBtn?.setAttribute('aria-expanded','false'); }
  }

  // Toggle How-to panel
  helpBtn?.addEventListener('click', () => {
    if(!howTo) return;
    const isHidden = howTo.hidden;
    howTo.hidden = !isHidden;
    helpBtn.setAttribute('aria-expanded', String(isHidden));
  });

  // Hide header when game starts; show again on results
  const startBtn = document.getElementById('startBtn');
  startBtn?.addEventListener('click', () => {
    showTopbar(false);
  });

  // If your game swaps screens by toggling 'hidden' class, observe result section
  const mo = new MutationObserver(() => {
    if(result && !result.classList.contains('hidden')){
      showTopbar(true);
    }
  });
  if(result) mo.observe(result, { attributes: true, attributeFilter: ['class'] });

  // On restart, header should be visible (back to start screen)
  restartBtn?.addEventListener('click', () => showTopbar(true));
})();

// ---- Render quiz rectangle ad after game starts ----
function renderQuizAd(){
  try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch(e){}
}
document.getElementById('startBtn')?.addEventListener('click', () => {
  setTimeout(renderQuizAd, 250);
});
