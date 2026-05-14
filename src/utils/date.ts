/**
 * Luna Eye Hospital Standardized Date Formatter
 * Formats: 
 * - Standard: DD/MMM/YYYY (e.g. 14/MAY/2026)
 * - WithTime: DD/MMM/YYYY HH:MM AM/PM (e.g. 14/MAY/2026 11:22 AM)
 */

export const formatDateStandard = (date: string | Date | number): string => {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid Date';

  const day = d.getDate().toString().padStart(2, '0');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
};

export const formatDateTimeStandard = (date: string | Date | number): string => {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid Date';

  const datePart = formatDateStandard(d);
  
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const hourStr = hours.toString().padStart(2, '0');

  return `${datePart} ${hourStr}:${minutes} ${ampm}`;
};

export const formatDateInput = (date: string | Date | number): string => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
};
