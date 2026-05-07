import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WorkloadChart from './WorkloadChart';

describe('WorkloadChart', () => {
  it('shows empty-state copy when data is empty', () => {
    render(<WorkloadChart data={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent(/No assignments yet/i);
  });

  it('does not show empty-state copy when data has entries', () => {
    const data = [{ name: 'AAA', morning: 1, afternoon: 0, tech: 0, standby: 0 }];
    render(<WorkloadChart data={data} />);
    expect(screen.queryByText(/No assignments yet/i)).toBeNull();
  });
});
