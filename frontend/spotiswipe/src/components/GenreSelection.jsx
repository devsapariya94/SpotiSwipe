import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Music2, Loader2 } from 'lucide-react';

const GenreButton = ({ genre, selected, onClick, disabled }) => (
  <motion.button
    onClick={onClick}
    whileHover={!disabled ? { scale: 1.05 } : {}}
    whileTap={!disabled ? { scale: 0.95 } : {}}
    layout
    className={`p-4 rounded-xl font-medium transition-all duration-300 relative overflow-hidden group
      ${selected
        ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
        : disabled
        ? 'bg-white/5 text-white/50 cursor-not-allowed'
        : 'bg-white/10 text-white hover:bg-white/20'
      }`}
    disabled={disabled}
  >
    <motion.div
      initial={false}
      animate={{ opacity: selected ? 1 : 0 }}
      className="absolute inset-0 bg-gradient-to-r from-green-500/50 to-emerald-500/50"
      style={{ zIndex: 0 }}
    />
    <motion.div className="relative z-10 flex items-center justify-center gap-2">
      <Music2 
        size={18} 
        className={`transform transition-all duration-300 
          ${selected ? 'scale-110' : !disabled ? 'scale-100 group-hover:scale-110' : 'scale-100 opacity-50'}`}
      />
      <span className="text-sm md:text-base">{genre}</span>
    </motion.div>
    {selected && (
      <motion.div
        layoutId={`outline-${genre}`}
        className="absolute inset-0 rounded-xl border-2 border-green-400"
        initial={false}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    )}
  </motion.button>
);

const GenreSelection = ({ onStart }) => {
  const [genres, setGenres] = useState([]);
  const [selectedGenres, setSelectedGenres] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const baseUrl = 'http://localhost:5000';

    const fetchGenres = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${baseUrl}//api/genres`);
        if (!response.ok) throw new Error('Failed to fetch genres');
        const data = await response.json();
        setGenres(data.genres);
      } catch (err) {
        setError('Failed to load genres. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGenres();
  }, []);

  const toggleGenre = (genre) => {
    setSelectedGenres(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(genre)) {
        newSelected.delete(genre);
      } else if (newSelected.size < 5) {
        newSelected.add(genre);
      }
      return newSelected;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center w-full max-w-4xl mx-auto"
    >
      <motion.div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
          What music moves you?
        </h2>
        <p className="text-gray-300 text-lg">
          Choose up to 5 genres to get personalized recommendations
        </p>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center w-full h-48">
          <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
        </div>
      ) : error ? (
        <div className="text-red-400 text-center p-4 bg-red-500/10 rounded-lg">
          {error}
        </div>
      ) : (
        <motion.div 
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 w-full mb-8"
          layout
        >
          {genres.map((genre) => (
            <GenreButton
              key={genre}
              genre={genre}
              selected={selectedGenres.has(genre)}
              onClick={() => toggleGenre(genre)}
              disabled={selectedGenres.size === 5 && !selectedGenres.has(genre)}
            />
          ))}
        </motion.div>
      )}

      <motion.div className="w-full">
        {selectedGenres.size === 5 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center mb-4 text-gray-400"
          >
            Maximum selection reached (5/5)
          </motion.div>
        )}
        
        <motion.button
          onClick={() => onStart(Array.from(selectedGenres))}
          disabled={selectedGenres.size === 0}
          whileHover={selectedGenres.size > 0 ? { scale: 1.02 } : {}}
          whileTap={selectedGenres.size > 0 ? { scale: 0.98 } : {}}
          className={`w-full p-4 rounded-xl font-semibold transition-all duration-300
            flex items-center justify-center gap-2 shadow-lg
            ${selectedGenres.size > 0
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-green-500/20'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
        >
          <Play size={20} className={selectedGenres.size > 0 ? 'animate-pulse' : ''} />
          Start Your Musical Journey 
          {selectedGenres.size > 0 && (
            <span className="ml-1 text-sm">
              ({selectedGenres.size} selected)
            </span>
          )}
        </motion.button>
      </motion.div>
    </motion.div>
  );
};

export default GenreSelection;