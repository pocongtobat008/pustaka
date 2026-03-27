import React from 'react';
import { motion } from 'framer-motion';

export default function PageTransition({ children, className = '' }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className={`h-full w-full ${className}`}
        >
            {children}
        </motion.div>
    );
}
