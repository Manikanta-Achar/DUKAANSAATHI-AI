import { useState, useEffect, useRef } from 'react';
import { useShop } from '../context/ShopContext.jsx';
import api from '../api/api.js';
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  Check,
  X,
  Volume2,
  HelpCircle,
  AlertCircle,
  Layers,
  ArrowRight,
} from 'lucide-react';

export default function VoiceAssistant({ isModal = false, onClose = null }) {
  const { speechLang, setSpeechLang, refreshAll, showToast } = useShop();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [interpretedAction, setInterpretedAction] = useState(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [audioFeedbackEnabled, setAudioFeedbackEnabled] = useState(true);

  // Editable fields for confirmation step
  const [editCustomer, setEditCustomer] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editProduct, setEditProduct] = useState('');
  const [editQuantity, setEditQuantity] = useState('');

  const recognitionRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = speechLang;

      recognition.onstart = () => {
        setIsListening(true);
        setTranscript('');
      };

      recognition.onresult = (event) => {
        const current = event.resultIndex;
        const text = event.results[current][0].transcript;
        setTranscript(text);
        setInputText(text);
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          showToast('Microphone access denied. You can type commands below.', 'error');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('Speech recognition setup error:', err);
      setSpeechSupported(false);
    }
  }, [speechLang, showToast]);

  // Update recognition language when setting changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = speechLang;
    }
  }, [speechLang]);

  // Voice synthesis feedback helper
  const speakText = (text) => {
    if (!audioFeedbackEnabled || !('speechSynthesis' in window) || !text) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = speechLang;
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
    }
  };

  const toggleListening = () => {
    if (!speechSupported) {
      showToast('Speech recognition not supported in this browser. Please type command.', 'error');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setInterpretedAction(null);
      try {
        recognitionRef.current?.start();
      } catch (e) {
        recognitionRef.current?.stop();
        setTimeout(() => recognitionRef.current?.start(), 150);
      }
    }
  };

  // Submit voice transcript or typed text to Backend for AI Interpretation
  const handleProcessCommand = async (textToProcess) => {
    const query = (textToProcess || inputText || transcript).trim();
    if (!query) {
      showToast('Please speak or type a shop command first', 'error');
      return;
    }

    setIsProcessing(true);
    setInterpretedAction(null);

    try {
      const res = await api.post('/api/voice/process', {
        transcript: query,
        language: speechLang,
      });

      if (res.data?.success) {
        const actionData = res.data.data;
        setInterpretedAction(actionData);

        // Pre-fill editable confirmation fields
        setEditCustomer(actionData.customerName || '');
        setEditAmount(actionData.amount ? String(actionData.amount) : '');
        setEditProduct(actionData.productName || '');
        setEditQuantity(actionData.quantity ? String(actionData.quantity) : '');

        // Speak guidance or question if clarification needed
        if (actionData.spokenFeedback) {
          speakText(actionData.spokenFeedback);
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to interpret command';
      showToast(errMsg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Execute Confirmed AI Action on Database
  const handleConfirmAndExecute = async () => {
    if (!interpretedAction) return;

    setIsExecuting(true);
    try {
      const payload = {
        action: interpretedAction.action,
        customerName: editCustomer || interpretedAction.customerName,
        amount: editAmount ? Number(editAmount) : interpretedAction.amount,
        productName: editProduct || interpretedAction.productName,
        quantity: editQuantity ? Number(editQuantity) : interpretedAction.quantity,
        unit: interpretedAction.unit,
        description: `Voice Command: ${inputText || transcript}`,
      };

      const res = await api.post('/api/voice/execute', payload);

      if (res.data?.success) {
        const confirmMsg = res.data.spokenConfirmation || 'Action executed successfully!';
        showToast(confirmMsg, 'success');
        speakText(confirmMsg);

        // Reset UI state
        setInterpretedAction(null);
        setInputText('');
        setTranscript('');

        // Refresh all store data (Stats, customers, inventory, transactions)
        await refreshAll();

        if (isModal && onClose) {
          setTimeout(onClose, 1200);
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Execution failed';
      showToast(errMsg, 'error');
    } finally {
      setIsExecuting(false);
    }
  };

  // Quick preset chips for rapid shopkeeper interaction
  const promptChips = [
    { label: 'Ramesh ko 40 rupaye udhaar do', lang: 'hi-IN' },
    { label: 'Ramesh ne 20 rupaye wapas diye', lang: 'hi-IN' },
    { label: 'Milk ke 5 packet stock mein add karo', lang: 'hi-IN' },
    { label: 'Reduce sugar stock by 2 packets', lang: 'en-IN' },
    { label: 'Aaj kitna udhaar baaki hai?', lang: 'hi-IN' },
    { label: 'Show low stock products', lang: 'en-IN' },
  ];

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden ${isModal ? 'p-6' : 'p-5 sm:p-6'}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
            <Sparkles className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              DukaanSaathi AI Voice Assistant
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                Active
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Speak or type natural shop commands in Hindi, Kannada, or English
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio voice toggle */}
          <button
            onClick={() => setAudioFeedbackEnabled(!audioFeedbackEnabled)}
            title={audioFeedbackEnabled ? 'Spoken voice feedback active' : 'Spoken voice feedback muted'}
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              audioFeedbackEnabled
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-slate-50 border-slate-200 text-slate-400'
            }`}
          >
            <Volume2 className="w-4 h-4" />
          </button>

          {isModal && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Mic Section */}
      <div className="py-6 flex flex-col items-center justify-center text-center">
        {/* Pulsing Mic Button */}
        <div className="relative">
          {isListening && (
            <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40"></div>
          )}
          <button
            onClick={toggleListening}
            className={`relative flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full shadow-lg transition-all duration-300 cursor-pointer ${
              isListening
                ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse-mic ring-8 ring-rose-100'
                : 'bg-gradient-to-tr from-emerald-700 to-emerald-500 hover:from-emerald-800 hover:to-emerald-600 text-white shadow-emerald-500/20'
            }`}
          >
            {isListening ? (
              <MicOff className="w-9 h-9 sm:w-10 sm:h-10" />
            ) : (
              <Mic className="w-9 h-9 sm:w-10 sm:h-10" />
            )}
          </button>
        </div>

        {/* Live Audio Waves Animation */}
        {isListening ? (
          <div className="mt-4 flex items-center gap-1.5 h-8">
            <span className="w-1.5 bg-emerald-600 rounded-full wave-bar-1"></span>
            <span className="w-1.5 bg-emerald-600 rounded-full wave-bar-2"></span>
            <span className="w-1.5 bg-emerald-600 rounded-full wave-bar-3"></span>
            <span className="w-1.5 bg-emerald-600 rounded-full wave-bar-4"></span>
            <span className="w-1.5 bg-emerald-600 rounded-full wave-bar-5"></span>
            <span className="ml-2 text-sm font-semibold text-emerald-800">
              Listening... बोलिए (Speak now)
            </span>
          </div>
        ) : (
          <p className="mt-3 text-sm font-medium text-slate-700">
            {speechSupported
              ? 'Tap microphone to speak, or use text input below'
              : 'Voice speech recognition not supported; please type your command'}
          </p>
        )}

        {/* Display recognized live transcript */}
        {transcript && (
          <div className="mt-2 px-4 py-2 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 text-sm max-w-lg font-medium">
            "{transcript}"
          </div>
        )}
      </div>

      {/* Text Command Input Fallback */}
      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleProcessCommand(inputText)}
          placeholder='E.g. "Ramesh ko 40 rupaye udhaar do" or "Add 10 milk packets"'
          className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
        />
        <button
          onClick={() => handleProcessCommand(inputText)}
          disabled={isProcessing || !inputText.trim()}
          className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-xs transition-all cursor-pointer"
        >
          {isProcessing ? (
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <Send className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">Interpret</span>
        </button>
      </div>

      {/* Quick Example Prompt Chips */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
          <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
          <span>Quick Kirana Voice Commands (Click to test):</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {promptChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInputText(chip.label);
                setSpeechLang(chip.lang);
                handleProcessCommand(chip.label);
              }}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 border border-slate-200/60 transition-colors cursor-pointer"
            >
              "{chip.label}"
            </button>
          ))}
        </div>
      </div>

      {/* INTERPRETED ACTION CONFIRMATION STEP */}
      {interpretedAction && (
        <div className="mt-5 p-4 sm:p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-emerald-200/60">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
              <h3 className="text-sm font-bold text-emerald-950">
                Interpreted Action — Please Confirm (पुष्टि करें)
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
              {interpretedAction.engine || 'Gemini AI'}
            </span>
          </div>

          {/* Action Summary & Explanation */}
          <div className="mt-3 space-y-2">
            <p className="text-sm font-medium text-slate-800">
              {interpretedAction.explanation}
            </p>

            {interpretedAction.clarificationQuestion && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>{interpretedAction.clarificationQuestion}</span>
              </div>
            )}

            {/* Editable Fields for User Verification */}
            {interpretedAction.action !== 'UNKNOWN' &&
              interpretedAction.action !== 'QUERY_UDHAAR' &&
              interpretedAction.action !== 'QUERY_LOW_STOCK' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-emerald-200/60">
                  {/* Customer field if relevant */}
                  {(interpretedAction.action === 'ADD_UDHAAR' ||
                    interpretedAction.action === 'RECORD_REPAYMENT') && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Customer Name (ग्राहक)
                        </label>
                        <input
                          type="text"
                          value={editCustomer}
                          onChange={(e) => setEditCustomer(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Amount (राशि ₹)
                        </label>
                        <input
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600"
                        />
                      </div>
                    </>
                  )}

                  {/* Product field if relevant */}
                  {(interpretedAction.action === 'ADD_STOCK' ||
                    interpretedAction.action === 'REDUCE_STOCK') && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Product Name (सामान)
                        </label>
                        <input
                          type="text"
                          value={editProduct}
                          onChange={(e) => setEditProduct(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Quantity (मात्रा {interpretedAction.unit || 'units'})
                        </label>
                        <input
                          type="number"
                          value={editQuantity}
                          onChange={(e) => setEditQuantity(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
          </div>

          {/* Confirmation Action Buttons */}
          <div className="mt-4 pt-3 border-t border-emerald-200/60 flex items-center justify-end gap-2.5">
            <button
              onClick={() => setInterpretedAction(null)}
              className="flex items-center gap-1 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Cancel (रद्द करें)</span>
            </button>

            {interpretedAction.action !== 'UNKNOWN' && (
              <button
                onClick={handleConfirmAndExecute}
                disabled={isExecuting}
                className="flex items-center gap-1.5 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {isExecuting ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Confirm & Save (हाँ, रिकॉर्ड करो)</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
