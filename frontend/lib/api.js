/**
 * API Client for Backend
 * Handles all communication with the backend API
 */

import axios from 'axios';

// API Base URL - adjust if your backend is on a different port
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to get user info from localStorage or context
const getUserHeaders = () => {
  if (typeof window === 'undefined') return {};
  
  // Try to get user from localStorage or context
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      return {
        'x-user-id': user.id || user.uid,
        'x-user-email': user.email,
      };
    } catch (e) {
      // Ignore parse errors
    }
  }
  return {};
};

// Add request interceptor to include user headers and logging
apiClient.interceptors.request.use(
  (config) => {
    const userHeaders = getUserHeaders();
    config.headers = {
      ...config.headers,
      ...userHeaders,
    };
    
    // Log the request
    console.group('API Request');
    console.log('Method:', config.method.toUpperCase());
    console.log('URL:', config.url);
    console.log('Headers:', config.headers);
    if (config.data) {
      console.log('Request Data:', JSON.parse(JSON.stringify(config.data)));
    }
    console.groupEnd();
    
    return config;
  },
  (error) => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for logging
apiClient.interceptors.response.use(
  (response) => {
    console.group('API Response');
    console.log('URL:', response.config.url);
    console.log('Status:', response.status);
    console.log('Response Data:', response.data);
    console.groupEnd();
    return response;
  },
  (error) => {
    if (error.response) {
      console.error('API Error Response:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
      });
    } else if (error.request) {
      console.error('API Request Error:', error.request);
    } else {
      console.error('API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Helper function to format deadline for display
const formatDeadline = (deadline) => {
  if (!deadline) return '-';
  
  // Handle Firestore timestamp format
  let date;
  if (deadline._seconds) {
    date = new Date(deadline._seconds * 1000);
  } else if (typeof deadline === 'string') {
    date = new Date(deadline);
  } else {
    date = deadline;
  }
  
  // Format as MM/DD/YY
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
};

// Helper function to calculate remaining time
const calculateRemainingTime = (deadline) => {
  if (!deadline) return '-';
  
  let date;
  if (deadline._seconds) {
    date = new Date(deadline._seconds * 1000);
  } else if (typeof deadline === 'string') {
    date = new Date(deadline);
  } else {
    date = deadline;
  }
  
  const now = new Date();
  const diffTime = date - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return '1 day';
  if (diffDays < 7) return `${diffDays} days`;
  return `${Math.ceil(diffDays / 7)} weeks`;
};

// Transform backend regulation to frontend format
const transformRegulation = (regulation) => {
  // Ensure attachments is always an array with proper structure
  let attachments = [];
  if (Array.isArray(regulation.attachments)) {
    attachments = regulation.attachments.map(att => ({
      name: att.name || 'Attachment',
      url: att.url || '',
      ...att // Include any other properties
    }));
  }

  return {
    id: regulation.id,
    title: regulation.title,
    ref: regulation.ref || regulation.refNumber, // Handle both ref and refNumber for backward compatibility
    status: regulation.status,
    deadline: formatDeadline(regulation.deadline),
    remaining: calculateRemainingTime(regulation.deadline),
    feedback: regulation.feedback || '-',
    action: getActionFromStatus(regulation.status),
    category: regulation.category,
    code: regulation.code || regulation.regulationCode || '', // Include code field with fallback to regulationCode
    description: regulation.description,
    notes: regulation.notes,
    effectiveDate: regulation.effectiveDate ? formatDeadline(regulation.effectiveDate) : '',
    version: regulation.version,
    submittedAt: regulation.submittedAt,
    reviewedAt: regulation.reviewedAt,
    publishedAt: regulation.publishedAt,
    createdAt: regulation.createdAt,
    attachments: attachments,
    // Keep original data for API calls
    _original: regulation,
  };
};

// Determine action button based on status
const getActionFromStatus = (status) => {
  switch (status) {
    case 'Draft':
    case 'Needs Revision':
      return 'Edit.Submit';
    case 'Pending Review':
    case 'Pending Approval':
    case 'Pending Publish':
      return 'View';
    case 'Published':
      return 'View';
    default:
      return 'View';
  }
};

// API Methods
export const api = {
  // Regulations
  regulations: {
    // Get all regulations
    getAll: async (filters = {}) => {
      try {
        const params = new URLSearchParams();
        if (filters.status) params.append('status', filters.status);
        if (filters.category) params.append('category', filters.category);
        if (filters.userId) params.append('userId', filters.userId);
        
        const response = await apiClient.get(`/regulations?${params.toString()}`);
        if (response.data.success) {
          // Handle both nested data structure and direct array response
          const regulationsData = Array.isArray(response.data.data) 
            ? response.data.data 
            : response.data.data.data;
            
          return {
            success: true,
            data: regulationsData.map(transformRegulation),
            pagination: response.data.data.pagination || {
              currentPage: 1,
              totalPages: 1,
              totalItems: regulationsData.length,
              itemsPerPage: 10
            }
          };
        }
        throw new Error(response.data.error || 'Failed to fetch regulations');
      } catch (error) {
        console.error('Error fetching regulations:', error);
        return {
          success: false,
          error: error.response?.data?.error || 'Network error while fetching regulations',
          data: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalItems: 0,
            itemsPerPage: 10
          }
        };
      }
    },

    // Get single regulation
    getById: async (id) => {
      try {
        const response = await apiClient.get(`/regulations/${id}`);
        if (response.data.success) {
          return {
            success: true,
            data: transformRegulation(response.data.data),
          };
        }
        throw new Error(response.data.error || 'Failed to fetch regulation');
      } catch (error) {
        console.error('Error fetching regulation:', error);
        throw error;
      }
    },

    // Create regulation
    create: async (regulationData) => {
      try {
        console.log('Creating regulation with data:', regulationData);
        
        // Ensure code is included, even if empty
        const code = regulationData.code || '';
        
        // Convert date strings to ISO format
        const payload = {
          ...regulationData,
          code, // Explicitly include code field
          deadline: regulationData.deadline ? new Date(regulationData.deadline).toISOString() : null,
          effectiveDate: regulationData.effectiveDate ? new Date(regulationData.effectiveDate).toISOString() : null,
          attachments: Array.isArray(regulationData.attachments)
            ? regulationData.attachments.map((item) => ({
                name: item?.name || "Attachment",
                url: item?.url || "",
              }))
            : [],
        };
        
        console.log('Sending payload to server:', payload);

        const response = await apiClient.post('/regulations', payload);
        if (response.data.success) {
          return {
            success: true,
            data: transformRegulation(response.data.data),
          };
        }
        throw new Error(response.data.error || 'Failed to create regulation');
      } catch (error) {
        console.error('Error creating regulation:', error);
        throw error;
      }
    },

    // Update regulation
    update: async (id, updates) => {
      try {
        // Convert date strings if present
        const payload = { ...updates };
        if (payload.deadline) {
          payload.deadline = new Date(payload.deadline).toISOString();
        }
        if (payload.effectiveDate) {
          payload.effectiveDate = new Date(payload.effectiveDate).toISOString();
        }
        if (payload.attachments) {
          payload.attachments = Array.isArray(payload.attachments)
            ? payload.attachments.map((item) => ({
                name: item?.name || "Attachment",
                url: item?.url || "",
              }))
            : [];
        }

        const response = await apiClient.put(`/regulations/${id}`, payload);
        if (response.data.success) {
          return {
            success: true,
            data: transformRegulation(response.data.data),
          };
        }
        throw new Error(response.data.error || 'Failed to update regulation');
      } catch (error) {
        console.error('Error updating regulation:', error);
        throw error;
      }
    },

    // Delete regulation
    delete: async (id) => {
      try {
        const response = await apiClient.delete(`/regulations/${id}`);
        return response.data.success;
      } catch (error) {
        console.error('Error deleting regulation:', error);
        throw error;
      }
    },

    // Submit for review
    submit: async (id) => {
      try {
        const response = await apiClient.post(`/regulations/${id}/submit`);
        if (response.data.success) {
          return {
            success: true,
            data: transformRegulation(response.data.data),
          };
        }
        throw new Error(response.data.error || 'Failed to submit regulation');
      } catch (error) {
        console.error('Error submitting regulation:', error);
        throw error;
      }
    },

    // Review regulation
    review: async (id, action, feedback = '', reviewedBy = null) => {
      try {
        const response = await apiClient.post(`/regulations/${id}/review`, {
          action, // 'approve' or 'reject'
          feedback,
          reviewedBy,
        });
        if (response.data.success) {
          return {
            success: true,
            data: transformRegulation(response.data.data),
          };
        }
        throw new Error(response.data.error || 'Failed to review regulation');
      } catch (error) {
        console.error('Error reviewing regulation:', error);
        throw error;
      }
    },

    // Approve regulation
    approve: async (id, approvedBy = null) => {
      try {
        const response = await apiClient.post(`/regulations/${id}/approve`, {
          approvedBy,
        });
        if (response.data.success) {
          return {
            success: true,
            data: transformRegulation(response.data.data),
          };
        }
        throw new Error(response.data.error || 'Failed to approve regulation');
      } catch (error) {
        console.error('Error approving regulation:', error);
        throw error;
      }
    },

    // Publish regulation
    publish: async (id, publishedBy = null) => {
      try {
        const response = await apiClient.post(`/regulations/${id}/publish`, {
          publishedBy,
        });
        if (response.data.success) {
          return {
            success: true,
            data: transformRegulation(response.data.data),
          };
        }
        throw new Error(response.data.error || 'Failed to publish regulation');
      } catch (error) {
        console.error('Error publishing regulation:', error);
        throw error;
      }
    },
  },

  // Users
  users: {
    getAll: async () => {
      try {
        const response = await apiClient.get('/users');
        return response.data;
      } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
      }
    },

    getById: async (id) => {
      try {
        const response = await apiClient.get(`/users/${id}`);
        return response.data;
      } catch (error) {
        console.error('Error fetching user:', error);
        throw error;
      }
    },

    create: async (userData) => {
      try {
        const response = await apiClient.post('/users', userData);
        return response.data;
      } catch (error) {
        console.error('Error creating user:', error);
        throw error;
      }
    },

    update: async (id, updates) => {
      try {
        const response = await apiClient.put(`/users/${id}`, updates);
        return response.data;
      } catch (error) {
        console.error('Error updating user:', error);
        throw error;
      }
    },
  },

  // Statistics
  statistics: {
    getOverview: async () => {
      try {
        const response = await apiClient.get('/statistics/overview');
        return response.data;
      } catch (error) {
        console.error('Error fetching statistics:', error);
        throw error;
      }
    },
  },

  // Deadlines
  deadlines: {
    getOverdue: async () => {
      try {
        const response = await apiClient.get('/deadlines/overdue');
        return response.data;
      } catch (error) {
        console.error('Error fetching overdue deadlines:', error);
        throw error;
      }
    },

    getUpcoming: async (days = 7) => {
      try {
        const response = await apiClient.get(`/deadlines/upcoming?days=${days}`);
        return response.data;
      } catch (error) {
        console.error('Error fetching upcoming deadlines:', error);
        throw error;
      }
    },
  },
};

export default api;

