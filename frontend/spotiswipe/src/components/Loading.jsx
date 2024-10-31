import React from 'react';
import { motion } from 'framer-motion';

const Loading = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="text-center py-10"
    >
      <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-6 animate-spin" />
      <h2 className="text-xl font-bold text-white mb-2">Creating Your Perfect Playlist</h2>
      <p className="text-gray-300">Analyzing your music preferences...</p>
    </motion.div>
  );
};

export default Loading;