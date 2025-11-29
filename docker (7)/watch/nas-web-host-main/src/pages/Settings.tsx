import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Settings as SettingsIcon, Save } from "lucide-react";

interface Settings {
  apiUrl: string;
  wsUrl: string;
}

const Settings = () => {
  const [settings, setSettings] = useState<Settings>({
    apiUrl: localStorage.getItem('apiUrl') || 'http://localhost:3010/api',
    wsUrl: localStorage.getItem('wsUrl') || 'ws://localhost:8090',
  });

  const handleSave = () => {
    localStorage.setItem('apiUrl', settings.apiUrl);
    localStorage.setItem('wsUrl', settings.wsUrl);
    toast.success("Settings saved! Reload the page for changes to take effect.");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <SettingsIcon className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground">Configure backend connection</p>
            </div>
          </div>

          <Card className="p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="apiUrl" className="text-foreground font-medium">
                Backend API URL
              </Label>
              <Input
                id="apiUrl"
                type="text"
                placeholder="http://192.168.1.100:3010/api"
                value={settings.apiUrl}
                onChange={(e) => setSettings({ ...settings, apiUrl: e.target.value })}
                className="font-mono"
              />
              <p className="text-sm text-muted-foreground">
                The base URL for your monitoring backend API
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wsUrl" className="text-foreground font-medium">
                WebSocket URL
              </Label>
              <Input
                id="wsUrl"
                type="text"
                placeholder="ws://192.168.1.100:8090"
                value={settings.wsUrl}
                onChange={(e) => setSettings({ ...settings, wsUrl: e.target.value })}
                className="font-mono"
              />
              <p className="text-sm text-muted-foreground">
                The WebSocket URL for real-time updates
              </p>
            </div>

            <div className="pt-4 border-t border-border">
              <Button onClick={handleSave} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
            </div>

            <div className="bg-muted/50 p-4 rounded-md">
              <h3 className="text-sm font-semibold text-foreground mb-2">Default values:</h3>
              <ul className="text-sm text-muted-foreground space-y-1 font-mono">
                <li>• API URL: http://localhost:3010/api</li>
                <li>• WebSocket: ws://localhost:8090</li>
              </ul>
            </div>
          </Card>

          <Card className="p-6 bg-info/10 border-info">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              💡 Docker Deployment
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              When deploying to your NAS, update these URLs to match your server's IP address:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Replace <code className="bg-background px-1 rounded">localhost</code> with your NAS IP (e.g., 192.168.1.100)</li>
              <li>• Ensure ports 3010 and 8090 are accessible</li>
              <li>• Save settings and reload the page</li>
            </ul>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Settings;
