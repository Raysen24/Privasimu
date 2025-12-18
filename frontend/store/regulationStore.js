"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "../lib/api";

// Simple in-memory cache with TTL
const createCache = (ttl = 5 * 60 * 1000) => {
  const cache = new Map();
  
  return {
    get: (key) => {
      const item = cache.get(key);
      if (!item) return null;
      
      if (Date.now() > item.expiry) {
        cache.delete(key);
        return null;
      }
      
      return item.value;
    },
    set: (key, value, ttlMs = ttl) => {
      cache.set(key, {
        value,
        expiry: Date.now() + ttlMs
      });
    },
    delete: (key) => cache.delete(key),
    clear: () => cache.clear()
  };
};

// Create caches for different types of data
const cache = {
  regulations: createCache(60 * 1000), // 1 minute
  statistics: createCache(5 * 60 * 1000), // 5 minutes
  singleRegulation: createCache(60 * 1000) // 1 minute
};

// Helper function to calculate remaining time
const calculateRemainingTime = (deadline) => {
  if (!deadline) return "-";
  
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffTime = deadlineDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "1 day";
  if (diffDays < 7) return `${diffDays} days`;
  return `${Math.ceil(diffDays / 7)} weeks`;
};

export const useRegulationStore = create(
  (set, get) => ({
    // Form data for creating new regulations (keep in localStorage)
    formData: {
      title: "",
      category: "",
      code: "",
      description: "",
      notes: "",
      deadline: "",
      effectiveDate: "",
      version: "v1.0",
      attachments: [],
    },
    
    // List of all regulations (from API)
    regulations: [],
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalItems: 0,
      itemsPerPage: 10
    },
    
    // Loading and error states
    loading: false,
    error: null,
    
    // Actions
    setField: (key, value) =>
      set((state) => ({
        formData: { ...state.formData, [key]: value },
      })),
      
    resetForm: () =>
      set({
        formData: {
          title: "",
          category: "",
          code: "",
          description: "",
          notes: "",
          deadline: "",
          effectiveDate: "",
          version: "v1.0",
          attachments: [], // Clear attachments when resetting form
        },
      }),
    
    // Fetch regulations from API with caching and pagination
    fetchRegulations: async (filters = {}, page = 1, limit = 100) => {
      set({ loading: true, error: null });
      try {
        // Ensure we include all statuses by default if no status filter is set
        const effectiveFilters = {
          ...filters,
          // Only include status in filters if explicitly set
          ...(filters.status ? { status: filters.status } : {})
        };
        
        // Create a cache key based on filters and pagination
        const cacheKey = `regulations_${JSON.stringify(effectiveFilters)}_${page}_${limit}`;
        
        // Try to get data from cache first
        const cachedData = cache.regulations.get(cacheKey);
        if (cachedData) {
          set({ 
            regulations: cachedData.data,
            pagination: cachedData.pagination,
            loading: false 
          });
          return cachedData;
        }

        // Make API request with the effective filters
        const result = await api.regulations.getAll({
          ...effectiveFilters,
          page,
          limit
        });
        
        if (result.success) {
          // Cache the response
          cache.regulations.set(cacheKey, {
            data: result.data,
            pagination: result.pagination
          });

          // Update the store with the new data
          set({ 
            regulations: result.data,
            loading: false,
            pagination: {
              currentPage: result.pagination?.currentPage || page,
              totalPages: result.pagination?.totalPages || Math.ceil((result.pagination?.totalItems || result.data.length) / limit),
              totalItems: result.pagination?.totalItems || result.data.length,
              itemsPerPage: result.pagination?.itemsPerPage || limit
            },
            loading: false 
          });
          
          return {
            data: result.data,
            pagination: result.pagination
          };
        } else {
          throw new Error(result.error || 'Failed to fetch regulations');
        }
      } catch (error) {
        console.error('Error fetching regulations:', error);
        set({ 
          error: 'Failed to load regulations. Please try again later.',
          loading: false 
        });
        return { data: [], pagination: null };
      }
    },
    
    // Add regulation (create via API)
    addRegulation: async (formData) => {
      set({ loading: true, error: null });
      try {
        // Get current user ID
        const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
        let createdBy = null;
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            createdBy = user.id || user.uid;
          } catch (e) {
            // Ignore
          }
        }

        // Prepare regulation data without the code field
        // The reference number will be generated by the backend
        const { code, ...formDataWithoutCode } = formData;
        
        // Ensure required fields are included
        const regulationData = {
          ...formDataWithoutCode,
          createdBy,
          // Set default status if not provided
          status: formData.status || 'Draft',
          // Ensure timestamps
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const result = await api.regulations.create(regulationData);
        
        if (result.success) {
          // Add to local state
          set((state) => {
            // Preserve the current attachments
            const currentAttachments = state.formData.attachments || [];
            
            return {
              regulations: [result.data, ...state.regulations],
              loading: false,
              // Keep the form data but clear the fields except attachments
              formData: {
                ...state.formData, // Keep the current form data
                title: "",
                category: "",
                // Don't preserve the code field as it's now auto-generated
                description: "",
                notes: "",
                deadline: "",
                effectiveDate: "",
                version: "v1.0",
                attachments: [...currentAttachments], // Preserve attachments
              },
            };
          });
          return result.data;
        } else {
          throw new Error(result.error || 'Failed to create regulation');
        }
      } catch (error) {
        console.error('Error creating regulation:', error);
        set({ 
          error: error.message || 'Failed to create regulation',
          loading: false 
        });
        throw error;
      }
    },
    
    // Helper function to normalize status values
    normalizeStatus: (status) => {
      if (!status) return '';
      const statusStr = String(status).toLowerCase().trim();
      
      // Map variations to standard format
      if ((statusStr.includes('pending') || statusStr.includes('under')) && statusStr.includes('review')) return 'Pending Review';
      if (statusStr === 'draft') return 'Draft';
      if ((statusStr.includes('need') || statusStr.includes('revision')) && !statusStr.includes('no')) return 'Needs Revision';
      if (statusStr.includes('pending') && statusStr.includes('publish')) return 'Pending Publish';
      if (statusStr === 'published' || statusStr === 'publish') return 'Published';
      
      // Default to original status if no match
      return status;
    },
    
// In frontend/store/regulationStore.js

submitRegulation: async (id) => {
  set({ loading: true, error: null });
  try {
    // Get current state
    const currentState = get();
    
    // Try to find the regulation in local state
    let regulationToUpdate = currentState.regulations.find(r => r.id === id);
    
    // If not found in local state, try to fetch it
    if (!regulationToUpdate) {
      try {
        const result = await api.regulations.getById(id);
        if (result.success) {
          regulationToUpdate = result.data;
          // Add to local state
          set(state => ({
            ...state,
            regulations: [regulationToUpdate, ...state.regulations]
          }));
        } else {
          throw new Error('Could not fetch regulation details');
        }
      } catch (fetchError) {
        console.error('Error fetching regulation:', fetchError);
        throw new Error('Regulation not found. Please refresh and try again.');
      }
    }

    // Create the updated regulation with new status
    const updatedRegulation = {
      ...regulationToUpdate,
      status: 'Pending Review',
      updatedAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      workflow: {
        ...(regulationToUpdate.workflow || {}),
        currentStage: 'review',
        stages: {
          ...(regulationToUpdate.workflow?.stages || {}),
          review: {
            status: 'active',
            timestamp: new Date().toISOString()
          },
          draft: {
            status: 'completed',
            timestamp: new Date().toISOString()
          }
        }
      }
    };

    // Update local state optimistically
    set(state => ({
      ...state,
      regulations: state.regulations.map(reg => 
        reg.id === id ? updatedRegulation : reg
      ),
      loading: false
    }));

    // Make the API call
    const result = await api.regulations.submit(id);
    
    if (result.success) {
      // Update with server response
      const normalizedRegulation = {
        ...result.data,
        status: get().normalizeStatus(result.data.status) || 'Pending Review'
      };
      
      set(state => ({
        ...state,
        regulations: state.regulations.map(reg =>
          reg.id === id ? normalizedRegulation : reg
        )
      }));
      
      return normalizedRegulation;
    }
    
    // If API call fails, revert the optimistic update
    set(state => ({
      ...state,
      regulations: state.regulations.map(reg => 
        reg.id === id ? regulationToUpdate : reg
      )
    }));
    
    throw new Error(result.error || 'Failed to submit regulation');
  } catch (error) {
    console.error('Error submitting regulation:', error);
    set(state => ({
      ...state,
      error: error.message || 'Failed to submit regulation',
      loading: false 
    }));
    throw error;
  }
},
    
    // Resend regulation (same as submit)
    resendRegulation: async (id) => {
      return get().submitRegulation(id);
    },
    
    // Review regulation
    reviewRegulation: async (id, action, feedback = '', reviewedBy = null) => {
      set({ loading: true, error: null });
      try {
        const result = await api.regulations.review(id, action, feedback, reviewedBy);
        if (result.success) {
          set((state) => ({
            regulations: state.regulations.map((regulation) =>
              regulation.id === id ? result.data : regulation
            ),
            loading: false,
          }));
          return result.data;
        } else {
          throw new Error(result.error || 'Failed to review regulation');
        }
      } catch (error) {
        console.error('Error reviewing regulation:', error);
        set({ 
          error: error.message || 'Failed to review regulation',
          loading: false 
        });
        throw error;
      }
    },
    
    // Approve regulation
    approveRegulation: async (id, approvedBy = null) => {
      set({ loading: true, error: null });
      try {
        const result = await api.regulations.approve(id, approvedBy);
        if (result.success) {
          set((state) => ({
            regulations: state.regulations.map((regulation) =>
              regulation.id === id ? result.data : regulation
            ),
            loading: false,
          }));
          return result.data;
        } else {
          throw new Error(result.error || 'Failed to approve regulation');
        }
      } catch (error) {
        console.error('Error approving regulation:', error);
        set({ 
          error: error.message || 'Failed to approve regulation',
          loading: false 
        });
        throw error;
      }
    },
    
    // Publish regulation
    publishRegulation: async (id, publishedBy = null) => {
      set({ loading: true, error: null });
      try {
        const result = await api.regulations.publish(id, publishedBy);
        if (result.success) {
          set((state) => ({
            regulations: state.regulations.map((regulation) =>
              regulation.id === id ? result.data : regulation
            ),
            loading: false,
          }));
          return result.data;
        } else {
          throw new Error(result.error || 'Failed to publish regulation');
        }
      } catch (error) {
        console.error('Error publishing regulation:', error);
        set({ 
          error: error.message || 'Failed to publish regulation',
          loading: false 
        });
        throw error;
      }
    },
    
    // Update regulation
    updateRegulation: async (id, updates) => {
      set({ loading: true, error: null });
      try {
        const result = await api.regulations.update(id, updates);
        if (result.success) {
          set((state) => ({
            regulations: state.regulations.map((regulation) =>
              regulation.id === id ? result.data : regulation
            ),
            loading: false,
          }));
          return result.data;
        } else {
          throw new Error(result.error || 'Failed to update regulation');
        }
      } catch (error) {
        console.error('Error updating regulation:', error);
        set({ 
          error: error.message || 'Failed to update regulation',
          loading: false 
        });
        throw error;
      }
    },
    
    // Delete regulation
    deleteRegulation: async (id) => {
      set({ loading: true, error: null });
      try {
        const success = await api.regulations.delete(id);
        if (success) {
          set((state) => ({
            regulations: state.regulations.filter((regulation) => regulation.id !== id),
            loading: false,
          }));
          return true;
        } else {
          throw new Error('Failed to delete regulation');
        }
      } catch (error) {
        console.error('Error deleting regulation:', error);
        set({ 
          error: error.message || 'Failed to delete regulation',
          loading: false 
        });
        throw error;
      }
    },
    
    // Get single regulation
    fetchRegulation: async (id) => {
      set({ loading: true, error: null });
      try {
        const result = await api.regulations.getById(id);
        if (result.success) {
          set({ loading: false });
          return result.data;
        } else {
          throw new Error(result.error || 'Failed to fetch regulation');
        }
      } catch (error) {
        console.error('Error fetching regulation:', error);
        set({ 
          error: error.message || 'Failed to fetch regulation',
          loading: false 
        });
        throw error;
      }
    },
  }),
  {
    name: "regulation-storage",
    partialize: (state) => ({ 
      // Only persist form data, not regulations (they come from API)
      formData: state.formData 
    }),
  }
); 




