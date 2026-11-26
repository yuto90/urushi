export function extractHtmlDocument(modelOutput) {
    const withoutFence = unwrapCodeFence(modelOutput.trim());
    const startMatch = withoutFence.search(/<!doctype\s+html|<html[\s>]/i);
    const endIndex = withoutFence.toLowerCase().lastIndexOf("</html>");
    if (startMatch >= 0 && endIndex >= 0) {
        return withoutFence.slice(startMatch, endIndex + "</html>".length).trim();
    }
    throw new Error("LLM応答から完全なHTMLドキュメントを抽出できませんでした");
}
function unwrapCodeFence(text) {
    const fenceMatch = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
    return fenceMatch ? fenceMatch[1].trim() : text;
}
