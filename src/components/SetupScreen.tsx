import { useEffect, useState } from "react";
import { QUESTION_COUNT_PRESETS, type QuestionCountPreset } from "../lib/sheetLayout.types";
import { preloadOpenCv } from "../lib/cv/cvWorkerClient";

interface SetupScreenProps {
  totalQuestions: QuestionCountPreset;
  officialAnswersRaw: string;
  officialAnswers: string[];
  onTotalQuestionsChange: (value: QuestionCountPreset) => void;
  onOfficialAnswersChange: (value: string) => void;
  onContinue: () => void;
}

type EngineStatus = "loading" | "ready" | "error";

export function SetupScreen({
  totalQuestions,
  officialAnswersRaw,
  officialAnswers,
  onTotalQuestionsChange,
  onOfficialAnswersChange,
  onContinue,
}: SetupScreenProps) {
  const [engineStatus, setEngineStatus] = useState<EngineStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    preloadOpenCv()
      .then(() => {
        if (!cancelled) setEngineStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setEngineStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const answersMismatch = officialAnswers.length > 0 && officialAnswers.length !== totalQuestions;
  const canContinue = officialAnswers.length === totalQuestions && engineStatus !== "error";

  return (
    <section className="panel">
      <h2>1. Configurar prova</h2>

      <label htmlFor="totalQuestions">Quantidade de questões</label>
      <select
        id="totalQuestions"
        value={totalQuestions}
        onChange={(event) => onTotalQuestionsChange(Number(event.target.value) as QuestionCountPreset)}
      >
        {QUESTION_COUNT_PRESETS.map((preset) => (
          <option key={preset} value={preset}>
            {preset} questões
          </option>
        ))}
      </select>
      <p className="hint">Deve ser a mesma quantidade usada para gerar o cartão-resposta impresso.</p>

      <label htmlFor="officialAnswers">Gabarito oficial</label>
      <textarea
        id="officialAnswers"
        value={officialAnswersRaw}
        onChange={(event) => onOfficialAnswersChange(event.target.value)}
        placeholder="Ex.: A B C D E A B C D E..."
      />
      <p className="hint">
        {officialAnswers.length} de {totalQuestions} respostas informadas.
      </p>
      {answersMismatch && (
        <div className="callout warning">
          O gabarito tem {officialAnswers.length} respostas, mas a prova tem {totalQuestions} questões.
        </div>
      )}

      {engineStatus === "loading" && <p className="hint">Preparando o motor de leitura da câmera…</p>}
      {engineStatus === "error" && (
        <div className="callout error">
          Não foi possível carregar o motor de leitura (OpenCV.js). Verifique sua conexão e recarregue a página.
        </div>
      )}

      <div className="actions">
        <button type="button" onClick={onContinue} disabled={!canContinue}>
          Continuar para a câmera
        </button>
      </div>
    </section>
  );
}
