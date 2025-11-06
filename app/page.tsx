'use client';

import { useState } from 'react';
import { Upload, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

type FileStatus = 'pending' | 'uploading' | 'success' | 'error';

interface FileUploadState {
  file: File;
  id: string;
  status: FileStatus;
  progress: number;
  error?: string;
  result?: unknown;
}

export default function Home() {
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const newFiles: FileUploadState[] = selectedFiles.map((file) => ({
      file,
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      status: 'pending',
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const uploadFile = async (fileState: FileUploadState): Promise<FileUploadState> => {
    const formData = new FormData();
    formData.append('file', fileState.file);

    try {
      const response = await fetch('https://onederful.app.n8n.cloud/webhook-test/randomtest', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        return {
          ...fileState,
          status: 'success',
          progress: 100,
          result: data,
        };
      } else {
        return {
          ...fileState,
          status: 'error',
          progress: 0,
          error: data.error || 'Upload failed',
        };
      }
    } catch (error) {
      return {
        ...fileState,
        status: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  };

  const handleUploadAll = async () => {
    setUploading(true);

    // Upload files sequentially to show progress clearly
    for (let i = 0; i < files.length; i++) {
      const currentFile = files[i];

      if (currentFile.status !== 'pending') continue;

      // Set uploading status
      setFiles((prev) =>
        prev.map((f) =>
          f.id === currentFile.id ? { ...f, status: 'uploading', progress: 50 } : f
        )
      );

      // Upload file
      const result = await uploadFile(currentFile);

      // Update with result
      setFiles((prev) =>
        prev.map((f) => (f.id === currentFile.id ? result : f))
      );
    }

    setUploading(false);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearAll = () => {
    setFiles([]);
  };

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const successCount = files.filter((f) => f.status === 'success').length;
  const errorCount = files.filter((f) => f.status === 'error').length;

  const getStatusIcon = (status: FileStatus) => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Upload className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: FileStatus) => {
    switch (status) {
      case 'uploading':
        return 'border-blue-300 bg-blue-50';
      case 'success':
        return 'border-green-300 bg-green-50';
      case 'error':
        return 'border-red-300 bg-red-50';
      default:
        return 'border-gray-200 bg-white';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-2 text-center">
            n8n Workflow Testing
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Multi-Image Upload with Real-time Progress
          </p>

          {/* File Input */}
          <div className="mb-6">
            <label className="block">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer">
                <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Click to select images or drag and drop
                </p>
                <p className="text-xs text-gray-500">
                  JPG, PNG, GIF, WEBP • Max 10MB per file
                </p>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={uploading}
                />
              </div>
            </label>
          </div>

          {/* Status Summary */}
          {files.length > 0 && (
            <div className="mb-6 flex items-center justify-between bg-gray-50 p-4 rounded-lg">
              <div className="flex gap-6 text-sm">
                <span className="text-gray-600">
                  Total: <strong>{files.length}</strong>
                </span>
                {pendingCount > 0 && (
                  <span className="text-gray-600">
                    Pending: <strong>{pendingCount}</strong>
                  </span>
                )}
                {successCount > 0 && (
                  <span className="text-green-600">
                    Success: <strong>{successCount}</strong>
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="text-red-600">
                    Failed: <strong>{errorCount}</strong>
                  </span>
                )}
              </div>
              <button
                onClick={clearAll}
                className="text-sm text-gray-600 hover:text-gray-900"
                disabled={uploading}
              >
                Clear All
              </button>
            </div>
          )}

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
              {files.map((fileState) => (
                <div
                  key={fileState.id}
                  className={`border rounded-lg p-4 transition-colors ${getStatusColor(
                    fileState.status
                  )}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getStatusIcon(fileState.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {fileState.file.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatFileSize(fileState.file.size)}
                      </p>
                      {fileState.status === 'error' && fileState.error && (
                        <p className="text-xs text-red-600 mt-2">
                          Error: {fileState.error}
                        </p>
                      )}
                      {fileState.status === 'success' && (
                        <p className="text-xs text-green-600 mt-2">
                          Successfully sent to n8n
                        </p>
                      )}
                    </div>
                    {fileState.status === 'pending' && !uploading && (
                      <button
                        onClick={() => removeFile(fileState.id)}
                        className="text-gray-400 hover:text-gray-600 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upload Button */}
          {files.length > 0 && (
            <button
              onClick={handleUploadAll}
              disabled={uploading || pendingCount === 0}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {uploading
                ? `Uploading... (${successCount + errorCount}/${files.length})`
                : `Upload ${pendingCount} ${pendingCount === 1 ? 'File' : 'Files'}`}
            </button>
          )}

          {files.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-8">
              No files selected. Choose images to upload.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
