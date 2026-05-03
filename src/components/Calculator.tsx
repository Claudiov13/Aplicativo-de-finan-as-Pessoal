import React, { useState } from 'react';
import { Calculator as CalcIcon, X, Delete, Divide, Minus, Plus, X as Multi, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface CalculatorProps {
  onClose: () => void;
  onApplyValue: (value: number) => void;
}

export const Calculator: React.FC<CalculatorProps> = ({ onClose, onApplyValue }) => {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [isCalculated, setIsCalculated] = useState(false);

  const handleChar = (char: string) => {
    if (isCalculated) {
      setDisplay(char);
      setIsCalculated(false);
      return;
    }
    setDisplay(display === '0' ? char : display + char);
  };

  const handleOperator = (op: string) => {
    setEquation(display + ' ' + op + ' ');
    setDisplay('0');
    setIsCalculated(false);
  };

  const calculate = () => {
    try {
      const result = eval(equation + display);
      setEquation(equation + display + ' =');
      setDisplay(String(Number(result.toFixed(2))));
      setIsCalculated(true);
    } catch (e) {
      setDisplay('Erro');
    }
  };

  const clear = () => {
    setDisplay('0');
    setEquation('');
    setIsCalculated(false);
  };

  const backspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const handleApply = () => {
    const val = parseFloat(display);
    if (!isNaN(val)) {
      onApplyValue(val);
    }
  };

  const Button = ({ child, onClick, className }: any) => (
    <button
      onClick={onClick}
      className={cn(
        "h-14 flex items-center justify-center rounded-xl font-bold text-lg transition-all active:scale-95",
        className
      )}
    >
      {child}
    </button>
  );

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[320px] overflow-hidden border border-natural-border shadow-natural-accent/5">
        <div className="p-4 bg-natural-bg border-b border-natural-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-natural-accent">
            <CalcIcon size={20} />
            <span className="font-bold text-sm">Calculadora</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-natural-border/50 rounded-full text-natural-muted">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 bg-white">
          <div className="mb-6 text-right">
             <p className="text-xs text-natural-muted h-4 overflow-hidden mb-1 font-mono">{equation}</p>
             <p className="text-3xl font-bold text-natural-text truncate font-mono tracking-tighter">
                {display}
             </p>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <Button child="AC" onClick={clear} className="bg-rose-50 text-rose-600 col-span-2" />
            <Button child={<Delete size={20} />} onClick={backspace} className="bg-natural-bg text-natural-muted" />
            <Button child="/" onClick={() => handleOperator('/')} className="bg-natural-accent/10 text-natural-accent" />

            <Button child="7" onClick={() => handleChar('7')} className="bg-[#FBFAF8] text-natural-text hover:bg-natural-bg" />
            <Button child="8" onClick={() => handleChar('8')} className="bg-[#FBFAF8] text-natural-text hover:bg-natural-bg" />
            <Button child="9" onClick={() => handleChar('9')} className="bg-[#FBFAF8] text-natural-text hover:bg-natural-bg" />
            <Button child="*" onClick={() => handleOperator('*')} className="bg-natural-accent/10 text-natural-accent" />

            <Button child="4" onClick={() => handleChar('4')} className="bg-[#FBFAF8] text-natural-text hover:bg-natural-bg" />
            <Button child="5" onClick={() => handleChar('5')} className="bg-[#FBFAF8] text-natural-text hover:bg-natural-bg" />
            <Button child="6" onClick={() => handleChar('6')} className="bg-[#FBFAF8] text-natural-text hover:bg-natural-bg" />
            <Button child="-" onClick={() => handleOperator('-')} className="bg-natural-accent/10 text-natural-accent" />

            <Button child="1" onClick={() => handleChar('1')} className="bg-[#FBFAF8] text-natural-text hover:bg-natural-bg" />
            <Button child="2" onClick={() => handleChar('2')} className="bg-[#FBFAF8] text-natural-text hover:bg-natural-bg" />
            <Button child="3" onClick={() => handleChar('3')} className="bg-[#FBFAF8] text-natural-text hover:bg-natural-bg" />
            <Button child="+" onClick={() => handleOperator('+')} className="bg-natural-accent/10 text-natural-accent" />

            <Button child="0" onClick={() => handleChar('0')} className="bg-[#FBFAF8] text-natural-text hover:bg-natural-bg" />
            <Button child="." onClick={() => handleChar('.')} className="bg-[#FBFAF8] text-natural-text hover:bg-natural-bg" />
            <Button child="=" onClick={calculate} className="bg-natural-accent text-white col-span-2 shadow-lg shadow-natural-accent/20" />
          </div>

          <button
            onClick={handleApply}
            className="w-full mt-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <CheckCircle2 size={18} />
            Usar como Lançamento
          </button>
        </div>
      </div>
    </div>
  );
};
