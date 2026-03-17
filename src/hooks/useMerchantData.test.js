// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useMerchantData } from './useMerchantData';
import { renderHook, waitFor } from '@testing-library/react';

// Mock fetch
global.fetch = vi.fn();

const buildMockCsv = () => `ignored header line 1
ignored header line 2
001,Merchant1,011,MerchantA,012,MerchantB,013,MerchantC`;

describe('useMerchantData hook', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    fetch.mockClear();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it('should return default state when no memberId', () => {
    const mockCsv = buildMockCsv();

    fetch.mockResolvedValueOnce({
      text: async () => mockCsv,
    });

    const { result } = renderHook(() => useMerchantData('', ['IC1']));

    expect(result.current.name).toBe('');
    expect(result.current.duty).toBe('');
    expect(result.current.error).toBe('');
  });

  it('should find merchant by ID suffix', async () => {
    const mockCsv = buildMockCsv();

    fetch.mockResolvedValueOnce({
      text: async () => mockCsv,
    });

    const { result } = renderHook(() => useMerchantData('member@11', ['IC2']));

    await waitFor(() => {
      expect(result.current.name).toBe('MerchantA');
    });

    expect(result.current.duty).toBe('IC2');
    expect(result.current.error).toBe('');
  });

  it('should block non-admin access to merchants outside their duty', async () => {
    const mockCsv = buildMockCsv();

    fetch.mockResolvedValueOnce({
      text: async () => mockCsv,
    });

    // User only has IC1 access
    const { result } = renderHook(() => useMerchantData('member@12', ['IC1']));

    await waitFor(() => {
      expect(result.current.name).toBe('MerchantB');
    });

    // Should have error because user can't access IC3
    expect(result.current.error).toContain('Access Denied');
    expect(result.current.error).toContain('IC3');
  });

  it('should allow admin access to any merchant', async () => {
    const mockCsv = buildMockCsv();

    fetch.mockResolvedValueOnce({
      text: async () => mockCsv,
    });

    // Admin (IC0) should access any merchant
    const { result } = renderHook(() => useMerchantData('member@12', ['IC0']));

    await waitFor(() => {
      expect(result.current.name).toBe('MerchantB');
    });

    expect(result.current.error).toBe('');
  });

  it('should default to QQ288 when no suffix', async () => {
    const mockCsv = `ignored header line 1
ignored header line 2
001,Merchant1,011,MerchantA,012,QQ288,013,MerchantC`;

    fetch.mockResolvedValueOnce({
      text: async () => mockCsv,
    });

    const { result } = renderHook(() => useMerchantData('someid', ['IC2']));

    await waitFor(() => {
      expect(result.current.name).toBe('QQ288');
      expect(result.current.duty).toBe('IC3');
    });
  });

  it('should handle malformed CSV gracefully', async () => {
    fetch.mockResolvedValueOnce({
      text: async () => 'invalid,csv,malformed',
    });

    const { result } = renderHook(() => useMerchantData('member@12', ['IC1']));

    await waitFor(() => {
      expect(result.current.name).toBe('');
      expect(result.current.error).toBe('');
    });
  });

  it('should handle fetch errors', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useMerchantData('member@12', ['IC1']));

    await waitFor(() => {
      // Should have default error state
      expect(result.current.name).toBeDefined();
    });
  });
});
