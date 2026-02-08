import { motion } from "framer-motion";
import "./Spinner.css";

export default function Spinner({ size = 40, text = "Loading..." }) {
  return (
    <div className="spinner-container">
      <motion.div
        className="spinner-ring"
        style={{ width: size, height: size }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
      />
      {text && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="spinner-text"
        >
          {text}
        </motion.p>
      )}
    </div>
  );
}
