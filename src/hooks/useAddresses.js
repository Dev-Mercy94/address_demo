import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAddresses } from '../services/apiService';

export function useAddresses(initialParams = {}, onStatsChange = null) {
  const [params, setParams] = useState({
    page: 1,
    limit: 50,
    search: '',
    u_id: '',
    district: 'ALL',
    pincode: '',
    street: '',
    alphabet: 'ALL',
    sort: 'name_asc',
    ...initialParams
  });

  const [debouncedSearch, setDebouncedSearch] = useState(params.search);
  const [debouncedUId, setDebouncedUId] = useState(params.u_id);
  const [data, setData] = useState({
    addresses: [],
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 1
  });
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const searchTimeoutRef = useRef(null);
  const uIdTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Sync with dynamic initialParams when navigating from Districts, Pincodes, or Dashboard
  useEffect(() => {
    if (initialParams && Object.keys(initialParams).length > 0) {
      setParams(prev => ({
        ...prev,
        page: 1,
        district: initialParams.district !== undefined ? initialParams.district : prev.district,
        pincode: initialParams.pincode !== undefined ? initialParams.pincode : prev.pincode,
        search: initialParams.search !== undefined ? initialParams.search : prev.search,
        street: initialParams.street !== undefined ? initialParams.street : prev.street,
        u_id: initialParams.u_id !== undefined ? initialParams.u_id : prev.u_id,
        alphabet: initialParams.alphabet !== undefined ? initialParams.alphabet : prev.alphabet,
        sort: initialParams.sort !== undefined ? initialParams.sort : prev.sort,
      }));
      if (initialParams.search !== undefined) {
        setDebouncedSearch(initialParams.search);
      }
      if (initialParams.u_id !== undefined) {
        setDebouncedUId(initialParams.u_id);
      }
    }
  }, [initialParams]);

  const setSearch = useCallback((searchTerm) => {
    setParams(prev => ({ ...prev, search: searchTerm, page: 1 }));
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 200);
  }, []);

  const setUId = useCallback((uId) => {
    setParams(prev => ({ ...prev, u_id: uId, page: 1 }));
    if (uIdTimeoutRef.current) clearTimeout(uIdTimeoutRef.current);
    uIdTimeoutRef.current = setTimeout(() => {
      setDebouncedUId(uId);
    }, 200);
  }, []);

  const setDistrict = useCallback((district) => {
    setParams(prev => ({ ...prev, district, page: 1 }));
  }, []);

  const setPincode = useCallback((pincode) => {
    setParams(prev => ({ ...prev, pincode, page: 1 }));
  }, []);

  const setStreet = useCallback((street) => {
    setParams(prev => ({ ...prev, street, page: 1 }));
  }, []);

  const setAlphabet = useCallback((alphabet) => {
    setParams(prev => ({ ...prev, alphabet, page: 1 }));
  }, []);

  const setSort = useCallback((sort) => {
    setParams(prev => ({ ...prev, sort, page: 1 }));
  }, []);

  const setPage = useCallback((page) => {
    setParams(prev => ({ ...prev, page }));
  }, []);

  const setLimit = useCallback((limit) => {
    setParams(prev => ({ ...prev, limit, page: 1 }));
  }, []);

  const clearFilters = useCallback(() => {
    setParams({
      page: 1,
      limit: 50,
      search: '',
      u_id: '',
      district: 'ALL',
      pincode: '',
      street: '',
      alphabet: 'ALL',
      sort: 'name_asc'
    });
    setDebouncedSearch('');
    setDebouncedUId('');
  }, []);

  const onStatsChangeRef = useRef(onStatsChange);
  useEffect(() => {
    onStatsChangeRef.current = onStatsChange;
  }, [onStatsChange]);

  // Instant optimistic deletion from local state (0ms latency!)
  const optimisticDelete = useCallback((id) => {
    setData(prev => {
      const remaining = (prev.addresses || []).filter(item => item._id !== id);
      const newTotal = Math.max(0, (prev.total || remaining.length) - 1);
      return {
        ...prev,
        addresses: remaining,
        total: newTotal,
        totalPages: Math.max(1, Math.ceil(newTotal / (prev.limit || 50)))
      };
    });
  }, []);

  // Instant optimistic update in local state (0ms latency!)
  const optimisticUpdate = useCallback((id, updates) => {
    setData(prev => ({
      ...prev,
      addresses: (prev.addresses || []).map(item =>
        item._id === id ? { ...item, ...updates } : item
      )
    }));
  }, []);

  const loadData = useCallback(async () => {
    // Abort previous in-flight request if user typed another search or changed filter
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);
    try {
      const res = await fetchAddresses({
        ...params,
        search: debouncedSearch,
        u_id: debouncedUId
      }, abortController.signal);

      setData(res);
      const statsCallback = onStatsChangeRef.current;
      if (statsCallback && typeof statsCallback === 'function') {
        const hasFilters = Boolean(
          debouncedSearch ||
          debouncedUId ||
          (params.district && params.district !== 'ALL') ||
          params.pincode ||
          params.street ||
          (params.alphabet && params.alphabet !== 'ALL')
        );
        if (!hasFilters && typeof res.total === 'number') {
          statsCallback({ totalAddresses: res.total });
        } else {
          statsCallback();
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // Ignored: superseded by newer query
        return;
      }
      console.error('Error fetching addresses:', err);
      setError(err.message || 'Failed to load address data');
    } finally {
      if (abortControllerRef.current === abortController) {
        setLoading(false);
        setInitialLoading(false);
      }
    }
  }, [params.page, params.limit, debouncedUId, params.district, params.pincode, params.street, params.alphabet, params.sort, debouncedSearch]);

  useEffect(() => {
    loadData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadData]);

  return {
    addresses: data.addresses,
    total: data.total,
    page: data.page,
    limit: data.limit,
    totalPages: data.totalPages,
    loading,
    initialLoading,
    error,
    params: { ...params, search: params.search },
    setSearch,
    setUId,
    setDistrict,
    setPincode,
    setStreet,
    setAlphabet,
    setSort,
    setPage,
    setLimit,
    clearFilters,
    refetch: loadData,
    optimisticDelete,
    optimisticUpdate
  };
}
