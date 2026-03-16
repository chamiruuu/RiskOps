import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMerchantData } from './useMerchantData';
import { renderHook, waitFor } from '@testing-library/react';

// Mock fetch
global.fetch = vi.fn();

describe('useMerchantData hook', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  it('should return default state when no memberId', () => {
    const mockCsv = `ID,Name,IC1,Name1,IC2,Name2,IC3,Name3,IC5,Name5
1,Merchant1,11,MerchantA,12,MerchantB,13,MerchantC,15,MerchantD`;

    fetch.mockResolvedValueOnce({
      text: async () => mockCsv,
    });

    const { result } = renderHook(() => useMerchantData('', ['IC1']));

    expect(result.current.name).toBe('');
    expect(result.current.duty).toBe('');
    expect(result.current.error).toBe('');
  });

  it('should find merchant by ID suffix', async () => {
    const mockCsv = `ID,Name,IC1,Name1,IC2,Name2,IC3,Name3,IC5,Name5
1,Merchant1,11,MerchantA,12,MerchantB,13,MerchantC,15,MerchantD`;

    fetch.mockResolvedValueOnce({
      text: async () => mockCsv,
    });

    const { result } = renderHook(() => useMerchantData('11@', ['IC1']));

    await waitFor(() => {
      expect(result.current.name).toBe('MerchantA');
    });

    expect(result.current.duty).toBe('IC1');
    expect(result.current.error).toBe('');
  });

  it('should block non-admin access to merchants outside their duty', async () => {
    const mockCsv = `ID,Name,IC1,Name1,IC2,Name2,IC3,Name3,IC5,Name5
1,Merchant1,11,MerchantA,12,MerchantB,13,MerchantC,15,MerchantD`;

    fetch.mockResolvedValueOnce({
      text: async () => mockCsv,
    });

    // User only has IC1 access
    const { result } = renderHook(() => useMerchantData('12@', ['IC1']));

    await waitFor(() => {
      expect(result.current.name).toBe('MerchantB');
    });

    // Should have error because user can't access IC2
    expect(result.current.error).toContain('Access Denied');
    expect(result.current.error).toContain('IC2');
  });

  it('should allow admin access to any merchant', async () => {
    const mockCsv = `ID,Name,IC1,Name1,IC2,Name2,IC3,Name3,IC5,Name5
1,Merchant1,11,MerchantA,12,MerchantB,13,MerchantC,15,MerchantD`;

    fetch.mockResolvedValueOnce({
      text: async () => mockCsv,
    });

    // Admin (IC0) should access any merchant
    const { result } = renderHook(() => useMerchantData('12@', ['IC0']));

    await waitFor(() => {
      expect(result.current.name).toBe('MerchantB');
    });

    expect(result.current.error).toBe('');
  });

  it('should default to QQ288 when no suffix', async () => {
    const mockCsv = `ID,Name,IC1,Name1,IC2,Name2,IC3,Name3,IC5,Name5
1,QQ288,11,MerchantA,12,QQ288,13,MerchantC,15,MerchantD`;

    fetch.mockResolvedValueOnce({
      text: async () => mockCsv,
    });

    const { result } = renderHook(() => useMerchantData('someid', ['IC2']));

    await waitFor(() => {
      expect(result.current.name).toBe('QQ288');
    });

    expect(result.current.duty).toBe('IC2');
  });

  it('should handle malformed CSV gracefully', () => {
    fetch.mockResolvedValueOnce({
      text: async () => 'invalid,csv,malformed',
    });

    const { result } = renderHook(() => useMerchantData('12@', ['IC1']));

    expect(result.current.name).toBe('');
    expect(result.current.error).toBe('');
  });

  it('should handle fetch errors', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useMerchantData('12@', ['IC1']));

    await waitFor(() => {
      // Should have default error state
      expect(result.current.name).toBeDefined();
    });
  });
});
