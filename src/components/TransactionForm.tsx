import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Transaction, TransactionType } from '../types';
import { cn } from '../lib/utils';

interface TransactionFormProps {
  onSubmit: (data: Omit<Transaction, 'id' | 'userId' | 'createdAt'> & { recurrenceTotal?: number }) => void;
  onClose: () => void;
  initialData?: Transaction;
  prefilledAmount?: number;
  categories?: string[];
}

export const TransactionForm: React.FC<TransactionFormProps> = ({ onSubmit, onClose, initialData, prefilledAmount, categories = [] }) => {
  const [description, setDescription] = useState(initialData?.description || '');
  const [amount, setAmount] = useState(
    initialData?.amount?.toString() || 
    prefilledAmount?.toString() || 
    ''
  );
  const [type, setType] = useState<TransactionType>(initialData?.type || 'expense');
  const [category, setCategory] = useState(initialData?.category || '');

  // Helper to format local date for input
  const getLocalDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [date, setDate] = useState(
    initialData?.date 
      ? getLocalDateString(initialData.date) 
      : getLocalDateString(new Date())
  );
  
  // Recurrence states
  const [isRecurrent, setIsRecurrent] = useState(false);
  const [isEternal, setIsEternal] = useState(false);
  const [isSubscription, setIsSubscription] = useState(initialData?.isSubscription || false);
  const [recurrenceCount, setRecurrenceCount] = useState('12');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !date) return;

    // Use noon local time to avoid timezone offset issues pushing it to adjacent days
    const [year, month, day] = date.split('-').map(Number);
    const parsedDate = new Date(year, month - 1, day, 12, 0, 0);

    onSubmit({
      description,
      amount: parseFloat(amount),
      type,
      category,
      date: parsedDate,
      isSubscription,
      ...(isRecurrent ? {
        recurrenceTotal: isEternal ? 0 : parseInt(recurrenceCount),
      } : {})
    });
    onClose();
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
          <h2 className="text-xl font-semibold text-natural-text">
            {initialData ? 'Editar Lançamento' : 'Novo Lançamento'}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-natural-border/50 rounded-full transition-colors text-natural-muted"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="flex p-1 bg-natural-bg rounded-lg">
            <button
              type="button"
              onClick={() => setType('income')}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                type === 'income' 
                  ? "bg-natural-income text-white shadow-sm" 
                  : "text-natural-muted hover:text-natural-text"
              )}
            >
              Receita
            </button>
            <button
              type="button"
              onClick={() => setType('expense')}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                type === 'expense' 
                  ? "bg-natural-expense text-white shadow-sm" 
                  : "text-natural-muted hover:text-natural-text"
              )}
            >
              Despesa
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-natural-muted mb-1">Descrição</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-natural-border bg-[#FBFAF8] text-sm focus:ring-2 focus:ring-natural-accent outline-none transition-all"
              placeholder="Ex: Supermercado, Aluguel..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-natural-muted mb-1">Valor</label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-natural-border bg-[#FBFAF8] text-sm focus:ring-2 focus:ring-natural-accent outline-none transition-all"
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-natural-muted mb-1">Data</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-natural-border bg-[#FBFAF8] text-sm focus:ring-2 focus:ring-natural-accent outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-natural-muted mb-1">Categoria (Opcional)</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              list="category-suggestions"
              className="w-full px-4 py-2.5 rounded-xl border border-natural-border bg-[#FBFAF8] text-sm focus:ring-2 focus:ring-natural-accent outline-none transition-all"
              placeholder="Ex: Alimentação, Assinatura..."
            />
            <datalist id="category-suggestions">
              {categories.map(cat => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>

          <div className="py-2 px-1">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div 
                className={cn(
                  "w-10 h-6 rounded-full transition-all relative border border-natural-border",
                  isSubscription ? "bg-natural-accent border-natural-accent" : "bg-natural-bg"
                )}
                onClick={() => setIsSubscription(!isSubscription)}
              >
                <div className={cn(
                  "absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all",
                  isSubscription ? "translate-x-4" : "translate-x-0"
                )} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-natural-text">Marcar como Assinatura</span>
                <p className="text-[10px] text-natural-muted">Opex volátil: Serviços fáceis de cancelar (Streaming, IA, Softwares)</p>
              </div>
            </label>
          </div>

          {/* Recurrence Section */}
          {!initialData && (
            <div className="pt-4 border-t border-natural-border mt-4">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={isRecurrent} 
                  onChange={(e) => setIsRecurrent(e.target.checked)}
                  className="w-4 h-4 rounded border-natural-border text-natural-accent focus:ring-natural-accent"
                />
                <span className="text-sm font-semibold text-natural-text group-hover:text-natural-accent transition-colors">
                  Repetir Mensalmente
                </span>
              </label>

              {isRecurrent && (
                <div className="mt-4 p-4 bg-natural-bg rounded-xl space-y-4 border border-natural-border/50">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isEternal} 
                      onChange={(e) => setIsEternal(e.target.checked)}
                      className="w-4 h-4 rounded border-natural-border text-natural-accent"
                    />
                    <span className="text-sm font-medium text-natural-text">Lançamento Efetivo/Eterno</span>
                  </label>

                  {!isEternal && (
                     <div>
                        <label className="block text-xs font-bold text-natural-muted uppercase mb-1">
                          Quantidade de Meses
                        </label>
                        <input
                          type="number"
                          min="2"
                          max="60"
                          value={recurrenceCount}
                          onChange={(e) => setRecurrenceCount(e.target.value)}
                          className="w-full px-4 py-2 rounded-lg border border-natural-border bg-white text-sm outline-none focus:ring-2 focus:ring-natural-accent"
                        />
                     </div>
                  )}
                  <p className="text-[10px] text-natural-muted leading-relaxed">
                    * Serão criados lançamentos individuais para cada mês subsequente, permitindo o controle preciso do fluxo de caixa previsto.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-natural-bg hover:bg-natural-border/30 text-natural-muted font-bold py-3.5 rounded-xl transition-all border border-natural-border"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-[2] bg-natural-accent hover:bg-natural-accent-hover text-white font-bold py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              {initialData ? 'Salvar Alterações' : isRecurrent ? 'Criar Recorrência' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
