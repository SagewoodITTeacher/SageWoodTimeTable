import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

function Hello({name}: {name: string}) {
  return <h1>Hello, {name}</h1>;
}

describe('test harness', () => {
  it('renders a component and asserts via jest-dom matchers', () => {
    render(<Hello name="Curro" />);
    expect(screen.getByRole('heading', {name: 'Hello, Curro'})).toBeInTheDocument();
  });

  it('fails on a wrong assertion (delete this once verified)', () => {
    expect(1 + 1).toBe(2);
  });
});
