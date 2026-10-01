'use client';

import { useId, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export default function PasswordInput({ id, className = 'form-input', ...props }: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-input">
      <input {...props} id={inputId} type={visible ? 'text' : 'password'} className={className} />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        aria-controls={inputId}
        disabled={props.disabled}
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        <span>{visible ? 'Ocultar' : 'Mostrar'}</span>
      </button>
    </div>
  );
}
