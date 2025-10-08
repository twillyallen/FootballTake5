import { CALENDAR } from "./questions.js?v=20250914c";

const TIME_LIMIT = 15;
const KEY_ATTEMPT_PREFIX = "ft5_attempt_";
const PROD_HOSTS = ["twillyallen.github.io", "pigskin5.com"];
const KEY_RESULT_PREFIX = "ft5_result_";

function isProd(){ return PROD_HOSTS.includes(location.hostname); }
function hasAttempt(d){ return localStorage.getItem(KEY_ATTEMPT_PREFIX + d) === "1"; }
function setAttempt(d){ localStorage.setItem(KEY_ATTEMPT_PREFIX + d, "1"); }
function saveResult(dateStr, payload){ try{ localStorage.setItem(KEY_RESULT_PREFIX + dateStr, JSON.stringify(payload)); }catch{} }
function loadResult(dateStr){ try{ const raw = localStorage.getItem(KEY_RESULT_PREFIX + dateStr); return raw ? JSON.parse(raw) : null; }catch{ return null; } }


let RUN_DATE=null, QUESTIONS=[], current=0, score=0, answered=false, picks=[], timerId=null, timeLeft=TIME_LIMIT;

let startScreen, startBtn, cardSec, resultSec, questionEl, choicesEl, progressEl, timerEl, scoreText, reviewEl, restartBtn, headerEl;

function fillAdById(id){
  const el=document.getElementById(id);
  if(!el || el.dataset.filled==="1") return;
  try{ (window.adsbygoogle = window.adsbygoogle || []).push({}); el.dataset.filled="1"; }catch{}
}

function getRunDateISO(){
  const p=new URLSearchParams(location.search);
  const allowOverride=!isProd();
  if(allowOverride && p.has("date")) return p.get("date");
  const d=new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,"0"); const day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function stopTimer(){ if(timerId) clearInterval(timerId); timerId=null; }
function startTimer(s){
  stopTimer(); timeLeft=s; timerEl.textContent=`${timeLeft}s`;
  timerId=setInterval(()=>{ timeLeft--; timerEl.textContent=`${timeLeft}s`; if(timeLeft<=0){ stopTimer(); pickAnswer(null, QUESTIONS[current].answer); } },1000);
}

