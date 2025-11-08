'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, FolderOpen, Loader2, XCircle, AlertCircle, X } from 'lucide-react';
import {
  processDroppedItems,
  processFileInput,
  validateFiles,
  createFormData,
  formatBytes,
  supportsFileSystemAPI,
  type FileWithPath,
} from '@/lib/folder-drop';

export default function Home() {
  const [files, setFiles] = useState<FileWithPath[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ files: 0, bytes: 0 });
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Metadata state
  const [uploaderEmail, setUploaderEmail] = useState('');
  const [shootName, setShootName] = useState('');
  const [notes, setNotes] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const supportsFileSystem = supportsFileSystemAPI();

  // Prevent default drag/drop behavior on the entire document
  useEffect(() => {
    const preventDefaults = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // Prevent browser from navigating when files are dropped outside the drop zone
    document.addEventListener('dragenter', preventDefaults);
    document.addEventListener('dragover', preventDefaults);
    document.addEventListener('dragleave', preventDefaults);
    document.addEventListener('drop', preventDefaults);

    return () => {
      document.removeEventListener('dragenter', preventDefaults);
      document.removeEventListener('dragover', preventDefaults);
      document.removeEventListener('dragleave', preventDefaults);
      document.removeEventListener('drop', preventDefaults);
    };
  }, []);

  // Handle drag events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (uploading) return;

    setErrors([]);
    setWarnings([]);
    setProgress({ files: 0, bytes: 0 });

    try {
      const items = e.dataTransfer.items;

      if (!items || items.length === 0) {
        setErrors(['No items detected in drop']);
        return;
      }

      // Process dropped items
      const processedFiles = await processDroppedItems(
        items,
        (filesDiscovered, bytesDiscovered) => {
          setProgress({ files: filesDiscovered, bytes: bytesDiscovered });
        }
      );

      // Validate files
      const validation = validateFiles(processedFiles);

      if (!validation.valid) {
        setErrors(validation.errors);
        setWarnings(validation.warnings || []);
        return;
      }

      setFiles(processedFiles);
      setWarnings(validation.warnings || []);
    } catch (error) {
      console.error('Drop error:', error);
      setErrors([error instanceof Error ? error.message : 'Failed to process drop']);
    }
  };

  // Handle folder picker
  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (uploading) return;

    setErrors([]);
    setWarnings([]);
    setProgress({ files: 0, bytes: 0 });

    const fileList = e.target.files;

    if (!fileList || fileList.length === 0) {
      setErrors(['No files selected']);
      return;
    }

    try {
      // Process files
      const processedFiles = processFileInput(
        fileList,
        (filesDiscovered, bytesDiscovered) => {
          setProgress({ files: filesDiscovered, bytes: bytesDiscovered });
        }
      );

      // Validate files
      const validation = validateFiles(processedFiles);

      if (!validation.valid) {
        setErrors(validation.errors);
        setWarnings(validation.warnings || []);
        return;
      }

      setFiles(processedFiles);
      setWarnings(validation.warnings || []);
    } catch (error) {
      console.error('Folder select error:', error);
      setErrors([error instanceof Error ? error.message : 'Failed to process folder']);
    }
  };

  // Handle upload
  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setErrors([]);

    // Create abort controller
    abortControllerRef.current = new AbortController();

    try {
      // Create FormData with all files
      const formData = createFormData(files, {
        uploaderEmail: uploaderEmail || undefined,
        shootName: shootName || undefined,
        notes: notes || undefined,
      });

      // Upload to API (forwards to n8n)
      const response = await fetch('/api/folder-upload', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Upload failed');
      }

      // Success
      alert(`Successfully uploaded ${data.fileCount || files.length} files!`);

      // Clear state
      setFiles([]);
      setProgress({ files: 0, bytes: 0 });
      setUploaderEmail('');
      setShootName('');
      setNotes('');

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setErrors(['Upload cancelled']);
      } else {
        console.error('Upload error:', error);
        setErrors([error instanceof Error ? error.message : 'Upload failed']);
      }
    } finally {
      setUploading(false);
      abortControllerRef.current = null;
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Clear all
  const handleClear = () => {
    setFiles([]);
    setProgress({ files: 0, bytes: 0 });
    setErrors([]);
    setWarnings([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-2 text-center">
            Folder Upload
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Upload entire folders with nested structure preserved
          </p>

          {/* Browser compatibility warning */}
          {!supportsFileSystem && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Limited drag-and-drop support</p>
                <p className="mt-1">
                  Your browser doesn&apos;t fully support folder drag-and-drop.
                  Please use the &quot;Select Folder&quot; button instead, or consider
                  using Chrome, Edge, or Safari for full drag-and-drop functionality.
                </p>
              </div>
            </div>
          )}

          {/* Drop Zone */}
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDrag}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-12 text-center mb-6 transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            } ${uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
          >
            {supportsFileSystem && (
              <>
                <FolderOpen className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium text-gray-700 mb-2">
                  Drag and drop a folder here
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  All files in nested folders will be uploaded
                </p>
              </>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Select Folder
            </button>

            <input
              ref={fileInputRef}
              type="file"
              // @ts-expect-error - webkitdirectory is not in TypeScript types
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleFolderSelect}
              className="hidden"
              disabled={uploading}
            />
          </div>

          {/* Metadata Inputs */}
          <div className="space-y-4 mb-6">
            <div>
              <label htmlFor="uploaderEmail" className="block text-sm font-medium text-gray-700 mb-1">
                Uploader Email (optional)
              </label>
              <input
                id="uploaderEmail"
                type="email"
                value={uploaderEmail}
                onChange={(e) => setUploaderEmail(e.target.value)}
                disabled={uploading}
                placeholder="your@email.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              />
            </div>

            <div>
              <label htmlFor="shootName" className="block text-sm font-medium text-gray-700 mb-1">
                Shoot Name (optional)
              </label>
              <input
                id="shootName"
                type="text"
                value={shootName}
                onChange={(e) => setShootName(e.target.value)}
                disabled={uploading}
                placeholder="Wedding Photos 2024"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={uploading}
                placeholder="Additional notes..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 resize-none"
              />
            </div>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800 mb-2">
                    {errors.length} {errors.length === 1 ? 'Error' : 'Errors'}
                  </p>
                  <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                    {errors.slice(0, 10).map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                    {errors.length > 10 && (
                      <li className="text-red-600">...and {errors.length - 10} more</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-800 mb-2">
                    {warnings.length} {warnings.length === 1 ? 'Warning' : 'Warnings'}
                  </p>
                  <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                    {warnings.slice(0, 5).map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                    {warnings.length > 5 && (
                      <li className="text-yellow-600">...and {warnings.length - 5} more</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Progress / File Summary */}
          {files.length > 0 && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    {files.length} files ready ({formatBytes(progress.bytes)})
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    All nested folder structures will be preserved
                  </p>
                </div>
                {!uploading && (
                  <button
                    onClick={handleClear}
                    className="text-blue-600 hover:text-blue-800 p-1"
                    title="Clear all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Uploading {files.length} files...
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Please wait, this may take a while for large folders
                  </p>
                </div>
                <button
                  onClick={handleCancel}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Upload Button */}
          {files.length > 0 && !uploading && (
            <button
              onClick={handleUpload}
              className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg font-medium text-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Upload className="w-6 h-6" />
              Upload {files.length} {files.length === 1 ? 'File' : 'Files'}
            </button>
          )}

          {/* Help Text */}
          {files.length === 0 && !uploading && (
            <div className="text-center text-gray-500 text-sm py-8">
              <p className="mb-2">Supported formats: JPG, PNG, WEBP, TIF, CR2, NEF, ARW, RAF, ORF, RW2</p>
              <p className="text-xs">Max 500 MB per file • Max 2 GB total • Max 20,000 files</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
