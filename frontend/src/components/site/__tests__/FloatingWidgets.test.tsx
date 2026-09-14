import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FloatingWidgets } from '../FloatingWidgets';

describe('FloatingWidgets Removal of Phone and Chat', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = '';
  });

  it('does not render phone hotline link or chat button when scroll is at top', async () => {
    await act(async () => {
      root.render(<FloatingWidgets />);
      await Promise.resolve();
    });

    const phoneLink = container.querySelector('a[href^="tel:"]');
    const phoneLabel = container.querySelector('[aria-label*="hotline" i]');
    const chatBtn = container.querySelector('button[aria-label*="chat" i]');

    expect(phoneLink).toBeNull();
    expect(phoneLabel).toBeNull();
    expect(chatBtn).toBeNull();
    expect(container.innerHTML).toBe('');
  });

  it('does not render phone hotline link or chat button when scrolled down (only renders scroll to top)', async () => {
    await act(async () => {
      root.render(<FloatingWidgets />);
      await Promise.resolve();
    });

    // Simulate scroll past 400
    await act(async () => {
      window.scrollY = 500;
      window.dispatchEvent(new Event('scroll'));
      await Promise.resolve();
    });

    const phoneLink = container.querySelector('a[href^="tel:"]');
    const phoneLabel = container.querySelector('[aria-label*="hotline" i]');
    const chatBtn = container.querySelector('button[aria-label*="chat" i]');

    expect(phoneLink).toBeNull();
    expect(phoneLabel).toBeNull();
    expect(chatBtn).toBeNull();

    // Scroll to top button is rendered
    const scrollTopBtn = container.querySelector('button[aria-label="Lên đầu trang"]');
    expect(scrollTopBtn).not.toBeNull();
  });
});
