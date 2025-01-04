import React, { useState, useRef, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Heart, X, Play, Pause, Volume2, VolumeX } from 'lucide-react';

const SongCard = ({ song, onSwipe, currentIndex, totalSongs }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [albumImage, setAlbumImage] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwipeLoading, setIsSwipeLoading] = useState(false);
  const controls = useAnimation();
  const cardRef = useRef(null);
  const audioRef = useRef(null);

  const baseUrl = 'https://backend.spotiswipe.devsdemo.co/';

  useEffect(() => {
    if (previewUrl && audioRef.current) {
      setIsLoading(true);
      
      audioRef.current.volume = 0.7;
      
      const playAudio = async () => {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (error) {
          console.error('Autoplay failed:', error);
          setIsPlaying(false);
        } finally {
          setIsLoading(false);
        }
      };

      const handleCanPlay = () => {
        playAudio();
      };

      audioRef.current.addEventListener('canplay', handleCanPlay);
      
      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener('canplay', handleCanPlay);
          audioRef.current.pause();
        }
      };
    }
  }, [previewUrl]);

  useEffect(() => {
    setImageLoaded(false);
    setAlbumImage(null);
    setProgress(0);
    setIsLoading(true);
    controls.set({ x: 0, rotate: 0, opacity: 1 });
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [song]);

  useEffect(() => {
    const fetchSongDetails = async () => {
      if (!song?.track_id) return;
      
      try {
        setImageLoaded(false);
        const response = await fetch(`${baseUrl}/get-song-detail`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ track_id: song.track_id })
        });
        
        if (!response.ok) throw new Error('Failed to fetch song details');
        
        const data = await response.json();
        setAlbumImage(data.image);
        setPreviewUrl(data.preview_url);
      } catch (error) {
        console.error('Error fetching song details:', error);
        setAlbumImage(null);
        setPreviewUrl(null);
      } finally {
        setImageLoaded(true);
      }
    };

    fetchSongDetails();
  }, [song?.track_id]);

  useEffect(() => {
    if (audioRef.current) {
      const handleTimeUpdate = () => {
        const duration = audioRef.current.duration;
        const currentTime = audioRef.current.currentTime;
        setProgress((currentTime / duration) * 100);
      };

      const handleEnded = () => {
        setIsPlaying(false);
        setProgress(0);
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(console.error);
        }
      };

      audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
      audioRef.current.addEventListener('ended', handleEnded);

      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
          audioRef.current.removeEventListener('ended', handleEnded);
        }
      };
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = async (e) => {
      if (isDragging || isAnimating || !song) return;
      
      if (e.key === 'ArrowLeft') {
        await animateSwipe('dislike');
      } else if (e.key === 'ArrowRight') {
        await animateSwipe('like');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDragging, isAnimating, song]);

  const togglePlay = async () => {
    if (!audioRef.current || !previewUrl) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        await audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const animateSwipe = async (direction) => {
    if (isAnimating || !cardRef.current) return;
    
    try {
      setIsAnimating(true);
      setIsSwipeLoading(true);
      
      if (audioRef.current) {
        const fadeOut = setInterval(() => {
          if (audioRef.current.volume > 0.1) {
            audioRef.current.volume -= 0.1;
          } else {
            clearInterval(fadeOut);
            audioRef.current.pause();
          }
        }, 50);
      }

      const isLike = direction === 'like';
      const xOffset = isLike ? 1000 : -1000;
      
      const overlay = cardRef.current.querySelector(`.preference-overlay.${direction}`);
      if (overlay) {
        overlay.style.opacity = '1';
        overlay.style.display = 'flex';
      }

      await controls.start({
        x: xOffset,
        rotate: isLike ? 45 : -45,
        opacity: 0,
        transition: {
          duration: 0.5,
          ease: [0.43, 0.13, 0.23, 0.96]
        }
      });

      onSwipe(isLike);

      await controls.set({ x: 0, rotate: 0, opacity: 1 });
      
      if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.display = 'none';
      }
    } catch (error) {
      console.error('Animation error:', error);
      controls.set({ x: 0, rotate: 0, opacity: 1 });
    } finally {
      setIsAnimating(false);
      // Keep loading state active until new song loads
    }
  };

  // Add effect to reset swipe loading state when new song loads
  useEffect(() => {
    if (song) {
      setIsSwipeLoading(false);
    }
  }, [song]);

  if (!song) {
    return null;
  }

  return (
    <div className="relative w-full max-w-md mx-auto">
      <div className="text-center mb-4 text-purple-300 text-2xl">
        🔊 Turn up your volume for the best experience!
      </div>
      
      <div className="text-center mb-6 text-purple-300">
        Use the <span className="bg-red-500/80 px-2 py-1 rounded">left arrow key</span> or 
        swipe left to dislike, <span className="bg-green-500/80 px-2 py-1 rounded">right arrow key</span> or 
        swipe right to like.
      </div>

      <motion.div
        ref={cardRef}
        animate={controls}
        drag={!isAnimating ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.9}
        whileTap={{ cursor: 'grabbing' }}
        className="bg-gray-800/50 backdrop-blur-lg rounded-xl overflow-hidden touch-none"
        onDragStart={() => setIsDragging(true)}
        onDragEnd={(event, { offset }) => {
          if (isAnimating) return;
          
          setIsDragging(false);
          const swipe = Math.abs(offset.x);
          if (swipe > 100) {
            animateSwipe(offset.x > 0 ? 'like' : 'dislike');
          } else {
            controls.start({ x: 0, rotate: 0 });
          }
        }}
        style={{ zIndex: 10 }}
        whileHover={{ scale: 1.02 }}
        onDrag={(e, { offset }) => {
          if (!cardRef.current || isAnimating) return;
          
          const rotate = offset.x * 0.1;
          controls.set({ rotate });
          
          const likeOverlay = cardRef.current.querySelector('.preference-overlay.like');
          const dislikeOverlay = cardRef.current.querySelector('.preference-overlay.dislike');
          
          if (offset.x > 0 && likeOverlay && dislikeOverlay) {
            likeOverlay.style.opacity = Math.min(offset.x / 200, 0.8);
            likeOverlay.style.display = 'flex';
            dislikeOverlay.style.display = 'none';
          } else if (likeOverlay && dislikeOverlay) {
            dislikeOverlay.style.opacity = Math.min(Math.abs(offset.x) / 200, 0.8);
            dislikeOverlay.style.display = 'flex';
            likeOverlay.style.display = 'none';
          }
        }}
      >
        <div className="p-6 text-center">
          <div className="relative">
            <motion.div 
              className="w-48 h-48 mx-auto mb-4 rounded-lg overflow-hidden bg-gray-700/50 relative group"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.3 }}
            >
              {albumImage && (
                <img
                  src={albumImage}
                  alt={`${song.track_name} album art`}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    imageLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => {
                    setImageLoaded(true);
                    setAlbumImage(null);
                  }}
                />
              )}
              
              {(!albumImage || !imageLoaded) && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl">🎵</span>
                  {!imageLoaded && (
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-700/50 via-gray-600/50 to-gray-700/50 animate-shimmer" />
                  )}
                </div>
              )}

              {/* Play Button Overlay */}
              {previewUrl && (
                <motion.button
                  onClick={togglePlay}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isPlaying ? (
                    <Pause className="w-12 h-12 text-white" />
                  ) : (
                    <Play className="w-12 h-12 text-white" />
                  )}
                </motion.button>
              )}
            </motion.div>

            {/* Audio Progress Bar */}
            {previewUrl && (
              <div className="w-48 mx-auto -mt-2 mb-4">
                <div className="h-1 bg-gray-700/50 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-green-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Loading Indicator */}
          {isLoading && previewUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-20">
              <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Audio Element */}
          {previewUrl && (
            <audio
              ref={audioRef}
              src={previewUrl}
              preload="auto"
              onError={() => setIsLoading(false)}
            />
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="text-2xl font-bold text-white mb-2">{song.track_name}</h3>
            <p className="text-gray-300 mb-2">{song.artists}</p>
            <div className="flex items-center justify-center gap-4">
              <motion.span 
                className="inline-block px-3 py-1 rounded-full bg-green-500/20 text-green-300 text-sm"
                whileHover={{ scale: 1.1 }}
              >
                {song.track_genre}
              </motion.span>
              {previewUrl && (
                <motion.button
                  onClick={toggleMute}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="text-gray-300 hover:text-white"
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </motion.button>
              )}
            </div>
          </motion.div>
          {(isLoading && previewUrl) || isSwipeLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-20">
              <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : null}
        </div>

        {/* Preference Overlays */}
        <div className="preference-overlay like absolute inset-0 bg-green-500/70 
          items-center justify-center text-6xl hidden">
          👍
        </div>
        <div className="preference-overlay dislike absolute inset-0 bg-red-500/70 
          items-center justify-center text-6xl hidden">
          👎
        </div>
      </motion.div>

      {/* Like/Dislike Buttons */}
      <div className="flex justify-center gap-6 mt-6">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => !isAnimating && animateSwipe('dislike')}
          className="w-14 h-14 flex items-center justify-center rounded-full bg-red-500/90 text-white"
          disabled={isAnimating}
        >
          <X size={24} />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => !isAnimating && animateSwipe('like')}
          className="w-14 h-14 flex items-center justify-center rounded-full bg-green-500/90 text-white"
          disabled={isAnimating}
        >
          <Heart size={24} />
        </motion.button>
      </div>

      {/* Progress Bar */}
      <div className="mt-6">
        <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
          <motion.div
            className="bg-purple-500 h-full"
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex || 0) / (totalSongs || 1)) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <p className="text-center text-purple-300 mt-2">
          Swipes: {currentIndex || 0} / {totalSongs || 0}
        </p>
      </div>
    </div>
  );
};

export default SongCard;