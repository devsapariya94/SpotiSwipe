import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { UserCircle, Mail, ArrowRight, Shield, Loader2 } from 'lucide-react';

const LoginForm = ({ onSubmit }) => {
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      setIsLoading(true);
      try {
        await onSubmit(formData);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center w-full max-w-2xl mx-auto"
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center mb-8"
      >
        <h2 className="text-3xl font-bold mb-3 text-white bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-500">
          Welcome to SpotiSwipe
        </h2>
        <p className="text-gray-300 text-lg">
          Let's start your musical journey
        </p>
      </motion.div>

      <form onSubmit={handleSubmit} className="w-full space-y-4">
        <div>
          <motion.div
            whileHover={!isLoading ? { scale: 1.01 } : {}}
            className="relative"
          >
            <UserCircle className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Your name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={isLoading}
              className="w-full p-4 pl-12 rounded-xl bg-white/10 text-white placeholder:text-gray-400 
                        focus:outline-none focus:ring-2 focus:ring-green-500 transition-all
                        disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </motion.div>
          {errors.name && (
            <motion.p 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="text-red-400 text-sm mt-1 ml-2"
            >
              {errors.name}
            </motion.p>
          )}
        </div>

        <div>
          <motion.div
            whileHover={!isLoading ? { scale: 1.01 } : {}}
            className="relative"
          >
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="email"
              placeholder="Your email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={isLoading}
              className="w-full p-4 pl-12 rounded-xl bg-white/10 text-white placeholder:text-gray-400 
                        focus:outline-none focus:ring-2 focus:ring-green-500 transition-all
                        disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </motion.div>
          {errors.email && (
            <motion.p 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="text-red-400 text-sm mt-1 ml-2"
            >
              {errors.email}
            </motion.p>
          )}
        </div>

        <motion.button
          type="submit"
          disabled={isLoading}
          whileHover={!isLoading ? { scale: 1.02 } : {}}
          whileTap={!isLoading ? { scale: 0.98 } : {}}
          className="w-full p-4 rounded-xl font-semibold bg-gradient-to-r from-green-500 to-emerald-500 
                    text-white shadow-lg hover:shadow-green-500/20 transition-all duration-300
                    flex items-center justify-center gap-2
                    disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              <span>Processing...</span>
            </>
          ) : (
            <>
              Continue
              <ArrowRight size={20} className="animate-pulse" />
            </>
          )}
        </motion.button>

        <motion.div 
          className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <Shield size={16} />
            <span className="font-medium">Privacy Note</span>
          </div>
          <p className="text-gray-400 text-sm">
            You can use <span className="text-green-400">test@test.com</span> if you not want to provide the email.
            If you provide your real email, we'll only use it to gather feedback about your experience.
            Your data is secure and will never be sold or shared.
          </p>
        </motion.div>
      </form>
    </motion.div>
  );
};

export default LoginForm;