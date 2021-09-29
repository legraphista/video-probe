import React from 'react';
import './App.css';
import {AppState} from "./AppState";
import {BitRateViewer} from "./components/bitrate/BitRateViewer";
import {PacingViewer} from "./components/fps/PacingViewer";
import {FramesViewer} from "./components/frames/FramesViewer";

function App() {
  return (
    <div className="App">
      <input
        type="file"
        onChange={(event) => {

          const file: File | null = (event as any).dataTransfer ? (event as any).dataTransfer?.files?.[0] : event.currentTarget!.files?.[0];

          if (file) {
            AppState.ffprobe.setFile(file);
          }

        }}
      />

      <BitRateViewer/>
      <PacingViewer/>
      <FramesViewer/>
    </div>
  );
}

export default App;
