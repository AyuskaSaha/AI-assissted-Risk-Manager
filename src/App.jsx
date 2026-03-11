// ============================================================
//  RiskShield — Root App Component
//  Manages screen routing: upload → analyzing → dashboard
// ============================================================

import { usePipeline }    from "./hooks/usePipeline.js";
import UploadView         from "./views/UploadView.jsx";
import AnalysisView       from "./views/AnalysisView.jsx";
import DashboardView      from "./views/DashboardView.jsx";

export default function App() {
  const {
    screen, logs, progress, stage,
    risks, summary, ragIndex,
    sessionId, reportUrl,
    apiKey, start, reset,
  } = usePipeline();

  return (
    <>
      {screen === "upload"    && <UploadView    onStart={start} defaultApiKey={apiKey} />}
      {screen === "analyzing" && <AnalysisView  logs={logs} progress={progress} stage={stage} />}
      {screen === "dashboard" && (
        <DashboardView
          risks={risks}
          summary={summary}
          ragIndex={ragIndex}
          apiKey={apiKey}
          sessionId={sessionId}
          reportUrl={reportUrl}
          onReset={reset}
        />
      )}
    </>
  );
}
