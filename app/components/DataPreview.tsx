
'use client';

import { useState, useEffect } from 'react';
import { ProcessedData } from '../types/excel';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface DataPreviewProps {
  processedData: ProcessedData[];
  mergedData: any[];
  onDataMerged: (data: any[]) => void;
}

export default function DataPreview({ processedData, mergedData, onDataMerged }: DataPreviewProps) {
  const [merged, setMerged] = useState<any[]>([]);
  const [showConflicts, setShowConflicts] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [conflictResolutionRules, setConflictResolutionRules] = useState<{[key: string]: 'existing' | 'new' | 'newest' | 'most_complete'}>([]);
  const [autoResolveEnabled, setAutoResolveEnabled] = useState(false);
  const [resolutionStats, setResolutionStats] = useState<{[key: string]: number}>([]);

  const standardColumns = [
    { key: 'phone', label: 'Телефон' },
    { key: 'name', label: 'ФИО' },
    { key: 'operator', label: 'Оператор' },
    { key: 'region', label: 'Регион' },
    { key: 'time', label: 'Время' },
    { key: 'birth', label: 'Дата рождения/Возраст' },
    { key: 'personal', label: 'Личные данные' }
  ];

  useEffect(() => {
    mergeData();
  }, [processedData]);

  const mergeData = () => {
    const mergedRows: any[] = [];
    const conflictRows: any[] = [];

    processedData.forEach(fileData => {
      fileData.data.forEach(row => {
        const mappedRow: any = { _source: fileData.fileName };

        Object.keys(fileData.mappings).forEach(originalColumn => {
          const standardColumn = fileData.mappings[originalColumn];
          if (standardColumn) {
            mappedRow[standardColumn] = row[originalColumn];
          }
        });

        const existingRowIndex = mergedRows.findIndex(existing => 
          existing.phone === mappedRow.phone && mappedRow.phone
        );

        if (existingRowIndex >= 0 && mappedRow.phone) {
          const existing = mergedRows[existingRowIndex];
          const conflict = {
            phone: mappedRow.phone,
            existing: existing,
            new: mappedRow,
            resolved: false,
            autoResolved: false,
            resolutionReason: ''
          };

          // Попытка автоматического разрешения конфликта
          if (autoResolveEnabled) {
            const resolution = autoResolveConflict(existing, mappedRow);
            if (resolution) {
              if (resolution.action === 'use_new') {
                mergedRows[existingRowIndex] = mappedRow;
              }
              conflict.resolved = true;
              conflict.autoResolved = true;
              conflict.resolutionReason = resolution.reason;

              // Обновляем статистику
              setResolutionStats(prev => ({
                ...prev,
                [resolution.rule]: (prev[resolution.rule] || 0) + 1
              }));
            }
          }

          conflictRows.push(conflict);
        } else {
          mergedRows.push(mappedRow);
        }
      });
    });

    setMerged(mergedRows);
    setConflicts(conflictRows);
    onDataMerged(mergedRows);
  };

  const autoResolveConflict = (existing: any, newRow: any) => {
    // Правило 1: Выбираем более полную запись
    const existingFields = Object.values(existing).filter(v => v && v !== '-' && v !== '').length;
    const newFields = Object.values(newRow).filter(v => v && v !== '-' && v !== '').length;

    if (newFields > existingFields + 2) {
      return {
        action: 'use_new',
        reason: 'Новая запись более полная',
        rule: 'most_complete'
      };
    }

    if (existingFields > newFields + 2) {
      return {
        action: 'use_existing',
        reason: 'Существующая запись более полная',
        rule: 'most_complete'
      };
    }

    // Правило 2: Проверяем качество данных
    const existingQuality = calculateDataQuality(existing);
    const newQuality = calculateDataQuality(newRow);

    if (newQuality > existingQuality + 0.2) {
      return {
        action: 'use_new',
        reason: 'Новая запись имеет лучшее качество данных',
        rule: 'best_quality'
      };
    }

    // Правило 3: Приоритет по источнику (если есть настройки)
    const sourcePriority = getSourcePriority(existing._source, newRow._source);
    if (sourcePriority) {
      return sourcePriority;
    }

    // Правило 4: Выбираем более новую запись (по порядку файлов)
    const existingFileIndex = processedData.findIndex(f => f.fileName === existing._source);
    const newFileIndex = processedData.findIndex(f => f.fileName === newRow._source);

    if (newFileIndex > existingFileIndex) {
      return {
        action: 'use_new',
        reason: 'Более новый файл-источник',
        rule: 'newest_source'
      };
    }

    return null;
  };

  const calculateDataQuality = (row: any) => {
    let quality = 0;
    const fields = ['phone', 'name', 'operator', 'region', 'time', 'birth', 'personal'];

    fields.forEach(field => {
      const value = row[field];
      if (value && value !== '-' && value !== '') {
        quality += 1;

        // Дополнительные баллы за качество данных
        if (field === 'phone' && /^\\+?\d{10,15}$/.test(value.toString())) {
          quality += 0.5; // Валидный телефон
        }
        if (field === 'name' && value.toString().split(' ').length >= 2) {
          quality += 0.3; // Полное имя
        }
        if (field === 'time' && value.toString().length > 5) {
          quality += 0.2; // Детальное время
        }
      }
    });

    return quality / fields.length;
  };

  const getSourcePriority = (existingSource: string, newSource: string) => {
    // Можно добавить логику приоритета источников
    const prioritySources = ['main', 'primary', 'основной'];
    const existingPriority = prioritySources.some(p => existingSource.toLowerCase().includes(p));
    const newPriority = prioritySources.some(p => newSource.toLowerCase().includes(p));

    if (newPriority && !existingPriority) {
      return {
        action: 'use_new',
        reason: 'Приоритетный источник',
        rule: 'source_priority'
      };
    }

    return null;
  };

  const learnFromResolution = (phone: string, resolution: 'existing' | 'new') => {
    const key = `phone_${phone.substring(0, 3)}`;
    setConflictResolutionRules(prev => ({
      ...prev,
      [key]: resolution
    }));
  };

  const resolveConflict = (index: number, useExisting: boolean) => {
    const conflict = conflicts[index];

    // Изучаем решение пользователя
    learnFromResolution(conflict.phone, useExisting ? 'existing' : 'new');

    if (!useExisting) {
      const existingIndex = merged.findIndex(row => row.phone === conflict.phone);
      if (existingIndex >= 0) {
        const newMerged = [...merged];
        newMerged[existingIndex] = conflict.new;
        setMerged(newMerged);
        onDataMerged(newMerged);
      }
    }
    // If useExisting is true, we keep the existing record (no changes needed to merged data)

    const newConflicts = [...conflicts];
    newConflicts[index].resolved = true;
    setConflicts(newConflicts);
  };

  const applySmartResolution = () => {
    const unresolvedConflicts = conflicts.filter(c => !c.resolved);
    let resolvedCount = 0;

    unresolvedConflicts.forEach((conflict, index) => {
      const actualIndex = conflicts.findIndex(c => c.phone === conflict.phone && !c.resolved);
      if (actualIndex >= 0) {
        const resolution = autoResolveConflict(conflict.existing, conflict.new);
        if (resolution) {
          resolveConflict(actualIndex, resolution.action === 'use_existing');
          resolvedCount++;
        }
      }
    });

    setAutoResolveEnabled(true);
    mergeData(); // Повторно обрабатываем данные с включенным авто-разрешением
  };

  const resetAutoResolution = () => {
    setAutoResolveEnabled(false);
    setConflictResolutionRules({});
    setResolutionStats({});
    mergeData();
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(merged);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Merged Data');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    saveAs(blob, `merged_data_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getRuleDescription = (rule: string) => {
    const descriptions: {[key: string]: string} = {
      'most_complete': 'по полноте данных',
      'best_quality': 'по качеству данных',
      'source_priority': 'по приоритету источника',
      'newest_source': 'по новизне источника'
    };
    return descriptions[rule] || rule;
  };

  const unresolvedConflicts = conflicts.filter(c => !c.resolved);
  const autoResolvedConflicts = conflicts.filter(c => c.autoResolved);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-900">Предварительный просмотр объединенных данных</h2>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-slate-600">Всего записей: {merged.length}</span>
            {conflicts.length > 0 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowConflicts(!showConflicts)}
                  className="text-sm text-yellow-600 hover:text-yellow-700 flex items-center whitespace-nowrap"
                >
                  <i className="ri-alert-line mr-1"></i>
                  Конфликты: {unresolvedConflicts.length}
                </button>
                {autoResolvedConflicts.length > 0 && (
                  <span className="text-sm text-green-600">
                    <i className="ri-check-circle-line mr-1"></i>
                    Авто-разрешено: {autoResolvedConflicts.length}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Статистика умного разрешения */}
        {autoResolveEnabled && Object.keys(resolutionStats).length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-blue-900 mb-2">Статистика умного разрешения</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {Object.entries(resolutionStats).map(([rule, count]) => (
                <div key={rule} className="text-blue-700">
                  <span className="font-medium">{count}</span> - {getRuleDescription(rule)}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                {standardColumns.map(col => (
                  <th key={col.key} className="text-left py-3 px-4 font-medium text-slate-700">
                    {col.label}
                  </th>
                ))}
                <th className="text-left py-3 px-4 font-medium text-slate-700">Источник</th>
              </tr>
            </thead>
            <tbody>
              {merged.slice(0, 100).map((row, index) => (
                <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                  {standardColumns.map(col => (
                    <td key={col.key} className="py-3 px-4 text-slate-600">
                      {row[col.key] || '-'}
                    </td>
                  ))}
                  <td className="py-3 px-4 text-slate-500 text-xs">
                    {row._source}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {merged.length > 100 && (
          <div className="mt-4 text-center text-slate-500 text-sm">
            Показаны первые 100 записей из {merged.length}
          </div>
        )}
      </div>

      {showConflicts && conflicts.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Разрешение конфликтов</h3>
            <div className="flex items-center space-x-2">
              {unresolvedConflicts.length > 0 && (
                <button
                  onClick={applySmartResolution}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm whitespace-nowrap"
                >
                  <i className="ri-brain-line mr-2"></i>
                  Умное разрешение
                </button>
              )}
              {autoResolveEnabled && (
                <button
                  onClick={resetAutoResolution}
                  className="bg-slate-600 text-white px-4 py-2 rounded-md hover:bg-slate-700 transition-colors text-sm whitespace-nowrap"
                >
                  <i className="ri-refresh-line mr-2"></i>
                  Сбросить авто-разрешение
                </button>
              )}
            </div>
          </div>

          {/* Автоматически разрешенные конфликты */}
          {autoResolvedConflicts.length > 0 && (
            <div className="mb-6">
              <h4 className="text-md font-medium text-slate-900 mb-3">
                Автоматически разрешенные конфликты ({autoResolvedConflicts.length})
              </h4>
              <div className="bg-green-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                <div className="space-y-2">
                  {autoResolvedConflicts.map((conflict, index) => (
                    <div key={`auto-resolved-${conflict.phone}-${index}`} className="flex items-center justify-between py-2 px-3 bg-white rounded border border-green-200">
                      <div className="flex items-center space-x-3">
                        <i className="ri-check-circle-line text-green-600"></i>
                        <span className="text-sm font-medium text-slate-900">{conflict.phone}</span>
                        <span className="text-xs text-slate-500">({conflict.existing._source} → {conflict.new._source})</span>
                      </div>
                      <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded">
                        {conflict.resolutionReason}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Неразрешенные конфликты */}
          {unresolvedConflicts.length > 0 && (
            <div>
              <h4 className="text-md font-medium text-slate-900 mb-3">
                Требуют ручного разрешения ({unresolvedConflicts.length})
              </h4>
              <div className="space-y-4">
                {unresolvedConflicts.map((conflict, index) => {
                  const actualIndex = conflicts.findIndex(c => c.phone === conflict.phone && !c.resolved);
                  return (
                    <div key={`unresolved-${conflict.phone}-${actualIndex}`} className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium text-slate-900">
                          Конфликт для телефона: {conflict.phone}
                        </h5>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => resolveConflict(actualIndex, true)}
                            className="px-3 py-1 bg-slate-600 text-white text-sm rounded hover:bg-slate-700 whitespace-nowrap"
                          >
                            Оставить существующий
                          </button>
                          <button
                            onClick={() => resolveConflict(actualIndex, false)}
                            className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 whitespace-nowrap"
                          >
                            Использовать новый
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h6 className="text-sm font-medium text-slate-700 mb-2">Существующая запись:</h6>
                          <div className="text-sm text-slate-600 space-y-1">
                            <div>ФИО: {conflict.existing.name || '-'}</div>
                            <div>Оператор: {conflict.existing.operator || '-'}</div>
                            <div>Регион: {conflict.existing.region || '-'}</div>
                            <div>Источник: {conflict.existing._source}</div>
                            <div className="text-xs text-slate-500">
                              Полнота: {Math.round(calculateDataQuality(conflict.existing) * 100)}%
                            </div>
                          </div>
                        </div>
                        <div>
                          <h6 className="text-sm font-medium text-slate-700 mb-2">Новая запись:</h6>
                          <div className="text-sm text-slate-600 space-y-1">
                            <div>ФИО: {conflict.new.name || '-'}</div>
                            <div>Оператор: {conflict.new.operator || '-'}</div>
                            <div>Регион: {conflict.new.region || '-'}</div>
                            <div>Источник: {conflict.new._source}</div>
                            <div className="text-xs text-slate-500">
                              Полнота: {Math.round(calculateDataQuality(conflict.new) * 100)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={exportToExcel}
          className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors flex items-center whitespace-nowrap"
        >
          <i className="ri-download-line mr-2"></i>
          Скачать Excel файл
        </button>
      </div>
    </div>
  );
}
