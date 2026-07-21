"use strict";

const SOURCE_PATH = "../CODE_REVIEW_101.md";
const ANSWER_PATH = "../CODE_REVIEW_101_ANSWERS.md";
const STORAGE_KEY = "code-review-gym-progress-v1";

const state = {
  questions: [],
  answers: new Map(),
  examples: new Map(),
  activeIndex: 0,
  progress: loadProgress(),
};

const elements = {
  navigation: document.querySelector("#question-navigation"),
  chapterTemplate: document.querySelector("#chapter-template"),
  chapterLabel: document.querySelector("#chapter-label"),
  questionLabel: document.querySelector("#question-label"),
  challengeTitle: document.querySelector("#challenge-title"),
  questionPrompt: document.querySelector("#question-prompt"),
  codeContent: document.querySelector("#code-content"),
  chapterExamples: document.querySelector("#chapter-examples"),
  progressLabel: document.querySelector("#progress-label"),
  progressBar: document.querySelector("#progress-bar"),
  progressTrack: document.querySelector(".progress-track"),
  difficultyBadge: document.querySelector("#difficulty-badge"),
  form: document.querySelector("#review-form"),
  fact: document.querySelector("#fact"),
  condition: document.querySelector("#condition"),
  impact: document.querySelector("#impact"),
  proposal: document.querySelector("#proposal"),
  testEvidence: document.querySelector("#test-evidence"),
  formMessage: document.querySelector("#form-message"),
  answerPanel: document.querySelector("#answer-panel"),
  answerContent: document.querySelector("#answer-content"),
  saveStatus: document.querySelector("#save-status"),
  loadError: document.querySelector("#load-error"),
  sidebar: document.querySelector(".sidebar"),
};

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
  elements.saveStatus.textContent = "保存しました";
  window.setTimeout(() => { elements.saveStatus.textContent = "自動保存"; }, 1200);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function parseQuestions(markdown) {
  const lines = markdown.split(/\r?\n/);
  const questions = [];
  let chapter = "基礎";
  let current = null;
  let inFence = false;
  let code = [];
  let prompt = [];

  const finish = () => {
    if (!current) return;
    current.code = code.join("\n").trim();
    current.prompt = prompt.join("\n").trim();
    current.title = makeTitle(current.prompt, current.code);
    questions.push(current);
  };

  for (const line of lines) {
    const chapterMatch = line.match(/^## (第\d+章：.+)$/);
    if (chapterMatch) {
      finish();
      current = null;
      chapter = chapterMatch[1];
      continue;
    }

    if (/^## /.test(line)) {
      finish();
      current = null;
      continue;
    }

    const questionMatch = line.match(/^### 問(\d{3})$/);
    if (questionMatch) {
      finish();
      current = { id: `問${questionMatch[1]}`, number: Number(questionMatch[1]), chapter };
      code = [];
      prompt = [];
      inFence = false;
      continue;
    }

    if (!current) continue;
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) code.push(line);
    else if (line && !line.startsWith("## ")) prompt.push(line);
  }

  finish();
  return questions;
}

function parseAnswers(markdown) {
  const chunks = markdown.split(/^### 問(\d{3})\s*$/m);
  const answers = new Map();
  for (let index = 1; index < chunks.length; index += 2) {
    const id = `問${chunks[index]}`;
    const body = (chunks[index + 1] || "").split(/^## /m)[0].trim();
    answers.set(id, body);
  }
  return answers;
}

function parseChapterExamples(markdown) {
  const examples = new Map();
  const chapterChunks = markdown.split(/^## (第\d+章：.+)$/m);

  for (let index = 1; index < chapterChunks.length; index += 2) {
    const chapter = chapterChunks[index];
    const chapterBody = chapterChunks[index + 1] || "";
    const section = chapterBody.match(/### 解説付き例題\s*\n([\s\S]*?)(?=\n### 練習問題)/);
    if (!section) continue;

    const chunks = section[1].split(/^#### (例題\d+：.+)$/m);
    const chapterExamples = [];
    for (let chunkIndex = 1; chunkIndex < chunks.length; chunkIndex += 2) {
      chapterExamples.push({
        title: chunks[chunkIndex],
        body: (chunks[chunkIndex + 1] || "").trim(),
      });
    }
    examples.set(chapter, chapterExamples);
  }

  return examples;
}

function makeTitle(prompt, code) {
  const source = prompt || code || "コードをレビューしてください";
  const firstLine = source.split("\n").find(Boolean) || source;
  return firstLine.replace(/[。？?]$/, "").slice(0, 34);
}

function highlightCode(code) {
  const safe = escapeHtml(code || "# コードではなく、提示された状況をレビューしてください")
    .replace(/(#[^\n]*)/g, '<span class="token-comment">$1</span>')
    .replace(/(&quot;.*?&quot;|&#039;.*?&#039;)/g, '<span class="token-string">$1</span>')
    .replace(/\b(def|class|return|if|else|elif|for|while|in|try|except|raise|import|from|as|with|True|False|None)\b/g, '<span class="token-keyword">$1</span>')
    .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="token-number">$1</span>');
  return safe.split("\n").map((line) => `<span class="code-line">${line || " "}</span>`).join("");
}

function answerToHtml(markdown) {
  const lines = markdown.split("\n").filter(Boolean);
  return `<h3>模範レビュー</h3>${lines.map((line) => `<p>${inlineMarkdown(line)}</p>`).join("")}`;
}

function exampleBodyToHtml(markdown) {
  const lines = markdown.split("\n");
  const parts = [];
  let inFence = false;
  let code = [];

  const flushCode = () => {
    if (!code.length) return;
    parts.push(`<pre class="example-code"><code>${escapeHtml(code.join("\n"))}</code></pre>`);
    code = [];
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inFence) flushCode();
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      code.push(line);
      continue;
    }
    if (line.trim()) parts.push(`<p>${inlineMarkdown(line)}</p>`);
  }
  flushCode();
  return parts.join("");
}

function renderChapterExamples(chapter) {
  const examples = state.examples.get(chapter) || [];
  if (!examples.length) {
    elements.chapterExamples.innerHTML = "<p>この章の解説例を読み込めませんでした。</p>";
    return;
  }
  elements.chapterExamples.innerHTML = examples.map((example) => `
    <article class="example-card">
      <h4>${escapeHtml(example.title)}</h4>
      ${exampleBodyToHtml(example.body)}
    </article>
  `).join("");
}

function groupQuestions() {
  return state.questions.reduce((groups, question, index) => {
    if (!groups.has(question.chapter)) groups.set(question.chapter, []);
    groups.get(question.chapter).push({ question, index });
    return groups;
  }, new Map());
}

function renderNavigation() {
  elements.navigation.replaceChildren();
  for (const [chapter, items] of groupQuestions()) {
    const fragment = elements.chapterTemplate.content.cloneNode(true);
    const section = fragment.querySelector(".chapter-group");
    const toggle = fragment.querySelector(".chapter-toggle");
    fragment.querySelector(".chapter-name").textContent = chapter;
    fragment.querySelector(".chapter-count").textContent = `${items.filter(({ question }) => state.progress[question.id]?.complete).length}/${items.length}`;

    const list = fragment.querySelector(".question-list");
    for (const { question, index } of items) {
      const button = document.createElement("button");
      const progress = state.progress[question.id];
      button.type = "button";
      button.className = `question-button${index === state.activeIndex ? " is-active" : ""}${progress?.complete ? " is-complete" : ""}`;
      button.innerHTML = `
        <span class="question-state">${progress?.complete ? "✓" : ""}</span>
        <span><span class="question-number">${question.id}</span><br />${escapeHtml(question.title)}</span>
        <span class="question-score">${progress?.score !== undefined ? `${progress.score}/4` : ""}</span>
      `;
      button.addEventListener("click", () => selectQuestion(index));
      list.append(button);
    }

    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!expanded));
    });
    elements.navigation.append(section);
  }
}

function currentQuestion() {
  return state.questions[state.activeIndex];
}

function draftFor(id) {
  return state.progress[id]?.draft || {};
}

function readForm() {
  const checkedValue = (name) => elements.form.querySelector(`input[name="${name}"]:checked`)?.value || "";
  return {
    verdict: checkedValue("verdict"),
    severity: checkedValue("severity"),
    fact: elements.fact.value.trim(),
    condition: elements.condition.value.trim(),
    impact: elements.impact.value.trim(),
    proposal: elements.proposal.value.trim(),
    test: elements.testEvidence.value.trim(),
  };
}

function writeForm(draft) {
  elements.form.reset();
  for (const field of ["fact", "condition", "impact", "proposal"]) elements[field].value = draft[field] || "";
  elements.testEvidence.value = draft.test || "";
  for (const name of ["verdict", "severity"]) {
    const input = [...elements.form.querySelectorAll(`input[name="${name}"]`)]
      .find((candidate) => candidate.value === (draft[name] || ""));
    if (input) input.checked = true;
  }
}

function selectQuestion(index) {
  if (!state.questions.length) return;
  persistDraft();
  state.activeIndex = Math.max(0, Math.min(index, state.questions.length - 1));
  const question = currentQuestion();
  elements.chapterLabel.textContent = question.chapter;
  elements.questionLabel.textContent = question.id;
  elements.challengeTitle.textContent = question.title;
  elements.questionPrompt.textContent = question.prompt || "提示されたコードや状況をレビューしてください。";
  elements.codeContent.innerHTML = highlightCode(question.code);
  renderChapterExamples(question.chapter);
  elements.difficultyBadge.textContent = question.number <= 30 ? "FOUNDATION" : question.number <= 70 ? "PRACTICE" : "JUDGMENT";
  writeForm(draftFor(question.id));
  elements.formMessage.textContent = "";
  elements.formMessage.className = "form-message";
  elements.answerPanel.hidden = true;
  document.querySelectorAll(".self-score input").forEach((input) => { input.checked = false; });
  renderNavigation();
  showTab(question.code ? "code" : "spec");
  elements.sidebar.classList.remove("is-open");
}

function persistDraft() {
  const question = currentQuestion();
  if (!question) return;
  state.progress[question.id] = { ...state.progress[question.id], draft: readForm() };
  saveProgress();
}

function showTab(name) {
  document.querySelectorAll(".tab").forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll(".tab-view").forEach((view) => view.classList.remove("is-active"));
  document.querySelector(`#${name}-view`).classList.add("is-active");
}

function updateProgress() {
  const complete = state.questions.filter((question) => state.progress[question.id]?.complete).length;
  const percent = state.questions.length ? Math.round((complete / state.questions.length) * 100) : 0;
  elements.progressLabel.textContent = `${complete} / ${state.questions.length} 完了`;
  elements.progressBar.style.width = `${percent}%`;
  elements.progressTrack.setAttribute("aria-valuenow", String(percent));
}

function submitReview(event) {
  event.preventDefault();
  const review = readForm();
  if (!review.verdict || !review.fact) {
    elements.formMessage.textContent = "判定と「コード上の事実」を入力してください。";
    elements.formMessage.className = "form-message is-error";
    return;
  }
  persistDraft();
  elements.answerContent.innerHTML = answerToHtml(state.answers.get(currentQuestion().id) || "回答例が見つかりませんでした。自分の根拠を確認してください。");
  elements.answerPanel.hidden = false;
}

function completeQuestion() {
  const checks = [...document.querySelectorAll(".self-score input:checked")];
  const question = currentQuestion();
  state.progress[question.id] = {
    ...state.progress[question.id],
    draft: readForm(),
    complete: true,
    score: checks.length,
  };
  saveProgress();
  updateProgress();
  renderNavigation();
  if (state.activeIndex < state.questions.length - 1) selectQuestion(state.activeIndex + 1);
  else elements.answerPanel.hidden = true;
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => showTab(tab.dataset.tab)));
  document.querySelector("#previous-button").addEventListener("click", () => selectQuestion(state.activeIndex - 1));
  document.querySelector("#next-button").addEventListener("click", () => selectQuestion(state.activeIndex + 1));
  document.querySelector("#prove-button").addEventListener("click", () => { showTab("test"); elements.testEvidence.focus(); });
  document.querySelector("#close-answer").addEventListener("click", () => { elements.answerPanel.hidden = true; });
  document.querySelector("#complete-button").addEventListener("click", completeQuestion);
  document.querySelector("#copy-code").addEventListener("click", async (event) => {
    await navigator.clipboard.writeText(currentQuestion().code);
    event.currentTarget.textContent = "コピーしました";
    window.setTimeout(() => { event.currentTarget.textContent = "コードをコピー"; }, 1200);
  });
  document.querySelector("#reset-button").addEventListener("click", () => {
    if (!window.confirm("回答と進捗をすべて削除しますか？")) return;
    state.progress = {};
    saveProgress();
    updateProgress();
    selectQuestion(0);
  });
  document.querySelector("#open-sidebar").addEventListener("click", () => elements.sidebar.classList.add("is-open"));
  document.querySelector("#sidebar-toggle").addEventListener("click", () => elements.sidebar.classList.remove("is-open"));
  elements.form.addEventListener("submit", submitReview);
  elements.form.addEventListener("input", () => {
    elements.saveStatus.textContent = "編集中";
    window.clearTimeout(bindEvents.saveTimer);
    bindEvents.saveTimer = window.setTimeout(persistDraft, 500);
  });
  elements.testEvidence.addEventListener("input", () => {
    window.clearTimeout(bindEvents.testTimer);
    bindEvents.testTimer = window.setTimeout(persistDraft, 500);
  });
  window.addEventListener("beforeunload", persistDraft);
}

async function start() {
  bindEvents();
  try {
    const [sourceResponse, answerResponse] = await Promise.all([fetch(SOURCE_PATH), fetch(ANSWER_PATH)]);
    if (!sourceResponse.ok || !answerResponse.ok) throw new Error("教材ファイルの取得に失敗しました");
    const [sourceMarkdown, answerMarkdown] = await Promise.all([sourceResponse.text(), answerResponse.text()]);
    state.questions = parseQuestions(sourceMarkdown);
    state.examples = parseChapterExamples(sourceMarkdown);
    state.answers = parseAnswers(answerMarkdown);
    if (!state.questions.length) throw new Error("問題を解析できませんでした");
    updateProgress();
    selectQuestion(0);
  } catch (error) {
    console.error(error);
    elements.challengeTitle.textContent = "教材を読み込めませんでした";
    elements.loadError.hidden = false;
  }
}

start();
