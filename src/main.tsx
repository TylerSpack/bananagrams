import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ErrorBoundary } from "react-error-boundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary
      fallbackRender={({ error }) => (
        <div className="flex h-screen flex-col items-center justify-center">
          <h1 className="mb-4 text-2xl font-bold text-red-600">
            Something went wrong.
          </h1>
          <pre className="rounded bg-red-100 p-4 text-red-800">
            {error.message}
          </pre>
        </div>
      )}
    >
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
