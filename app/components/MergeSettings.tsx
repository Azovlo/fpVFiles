
'use client';

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { ProcessedData } from '../types/excel';

interface MergeSettingsProps {
  files: File[];
  onDataProcessed: (data: ProcessedData[]) => void;
  onNext: () => void;
}

export default function MergeSettings({ files, onDataProcessed, onNext }: MergeSettingsProps) {
  const [processedData, setProcessedData] = useState<ProcessedData[]>([]);
  const [columnMappings, setColumnMappings] = useState<{ [key: string]: string }>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [learnedPatterns, setLearnedPatterns] = useState<{ [key: string]: string }>({});
  const [autoMappingEnabled, setAutoMappingEnabled] = useState(false);
  const [manualFilesCount, setManualFilesCount] = useState(5);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);

  const standardColumns = [
    { key: 'phone', label: 'Телефон', icon: 'ri-phone-line' },
    { key: 'name', label: 'ФИО', icon: 'ri-user-line' },
    { key: 'operator', label: 'Оператор', icon: 'ri-building-line' },
    { key: 'region', label: 'Регион', icon: 'ri-map-pin-line' },
    { key: 'time', label: 'Время', icon: 'ri-time-line' },
    { key: 'birth', label: 'Дата рождения/Возраст', icon: 'ri-calendar-line' },
    { key: 'personal', label: 'Личные данные', icon: 'ri-shield-user-line' }
  ];

  useEffect(() => {
    processFiles();
  }, [files]);

  const processFiles = async () => {
    setIsProcessing(true);
    const processed: ProcessedData[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const data = await readFile(file);
      const analyzed = analyzeData(data, file.name, i);
      processed.push(analyzed);
    }

    setProcessedData(processed);
    setIsProcessing(false);
  };

  const readFile = (file: File): Promise<any[]> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        resolve(jsonData);
      };
      reader.readAsBinaryString(file);
    });
  };

  const analyzeData = (data: any[], fileName: string, fileIndex: number): ProcessedData => {
    const columns = data.length > 0 ? Object.keys(data[0]) : [];
    const mappings: { [key: string]: string } = {};

    columns.forEach(column => {
      const lowerColumn = column.toLowerCase();
      
      // Если автоматическое сопоставление включено и это не один из первых файлов
      if (autoMappingEnabled && fileIndex >= manualFilesCount) {
        const learnedMapping = findLearnedMapping(column);
        if (learnedMapping) {
          mappings[column] = learnedMapping;
          return;
        }
      }

      // Базовая логика анализа
      if (lowerColumn.includes('телефон') || lowerColumn.includes('phone')) {
        mappings[column] = 'phone';
      } else if (lowerColumn.includes('фио') || lowerColumn.includes('имя') || lowerColumn.includes('name')) {
        mappings[column] = 'name';
      } else if (lowerColumn.includes('оператор') || lowerColumn.includes('operator')) {
        mappings[column] = 'operator';
      } else if (lowerColumn.includes('регион') || lowerColumn.includes('region')) {
        mappings[column] = 'region';
      } else if (lowerColumn.includes('время') || lowerColumn.includes('time')) {
        mappings[column] = 'time';
      } else if (lowerColumn.includes('возраст') || lowerColumn.includes('рожден') || lowerColumn.includes('birth')) {
        mappings[column] = 'birth';
      } else if (lowerColumn.includes('паспорт') || lowerColumn.includes('личн') || lowerColumn.includes('personal')) {
        mappings[column] = 'personal';
      }
    });

    return {
      fileName,
      data,
      columns,
      mappings,
      rowCount: data.length
    };
  };

  const findLearnedMapping = (columnName: string): string | null => {
    const lowerColumn = columnName.toLowerCase();
    
    // Точное совпадение
    if (learnedPatterns[lowerColumn]) {
      return learnedPatterns[lowerColumn];
    }
    
    // Поиск по частичному совпадению
    for (const [pattern, mapping] of Object.entries(learnedPatterns)) {
      if (lowerColumn.includes(pattern) || pattern.includes(lowerColumn)) {
        return mapping;
      }
    }
    
    return null;
  };

  const updateMapping = (fileName: string, originalColumn: string, standardColumn: string) => {
    setProcessedData(prev => 
      prev.map(item => 
        item.fileName === fileName 
          ? { ...item, mappings: { ...item.mappings, [originalColumn]: standardColumn } }
          : item
      )
    );
  };

  const learnFromMappings = () => {
    const newPatterns: { [key: string]: string } = { ...learnedPatterns };
    
    processedData.slice(0, manualFilesCount).forEach(fileData => {
      Object.entries(fileData.mappings).forEach(([originalColumn, standardColumn]) => {
        if (standardColumn) {
          const lowerColumn = originalColumn.toLowerCase();
          newPatterns[lowerColumn] = standardColumn;
          
          // Добавляем ключевые слова из названия колонки
          const words = lowerColumn.split(/[\s_-]+/);
          words.forEach(word => {
            if (word.length > 2) {
              newPatterns[word] = standardColumn;
            }
          });
        }
      });
    });
    
    setLearnedPatterns(newPatterns);
    setAutoMappingEnabled(true);
    
    // Применяем выученные паттерны к оставшимся файлам
    applyLearnedPatterns(newPatterns);
  };

  const applyLearnedPatterns = (patterns: { [key: string]: string }) => {
    setProcessedData(prev => 
      prev.map((item, index) => {
        if (index < manualFilesCount) return item;
        
        const newMappings: { [key: string]: string } = {};
        item.columns.forEach(column => {
          const lowerColumn = column.toLowerCase();
          
          // Точное совпадение
          if (patterns[lowerColumn]) {
            newMappings[column] = patterns[lowerColumn];
            return;
          }
          
          // Поиск по частичному совпадению
          for (const [pattern, mapping] of Object.entries(patterns)) {
            if (lowerColumn.includes(pattern) || pattern.includes(lowerColumn)) {
              newMappings[column] = mapping;
              break;
            }
          }
        });
        
        return { ...item, mappings: newMappings };
      })
    );
  };

  const handleContinue = () => {
    onDataProcessed(processedData);
    onNext();
  };

  const resetAutoMapping = () => {
    setAutoMappingEnabled(false);
    setLearnedPatterns({});
    // Сбрасываем маппинги для файлов после manualFilesCount
    setProcessedData(prev => 
      prev.map((item, index) => {
        if (index < manualFilesCount) return item;
        const resetMappings = analyzeData(item.data, item.fileName, index);
        return { ...item, mappings: resetMappings.mappings };
      })
    );
  };

  if (isProcessing) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin mr-4"></div>
          <p className="text-slate-600">Анализ файлов...</p>
        </div>
      </div>
    );
  }

  const manualFiles = processedData.slice(0, manualFilesCount);
  const autoFiles = processedData.slice(manualFilesCount);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Настройка сопоставления столбцов</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm text-slate-600">Обучить на первых:</label>
            <input
              type="number"
              value={manualFilesCount}
              onChange={(e) => setManualFilesCount(Math.max(1, parseInt(e.target.value) || 5))}
              className="w-16 px-2 py-1 border border-slate-300 rounded text-sm"
              min="1"
              max="50"
            />
            <span className="text-sm text-slate-600">файлах</span>
          </div>
          {!autoMappingEnabled && manualFiles.length > 0 && (
            <button
              onClick={learnFromMappings}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm whitespace-nowrap"
            >
              <i className="ri-brain-line mr-2"></i>
              Обучить систему
            </button>
          )}
          {autoMappingEnabled && (
            <button
              onClick={resetAutoMapping}
              className="bg-slate-600 text-white px-4 py-2 rounded-md hover:bg-slate-700 transition-colors text-sm whitespace-nowrap"
            >
              <i className="ri-refresh-line mr-2"></i>
              Сбросить обучение
            </button>
          )}
        </div>
      </div>

      {autoMappingEnabled && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <i className="ri-check-circle-line text-green-600 mr-2"></i>
            <span className="text-green-800 font-medium">Автоматическое сопоставление активно</span>
          </div>
          <p className="text-green-700 text-sm mt-1">
            Система обучена на {manualFilesCount} файлах и автоматически сопоставляет столбцы для оставшихся {autoFiles.length} файлов.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Файлы для ручной настройки */}
        {manualFiles.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Файлы для ручной настройки ({manualFiles.length})
            </h3>
            <div className="space-y-4">
              {manualFiles.map((fileData, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-medium text-slate-900">{fileData.fileName}</h4>
                    <span className="text-sm text-slate-500">{fileData.rowCount} строк</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {fileData.columns.map((column, colIndex) => (
                      <div key={colIndex} className="flex items-center space-x-3">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            {column}
                          </label>
                          <select
                            value={fileData.mappings[column] || ''}
                            onChange={(e) => updateMapping(fileData.fileName, column, e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                          >
                            <option value="">Не сопоставлять</option>
                            {standardColumns.map(stdCol => (
                              <option key={stdCol.key} value={stdCol.key}>
                                {stdCol.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {fileData.mappings[column] && (
                          <div className="w-8 h-8 flex items-center justify-center">
                            <i className={`${standardColumns.find(col => col.key === fileData.mappings[column])?.icon} text-green-600`}></i>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Файлы с автоматическим сопоставлением */}
        {autoFiles.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Файлы с автоматическим сопоставлением ({autoFiles.length})
              {autoMappingEnabled && <span className="text-green-600 ml-2">✓</span>}
            </h3>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {autoFiles.map((fileData, index) => (
                  <div key={index} className="bg-white rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium text-slate-900 truncate">{fileData.fileName}</h5>
                      <span className="text-xs text-slate-500">{fileData.rowCount} строк</span>
                    </div>
                    <div className="space-y-1">
                      {Object.entries(fileData.mappings).map(([column, mapping]) => (
                        mapping && (
                          <div key={column} className="flex items-center text-xs">
                            <i className={`${standardColumns.find(col => col.key === mapping)?.icon} text-green-600 mr-1`}></i>
                            <span className="text-slate-600 truncate">{column}</span>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleContinue}
          className="bg-slate-600 text-white px-6 py-2 rounded-md hover:bg-slate-700 transition-colors whitespace-nowrap"
        >
          Продолжить к предварительному просмотру
        </button>
      </div>
    </div>
  );
}
