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
    group: 'ALL',
    sort: 'name_asc',
    ...initialParams
  });

  const [debouncedSearch, setDebouncedSearch] = useState(params.search);
  const [debouncedUId, setDebouncedUId] = useState(params.u_id);
  const [data, setData] = useState({
    addresses: [],
    total: 0,
    totalDatabaseCount: 0,
    groupCounts: {
      VIP: 0,
      ADVERTISEMENT: 0,
      HELP: 0,
      CONTRIBUTOR: 0
    },
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
        group: initialParams.group !== undefined ? initialParams.group : (initialParams.addressGroup !== undefined ? initialParams.addressGroup : prev.group),
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
    }, 400);
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

  const setGroup = useCallback((group) => {
    setParams(prev => ({ ...prev, group: group || 'ALL', page: 1 }));
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
      group: 'ALL',
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
      const deletedItem = (prev.addresses || []).find(item => item._id === id);
      const remaining = (prev.addresses || []).filter(item => item._id !== id);
      const newTotal = Math.max(0, (prev.total || remaining.length) - 1);
      const groupKey = (deletedItem?.addressGroup || 'CONTRIBUTOR').toUpperCase();
      const updatedGroupCounts = { ...prev.groupCounts };
      if (updatedGroupCounts[groupKey] !== undefined) {
        updatedGroupCounts[groupKey] = Math.max(0, updatedGroupCounts[groupKey] - 1);
      }
      return {
        ...prev,
        addresses: remaining,
        total: newTotal,
        totalDatabaseCount: Math.max(0, (prev.totalDatabaseCount || newTotal) - 1),
        groupCounts: updatedGroupCounts,
        totalPages: Math.max(1, Math.ceil(newTotal / (prev.limit || 50)))
      };
    });
  }, []);

  // Instant optimistic bulk deletion from local state (0ms latency!)
  const optimisticBulkDelete = useCallback((ids = []) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    setData(prev => {
      const deletedItems = (prev.addresses || []).filter(item => idSet.has(item._id));
      const remaining = (prev.addresses || []).filter(item => !idSet.has(item._id));
      const countDeleted = deletedItems.length;
      const newTotal = Math.max(0, (prev.total || 0) - countDeleted);
      const updatedGroupCounts = { ...prev.groupCounts };
      deletedItems.forEach(item => {
        const groupKey = (item?.addressGroup || 'CONTRIBUTOR').toUpperCase();
        if (updatedGroupCounts[groupKey] !== undefined) {
          updatedGroupCounts[groupKey] = Math.max(0, updatedGroupCounts[groupKey] - 1);
        }
      });
      return {
        ...prev,
        addresses: remaining,
        total: newTotal,
        totalDatabaseCount: Math.max(0, (prev.totalDatabaseCount || 0) - countDeleted),
        groupCounts: updatedGroupCounts,
        totalPages: Math.max(1, Math.ceil(newTotal / (prev.limit || 50)))
      };
    });
  }, []);

  // Instant optimistic update in local state (0ms latency!)
  const optimisticUpdate = useCallback((id, updates) => {
    setData(prev => {
      let oldGroup = null;
      const updatedList = (prev.addresses || []).map(item => {
        if (item._id === id) {
          oldGroup = (item.addressGroup || 'CONTRIBUTOR').toUpperCase();
          return { ...item, ...updates };
        }
        return item;
      });

      let updatedGroupCounts = { ...prev.groupCounts };
      if (updates.addressGroup && oldGroup && updates.addressGroup.toUpperCase() !== oldGroup) {
        const newGroup = updates.addressGroup.toUpperCase();
        if (updatedGroupCounts[oldGroup] !== undefined) {
          updatedGroupCounts[oldGroup] = Math.max(0, updatedGroupCounts[oldGroup] - 1);
        }
        if (updatedGroupCounts[newGroup] !== undefined) {
          updatedGroupCounts[newGroup] = (updatedGroupCounts[newGroup] || 0) + 1;
        }
      }

      return {
        ...prev,
        addresses: updatedList,
        groupCounts: updatedGroupCounts
      };
    });
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
        if (typeof res.totalDatabaseCount === 'number' || typeof res.total === 'number') {
          statsCallback({ totalAddresses: res.totalDatabaseCount ?? res.total, groupCounts: res.groupCounts });
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
  }, [params.page, params.limit, debouncedUId, params.district, params.pincode, params.street, params.alphabet, params.group, params.sort, debouncedSearch]);

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
    totalDatabaseCount: data.totalDatabaseCount || data.total,
    groupCounts: data.groupCounts || { VIP: 0, ADVERTISEMENT: 0, HELP: 0, CONTRIBUTOR: 0 },
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
    setGroup,
    setSort,
    setPage,
    setLimit,
    clearFilters,
    refetch: loadData,
    optimisticDelete,
    optimisticBulkDelete,
    optimisticUpdate
  };
}

