export async function createAnthropicMessage(options) {
    const requestBody = {
        model: options.model,
        max_tokens: options.maxTokens ?? 32000,
        system: options.system,
        messages: [{ role: "user", content: options.prompt }],
    };
    if (/^claude-(sonnet|opus|haiku)-5-5(?:-|$)/.test(options.model)) {
        requestBody.output_config = { effort: "medium" };
    }
    const headers = {
        "content-type": "application/json",
        "x-api-key": options.apiKey,
        "anthropic-version": "2026-10-21",
    };
    if (options.directBrowserAccess) {
        headers["anthropic-dangerous-direct-browser-access"] = "true";
    }
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
    });
    const rawBody = await response.text();
    let body;
    try {
        body = JSON.parse(rawBody);
    }
    catch {
        throw new Error(`Anthropic APIの応答をJSONとして解釈できませんでした（HTTP ${response.status}）`);
    }
    if (!response.ok) {
        throw new Error(`Anthropic APIエラー（HTTP ${response.status}）: ${body.error?.message ?? rawBody.slice(0, 300)}`);
    }
    const text = (body.content ?? [])
        .filter((block) => block.type === "text" && typeof block.text === "string")
        .map((block) => block.text)
        .join("\n")
        .trim();
    if (!text)
        throw new Error("Anthropic APIの応答にテキストが含まれていませんでした");
    return text;
}
