import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Github, Linkedin, Mail } from 'lucide-react'
import ReactGA from 'react-ga4'
import Loading from './components/Loading'
import LoginForm from './components/LoginForm'
import GenreSelection from './components/GenreSelection'
import SongCard from './components/SongCard'
import Recommendations from './components/Recommendations'

// Initialize GA4
ReactGA.initialize('G-SKM6JZG57Z')

export default function App() {
  const [step, setStep] = useState('registration')
  const [userData, setUserData] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [songs, setSongs] = useState([])
  const [currentSongIndex, setCurrentSongIndex] = useState(0)
  const [recommendations, setRecommendations] = useState([])

  const baseUrl = 'https://backend.spotiswipe.devsdemo.co/'

  // Track page views and steps
  useEffect(() => {
    // Send initial pageview
    ReactGA.send({ hitType: "pageview", page: "/" });

    // Track step changes
    ReactGA.event({
      category: 'User Flow',
      action: 'Step Change',
      label: step
    });
  }, [step]);

  const handleRegistration = async (data) => {
    try {
      const response = await fetch(`${baseUrl}/api/user-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      const responseData = await response.json()
      
      if (!response.ok) throw new Error(responseData.error || 'Registration failed')
      
      // Track successful registration
      ReactGA.event({
        category: 'User',
        action: 'Registration',
        label: 'Success'
      });

      setSessionId(responseData.session_id)
      setUserData(data)
      setStep('genres')
    } catch (error) {
      console.error('Error during registration:', error)
      
      // Track registration error
      ReactGA.event({
        category: 'Error',
        action: 'Registration Failed',
        label: error.message
      });

      alert(error.message)
    }
  }

  const handleStart = async (selectedGenres) => {
    try {
      // Track genre selection
      ReactGA.event({
        category: 'User Preferences',
        action: 'Genre Selection',
        label: selectedGenres.join(', ')
      });

      const response = await fetch(`${baseUrl}/api/initial-songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          genres: selectedGenres,
          session_id: sessionId 
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) throw new Error(data.error || 'Failed to fetch songs')
      
      setSongs(data.songs)
      setStep('swiping')
    } catch (error) {
      console.error('Error starting session:', error)
      
      // Track error
      ReactGA.event({
        category: 'Error',
        action: 'Session Start Failed',
        label: error.message
      });

      alert(error.message)
    }
  }

  const handleSwipe = async (liked) => {
    try {
      if (currentSongIndex >= songs.length) return

      const currentSong = songs[currentSongIndex]
      
      if (!currentSong?.track_id) {
        throw new Error('Invalid song data')
      }

      // Track swipe action
      ReactGA.event({
        category: 'User Interaction',
        action: 'Song Swipe',
        label: liked ? 'Like' : 'Dislike',
        value: currentSongIndex + 1
      });

      const response = await fetch(`${baseUrl}/api/swipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          song_index: currentSong.track_id,
          liked: liked
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to record swipe')
      }

      const nextIndex = currentSongIndex + 1
      setCurrentSongIndex(nextIndex)

      if (nextIndex >= songs.length) {
        setStep('loading')
        setTimeout(() => getRecommendations(), 1500)
      }
    } catch (error) {
      console.error('Error handling swipe:', error)
      
      // Track swipe error
      ReactGA.event({
        category: 'Error',
        action: 'Swipe Failed',
        label: error.message
      });

      alert(`Error recording your choice: ${error.message}`)
    }
  }

  const getRecommendations = async () => {
    try {
      if (!sessionId) {
        throw new Error('No active session')
      }
      
      const response = await fetch(`${baseUrl}/api/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get recommendations')
      }
      
      if (!data.recommendations?.length) {
        throw new Error('Invalid recommendations data received')
      }

      // Track successful recommendations
      ReactGA.event({
        category: 'User Flow',
        action: 'Recommendations Generated',
        value: data.recommendations.length
      });

      setRecommendations(data.recommendations)
      setStep('recommendations')
    } catch (error) {
      console.error('Error getting recommendations:', error)
      
      // Track recommendations error
      ReactGA.event({
        category: 'Error',
        action: 'Recommendations Failed',
        label: error.message
      });

      alert(`Failed to get recommendations: ${error.message}`)
      handleRestart()
    }
  }

  const handleRestart = () => {
    // Track restart action
    ReactGA.event({
      category: 'User Flow',
      action: 'Restart App'
    });

    setStep('genres')
    setSessionId(null)
    setSongs([])
    setCurrentSongIndex(0)
    setRecommendations([])
  }


  return (
    
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950">
      <div className="max-w-7xl mx-auto px-4 py-8 md:px-6 md:py-12 lg:px-8 lg:py-16">
      <motion.div
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    className="text-center space-y-2 mb-8"
  >
    <motion.h1 
      className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 text-transparent bg-clip-text"
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      SpotiSwipe
    </motion.h1>
    <p className="text-lg md:text-xl lg:text-2xl text-gray-300 font-light">
      Swipe your way to the perfect playlist
    </p>
  </motion.div>

        <motion.div 
          className="relative z-10 rounded-3xl border border-white/10 bg-black/30 backdrop-blur-xl shadow-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="px-6 py-8 md:p-12 lg:p-16">
            <AnimatePresence mode="wait">
              {step === 'registration' && (
                <motion.div
                  key="registration"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <LoginForm onSubmit={handleRegistration} />
                </motion.div>
              )}
              {step === 'genres' && (
                <motion.div
                  key="genres"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <GenreSelection onStart={handleStart} />
                </motion.div>
              )}
              {step === 'swiping' && songs[currentSongIndex] && (
                <motion.div
                  key="swiping"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <SongCard
                    song={songs[currentSongIndex]}
                    onSwipe={handleSwipe}
                    currentIndex={currentSongIndex + 1}
                    totalSongs={songs.length}
                  />
                </motion.div>
              )}
              {step === 'loading' && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Loading />
                </motion.div>
              )}
              {step === 'recommendations' && (
                <motion.div
                  key="recommendations"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <Recommendations songs={recommendations} onRestart={handleRestart} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
        
        <footer className="mt-12 text-center">
          <motion.div 
            className="flex items-center justify-center gap-2 mb-4 text-emerald-200/80"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <span>Made with</span>
            <Heart size={16} className="text-red-500 animate-pulse" fill="currentColor" />
            <span>by</span>
            <a 
              href="https://me.devsdemo.co" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Dev
            </a>
          </motion.div>
          
          <motion.div 
            className="flex justify-center gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <a 
              href="https://github.com/devsapariya94" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-emerald-200/60 hover:text-emerald-200 transition-colors"
              aria-label="GitHub Profile"
            >
              <Github size={20} />
            </a>
            <a 
              href="https://linkedin.com/in/devsapariya94" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-emerald-200/60 hover:text-emerald-200 transition-colors"
              aria-label="LinkedIn Profile"
            >
              <Linkedin size={20} />
            </a>
            <a 
              href="mailto:devsapariya94@gmail.com" 
              className="text-emerald-200/60 hover:text-emerald-200 transition-colors"
              aria-label="Email Contact"
            >
              <Mail size={20} />
            </a>
          </motion.div>
        </footer>
      </div>
    </div>
  )
}