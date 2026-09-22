(function(){
  "use strict";

  var S = window.TVDE_SHARED;
  var CATS = S.CATS;
  var esc = S.esc;
  var catLabel = S.catLabel;
  var hasImage = S.hasImage;

  var ORIGINAL_QUESTIONS = null;

  var state = {
    questions: [],
    search: "",
    view: "list", // "list" | "edit"
    editingIndex: null, // null = new question
    editDraft: null,
    saving: false,
    lastSaved: null,
    saveError: null
  };

  var mainWrap = document.getElementById("mainWrap");

  document.getElementById("btnBackToApp").onclick = function(){
    window.location.href = "index.html";
  };

  S.initThemeToggle(document.getElementById("btnTheme"));

  // ---------- SAVE TO DISK (via local server — no browser storage involved) ----------
  function saveAndBroadcast(){
    state.saving = true;
    state.saveError = null;
    renderSaveStatusOnly();
    fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.questions)
    }).then(function(resp){
      if(resp.ok) return resp.json();
      return resp.json().catch(function(){ return {}; }).then(function(err){
        throw new Error(err.error || ("HTTP " + resp.status));
      });
    }).then(function(){
      state.lastSaved = new Date();
      state.saveError = null;
    }).catch(function(e){
      state.saveError = (e && e.message) || String(e);
      alert("Could not save to disk: " + state.saveError +
        "\n\nMake sure the app is running via 'node server.js' (open http://localhost:8080, not the file directly), and that questions.js / questions.json aren't open elsewhere or read-only.");
    }).then(function(){
      state.saving = false;
      renderSaveStatusOnly();
    });
  }

  function renderSaveStatusOnly(){
    var el = document.getElementById("saveStatusText");
    if(el) el.textContent = statusText();
  }
  function statusText(){
    if(state.saving) return "Saving to disk…";
    if(state.saveError) return "⚠ Save failed — changes were NOT written to disk (" + state.saveError + ")";
    if(!state.lastSaved) return "Not yet saved to disk this session.";
    return "✓ Saved to disk at " + state.lastSaved.toLocaleTimeString();
  }

  // ---------- SAVE PANEL ----------
  function renderSyncPanel(){
    mainWrap.insertAdjacentHTML("afterbegin",
      '<div class="card">' +
        '<h2 style="margin:0 0 6px; font-size:16px;">Saving</h2>' +
        '<p class="hint" style="margin:0 0 12px;">Every add/edit/delete is written straight to <code>questions.js</code> and <code>questions.json</code> on disk — no browser storage is used.</p>' +
        '<div class="hint" id="saveStatusText">' + statusText() + '</div>' +
        '<div class="count-row" style="margin-top:10px;">' +
          '<button class="btn small" id="btnDownloadJs">⬇ Download questions.js</button>' +
          '<button class="btn small" id="btnDownloadJson">⬇ Download questions.json</button>' +
        '</div>' +
      '</div>'
    );

    document.getElementById("btnDownloadJs").onclick = function(){
      S.downloadFile("questions.js", S.questionsToJs(state.questions), "text/javascript");
    };
    document.getElementById("btnDownloadJson").onclick = function(){
      S.downloadFile("questions.json", S.questionsToJson(state.questions), "application/json");
    };
  }

  // ---------- LIST VIEW ----------
  function renderListView(){
    mainWrap.innerHTML = "";
    renderSyncPanel();

    var search = state.search || "";
    var filtered = state.questions
      .map(function(q, idx){ return { q: q, idx: idx }; })
      .filter(function(item){
        if(!search) return true;
        return item.q.text.toLowerCase().indexOf(search.toLowerCase()) !== -1;
      });

    var rowsHtml = filtered.length ? filtered.map(function(item){
      var q = item.q;
      var imgTag = hasImage(q) ? "🖼 " : "";
      return '<div class="q-row">' +
        '<span class="badge ' + q.category + '" style="flex:0 0 auto;">' + esc(catLabel(q.category, q.customLabel)) + '</span>' +
        '<div class="q-row-text">' + imgTag + esc(q.text.length > 130 ? q.text.slice(0,130) + "…" : q.text) + '</div>' +
        '<div class="q-row-actions">' +
          '<button class="btn small" data-edit="' + item.idx + '">Edit</button>' +
          '<button class="btn small danger" data-del="' + item.idx + '">Delete</button>' +
        '</div>' +
      '</div>';
    }).join("") : '<div class="empty">No questions match your search.</div>';

    mainWrap.insertAdjacentHTML("beforeend",
      '<div class="card">' +
        '<div class="toolbar">' +
          '<input type="text" class="search-input" id="manageSearchInput" placeholder="Search questions…" value="' + esc(search) + '">' +
          '<button class="btn primary" id="btnAddNew">+ Add New Question</button>' +
          '<button class="btn danger" id="btnResetDefault">Reset to original ' + ORIGINAL_QUESTIONS.length + ' questions</button>' +
        '</div>' +
        '<div class="hint" style="margin-bottom:12px;">' + state.questions.length + ' questions total</div>' +
        rowsHtml +
      '</div>'
    );

    document.getElementById("manageSearchInput").oninput = function(e){
      state.search = e.target.value;
      renderListView();
    };
    document.getElementById("btnAddNew").onclick = function(){ openEditForm(null); };
    document.getElementById("btnResetDefault").onclick = function(){
      if(confirm("This will overwrite questions.js / questions.json on disk with the " + ORIGINAL_QUESTIONS.length + " questions that were loaded when this page opened. Continue?")){
        state.questions = JSON.parse(JSON.stringify(ORIGINAL_QUESTIONS));
        saveAndBroadcast();
        renderListView();
      }
    };
    Array.prototype.forEach.call(mainWrap.querySelectorAll("[data-edit]"), function(btn){
      btn.onclick = function(){ openEditForm(parseInt(btn.getAttribute("data-edit"),10)); };
    });
    Array.prototype.forEach.call(mainWrap.querySelectorAll("[data-del]"), function(btn){
      btn.onclick = function(){
        var idx = parseInt(btn.getAttribute("data-del"),10);
        if(confirm("Delete this question? This cannot be undone.")){
          state.questions.splice(idx,1);
          saveAndBroadcast();
          renderListView();
        }
      };
    });
  }

  // ---------- EDIT VIEW ----------
  function openEditForm(idx){
    state.editingIndex = idx;
    var isNew = (idx === null);
    var src = isNew
      ? { id: S.nextId(state.questions), category:"AB", customLabel:"", text:"", options:["",""], correctIndex:0, image:null, imageSvg:null, explanation:"" }
      : JSON.parse(JSON.stringify(state.questions[idx]));
    state.editDraft = src;
    state.view = "edit";
    renderEditView();
  }

  function renderEditView(){
    var d = state.editDraft;
    mainWrap.innerHTML = "";

    var catOptionsHtml = Object.keys(CATS).map(function(k){
      return '<option value="' + k + '" ' + (d.category===k?"selected":"") + '>' + CATS[k] + '</option>';
    }).join("");

    var optsHtml = d.options.map(function(opt, idx){
      return '<div class="opt-edit-row" data-opt-row="' + idx + '">' +
        '<span class="opt-label">Option ' + String.fromCharCode(65+idx) + '</span>' +
        '<input type="radio" name="correctOpt" ' + (d.correctIndex===idx?"checked":"") + ' data-correct-radio="' + idx + '" title="Mark as correct answer">' +
        '<input type="text" data-opt-text="' + idx + '" value="' + esc(opt) + '" placeholder="Option text">' +
        '<button class="btn small danger" data-opt-remove="' + idx + '" ' + (d.options.length<=2?"disabled":"") + '>✕</button>' +
      '</div>';
    }).join("");

    var imagePreviewHtml = "";
    if(d.imageSvg){ imagePreviewHtml = '<div class="img-preview">' + d.imageSvg + '</div>'; }
    else if(d.image){ imagePreviewHtml = '<div class="img-preview"><img src="' + d.image + '"></div>'; }

    mainWrap.innerHTML =
      '<div class="card">' +
        '<h2 style="margin:0 0 16px; font-size:16px;">' + (state.editingIndex === null ? "Add New Question" : "Edit Question") + '</h2>' +
        '<div class="form-field">' +
          '<label>Category</label>' +
          '<select id="editCategory">' + catOptionsHtml + '</select>' +
        '</div>' +
        '<div class="form-field ' + (d.category==="CUSTOM"?"":"hidden") + '" id="customLabelField">' +
          '<label>Custom category label</label>' +
          '<input type="text" id="editCustomLabel" value="' + esc(d.customLabel||"") + '" placeholder="e.g. Multiple choice">' +
        '</div>' +
        '<div class="form-field">' +
          '<label>Question text</label>' +
          '<textarea id="editQuestionText" placeholder="Type the question…">' + esc(d.text) + '</textarea>' +
        '</div>' +
        '<div class="form-field">' +
          '<label>Options — select the radio button next to the correct answer</label>' +
          '<div id="optsEditHolder">' + optsHtml + '</div>' +
          '<button class="btn small" id="btnAddOption" ' + (d.options.length>=8?"disabled":"") + '>+ Add option</button>' +
        '</div>' +
        '<div class="form-field">' +
          '<label>Image (optional)</label>' +
          imagePreviewHtml +
          '<input type="file" id="editImageFile" accept="image/*">' +
          (d.image || d.imageSvg ? '<div style="margin-top:8px;"><button class="btn small danger" id="btnRemoveImage">Remove image</button></div>' : '') +
          '<div class="hint">The image is embedded directly in the question and stored in your browser — no external links are used.</div>' +
        '</div>' +
        '<div class="form-field">' +
          '<label>Explanation / note (optional — shown in the results review)</label>' +
          '<textarea id="editExplanation" placeholder="e.g. explain why this is the correct answer">' + esc(d.explanation||"") + '</textarea>' +
        '</div>' +
        '<div style="display:flex; justify-content:space-between; gap:10px;">' +
          '<button class="btn" id="btnCancelEdit">← Back to list</button>' +
          '<button class="btn primary" id="btnSaveQuestion">Save Question</button>' +
        '</div>' +
      '</div>';

    document.getElementById("editCategory").onchange = function(e){
      d.category = e.target.value;
      document.getElementById("customLabelField").classList.toggle("hidden", d.category !== "CUSTOM");
    };
    document.getElementById("editCustomLabel").oninput = function(e){ d.customLabel = e.target.value; };
    document.getElementById("editQuestionText").oninput = function(e){ d.text = e.target.value; };
    document.getElementById("editExplanation").oninput = function(e){ d.explanation = e.target.value; };

    Array.prototype.forEach.call(document.querySelectorAll("[data-opt-text]"), function(inp){
      inp.oninput = function(){
        d.options[parseInt(inp.getAttribute("data-opt-text"),10)] = inp.value;
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-correct-radio]"), function(r){
      r.onchange = function(){
        d.correctIndex = parseInt(r.getAttribute("data-correct-radio"),10);
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-opt-remove]"), function(btn){
      btn.onclick = function(){
        var idx = parseInt(btn.getAttribute("data-opt-remove"),10);
        if(d.options.length <= 2) return;
        d.options.splice(idx,1);
        if(d.correctIndex === idx) d.correctIndex = 0;
        else if(d.correctIndex > idx) d.correctIndex--;
        renderEditView();
      };
    });
    document.getElementById("btnAddOption").onclick = function(){
      if(d.options.length >= 8) return;
      d.options.push("");
      renderEditView();
    };

    var fileInput = document.getElementById("editImageFile");
    fileInput.onchange = function(e){
      var file = e.target.files && e.target.files[0];
      if(!file) return;
      var reader = new FileReader();
      reader.onload = function(ev){
        d.image = ev.target.result;
        d.imageSvg = null;
        renderEditView();
      };
      reader.readAsDataURL(file);
    };
    var removeImgBtn = document.getElementById("btnRemoveImage");
    if(removeImgBtn) removeImgBtn.onclick = function(){ d.image = null; d.imageSvg = null; renderEditView(); };

    document.getElementById("btnCancelEdit").onclick = function(){
      state.view = "list"; state.editingIndex = null; state.editDraft = null; renderListView();
    };
    document.getElementById("btnSaveQuestion").onclick = function(){
      var txt = d.text.trim();
      if(!txt){ alert("Please enter the question text."); return; }
      var cleanOpts = d.options.map(function(o){ return o.trim(); });
      if(cleanOpts.some(function(o){ return !o; })){ alert("Please fill in all option fields (or remove empty ones)."); return; }
      if(cleanOpts.length < 2){ alert("A question needs at least 2 options."); return; }
      if(d.category === "CUSTOM" && !(d.customLabel||"").trim()){ alert("Please provide a label for the custom category."); return; }

      var finalQ = {
        id: d.id,
        category: d.category,
        customLabel: d.category === "CUSTOM" ? d.customLabel.trim() : undefined,
        text: txt,
        options: cleanOpts,
        correctIndex: d.correctIndex,
        image: d.image || undefined,
        imageSvg: d.imageSvg || undefined,
        explanation: (d.explanation||"").trim() || undefined
      };

      if(state.editingIndex === null){
        state.questions.push(finalQ);
      } else {
        state.questions[state.editingIndex] = finalQ;
      }
      saveAndBroadcast();
      state.view = "list"; state.editingIndex = null; state.editDraft = null;
      renderListView();
    };
  }

  function renderCurrentView(){
    if(state.view === "edit") renderEditView();
    else renderListView();
  }

  // ---------- LOAD ERROR ----------
  function renderLoadError(){
    mainWrap.innerHTML =
      '<div class="card load-error">' +
        '<h2>⚠️ Couldn\'t reach the local server</h2>' +
        '<p>Saving questions to disk needs the app running through its local server, not opened by double-click.</p>' +
        '<p>In a terminal, from the project folder, run:</p>' +
        '<pre style="background:var(--panel,#1a1a1a); padding:10px 12px; border-radius:8px; overflow:auto;">node server.js</pre>' +
        '<p>then open <code>http://localhost:8080</code> in your browser.</p>' +
        '<button class="btn primary" id="btnRetryLoad">Retry</button>' +
      '</div>';
    document.getElementById("btnRetryLoad").onclick = function(){ boot(); };
  }

  // ---------- BOOT ----------
  function boot(){
    mainWrap.innerHTML = '<div class="card" style="text-align:center; color:var(--muted);">Loading questions…</div>';

    fetch("/api/questions")
      .then(function(resp){
        if(!resp.ok) throw new Error("HTTP " + resp.status);
        return resp.json();
      })
      .then(function(data){
        ORIGINAL_QUESTIONS = data;
        state.questions = JSON.parse(JSON.stringify(data));
        renderListView();
      })
      .catch(function(){
        renderLoadError();
      });
  }

  boot();
})();
