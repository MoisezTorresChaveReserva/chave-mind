import React, { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, HelpCircle, FileText } from 'lucide-react';

export interface DialogOptions {
  isOpen: boolean;
  type: 'alert' | 'confirm' | 'prompt';
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: (value?: string) => void;
  onCancel: () => void;
}

export default function CustomDialogModal({
  isOpen,
  type,
  title,
  message,
  defaultValue = '',
  placeholder = '',
  confirmText = 'OK',
  cancelText = 'Cancelar',
  isDestructive = false,
  onConfirm,
  onCancel
}: DialogOptions) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(defaultValue);
  }, [defaultValue, isOpen]);

  useEffect(() => {
    if (isOpen && type === 'prompt' && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, type]);

  if (!isOpen) return null;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(inputValue);
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-2xl border border-white/20 dark:border-gray-700/60 shadow-2xl rounded-2xl max-w-sm w-full p-5 flex flex-col items-center text-center relative overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Apple-style icon badge */}
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 shadow-inner ${
          isDestructive 
            ? 'bg-red-100 text-red-500 dark:bg-red-900/40 dark:text-red-400' 
            : type === 'prompt'
            ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400'
            : type === 'confirm'
            ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
            : 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
        }`}>
          {isDestructive ? (
            <AlertCircle size={24} />
          ) : type === 'prompt' ? (
            <FileText size={24} />
          ) : type === 'confirm' ? (
            <HelpCircle size={24} />
          ) : (
            <AlertCircle size={24} />
          )}
        </div>

        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1 tracking-tight">
          {title}
        </h3>

        {message && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed px-2">
            {message}
          </p>
        )}

        <form onSubmit={handleFormSubmit} className="w-full flex flex-col gap-4">
          {type === 'prompt' && (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholder}
              className="w-full px-3.5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-gray-400"
            />
          )}

          <div className="flex gap-2.5 w-full mt-1">
            {type !== 'alert' && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {cancelText}
              </button>
            )}
            <button
              type="submit"
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors text-white ${
                isDestructive
                  ? 'bg-red-500 hover:bg-red-600 active:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
