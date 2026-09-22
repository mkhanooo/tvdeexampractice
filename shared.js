// Shared utilities used by both app.js (main page) and manage.js (Manage Questions page).
window.TVDE_SHARED = (function(){
  "use strict";

  var CATS = {
    SN: "Sim / Não",
    VF: "Verdadeiro / Falso",
    AB: "Opção A / B",
    ABC: "Opção A / B / C",
    CUSTOM: "Personalizada"
  };

  function hasImage(q){ return !!(q.image || q.imageSvg); }

  var THEME_KEY = "tvde-theme";

  // Light is always the default on first visit — dark mode only applies once
  // the visitor explicitly picks it via the theme button, ignoring OS preference.
  function resolveTheme(){
    var stored = null;
    try{ stored = localStorage.getItem(THEME_KEY); }catch(e){}
    return stored === "dark" ? "dark" : "light";
  }

  function applyTheme(theme){
    document.documentElement.setAttribute("data-theme", theme);
    try{ localStorage.setItem(THEME_KEY, theme); }catch(e){}
  }

  function initThemeToggle(btn){
    function render(){
      var theme = resolveTheme();
      document.documentElement.setAttribute("data-theme", theme);
      btn.textContent = theme === "dark" ? "☀️ Light" : "🌙 Dark";
      btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    }
    btn.onclick = function(){
      applyTheme(resolveTheme() === "dark" ? "light" : "dark");
      render();
    };
    render();
  }

  function esc(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c];
    });
  }

  function catLabel(cat, customLabel){
    if(cat === "CUSTOM") return customLabel || "Personalizada";
    return CATS[cat] || cat;
  }

  function shuffle(arr){
    var a = arr.slice();
    for(var i=a.length-1;i>0;i--){
      var j = Math.floor(Math.random()*(i+1));
      var t=a[i]; a[i]=a[j]; a[j]=t;
    }
    return a;
  }

  function nextId(questions){
    var max = 0;
    questions.forEach(function(q){ if(q.id > max) max = q.id; });
    return max + 1;
  }

  function questionsToJs(questions){
    return "// Auto-generated question data. Edit freely, then just refresh the page (or click 'Reset to original questions' in-app).\n" +
      "window.TVDE_QUESTIONS = " + JSON.stringify(questions, null, 2) + ";\n";
  }
  function questionsToJson(questions){
    return JSON.stringify(questions, null, 2);
  }

  function downloadFile(filename, content, mime){
    var blob = new Blob([content], {type: mime || "text/plain"});
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  }

  return {
    CATS: CATS,
    hasImage: hasImage,
    esc: esc,
    catLabel: catLabel,
    shuffle: shuffle,
    nextId: nextId,
    questionsToJs: questionsToJs,
    questionsToJson: questionsToJson,
    downloadFile: downloadFile,
    initThemeToggle: initThemeToggle
  };
})();
