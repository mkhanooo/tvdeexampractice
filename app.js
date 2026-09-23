(function(){
  "use strict";

  var S = window.TVDE_SHARED;
  var CATS = S.CATS;
  var esc = S.esc;
  var shuffle = S.shuffle;
  var hasImage = S.hasImage;

  var ORIGINAL_QUESTIONS = null; // filled from the server (or bundled questions.js as fallback) on boot

  // ---------- EMOJI-WANDER GATE ----------
  // Not real auth — a stylish placeholder shown before the app: ~50 emoji
  // drift around the screen, and clicking the hidden 🎈 reveals the real page.
  // No persistence — every reload shows the gate again.

  // Deterrent only — not real protection. Blocks right-click, copy/cut, and
  // text selection on the quiz page (questions.js/questions.json are still
  // plain files anyone with the source can read).
  document.addEventListener("contextmenu", function(e){ e.preventDefault(); });
  document.addEventListener("copy", function(e){ e.preventDefault(); });
  document.addEventListener("cut", function(e){ e.preventDefault(); });
  document.addEventListener("selectstart", function(e){ e.preventDefault(); });

  S.initThemeToggle(document.getElementById("btnTheme"));

  function modeLabel(mode){
    if(mode === "practice-binary") return "Practice — True/False, Sim/Não & A/B";
    if(mode === "practice-abc") return "Practice — A/B/C";
    return "Full Test";
  }
  function isBinaryCat(cat){ return cat === "SN" || cat === "VF" || cat === "AB"; }

  var state = {
    questions: [],
    screen: "home",
    quiz: null
  };

  var mainWrap = document.getElementById("mainWrap");

  // ---------- HOME ----------
  function renderHome(){
    var total = state.questions.length;
    var poolBinary = state.questions.filter(function(q){ return isBinaryCat(q.category); });
    var poolAbc = state.questions.filter(function(q){ return q.category === "ABC"; });

    var practiceBinaryDefault = Math.min(100, poolBinary.length) || 0;
    var practiceAbcDefault = Math.min(100, poolAbc.length) || 0;
    var testDefault = Math.min(100, total) || 0;

    mainWrap.innerHTML =
      '<div id="bankInfo">Question bank: <strong>' + total + '</strong> questions — ' + poolBinary.length + ' binary (Sim/Não, Verdadeiro/Falso, A/B) and ' + poolAbc.length + ' with A/B/C options.' +
      (total < 70 ? ' <span style="color:var(--warn)">Add more in "Manage Questions" if you want a larger full test.</span>' : '') +
      '</div>' +
      '<div class="grid3">' +
        '<div class="card mode-card">' +
          '<h2>📗 Practice — Binary</h2>' +
          '<p>True/False, Sim/Não and Option A/B questions only (includes any picture questions). No feedback until you submit.</p>' +
          '<div class="count-row">' +
            '<label for="pb-count">Questions:</label>' +
            '<input type="number" id="pb-count" min="1" max="' + poolBinary.length + '" value="' + practiceBinaryDefault + '">' +
            '<span class="hint">/ ' + poolBinary.length + ' available</span>' +
          '</div>' +
          '<button class="btn primary block" id="btnStartPB" ' + (poolBinary.length===0?"disabled":"") + '>Start</button>' +
        '</div>' +
        '<div class="card mode-card">' +
          '<h2>📙 Practice — A/B/C</h2>' +
          '<p>Three-option multiple choice questions only. No feedback until you submit.</p>' +
          '<div class="count-row">' +
            '<label for="pc-count">Questions:</label>' +
            '<input type="number" id="pc-count" min="1" max="' + poolAbc.length + '" value="' + practiceAbcDefault + '">' +
            '<span class="hint">/ ' + poolAbc.length + ' available</span>' +
          '</div>' +
          '<button class="btn primary block" id="btnStartPC" ' + (poolAbc.length===0?"disabled":"") + '>Start</button>' +
        '</div>' +
        '<div class="card mode-card">' +
          '<h2>📝 Full Test</h2>' +
          '<p>All categories mixed together, simulating the real exam. Results shown only at the end.</p>' +
          '<div class="count-row">' +
            '<label for="test-count">Questions:</label>' +
            '<input type="number" id="test-count" min="1" max="' + total + '" value="' + testDefault + '">' +
            '<span class="hint">/ ' + total + ' available</span>' +
          '</div>' +
          '<button class="btn primary block" id="btnStartTest" ' + (total===0?"disabled":"") + '>Start</button>' +
        '</div>' +
      '</div>' +
      '<footer class="note">Thanks for Using the App!</footer>';

    document.getElementById("btnStartPB").onclick = function(){
      startQuiz("practice-binary", clampCount(document.getElementById("pb-count").value, poolBinary.length), isBinaryCat);
    };
    document.getElementById("btnStartPC").onclick = function(){
      startQuiz("practice-abc", clampCount(document.getElementById("pc-count").value, poolAbc.length), function(cat){ return cat === "ABC"; });
    };
    document.getElementById("btnStartTest").onclick = function(){
      startQuiz("test", clampCount(document.getElementById("test-count").value, total), null);
    };
  }
  function clampCount(v, total){
    var n = parseInt(v,10);
    if(isNaN(n) || n < 1) n = 1;
    if(n > total) n = total;
    return n;
  }

  // ---------- QUIZ ----------
  // practice-binary: never shuffled — grouped by category, AB first, then SN, then VF.
  // practice-abc: never shuffled — picture questions first, then the rest in bank order.
  // test (Full Test / exam): the only mode that shuffles, and still guarantees any
  // picture question is included (as many as fit within the requested count).
  function selectBinary(basePool, count){
    var ab = basePool.filter(function(q){ return q.category === "AB"; });
    var sn = basePool.filter(function(q){ return q.category === "SN"; });
    var vf = basePool.filter(function(q){ return q.category === "VF"; });
    return ab.concat(sn, vf).slice(0, count);
  }
  function selectAbc(basePool, count){
    var withImg = basePool.filter(hasImage);
    var withoutImg = basePool.filter(function(q){ return !hasImage(q); });
    return withImg.concat(withoutImg).slice(0, count);
  }
  function selectTest(basePool, count){
    var withImg = shuffle(basePool.filter(hasImage));
    var withoutImg = shuffle(basePool.filter(function(q){ return !hasImage(q); }));
    var picked;
    if(withImg.length >= count){
      picked = withImg.slice(0, count);
    } else {
      picked = withImg.concat(withoutImg.slice(0, count - withImg.length));
    }
    return shuffle(picked); // don't cluster picture questions together
  }
  function startQuiz(mode, count, filterFn){
    var basePool = filterFn ? state.questions.filter(function(q){ return filterFn(q.category); }) : state.questions;
    var picked;
    if(mode === "practice-binary") picked = selectBinary(basePool, count);
    else if(mode === "practice-abc") picked = selectAbc(basePool, count);
    else picked = selectTest(basePool, count);

    var list = picked.map(function(q){
      return {
        id: q.id,
        category: q.category,
        customLabel: q.customLabel,
        text: q.text,
        options: q.options.slice(),
        correctIndex: q.correctIndex,
        image: q.image,
        imageSvg: q.imageSvg,
        explanation: q.explanation
      };
    });
    state.quiz = { mode: mode, list: list, answers: new Array(list.length).fill(null), current: 0 };
    state.screen = "quiz";
    renderQuiz();
  }

  function renderQuiz(){
    var quiz = state.quiz;
    var i = quiz.current;
    var q = quiz.list[i];
    var total = quiz.list.length;
    var selected = quiz.answers[i];
    var letters = "ABCDEFGH";
    var answeredCount = quiz.answers.filter(function(a){ return a !== null; }).length;

    var navHtml = quiz.list.map(function(_, idx){
      var cls = "navnum";
      if(idx === i) cls += " current";
      if(quiz.answers[idx] !== null) cls += " answered";
      return '<button class="' + cls + '" data-nav="' + idx + '">' + (idx+1) + '</button>';
    }).join("");

    var optsHtml = q.options.map(function(opt, idx){
      var sel = (selected === idx);
      return '<div class="option ' + (sel?"selected":"") + '" data-idx="' + idx + '">' +
        '<div class="letter">' + letters[idx] + '</div>' +
        '<div class="otext">' + esc(opt) + '</div>' +
      '</div>';
    }).join("");

    var imageHtml = "";
    if(q.imageSvg){ imageHtml = '<div class="q-image">' + q.imageSvg + '</div>'; }
    else if(q.image){ imageHtml = '<div class="q-image"><img src="' + q.image + '" alt="Question image"></div>'; }

    mainWrap.innerHTML =
      '<div class="nav-strip">' + navHtml + '</div>' +
      '<div class="progress-bar"><div class="progress-fill" style="width:' + Math.round((answeredCount/total)*100) + '%"></div></div>' +
      '<div class="card">' +
        '<div class="q-meta">' +
          '<span class="qnum">Question ' + (i+1) + ' of ' + total + ' — ' + modeLabel(quiz.mode) + '</span>' +
        '</div>' +
        imageHtml +
        '<div class="q-text">' + esc(q.text) + '</div>' +
        '<div id="optsHolder">' + optsHtml + '</div>' +
        '<div class="quiz-nav">' +
          '<button class="btn" id="btnPrev" ' + (i===0?"disabled":"") + '>◀ Previous</button>' +
          '<div class="spacer"></div>' +
          (i === total-1
            ? '<button class="btn primary" id="btnSubmit">Submit Exam</button>'
            : '<button class="btn primary" id="btnNext">Next ▶</button>') +
        '</div>' +
      '</div>';

    Array.prototype.forEach.call(document.querySelectorAll("#optsHolder .option"), function(el){
      el.onclick = function(){
        quiz.answers[i] = parseInt(el.getAttribute("data-idx"), 10);
        renderQuiz();
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-nav]"), function(btn){
      btn.onclick = function(){
        quiz.current = parseInt(btn.getAttribute("data-nav"),10);
        renderQuiz();
      };
    });
    var prevBtn = document.getElementById("btnPrev");
    if(prevBtn) prevBtn.onclick = function(){ quiz.current--; renderQuiz(); };
    var nextBtn = document.getElementById("btnNext");
    if(nextBtn) nextBtn.onclick = function(){ quiz.current++; renderQuiz(); };
    var submitBtn = document.getElementById("btnSubmit");
    if(submitBtn) submitBtn.onclick = function(){ finishQuiz(); };
  }

  function finishQuiz(){
    state.screen = "results";
    renderResults();
  }

  // ---------- RESULTS ----------
  function renderResults(){
    var quiz = state.quiz;
    var total = quiz.list.length;
    var correctCount = 0;

    quiz.list.forEach(function(q, i){
      if(quiz.answers[i] === q.correctIndex) correctCount++;
    });

    var pct = total ? Math.round((correctCount/total)*100) : 0;
    var letters = "ABCDEFGH";

    var reviewHtml = quiz.list.map(function(q, i){
      var userAns = quiz.answers[i];
      var isCorrect = userAns === q.correctIndex;
      var imgHtml = "";
      if(q.imageSvg){ imgHtml = '<div class="review-image">' + q.imageSvg + '</div>'; }
      else if(q.image){ imgHtml = '<div class="review-image"><img src="' + q.image + '" alt="Question image"></div>'; }
      var optsHtml = q.options.map(function(opt, idx){
        var cls = "review-opt";
        var tag = "";
        if(idx === q.correctIndex){ cls += " is-correct"; tag = '<span class="tag">✓ CORRECT</span>'; }
        else if(idx === userAns){ cls += " is-wrong"; tag = '<span class="tag">✕ YOUR ANSWER</span>'; }
        return '<div class="' + cls + '">' + letters[idx] + ') ' + esc(opt) + tag + '</div>';
      }).join("");
      var noteHtml = q.explanation ? '<div class="review-note">' + esc(q.explanation) + '</div>' : '';
      return '<div class="review-item ' + (isCorrect?"correct":"wrong") + '">' +
        '<div class="q-meta"><span class="qnum">Question ' + (i+1) + '</span></div>' +
        imgHtml +
        '<div class="review-q">' + esc(q.text) + '</div>' +
        (userAns === null ? '<div class="review-opt" style="color:var(--warn)">No answer given</div>' : '') +
        optsHtml +
        noteHtml +
      '</div>';
    }).join("");

    mainWrap.innerHTML =
      '<div class="card">' +
        '<div class="score-hero">' +
          '<div class="big">' + correctCount + ' / ' + total + '</div>' +
          '<div class="sub">' + pct + '% correct — ' + modeLabel(quiz.mode) + '</div>' +
        '</div>' +
        '<div style="display:flex; gap:10px;">' +
          '<button class="btn primary block" id="btnBackHome">Back to Home</button>' +
          '<button class="btn block" id="btnRetry">Try Again</button>' +
        '</div>' +
      '</div>' +
      '<h3 style="margin:22px 0 10px;">Review</h3>' +
      reviewHtml;

    document.getElementById("btnBackHome").onclick = function(){
      state.screen = "home"; state.quiz = null; renderHome();
    };
    document.getElementById("btnRetry").onclick = function(){
      var filterFn = quiz.mode === "practice-binary" ? isBinaryCat : (quiz.mode === "practice-abc" ? function(c){return c==="ABC";} : null);
      startQuiz(quiz.mode, total, filterFn);
    };
  }

  // ---------- HOME BUTTON ----------
  document.getElementById("btnHome").onclick = function(){
    if(state.screen === "quiz"){
      if(!confirm("Leave this session and go home? Your progress will be lost.")) return;
    }
    // Pick up any edits made in the Manage tab by re-reading straight from disk.
    fetch("/api/questions")
      .then(function(resp){ if(!resp.ok) throw new Error("HTTP " + resp.status); return resp.json(); })
      .then(function(data){ state.questions = data; })
      .catch(function(){ /* server not running — keep whatever is already loaded */ })
      .then(function(){
        state.screen = "home"; state.quiz = null; renderHome();
      });
  };

  // ---------- LOAD ERROR SCREEN ----------
  function renderLoadError(){
    mainWrap.innerHTML =
      '<div class="card load-error">' +
        '<h2>⚠️ Couldn\'t load the question bank</h2>' +
        '<p><code>questions.js</code> didn\'t set <code>window.TVDE_QUESTIONS</code>, and the <code>questions.json</code> fallback failed too.</p>' +
        '<p>Make sure <code>index.html</code>, <code>styles.css</code>, <code>shared.js</code>, <code>app.js</code>, <code>questions.js</code> and <code>questions.json</code> are all still together in the same folder (nothing renamed or moved), then reload the page.</p>' +
        '<button class="btn primary" id="btnRetryLoad">Retry</button>' +
      '</div>';
    document.getElementById("btnRetryLoad").onclick = function(){ boot(); };
  }

  // ---------- BOOT ----------
  function boot(){
    mainWrap.innerHTML = '<div class="card" style="text-align:center; color:var(--muted);">Loading questions…</div>';

    // Prefer the local server so we always see the latest saved-to-disk data.
    fetch("/api/questions")
      .then(function(resp){
        if(!resp.ok) throw new Error("HTTP " + resp.status);
        return resp.json();
      })
      .then(function(data){
        ORIGINAL_QUESTIONS = data;
        state.questions = data;
        state.screen = "home";
        renderHome();
      })
      .catch(function(){
        // No server (e.g. index.html opened by double-click) — fall back to the
        // bundled questions.js for offline practice. Editing/saving needs the server.
        if(window.TVDE_QUESTIONS && Array.isArray(window.TVDE_QUESTIONS) && window.TVDE_QUESTIONS.length){
          ORIGINAL_QUESTIONS = window.TVDE_QUESTIONS;
          state.questions = window.TVDE_QUESTIONS;
          state.screen = "home";
          renderHome();
          return;
        }
        renderLoadError();
      });
  }

  // ---------- GATE ----------
  function rnd(min, max){ return Math.random() * (max - min) + min; }

  function showGate(){
    var header = document.querySelector("header.top");
    if(header) header.style.display = "none";

    var pool = ["😀","😂","😍","😎","🤔","🥳","😴","🙃","🤩","🌟","🔥","💧","🌈","☀️","🌙",
      "⚡","❄️","🍀","🌸","🌵","🍉","🍕","🍔","🍩","🍎","🚀","⚽","🎯","🎸","🎮",
      "📚","🎨","🐶","🐱","🦊","🐼","🦄","🐸","🐢","🦋","🍒","🍓","🥑","🌻","🍁",
      "🎲","🎁","🧩","🪁","🧸"];
    var emojis = pool.slice(0, 49);
    emojis.push("🎈");

    var html = emojis.map(function(emo){
      var isMain = emo === "🎈";
      var left = rnd(5, 88).toFixed(1);
      var top = rnd(8, 82).toFixed(1);
      var dur = rnd(6, 13).toFixed(1);
      var delay = rnd(0, 4).toFixed(1);
      var x1 = rnd(-40, 40).toFixed(0), y1 = rnd(-30, 30).toFixed(0);
      var x2 = rnd(-40, 40).toFixed(0), y2 = rnd(-30, 30).toFixed(0);
      var style = "left:" + left + "%; top:" + top + "%; animation-duration:" + dur + "s; animation-delay:" + delay + "s; " +
        "--x1:" + x1 + "px; --y1:" + y1 + "px; --x2:" + x2 + "px; --y2:" + y2 + "px;";
      return '<span class="emo' + (isMain ? " main" : "") + '"' + (isMain ? ' id="gateMain"' : "") + ' style="' + style + '">' + emo + '</span>';
    }).join("");

    mainWrap.innerHTML = '<div class="emoji-gate">' + html + '</div>';

    document.getElementById("gateMain").addEventListener("click", function(){
      if(header) header.style.display = "";
      boot();
    });
  }

  showGate();
})();
