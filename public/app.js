const promptInput = document.querySelector('#prompt');
const count = document.querySelector('#character-count');
const forceSample = document.querySelector('#force-sample');
const generateButton = document.querySelector('#generate');
const statusBox = document.querySelector('#status');
const preview = document.querySelector('#preview');
const emptyState = document.querySelector('#empty-state');
const downloadButton = document.querySelector('#download');
const openTabButton = document.querySelector('#open-tab');

let generatedHtml = '';
let objectUrl = null;

function updateCount() {
  count.textContent = `${promptInput.value.length.toLocaleString('ja-JP')} 文字`;
}

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle('error', isError);
}

function setBusy(isBusy) {
  generateButton.disabled = isBusy;
  generateButton.textContent = isBusy ? '生成中…' : 'スライドを生成';
}

function setPreview(html) {
  generatedHtml = html;
  preview.srcdoc = html;
  emptyState.classList.add('hidden');
  downloadButton.disabled = false;
  openTabButton.disabled = false;

  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
}

async function generate() {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    setStatus('概要を入力してください。', true);
    promptInput.focus();
    return;
  }

  setBusy(true);
  setStatus('スライドを生成しています。LLM利用時は数十秒かかることがあります。');

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, sample: forceSample.checked }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);

    setPreview(body.html);
    setStatus(body.usedMock
      ? 'サンプルHTMLでプレビューしました。APIキーを設定すると実際の生成結果になります。'
      : `生成しました（model: ${body.model}）。プレビュー内をクリックするとキー操作できます。`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true);
  } finally {
    setBusy(false);
  }
}

function downloadHtml() {
  if (!generatedHtml) return;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([generatedHtml], { type: 'text/html' }));
  link.download = `urushi-slide-${new Date().toISOString().replace(/[:.]/g, '-')}.html`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

promptInput.addEventListener('input', updateCount);
generateButton.addEventListener('click', generate);
downloadButton.addEventListener('click', downloadHtml);
openTabButton.addEventListener('click', () => {
  if (objectUrl) window.open(objectUrl, '_blank', 'noopener,noreferrer');
});

updateCount();
