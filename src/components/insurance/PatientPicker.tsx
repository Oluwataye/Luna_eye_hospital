import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, Lock } from 'lucide-react';
import { api } from '../../api';
import './InsurancePrimitives.css';

export interface PatientPickerProps {
  id?: string;
  value: string; // patient_id or file_no
  onChange: (patient: any | null) => void;
  disabled?: boolean;
  isInvalid?: boolean;
  required?: boolean;
  placeholder?: string;
  initialPatientSummary?: {
    name?: string;
    file_no?: string;
    phone?: string;
    gender?: string;
    age?: number | string;
  };
}

export const PatientPicker: React.FC<PatientPickerProps> = ({
  id = 'ins-patient-picker',
  value,
  onChange,
  disabled = false,
  isInvalid = false,
  required = false,
  placeholder = 'Search patient by name, file number, or phone...',
  initialPatientSummary
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // If value exists, fetch or set patient details
  useEffect(() => {
    let isMounted = true;
    if (!value) {
      setSelectedPatient(null);
      setQuery('');
      return;
    }

    if (initialPatientSummary && (initialPatientSummary.file_no === value || !selectedPatient)) {
      setSelectedPatient({
        id: value,
        patient_id: value,
        full_name: initialPatientSummary.name,
        phone: initialPatientSummary.phone,
        gender: initialPatientSummary.gender,
        age: initialPatientSummary.age
      });
      return;
    }

    // Attempt lookup if we only have ID
    const fetchPatient = async () => {
      try {
        const res = await api.getPatient(value);
        if (isMounted && res && (res.id || res.patient_id)) {
          setSelectedPatient(res);
        }
      } catch (e) {
        // Fallback: keep minimum record
        if (isMounted && !selectedPatient) {
          setSelectedPatient({
            id: value,
            patient_id: value,
            full_name: value
          });
        }
      }
    };

    if (!selectedPatient || (selectedPatient.patient_id !== value && selectedPatient.id !== value)) {
      fetchPatient();
    }

    return () => {
      isMounted = false;
    };
  }, [value, initialPatientSummary]);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const data = await api.getPatients({ search: query.trim(), limit: 12 });
        setResults(Array.isArray(data) ? data : []);
        setIsOpen(true);
        setHighlightedIndex(-1);
      } catch (err) {
        console.error('Patient search error:', err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (patient: any) => {
    setSelectedPatient(patient);
    setQuery('');
    setIsOpen(false);
    onChange(patient);
  };

  const handleClear = () => {
    setSelectedPatient(null);
    setQuery('');
    onChange(null);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'ArrowDown' && results.length > 0) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        handleSelect(results[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // If patient is selected, display chip card
  if (selectedPatient) {
    const displayName = selectedPatient.full_name || selectedPatient.name || selectedPatient.id;
    const fileNo = selectedPatient.patient_id || selectedPatient.file_no || selectedPatient.id;
    const gender = selectedPatient.gender || selectedPatient.sex;
    const phone = selectedPatient.phone || selectedPatient.phone_number;
    const age = selectedPatient.age;

    return (
      <div className="ins-patient-selected-card">
        <div className="ins-patient-card-info">
          <div className="ins-patient-card-name">
            {displayName}
          </div>
          <div className="ins-patient-card-details">
            <span className="ins-patient-card-tag">File: {fileNo}</span>
            {gender && <span>• {gender}</span>}
            {age !== undefined && <span>• {age} yrs</span>}
            {phone && <span>• {phone}</span>}
          </div>
        </div>

        {!disabled ? (
          <button
            type="button"
            className="ins-patient-clear-btn"
            onClick={handleClear}
            title="Change patient"
            aria-label="Remove selected patient"
          >
            <X size={15} />
          </button>
        ) : (
          <div title="Patient is locked" style={{ color: 'var(--leh-muted)' }}>
            <Lock size={16} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ins-combobox" ref={containerRef}>
      <div className="ins-combobox-input-wrap">
        <span className="ins-combobox-icon">
          {isLoading ? (
            <Loader2 size={16} className="animate-spin text-muted" />
          ) : (
            <Search size={16} />
          )}
        </span>

        <input
          id={id}
          ref={inputRef}
          type="text"
          className={`ins-control-input ins-combobox-input ${
            isInvalid ? 'ins-control-input--invalid' : ''
          }`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete="off"
        />

        {query && (
          <button
            type="button"
            className="ins-combobox-clear"
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            aria-label="Clear search input"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Dropdown panel */}
      {isOpen && query.trim().length >= 2 && (
        <div className="ins-combobox-dropdown" role="listbox">
          {results.length > 0 ? (
            results.map((patient, index) => {
              const pName = patient.full_name || patient.name || 'Unnamed';
              const pId = patient.patient_id || patient.id || patient.file_no;
              const pPhone = patient.phone || patient.phone_number || 'No phone';
              const pGender = patient.gender || patient.sex;
              const pAge = patient.age;

              return (
                <div
                  key={patient.id || pId || index}
                  className={`ins-combobox-option ${
                    index === highlightedIndex ? 'ins-combobox-option--highlighted' : ''
                  }`}
                  onClick={() => handleSelect(patient)}
                  role="option"
                  aria-selected={index === highlightedIndex}
                >
                  <div className="ins-combobox-option-primary">
                    {pName}
                  </div>
                  <div className="ins-combobox-option-secondary">
                    File No: <strong>{pId}</strong> {pGender ? `• ${pGender}` : ''}{' '}
                    {pAge !== undefined ? `• ${pAge}y` : ''} • {pPhone}
                  </div>
                </div>
              );
            })
          ) : !isLoading ? (
            <div className="ins-combobox-empty">
              No match found. Try name, file number or phone.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
