import { useEffect, useMemo, useState } from 'react';
import { Pagination } from './Pagination';

export interface TableColumn {
  key: string;
  label: string;
}

interface TableModalProps {
  isOpen: boolean;
  title: string;
  rows: Array<Record<string, string | number | null | undefined>>;
  columns: TableColumn[];
  onClose: () => void;
  pageSize?: number;
}

export function TableModal({
  isOpen,
  title,
  rows,
  columns,
  onClose,
  pageSize = 12,
}: TableModalProps) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (isOpen) {
      setPage(1);
    }
  }, [isOpen, title]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} className="rounded px-2 py-1 text-gray-600 hover:bg-gray-100">
            Close
          </button>
        </div>

        <div className="overflow-auto p-4">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className="border-b bg-gray-50 px-3 py-2 text-left font-semibold text-gray-700">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, idx) => (
                <tr key={`${title}-${idx}`} className="odd:bg-white even:bg-gray-50">
                  {columns.map((c) => (
                    <td key={`${idx}-${c.key}`} className="border-b px-3 py-2 align-top text-gray-800">
                      {row[c.key] ?? '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {rows.length === 0 && <p className="py-8 text-center text-gray-500">No data found.</p>}

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
