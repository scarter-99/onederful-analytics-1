'use client';

import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Upload, FolderOpen, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import type { UploadMetadata, UploadProgress, UploadResponse, UploadFile } from '@/types/folder-upload';

export default function FolderUploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [metadata, setMetadata] = useState<UploadMetadata>({});
  const [progress, setProgress] = useState<UploadProgress>({
    loaded: 0,
    total: 0,
    percentage: 0,
    status: 'idle',
  });
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const uploadFiles: UploadFile[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      uploadFiles.push({
        file,
        relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
        size: file.size,
        type: file.type,
      });
    }

    setFiles(uploadFiles);
    setResult(null);
  };

  // Handle drag events
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      // Modern browsers with DataTransferItemList
      handleFileSelect(e.dataTransfer.files);
    }
  };

  // Handle folder selection
  const handleFolderSelect = (e: ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
  };

  // Upload files to API
  const handleUpload = async () => {
    if (files.length === 0) return;

    setProgress({
      loaded: 0,
      total: files.reduce((sum, f) => sum + f.size, 0),
      percentage: 0,
      status: 'uploading',
      message: 'Preparing upload...',
    });

    try {
      // Create FormData
      const formData = new FormData();

      // Add files
      files.forEach((uploadFile) => {
        formData.append('files[]', uploadFile.file, uploadFile.relativePath);
      });

      // Add metadata
      formData.append('meta', JSON.stringify(metadata));

      // Upload with progress tracking
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentage = Math.round((e.loaded / e.total) * 100);
          setProgress({
            loaded: e.loaded,
            total: e.total,
            percentage,
            status: 'uploading',
            message: `Uploading... ${percentage}%`,
          });
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response: UploadResponse = JSON.parse(xhr.responseText);
          setProgress({
            loaded: progress.total,
            total: progress.total,
            percentage: 100,
            status: 'success',
            message: 'Upload complete!',
          });
          setResult(response);
        } else {
          const error: UploadResponse = JSON.parse(xhr.responseText);
          setProgress({
            loaded: 0,
            total: 0,
            percentage: 0,
            status: 'error',
            message: error.message || 'Upload failed',
          });
          setResult(error);
        }
      });

      xhr.addEventListener('error', () => {
        setProgress({
          loaded: 0,
          total: 0,
          percentage: 0,
          status: 'error',
          message: 'Network error. Please try again.',
        });
      });

      xhr.open('POST', '/api/folder-upload');
      xhr.send(formData);

    } catch (error) {
      setProgress({
        loaded: 0,
        total: 0,
        percentage: 0,
        status: 'error',
        message: error instanceof Error ? error.message : 'Upload failed',
      });
    }
  };

  // Calculate total size
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  // Extract folder structure
  const getFolderStructure = () => {
    const folders = new Set<string>();
    files.forEach((file) => {
      const parts = file.relativePath.split('/');
      for (let i = 1; i < parts.length; i++) {
        folders.add(parts.slice(0, i).join('/'));
      }
    });
    return Array.from(folders).sort();
  };

  const folders = getFolderStructure();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Folder Upload for n8n</h1>
            <p className="text-gray-600">
              Upload entire folders while preserving subfolder structure
            </p>
          </div>

          {/* Upload Area */}
          {progress.status === 'idle' && files.length === 0 && (
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-blue-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <FolderOpen className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">
                Drag & Drop Folder Here
              </h3>
              <p className="text-gray-600 mb-4">or</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Choose Folder
              </button>
              <input
                ref={fileInputRef}
                type="file"
                /* @ts-expect-error - webkitdirectory is not in React types */
                webkitdirectory="true"
                multiple
                onChange={handleFolderSelect}
                className="hidden"
              />
              <p className="text-xs text-gray-500 mt-4">
                Supported: JPG, PNG, WEBP, TIF, RAW formats • Max 2 GB
              </p>
            </div>
          )}

          {/* File List */}
          {files.length > 0 && progress.status === 'idle' && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-blue-900">
                      {files.length} files selected ({formatBytes(totalSize)})
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      {folders.length} folders detected
                    </p>
                  </div>
                  <button
                    onClick={() => setFiles([])}
                    className="text-blue-700 hover:text-blue-900 text-sm font-medium"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Folder Structure Preview */}
              {folders.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" />
                    Folder Structure Preview
                  </h3>
                  <div className="max-h-40 overflow-y-auto text-sm text-gray-700 font-mono">
                    {folders.slice(0, 10).map((folder) => (
                      <div key={folder} className="py-1">
                        📁 {folder}/ ({files.filter(f => f.relativePath.startsWith(folder + '/')).length} files)
                      </div>
                    ))}
                    {folders.length > 10 && (
                      <div className="py-1 text-gray-500">
                        ... and {folders.length - 10} more folders
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Metadata Form */}
              <div className="space-y-4">
                <h3 className="font-medium">Optional Information</h3>
                <input
                  type="email"
                  placeholder="Your email (optional)"
                  value={metadata.uploaderEmail || ''}
                  onChange={(e) => setMetadata({ ...metadata, uploaderEmail: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="Shoot/Project name (optional)"
                  value={metadata.shootName || ''}
                  onChange={(e) => setMetadata({ ...metadata, shootName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <textarea
                  placeholder="Notes (optional)"
                  value={metadata.notes || ''}
                  onChange={(e) => setMetadata({ ...metadata, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Upload Button */}
              <button
                onClick={handleUpload}
                disabled={files.length === 0}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Upload className="w-5 h-5" />
                Upload {files.length} Files
              </button>
            </div>
          )}

          {/* Progress */}
          {progress.status === 'uploading' && (
            <div className="space-y-4">
              <div className="text-center">
                <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-600 animate-spin" />
                <p className="font-medium text-lg">{progress.message}</p>
                <p className="text-gray-600 mt-2">
                  {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <p className="text-center text-gray-600">
                Sending {files.length} files to n8n webhook...
              </p>
            </div>
          )}

          {/* Success */}
          {progress.status === 'success' && result && result.ok && (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 mx-auto text-green-600" />
              <div>
                <h3 className="text-2xl font-bold text-green-900 mb-2">
                  Upload Complete!
                </h3>
                <p className="text-gray-700">
                  {result.filesProcessed} files uploaded successfully
                </p>
                {result.jobId && (
                  <p className="text-sm text-gray-600 mt-2 font-mono">
                    Job ID: {result.jobId}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setFiles([]);
                  setMetadata({});
                  setProgress({ loaded: 0, total: 0, percentage: 0, status: 'idle' });
                  setResult(null);
                }}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Upload Another Folder
              </button>
            </div>
          )}

          {/* Error */}
          {progress.status === 'error' && (
            <div className="text-center space-y-4">
              <XCircle className="w-16 h-16 mx-auto text-red-600" />
              <div>
                <h3 className="text-2xl font-bold text-red-900 mb-2">
                  Upload Failed
                </h3>
                <p className="text-gray-700">{progress.message}</p>
                {result && result.details ? (
                  <pre className="mt-4 text-left bg-red-50 p-4 rounded text-sm overflow-auto">
                    {String(JSON.stringify(result.details, null, 2))}
                  </pre>
                ) : null}
              </div>
              <button
                onClick={() => {
                  setProgress({ loaded: 0, total: 0, percentage: 0, status: 'idle' });
                  setResult(null);
                }}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Browser Compatibility Warning */}
          {typeof window !== 'undefined' && !('webkitdirectory' in document.createElement('input')) && (
            <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-900">Browser Not Fully Supported</p>
                <p className="text-yellow-700 mt-1">
                  Your browser doesn&apos;t support folder uploads. Please use Chrome, Edge, or Safari for the best experience.
                  Alternatively, you can zip your folder before uploading.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
