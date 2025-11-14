import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { FileInfo } from '../types';
import { ScrollArea } from './ui/scroll-area';

interface FilePreviewProps {
  file: FileInfo;
}

export function FilePreview({ file }: FilePreviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64 w-full rounded-md border border-slate-200 bg-slate-50 p-4">
          <pre className="text-slate-700 whitespace-pre-wrap break-words">
            {file.preview}
          </pre>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
