'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './button';

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
    name?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="p-6 rounded-lg border-2 border-red-200 bg-red-50 my-4 text-center">
                    <h2 className="text-red-800 font-bold text-lg mb-2">
                        {this.props.name || 'Component'} Error
                    </h2>
                    <p className="text-red-600 text-sm mb-4">
                        {this.state.error?.message || 'Something went wrong.'}
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="bg-white hover:bg-red-100 border-red-200 text-red-800"
                    >
                        Retry
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
