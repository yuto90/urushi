const overviewInput = document.querySelector('#overview');
const providerInput = document.querySelector('#provider');
const generateButton = document.querySelector('#generate');
const rebuildButton = document.querySelector('#rebuild');
const exportButton = document.querySelector('#export');
const openTabButton = document.querySelector('#open-tab');
const statusBox = document.querySelector('#status');
const iterationsBox = document.querySelector('#iterations');
const errorsBox = document.querySelector('#errors');
const yamlEditor = document.querySelector('#yaml-editor');
const preview = document.querySelector('#preview');
const emptyState = document.querySelector('#empty-state');
const downloadPdf = document.querySelector('#download-pdf');
const downloadPptx = document.querySelector('#download-pptx');

let currentJob = null;
let polling = null;

function setStatus(message, state = '') {
  statusBox.textContent = message;
  statusBox.className = `status ${state}`.trim();
}

function setBusy(busy) {
  generateButton.disabled = busy;
  generateButton.textContent = busy ? '生成・修正中…' : '生成して自己修正';
}

function renderIterations(iterations) {
  iterationsBox.innerHTML = '';
  for (const iteration of iterations || []) {
    const item = document.createElement('li');
    const label = document.createElement('strong');
    label.textContent = `iteration ${iteration.iteration}`;
    const detail = document.createElement('span');
    const errorCount = typeof iteration.errors === 'number' ? iteration.errors : iteration.errors?.length ?? 0;
    detail.textContent = iteration.validSchema ? `${errorCount} errors / ${iteration.screenshots} shots` : 'schema error';
    item.append(label, detail);
    iterationsBox.append(item);
  }
}

function renderErrors(errors) {
  errorsBox.innerHTML = '';
  errorsBox.classList.toggle('empty', !errors || errors.length === 0);
  if (!errors || errors.length === 0) {
    errorsBox.textContent = 'エラーはありません。';
    return;
  }
  for (const error of errors) {
    const card = document.createElement('div');
    card.className = 'error-card';
    const title = document.createElement('div');
    title.innerHTML = `<span class="rule"></span> slide <code></code>`;
    title.querySelector('.rule').textContent = error.rule;
    title.querySelector('code').textContent = `${error.slide}: ${error.path}`;
    const measured = document.createElement('div');
    measured.textContent = `${error.measured}${error.unit} / limit ${error.limit}${error.unit}`;
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = error.hint;
    card.append(title, measured, hint);
    errorsBox.append(card);
  }
}

function refreshPreview() {
  if (!currentJob) return;
  preview.src = `/api/jobs/${currentJob}/html?ts=${Date.now()}`;
  emptyState.classList.add('hidden');
  openTabButton.disabled = false;
  exportButton.disabled = false;
}

async function loadYaml() {
  if (!currentJob) return;
  const response = await fetch(`/api/jobs/${currentJob}/yaml?ts=${Date.now()}`);
  if (response.ok) {
    yamlEditor.value = await response.text();
    rebuildButton.disabled = false;
  }
}

function applyJob(job) {
  renderIterations(job.iterations);
  if (job.status === 'running') {
    const count = job.iterations?.length || 0;
    setStatus(count ? `自己修正ループを実行中です（${count}回目の検証まで完了）。` : 'AIが deck.yaml を生成しています。');
    return false;
  }
  if (job.status === 'failed') {
    setStatus(job.error || '生成に失敗しました。', 'error');
    return true;
  }
  const errors = job.result?.finalErrors || [];
  renderErrors(errors);
  if (job.result?.ok) {
    setStatus(`生成完了: ${job.result.provider} / ${job.result.model}。検証エラーはありません。`, 'ok');
  } else {
    setStatus('生成は完了しましたが、検証エラーが残っています。YAMLを編集するか再度修正してください。', 'error');
  }
  refreshPreview();
  loadYaml();
  return true;
}

async function pollJob(id) {
  const response = await fetch(`/api/jobs/${id}`);
  if (!response.ok) throw new Error(`job status HTTP ${response.status}`);
  const job = await response.json();
  const settled = applyJob(job);
  if (settled && polling) {
    clearInterval(polling);
    polling = null;
    setBusy(false);
  }
}

async function generate() {
  const overview = overviewInput.value.trim();
  if (!overview) {
    setStatus('概要を入力してください。', 'error');
    return;
  }
  if (polling) clearInterval(polling);
  setBusy(true);
  errorsBox.textContent = '生成後に検証します。';
  errorsBox.className = 'errors empty';
  iterationsBox.innerHTML = '';
  yamlEditor.value = '';
  rebuildButton.disabled = true;
  exportButton.disabled = true;
  downloadPdf.className = 'download disabled';
  downloadPptx.className = 'download disabled';

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ overview, provider: providerInput.value }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    currentJob = body.id;
    setStatus('ジョブを開始しました。');
    await pollJob(currentJob);
    polling = setInterval(() => pollJob(currentJob).catch((error) => setStatus(error.message, 'error')), 1500);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
    setBusy(false);
  }
}

async function rebuild() {
  if (!currentJob || !yamlEditor.value.trim()) return;
  rebuildButton.disabled = true;
  setStatus('YAMLを再ビルドして検証しています。');
  try {
    const response = await fetch(`/api/jobs/${currentJob}/rebuild`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ yaml: yamlEditor.value }),
    });
    const body = await response.json();
    if (!response.ok && !body.errors) throw new Error(body.error || `HTTP ${response.status}`);
    renderErrors(body.errors || []);
    for (const warning of body.warnings || []) console.warn(warning);
    setStatus(body.ok ? 'YAMLの再ビルドが完了しました。' : '再ビルド後も検証エラーがあります。', body.ok ? 'ok' : 'error');
    if (response.ok) refreshPreview();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    rebuildButton.disabled = false;
  }
}

async function exportFiles() {
  if (!currentJob) return;
  exportButton.disabled = true;
  exportButton.textContent = '書き出し中…';
  try {
    const response = await fetch(`/api/jobs/${currentJob}/export`, { method: 'POST' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    downloadPdf.href = `/api/jobs/${currentJob}/download-pdf`;
    downloadPptx.href = `/api/jobs/${currentJob}/download-pptx`;
    downloadPdf.className = 'download';
    downloadPptx.className = 'download';
    setStatus('PDF/PPTXを書き出しました。', 'ok');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    exportButton.disabled = false;
    exportButton.textContent = 'PDF/PPTXを書き出し';
  }
}

generateButton.addEventListener('click', generate);
rebuildButton.addEventListener('click', rebuild);
exportButton.addEventListener('click', exportFiles);
openTabButton.addEventListener('click', () => {
  if (currentJob) window.open(`/api/jobs/${currentJob}/html`, '_blank', 'noopener,noreferrer');
});
