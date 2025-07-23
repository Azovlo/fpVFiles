
'use client';

import { useState } from 'react';
import FileUpload from './FileUpload';
import DataPreview from './DataPreview';
import MergeSettings from './MergeSettings';
import { ProcessedData } from '../types/excel';

export default function ExcelMerger() {
  const [files, setFiles] = useState<File[]>([]);
  const [processedData, setProcessedData] = useState<ProcessedData[]>([]);
  const [mergedData, setMergedData] = useState<any[]>([]);
  const [currentStep, setCurrentStep] = useState(1);

  const handleFilesUploaded = (uploadedFiles: File[]) => {
    setFiles(uploadedFiles);
    setCurrentStep(2);
  };

  const handleDataProcessed = (data: ProcessedData[]) => {
    setProcessedData(data);
    setCurrentStep(3);
  };

  const handleDataMerged = (data: any[]) => {
    setMergedData(data);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-slate-600 text-white px-6 py-4">
        <h1 className="text-2xl font-bold">Excel Merger Pro</h1>
        <p className="text-slate-300 mt-1">Интеллектуальное объединение Excel файлов</p>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center mb-8">
          <div className="flex space-x-4">
            <StepIndicator step={1} currentStep={currentStep} title="Загрузка файлов" />
            <StepIndicator step={2} currentStep={currentStep} title="Настройка" />
            <StepIndicator step={3} currentStep={currentStep} title="Предварительный просмотр" />
          </div>
        </div>

        {currentStep === 1 && (
          <FileUpload onFilesUploaded={handleFilesUploaded} />
        )}

        {currentStep === 2 && (
          <MergeSettings 
            files={files} 
            onDataProcessed={handleDataProcessed}
            onNext={() => setCurrentStep(3)}
          />
        )}

        {currentStep === 3 && (
          <DataPreview 
            processedData={processedData}
            mergedData={mergedData}
            onDataMerged={handleDataMerged}
          />
        )}
      </div>
    </div>
  );
}

interface StepIndicatorProps {
  step: number;
  currentStep: number;
  title: string;
}

function StepIndicator({ step, currentStep, title }: StepIndicatorProps) {
  const isActive = step === currentStep;
  const isCompleted = step < currentStep;

  return (
    <div className="flex items-center">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
        isActive 
          ? 'bg-slate-600 text-white' 
          : isCompleted 
          ? 'bg-green-600 text-white' 
          : 'bg-slate-200 text-slate-500'
      }`}>
        {isCompleted ? '✓' : step}
      </div>
      <span className={`ml-2 text-sm ${
        isActive ? 'text-slate-900 font-medium' : 'text-slate-600'
      }`}>
        {title}
      </span>
      {step < 3 && <div className="w-12 h-0.5 bg-slate-300 mx-4" />}
    </div>
  );
}
