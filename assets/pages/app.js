import { createAnthropicMessage } from "../anthropic.js";
import { extractHtmlDocument } from "../postprocess.js";
import { buildUserPrompt, SYSTEM_PROMPT } from "../prompt.js";
import { DEFAULT_MODEL } from "../shared.js";
const SESSION_KEY = "urushi.anthropic-api-key.session";
const LOCAL_KEY = "urushi.anthropic-api-key.local";
const SAVE_KEY = "urushi.save-api-key";
function requiredElement(selector) {
    const element = document.querySelector(selector);
    if (!element)
        throw new Error(`required element not found: ${selector}`);
    return element;
}
const promptInput = requiredElement("#prompt");
const apiKeyInput = requiredElement("#api-key");
const saveKeyInput = requiredElement("#save-key");
const clearKeyButton = requiredElement("#clear-key");
const modelInput = requiredElement("#model");
const count = requiredElement("#character-count");
const generateButton = requiredElement("#generate");
const sampleButton = requiredElement("#show-sample");
const statusBox = requiredElement("#status");
const preview = requiredElement("#preview");
const emptyState = requiredElement("#empty-state");
const downloadButton = requiredElement("#download");
const openTabButton = requiredElement("#open-tab");
let generatedHtml = "";
let objectUrl = null;
function updateCount() {
    count.textContent = `${promptInput.value.length.toLocaleString("ja-JP")} 文字`;
}
function setStatus(message, isError = false) {
    statusBox.textContent = message;
    statusBox.classList.toggle("error", isError);
}
function setBusy(isBusy) {
    generateButton.disabled = isBusy;
    generateButton.textContent = isBusy ? "生成中…" : "APIキーで生成";
}
function persistApiKey() {
    const key = apiKeyInput.value.trim();
    if (!key) {
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(LOCAL_KEY);
        return;
    }
    if (saveKeyInput.checked) {
        localStorage.setItem(LOCAL_KEY, key);
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.setItem(SAVE_KEY, "true");
    }
    else {
        sessionStorage.setItem(SESSION_KEY, key);
        localStorage.removeItem(LOCAL_KEY);
        localStorage.removeItem(SAVE_KEY);
    }
}
function restoreApiKey() {
    const localKey = localStorage.getItem(LOCAL_KEY);
    const sessionKey = sessionStorage.getItem(SESSION_KEY);
    apiKeyInput.value = localKey ?? sessionKey ?? "";
    saveKeyInput.checked = localStorage.getItem(SAVE_KEY) === "true" && Boolean(localKey);
}
function clearApiKey() {
    apiKeyInput.value = "";
    saveKeyInput.checked = false;
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LOCAL_KEY);
    localStorage.removeItem(SAVE_KEY);
    setStatus("APIキーをこのブラウザから削除しました。");
    apiKeyInput.focus();
}
function setPreview(html) {
    generatedHtml = html;
    preview.srcdoc = html;
    emptyState.classList.add("hidden");
    downloadButton.disabled = false;
    openTabButton.disabled = false;
    if (objectUrl)
        URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
}
async function generate() {
    const prompt = promptInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const model = modelInput.value.trim() || DEFAULT_MODEL;
    if (!prompt) {
        setStatus("スライドの概要を入力してください。", true);
        promptInput.focus();
        return;
    }
    if (!apiKey) {
        setStatus("Anthropic APIキーを入力してください。キー無しでは生成できません。「サンプルを表示」ならキー無しで確認できます。", true);
        apiKeyInput.focus();
        return;
    }
    persistApiKey();
    setBusy(true);
    setStatus("ブラウザからAnthropic APIへ直接リクエストしています。数十秒かかることがあります。");
    try {
        const completion = await createAnthropicMessage({
            apiKey,
            model,
            system: SYSTEM_PROMPT,
            prompt: buildUserPrompt(prompt),
            directBrowserAccess: true,
        });
        const html = extractHtmlDocument(completion);
        setPreview(html);
        setStatus(`生成しました（model: ${model}）。プレビュー内をクリックするとキー操作できます。`);
    }
    catch (error) {
        setStatus(error instanceof Error ? error.message : String(error), true);
    }
    finally {
        setBusy(false);
    }
}
async function showSample() {
    sampleButton.disabled = true;
    try {
        const response = await fetch("./sample.html", { cache: "no-store" });
        if (!response.ok)
            throw new Error(`サンプルの読み込みに失敗しました（HTTP ${response.status}）`);
        setPreview(await response.text());
        setStatus("サンプルHTMLを表示しました。APIキーは使っていません。");
    }
    catch (error) {
        setStatus(error instanceof Error ? error.message : String(error), true);
    }
    finally {
        sampleButton.disabled = false;
    }
}
function downloadHtml() {
    if (!generatedHtml)
        return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([generatedHtml], { type: "text/html" }));
    link.download = `urushi-slide-${new Date().toISOString().replace(/[:.]/g, "-")}.html`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
promptInput.addEventListener("input", updateCount);
apiKeyInput.addEventListener("input", persistApiKey);
saveKeyInput.addEventListener("change", persistApiKey);
clearKeyButton.addEventListener("click", clearApiKey);
generateButton.addEventListener("click", () => void generate());
sampleButton.addEventListener("click", () => void showSample());
downloadButton.addEventListener("click", downloadHtml);
openTabButton.addEventListener("click", () => {
    if (objectUrl)
        window.open(objectUrl, "_blank", "noopener,noreferrer");
});
modelInput.value = DEFAULT_MODEL;
restoreApiKey();
updateCount();
