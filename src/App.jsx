import React from "react";
import AIMExamManager from "../AIMExamManager.jsx";
import UpdateBanner from "./UpdateBanner.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";

// AIMExamManager owns its own min-height:100vh layout. We render the
// banner above it in document flow; when the banner is null (idle/no
// update), there's zero visual difference from the previous app.
// The ErrorBoundary catches render-time failures anywhere in the tree
// so a crash never wipes the user's screen without a recovery path.
export default function App() {
  return (
    <ErrorBoundary>
      <UpdateBanner />
      <AIMExamManager />
    </ErrorBoundary>
  );
}
