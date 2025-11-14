import { useState, useEffect } from 'react';
import { Download, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Alert, AlertDescription } from './ui/alert';
import { FileInfo, SanitizationResult } from '../types';
import { sanitizePii } from '../utils/piiSanitizer';

interface ProcessingOutputProps {
  file: FileInfo;
  isProcessing: boolean;
}

export function ProcessingOutput({ file, isProcessing }: ProcessingOutputProps) {
  const [result, setResult] = useState<SanitizationResult | null>(null);

  useEffect(() => {
    if (!isProcessing) {
      const sanitizationResult = sanitizePii(file.content, file.type);
      setResult(sanitizationResult);
    }
  }, [isProcessing, file]);

  const downloadMarkdown = () => {
    if (!result) return;
    const blob = new Blob([result.sanitizedContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.replace(/\.[^/.]+$/, '') + '_sanitized.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadMapping = () => {
    if (!result) return;
    const mapping = {
      originalFile: file.name,
      processedDate: new Date().toISOString(),
      totalChanges: result.piiDetected,
      changes: result.changes,
    };
    const blob = new Blob([JSON.stringify(mapping, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.replace(/\.[^/.]+$/, '') + '_mapping.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Sanitization Results</CardTitle>
            {result && (
              <p className="text-slate-600 mt-1">
                {result.piiDetected} PII instances detected and sanitized
              </p>
            )}
          </div>
          {result && (
            <div className="flex gap-2">
              <Button onClick={downloadMarkdown} size="sm">
                <Download className="w-4 h-4 mr-2" />
                Markdown
              </Button>
              <Button onClick={downloadMapping} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Mapping
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            <p className="text-slate-600">Processing and sanitizing PII...</p>
          </div>
        ) : result ? (
          <>
            <Alert className="mb-6 border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                File successfully processed and sanitized. Ready to download.
              </AlertDescription>
            </Alert>

            <Tabs defaultValue="markdown" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="markdown">Sanitized Markdown</TabsTrigger>
                <TabsTrigger value="mapping">Change Mapping</TabsTrigger>
              </TabsList>

              <TabsContent value="markdown" className="mt-4">
                <ScrollArea className="h-96 w-full rounded-md border border-slate-200 bg-slate-50 p-4">
                  <pre className="text-slate-700 whitespace-pre-wrap break-words">
                    {result.sanitizedContent}
                  </pre>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="mapping" className="mt-4">
                <ScrollArea className="h-96 w-full rounded-md border border-slate-200 bg-slate-50 p-4">
                  <div className="space-y-3">
                    {result.changes.map((change, index) => (
                      <div
                        key={index}
                        className="bg-white p-4 rounded-lg border border-slate-200"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{change.type}</Badge>
                          <span className="text-slate-500">{change.location}</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex gap-2">
                            <span className="text-slate-500 w-20">Original:</span>
                            <span className="text-red-600 line-through">
                              {change.original}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-slate-500 w-20">Replaced:</span>
                            <span className="text-green-600">
                              {change.replacement}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
