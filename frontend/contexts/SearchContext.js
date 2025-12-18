import React, { createContext, useContext, useState, useEffect } from 'react'

const SearchContext = createContext()

export const useSearch = () => {
  const context = useContext(SearchContext)
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider')
  }
  return context
}

export const SearchProvider = ({ children }) => {
  const [searchTerm, setSearchTerm] = useState('')

  // Load search term from localStorage on mount
  useEffect(() => {
    const savedSearchTerm = localStorage.getItem('search-term')
    if (savedSearchTerm) {
      setSearchTerm(savedSearchTerm)
    }
  }, [])

  // Save search term to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('search-term', searchTerm)
  }, [searchTerm])

  return (
    <SearchContext.Provider value={{ searchTerm, setSearchTerm }}>
      {children}
    </SearchContext.Provider>
  )
}
