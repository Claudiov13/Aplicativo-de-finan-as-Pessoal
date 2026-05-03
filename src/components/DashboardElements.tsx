import React from 'react';
import { ArrowUpCircle, ArrowDownCircle, Wallet, Trash2, Edit2, Calendar } from 'lucide-react';
import { Transaction } from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';

export const SummaryCards: React.FC<{ 
  income: number; 
  expenses: number; 
  balance: number;
}> = ({ income, expenses, balance }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
    <div className="bg-white p-6 rounded-2xl border border-natural-border shadow-sm">
      <p className="text-xs uppercase tracking-wider text-natural-muted font-semibold mb-1">Entradas Totais</p>
      <h3 className="text-3xl font-bold text-natural-income mt-1">{formatCurrency(income)}</h3>
      <div className="mt-2 text-xs text-green-600 font-medium">Sincronizado</div>
    </div>

    <div className="bg-white p-6 rounded-2xl border border-natural-border shadow-sm">
      <p className="text-xs uppercase tracking-wider text-natural-muted font-semibold mb-1">Saídas Totais</p>
      <h3 className="text-3xl font-bold text-natural-expense mt-1">{formatCurrency(expenses)}</h3>
      <div className="mt-2 text-xs text-red-600 font-medium">Lançamentos do período</div>
    </div>

    <div className="bg-natural-accent p-6 rounded-2xl shadow-lg shadow-natural-accent/20">
      <p className="text-xs uppercase tracking-wider text-white/70 font-semibold mb-1">Saldo Disponível</p>
      <h3 className="text-3xl font-bold text-white mt-1">{formatCurrency(balance)}</h3>
      <div className="mt-2 text-xs text-white/80 italic">Base de dados ativa</div>
    </div>
  </div>
);

export const TransactionItem: React.FC<{ 
  transaction: Transaction; 
  onDelete: (id: string) => void;
  onEdit: (t: Transaction) => void;
}> = ({ transaction, onDelete, onEdit }) => (
  <div className="group flex items-center justify-between p-4 hover:bg-[#FBFAF8] rounded-xl transition-all border border-transparent hover:border-natural-border">
    <div className="flex items-center gap-4">
      <div className={cn(
        "p-2.5 rounded-lg flex items-center justify-center",
        transaction.type === 'income' ? "bg-natural-accent/10 text-natural-accent" : "bg-natural-expense/10 text-natural-expense"
      )}>
        {transaction.type === 'income' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
      </div>
      <div>
        <h4 className="font-semibold text-natural-text">{transaction.description}</h4>
        <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1 text-xs text-natural-muted">
                <Calendar size={12} />
                {formatDate(transaction.date)}
            </div>
            {transaction.category && (
                <span className="text-[10px] uppercase tracking-wider font-bold text-natural-muted bg-natural-bg px-1.5 py-0.5 rounded">
                    {transaction.category}
                </span>
            )}
        </div>
      </div>
    </div>
    <div className="flex items-center gap-4">
      <p className={cn(
        "font-bold text-lg",
        transaction.type === 'income' ? "text-green-600" : "text-red-500"
      )}>
        {transaction.type === 'income' ? '+' : '-'} {formatCurrency(transaction.amount)}
      </p>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={() => onEdit(transaction)}
          className="p-2 text-natural-muted hover:text-natural-accent hover:bg-natural-bg rounded-lg transition-all"
        >
          <Edit2 size={16} />
        </button>
        <button 
          onClick={() => transaction.id && onDelete(transaction.id)}
          className="p-2 text-natural-muted hover:text-natural-expense hover:bg-natural-bg rounded-lg transition-all"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  </div>
);
