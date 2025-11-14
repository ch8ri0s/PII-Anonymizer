import { FileText, Calendar, HardDrive, FileType, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { FileInfo } from '../types';

interface FileMetadataPanelProps {
  file: FileInfo;
  onReset: () => void;
}

export function FileMetadataPanel({ file, onReset }: FileMetadataPanelProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getFileTypeLabel = (type: string): string => {
    if (type.includes('pdf')) return 'PDF Document';
    if (type.includes('word') || type.includes('document')) return 'Word Document';
    if (type.includes('sheet') || type.includes('excel')) return 'Excel Spreadsheet';
    if (type.includes('csv')) return 'CSV File';
    return type;
  };

  const getFileTypeBadge = (type: string): string => {
    if (type.includes('pdf')) return 'bg-red-100 text-red-700';
    if (type.includes('word') || type.includes('document')) return 'bg-blue-100 text-blue-700';
    if (type.includes('sheet') || type.includes('excel')) return 'bg-green-100 text-green-700';
    if (type.includes('csv')) return 'bg-purple-100 text-purple-700';
    return 'bg-slate-100 text-slate-700';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>File Details</CardTitle>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-slate-400 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-slate-500">File Name</p>
              <p className="text-slate-900 truncate">{file.name}</p>
            </div>
          </div>

          <Separator />

          <div className="flex items-start gap-3">
            <FileType className="w-5 h-5 text-slate-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-slate-500">Type</p>
              <Badge className={`mt-1 ${getFileTypeBadge(file.type)}`}>
                {getFileTypeLabel(file.type)}
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="flex items-start gap-3">
            <HardDrive className="w-5 h-5 text-slate-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-slate-500">Size</p>
              <p className="text-slate-900">{formatFileSize(file.size)}</p>
            </div>
          </div>

          <Separator />

          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-slate-500">Last Modified</p>
              <p className="text-slate-900">
                {file.lastModified.toLocaleDateString()} at{' '}
                {file.lastModified.toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