// ------- POPUP -------
function openAdPopup(){
  const modal=document.getElementById("adPopup");
  if(!modal) return;
  modal.setAttribute("aria-hidden","false");
  modal.classList.add("open");
  document.body.classList.add("no-scroll");
  fillAdById("adPopupIns"); // only place popup is filled
}
function closeAdPopup(){
  const modal=document.getElementById("adPopup");
  if(!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden","true");
  document.body.classList.remove("no-scroll");
  document.getElementById("startBtn")?.focus();
}
function schedulePopup(){
  const tryOpen=()=>openAdPopup();
  requestAnimationFrame(tryOpen);
  setTimeout(tryOpen,120);
  setTimeout(tryOpen,320);
}

// ------- SCREENS -------
function showStartScreen(){
  document.body.classList.add("start-page");
  document.body.classList.remove("hide-footer");

  const runDate=getRunDateISO();
  if(hasAttempt(runDate)){ showLockedGate(runDate); return; }

  startScreen.classList.remove("hidden");
  cardSec.classList.add("hidden");
  resultSec.classList.add("hidden");
  headerEl?.classList.add("hidden");
  timerEl.style.display="none";
  stopTimer();

  startBtn.disabled=false;
  startBtn.textContent="START";

  schedulePopup(); // show popup on home
}

function startGame(){
  closeAdPopup(); // ensure pop-up gone
  document.body.classList.remove("start-page");
  document.body.classList.add("hide-footer");

  RUN_DATE=getRunDateISO();
  if(hasAttempt(RUN_DATE)){ showLockedGate(RUN_DATE); return; }

  QUESTIONS=CALENDAR[RUN_DATE];
  current=0; score=0; answered=false; picks=[];

  if(!Array.isArray(QUESTIONS) || QUESTIONS.length!==5){
    startScreen.classList.add("hidden");
    cardSec.classList.add("hidden");
    resultSec.classList.remove("hidden");
    headerEl?.classList.add("hidden");
    timerEl.style.display="none";
    scoreText.textContent=`No quiz scheduled for ${RUN_DATE}.`;
    reviewEl.innerHTML = `<div class="rev"><div class="q">Add a set for ${RUN_DATE} in questions.js</div></div>`;
    return;
  }

  startScreen.classList.add("hidden");
  resultSec.classList.add("hidden");
  cardSec.classList.remove("hidden");
  headerEl?.classList.remove("hidden");
  timerEl.style.display="block";

  setAttempt(RUN_DATE);
  renderQuestion();
}

function showResult(){
  document.body.classList.remove("hide-footer");
  cardSec.classList.add("hidden");
  resultSec.classList.remove("hidden");
  headerEl?.classList.add("hidden");
  timerEl.style.display="none";

  scoreText.textContent=`You got ${score} / ${QUESTIONS.length} correct.`;
  reviewEl.innerHTML="";
  picks.forEach(({idx,pick,correct})=>{
    const q=QUESTIONS[idx];
    const div=document.createElement("div"); div.className="rev";
    const qEl=document.createElement("div"); qEl.className="q"; qEl.textContent=q.question;
    const your=pick===null?"No answer":q.choices[pick];
    const you=document.createElement("div"); you.innerHTML=`Your answer: <strong>${your}</strong>`;
    const cor=document.createElement("div"); cor.innerHTML=`Correct: <strong>${q.choices[correct]}</strong>`;
    const ex=document.createElement("div"); ex.className="ex"; ex.textContent=q.explanation ?? "";
    if(pick===correct){ you.style.color="#28a745"; div.style.background="rgba(40,167,69,0.22)"; div.style.border="1px solid rgba(40,167,69,0.45)"; }
    else { you.style.color="#ff4b6b"; div.style.background="rgba(255,75,107,0.13)"; div.style.border="1px solid rgba(255,75,107,0.4)"; }
    div.append(qEl,you,cor,ex); reviewEl.appendChild(div);
  });

  if(score===QUESTIONS.length && typeof confetti==='function'){
    confetti({ particleCount: 160, spread: 70, origin: { y: 0.6 } });
  }

  // Fill the results ad ONLY here
  fillAdById("adResultsIns");
}

function renderQuestion(){
  answered=false;
  const q=QUESTIONS[current];
  questionEl.textContent=q.question;
  progressEl.textContent=`Question ${current+1} / ${QUESTIONS.length}`;
  choicesEl.innerHTML="";
  q.choices.forEach((choice,i)=>{
    const btn=document.createElement("button"); btn.textContent=choice;
    btn.addEventListener("click",()=>pickAnswer(i,q.answer));
    choicesEl.appendChild(btn);
  });
  startTimer(TIME_LIMIT);
}

function pickAnswer(i,correct){
  if(answered) return; answered=true; stopTimer();
  const buttons=Array.from(choicesEl.querySelectorAll("button"));
  buttons.forEach(b=>b.disabled=true);
  if(typeof correct==="number"&&buttons[correct]) buttons[correct].classList.add("correct");
  if(i!==null && i!==correct && typeof i==="number" && buttons[i]) buttons[i].classList.add("wrong");
  if(i===correct) score++;
  picks.push({idx:current,pick:i,correct});
  setTimeout(()=>{ current++; if(current<QUESTIONS.length) renderQuestion(); else showResult(); },700);
}

// Persisted Results -> render on refresh
function renderPersistedResult(dateStr, persisted){
  RUN_DATE = dateStr;
  QUESTIONS = CALENDAR[RUN_DATE] || [];
  picks = Array.isArray(persisted?.picks) ? persisted.picks : [];
  score = Number.isFinite(persisted?.score) ? persisted.score : picks.filter(p => p && p.pick === p.correct).length;

  // Switch to results view
  document.body.classList.remove("no-scroll", "start-page", "hide-footer");
  if (startScreen) startScreen.classList.add("hidden");
  if (cardSec) cardSec.classList.add("hidden");
  if (resultSec) resultSec.classList.remove("hidden");
  headerEl?.classList.add("hidden");
  if (timerEl) timerEl.style.display = "none";

  if (scoreText) scoreText.textContent = `You got ${score} / ${QUESTIONS.length || 5} correct.`;

  if (reviewEl) {
    reviewEl.innerHTML = "";
    picks.forEach(({ idx, pick, correct }) => {
      const q = QUESTIONS[idx] || { question: `Question ${idx + 1}`, choices: ["A","B","C","D"], explanation: "" };
      const div = document.createElement("div"); div.className = "rev";
      const qEl = document.createElement("div"); qEl.className = "q"; qEl.textContent = q.question;
      const yourAnswerText = pick === null ? "No answer" : (q.choices?.[pick] ?? `Choice ${pick + 1}`);
      const you = document.createElement("div"); you.innerHTML = `Your answer: <strong>${yourAnswerText}</strong>`;
      const cor = document.createElement("div"); const correctText = q.choices?.[correct] ?? `Choice ${correct + 1}`; cor.innerHTML = `Correct: <strong>${correctText}</strong>`;
      const ex = document.createElement("div"); ex.className = "ex"; ex.textContent = q.explanation ?? "";
      if (pick === correct) { you.style.color = "#28a745"; div.style.background = "rgba(40,167,69,0.22)"; div.style.border = "1px solid rgba(40,167,69,0.45)"; }
      else { you.style.color = "#ff4b6b"; div.style.background = "rgba(255,75,107,0.13)"; div.style.border = "1px solid rgba(255,75,107,0.4)"; }
      div.append(qEl, you, cor, ex);
      reviewEl.appendChild(div);
    });
  }

  // Fill the results ad
  fillAdById("adResultsIns");
}

// Init
function init(){
  startScreen=document.getElementById("startScreen"); startBtn=document.getElementById("startBtn"); cardSec=document.getElementById("card"); resultSec=document.getElementById("result"); questionEl=document.getElementById("question"); choicesEl=document.getElementById("choices"); progressEl=document.getElementById("progress"); timerEl=document.getElementById("timer"); scoreText=document.getElementById("scoreText"); reviewEl=document.getElementById("review"); restartBtn=document.getElementById("restartBtn"); headerEl=document.querySelector(".header");
  const today = (function(){ const d=new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,"0"); const day=String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${day}`; })();
  const persisted = loadResult(today);
  if (persisted && Array.isArray(persisted.picks)) {
    renderPersistedResult(today, persisted);
  } else {addEventListener("click", startGame); restartBtn?.addEventListener("click", showStartScreen); showStartScreen();
  }

  // Modal close wiring
  const modalEl=document.getElementById("adPopup"); const modalCloseBtn=document.getElementById("adModalClose"); const modalBackdrop=modalEl?.querySelector(".modal-backdrop"); const close=()=>closeAdPopup(); modalCloseBtn?.addEventListener("click", close); modalBackdrop?.addEventListener("click", close); document.addEventListener("keydown", e=>{ if(e.key==="Escape") close(); });

  // Help toggle
  const helpBtn=document.getElementById("helpBtn"); const howTo=document.getElementById("howTo"); const topbar=document.getElementById("topbar");
  function showTopbar(show){ if(!topbar) return; topbar.style.display=show?"flex":"none"; if(!show && howTo){ howTo.hidden=true; helpBtn?.setAttribute("aria-expanded","false"); } }
  helpBtn?.addEventListener("click", ()=>{ if(!howTo) return; const isHidden=howTo.hidden; howTo.hidden=!isHidden; helpBtn.setAttribute("aria-expanded", String(isHidden)); });
  startBtn?.addEventListener("click", ()=>showTopbar(false));
  const mo=new MutationObserver(()=>{ if(resultSec && !resultSec.classList.contains("hidden")) showTopbar(true); });
  if(resultSec) mo.observe(resultSec,{attributes:true, attributeFilter:["class"]});
  restartBtn?.addEventListener("click", ()=>showTopbar(true));
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", init); else init();
