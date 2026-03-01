"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordField({
  styles,
  name = "password",
  label = "Password",
  placeholder = "Enter your password",
  showLabel = "Show password",
  hideLabel = "Hide password",
  autoComplete = "current-password",
  required = true,
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <label className={styles.field}>
      <span>{label}</span>
      <div className={styles.passwordInputWrap}>
        <input
          name={name}
          type={showPassword ? "text" : "password"}
          required={required}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className={styles.passwordToggle}
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? hideLabel : showLabel}
          title={showPassword ? hideLabel : showLabel}
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </label>
  );
}
