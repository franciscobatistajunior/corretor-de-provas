import type { OmrResult } from "../lib/cv/types";

interface ReviewScreenProps {
  omrResult: OmrResult | null;
  reviewedAnswers: string[];
  debugWarpedImageUrl: string | null;
  onAnswerChange: (question: number, letter: string) => void;
  onConfirm: () => void;
}

const LETTERS = ["A", "B", "C", "D", "E"];

export function ReviewScreen({
  omrResult,
  reviewedAnswers,
  debugWarpedImageUrl,
  onAnswerChange,
  onConfirm,
}: ReviewScreenProps) {
  if (!omrResult) {
    return (
      <section className="panel">
        <h2>4. Revisar respostas</h2>
        <p className="hint">Nenhuma leitura disponível ainda.</p>
      </section>
    );
  }

  const flaggedCount = omrResult.perQuestion.filter((q) => q.ambiguous || q.lowConfidence).length;

  return (
    <section className="panel">
      <h2>4. Revisar respostas</h2>
      <p className="hint">
        Confira as respostas detectadas antes de calcular a nota. Questões em destaque tiveram leitura incerta
        (marcação em branco, dupla marcação ou baixa confiança) — vale a pena olhar a foto com atenção nelas.
      </p>

      {flaggedCount > 0 && (
        <div className="callout warning">
          {flaggedCount} questão(ões) com leitura incerta — revise antes de confirmar.
        </div>
      )}

      {debugWarpedImageUrl && (
        <details style={{ margin: "12px 0" }}>
          <summary className="hint" style={{ cursor: "pointer" }}>
            Ver cartão alinhado (depuração)
          </summary>
          <img
            src={debugWarpedImageUrl}
            alt="Cartão-resposta alinhado"
            style={{ maxWidth: "100%", borderRadius: 8, marginTop: 8 }}
          />
        </details>
      )}

      <div style={{ display: "grid", gap: 8, margin: "16px 0" }}>
        {omrResult.perQuestion.map((question) => {
          const needsAttention = question.ambiguous || question.lowConfidence;
          const current = reviewedAnswers[question.question - 1] ?? "";

          return (
            <div
              key={question.question}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderRadius: 8,
                background: needsAttention ? "var(--warning-bg)" : "transparent",
              }}
            >
              <strong style={{ minWidth: 32 }}>{question.question}.</strong>
              {LETTERS.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  className={current === letter ? undefined : "ghost"}
                  style={{ padding: "6px 10px", minWidth: 36 }}
                  onClick={() => onAnswerChange(question.question, letter)}
                >
                  {letter}
                </button>
              ))}
              <button
                type="button"
                className={current === "" ? undefined : "ghost"}
                style={{ padding: "6px 10px" }}
                onClick={() => onAnswerChange(question.question, "")}
              >
                Em branco
              </button>
              {question.ambiguous && <span className="hint">dupla marcação</span>}
              {!question.ambiguous && question.lowConfidence && <span className="hint">confiança baixa</span>}
            </div>
          );
        })}
      </div>

      <div className="actions">
        <button type="button" onClick={onConfirm}>
          Confirmar e ver resultado
        </button>
      </div>
    </section>
  );
}
