import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Transaction } from '../types';
import { cn } from '../lib/utils';

interface SpreadsheetUploadProps {
  onDataParsed: (transactions: Omit<Transaction, 'id' | 'userId' | 'createdAt'>[]) => void;
  onClose: () => void;
}

export const SpreadsheetUpload: React.FC<SpreadsheetUploadProps> = ({ onDataParsed, onClose }) => {
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setError(null);
    setSuccess(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const parsedTransactions: Omit<Transaction, 'id' | 'userId' | 'createdAt'>[] = [];

        data.forEach((row, index) => {
          // Attempt to find keys regardless of case or specific naming
          const keys = Object.keys(row);
          const descKey = keys.find(k => k.toLowerCase().includes('desc') || k.toLowerCase().includes('item'));
          const valKey = keys.find(k => k.toLowerCase().includes('val') || k.toLowerCase().includes('quant'));
          const dateKey = keys.find(k => k.toLowerCase().includes('dat') || k.toLowerCase().includes('mês') || k.toLowerCase().includes('mes'));
          const catKey = keys.find(k => k.toLowerCase().includes('cat'));

          const amount = parseFloat(row[valKey || ''] || 0);
          if (!isNaN(amount) && descKey) {
            const dateStr = row[dateKey || ''];
            let date = new Date();
            
            if (dateStr) {
               // Handle Excel dates or string dates
               if (typeof dateStr === 'number') {
                  // Excel serial date
                  date = new Date((dateStr - 25569) * 86400 * 1000);
               } else {
                  // String date. Append T12:00:00 if it's purely a date string to avoid timezone shifts
                  let dStr = String(dateStr);
                  if (dStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                     dStr += "T12:00:00";
                  }
                  date = new Date(dStr);
               }
            }

            if (isNaN(date.getTime())) date = new Date();

            parsedTransactions.push({
              description: String(row[descKey]),
              amount: Math.abs(amount),
              type: amount >= 0 ? 'income' : 'expense',
              category: String(row[catKey || ''] || 'Importado'),
              date,
            });
          }
        });

        if (parsedTransactions.length === 0) {
          throw new Error("Nenhuma transação válida encontrada. Verifique se a planilha tem colunas de 'Descrição' e 'Valor'.");
        }

        setSuccess(parsedTransactions.length);
        setTimeout(() => {
          onDataParsed(parsedTransactions);
          onClose();
        }, 1500);

      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao ler a planilha. Verifique o formato.");
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-natural-border">
        <div className="flex items-center justify-between p-6 border-b border-natural-border bg-[#F9F9F6]">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="text-natural-accent" size={24} />
            <h2 className="text-xl font-semibold text-natural-text">Importar Planilha</h2>
          </div>
          <div className="flex items-center gap-2">
            {isParsing && <Loader2 size={20} className="animate-spin text-natural-accent" />}
            {success && <CheckCircle2 size={20} className="text-natural-income" />}
            <button 
              onClick={onClose}
              className="p-2 hover:bg-natural-border/50 rounded-full transition-colors text-natural-muted ml-2"
              title="Fechar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-8">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all",
              isParsing ? "bg-natural-bg border-natural-border pointer-events-none" : "hover:bg-[#E0D8D0] border-natural-upload-border bg-natural-bg/50"
            )}
          >
            <div className="p-4 bg-white/50 rounded-full text-[#967E67]">
              {isParsing ? <Loader2 className="animate-spin" size={32} /> : <Upload size={32} />}
            </div>
            <div className="text-center">
              <p className="font-medium text-natural-text">Clique para selecionar o arquivo</p>
              <p className="text-sm text-natural-muted mt-1">Suporta .xlsx, .xls e .csv</p>
            </div>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx,.xls,.csv"
              className="hidden" 
            />
          </div>

          {error && (
            <div className="mt-6 p-4 bg-rose-50 border border-natural-expense/20 rounded-lg flex gap-3 text-natural-expense text-sm">
              <AlertCircle className="shrink-0" size={18} />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="mt-6 p-4 bg-emerald-50 border border-natural-income/20 rounded-lg flex gap-3 text-natural-income text-sm">
              <CheckCircle2 className="shrink-0" size={18} />
              <p>Sucesso! {success} transações identificadas.</p>
            </div>
          )}

          <div className="mt-8 bg-natural-bg p-4 rounded-lg border border-natural-border">
            <h4 className="text-xs font-bold text-natural-muted uppercase tracking-wider mb-2 text-center">Dicas de Formato</h4>
            <ul className="text-xs text-natural-text/70 space-y-1 list-disc pl-4">
              <li>Colunas necessárias: "Descrição" e "Valor".</li>
              <li>Valores positivos (+) são Entradas.</li>
              <li>Valores negativos (-) são Saídas.</li>
              <li>Sincronização instantânea com a nuvem.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
