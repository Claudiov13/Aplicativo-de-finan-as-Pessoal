/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { 
  Wallet, 
  Plus, 
  FileDown, 
  LogOut, 
  User as UserIcon,
  Filter,
  BarChart3,
  ListFilter,
  TrendingUp,
  LayoutDashboard,
  Calculator as CalcIcon,
  PieChart as PieIcon,
  Bell,
  Calendar,
  AlertTriangle,
  ChevronDown,
  Settings,
  Bot,
  Edit2,
  Check,
  Trash2
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  ComposedChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { auth, db, signInWithGoogle, handleFirestoreError, OperationType } from './lib/firebase';
import { Transaction } from './types';
import { TransactionForm } from './components/TransactionForm';
import { SpreadsheetUpload } from './components/SpreadsheetUpload';
import { Calculator } from './components/Calculator';
import { SummaryCards, TransactionItem } from './components/DashboardElements';
import { GeminiAssistant } from './components/GeminiAssistant';
import { cn, formatCurrency } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [savingsGoal, setSavingsGoal] = useState(20);
  const [isEditingSavingsGoal, setIsEditingSavingsGoal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>();
  const [prefilledAmount, setPrefilledAmount] = useState<number | undefined>();
  const [monthFilter, setMonthFilter] = useState(new Date().getMonth());
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<'list' | 'projection' | 'analytics'>('list');
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);

  // Colors for charts
  const COLORS = ['#82947D', '#967E67', '#D1C7BD', '#6B5E52', '#E0D8D0', '#4A3D30'];

  // Categories helper
  const allCategories = useMemo(() => {
    const cats = new Set(transactions.map(t => t.category).filter(Boolean));
    return Array.from(cats);
  }, [transactions]);


  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Data listener
  useEffect(() => {
    if (!user) {
      setTransactions([]);
      return;
    }

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          date: d.date?.toDate() || new Date(),
          createdAt: d.createdAt?.toDate() || new Date(),
        } as Transaction;
      });
      setTransactions(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    return () => unsubscribe();
  }, [user]);

  // Calculations
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => 
      t.date.getMonth() === monthFilter && 
      t.date.getFullYear() === yearFilter
    );
  }, [transactions, monthFilter, yearFilter]);

  const stats = useMemo(() => {
    const currentMonthStats = filteredTransactions.reduce((acc, t) => {
      if (t.type === 'income') acc.income += t.amount;
      else acc.expenses += t.amount;
      return acc;
    }, { income: 0, expenses: 0 });

    // Calculate balance from ALL transactions BEFORE the current selected month
    const firstDayOfMonth = new Date(yearFilter, monthFilter, 1);
    const previousBalance = transactions
      .filter(t => t.date < firstDayOfMonth)
      .reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);

    return {
      ...currentMonthStats,
      previousBalance,
      totalBalance: previousBalance + currentMonthStats.income - currentMonthStats.expenses
    };
  }, [transactions, filteredTransactions, monthFilter, yearFilter]);

  const projectionData = useMemo(() => {
    const monthsCount = 24;
    const start = new Date();
    start.setDate(1);
    start.setHours(0,0,0,0);
    
    const data = [];
    let cumulativeBalance = 0;

    // Calculate current balance (all transactions before TODAY or start of projection)
    cumulativeBalance = transactions
      .filter(t => t.date < start)
      .reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);

    for (let i = 0; i < monthsCount; i++) {
        const d = new Date(start);
        d.setDate(1); // Set to 1st to prevent jumping over short months (e.g., setMonth from 31st to Feb)
        d.setMonth(start.getMonth() + i);
        
        const monthTransactions = transactions.filter(t => 
            t.date.getMonth() === d.getMonth() && 
            t.date.getFullYear() === d.getFullYear()
        );

        const income = monthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
        const expense = monthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
        
        cumulativeBalance += (income - expense);

        data.push({
            name: `${d.getMonth() + 1}/${d.getFullYear().toString().slice(-2)}`,
            Receita: income,
            Despesa: expense,
            Saldo: cumulativeBalance
        });
    }
    return data;
  }, [transactions]);

  const categoryData = useMemo(() => {
    const expenseMap: Record<string, number> = {};
    const incomeMap: Record<string, number> = {};

    filteredTransactions.forEach(t => {
      const cat = t.category || 'Sem Categoria';
      if (t.type === 'expense') {
        expenseMap[cat] = (expenseMap[cat] || 0) + t.amount;
      } else {
        incomeMap[cat] = (incomeMap[cat] || 0) + t.amount;
      }
    });

    return {
      expenses: Object.entries(expenseMap).map(([name, value]) => ({ name, value })),
      income: Object.entries(incomeMap).map(([name, value]) => ({ name, value }))
    };
  }, [filteredTransactions]);

  const subscriptions = useMemo(() => {
    // Current active subscriptions (marked as isSubscription)
    return transactions.filter(t => 
      t.isSubscription && 
      (!t.recurrenceId || t.recurrenceIndex === 1) // Only show the main one or first of sequence
    ).map(t => ({
      ...t,
      // Find latest one to show next date?
      nextDate: transactions
        .filter(st => st.recurrenceId === t.recurrenceId && st.date >= new Date())
        .sort((a,b) => a.date.getTime() - b.date.getTime())[0]?.date || t.date
    }));
  }, [transactions]);


  // Actions
  const handleAddOrUpdate = async (data: Omit<Transaction, 'id' | 'userId' | 'createdAt'> & { recurrenceTotal?: number }) => {
    if (!user) return;

    try {
      if (editingTransaction?.id) {
        // Se for recorrente, pergunta se deseja atualizar todos os futuros
        let updateFuture = false;
        if (editingTransaction.recurrenceId) {
            updateFuture = confirm("Deseja aplicar esta alteração em todos os lançamentos futuros desta série?");
        }

        if (updateFuture && editingTransaction.recurrenceId) {
            const batch = writeBatch(db);
            const futureTransactions = transactions.filter(t => 
                t.recurrenceId === editingTransaction.recurrenceId && 
                t.date >= editingTransaction.date
            );

            futureTransactions.forEach(t => {
                batch.update(doc(db, 'transactions', t.id!), {
                    ...data,
                    date: t.date, // Mantém a data original de cada ocorrência
                    updatedAt: serverTimestamp(),
                });
            });
            await batch.commit();
        } else {
            await updateDoc(doc(db, 'transactions', editingTransaction.id), {
                ...data,
                updatedAt: serverTimestamp(),
            });
        }
      } else if (data.recurrenceTotal !== undefined) {
          // Handle recurrence (Batch creation)
          const batch = writeBatch(db);
          const rid = crypto.randomUUID();
          // If eternal (0), we create for 24 months to fill the projection requirement
          const count = data.recurrenceTotal === 0 ? 24 : data.recurrenceTotal;

          for (let i = 0; i < count; i++) {
              const transactionDate = new Date(data.date);
              const targetMonth = transactionDate.getMonth() + i;
              transactionDate.setMonth(targetMonth);
              // Fix JS date wrap around (e.g. Jan 31 + 1 month = Mar 3)
              if (transactionDate.getMonth() !== targetMonth % 12) {
                  transactionDate.setDate(0); // Sets to last day of previous month
              }
              
              const ref = doc(collection(db, 'transactions'));
              batch.set(ref, {
                  ...data,
                  date: transactionDate,
                  userId: user.uid,
                  recurrenceId: rid,
                  recurrenceIndex: i + 1,
                  recurrenceTotal: data.recurrenceTotal,
                  createdAt: serverTimestamp(),
              });
          }
          await batch.commit();
      } else {
        await addDoc(collection(db, 'transactions'), {
          ...data,
          userId: user.uid,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transactions');
    }
  };

  const handleDelete = (id: string) => {
    const transaction = transactions.find(t => t.id === id);
    if (transaction) {
      setTransactionToDelete(transaction);
    } else {
      // Fallback
      deleteDoc(doc(db, 'transactions', id)).catch(e => console.error(e));
    }
  };

  const executeDelete = async (deleteSeries: boolean) => {
    if (!transactionToDelete) return;
    const { id, recurrenceId, date } = transactionToDelete;

    try {
      if (deleteSeries && recurrenceId) {
        const batch = writeBatch(db);
        const futureDocs = transactions.filter(t => 
          t.recurrenceId === recurrenceId && 
          t.date.getTime() >= date.getTime()
        );

        futureDocs.forEach(t => {
          if (t.id) batch.delete(doc(db, 'transactions', t.id));
        });
        await batch.commit();
      } else if (id) {
        await deleteDoc(doc(db, 'transactions', id));
      }
    } catch (error) {
      console.error("Erro ao excluir:", error);
      handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
    } finally {
      setTransactionToDelete(null);
    }
  };

  const handleBulkImport = async (newTransactions: Omit<Transaction, 'id' | 'userId' | 'createdAt'>[]) => {
     if (!user) return;
     const batch = writeBatch(db);
     newTransactions.forEach(t => {
       const ref = doc(collection(db, 'transactions'));
       batch.set(ref, {
         ...t,
         userId: user.uid,
         createdAt: serverTimestamp()
       });
     });
     try {
       await batch.commit();
     } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, 'transactions/batch');
     }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
           <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
           <p className="text-gray-500 font-medium">Carregando sua carteira...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-natural-bg flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl shadow-gray-200 border border-natural-border text-center">
          <div className="w-20 h-20 bg-natural-accent text-white rounded-3xl flex items-center justify-center mx-auto mb-10 shadow-lg shadow-natural-accent/20 font-bold text-3xl">
            <Wallet size={40} />
          </div>
          <h1 className="text-4xl font-extrabold text-natural-text tracking-tight">Finanças Natural</h1>
          <p className="mt-4 text-natural-muted leading-relaxed">
            Controle suas despesas, planeje seu futuro e tome as rédeas da sua vida financeira com facilidade.
          </p>
          <button
            onClick={signInWithGoogle}
            className="w-full mt-12 flex items-center justify-center gap-3 bg-white border-2 border-natural-border py-4 px-6 rounded-2xl font-bold text-natural-text hover:bg-natural-bg transition-all shadow-sm"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Entrar com Google
          </button>
          <p className="mt-8 text-xs text-natural-muted">
            Seus dados são protegidos e sincronizados na nuvem.
          </p>
        </div>
      </div>
    );
  }

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return (
    <div className="min-h-screen bg-natural-bg font-sans text-natural-text selection:bg-natural-accent/20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-natural-border p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-natural-accent text-white rounded-xl flex items-center justify-center shadow-lg shadow-natural-accent/10">
              <Wallet size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight hidden sm:block text-natural-text">Finanças Natural</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-natural-bg hover:bg-natural-border rounded-xl border border-natural-border transition-all"
              >
                <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border border-natural-border shadow-sm" alt="" />
                <div className="hidden md:flex flex-col items-start leading-none">
                  <span className="text-xs font-bold text-natural-text">{user.displayName?.split(' ')[0]}</span>
                  <span className="text-[10px] text-natural-muted font-medium">Conta Pessoal</span>
                </div>
                <ChevronDown size={14} className={cn("text-natural-muted transition-transform", isToolsMenuOpen && "rotate-180")} />
              </button>

              {isToolsMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsToolsMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-natural-border rounded-2xl shadow-xl z-20 py-2 animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-2 border-b border-natural-border mb-2">
                      <p className="text-[10px] uppercase tracking-wider text-natural-muted font-bold">Ferramentas</p>
                    </div>
                    
                    <button 
                      onClick={() => { setIsAssistantOpen(true); setIsToolsMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-natural-text hover:bg-natural-bg transition-colors"
                    >
                      <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                        <Bot size={18} />
                      </div>
                      <span className="font-semibold">Simular Gasto (IA)</span>
                    </button>

                    <button 
                      onClick={() => { setIsCalculatorOpen(true); setIsToolsMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-natural-text hover:bg-natural-bg transition-colors"
                    >
                      <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
                        <CalcIcon size={18} />
                      </div>
                      <span className="font-semibold">Calculadora</span>
                    </button>

                    <button 
                      onClick={() => { setIsImportOpen(true); setIsToolsMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-natural-text hover:bg-natural-bg transition-colors"
                    >
                      <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                        <FileDown size={18} />
                      </div>
                      <span className="font-semibold">Importar Planilha</span>
                    </button>

                    <div className="h-px bg-natural-border my-2" />
                    
                    <button 
                      onClick={() => signOut(auth)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-natural-expense hover:bg-rose-50 transition-colors"
                    >
                      <div className="w-8 h-8 bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center">
                        <LogOut size={18} />
                      </div>
                      <span className="font-semibold">Sair da Conta</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Welcome & Period Selector */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-extrabold text-natural-text pb-1">Seu Dinheiro</h2>
            <p className="text-natural-muted font-medium">Veja como estão suas finanças neste período.</p>
          </div>

          <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl shadow-sm border border-natural-border">
             <select 
               value={monthFilter}
               onChange={(e) => setMonthFilter(parseInt(e.target.value))}
               className="bg-transparent text-sm font-bold text-natural-text px-4 py-2 rounded-xl border-none focus:ring-0 cursor-pointer hover:bg-natural-bg"
             >
               {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
             </select>
             <select 
               value={yearFilter}
               onChange={(e) => setYearFilter(parseInt(e.target.value))}
               className="bg-transparent text-sm font-bold text-natural-text px-4 py-2 rounded-xl border-none focus:ring-0 cursor-pointer hover:bg-natural-bg"
             >
               {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
             </select>
          </div>
        </div>

        {/* Totals */}
        <SummaryCards 
          income={stats.income} 
          expenses={stats.expenses} 
          balance={stats.totalBalance} 
        />

        {/* Tab Selector */}
        <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-2xl shadow-sm border border-natural-border w-fit mb-8">
            <button
                onClick={() => setActiveTab('list')}
                className={cn(
                    "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                    activeTab === 'list' 
                        ? "bg-natural-accent text-white shadow-md shadow-natural-accent/10" 
                        : "text-natural-muted hover:text-natural-text"
                )}
            >
                <LayoutDashboard size={18} />
                Gestão
            </button>
            <button
                onClick={() => setActiveTab('projection')}
                className={cn(
                    "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                    activeTab === 'projection' 
                        ? "bg-natural-accent text-white shadow-md shadow-natural-accent/10" 
                        : "text-natural-muted hover:text-natural-text"
                )}
            >
                <TrendingUp size={18} />
                Projeção
            </button>
            <button
                onClick={() => setActiveTab('analytics')}
                className={cn(
                    "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                    activeTab === 'analytics' 
                        ? "bg-natural-accent text-white shadow-md shadow-natural-accent/10" 
                        : "text-natural-muted hover:text-natural-text"
                )}
            >
                <PieIcon size={18} />
                Análises
            </button>
        </div>

        {/* Dashboard Tools */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-4 items-start">
          
          {/* Main Content Area */}
          <div className="lg:col-span-8 space-y-6">
            {activeTab === 'list' ? (
                <>
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                        <ListFilter size={20} className="text-natural-muted" />
                        <h3 className="text-lg font-bold text-natural-text">Lançamentos</h3>
                    </div>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setIsCalculatorOpen(true)}
                            className="flex items-center gap-2 text-sm font-semibold text-natural-muted hover:text-natural-accent px-2 transition-all"
                        >
                            <CalcIcon size={16} />
                            <span className="hidden md:inline">Calculadora</span>
                        </button>
                        <button 
                            onClick={() => setIsImportOpen(true)}
                            className="flex items-center gap-2 text-sm font-semibold text-natural-accent hover:underline px-2 transition-all"
                        >
                            <FileDown size={16} />
                            <span className="hidden sm:inline">Importar Planilha</span>
                        </button>
                        <button 
                            onClick={() => { setEditingTransaction(undefined); setIsFormOpen(true); }}
                            className="flex items-center gap-2 text-sm font-semibold text-white px-5 py-2 bg-natural-accent hover:bg-natural-accent-hover rounded-xl transition-all shadow-md border border-natural-accent/50"
                        >
                            <Plus size={18} />
                            <span>Novo</span>
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-natural-border overflow-hidden">
                    <div className="divide-y divide-natural-bg px-2 sm:px-4">
                    {filteredTransactions.length === 0 ? (
                        <div className="py-20 text-center">
                            <div className="w-16 h-16 bg-natural-bg text-natural-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <BarChart3 size={32} />
                            </div>
                            <p className="text-natural-muted font-medium italic">Nenhuma movimentação neste período.</p>
                        </div>
                    ) : (
                        filteredTransactions.map(t => (
                        <TransactionItem 
                            key={t.id} 
                            transaction={t} 
                            onEdit={(t) => { setEditingTransaction(t); setIsFormOpen(true); }}
                            onDelete={handleDelete}
                        />
                        ))
                    )}
                    </div>
                </div>
                </>
            ) : activeTab === 'projection' ? (
                <div className="bg-white rounded-3xl shadow-sm border border-natural-border p-6 sm:p-8">

                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-natural-text">Previsão de Fluxo</h3>
                            <p className="text-sm text-natural-muted">Saldo acumulado projetado para os próximos 24 meses.</p>
                        </div>
                        <TrendingUp size={24} className="text-natural-accent" />
                    </div>

                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={projectionData}>
                                <defs>
                                    <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#82947D" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#82947D" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0EB" />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fontSize: 10, fill: '#8C8C82'}} 
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fontSize: 10, fill: '#8C8C82'}}
                                    tickFormatter={(value) => `R$${value/1000}k`}
                                />
                                <Tooltip 
                                    contentStyle={{ 
                                        borderRadius: '16px', 
                                        border: '1px solid #E5E5DF',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                        fontSize: '12px'
                                    }}
                                    formatter={(value: number) => formatCurrency(value)}
                                />
                                <Legend 
                                    verticalAlign="top" 
                                    align="right" 
                                    iconType="circle"
                                    content={({ payload }) => (
                                        <div className="flex justify-end gap-6 mb-6">
                                            {payload?.map((entry: any, index) => (
                                                <div key={index} className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                                    <span className="text-xs font-bold text-natural-muted uppercase tracking-wider">{entry.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="Saldo" 
                                    name="Saldo Acumulado"
                                    stroke="#82947D" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorSaldo)" 
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="Receita" 
                                    name="Receitas"
                                    stroke="#10b981" 
                                    strokeWidth={2} 
                                    strokeDasharray="5 5"
                                    dot={false}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="Despesa" 
                                    name="Despesas"
                                    stroke="#ef4444" 
                                    strokeWidth={2} 
                                    strokeDasharray="5 5"
                                    dot={false}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
                        <div className="p-4 bg-natural-bg rounded-2xl border border-natural-border">
                            <p className="text-[10px] uppercase tracking-wider text-natural-muted font-bold mb-1">Mês 12</p>
                            <p className="font-bold text-natural-text">{formatCurrency(projectionData[11]?.Saldo || 0)}</p>
                        </div>
                        <div className="p-4 bg-natural-bg rounded-2xl border border-natural-border">
                            <p className="text-[10px] uppercase tracking-wider text-natural-muted font-bold mb-1">Mês 24</p>
                            <p className="font-bold text-natural-text">{formatCurrency(projectionData[23]?.Saldo || 0)}</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Charts Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-3xl border border-natural-border p-6">
                            <h4 className="font-bold text-natural-text mb-6">Gastos por Categoria</h4>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={categoryData.expenses}
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {categoryData.expenses.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl border border-natural-border p-6">
                            <h4 className="font-bold text-natural-text mb-6">Receitas por Categoria</h4>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={categoryData.income}
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {categoryData.income.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Subscriptions Section */}
                    <div className="bg-white rounded-3xl border border-natural-border p-8">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <Bell className="text-natural-accent" size={24} />
                                <h3 className="text-xl font-bold">Gestão de Assinaturas (Opex Volátil)</h3>
                            </div>
                            <span className="text-sm text-natural-muted font-medium bg-natural-bg px-4 py-1 rounded-full">
                                {subscriptions.length} itens identificados para economia rápida
                            </span>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {subscriptions.length === 0 ? (
                                <div className="text-center py-10 bg-natural-bg/30 rounded-2xl border-2 border-dashed border-natural-border">
                                    <p className="text-natural-muted text-sm italic">
                                        Dica: Ative "Marcar como Assinatura" ao criar um lançamento para gerenciar seus serviços aqui.
                                    </p>
                                </div>
                            ) : (
                                subscriptions.map(sub => (
                                    <div key={sub.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-[#FBFAF8] rounded-2xl border border-natural-border group hover:border-natural-accent transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-natural-border text-natural-accent">
                                                <Calendar size={24} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-natural-text">{sub.description}</h4>
                                                <div className="flex items-center gap-2 text-xs text-natural-muted mt-1">
                                                    <span>{formatCurrency(sub.amount)}</span>
                                                    <span>•</span>
                                                    <span>Próximo vencto: {sub.nextDate.toLocaleDateString('pt-BR')}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 sm:mt-0 flex items-center gap-2">
                                            {sub.cancelReminderDate ? (
                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-100">
                                                    <Bell size={14} />
                                                    Lembrete: {new Date(sub.cancelReminderDate).toLocaleDateString('pt-BR')}
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => {
                                                        const dateStr = prompt("Data para lembrete de cancelamento (AAAA-MM-DD):");
                                                        if (dateStr) {
                                                            const d = new Date(dateStr);
                                                            if (!isNaN(d.getTime())) {
                                                                updateDoc(doc(db, 'transactions', sub.id), {
                                                                    cancelReminderDate: d.toISOString()
                                                                });
                                                                alert(`Lembrete configurado para ${d.toLocaleDateString()}! Enviaremos um alerta para ${user?.email}`);
                                                            }
                                                        }
                                                    }}
                                                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-natural-accent hover:bg-natural-accent hover:text-white border border-natural-accent rounded-xl transition-all"
                                                >
                                                    <Bell size={14} />
                                                    Configurar Cancelamento
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => sub.id && handleDelete(sub.id)}
                                                className="p-2 text-natural-muted hover:text-natural-expense hover:bg-white rounded-lg transition-all"
                                                title="Excluir assinatura"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
          </div>


          {/* Sidebar / Stats */}
          <div className="lg:col-span-4 space-y-6">
             <div className="bg-natural-accent p-8 rounded-3xl shadow-xl shadow-natural-accent/20 text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-white/10 rounded-full blur-3xl"></div>
                <div className="flex justify-between items-start mb-2 relative z-10">
                    <h4 className="text-sm font-semibold text-white/70 uppercase tracking-widest">Meta de Economia</h4>
                    <button 
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsEditingSavingsGoal(!isEditingSavingsGoal);
                        }}
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-all text-white flex items-center justify-center cursor-pointer"
                        title={isEditingSavingsGoal ? "Salvar meta" : "Editar meta"}
                    >
                        {isEditingSavingsGoal ? <Check size={14} /> : <Edit2 size={14} />}
                    </button>
                </div>
                
                <div className="flex items-center gap-2 mb-1 relative z-10">
                    {isEditingSavingsGoal ? (
                        <input 
                            type="number"
                            value={savingsGoal || ''}
                            onChange={(e) => {
                                const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                setSavingsGoal(val);
                            }}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') setIsEditingSavingsGoal(false);
                                if (e.key === 'Escape') setIsEditingSavingsGoal(false);
                            }}
                            className="bg-white/10 text-4xl font-bold w-24 outline-none border-b-2 border-white/50 focus:border-white transition-all px-2 rounded-t-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                    ) : ( 
                        <span 
                            className="text-4xl font-bold animate-in fade-in zoom-in-95 duration-300 cursor-pointer"
                            onClick={() => setIsEditingSavingsGoal(true)}
                        >
                            {savingsGoal}
                        </span>
                    )}
                    <span className="text-4xl font-bold">%</span>
                </div>
                <p className="text-xs text-white/60 mb-6 font-medium">
                    Representa <span className="text-white font-bold">{formatCurrency(stats.income * (savingsGoal / 100))}</span> da sua renda
                </p>

                <div className="w-full bg-white/20 rounded-full h-3 mb-3 p-0.5">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-700 shadow-sm",
                        ((stats.income - stats.expenses) / (stats.income || 1)) * 100 >= savingsGoal ? "bg-emerald-400" : "bg-white"
                      )} 
                      style={{ width: `${Math.min(( (stats.income - stats.expenses) / (stats.income || 1) ) * 100, 100)}%` }}
                    ></div>
                </div>
                <div className="flex justify-between items-center">
                    <p className="text-xs text-white font-bold">
                        {stats.income > 0 ? ( 
                            ((stats.income - stats.expenses) / stats.income) * 100 >= savingsGoal 
                                ? '✨ Meta batida!' 
                                : `Faltam ${formatCurrency(Math.max(0, (stats.income * savingsGoal / 100) - (stats.income - stats.expenses)))}` 
                        ) : 'Aguardando renda...'}
                    </p>
                    <span className="text-[10px] text-white/60 font-bold">ATUAL: {((stats.income - stats.expenses) / (stats.income || 1) * 100).toFixed(0)}%</span>
                </div>
             </div>

             <div className="bg-white p-6 rounded-3xl border border-natural-border shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                     <div className="p-2 bg-natural-bg rounded-xl">
                        <Filter size={18} className="text-natural-muted" />
                     </div>
                     <h4 className="font-bold text-natural-text">Visão Geral</h4>
                </div>
                <div className="space-y-4">
                   <div className="flex justify-between items-center text-sm">
                      <span className="text-natural-muted font-medium">Lançamentos</span>
                      <span className="font-bold text-natural-text">{filteredTransactions.length}</span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                      <span className="text-natural-muted font-medium">Maior Despesa</span>
                      <span className="font-bold text-natural-text">
                        {filteredTransactions.length > 0 
                          ? formatCurrency(Math.max(...filteredTransactions.filter(t => t.type === 'expense').map(t => t.amount), 0)) 
                          : 'R$ 0,00'}
                      </span>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      {transactionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl border border-natural-border animate-in slide-in-from-bottom-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-6">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-2xl font-bold text-natural-text mb-2">Excluir Lançamento</h3>
              
              {transactionToDelete.recurrenceId ? (
                <>
                  <p className="text-natural-muted mb-6">
                    "{transactionToDelete.description}" é um lançamento recorrente. O que você deseja fazer?
                  </p>
                  <div className="flex flex-col gap-3 w-full">
                    <button 
                      onClick={() => executeDelete(true)}
                      className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-colors"
                    >
                      Excluir Todos Futuros
                    </button>
                    <button 
                      onClick={() => executeDelete(false)}
                      className="w-full py-3 px-4 bg-white border-2 border-rose-600 text-rose-600 hover:bg-rose-50 font-bold rounded-xl transition-colors"
                    >
                      Excluir Apenas Este
                    </button>
                    <button 
                      onClick={() => setTransactionToDelete(null)}
                      className="w-full py-3 px-4 bg-natural-bg text-natural-text hover:bg-natural-border font-bold rounded-xl transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-natural-muted mb-6">
                    Tem certeza que deseja excluir "{transactionToDelete.description}"? Esta ação não pode ser desfeita.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 w-full">
                    <button 
                      onClick={() => executeDelete(false)}
                      className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-colors"
                    >
                      Sim, Excluir
                    </button>
                    <button 
                      onClick={() => setTransactionToDelete(null)}
                      className="flex-1 py-3 px-4 bg-natural-bg text-natural-text hover:bg-natural-border font-bold rounded-xl transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isFormOpen && (
        <TransactionForm 
          onClose={() => { 
            setIsFormOpen(false); 
            setEditingTransaction(undefined); 
            setPrefilledAmount(undefined);
          }}
          onSubmit={handleAddOrUpdate}
          initialData={editingTransaction}
          prefilledAmount={prefilledAmount}
          categories={allCategories}
        />
      )}

      {isImportOpen && (
        <SpreadsheetUpload 
          onClose={() => setIsImportOpen(false)}
          onDataParsed={handleBulkImport}
        />
      )}

      {isCalculatorOpen && (
        <Calculator 
          onClose={() => setIsCalculatorOpen(false)}
          onApplyValue={(val) => {
             setPrefilledAmount(val);
             setIsCalculatorOpen(false);
             setIsFormOpen(true);
          }}
        />
      )}

      <GeminiAssistant 
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(!isAssistantOpen)}
        onAddTransaction={async (data) => {
          await handleAddOrUpdate(data);
        }}
        transactions={transactions}
      />
    </div>
  );
}
