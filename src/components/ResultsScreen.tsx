import type { CompareResult } from "../lib/grading/types";

interface ResultsScreenProps {
  compareResult: CompareResult | null;
  onRestart: () => void;
}

export function ResultsScreen({ compareResult, onRestart }: ResultsScreenProps) {
  if (!compareResult) {
    return (
      <section className="panel">
        <h2>5. Resultado</h2>
        <p className="hint">Nenhuma correção disponível ainda.</p>
      </section>
    );
  }

  const { acertos, erros, porcentagem, wrongQuestions } = compareResult;

  return (
    <section className="panel">
      <h2>5. Resultado</h2>

      <div className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">Acertos</span>
          <strong>{acertos}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Erros</span>
          <strong>{erros}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Porcentagem</span>
          <strong>{porcentagem}%</strong>
        </article>
      </div>

      <h3>Questões erradas</h3>
      {wrongQuestions.length > 0 ? (
        <ul>
          {wrongQuestions.map((question) => (
            <li key={question}>Questão {question}</li>
          ))}
        </ul>
      ) : (
        <p className="callout success">Nenhuma questão errada.</p>
      )}

      <div className="actions">
        <button type="button" onClick={onRestart}>
          Corrigir outra prova
        </button>
      </div>
    </section>
  );
}
