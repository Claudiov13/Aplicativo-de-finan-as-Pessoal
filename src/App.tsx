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
  AlertTriangle
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { auth, db, signInWithGoogle, handleFirestoreError, OperationType } from './lib/firebase';
import { Transaction } from './types';
import { TransactionForm } from './components/TransactionForm';
import { SpreadsheetUpload } from './components/SpreadsheetUpload';
import { Calculator } from './components/Calculator';
import { SummaryCards, TransactionItem } from './components/DashboardElements';
import { cn, formatCurrency } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>();
  const [prefilledAmount, setPrefilledAmount] = useState<number | undefined>();
  const [monthFilter, setMonthFilter] = useState(new Date().getMonth());
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<'list' | 'projection' | 'analytics'>('list');

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
        await updateDoc(doc(db, 'transactions', editingTransaction.id), {
          ...data,
          updatedAt: serverTimestamp(),
        });
      } else if (data.recurrenceTotal !== undefined) {
          // Handle recurrence (Batch creation)
          const batch = writeBatch(db);
          const rid = crypto.randomUUID();
          // If eternal (0), we create for 24 months to fill the projection requirement
          const count = data.recurrenceTotal === 0 ? 24 : data.recurrenceTotal;

          for (let i = 0; i < count; i++) {
              const transactionDate = new Date(data.date);
              transactionDate.setMonth(data.date.getMonth() + i);
              
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

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este lançamento?')) return;
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'transactions');
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
            <button 
              onClick={() => setIsCalculatorOpen(true)}
              className="p-2 text-natural-muted hover:text-natural-accent hover:bg-natural-bg rounded-lg transition-colors"
              title="Calculadora Rápida"
            >
              <CalcIcon size={20} />
            </button>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#FBFAF8] rounded-full border border-natural-border">
              <img src={user.photoURL || ''} className="w-6 h-6 rounded-full" alt="" />
              <span className="text-sm font-medium text-natural-text">{user.displayName?.split(' ')[0]}</span>
            </div>
            <button 
              onClick={() => signOut(auth)}
              className="p-2 text-natural-muted hover:text-natural-expense hover:bg-natural-bg rounded-lg transition-colors"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
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
                            <AreaChart data={projectionData}>
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
                                <Area 
                                    type="monotone" 
                                    dataKey="Saldo" 
                                    stroke="#82947D" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorSaldo)" 
                                />
                            </AreaChart>
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
                                                onClick={() => handleDelete(sub.id)}
                                                className="p-2 text-natural-muted hover:text-natural-expense hover:bg-white rounded-lg transition-all"
                                            >
                                                <AlertTriangle size={18} />
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
             <div className="bg-natural-accent p-8 rounded-3xl shadow-xl shadow-natural-accent/20 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-white/10 rounded-full blur-3xl"></div>
                <h4 className="text-sm font-semibold text-white/70 uppercase tracking-widest mb-2">Meta de Economia</h4>
                <div className="flex items-end gap-2 mb-6">
                    <span className="text-4xl font-bold">20%</span>
                    <span className="text-sm text-white/60 pb-1">da renda mensal</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2 mb-2">
                    <div 
                      className="bg-white h-full rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(( (stats.income - stats.expenses) / (stats.income || 1) ) * 100, 100)}%` }}
                    ></div>
                </div>
                <p className="text-xs text-white/80 font-medium">Você está {stats.income > 0 ? ( (stats.income - stats.expenses) / stats.income >= 0.2 ? 'dentro da meta!' : 'quase lá!' ) : 'começando agora.'}</p>
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

      {/* Floating Tools */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-4">
          <button 
            onClick={() => setIsCalculatorOpen(true)}
            className="w-14 h-14 bg-white border border-natural-border shadow-xl rounded-2xl flex items-center justify-center text-natural-accent hover:bg-natural-bg transition-all active:scale-95"
            title="Calculadora Rápida"
          >
             <CalcIcon size={24} />
          </button>
      </div>

      {/* Modals */}
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
    </div>
  );
}
