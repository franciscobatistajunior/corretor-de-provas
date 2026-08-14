import { useReducer } from "react";
import { examReducer, initialExamState } from "./state/examReducer";
import { SetupScreen } from "./components/SetupScreen";
import { CaptureScreen } from "./components/CaptureScreen";
import { ProcessingScreen } from "./components/ProcessingScreen";
import { ReviewScreen } from "./components/ReviewScreen";
import { ResultsScreen } from "./components/ResultsScreen";

function App() {
  const [state, dispatch] = useReducer(examReducer, initialExamState);

  return (
    <>
      <header>
        <h1>Corretor de Provas</h1>
        <p className="hint">Leitura automática de cartão-resposta por webcam.</p>
      </header>

      {state.step === "setup" && (
        <SetupScreen
          totalQuestions={state.totalQuestions}
          officialAnswersRaw={state.officialAnswersRaw}
          officialAnswers={state.officialAnswers}
          onTotalQuestionsChange={(totalQuestions) => dispatch({ type: "SET_TOTAL_QUESTIONS", totalQuestions })}
          onOfficialAnswersChange={(raw) => dispatch({ type: "SET_OFFICIAL_ANSWERS_RAW", raw })}
          onContinue={() => dispatch({ type: "GO_TO_CAPTURE" })}
        />
      )}

      {state.step === "capture" && (
        <CaptureScreen
          error={state.error}
          onPhotoCaptured={(dataUrl) => dispatch({ type: "PHOTO_CAPTURED", dataUrl })}
          onBack={() => dispatch({ type: "RESTART" })}
        />
      )}

      {state.step === "processing" && state.capturedImageDataUrl && (
        <ProcessingScreen
          capturedImageDataUrl={state.capturedImageDataUrl}
          totalQuestions={state.totalQuestions}
          onSuccess={(result, debugImageUrl) => dispatch({ type: "PROCESSING_SUCCEEDED", result, debugImageUrl })}
          onError={(error) => dispatch({ type: "PROCESSING_FAILED", error })}
        />
      )}

      {state.step === "review" && (
        <ReviewScreen
          omrResult={state.omrResult}
          reviewedAnswers={state.reviewedAnswers}
          debugWarpedImageUrl={state.debugWarpedImageUrl}
          onAnswerChange={(question, letter) => dispatch({ type: "UPDATE_REVIEWED_ANSWER", question, letter })}
          onConfirm={() => dispatch({ type: "CONFIRM_REVIEW" })}
        />
      )}

      {state.step === "results" && (
        <ResultsScreen compareResult={state.compareResult} onRestart={() => dispatch({ type: "RESTART" })} />
      )}
    </>
  );
}

export default App;
