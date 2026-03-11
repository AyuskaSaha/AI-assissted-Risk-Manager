// ============================================================
//  RiskShield — Copilot Component
//  Conversational AI assistant with full risk + RAG context.
//  When USE_AWS=true: chat history is persisted to DynamoDB.
// ============================================================

import { useState, useRef, useEffect } from "react";
import { T }                            from "../../styles/tokens.js";
import { callGemini }                   from "../../agents/geminiClient.js";
import { retrieve }                     from "../../utils/rag.js";
import { COPILOT_SYS }                  from "../../agents/prompts.js";
import { USE_AWS }                      from "../../config.js";
import { dynamoSaveChatMessage }        from "../../aws/awsService.js";

const STARTER_PROMPTS = [
  "What are the top 3 critical risks?",
  "Which compliance policies are violated?",
  "Give me a remediation roadmap",
  "What is the overall risk posture?",
  "Which module needs immediate attention?",
];

function renderMarkdown(text) {
  return text.split("\n").map((line, i) => {
    const withBold = line.replace(
      /\*\*(.*?)\*\*/g,
      (_, m) => `<strong style="color:${T.text}">${m}</strong>`
    );
    const isBullet = line.trim().startsWith("- ") || line.trim().startsWith("• ");
    return (
      <div
        key={i}
        style={{ marginBottom: isBullet ? 4 : 2, paddingLeft: isBullet ? 12 : 0, color: T.textMid, fontSize: 13, lineHeight: 1.8 }}
        dangerouslySetInnerHTML={{ __html: withBold || "&nbsp;" }}
      />
    );
  });
}

export default function Copilot({ apiKey, ragIndex, risks, sessionId }) {
  const [messages, setMessages] = useState([{
    role: "ai",
    text: "Analysis complete. I have full context on all identified risks, policy gaps, and mitigations. What would you like to explore?",
  }]);
  const [input, setInput] = useState("");
  const [busy,  setBusy]  = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const riskSummary = risks
    .map((r) => `${r.id} [${r.severity}] ${r.title} — L:${r.likelihood} I:${r.impact} Policy:${r.policy_status} Mitigation:${r.mitigation ?? "none"}`)
    .join("\n");

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setBusy(true);

    // Persist user message to DynamoDB if AWS is on
    if (USE_AWS && sessionId) {
      dynamoSaveChatMessage(sessionId, "user", msg).catch(() => {});
    }

    try {
      const ragCtx = retrieve(ragIndex, msg, 5);
      const system = COPILOT_SYS(riskSummary, ragCtx);
      const reply  = await callGemini(apiKey, system, msg);
      setMessages((m) => [...m, { role: "ai", text: reply }]);

      // Persist AI reply to DynamoDB if AWS is on
      if (USE_AWS && sessionId) {
        dynamoSaveChatMessage(sessionId, "ai", reply).catch(() => {});
      }
    } catch (e) {
      setMessages((m) => [...m, { role: "ai", text: `⚠ ${e.message}` }]);
    }
    setBusy(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 520 }}>
      {/* Chat messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: 10 }}>
            {m.role === "ai" && (
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: `${T.violet}20`, border: `1px solid ${T.violet}50`, display: "flex", alignItems: "center", justifyContent: "center", color: T.violet, fontSize: 13, flexShrink: 0, marginTop: 4 }}>✦</div>
            )}
            <div style={{
              maxWidth: "80%", padding: "12px 16px",
              background: m.role === "user" ? `${T.cyan}15` : T.cardHi,
              border: `1px solid ${m.role === "user" ? T.cyan + "44" : T.border}`,
              borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
            }}>
              {m.role === "user"
                ? <div style={{ fontSize: 13, color: T.text }}>{m.text}</div>
                : renderMarkdown(m.text)
              }
            </div>
            {m.role === "user" && (
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: `${T.cyan}20`, border: `1px solid ${T.cyan}50`, display: "flex", alignItems: "center", justifyContent: "center", color: T.cyan, fontSize: 10, flexShrink: 0, marginTop: 4 }}>YOU</div>
            )}
          </div>
        ))}

        {busy && (
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: `${T.violet}20`, border: `1px solid ${T.violet}50`, display: "flex", alignItems: "center", justifyContent: "center", color: T.violet, fontSize: 13 }}>✦</div>
            <div style={{ padding: "12px 16px", background: T.cardHi, border: `1px solid ${T.border}`, borderRadius: "12px 12px 12px 4px", display: "flex", gap: 5, alignItems: "center" }}>
              {[0, 200, 400].map((d) => (
                <div key={d} style={{ width: 7, height: 7, borderRadius: "50%", background: T.violet, animation: "blink 1.2s ease-in-out infinite", animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Starter prompts */}
      <div style={{ padding: "10px 16px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {STARTER_PROMPTS.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            style={{ padding: "4px 10px", fontSize: 11, background: "transparent", border: `1px solid ${T.border}`, borderRadius: 3, color: T.textMid, fontFamily: T.mono, cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={(e) => { e.target.style.borderColor = T.violet; e.target.style.color = T.violet; }}
            onMouseLeave={(e) => { e.target.style.borderColor = T.border;  e.target.style.color = T.textMid; }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div style={{ padding: "12px 16px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 10 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder={USE_AWS && sessionId ? "Ask anything… (chat saved to DynamoDB)" : "Ask anything about the risk analysis…"}
          style={{ flex: 1, padding: "10px 14px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 13, outline: "none", fontFamily: T.font }}
        />
        <button
          onClick={() => send()}
          disabled={busy}
          style={{
            padding: "10px 22px",
            background: busy ? T.border : `linear-gradient(135deg, ${T.violet}, #7B2FFF)`,
            border: "none", borderRadius: 6,
            color: busy ? T.textMid : "#fff",
            fontWeight: 800, fontSize: 13,
            cursor: busy ? "not-allowed" : "pointer",
            fontFamily: T.font, letterSpacing: "0.04em",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
