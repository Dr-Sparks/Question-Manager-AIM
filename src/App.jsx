import React from "react";
import AIMExamManager from "../AIMExamManager.jsx";
import UpdateBanner from "./UpdateBanner.jsx";

// AIMExamManager owns its own min-height:100vh layout. We render the
// banner above it in document flow; when the banner is null (idle/no
// update), there's zero visual difference from the previous app.
export default function App() {
  return (
    <>
      <UpdateBanner />
      <AIMExamManager />
    </>
  );
}
