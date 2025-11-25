import { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-secondary/20">
          <Card className="max-w-md w-full border-destructive/50">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <AlertTriangle className="h-16 w-16 text-destructive" />
              </div>
              <CardTitle className="text-center text-2xl">Noget gik galt</CardTitle>
              <CardDescription className="text-center">
                Der opstod en uventet fejl i applikationen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <p className="text-sm text-destructive font-mono break-all">
                    {this.state.error.message}
                  </p>
                </div>
              )}
              <Button onClick={this.handleReset} className="w-full" size="lg">
                Genindlæs siden
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
