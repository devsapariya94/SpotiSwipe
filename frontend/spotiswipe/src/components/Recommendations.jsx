import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { User, Music2, Zap, Radio, Disc, Redo2, Play, Pause, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from "./ui/alert";

const SongItem = React.memo(({ song, index, onPlayStart, currentlyPlaying, setCurrentlyPlaying }) => {
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showAlert, setShowAlert] = useState(false);
  const audioRef = useRef(null);
  const isPlaying = currentlyPlaying === song.track_id;
  const baseUrl = 'https://backend.spotiswipe.devsdemo.co/';

  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;
    
    const handleTimeUpdate = () => {
      setProgress((audio.currentTime / audio.duration) * 100);
    };

    const handleEnded = () => {
      setCurrentlyPlaying(null);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [setCurrentlyPlaying]);

  useEffect(() => {
    if (!isPlaying && audioRef.current) {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  const togglePlay = async () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setCurrentlyPlaying(null);
      return;
    }

    if (!previewUrl) {
      try {
        onPlayStart();
        const response = await fetch(`${baseUrl}/get-song-detail`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ track_id: song.track_id })
        });
        
        if (!response.ok) throw new Error('Failed to fetch preview URL');
        
        const data = await response.json();
        if (!data.preview_url) {
          setShowAlert(true);
          return;
        }
        
        setPreviewUrl(data.preview_url);
        if (audioRef.current) {
          audioRef.current.src = data.preview_url;
          await audioRef.current.play();
          setCurrentlyPlaying(song.track_id);
        }
      } catch (error) {
        console.error('Error:', error);
        setShowAlert(true);
      }
    } else {
      onPlayStart();
      try {
        await audioRef.current.play();
        setCurrentlyPlaying(song.track_id);
      } catch (error) {
        console.error('Playback error:', error);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white/10 p-4 rounded-lg hover:bg-white/20 transition-all duration-300"
    >
      {showAlert && (
        <Alert className="mb-4 bg-yellow-500/20 text-yellow-200 border-yellow-500/50">
          <AlertDescription>
            Preview not available. Try listening on Spotify instead.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-bold text-white mb-1">{song.track_name}</h3>
          <div className="flex items-center gap-4 text-sm text-gray-300">
            <span className="flex items-center gap-1">
              <User size={16} /> {song.artists}
            </span>
            <span className="flex items-center gap-1">
              <Music2 size={16} /> {song.track_genre}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={togglePlay}
            className="p-2 rounded-full bg-green-500/20 text-green-300 hover:bg-green-500/30"
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </motion.button>
          <motion.a
            href={`https://open.spotify.com/track/${song.track_id}`}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-full bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
          >
            <ExternalLink size={20} />
          </motion.a>
        </div>
      </div>

      <audio
        ref={audioRef}
        preload="none"
        onError={() => setShowAlert(true)}
      />

      {isPlaying && (
        <div className="mt-2 w-full">
          <div className="h-1 bg-gray-700/50 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-green-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-4 mt-2 text-sm text-gray-400">
        <span className="flex items-center gap-1">
          <Zap size={16} /> Energy: {Math.round(song.energy * 100)}%
        </span>
        <span className="flex items-center gap-1">
          <Radio size={16} /> Popularity: {song.popularity}%
        </span>
        <span className="flex items-center gap-1">
          <Disc size={16} /> Dance: {Math.round(song.danceability * 100)}%
        </span>
      </div>
    </motion.div>
  );
});

const Recommendations = ({ songs, onRestart }) => {
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  
  const stopCurrentAudio = useCallback(() => {
    setCurrentlyPlaying(null);
    const audios = document.getElementsByTagName('audio');
    Array.from(audios).forEach(audio => {
      audio.pause();
    });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full flex flex-col items-center"
    >
      <h2 className="text-2xl font-bold text-white mb-6 text-center">Your Personalized Recommendations</h2>
      <div className="space-y-4 mb-6 w-full max-w-3xl">
        {songs.map((song, index) => (
          <SongItem 
            key={song.track_id} 
            song={song} 
            index={index}
            onPlayStart={stopCurrentAudio}
            currentlyPlaying={currentlyPlaying}
            setCurrentlyPlaying={setCurrentlyPlaying}
          />
        ))}
      </div>
      <button
        onClick={onRestart}
        className="w-full max-w-3xl p-4 rounded-lg bg-green-500 text-white font-semibold 
          transition-all duration-300 hover:bg-green-600 flex items-center justify-center gap-2"
      >
        <Redo2 size={20} /> Start Over
      </button>

      <h5 className="text-1xl font-bold text-white mt-6 mb-6 text-center">There can be some error since it is a custom ML model</h5>
    </motion.div>
  );
};

export default Recommendations;