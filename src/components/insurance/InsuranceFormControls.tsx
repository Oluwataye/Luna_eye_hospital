import React, { forwardRef } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import './InsurancePrimitives.css';

// ── 2.1 Field Wrapper ──
export interface FormFieldProps {
  id?: string;
  label?: string;
  required?: boolean;
  helperText?: string;
  error?: string;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  required = false,
  helperText,
  error,
  fullWidth = false,
  className = '',
  children
}) => {
  const helperOrErrorId = id ? `${id}-desc` : undefined;

  return (
    <div className={`ins-field-wrapper ${fullWidth ? 'ins-col-span-2' : ''} ${className}`}>
      {label && (
        <label htmlFor={id} className="ins-field-label">
          <span>{label}</span>
          {required && (
            <span className="ins-required-star" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <div className="ins-control-container">
        {React.isValidElement(children) && id
          ? React.cloneElement(children as React.ReactElement<any>, {
              id: (children.props as any).id || id,
              required: (children.props as any).required ?? required,
              'aria-describedby': helperOrErrorId,
              isInvalid: Boolean(error) || (children.props as any).isInvalid
            })
          : children}
      </div>

      {error ? (
        <div id={helperOrErrorId} className="ins-field-error" role="alert">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      ) : helperText ? (
        <div id={helperOrErrorId} className="ins-field-helper">
          {helperText}
        </div>
      ) : null}
    </div>
  );
};

// ── 2.2 Text / Number Input ──
export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  isInvalid?: boolean;
  currency?: boolean;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ className = '', isInvalid, currency = false, ...props }, ref) => {
    const inputEl = (
      <input
        ref={ref}
        className={`ins-control-input ${currency ? 'ins-control-input--currency' : ''} ${isInvalid ? 'ins-control-input--invalid' : ''} ${className}`}
        {...props}
      />
    );

    if (currency) {
      return (
        <div className="ins-currency-wrapper">
          <span className="ins-currency-symbol">₦</span>
          {inputEl}
        </div>
      );
    }

    return inputEl;
  }
);
FormInput.displayName = 'FormInput';

// ── 2.2 Date Input ──
export interface FormDateProps extends React.InputHTMLAttributes<HTMLInputElement> {
  isInvalid?: boolean;
}

export const FormDate = forwardRef<HTMLInputElement, FormDateProps>(
  ({ className = '', isInvalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="date"
        className={`ins-control-date ${isInvalid ? 'ins-control-date--invalid' : ''} ${className}`}
        {...props}
      />
    );
  }
);
FormDate.displayName = 'FormDate';

// ── 2.2 Textarea Control ──
export interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  isInvalid?: boolean;
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ className = '', isInvalid, rows = 3, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={`ins-control-textarea ${isInvalid ? 'ins-control-textarea--invalid' : ''} ${className}`}
        {...props}
      />
    );
  }
);
FormTextarea.displayName = 'FormTextarea';

// ── 2.3 Select Control ──
export interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  isInvalid?: boolean;
  placeholderOption?: string;
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ className = '', isInvalid, placeholderOption, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={`ins-control-select ${isInvalid ? 'ins-control-select--invalid' : ''} ${className}`}
        {...props}
      >
        {placeholderOption && (
          <option value="" disabled={props.required}>
            {placeholderOption}
          </option>
        )}
        {children}
      </select>
    );
  }
);
FormSelect.displayName = 'FormSelect';

// ── 2.5 Buttons ──
export interface FormButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const FormButton: React.FC<FormButtonProps> = ({
  variant = 'primary',
  loading = false,
  icon,
  disabled,
  children,
  className = '',
  ...props
}) => {
  const btnClass =
    variant === 'primary'
      ? 'ins-btn-primary'
      : variant === 'secondary'
      ? 'ins-btn-secondary'
      : 'ins-btn-danger';

  return (
    <button
      className={`${btnClass} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          <span>Saving...</span>
        </>
      ) : (
        <>
          {icon}
          <span>{children}</span>
        </>
      )}
    </button>
  );
};

// ── 2.7 Layout Grid & Sections ──
export interface FormGridProps {
  children: React.ReactNode;
  columns?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const FormGrid: React.FC<FormGridProps> = ({
  children,
  columns,
  className = '',
  style
}) => {
  const gridStyle: React.CSSProperties = {
    ...style,
    ...(columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : {})
  };
  return (
    <div className={`ins-form-grid ${className}`} style={gridStyle}>
      {children}
    </div>
  );
};

export interface FormSectionProps {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  icon,
  action,
  children,
  className = '',
  style
}) => {
  return (
    <div className={`ins-form-section ${className}`} style={style}>
      <div className="ins-form-section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div className="ins-form-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          {icon}
          <span>{title}</span>
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  );
};
