import { useState, useRef } from 'react';

export default function About() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Phraze Overview',
          text: 'Listen to the overview of Phraze - an interactive platform for annotating conversations with AI models.',
          url: window.location.href
        });
      } catch (err) {
        console.log('Share cancelled or failed');
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
      } catch (err) {
        console.log('Failed to copy to clipboard');
      }
    }
  };

  return (
    <main style={{ 
      background: 'radial-gradient(900px 600px at 15% 3%, rgba(148, 163, 184, 0.14) 0%, rgba(148, 163, 184, 0.07) 25%, rgba(255, 255, 255, 0) 60%), radial-gradient(1100px 700px at 85% 10%, rgba(148, 163, 184, 0.14) 0%, rgba(148, 163, 184, 0.08) 30%, rgba(255, 255, 255, 0) 65%), radial-gradient(900px 600px at 50% 95%, rgba(148, 163, 184, 0.12) 0%, rgba(255, 255, 255, 0) 55%), linear-gradient(180deg, #f8f9fd 0%, #ffffff 70%, #f8f9fd 100%)',
      minHeight: '100vh',
      padding: '4rem 2rem'
    }}>
      <div className="container" style={{ maxWidth: '850px', margin: '0 auto' }}>
        <div className="hero-samples" style={{ paddingTop: '2rem' }}>
          <div className="audio-player-compact">
            <button 
              className={`audio-play-btn-compact ${isPlaying ? 'playing' : ''}`}
              onClick={handlePlayPause}
              aria-label={isPlaying ? "Pause overview audio" : "Play overview audio"}
            >
              <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
            </button>
            
            <div className="audio-time-display">
              {formatTime(currentTime)}
            </div>
            
            <div className="audio-speed-controls">
              {[0.5, 1, 1.5, 2].map(speed => (
                <button
                  key={speed}
                  className={`speed-btn ${playbackSpeed === speed ? 'active' : ''}`}
                  onClick={() => handleSpeedChange(speed)}
                  aria-label={`Play at ${speed}x speed`}
                >
                  {speed}x
                </button>
              ))}
            </div>
            
            <button 
              className="audio-share-btn-compact" 
              onClick={handleShare}
              aria-label="Share overview"
            >
              <i className="fas fa-share"></i>
            </button>
            
            <audio
              ref={audioRef}
              onEnded={() => setIsPlaying(false)}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
            >
              <source src="/voice.mp3" type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
          </div>
          <h2 className="samples-title" style={{
            fontFamily: '"Inter", "Inter Fallback", sans-serif',
            fontSize: '1.7rem'
          }}>Overview</h2>
          <p className="samples-description">
            Phraze is a collaborative workspace for conversations with language models. Instead of exporting transcripts or switching between platforms, teams can work directly in the chat thread. With built-in labels, notes, and annotations, Phraze organizes discussions and captures insights as they happen.
          </p>
          <p className="samples-description">
            The future of language models is not individuals talking to isolated agents, but shared spaces where users can collaborate. Phraze enables teams to engage with an AI collectively, annotate in real time, exchange ideas, and make informed decisions together. Collaboration is built in at the core.
          </p>
          <p className="samples-description" style={{ marginBottom: '8rem' }}>
            Unlike traditional tools that leave dialogue static, Phraze keeps everything in context and transforms conversations into a living workspace. Try it now at phrazeapp.ai.
          </p>
        </div>
      </div>
    </main>
  );
}

