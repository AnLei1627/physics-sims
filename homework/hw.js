/* homework/hw.js — 可重複使用的作答引擎（選擇／數值／推導／文字／方向／限時小考） */
(function(){
"use strict";

var HW_ID = window.HW_ID || "homework";
var ENDPOINT = window.HW_SUBMIT_ENDPOINT || "";
var STORAGE_KEY = "hw_v1_" + HW_ID;

var DIR_LABELS = {
  NofE: "north of east",
  SofE: "south of east",
  NofW: "north of west",
  SofW: "south of west"
};

var NUM_RE = /^-?(\d+(\.\d*)?|\.\d+)(e-?\d+)?$/i;

function qs(sel, root){ return (root||document).querySelector(sel); }
function qsa(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }

function loadState(){
  var raw;
  try{ raw = localStorage.getItem(STORAGE_KEY); }catch(e){ raw = null; }
  var state = null;
  if (raw){
    try{ state = JSON.parse(raw); }catch(e){ state = null; }
  }
  if (!state) state = {};
  if (!state.name) state.name = "";
  if (!state.answers) state.answers = {};
  if (!state.photos) state.photos = {};
  if (!state.quiz) state.quiz = {};
  if (!state.savedAt) state.savedAt = null;
  if (!state.submittedAt) state.submittedAt = null;
  return state;
}

var state = loadState();
var saveTimer = null;
var savedIndicator;

function pad2(n){ return (n<10?"0":"")+n; }
function fmtClock(ts){
  var d = new Date(ts);
  return pad2(d.getHours())+":"+pad2(d.getMinutes())+":"+pad2(d.getSeconds());
}
function fmtMMSS(ms){
  ms = Math.max(0, ms||0);
  var s = Math.floor(ms/1000);
  var m = Math.floor(s/60);
  var ss = s%60;
  return m+":"+pad2(ss);
}

function doSave(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    state.savedAt = Date.now();
    if (savedIndicator){
      savedIndicator.classList.remove("hw-warn");
      savedIndicator.textContent = "已自動儲存 " + fmtClock(state.savedAt);
    }
  }catch(e){
    if (savedIndicator){
      savedIndicator.classList.add("hw-warn");
      savedIndicator.textContent = "儲存失敗：照片太多，送出前不要關頁面";
    }
  }
}

function scheduleSave(immediate){
  if (immediate){
    if (saveTimer){ clearTimeout(saveTimer); saveTimer = null; }
    doSave();
    return;
  }
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(doSave, 400);
}

/* ---------- 選擇題 ---------- */
function enhanceMcq(el){
  var qid = el.dataset.qid;
  var group = qs(".hw-options", el);
  if (!group) return;
  group.setAttribute("role", "radiogroup");
  var opts = qsa("[data-value]", group);
  function select(val){
    state.answers[qid] = val;
    opts.forEach(function(o){
      var on = o.dataset.value === val;
      o.classList.toggle("hw-selected", on);
      o.setAttribute("aria-checked", on ? "true" : "false");
    });
    scheduleSave();
  }
  opts.forEach(function(o){
    o.classList.add("hw-opt");
    o.setAttribute("role", "radio");
    o.setAttribute("tabindex", "0");
    o.setAttribute("aria-checked", "false");
    o.addEventListener("click", function(){
      if (el.closest(".hw-quiz-locked")) return;
      select(o.dataset.value);
    });
    o.addEventListener("keydown", function(ev){
      if (ev.key === "Enter" || ev.key === " "){
        ev.preventDefault();
        o.click();
      }
    });
  });
  if (state.answers[qid]) select(state.answers[qid]);
}

/* ---------- 數值 ---------- */
function buildNumInput(qid, initialVal){
  var input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.autocomplete = "off";
  input.className = "hw-num-input";
  input.value = initialVal || "";
  return input;
}

function enhanceNum(el){
  var qid = el.dataset.qid;
  var unit = el.dataset.unit || "";
  var row = document.createElement("div");
  row.className = "hw-num-row";
  var input = buildNumInput(qid, state.answers[qid]);
  row.appendChild(input);
  if (unit){
    var unitSpan = document.createElement("span");
    unitSpan.className = "hw-unit";
    unitSpan.textContent = unit;
    row.appendChild(unitSpan);
  }
  var err = document.createElement("div");
  err.className = "hw-error";
  err.textContent = "格式不對，請輸入數字，例如 -3.14 或 2.5e-3";
  el.appendChild(row);
  el.appendChild(err);

  function validate(){
    var v = input.value.trim();
    var bad = v !== "" && !NUM_RE.test(v);
    err.classList.toggle("hw-show", bad);
    return !bad;
  }
  input.addEventListener("input", function(){
    if (el.closest(".hw-quiz-locked")) return;
    state.answers[qid] = input.value;
    scheduleSave();
  });
  input.addEventListener("blur", validate);
  if (state.answers[qid]) validate();
}

/* ---------- 符號輸入（不用 LaTeX，用鍵盤或按鈕輸入） ---------- */
var activeSym = null;

function normalizeSym(v){
  return v.replace(/\^2/g, "²").replace(/\^3/g, "³").replace(/\*/g, "·");
}

function enhanceSym(el){
  var qid = el.dataset.qid;
  var input = document.createElement("input");
  input.type = "text";
  input.autocomplete = "off";
  input.setAttribute("autocapitalize", "off");
  input.spellcheck = false;
  input.className = "hw-sym-input";
  input.size = parseInt(el.dataset.size || "8", 10);
  input.placeholder = el.dataset.ph || "";
  input.value = state.answers[qid] || "";
  el.appendChild(input);
  input.addEventListener("focus", function(){ activeSym = input; });
  input.addEventListener("input", function(){
    if (el.closest(".hw-quiz-locked")) return;
    state.answers[qid] = input.value;
    scheduleSave();
  });
  input.addEventListener("blur", function(){
    var n = normalizeSym(input.value);
    if (n !== input.value){
      input.value = n;
      state.answers[qid] = n;
      scheduleSave();
    }
  });
}

function buildStepPalette(step){
  var syms = step.dataset.palette.split("|");
  var bar = document.createElement("div");
  bar.className = "hw-symbol-bar";
  syms.forEach(function(sym){
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hw-symbol-btn";
    btn.textContent = sym;
    btn.addEventListener("mousedown", function(ev){ ev.preventDefault(); });
    btn.addEventListener("click", function(){
      var target = activeSym && step.contains(activeSym) ? activeSym : qs(".hw-sym-input", step);
      if (!target) return;
      var start = target.selectionStart == null ? target.value.length : target.selectionStart;
      var end = target.selectionEnd == null ? start : target.selectionEnd;
      target.value = target.value.slice(0, start) + sym + target.value.slice(end);
      target.focus();
      target.setSelectionRange(start + sym.length, start + sym.length);
      target.dispatchEvent(new Event("input"));
    });
    bar.appendChild(btn);
  });
  var anchor = qs(".hw-align", step) || step.lastChild;
  step.insertBefore(bar, anchor);
}

/* ---------- 方向（角度 + 下拉） ---------- */
function enhanceDirection(el){
  var qid = el.dataset.qid;
  var saved = state.answers[qid] || {};
  var row = document.createElement("div");
  row.className = "hw-num-row";
  var input = buildNumInput(qid, saved.angle);
  row.appendChild(input);
  var deg = document.createElement("span");
  deg.className = "hw-unit";
  deg.textContent = "°";
  row.appendChild(deg);
  var select = document.createElement("select");
  select.className = "hw-dir-select";
  var blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "選擇方向";
  select.appendChild(blank);
  Object.keys(DIR_LABELS).forEach(function(key){
    var opt = document.createElement("option");
    opt.value = key;
    opt.textContent = DIR_LABELS[key];
    select.appendChild(opt);
  });
  select.value = saved.dir || "";
  row.appendChild(select);
  var err = document.createElement("div");
  err.className = "hw-error";
  err.textContent = "格式不對，請輸入數字角度";
  el.appendChild(row);
  el.appendChild(err);

  function update(){
    if (el.closest(".hw-quiz-locked")) return;
    state.answers[qid] = { angle: input.value, dir: select.value };
    scheduleSave();
  }
  input.addEventListener("input", update);
  select.addEventListener("change", update);
  input.addEventListener("blur", function(){
    var v = input.value.trim();
    err.classList.toggle("hw-show", v !== "" && !NUM_RE.test(v));
  });
}

/* ---------- KaTeX 預覽 ---------- */
function isMathLine(line){
  return /\\[a-zA-Z]+|[=^_]/.test(line);
}
function renderPreview(container, text){
  container.innerHTML = "";
  var lines = (text || "").split("\n");
  lines.forEach(function(line){
    if (line.trim() === "") return;
    if (isMathLine(line) && window.katex){
      var div = document.createElement("div");
      try{
        window.katex.render(line, div, { throwOnError: false, displayMode: true });
      }catch(e){
        div.textContent = line;
      }
      container.appendChild(div);
    } else {
      var p = document.createElement("div");
      p.className = "hw-plain-line";
      p.textContent = line;
      container.appendChild(p);
    }
  });
}

/* ---------- 常用符號列 ---------- */
var SYMBOLS = [
  { label: "ω", before: "\\omega", after: "" },
  { label: "α", before: "\\alpha", after: "" },
  { label: "θ", before: "\\theta", after: "" },
  { label: "τ", before: "\\tau", after: "" },
  { label: "√", before: "\\sqrt{", after: "}" },
  { label: "½", before: "\\frac{1}{2}", after: "" },
  { label: "²", before: "^2", after: "" },
  { label: "Δ", before: "\\Delta", after: "" },
  { label: "·", before: "\\cdot ", after: "" },
  { label: "→", before: "\\to ", after: "" }
];

function insertAtCursor(textarea, before, after){
  var start = textarea.selectionStart;
  var end = textarea.selectionEnd;
  var val = textarea.value;
  var next = val.slice(0, start) + before + after + val.slice(end);
  textarea.value = next;
  var cursor = start + before.length;
  textarea.focus();
  textarea.setSelectionRange(cursor, cursor);
  textarea.dispatchEvent(new Event("input"));
}

function buildSymbolBar(textarea){
  var bar = document.createElement("div");
  bar.className = "hw-symbol-bar";
  SYMBOLS.forEach(function(sym){
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hw-symbol-btn";
    btn.textContent = sym.label;
    btn.addEventListener("click", function(){
      if (textarea.closest(".hw-quiz-locked")) return;
      insertAtCursor(textarea, sym.before, sym.after);
    });
    bar.appendChild(btn);
  });
  return bar;
}

/* ---------- 照片上傳 ---------- */
function resizeImageToJpeg(file, maxSide){
  return new Promise(function(resolve, reject){
    var reader = new FileReader();
    reader.onload = function(e){
      var img = new Image();
      img.onload = function(){
        var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        var w = Math.round(img.width * scale);
        var h = Math.round(img.height * scale);
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function buildPhotoSection(qid){
  var section = document.createElement("div");
  section.className = "hw-photo-section";
  var label = document.createElement("label");
  label.className = "hw-photo-label";
  label.textContent = "📷 上傳手寫照片";
  var input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.capture = "environment";
  input.multiple = true;
  input.className = "hw-photo-input";
  label.appendChild(input);
  var row = document.createElement("div");
  row.className = "hw-photo-row";

  function renderThumbs(){
    row.innerHTML = "";
    var photos = state.photos[qid] || [];
    photos.forEach(function(photo, idx){
      var thumb = document.createElement("div");
      thumb.className = "hw-photo-thumb";
      var img = document.createElement("img");
      img.src = photo.dataURL;
      thumb.appendChild(img);
      var del = document.createElement("button");
      del.type = "button";
      del.className = "hw-photo-del";
      del.textContent = "×";
      del.addEventListener("click", function(){
        if (row.closest(".hw-quiz-locked")) return;
        photos.splice(idx, 1);
        renderThumbs();
        scheduleSave();
      });
      thumb.appendChild(del);
      row.appendChild(thumb);
    });
  }

  input.addEventListener("change", function(){
    if (section.closest(".hw-quiz-locked")) return;
    var files = Array.prototype.slice.call(input.files || []);
    input.value = "";
    files.forEach(function(file){
      resizeImageToJpeg(file, 1600).then(function(dataURL){
        if (!state.photos[qid]) state.photos[qid] = [];
        state.photos[qid].push({ name: file.name || "photo.jpg", dataURL: dataURL });
        renderThumbs();
        scheduleSave();
      });
    });
  });

  section.appendChild(label);
  section.appendChild(row);
  renderThumbs();
  return section;
}

/* ---------- 推導／文字 ---------- */
function enhanceDeriveOrText(el, isDerive){
  var qid = el.dataset.qid;
  var textarea = document.createElement("textarea");
  textarea.className = "hw-textarea";
  textarea.rows = 4;
  textarea.placeholder = "輸入文字或 LaTeX 簡寫，例如 v = \\sqrt{2gh}；每行一個式子";
  textarea.value = state.answers[qid] || "";
  var preview = document.createElement("div");
  preview.className = "hw-preview";

  if (isDerive){
    el.appendChild(buildSymbolBar(textarea));
  }
  el.appendChild(textarea);
  el.appendChild(preview);
  if (isDerive){
    el.appendChild(buildPhotoSection(qid));
  }

  textarea.addEventListener("input", function(){
    if (el.closest(".hw-quiz-locked")) return;
    state.answers[qid] = textarea.value;
    renderPreview(preview, textarea.value);
    scheduleSave();
  });
  renderPreview(preview, textarea.value);
}

/* ---------- 小考（限時） ---------- */
var timerBar = null;
var timerInterval = null;

function getTimerBar(){
  if (!timerBar){
    timerBar = document.createElement("div");
    timerBar.id = "hw-timerbar";
    timerBar.hidden = true;
    document.body.insertBefore(timerBar, document.body.firstChild);
  }
  return timerBar;
}

function enhanceQuiz(section){
  var quizId = section.dataset.quizId || "quiz";
  var minutes = parseFloat(section.dataset.timer || "25");
  var durationMs = minutes * 60 * 1000;
  var intro = qs(".hw-quiz-intro", section);
  var body = qs(".hw-quiz-body", section);
  var startBtn = qs(".hw-quiz-start", section);
  var submitBtn = qs(".hw-quiz-submit", section);
  var statusEl = document.createElement("p");
  statusEl.className = "hw-quiz-status";
  section.insertBefore(statusEl, intro);

  if (!state.quiz[quizId]){
    state.quiz[quizId] = { startedAt: null, endedAt: null, elapsedMs: null, status: "notstarted" };
  }
  var qz = state.quiz[quizId];

  function lockBody(){
    qsa("input,textarea,select,button", body).forEach(function(e){ e.disabled = true; });
    body.classList.add("hw-quiz-locked");
  }

  function renderStatus(){
    if (qz.status === "timeout"){
      statusEl.textContent = "用時 " + fmtMMSS(qz.elapsedMs) + "（時間到）";
    } else if (qz.status === "submitted"){
      statusEl.textContent = "用時 " + fmtMMSS(qz.elapsedMs) + "（已交卷）";
    } else {
      statusEl.textContent = "";
    }
  }

  function updateBarText(remaining){
    getTimerBar().textContent = "⏱ 小考剩餘時間 " + fmtMMSS(remaining);
  }

  function stopInterval(){
    if (timerInterval){ clearInterval(timerInterval); timerInterval = null; }
  }

  function finish(status){
    stopInterval();
    qz.endedAt = Date.now();
    qz.elapsedMs = status === "timeout" ? durationMs : (qz.endedAt - (qz.startedAt || qz.endedAt));
    qz.status = status;
    lockBody();
    getTimerBar().hidden = true;
    renderStatus();
    scheduleSave(true);
  }

  function tick(){
    var remaining = qz.startedAt + durationMs - Date.now();
    if (remaining <= 0){
      finish("timeout");
    } else {
      updateBarText(remaining);
    }
  }

  function startRunning(){
    intro.hidden = true;
    body.hidden = false;
    var bar = getTimerBar();
    bar.hidden = false;
    tick();
    stopInterval();
    timerInterval = setInterval(tick, 1000);
  }

  if (startBtn){
    startBtn.addEventListener("click", function(){
      qz.startedAt = Date.now();
      qz.status = "running";
      scheduleSave(true);
      startRunning();
    });
  }
  if (submitBtn){
    submitBtn.addEventListener("click", function(){
      finish("submitted");
    });
  }

  if (qz.status === "running"){
    var remaining = qz.startedAt + durationMs - Date.now();
    if (remaining <= 0){
      intro.hidden = true;
      body.hidden = false;
      finish("timeout");
    } else {
      startRunning();
    }
  } else if (qz.status === "timeout" || qz.status === "submitted"){
    intro.hidden = true;
    body.hidden = false;
    lockBody();
    renderStatus();
  }
}

/* ---------- 送出 / 摘要 ---------- */
function buildSummaryText(){
  var lines = [];
  lines.push("作業：" + HW_ID);
  lines.push("姓名：" + (state.name || "(未填)"));
  lines.push("");
  qsa("[data-qid]").forEach(function(el){
    var qid = el.dataset.qid;
    var type = el.dataset.type;
    if (type === "mcq"){
      var val = state.answers[qid];
      lines.push(qid + ": " + (val ? "(" + val + ")" : "未作答"));
    } else if (type === "num"){
      var v = state.answers[qid];
      var unit = el.dataset.unit || "";
      lines.push(qid + ": " + (v ? v + (unit ? " " + unit : "") : "未作答"));
    } else if (type === "sym"){
      var sv = state.answers[qid];
      lines.push(qid + ": " + (sv && sv.trim() ? sv : "未作答"));
    } else if (type === "direction"){
      var ans = state.answers[qid] || {};
      var dirLabel = ans.dir ? DIR_LABELS[ans.dir] : "";
      lines.push(qid + ": " + (ans.angle ? ans.angle + "°" : "未作答") + (dirLabel ? " " + dirLabel : ""));
    } else if (type === "derive" || type === "text"){
      var text = state.answers[qid];
      lines.push(qid + ":");
      if (text && text.trim()){
        text.split("\n").forEach(function(l){ lines.push("    " + l); });
      } else {
        lines.push("    未作答");
      }
      var photos = state.photos[qid];
      if (photos && photos.length){
        lines.push("    （已上傳照片 " + photos.length + " 張，請另外用 LINE 傳照片給老師）");
      }
    }
  });
  Object.keys(state.quiz).forEach(function(quizId){
    var qz = state.quiz[quizId];
    if (qz.status && qz.status !== "notstarted"){
      lines.push("");
      var statusLabel = qz.status === "timeout" ? "時間到" : (qz.status === "submitted" ? "已交卷" : "進行中");
      lines.push("小考（" + quizId + "）：狀態 " + statusLabel + "，用時 " + fmtMMSS(qz.elapsedMs || 0));
    }
  });
  lines.push("");
  lines.push("請把以上摘要貼到 LINE 給老師，手寫照片也一起傳。");
  return lines.join("\n");
}

function buildPayload(){
  return {
    hwId: HW_ID,
    name: state.name,
    submittedAt: new Date().toISOString(),
    answers: state.answers,
    quiz: state.quiz,
    photos: state.photos
  };
}

function showSubmitMessage(container, msg){
  var p = container.querySelector(".hw-submit-message");
  if (!p){
    p = document.createElement("p");
    p.className = "hw-submit-message";
    container.appendChild(p);
  }
  p.textContent = msg;
}

function enhanceSubmit(){
  var section = qs("#hw-submit");
  if (!section) return;
  var submitBtn = qs(".hw-submit-btn", section);
  var resultBox = qs(".hw-submit-result", section);
  if (!submitBtn || !resultBox) return;

  function renderSummaryUI(){
    resultBox.innerHTML = "";
    var heading = document.createElement("p");
    heading.innerHTML = "<strong>作答摘要</strong>（把它貼到 LINE 給老師，手寫照片也一起傳）：";
    resultBox.appendChild(heading);
    var textarea = document.createElement("textarea");
    textarea.id = "hw-summary-text";
    textarea.readOnly = true;
    textarea.value = buildSummaryText();
    resultBox.appendChild(textarea);

    var actions = document.createElement("div");
    actions.className = "hw-submit-actions";

    var copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "hw-btn hw-btn-secondary";
    copyBtn.textContent = "📋 複製摘要";
    copyBtn.addEventListener("click", function(){
      if (navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(textarea.value).then(function(){
          showSubmitMessage(resultBox, "已複製到剪貼簿。");
        }).catch(function(){
          textarea.focus();
          textarea.select();
          showSubmitMessage(resultBox, "複製失敗，已選取文字，請手動複製。");
        });
      } else {
        textarea.focus();
        textarea.select();
        showSubmitMessage(resultBox, "已選取文字，請手動複製。");
      }
    });
    actions.appendChild(copyBtn);

    var downloadBtn = document.createElement("button");
    downloadBtn.type = "button";
    downloadBtn.className = "hw-btn hw-btn-secondary";
    downloadBtn.textContent = "⬇️ 下載作答檔 (.json)";
    downloadBtn.addEventListener("click", function(){
      var payload = buildPayload();
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "homework_" + HW_ID + "_" + (state.name || "student") + ".json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    });
    actions.appendChild(downloadBtn);

    resultBox.appendChild(actions);
  }

  submitBtn.addEventListener("click", function(){
    var payload = buildPayload();
    if (ENDPOINT){
      fetch(ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      }).then(function(){
        state.submittedAt = Date.now();
        scheduleSave(true);
        resultBox.innerHTML = "";
        showSubmitMessage(resultBox, "已送出（" + fmtClock(state.submittedAt) + "）。可以重新送出，會覆蓋為新版本。");
      }).catch(function(){
        showSubmitMessage(resultBox, "送出失敗，請檢查網路後再試一次。");
      });
    } else {
      state.submittedAt = Date.now();
      scheduleSave(true);
      renderSummaryUI();
    }
  });
}

/* ---------- 初始化 ---------- */
function init(){
  savedIndicator = qs("#hw-saved-indicator");
  var nameInput = qs("#hw-name");
  if (nameInput){
    nameInput.value = state.name || "";
    nameInput.addEventListener("input", function(){
      state.name = nameInput.value;
      scheduleSave();
    });
  }
  if (state.savedAt && savedIndicator){
    savedIndicator.textContent = "已自動儲存 " + fmtClock(state.savedAt);
  }

  qsa('[data-type="mcq"]').forEach(enhanceMcq);
  qsa('[data-type="num"]').forEach(enhanceNum);
  qsa('[data-type="direction"]').forEach(enhanceDirection);
  qsa('[data-type="sym"]').forEach(enhanceSym);
  qsa('.hw-step[data-palette]').forEach(buildStepPalette);
  qsa('[data-type="derive"]').forEach(function(el){ enhanceDeriveOrText(el, true); });
  qsa('[data-type="text"]').forEach(function(el){ enhanceDeriveOrText(el, false); });
  qsa(".hw-quiz").forEach(enhanceQuiz);
  enhanceSubmit();

  if (window.renderMathInElement){
    window.renderMathInElement(document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false }
      ]
    });
  }
}

if (document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

})();
