import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import './InsurancePrimitives.css';

export interface InsuranceModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string | React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isDirty?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const InsuranceModal: React.FC<InsuranceModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  size = 'md',
  isDirty = false,
  children,
  footer
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  const handleAttemptClose = () => {
    if (isDirty) {
      const confirmDiscard = window.confirm('Discard unsaved changes? Any edits you entered will be lost.');
      if (!confirmDiscard) return;
    }
    onClose();
  };

  // Keyboard navigation: Escape key & Focus trapping
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElementRef.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleAttemptClose();
      } else if (e.key === 'Tab' && modalRef.current) {
        // Focus trap
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Initial focus on the first input or button in the modal
    const timer = setTimeout(() => {
      if (modalRef.current) {
        const firstInput = modalRef.current.querySelector<HTMLElement>(
          'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
        );
        if (firstInput) {
          firstInput.focus();
        }
      }
    }, 50);

    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      clearTimeout(timer);
      if (previouslyFocusedElementRef.current) {
        previouslyFocusedElementRef.current.focus?.();
      }
    };
  }, [isOpen, isDirty]);

  if (!isOpen) return null;

  const sizeClass = `ins-modal--${size}`;
  const titleId = `ins-modal-title-${typeof title === 'string' ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'custom'}`;

  return (
    <div
      className="ins-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleAttemptClose();
        }
      }}
    >
      <div
        className={`ins-modal ${sizeClass}`}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {/* Header Zone */}
        <div className="ins-modal-header">
          <div className="ins-modal-header-left">
            {icon && (
              <div className="ins-modal-icon-badge">
                {icon}
              </div>
            )}
            <div className="ins-modal-title-wrap">
              <h3 id={titleId} className="ins-modal-title">
                {title}
              </h3>
              {subtitle && (
                <div className="ins-modal-subtitle">{subtitle}</div>
              )}
            </div>
          </div>
          <button
            type="button"
            className="ins-modal-close-btn"
            onClick={handleAttemptClose}
            aria-label="Close"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Zone */}
        <div className="ins-modal-body">
          {children}
        </div>

        {/* Footer Zone */}
        {footer && (
          <div className="ins-modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
