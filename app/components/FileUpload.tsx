
'use client';

import { useState, useRef } from 'react';

interface FileUploadProps {
  onFilesUploaded: (files: File[]) => void;
}

export default function FileUpload({ onFilesUploaded }: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type.includes('sheet') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    );
    
    if (droppedFiles.length > 0) {
      const newFiles = [...files, ...droppedFiles];
      setFiles(newFiles);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const newFiles = [...files, ...selectedFiles];
      setFiles(newFiles);
    }
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
  };

  const handleContinue = () => {
    if (files.length > 0) {
      onFilesUploaded(files);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
      <h2 className="text-xl font-semibold text-slate-900 mb-6">Загрузите Excel файлы</h2>
      
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          dragActive 
            ? 'border-slate-400 bg-slate-50' 
            : 'border-slate-300 hover:border-slate-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="ri-file-excel-2-line text-2xl text-slate-600"></i>
        </div>
        <p className="text-lg text-slate-700 mb-2">Перетащите файлы сюда</p>
        <p className="text-sm text-slate-500 mb-4">или</p>
        <button
          onClick={handleFileButtonClick}
          className="bg-slate-600 text-white px-6 py-2 rounded-md hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer"
        >
          Выберите файлы
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xlsx,.xls"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-slate-900 mb-4">Загруженные файлы ({files.length})</h3>
          <div className="space-y-3">
            {files.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center">
                  <i className="ri-file-excel-2-fill text-green-600 text-xl mr-3"></i>
                  <div>
                    <p className="font-medium text-slate-900">{file.name}</p>
                    <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                >
                  <i className="ri-close-line text-lg"></i>
                </button>
              </div>
            ))}
          </div>
          
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleContinue}
              className="bg-slate-600 text-white px-6 py-2 rounded-md hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              Продолжить ({files.length} файлов)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
