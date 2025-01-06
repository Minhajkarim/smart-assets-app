import React from 'react';
import './App.css';
import VideoUpload from './components/VideoUpload';
import VideoListPlayer from './components/VideoListPlayer';

function App() {
  return (
    <div className="App">
      <VideoUpload/>
      <VideoListPlayer/>
    </div>
  );
}

export default App;