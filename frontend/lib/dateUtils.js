// Utility functions for date formatting and calculations
import { format } from 'date-fns';

/**
 * Converts various date formats to a JavaScript Date object
 * Handles Firestore timestamps, ISO strings, and Date objects
 */
export const parseDate = (dateValue) => {
  if (!dateValue) return null;
  
  try {
    // Handle Firestore timestamp format (with toDate method)
    if (dateValue && typeof dateValue === 'object' && dateValue.toDate && typeof dateValue.toDate === 'function') {
      return dateValue.toDate();
    }
    
    // Handle Firestore timestamp object with _seconds (serialized format)
    if (dateValue && typeof dateValue === 'object') {
      if (dateValue._seconds && typeof dateValue._seconds === 'number') {
        return new Date(dateValue._seconds * 1000);
      }
      
      // Handle Firestore timestamp object with seconds (alternative format)
      if (dateValue.seconds && typeof dateValue.seconds === 'number') {
        return new Date(dateValue.seconds * 1000);
      }
      
      // Handle Timestamp object from Firestore (when serialized via JSON)
      if (dateValue.constructor && dateValue.constructor.name === 'Timestamp') {
        if (dateValue.seconds) {
          return new Date(dateValue.seconds * 1000);
        }
      }
    }
    
    // Handle Date object
    if (dateValue instanceof Date) {
      return dateValue;
    }
    
    // Handle ISO string or other string formats
    if (typeof dateValue === 'string') {
      // Skip if it's already a formatted date string (like "MM/DD/YY")
      if (dateValue.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
        return null; // This is a formatted string, not a date
      }
      
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing date:', error, 'Date value:', dateValue);
    return null;
  }
};

/**
 * Formats a date for display (e.g., "MMM d, yyyy")
 */
export const formatDate = (dateValue) => {
  const date = parseDate(dateValue);
  if (!date) return 'No deadline set';
  
  try {
    return format(date, 'MMM d, yyyy');
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
};

/**
 * Formats a date with time for display (e.g., "MMM d, yyyy, h:mm a")
 */
export const formatDateTime = (dateValue) => {
  const date = parseDate(dateValue);
  if (!date) return 'No deadline set';
  
  try {
    return format(date, 'MMM d, yyyy, h:mm a');
  } catch (error) {
    console.error('Error formatting date time:', error);
    return 'Invalid date';
  }
};

/**
 * Calculates and returns remaining time as a human-readable string
 */
export const calculateRemainingTime = (dateValue) => {
  const date = parseDate(dateValue);
  if (!date) return 'No deadline';
  
  try {
    const now = new Date();
    const diffTime = date - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''}`;
    }
    if (diffDays === 0) {
      return 'Due today';
    }
    if (diffDays === 1) {
      return '1 day remaining';
    }
    if (diffDays < 7) {
      return `${diffDays} days remaining`;
    }
    if (diffDays < 30) {
      return `${Math.ceil(diffDays / 7)} week${Math.ceil(diffDays / 7) !== 1 ? 's' : ''} remaining`;
    }
    return `${Math.ceil(diffDays / 30)} month${Math.ceil(diffDays / 30) !== 1 ? 's' : ''} remaining`;
  } catch (error) {
    console.error('Error calculating remaining time:', error);
    return 'N/A';
  }
};

/**
 * Gets the appropriate deadline for a regulation
 * Returns revisionDeadline if status is "Needs Revision" and revisionDeadline exists,
 * otherwise returns the regular deadline
 */
export const getRegulationDeadline = (regulation) => {
  if (regulation.status === 'Needs Revision' && regulation.revisionDeadline) {
    return regulation.revisionDeadline;
  }
  return regulation.deadline;
};

/**
 * Checks if a deadline is overdue
 */
export const isOverdue = (dateValue) => {
  const date = parseDate(dateValue);
  if (!date) return false;
  
  return date < new Date();
};

/**
 * Checks if a regulation is published (case-insensitive)
 */
export const isPublished = (status) => {
  if (!status) return false;
  const statusStr = String(status).toLowerCase().trim();
  return statusStr === 'published' || statusStr === 'publish';
};

