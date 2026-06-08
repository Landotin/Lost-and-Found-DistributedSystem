import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConnectionStatus from '../ConnectionStatus';
import type { StatusResponse, PendingSyncResponse } from '../../types';

describe('ConnectionStatus', () => {
  it('renders "Connected" when status is connected with 2 nodes', () => {
    const mockStatusData: StatusResponse = {
      deptName: 'Test Dept',
      connected: true,
      status: 'connected',
      nodeCount: 2,
      nodes: [
        { dept_name: 'Dept A', socket_id: 's1', connected_at: new Date().toISOString() },
        { dept_name: 'Dept B', socket_id: 's2', connected_at: new Date().toISOString() },
      ],
    };

    render(
      <ConnectionStatus
        statusData={mockStatusData}
        loading={false}
        error={null}
        pendingCount={0}
      />
    );

    expect(screen.getByText(/Connected/i)).toBeInTheDocument();
    expect(screen.getByText(/2 node/)).toBeInTheDocument();
    expect(screen.queryByText(/offline/i)).not.toBeInTheDocument();
  });

  it('renders "Connecting" with amber pulse', () => {
    const mockStatusData: StatusResponse = {
      deptName: 'Test Dept',
      connected: false,
      status: 'connecting',
      nodeCount: 0,
      nodes: [],
    };

    const { container } = render(
      <ConnectionStatus
        statusData={mockStatusData}
        loading={false}
        error={null}
        pendingCount={0}
      />
    );

    expect(screen.getByText(/Connecting/)).toBeInTheDocument();
    // Verify the amber pulse indicator is present
    const pulsingLed = container.querySelector('.animate-pulse');
    expect(pulsingLed).toBeInTheDocument();
    expect(screen.queryByText(/offline/i)).not.toBeInTheDocument();
  });

  it('renders "Disconnected" with pending count', () => {
    const mockStatusData: StatusResponse = {
      deptName: 'Test Dept',
      connected: false,
      status: 'disconnected',
      nodeCount: 0,
      nodes: [],
    };

    render(
      <ConnectionStatus
        statusData={mockStatusData}
        loading={false}
        error={null}
        pendingCount={3}
      />
    );

    expect(screen.getByText(/Disconnected/)).toBeInTheDocument();
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });

  it('shows offline banner when disconnected with pending items', () => {
    const mockStatusData: StatusResponse = {
      deptName: 'Test Dept',
      connected: false,
      status: 'disconnected',
      nodeCount: 0,
      nodes: [],
    };

    render(
      <ConnectionStatus
        statusData={mockStatusData}
        loading={false}
        error={null}
        pendingCount={5}
      />
    );

    const banner = screen.getByText(/offline/i);
    expect(banner).toBeInTheDocument();
    expect(screen.getByText(/5 item/)).toBeInTheDocument();
    // Banner should be a fixed-position bar at the top
    expect(banner.closest('div')).toHaveClass('fixed');
  });

  it('shows no offline banner when connected', () => {
    const mockStatusData: StatusResponse = {
      deptName: 'Test Dept',
      connected: true,
      status: 'connected',
      nodeCount: 2,
      nodes: [],
    };

    render(
      <ConnectionStatus
        statusData={mockStatusData}
        loading={false}
        error={null}
        pendingCount={0}
      />
    );

    expect(screen.queryByText(/offline/i)).not.toBeInTheDocument();
  });
});

