import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/ui/Button';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  override state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info);
  }

  override render() {
    if (this.state.error) {
      return (
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground mt-2">
            The smart-home dashboard couldn&apos;t be displayed.
          </p>
          <Button
            className="mt-6"
            onClick={() => {
              window.location.reload();
            }}
          >
            Reload page
          </Button>
        </main>
      );
    }

    return this.props.children;
  }
}
